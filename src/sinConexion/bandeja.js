/*
 * Bandeja de cambios pendientes: lo que se hizo SIN internet y todavía no llegó al servidor.
 * Cada cambio se guarda en el almacén local (sobrevive a recargar o cerrar la app) y se envía solo, en orden, al volver la conexión.
 *
 * Un cambio es un dato plano (nada de funciones), por eso se puede guardar y reenviar:
 *   { tipo: "set",        ruta: "orders/abc", valor }
 *   { tipo: "mezclar",    ruta: "turnos/t1",  parche }
 *   { tipo: "borrar",     ruta: "orders/abc" }
 *   { tipo: "pedidoStock", pedido, deltas }
 *   { tipo: "incremento", ruta: "inventario/i1/stock", delta }
 *   { tipo: "registro",   ruta: "cuentas/c1" | "deudas/d1", base, nuevo }   ← se fusiona con el servidor al reenviar
 */
const PREFIJO_OP = "op:", PREFIJO_CF = "cf:";
let contador = 0;
const azar = () => { // texto corto único (no es un secreto: solo evita que dos cambios del mismo milisegundo choquen)
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (c && c.getRandomValues) return Array.from(c.getRandomValues(new Uint8Array(3)), (x) => x.toString(16).padStart(2, "0")).join("");
  contador += 1; return contador.toString(36).padStart(4, "0");
};

export function crearBandeja({ almacen, reloj = Date.now } = {}) {
  let ops = [];          // pendientes (espejo en memoria para poder consultarlos al instante)
  let conflictos = [];   // cambios que chocaron con otro dispositivo y esperan decisión de una persona
  const oyentes = new Set();
  let drenando = false;

  const avisar = () => { const r = resumen(); oyentes.forEach((f) => { try { f(r); } catch (e) { /* un oyente roto no frena a los demás */ } }); };
  const ordenar = (lista) => lista.sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
  function resumen() { return { pendientes: ops.length, conflictos: conflictos.length, sincronizando: drenando }; }

  async function iniciar() {
    const leer = async (pre) => { const ks = await almacen.claves(pre); return (await Promise.all(ks.map((k) => almacen.leer(k)))).filter(Boolean); };
    ops = ordenar(await leer(PREFIJO_OP));
    conflictos = ordenar(await leer(PREFIJO_CF));
    avisar();
  }

  async function encolar(op) {
    const nueva = { ...op, id: `${String(reloj()).padStart(14, "0")}-${azar()}`, ts: reloj() };
    // Varios cambios seguidos al MISMO registro se juntan en uno (conservando cómo estaba al principio): se fusiona una sola vez.
    if (nueva.tipo === "registro") {
      const previa = ops.find((o) => o.tipo === "registro" && o.ruta === nueva.ruta);
      if (previa) {
        previa.nuevo = nueva.nuevo; previa.actualizadoTs = nueva.ts;
        await almacen.guardar(PREFIJO_OP + previa.id, previa);
        avisar();
        return previa;
      }
    }
    ops.push(nueva);
    await almacen.guardar(PREFIJO_OP + nueva.id, nueva);
    avisar();
    return nueva;
  }

  async function quitar(id) {
    ops = ops.filter((o) => o.id !== id);
    await almacen.borrar(PREFIJO_OP + id);
  }

  async function marcarConflicto(op, detalle) {
    const cf = { ...op, detalle, conflictoTs: reloj() };
    await quitar(op.id);
    conflictos = ordenar([...conflictos, cf]);
    await almacen.guardar(PREFIJO_CF + cf.id, cf);
  }

  async function descartarConflicto(id) { conflictos = conflictos.filter((c) => c.id !== id); await almacen.borrar(PREFIJO_CF + id); avisar(); }

  async function reintentarConflicto(id) {
    const cf = conflictos.find((c) => c.id === id);
    if (!cf) return;
    const { detalle, conflictoTs, ...op } = cf;
    await descartarConflicto(id);
    ops = ordenar([...ops, op]);
    await almacen.guardar(PREFIJO_OP + op.id, op);
    avisar();
  }

  /**
   * Envía los pendientes en orden. `ejecutor(op)` devuelve { ok: true } o { conflicto: detalle }; si falla por la red lanza un error
   * (se detiene y deja todo como estaba para el próximo intento). Nunca corre dos envíos a la vez.
   */
  async function drenar(ejecutor, { esRed = () => true } = {}) {
    if (drenando) return { enviadas: 0, ocupada: true };
    drenando = true; avisar();
    let enviadas = 0, nuevosConflictos = 0, detenido = false;
    try {
      for (const op of [...ops]) {
        let res;
        try { res = await ejecutor(op); } catch (e) { if (esRed(e)) { detenido = true; break; } res = { conflicto: { motivo: "error", mensaje: String((e && e.message) || e) } }; }
        if (res && res.conflicto) { await marcarConflicto(op, res.conflicto); nuevosConflictos++; }
        else { await quitar(op.id); enviadas++; }
        avisar();
      }
    } finally { drenando = false; avisar(); }
    return { enviadas, conflictos: nuevosConflictos, detenido };
  }

  return {
    iniciar, encolar, quitar, drenar, resumen, descartarConflicto, reintentarConflicto,
    pendientes: () => [...ops], conflictos: () => [...conflictos],
    alCambiar: (f) => { oyentes.add(f); return () => oyentes.delete(f); },
  };
}

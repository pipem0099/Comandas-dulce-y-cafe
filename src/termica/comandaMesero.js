/*
 * Impresión de la comanda desde el equipo del MESERO (con o sin internet) y sin duplicados con la pantalla de Cocina.
 * Lógica pura (sin pantalla ni impresora): se prueba con `npm run comanda:probar`.
 *
 * Cada pedido de una cuenta es una RONDA. Tiene dos clases de «eventos» que hay que sacar impresos:
 *   · «n»        la comanda del pedido nuevo (solo sus productos: es la ronda nueva);
 *   · «aj-<hora>» un ticket de AJUSTE cuando se agregó o canceló algo ya enviado (`pedido.ultimoAjuste`).
 * Un evento se da por impreso únicamente cuando la impresora CONFIRMÓ: se anota en `pedido.impresiones[clave]` = { ts, por, equipo }.
 * Quien vea la marca (el otro equipo) no lo vuelve a imprimir.
 */
import { fallo } from "../fallos.js";
export const CLAVE_NUEVO = "n";
export const claveAjuste = (ts) => `aj-${ts}`;

const nombreDe = (it) => {
  const mods = it && it.mods && it.mods.length ? ` (${it.mods.map((m) => m.n).join(", ")})` : "";
  return `${(it && it.name) || "Producto"}${mods}`;
};

/** Número de ronda de un pedido dentro de su cuenta (1 = el primero que se envió). */
export function numeroRonda(pedidos, pedido) {
  const delaCuenta = (pedidos || []).filter((o) => o && o.cuentaId === pedido.cuentaId && o.estado !== "cancelado").sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
  const i = delaCuenta.findIndex((o) => o.id === pedido.id);
  return i >= 0 ? i + 1 : delaCuenta.length + 1;
}

/** Qué cambió entre lo que ya estaba enviado y lo nuevo: lo que SE AGREGÓ (+), lo que SE CANCELÓ (-) y las notas que cambiaron. */
export function diferenciasPedido(antes, despues) {
  const previos = new Map((antes || []).map((i) => [i.id, i]));
  const agregados = [], cancelados = [], notas = [];
  (despues || []).forEach((d) => {
    const p = previos.get(d.id);
    if (!p) { if (d.qty > 0) agregados.push({ name: nombreDe(d), qty: d.qty, ...(d.nota ? { nota: d.nota } : {}), ...(d.estacion ? { estacion: d.estacion } : {}), ...(d.pisoPrep ? { pisoPrep: d.pisoPrep } : {}) }); return; }
    previos.delete(d.id);
    if (d.qty > p.qty) agregados.push({ name: nombreDe(d), qty: d.qty - p.qty, ...(d.nota ? { nota: d.nota } : {}), ...(d.estacion ? { estacion: d.estacion } : {}), ...(d.pisoPrep ? { pisoPrep: d.pisoPrep } : {}) });
    else if (d.qty < p.qty) cancelados.push({ name: nombreDe(p), qty: p.qty - d.qty, ...(p.estacion ? { estacion: p.estacion } : {}), ...(p.pisoPrep ? { pisoPrep: p.pisoPrep } : {}) });
    if ((d.nota || "") !== (p.nota || "") && d.qty > 0) notas.push({ name: nombreDe(d), nota: d.nota || "" });
  });
  previos.forEach((p) => { if (p.qty > 0) cancelados.push({ name: nombreDe(p), qty: p.qty, ...(p.estacion ? { estacion: p.estacion } : {}), ...(p.pisoPrep ? { pisoPrep: p.pisoPrep } : {}) }); });
  return { agregados, cancelados, notas };
}

/** Ajuste listo para guardar en el pedido (`ultimoAjuste`); null si no hay nada que avisar a la cocina. */
export function ajusteDePedido(antes, despues, ts, notaAntes = "", notaDespues = "") {
  const { agregados, cancelados, notas } = diferenciasPedido(antes, despues);
  const notaGeneral = (notaAntes || "") !== (notaDespues || "") ? (notaDespues || "") : null;
  if (agregados.length === 0 && cancelados.length === 0 && notas.length === 0 && notaGeneral === null) return null;
  return { ts, agregados, cancelados, ...(notas.length ? { notas } : {}), ...(notaGeneral !== null ? { notaGeneral } : {}) };
}

export const yaImpreso = (pedido, clave) => !!(pedido && pedido.impresiones && pedido.impresiones[clave]);

/**
 * Cada pantalla de preparación imprime SOLO lo suyo (su estación y su piso), así que su marca lleva ese «ámbito»:
 *   «n» (sin ámbito) = se imprimió TODO el pedido (equipo del mesero o una pantalla que ve todas las estaciones) → nadie más lo imprime;
 *   «n_<ámbito>»     = esa estación/piso ya imprimió su parte → las demás siguen con la suya.
 */
export const claveConAmbito = (base, ambito = "") => (ambito ? `${base}_${String(ambito).replace(/[^A-Za-z0-9-]/g, "").slice(0, 28)}` : base);
export const ambitoDe = (estacion, piso) => [estacion && estacion !== "todas" ? estacion : "", piso && piso !== "todos" ? piso : ""].filter(Boolean).join("-");
const yaImpresoEn = (pedido, base, ambito) => yaImpreso(pedido, base) || (!!ambito && yaImpreso(pedido, claveConAmbito(base, ambito)));

/** Eventos de impresión de un pedido que todavía no se han impreso (y que ocurrieron después de `desdeTs`). */
export function eventosPorImprimir(pedido, { desdeTs = 0, ambito = "" } = {}) {
  if (!pedido || pedido.estado === "cancelado") return [];
  const eventos = [];
  if (pedido.ts >= desdeTs && !yaImpresoEn(pedido, CLAVE_NUEVO, ambito)) eventos.push({ base: CLAVE_NUEVO, clave: claveConAmbito(CLAVE_NUEVO, ambito), tipo: "nuevo" });
  const aj = pedido.ultimoAjuste;
  if (aj && aj.ts >= desdeTs && !yaImpresoEn(pedido, claveAjuste(aj.ts), ambito)) eventos.push({ base: claveAjuste(aj.ts), clave: claveConAmbito(claveAjuste(aj.ts), ambito), tipo: "ajuste", ajuste: aj });
  return eventos;
}

/** La marca que se anota cuando la impresora confirmó. */
export const marcaDeImpresion = ({ por, equipo, ahora = Date.now() }) => ({ ts: ahora, por: String(por || "equipo").slice(0, 120), ...(equipo ? { equipo: String(equipo).slice(0, 80) } : {}) });

/** ¿Este equipo debe imprimir la comanda al enviar? (opción de ESTE equipo + impresora configurada) */
export const imprimeAlEnviar = (cfg) => !!(cfg && cfg.tipo && cfg.imprimirAlEnviar);

/**
 * Pantalla de Cocina: los pedidos/ajustes que le tocan imprimir. Espera `esperaMs` desde que el equipo VIO el evento
 * por primera vez: así el equipo del mesero alcanza a imprimir y anotar su marca antes de que Cocina lo haga también.
 *   vistoEn: Map(clave → hora local en que se vio por primera vez)
 */
export function eventosParaCocina(pedidos, { desdeTs = 0, ambito = "", yaVisto, ahora = Date.now(), esperaMs = 6000, enCurso = () => false } = {}) {
  const lista = [];
  (pedidos || []).forEach((o) => {
    if (!o || o.estado === "cancelado") return;
    eventosPorImprimir(o, { desdeTs, ambito }).forEach((e) => {
      const llave = `${o.id}:${e.clave}`;
      if (enCurso(llave)) return;
      // un pedido que ya salió de «pendiente» (cocina lo está haciendo) no se imprime de golpe; los ajustes sí aplican
      if (e.tipo === "nuevo" && o.estado !== "pendiente") return;
      const visto = yaVisto(llave, ahora);   // devuelve la hora de la primera vez (y la anota si es nueva)
      lista.push({ pedido: o, evento: e, llave, listoEn: visto + esperaMs, esperar: Math.max(0, visto + esperaMs - ahora) });
    });
  });
  return lista.sort((a, b) => (a.evento.ajuste ? a.evento.ajuste.ts : a.pedido.ts) - (b.evento.ajuste ? b.evento.ajuste.ts : b.pedido.ts));
}

/**
 * Servicio de impresión con dependencias inyectables:
 *   impresora  { config(), imprimir(bytes) → { ok, motivo } }
 *   marcar     async (pedido, clave, marca) → anota la marca en el pedido (Firebase)
 *   armar      { nuevo(pedido, ctx), ajuste(pedido, ajuste, ctx), reimpresion(pedido, ctx) } → bytes
 * Reglas: la marca se anota SOLO si la impresora confirmó · el pedido NUNCA se bloquea por la impresora · no se imprime dos veces a la vez el mismo evento.
 */
export function crearServicioComandas({ impresora, marcar, armar, equipo = "", ahora = Date.now }) {
  const enCurso = new Set();
  async function ejecutar(pedido, clave, bytesFn, { por, equipo: equipoCtx, marcarAlTerminar = true }) {
    const llave = `${pedido.id}:${clave}`;
    if (enCurso.has(llave)) return { ok: true, repetido: true };
    enCurso.add(llave);
    try {
      let r;
      try { r = await impresora.imprimir(bytesFn()); } catch (e) { r = { ok: false, motivo: `No se pudo imprimir: ${(e && e.message) || e}` }; }
      if (r && r.ok && marcarAlTerminar) {
        try { await marcar(pedido, clave, marcaDeImpresion({ por, equipo: equipoCtx || equipo, ahora: ahora() })); } catch (err) { fallo("impresion:marca", err); /* impreso, pero la marca no se pudo anotar (podría reimprimirse): no es un fallo de impresión para quien imprime */ }
      }
      return r && r.ok ? { ok: true } : { ok: false, motivo: (r && r.motivo) || "No se pudo imprimir." };
    } finally { enCurso.delete(llave); }
  }
  return {
    enCurso: (llave) => enCurso.has(llave),
    imprimirNuevo: (pedido, ctx = {}) => ejecutar(pedido, claveConAmbito(CLAVE_NUEVO, ctx.ambito), () => armar.nuevo(pedido, ctx), ctx),
    imprimirAjuste: (pedido, ajuste, ctx = {}) => ejecutar(pedido, claveConAmbito(claveAjuste(ajuste.ts), ctx.ambito), () => armar.ajuste(pedido, ajuste, ctx), ctx),
    reimprimir: (pedido, ctx) => ejecutar(pedido, `re-${ahora()}`, () => armar.reimpresion(pedido, ctx), { ...ctx, marcarAlTerminar: false }),
  };
}

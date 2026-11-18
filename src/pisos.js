/*
 * Pisos, cajas y destino de preparación.
 *
 * Todo es opcional y retrocompatible: un negocio con un solo piso y una sola caja no cambia en nada.
 *  - config.pisos  = [{ id, nombre }]    (el primero es el "piso base": no se puede borrar)
 *  - mesa.piso     = id del piso (sin dato → piso base)
 *  - config.plano  = plano del piso base · config.planos[pisoId] = plano de los demás pisos
 *  - config.cajas  = [{ id, nombre }]    (la primera, "principal", es la caja de siempre)
 *  - turno.cajaId  = caja a la que pertenece el turno · pago.cajaId = caja que recibió ese pago
 *  - item.estacion / item.pisoPrep / item.pisoEntrega = a dónde va cada producto y dónde se entrega
 */

export const PISO_BASE = "p1";
export const CAJA_BASE = "principal";

export function getPisos(config) {
  const p = config && config.pisos;
  return Array.isArray(p) && p.length > 0 ? p : [{ id: PISO_BASE, nombre: "Piso 1" }];
}
export const hayVariosPisos = (config) => getPisos(config).length > 1;
export const nombrePiso = (config, id) => { const p = getPisos(config).find((x) => x.id === id); return p ? p.nombre : getPisos(config)[0].nombre; };

/** Id del piso de una mesa (si no tiene o el piso se borró, cae en el piso base). */
export function pisoIdDeMesa(mesa, config) {
  const pisos = getPisos(config);
  return mesa && mesa.piso && pisos.some((p) => p.id === mesa.piso) ? mesa.piso : pisos[0].id;
}
/** Piso de una mesa buscada por id de mesa (las de "para llevar"/domicilio no tienen piso: devuelve null). */
export function pisoDeMesaId(mesas, mesaId, config) {
  const m = (mesas || []).find((x) => String(x.id) === String(mesaId));
  return m ? pisoIdDeMesa(m, config) : null;
}
export const mesasDelPiso = (mesas, pisoId, config) => (mesas || []).filter((m) => pisoIdDeMesa(m, config) === pisoId);

/** Plano (zonas + alto) de un piso. */
export function planoDe(config, pisoId) {
  const pisos = getPisos(config);
  const vacio = { zonas: [], alto: 100 };
  if (!pisoId || pisoId === pisos[0].id) return (config && config.plano) || vacio;
  return (config && config.planos && config.planos[pisoId]) || vacio;
}
/** Devuelve la config con el plano de ese piso reemplazado. */
export function conPlano(config, pisoId, plano) {
  const pisos = getPisos(config);
  if (!pisoId || pisoId === pisos[0].id) return { ...config, plano };
  return { ...config, planos: { ...(config.planos || {}), [pisoId]: plano } };
}

/* ───────── Cajas ───────── */
export function getCajas(config) {
  const c = config && config.cajas;
  return Array.isArray(c) && c.length > 0 ? c : [{ id: CAJA_BASE, nombre: "Caja" }];
}
export const hayVariasCajas = (config) => getCajas(config).length > 1;
export const nombreCaja = (config, id) => { const c = getCajas(config).find((x) => x.id === id); return c ? c.nombre : "Caja"; };

/** Caja a la que pertenece un pago (los pagos viejos, sin dato, son de la caja principal). */
export const cajaDePago = (pago, cuenta) => (pago && pago.cajaId) || (cuenta && cuenta.cajaId) || CAJA_BASE;

/** Turnos abiertos (puede haber uno por caja). */
export const turnosAbiertosDe = (turnos) => (turnos || []).filter((t) => t.estado === "abierto");

/** Turnos abiertos que todavía no tienen caja asignada (de cuando había una sola). */
export const turnosSinCaja = (turnosAbiertos) => (turnosAbiertos || []).filter((t) => !t.cajaId);

/** Qué turno usa ESTE dispositivo: el de la caja elegida; si no eligió, el que tiene a su cargo; si no, el único abierto. */
export function turnoDeEsteEquipo(turnos, config, cajaElegida, usuarioActual) {
  const abiertos = turnosAbiertosDe(turnos);
  if (!hayVariasCajas(config)) return abiertos[0] || null;
  const idCaja = (t) => t.cajaId || CAJA_BASE;
  if (cajaElegida) return abiertos.find((t) => idCaja(t) === cajaElegida) || null;
  const mio = usuarioActual && abiertos.find((t) => t.responsableActual && t.responsableActual.uid === usuarioActual.uid);
  return mio || (abiertos.length === 1 ? abiertos[0] : null);
}

/* ───────── Destino de preparación de una línea de pedido ───────── */
/** Piso donde se prepara la línea (si no tiene dato: el piso base). */
export const pisoPrepDeLinea = (it, config) => { const pisos = getPisos(config); return it && it.pisoPrep && pisos.some((p) => p.id === it.pisoPrep) ? it.pisoPrep : pisos[0].id; };
/** Piso donde se entrega (si no tiene dato: donde se prepara). */
export const pisoEntregaDeLinea = (it, config) => { const pisos = getPisos(config); return it && it.pisoEntrega && pisos.some((p) => p.id === it.pisoEntrega) ? it.pisoEntrega : pisoPrepDeLinea(it, config); };

/* ───────── Destino elegido por el mesero al enviar (lógica pura; la pantalla está en DestinoPedido.jsx) ───────── */
export const DESTINO_INICIAL = { estacion: null, pisoPrep: null, pisoEntrega: null, porLinea: {} };

export function destinoCompleto(valor, hayEstaciones, hayPisos) {
  if (hayEstaciones && !valor.estacion) return false;
  if (hayPisos && (!valor.pisoPrep || !valor.pisoEntrega)) return false;
  return true;
}

/** Texto corto para el botón de la barra de envío: "Cocina · Piso 2 → Piso 3". */
export function resumenDestino(v, estaciones, pisos, nombrePisoMesa) {
  const partes = [];
  if (estaciones.length > 1 && v.estacion) partes.push(v.estacion === "auto" ? "Según producto" : (estaciones.find((e) => e.id === v.estacion) || {}).nombre || "—");
  if (pisos.length > 1 && v.pisoPrep && v.pisoEntrega) {
    const nombre = (id) => (id === "mesa" ? nombrePisoMesa || "Piso de la mesa" : (pisos.find((p) => p.id === id) || {}).nombre || "—");
    const a = nombre(v.pisoPrep), b = nombre(v.pisoEntrega);
    partes.push(a === b ? a : `${a} → ${b}`);
  }
  const extra = Object.keys(v.porLinea || {}).length;
  return partes.join(" · ") + (extra > 0 ? ` (+${extra})` : "");
}

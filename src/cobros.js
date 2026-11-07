/*
 * Cobros: qué le pasa a una cuenta cuando se registran pagos, se deshacen o se abre una cuenta nueva.
 * Son funciones PURAS que reciben la versión MÁS RECIENTE de la cuenta (la que está en el servidor) y devuelven la nueva:
 * así, si dos dispositivos cobran a la vez, ninguno borra el pago del otro (ver actualizarCuenta en firebase.js).
 * Se prueban con `npm run cobros:probar`.
 */
import { cuentaGranTotal, pagosDe, dayKey } from "./dinero.js";

/**
 * Suma pagos a la cuenta.
 * `extra` (opcional) son campos de la cuenta que se guardan junto con el pago, en la misma transacción.
 * Devuelve { cuenta, completo, totalNuevo, totalPagado, montoRegistrado, nuevos } o { error } si NO se debe cobrar:
 *  · "no-existe" · "no-abierta" (ya pagada, cancelada o fusionada: evita cobrar dos veces desde dos dispositivos)
 *  · "duplicado" (esos mismos pagos ya estaban guardados: un reintento no los repite)
 */
export function aplicarPagos(actual, entradas, { orders, modoSplit = null, externa = false, ahora = Date.now(), extra = null }) {
  if (!actual) return { error: "no-existe" };
  const previos = pagosDe(actual);
  const vueltaTotal = entradas.reduce((s, e) => s + (e.vuelta || 0), 0);
  // La vuelta dejada como propina sube la propina de la cuenta y el monto cobrado en la misma cantidad.
  const nuevos = entradas.map(({ pago, vuelta }) => (vuelta > 0 ? { ...pago, monto: pago.monto + vuelta, propinaVuelta: vuelta } : pago));
  if (nuevos.length > 0 && nuevos.every((p) => p.id && previos.some((x) => x.id === p.id))) return { error: "duplicado" };
  if (actual.estado && actual.estado !== "abierta") return { error: "no-abierta", estado: actual.estado };
  const totalNuevo = cuentaGranTotal(orders, actual) + vueltaTotal; // con la propina y el descuento MÁS recientes
  const nuevosPagos = [...previos, ...nuevos];
  const totalPagado = nuevosPagos.reduce((s, p) => s + p.monto, 0);
  const completo = totalPagado >= totalNuevo - 1;
  const propina = vueltaTotal > 0 ? { pct: null, monto: ((actual.propina && actual.propina.monto) || 0) + vueltaTotal } : (actual.propina || null);
  const cuenta = {
    ...actual, propina, pagos: nuevosPagos, splitMode: modoSplit || actual.splitMode || null,
    estado: completo ? "pagada" : "abierta", pagadaTs: completo ? ahora : actual.pagadaTs,
    ...(completo && !externa ? { liberada: false } : {}),
    ...(extra || {}), // campos que deben guardarse en el MISMO instante que el pago (ej. el modo de propina por producto)
  };
  return { cuenta, completo, totalNuevo, totalPagado, montoRegistrado: nuevos.reduce((s, p) => s + p.monto, 0), nuevos };
}

/**
 * Deshace SOLO los pagos que se acababan de registrar (por su id) sobre la cuenta tal como está ahora,
 * en vez de restaurar una copia vieja que borraría lo que otra persona hizo en el medio.
 */
export function deshacerPagos(actual, antes, nuevos) {
  if (!actual) return null;
  const ids = new Set(nuevos.map((p) => p.id).filter(Boolean));
  if (ids.size !== nuevos.length) return { ...antes }; // pagos sin id (datos viejos): se restaura la copia previa
  const resto = pagosDe(actual).filter((p) => !ids.has(p.id));
  return {
    ...actual, pagos: resto, estado: antes.estado, pagadaTs: antes.pagadaTs, propina: antes.propina,
    splitMode: antes.splitMode, liberada: antes.liberada,
    propinaModo: antes.propinaModo, propinaPagadores: antes.propinaPagadores,
  };
}

/** Deshace una cancelación sobre la cuenta tal como está ahora. */
export function deshacerCancelacionDe(actual, antes) {
  if (!actual) return null;
  const r = { ...actual, estado: antes.estado };
  ["canceladaTs", "canceladaPor", "motivoCancelacion", "montoCancelado"].forEach((k) => { delete r[k]; });
  return r;
}

/** Id de una cuenta nueva de mesa. Es PREVISIBLE (mesa + día + número) para que dos meseros que abren la misma mesa
 *  a la vez generen el mismo id y no queden dos cuentas abiertas. */
export const claveMesa = (mesa) => String(mesa).replace(/[.#$\[\]\/\s]/g, "_");
export const idCuentaNueva = (mesa, ts, n) => `c-${claveMesa(mesa)}-${dayKey(ts)}-${n}`;

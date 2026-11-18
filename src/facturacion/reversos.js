/*
 * Reverso de caja por Nota Crédito. Cuando el administrador anula una factura, el dinero se devuelve: ese reverso debe verse en el
 * cuadre de caja (efectivo que SALE del cajón) y en los reportes del día (tarjeta/transferencia devueltas). Puro, sin red.
 * El reverso cuenta en el momento de la Nota Crédito (anulacion.ts), no en el de la venta original.
 */
const METODOS = ["efectivo", "tarjeta", "transferencia", "otro"];

/** Reparte el monto de la nota entre los métodos con los que se pagó, en proporción y sin perder pesos. */
export function repartoReverso(anulacion) {
  const a = anulacion || {};
  const monto = Math.max(0, Math.round(Number(a.monto) || 0));
  const pagos = (Array.isArray(a.pagos) ? a.pagos : Object.values(a.pagos || {})).filter(Boolean);
  const por = { efectivo: 0, tarjeta: 0, transferencia: 0, otro: 0 };
  pagos.forEach((p) => { const m = METODOS.includes(p.metodo) ? p.metodo : "otro"; por[m] += Math.max(0, Number(p.monto) || 0); });
  const suma = METODOS.reduce((s, m) => s + por[m], 0);
  if (!suma) return { ...por, otro: monto };
  if (suma <= monto) return por;                       // la nota cubre todo lo cobrado
  const r = {}; let asignado = 0, mayor = "efectivo";
  METODOS.forEach((m) => { r[m] = Math.floor((por[m] * monto) / suma); asignado += r[m]; if (por[m] > por[mayor]) mayor = m; });
  r[mayor] += monto - asignado;
  return r;
}

/** Notas crédito emitidas entre `desde` (incluido) y `hasta` (excluido). `documentos` = objeto o lista de documentos del servidor. */
export function reversosEnRango(documentos, desde = 0, hasta = Infinity) {
  const lista = Array.isArray(documentos) ? documentos : Object.values(documentos || {});
  const notas = [];
  const total = { efectivo: 0, tarjeta: 0, transferencia: 0, otro: 0, monto: 0, cantidad: 0 };
  lista.forEach((d) => {
    if (!d || d.estado !== "anulada" || !d.anulacion) return;
    const ts = Number(d.anulacion.ts) || 0;
    if (ts < desde || ts >= hasta) return;
    const r = repartoReverso(d.anulacion);
    METODOS.forEach((m) => { total[m] += r[m]; });
    total.monto += METODOS.reduce((s, m) => s + r[m], 0); total.cantidad += 1;
    notas.push({ cuentaId: d.cuentaId, factura: `${d.prefijo || ""}${d.numero || ""}`, nota: d.anulacion.numeroNota || "", ts, motivo: d.anulacion.motivo || "", ...r });
  });
  return { ...total, notas: notas.sort((a, b) => a.ts - b.ts) };
}

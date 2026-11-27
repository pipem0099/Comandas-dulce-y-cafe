import { cuentaGranTotal, cuentaOrders } from "./dinero.js";

/* Cálculos de los reportes (sin pantalla, para poder probarlos): día de la semana, comparativa con el período anterior,
   productos que se piden juntos, y ventas por categoría. Todo parte de las cuentas PAGADAS y sus pedidos no cancelados. */

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const clave = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/** Ventas por día de la semana (lunes primero). `promedio` = lo que se vende en un día así de normal (total ÷ cuántos de esos días hubo ventas). */
export function porDiaSemana(pagadas, orders) {
  const filas = DIAS_SEMANA.map((nombre, i) => ({ i, nombre, total: 0, cuentas: 0, fechas: new Set() }));
  pagadas.forEach((c) => {
    const d = new Date(c.pagadaTs); const i = (d.getDay() + 6) % 7;
    filas[i].total += cuentaGranTotal(orders, c); filas[i].cuentas += 1; filas[i].fechas.add(clave(c.pagadaTs));
  });
  const res = filas.map((f) => ({ i: f.i, nombre: f.nombre, total: f.total, cuentas: f.cuentas, dias: f.fechas.size, promedio: f.fechas.size ? f.total / f.fechas.size : 0 }));
  const mejor = res.filter((f) => f.total > 0).sort((a, b) => b.promedio - a.promedio)[0];
  return { filas: res, mejorIndice: mejor ? mejor.i : -1 };
}

/** Resumen de un período: total, cuentas y ticket promedio. */
export function resumen(pagadas, orders) {
  const total = pagadas.reduce((s, c) => s + cuentaGranTotal(orders, c), 0);
  return { total, cuentas: pagadas.length, ticket: pagadas.length ? total / pagadas.length : 0 };
}

/** Compara el período actual (A) con el anterior (B). Variación en pesos y en %; el % es null si antes no había ventas. */
export function comparar(A, B) {
  const v = (a, b) => ({ actual: a, anterior: b, dif: a - b, pct: b > 0 ? ((a - b) / b) * 100 : null });
  return { total: v(A.total, B.total), cuentas: v(A.cuentas, B.cuentas), ticket: v(A.ticket, B.ticket) };
}

/** Rangos de comparación para cada período del reporte. Para el mes en curso se compara contra los MISMOS días del mes anterior. */
export function rangosVsAnterior(rango, ahora = Date.now()) {
  const n = new Date(ahora);
  const ini = (y, m) => new Date(y, m, 1).getTime();
  const nombreMes = (y, m) => { const s = new Date(y, m, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); };
  if (rango === "mesActual") {
    const a0 = ini(n.getFullYear(), n.getMonth()); const b0 = ini(n.getFullYear(), n.getMonth() - 1); const largo = ahora - a0;
    const b1 = Math.min(b0 + largo, ini(n.getFullYear(), n.getMonth()));
    return { A: [a0, ahora + 1], B: [b0, b1], etiquetaB: `${nombreMes(n.getFullYear(), n.getMonth() - 1)} (mismos días)` };
  }
  if (rango === "mesPasado") {
    const a0 = ini(n.getFullYear(), n.getMonth() - 1), a1 = ini(n.getFullYear(), n.getMonth());
    return { A: [a0, a1], B: [ini(n.getFullYear(), n.getMonth() - 2), a0], etiquetaB: nombreMes(n.getFullYear(), n.getMonth() - 2) };
  }
  if (rango === "mes") { const a0 = ahora - 30 * 86400000; return { A: [a0, ahora + 1], B: [a0 - 30 * 86400000, a0], etiquetaB: "los 30 días anteriores" }; }
  return null;
}

/** Pares de productos que van en la misma cuenta. Devuelve los más frecuentes con cuántas cuentas y qué % del total de cuentas. */
export function productosJuntos(pagadas, orders, { min = 2, max = 8 } = {}) {
  const pares = new Map(); let conVarios = 0;
  pagadas.forEach((c) => {
    const nombres = new Set();
    cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado").forEach((o) => o.items.forEach((it) => nombres.add(it.name)));
    const lista = Array.from(nombres).sort();
    if (lista.length >= 2) conVarios += 1;
    for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
      const k = lista[i] + "\u0000" + lista[j]; pares.set(k, (pares.get(k) || 0) + 1);
    }
  });
  const total = pagadas.length || 1;
  const lista = Array.from(pares.entries()).filter(([, n]) => n >= min).map(([k, n]) => { const [a, b] = k.split("\u0000"); return { a, b, cuentas: n, pct: (n / total) * 100 }; })
    .sort((x, y) => y.cuentas - x.cuentas || x.a.localeCompare(y.a)).slice(0, max);
  return { pares: lista, conVarios, totalCuentas: pagadas.length };
}

/** Ventas por categoría. La categoría sale del menú por nombre del producto; lo que ya no está en el menú va a «Sin categoría». */
export function porCategoria(pagadas, orders, menu) {
  const cat = {}; (menu || []).forEach((m) => { cat[m.name] = m.cat || "Sin categoría"; });
  const mapa = {};
  pagadas.forEach((c) => cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado").forEach((o) => o.items.forEach((it) => {
    const k = cat[it.name] || "Sin categoría"; const f = (mapa[k] = mapa[k] || { cat: k, qty: 0, total: 0 });
    f.qty += it.qty; f.total += it.qty * it.price;
  })));
  return Object.values(mapa).sort((a, b) => b.total - a.total);
}

/** Ventas por día del calendario (para tocar un día y abrirlo en Historial). */
export function porDia(pagadas, orders) {
  const mapa = {};
  pagadas.forEach((c) => {
    const d = new Date(c.pagadaTs); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const f = (mapa[k] = mapa[k] || { key: k, ts: c.pagadaTs, total: 0, cuentas: 0 }); f.total += cuentaGranTotal(orders, c); f.cuentas += 1;
  });
  return Object.values(mapa).sort((a, b) => b.key.localeCompare(a.key));
}

/** Comparativa lista para mostrar o imprimir: período actual contra el anterior, con las cuentas ya cargadas. null si el período no se compara aquí. */
export function comparativaPeriodo(rango, cuentas, orders, ahora = Date.now()) {
  const r = rangosVsAnterior(rango, ahora); if (!r) return null;
  const ent = (lim) => (cuentas || []).filter((c) => c.estado === "pagada" && c.pagadaTs >= lim[0] && c.pagadaTs < lim[1]);
  return { etiquetaB: r.etiquetaB, ...comparar(resumen(ent(r.A), orders), resumen(ent(r.B), orders)) };
}

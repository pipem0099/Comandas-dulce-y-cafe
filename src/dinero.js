/*
 * Cálculos de dinero de una cuenta — funciones puras, sin pantalla ni base de datos (se prueban con `npm run cobros:probar`).
 * Viven aquí (y no en utilidades.js) para que los cobros y la analítica las usen igual y para poder probarlas sin el navegador.
 */

export function orderTotal(order) {
  return order.items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

// Pedidos de una cuenta. Se arma UNA vez un índice por cuenta (por cada lista de pedidos) en vez de recorrer todos los
// pedidos para cada cuenta: con el historial de meses o años pasa de lentísimo (cuadrático) a instantáneo.
const indices = new WeakMap();
function indicePorCuenta(orders) {
  let m = indices.get(orders);
  if (!m) {
    m = new Map();
    for (const o of orders) { const l = m.get(o.cuentaId); if (l) l.push(o); else m.set(o.cuentaId, [o]); }
    indices.set(orders, m);
  }
  return m;
}
export function cuentaOrders(orders, cuentaId) {
  const l = indicePorCuenta(orders).get(cuentaId);
  return l ? l.slice() : []; // copia: quien la reciba puede ordenarla sin tocar el índice
}
export function cuentaSubtotal(orders, cuentaId) {
  return cuentaOrders(orders, cuentaId)
    .filter((o) => o.estado !== "cancelado")
    .reduce((sum, o) => sum + orderTotal(o), 0);
}
// Total a cobrar de una cuenta = subtotal - descuento + propina + domicilio
export function cuentaGranTotal(orders, cuenta) {
  const subtotal = cuentaSubtotal(orders, cuenta.id);
  const descuento = (cuenta.descuento && cuenta.descuento.monto) || 0;
  const propina = (cuenta.propina && cuenta.propina.monto) || 0;
  const envio = Number(cuenta.costoEnvio) || 0;
  return Math.max(0, subtotal - descuento + propina + envio);
}
export function pagosDe(cuenta) {
  // Firebase devuelve una lista como objeto cuando faltan posiciones: se acepta cualquiera de las dos formas.
  const p = cuenta && cuenta.pagos;
  if (!p) return [];
  return Array.isArray(p) ? p.filter(Boolean) : Object.values(p).filter(Boolean);
}
export function pagosTotal(cuenta) {
  return pagosDe(cuenta).reduce((s, p) => s + p.monto, 0);
}
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

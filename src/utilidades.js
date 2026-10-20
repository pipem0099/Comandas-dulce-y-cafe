import { itemNombre } from "./logica.js";
import { ROLES_ORDEN, ROL_LABELS } from "./constantes.js";

// Los roles se guardan en la base como mapa { admin: true } (las reglas lo leen así).
export function rolesAMapa(roles) { const m = {}; roles.forEach((r) => { m[r] = true; }); return m; }
export function rolLabel(rol) {
  return ROL_LABELS[rol] || rol;
}
// Un usuario puede tener uno o varios roles a la vez (ej. Mesero + Cajero).
// Esto sigue leyendo el formato viejo (un solo "rol") para no perder nada de
// lo que ya está guardado — pero todo lo nuevo se guarda como "roles": [...].
export function rolesDe(usuario) {
  if (!usuario) return [];
  if (Array.isArray(usuario.roles) && usuario.roles.length > 0) return usuario.roles;
  if (usuario.roles && typeof usuario.roles === "object" && !Array.isArray(usuario.roles)) return ROLES_ORDEN.filter((r) => usuario.roles[r] === true);
  if (usuario.rol) return [usuario.rol];
  return [];
}
export function tieneRol(usuario, rol) {
  return rolesDe(usuario).includes(rol);
}
export function rolesLabel(usuario) {
  const roles = rolesDe(usuario);
  // El propietario es siempre administrador: se muestra como "Propietario" en vez de "Admin".
  const etiquetas = (usuario && usuario.propietario === true ? ["Propietario"] : []).concat(
    roles.filter((r) => !(usuario && usuario.propietario === true && r === "admin")).map(rolLabel)
  );
  return etiquetas.length > 0 ? etiquetas.join(" + ") : "Sin rol";
}

/* ---------------- mesas (nombres personalizables) ---------------- */

export function mesaMatch(a, b) {
  return String(a) === String(b);
}
// Pedidos para llevar / domicilio: no tienen mesa, su "nombre" sale de la cuenta.
// App lo llena en cada render con las cuentas conocidas.
export const NOMBRES_EXTERNOS = {};
export function mesaNombre(mesas, mesaId) {
  if (NOMBRES_EXTERNOS[mesaId]) return NOMBRES_EXTERNOS[mesaId];
  const m = (mesas || []).find((x) => mesaMatch(x.id, mesaId));
  return m ? m.nombre : `Mesa ${mesaId}`;
}
export function mesaOrderIndex(mesas, mesaId) {
  const idx = (mesas || []).findIndex((x) => mesaMatch(x.id, mesaId));
  return idx === -1 ? 9999 : idx;
}

// Estado visual de una mesa para la cuadrícula y el plano: distingue entre
// "hay algo pendiente en cocina" (rojo), "ya está listo pero nadie lo ha
// llevado a la mesa" (azul), "cuenta abierta, todo servido" (verde) y libre.
export function estadoVisualMesa(cuenta, ordersDeLaCuenta) {
  if (!cuenta) return { tag: "Libre", bg: "var(--c-ede7d8-b)", color: "var(--c-8a8272-t)" };
  if (esPorLiberar(cuenta)) return { tag: "Pagada · liberar", bg: "var(--warn-solid)", color: "#1a1204", extra: "Toca para liberar la mesa" };
  const vivos = ordersDeLaCuenta.filter((o) => o.estado !== "cancelado");
  const enCocina = vivos.some((o) => o.estado === "pendiente" || o.estado === "preparando");
  // Lo que ya salió de cocina y falta llevar a la mesa pesa más que lo que sigue en cocina:
  // si salen de a una de 10 bebidas, la mesa avisa cuántas hay para servir YA.
  const paraServir = vivos.reduce((a, o) => a + porServir(o), 0);
  if (paraServir > 0) return { tag: `${paraServir} para servir`, bg: "var(--info-solid)", color: "#F4F6F8", extra: enCocina ? "El resto sigue en cocina" : null };
  if (enCocina) return { tag: "En cocina", bg: "var(--danger-solid)", color: "#F4F6F8" };
  return { tag: "Cuenta abierta", bg: "var(--ok-solid)", color: "#F4F6F8" };
}

/* ---------------- helpers ---------------- */

// Progreso por producto: cada línea de un pedido guarda cuántas unidades ya
// salieron de cocina (`listos`) y cuántas ya se llevaron a la mesa
// (`servidos`). Los pedidos viejos no tienen esos campos, así que se deducen
// del estado general del pedido.
export function itemListos(o, it) {
  if (typeof it.listos === "number") return Math.min(it.listos, it.qty);
  return o.estado === "listo" || o.estado === "servido" ? it.qty : 0;
}
export function itemServidos(o, it) {
  if (typeof it.servidos === "number") return Math.min(it.servidos, it.qty);
  return o.estado === "servido" ? it.qty : 0;
}
// Aplica nuevos items a un pedido y recalcula el estado general
// (pendiente → preparando → listo → servido) según el progreso por producto.
export function conProgreso(o, items) {
  const fijos = items.map((it) => {
    const l = itemListos({ ...o, items }, it);
    const sv = Math.min(itemServidos({ ...o, items }, it), l);
    return { ...it, listos: l, servidos: sv };
  });
  const todosServidos = fijos.every((it) => it.servidos >= it.qty);
  const todosListos = fijos.every((it) => it.listos >= it.qty);
  const algunoListo = fijos.some((it) => it.listos > 0);
  const estado = todosServidos ? "servido" : todosListos ? "listo" : (algunoListo || o.estado === "preparando") ? "preparando" : "pendiente";
  return { ...o, items: fijos, estado, listoTs: todosListos ? (o.listoTs || Date.now()) : null };
}
// Unidades que ya salieron de cocina pero todavía no se han llevado a la mesa.
export function porServir(o) {
  return o.items.reduce((a, it) => a + Math.max(0, itemListos(o, it) - itemServidos(o, it)), 0);
}
export function orderTotal(order) {
  return order.items.reduce((sum, it) => sum + it.price * it.qty, 0);
}
export function cuentaOrders(orders, cuentaId) {
  return orders.filter((o) => o.cuentaId === cuentaId);
}
export function cuentaSubtotal(orders, cuentaId) {
  return cuentaOrders(orders, cuentaId)
    .filter((o) => o.estado !== "cancelado")
    .reduce((sum, o) => sum + orderTotal(o), 0);
}
export function cuentaItemCount(orders, cuentaId) {
  return cuentaOrders(orders, cuentaId)
    .filter((o) => o.estado !== "cancelado")
    .reduce((sum, o) => sum + o.items.reduce((a, i) => a + i.qty, 0), 0);
}
// Total a cobrar de una cuenta = subtotal - descuento + propina
export function cuentaGranTotal(orders, cuenta) {
  const subtotal = cuentaSubtotal(orders, cuenta.id);
  const descuento = (cuenta.descuento && cuenta.descuento.monto) || 0;
  const propina = (cuenta.propina && cuenta.propina.monto) || 0;
  const envio = Number(cuenta.costoEnvio) || 0;
  return Math.max(0, subtotal - descuento + propina + envio);
}
export function itemsAgregados(orders, cuentaId) {
  const map = {};
  cuentaOrders(orders, cuentaId)
    .filter((o) => o.estado !== "cancelado")
    .forEach((o) =>
      o.items.forEach((it) => {
        const key = `${it.id}@${it.price}`;
        if (!map[key]) map[key] = { key, id: it.id, name: itemNombre(it), price: it.price, qty: 0 };
        map[key].qty += it.qty;
      })
    );
  return Object.values(map);
}
export function pagosDe(cuenta) {
  return cuenta.pagos || [];
}
export function pagosTotal(cuenta) {
  return pagosDe(cuenta).reduce((s, p) => s + p.monto, 0);
}
export function qtyAsignadaPorProducto(cuenta) {
  const map = {};
  pagosDe(cuenta)
    .filter((p) => p.tipo === "por_producto")
    .forEach((p) => (p.items || []).forEach((it) => (map[it.key] = (map[it.key] || 0) + it.qty)));
  return map;
}

export function elapsedLabel(ts) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function urgencyColor(ts) {
  const mins = (Date.now() - ts) / 60000;
  if (mins >= 10) return "var(--c-c1442d-t)";
  if (mins >= 5) return "var(--c-b98a2e-t)";
  return "var(--c-5b7553-t)";
}
export function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}
export function dateTimeLabel(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${date} · ${timeLabel(ts)}`;
}
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function yearKey(ts) {
  return `${new Date(ts).getFullYear()}`;
}
export function dayLabel(ts) {
  const d = new Date(ts);
  const s = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function monthLabel(ts) {
  const d = new Date(ts);
  const s = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function hourLabel(h) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function buildHistory(cuentas, orders) {
  const pagadas = cuentas.filter((c) => c.estado === "pagada");
  const days = {};
  pagadas.forEach((c) => {
    const ordsC = cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado");
    const total = cuentaGranTotal(orders, c);
    const itemCount = ordsC.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
    const pagos = pagosDe(c);
    const dk = dayKey(c.pagadaTs);
    if (!days[dk]) {
      days[dk] = {
        key: dk, ts: c.pagadaTs, total: 0, cuentasCount: 0, productos: {}, cuentas: [],
        porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0 }, porHora: {},
      };
    }
    const day = days[dk];
    day.total += total;
    day.cuentasCount += 1;
    if (c.pagadaTs < day.ts) day.ts = c.pagadaTs;
    pagos.forEach((p) => { day.porMetodo[p.metodoPago] = (day.porMetodo[p.metodoPago] || 0) + p.monto; });
    const hora = new Date(c.pagadaTs).getHours();
    day.porHora[hora] = (day.porHora[hora] || 0) + total;
    day.cuentas.push({ id: c.id, mesa: c.mesa, ts: c.ts, pagadaTs: c.pagadaTs, total, itemCount, pagos, mesero: c.mesero, propina: c.propina, descuento: c.descuento });
    ordsC.forEach((o) =>
      o.items.forEach((it) => {
        if (!day.productos[it.name]) day.productos[it.name] = { qty: 0, subtotal: 0 };
        day.productos[it.name].qty += it.qty;
        day.productos[it.name].subtotal += it.qty * it.price;
      })
    );
  });

  const months = {};
  Object.values(days).forEach((day) => {
    const mk = monthKey(day.ts);
    if (!months[mk]) months[mk] = { key: mk, ts: day.ts, total: 0, dayKeys: [] };
    months[mk].total += day.total;
    months[mk].dayKeys.push(day.key);
    if (day.ts < months[mk].ts) months[mk].ts = day.ts;
  });
  const years = {};
  Object.values(months).forEach((m) => {
    const yk = yearKey(m.ts);
    if (!years[yk]) years[yk] = { key: yk, total: 0, monthKeys: [] };
    years[yk].total += m.total;
    years[yk].monthKeys.push(m.key);
  });
  return { days, months, years };
}

/* ---------------- Turno de caja: movimientos, arqueos y ventas del turno ---------------- */

// Entradas y salidas de efectivo registradas en un turno (se guardan como mapa { id: movimiento }).
export function movimientosDe(turno) {
  const m = turno && turno.movimientos;
  return m ? Object.values(m).sort((a, b) => a.ts - b.ts) : [];
}
// Totales de movimientos vigentes (los anulados no cuentan)
export function totalesMovimientos(turno) {
  let entradas = 0, salidas = 0;
  movimientosDe(turno).forEach((m) => {
    if (m.anulado) return;
    if (m.tipo === "entrada") entradas += m.monto || 0; else salidas += m.monto || 0;
  });
  return { entradas, salidas };
}
// Cada vez que se calcula el arqueo queda guardado un intento (nadie puede "borrar" un conteo malo).
export function arqueosDe(turno) {
  const a = turno && turno.arqueos;
  return a ? Object.values(a).sort((x, y) => x.ts - y.ts) : [];
}
// Lo cobrado por método entre dos momentos (desde incluido, hasta excluido). Se suman los pagos hechos
// en ese lapso, incluidos los pagos parciales de cuentas que siguen abiertas.
export function ventasEnRango(cuentas, desde, hasta = Infinity) {
  const t = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  cuentas.filter((c) => c.estado !== "cancelada").forEach((c) => {
    pagosDe(c).forEach((p) => {
      const ts = p.ts || c.pagadaTs || 0;
      if (ts >= desde && ts < hasta && t[p.metodoPago] !== undefined) t[p.metodoPago] += p.monto;
    });
  });
  return t;
}
export function ventasDelTurno(cuentas, turno) {
  if (!turno) return { efectivo: 0, tarjeta: 0, transferencia: 0 };
  return ventasEnRango(cuentas, turno.aperturaTs, turno.cierreTs ? turno.cierreTs + 1 : Infinity);
}
// Propinas de las cuentas cobradas por completo en ese lapso
export function propinasEnRango(cuentas, desde, hasta = Infinity) {
  return cuentas
    .filter((c) => c.estado === "pagada" && c.pagadaTs >= desde && c.pagadaTs < hasta)
    .reduce((a, c) => a + ((c.propina && c.propina.monto) || 0), 0);
}
export function duracionLabel(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** Agrupa una lista (ya ordenada de más nuevo a más viejo) por mes: [{ key, titulo, items }]. */
export function agruparPorMes(lista, getTs) {
  const grupos = [];
  const idx = {};
  lista.forEach((x) => {
    const d = new Date(getTs(x));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!(key in idx)) {
      const nombre = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
      idx[key] = grupos.length;
      grupos.push({ key, titulo: nombre.charAt(0).toUpperCase() + nombre.slice(1), items: [] });
    }
    grupos[idx[key]].items.push(x);
  });
  return grupos.sort((a, b) => b.key.localeCompare(a.key));
}

/** Una cuenta de mesa ya pagada por completo que sigue ocupando la mesa hasta que alguien la libere. */
export const esPorLiberar = (c) => !!c && c.estado === "pagada" && c.liberada === false;
/** La cuenta que hoy "ocupa" la mesa: la abierta, o la ya pagada que está por liberar. */
export function cuentaDeMesa(cuentas, mesaId) {
  const lista = (cuentas || []).filter((c) => mesaMatch(c.mesa, mesaId));
  return lista.find((c) => c.estado === "abierta") || lista.find(esPorLiberar);
}

/** Reserva (pendiente o confirmada) de esta mesa que llega pronto: de 20 min antes a 90 min después de ahora. */
export function reservaProxima(reservas, mesaId, ahora = Date.now()) {
  return (reservas || [])
    .filter((r) => (r.estado === "pendiente" || r.estado === "confirmada") && r.mesaId && mesaMatch(r.mesaId, mesaId) && r.ts >= ahora - 20 * 60e3 && r.ts <= ahora + 90 * 60e3)
    .sort((a, b) => a.ts - b.ts)[0];
}

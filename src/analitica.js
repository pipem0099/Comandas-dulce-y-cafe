/*
 * Analítica, control y planificación — lógica pura (sin pantalla, sin base de datos).
 * Todo recibe las cuentas, los pedidos y el menú que la app ya tiene cargados y devuelve números listos para mostrar.
 * Las pantallas (Analisis.jsx, Reportes.jsx) y las alertas (alertas.js) solo dibujan lo que sale de aquí.
 *
 * Definiciones (se usan igual en todos los reportes):
 *   · Venta neta = lo vendido en productos MENOS descuentos. No incluye propinas ni domicilio.
 *   · Una cuenta cuenta como venta cuando está "pagada", y se fecha por pagadaTs (cuándo se cobró).
 *   · Costo de un producto: el que quedó congelado al vender → el de su receta → un % estimado por categoría → "sin costo".
 *     Lo "sin costo" NUNCA se cuenta como costo 0 (eso inventaría margen).
 */

export const DIA = 86400000;
export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

import { costoReceta } from "./logica.js";
import { dayKey } from "./dinero.js";

const n0 = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
export const inicioDia = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const haceDias = (ts, k) => { const d = new Date(ts); d.setDate(d.getDate() - k); return d.getTime(); };
const enRango = (ts, r) => ts >= r[0] && ts < r[1];
const claveDia = dayKey; // mismo formato que el resto de la app (dinero.js)

export function mediana(valores) { return percentil(valores, 50); }
export function percentil(valores, p) {
  const v = (valores || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return 0;
  if (v.length === 1) return v[0];
  const pos = (p / 100) * (v.length - 1);
  const i = Math.floor(pos), f = pos - i;
  return i + 1 < v.length ? v[i] + (v[i + 1] - v[i]) * f : v[i];
}
const promedio = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const desviacion = (v) => { if (v.length < 2) return 0; const m = promedio(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); };

/* ───────────── Base: ventas pagadas con su detalle ───────────── */
export function prepararVentas(cuentas, orders) {
  const porCuenta = new Map();
  for (const o of orders || []) {
    if (!o || o.estado === "cancelado") continue;
    if (!porCuenta.has(o.cuentaId)) porCuenta.set(o.cuentaId, []);
    porCuenta.get(o.cuentaId).push(o);
  }
  const ventas = [];
  for (const c of cuentas || []) {
    if (!c || c.estado !== "pagada" || !n0(c.pagadaTs)) continue;
    const items = (porCuenta.get(c.id) || []).flatMap((o) => o.items || []);
    const subtotal = items.reduce((s, it) => s + n0(it.qty) * n0(it.price), 0);
    const descuento = Math.min(subtotal, n0(c.descuento && c.descuento.monto));
    ventas.push({
      id: c.id, ts: c.pagadaTs, mesa: c.mesa, tipo: c.tipo || "mesa",
      mesero: c.mesero || "Sin asignar",
      subtotal, descuento, venta: Math.max(0, subtotal - descuento),
      propina: n0(c.propina && c.propina.monto),
      personas: n0(c.personas) > 0 ? Math.floor(c.personas) : null,
      descAutor: (c.descuento && c.descuento.aplicadoPor) || null,
      descMotivo: (c.descuento && c.descuento.motivo) || null,
      items,
    });
  }
  return ventas;
}

/* ───────────── 1) Comparación con el período anterior ───────────── */
export function rangosComparables(clave, ahora = Date.now()) {
  if (clave === "semana") {
    return { A: [ahora - 7 * DIA, ahora + 1], B: [ahora - 14 * DIA, ahora - 7 * DIA], etiqueta: "vs. los 7 días anteriores" };
  }
  if (clave === "mes") {
    const d = new Date(ahora);
    const ini = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const iniPrev = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    return { A: [ini, ahora + 1], B: [iniPrev, Math.min(iniPrev + (ahora - ini), ini)], etiqueta: "vs. el mismo tramo del mes pasado" };
  }
  // "hoy": de las 00:00 hasta ahora, contra el mismo día de la semana pasada hasta la misma hora
  const ayer7 = haceDias(ahora, 7);
  return { A: [inicioDia(ahora), ahora + 1], B: [inicioDia(ayer7), ayer7], etiqueta: "vs. el mismo día y hora de la semana pasada" };
}

export function resumenPeriodo(ventas, rango) {
  const v = ventas.filter((x) => enRango(x.ts, rango));
  const venta = v.reduce((s, x) => s + x.venta, 0);
  const cuentas = v.length;
  const conPersonas = v.filter((x) => x.personas);
  const personas = conPersonas.reduce((s, x) => s + x.personas, 0);
  const ventaConPersonas = conPersonas.reduce((s, x) => s + x.venta, 0);
  return {
    venta, cuentas,
    ticket: cuentas > 0 ? venta / cuentas : 0,
    personas, cuentasConPersonas: conPersonas.length,
    ticketPersona: personas > 0 ? ventaConPersonas / personas : null,
    propinas: v.reduce((s, x) => s + x.propina, 0),
    descuento: v.reduce((s, x) => s + x.descuento, 0),
    subtotal: v.reduce((s, x) => s + x.subtotal, 0),
  };
}

/** Variación porcentual con salvaguardas: sin base suficiente NO se inventa un porcentaje. */
export function comparar(a, b, { minCuentas = 5, banda = 5 } = {}) {
  if (!b || b.cuentas < minCuentas || b.venta <= 0) return { pct: null, diferencia: a.venta - (b ? b.venta : 0), nivel: "sin-base" };
  const pct = ((a.venta - b.venta) / b.venta) * 100;
  return { pct, diferencia: a.venta - b.venta, nivel: Math.abs(pct) < banda ? "igual" : pct > 0 ? "sube" : "baja" };
}

/* ───────────── 2) Ticket promedio: ¿más clientes o más consumo? ─────────────
 *   ΔVenta = (N_A − N_B)·T_B   (efecto afluencia)  +  N_A·(T_A − T_B)   (efecto ticket)   → suma exacta de A − B   */
export function descomponerVenta(a, b) {
  const afluencia = (a.cuentas - b.cuentas) * b.ticket;
  const ticket = a.cuentas * (a.ticket - b.ticket);
  return { afluencia, ticket, total: afluencia + ticket };
}

/* ───────────── 7) Costo automatizado + 3) rentabilidad ───────────── */
const SUGERENCIAS_COSTO = [
  [/caf[eé]|tinto|capuch|latte|mocca|espresso|americano|chocolate|caliente|te\b|t[eé]s\b|infusi/, 25],
  [/limonad|jugo|frapp|malteada|batido|smoothie|gaseosa|agua|bebida|fria|helad/, 25],
  [/torta|pastel|postre|brownie|galleta|cheesecake|dulce|panader|pan\b|croissant|donut|empanada|muffin|cupcake/, 30],
  [/desayuno|almuerzo|comida|plato|sandwich|s[aá]ndwich|hamburg|pizza|ensalada|wrap|snack|salado/, 33],
];
/** Porcentajes de costo orientativos por categoría (referencia general del sector: deben calibrarse con el dueño). */
export function sugerirPlantillaCostos(menu) {
  const out = {};
  [...new Set((menu || []).map((m) => m.cat).filter(Boolean))].forEach((cat) => {
    const t = String(cat).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const hit = SUGERENCIAS_COSTO.find(([re]) => re.test(t));
    out[cat] = hit ? hit[1] : 30;
  });
  return out;
}
export const precioSugerido = (costo, margenObjetivoPct) => {
  const m = n0(margenObjetivoPct) / 100;
  return costo > 0 && m > 0 && m < 1 ? costo / (1 - m) : null;
};

const costoRecetaDe = costoReceta; // la misma cuenta que usa el inventario (logica.js)

/** Costo de UNA unidad de la línea vendida y de dónde sale ("real" · "estimado" · "sin"). */
export function costoDeLinea(it, menuItem, insumos, plantilla) {
  const congelado = n0(it && it.cost);
  if (congelado > 0) return { costo: congelado, fuente: "real" };
  const rec = costoRecetaDe(menuItem && menuItem.receta, insumos);
  if (rec > 0) return { costo: rec, fuente: "real" };
  const pct = n0(plantilla && menuItem && plantilla[menuItem.cat]);
  if (pct > 0) return { costo: (n0(it && it.price) * pct) / 100, fuente: "estimado" };
  return { costo: 0, fuente: "sin" };
}

export function rentabilidad(ventas, menu, { rango, insumos = [], plantilla = {} } = {}) {
  const porId = new Map((menu || []).map((m) => [m.id, m]));
  const lista = rango ? ventas.filter((v) => enRango(v.ts, rango)) : ventas;
  const mapa = new Map();
  let ventaTotal = 0, ventaConCosto = 0, ventaCostoReal = 0, margenTotal = 0, hayEstimado = false;
  for (const v of lista) {
    const f = v.subtotal > 0 ? v.descuento / v.subtotal : 0; // el descuento se reparte en proporción a lo que pesó cada línea
    for (const it of v.items) {
      const key = it.baseId || it.id;
      const m = porId.get(key);
      const qty = n0(it.qty);
      const venta = qty * n0(it.price) * (1 - f);
      const { costo, fuente } = costoDeLinea(it, m, insumos, plantilla);
      let p = mapa.get(key);
      if (!p) { p = { id: key, name: (m && m.name) || it.name, cat: (m && m.cat) || "", qty: 0, venta: 0, ventaConCosto: 0, costo: 0, margen: 0, estimado: false, lineasSinCosto: 0 }; mapa.set(key, p); }
      p.qty += qty; p.venta += venta; ventaTotal += venta;
      if (fuente === "sin") { p.lineasSinCosto += 1; continue; }
      p.ventaConCosto += venta; p.costo += qty * costo; p.margen += venta - qty * costo;
      ventaConCosto += venta; margenTotal += venta - qty * costo;
      if (fuente === "estimado") { p.estimado = true; hayEstimado = true; } else ventaCostoReal += venta;
    }
  }
  const productos = [...mapa.values()].map((p) => ({
    ...p,
    conCosto: p.ventaConCosto > 0,
    margenPct: p.ventaConCosto > 0 ? (p.margen / p.ventaConCosto) * 100 : null,
  }));
  const conCosto = productos.filter((p) => p.conCosto).sort((a, b) => b.margen - a.margen);
  const sinCosto = productos.filter((p) => !p.conCosto);

  // Clasificación de "ingeniería de menú": popularidad × margen unitario
  const totalQty = conCosto.reduce((s, p) => s + p.qty, 0);
  const totalMargen = conCosto.reduce((s, p) => s + p.margen, 0);
  const umbralPop = conCosto.length > 0 ? 0.7 / conCosto.length : 0;
  const umbralMargen = totalQty > 0 ? totalMargen / totalQty : 0;
  conCosto.forEach((p) => {
    if (conCosto.length < 4) { p.clase = null; return; }
    const pop = totalQty > 0 ? p.qty / totalQty : 0;
    const mu = p.qty > 0 ? p.margen / p.qty : 0;
    p.clase = pop >= umbralPop ? (mu >= umbralMargen ? "estrella" : "caballo") : (mu >= umbralMargen ? "puzzle" : "perro");
  });

  return {
    productos: conCosto, sinCosto, hayEstimado,
    ventaTotal, ventaConCosto, margenTotal,
    margenPct: ventaConCosto > 0 ? (margenTotal / ventaConCosto) * 100 : null,
    cobertura: ventaTotal > 0 ? ventaConCosto / ventaTotal : 0,          // % de la venta que tiene algún costo
    coberturaReal: ventaTotal > 0 ? ventaCostoReal / ventaTotal : 0,     // % de la venta con costo real (no estimado)
  };
}

/** Productos del menú sin ventas (muertos) o casi sin ventas (moribundos) en los últimos `dias` días. */
export function productosMuertos(ventas, menu, { ahora = Date.now(), dias = 30, gracia = 14 } = {}) {
  const desde = ahora - dias * DIA;
  const primera = ventas.reduce((m, v) => Math.min(m, v.ts), Infinity);
  const diasDeDatos = Number.isFinite(primera) ? (ahora - primera) / DIA : 0;
  if (diasDeDatos < dias) return { muertos: [], moribundos: [], datosInsuficientes: true, diasDeDatos };
  const qty = new Map();
  ventas.filter((v) => v.ts >= desde && v.ts <= ahora).forEach((v) => v.items.forEach((it) => {
    const k = it.baseId || it.id; qty.set(k, (qty.get(k) || 0) + n0(it.qty));
  }));
  const candidatos = (menu || []).filter((m) => !m.temporada && !(m.creadoTs && ahora - m.creadoTs < gracia * DIA));
  const muertos = candidatos.filter((m) => !qty.get(m.id)).map((m) => ({ id: m.id, name: m.name, cat: m.cat, price: m.price }));
  const vendidos = candidatos.filter((m) => qty.get(m.id) > 0).map((m) => qty.get(m.id));
  const corte = vendidos.length >= 10 ? Math.max(1, percentil(vendidos, 10)) : 1;
  const moribundos = candidatos.filter((m) => qty.get(m.id) > 0 && qty.get(m.id) <= corte).map((m) => ({ id: m.id, name: m.name, cat: m.cat, qty: qty.get(m.id) }));
  return { muertos, moribundos, datosInsuficientes: false, diasDeDatos };
}

/* ───────────── 4) Control de pérdidas por empleado ─────────────
 * La persona "responsable" es el mesero de la cuenta; "autorizó" es quien canceló o dio el descuento.
 *   tasaCancel = montoCancelado / (ventaNeta + montoCancelado)      tasaDesc = descuentos / consumo bruto
 *   vs = tasa de la persona / mediana de la tasa de las demás   (solo con ≥3 personas, ≥10 cuentas cada una y ≥3 eventos)   */
export function metricasEmpleados(cuentas, ventas, rango) {
  const emp = new Map();
  const get = (n) => { if (!emp.has(n)) emp.set(n, { nombre: n, cuentas: 0, venta: 0, subtotal: 0, cancelN: 0, cancelMonto: 0, descN: 0, descMonto: 0, cortesiasTotales: 0 }); return emp.get(n); };
  const eventos = [];
  ventas.filter((v) => enRango(v.ts, rango)).forEach((v) => {
    const e = get(v.mesero); e.cuentas += 1; e.venta += v.venta; e.subtotal += v.subtotal;
    if (v.descuento > 0) {
      e.descN += 1; e.descMonto += v.descuento;
      if (v.subtotal > 0 && v.descuento >= v.subtotal * 0.999) e.cortesiasTotales += 1;
      eventos.push({ ts: v.ts, tipo: "descuento", monto: v.descuento, motivo: v.descMotivo || "", mesa: v.mesa, responsable: v.mesero, autorizo: v.descAutor || "" });
    }
  });
  (cuentas || []).filter((c) => c.estado === "cancelada" && n0(c.montoCancelado) > 0 && n0(c.canceladaTs) && enRango(c.canceladaTs, rango)).forEach((c) => {
    const nombre = c.mesero || "Sin asignar";
    const e = get(nombre); e.cancelN += 1; e.cancelMonto += n0(c.montoCancelado);
    eventos.push({ ts: c.canceladaTs, tipo: "cancelacion", monto: n0(c.montoCancelado), motivo: c.motivoCancelacion || "", mesa: c.mesa, responsable: nombre, autorizo: c.canceladaPor || "" });
  });
  const lista = [...emp.values()].map((e) => ({
    ...e,
    tasaCancel: e.venta + e.cancelMonto > 0 ? e.cancelMonto / (e.venta + e.cancelMonto) : 0,
    tasaDesc: e.subtotal > 0 ? e.descMonto / e.subtotal : 0,
  }));
  // Con equipos chicos (3 a 6 personas) un puntaje z casi nunca supera 2, así que cada persona se compara contra la
  // MEDIANA de las demás: "vs" = su tasa / la mediana de las otras (Infinity = las demás casi no tienen y ella sí).
  const elegibles = lista.filter((e) => e.cuentas >= 10);
  const vsOtros = (e, campo, eventos, minAbs) => {
    const otros = elegibles.filter((x) => x !== e).map((x) => x[campo]);
    if (e.cuentas < 10 || otros.length < 2 || eventos < 3) return null;
    const m = mediana(otros);
    return m > 0 ? e[campo] / m : (e[campo] >= minAbs ? Infinity : 0);
  };
  lista.forEach((e) => {
    e.vsCancel = vsOtros(e, "tasaCancel", e.cancelN, 0.02);
    e.vsDesc = vsOtros(e, "tasaDesc", e.descN, 0.05);
    e.revisar = (e.vsCancel !== null && e.vsCancel >= 2.5) || (e.vsDesc !== null && e.vsDesc >= 2.5) || e.cortesiasTotales >= 3;
  });
  const puedeZ = elegibles.length >= 3;
  lista.sort((a, b) => (b.cancelMonto + b.descMonto) - (a.cancelMonto + a.descMonto));
  eventos.sort((a, b) => b.ts - a.ts);
  return { empleados: lista, eventos, equipoSuficiente: puedeZ };
}

/* ───────────── 5) Planificación: días, horas, personal y compras ───────────── */
function ventasPorDia(ventas, { ahora, semanas }) {
  const hoy0 = inicioDia(ahora);
  const desde = hoy0 - semanas * 7 * DIA;
  const primera = ventas.reduce((m, v) => Math.min(m, v.ts), Infinity);
  if (!Number.isFinite(primera)) return { dias: [], desde: hoy0 };
  const ini = Math.max(desde, inicioDia(primera));
  const dias = new Map();
  for (let t = ini; t < hoy0; t = inicioDia(t + 36 * 3600000)) {
    dias.set(claveDia(t), { ts: t, w: new Date(t).getDay(), venta: 0, cuentas: 0, hora: Array(24).fill(0), cuentasHora: Array(24).fill(0), unidades: {} });
  }
  ventas.forEach((v) => {
    const d = dias.get(claveDia(v.ts)); if (!d) return;
    const h = new Date(v.ts).getHours();
    d.venta += v.venta; d.cuentas += 1; d.hora[h] += v.venta; d.cuentasHora[h] += 1;
    v.items.forEach((it) => { const k = it.baseId || it.id; d.unidades[k] = (d.unidades[k] || 0) + n0(it.qty); });
  });
  return { dias: [...dias.values()], desde: ini };
}
function factorTendencia(ventas, ahora) {
  const hoy0 = inicioDia(ahora);
  const primera = ventas.reduce((m, v) => Math.min(m, v.ts), Infinity);
  if (!Number.isFinite(primera) || hoy0 - primera < 56 * DIA) return 1;
  const suma = (a, b) => ventas.filter((v) => v.ts >= a && v.ts < b).reduce((s, v) => s + v.venta, 0);
  const rec = suma(hoy0 - 28 * DIA, hoy0), prev = suma(hoy0 - 56 * DIA, hoy0 - 28 * DIA);
  return prev > 0 ? Math.min(1.2, Math.max(0.8, rec / prev)) : 1;
}

export function planificacionSemanal(ventas, { ahora = Date.now(), semanas = 8, cuentasPorMeseroHora = 6 } = {}) {
  const { dias } = ventasPorDia(ventas, { ahora, semanas });
  const g = factorTendencia(ventas, ahora);
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  const porDia = Array.from({ length: 7 }, (_, w) => {
    const ds = dias.filter((d) => d.w === w);
    const totales = ds.map((d) => d.venta);
    ds.forEach((d) => d.hora.forEach((x, h) => { heat[w][h] += x / ds.length; }));
    const cuentasHora = Array(24).fill(0);
    ds.forEach((d) => d.cuentasHora.forEach((x, h) => { cuentasHora[h] += x / ds.length; }));
    const max = Math.max(...heat[w]);
    let franja = null;
    if (max > 0) {
      const horasFuertes = heat[w].map((x, h) => (x >= 0.6 * max ? h : -1)).filter((h) => h >= 0);
      franja = { desde: Math.min(...horasFuertes), hasta: Math.max(...horasFuertes) + 1 };
    }
    const picoCuentas = Math.max(...cuentasHora);
    return {
      w, nombre: DIAS_SEMANA[w], n: ds.length,
      mediana: mediana(totales), p25: percentil(totales, 25), p75: percentil(totales, 75),
      pronostico: mediana(totales) * g,
      franja,
      personalPico: picoCuentas > 0 ? Math.max(1, Math.ceil(picoCuentas / Math.max(1, cuentasPorMeseroHora))) : 0,
    };
  });
  return { dias: porDia, heat, g, suficiente: dias.length >= 14 };
}

/** Qué comprar para los próximos días: unidades esperadas × receta, menos lo que hay (dejando el mínimo de cada insumo). */
export function comprasSugeridas(ventas, menu, insumos, { ahora = Date.now(), semanas = 8, diasAdelante = 3 } = {}) {
  const { dias } = ventasPorDia(ventas, { ahora, semanas });
  if (dias.length < 14) return { filas: [], suficiente: false };
  const g = factorTendencia(ventas, ahora);
  const unidadesPorW = Array.from({ length: 7 }, () => ({}));
  for (let w = 0; w < 7; w++) {
    const ds = dias.filter((d) => d.w === w);
    const claves = new Set(ds.flatMap((d) => Object.keys(d.unidades)));
    claves.forEach((k) => { unidadesPorW[w][k] = mediana(ds.map((d) => d.unidades[k] || 0)) * g; });
  }
  const demanda = {};
  for (let i = 1; i <= diasAdelante; i++) {
    const w = new Date(haceDias(ahora, -i)).getDay();
    Object.entries(unidadesPorW[w]).forEach(([k, u]) => {
      const m = (menu || []).find((x) => x.id === k);
      ((m && m.receta) || []).forEach((r) => { if (r.insumoId && n0(r.cant) > 0) demanda[r.insumoId] = (demanda[r.insumoId] || 0) + u * r.cant; });
    });
  }
  const filas = (insumos || []).map((ins) => {
    const d = demanda[ins.id] || 0;
    const comprar = Math.max(0, d + n0(Number(ins.minimo)) - n0(Number(ins.stock)));
    return { id: ins.id, nombre: ins.nombre, unidad: ins.unidad, demanda: d, stock: n0(Number(ins.stock)), comprar, costo: comprar * n0(Number(ins.costo)) };
  }).filter((f) => f.demanda > 0 && f.comprar > 0).sort((a, b) => b.costo - a.costo);
  return { filas, suficiente: true };
}

/* ───────────── 6) Alertas contra el histórico (mismo día de la semana, misma hora) ───────────── */
export function poissonColaSuperior(x, lambda) {
  if (x <= 0) return 1;
  const l = Math.max(lambda, 0.05);
  let termino = Math.exp(-l), acumulado = 0;
  for (let k = 0; k < x; k++) { acumulado += termino; termino *= l / (k + 1); }
  return Math.max(0, 1 - acumulado);
}
const UMBRALES = { baja: { z: [2.5, 3.5], p: [0.02, 0.005] }, normal: { z: [2, 3], p: [0.05, 0.01] }, alta: { z: [1.5, 2.5], p: [0.1, 0.03] } };

export function alertasBaseline(ventas, cuentas, { ahora = Date.now(), sensibilidad = "normal", semanas = 8 } = {}) {
  const u = UMBRALES[sensibilidad] || UMBRALES.normal;
  const out = [];
  const hoyRango = [inicioDia(ahora), ahora + 1];
  const dia = DIAS_SEMANA[new Date(ahora).getDay()].toLowerCase();
  // Los mismos días de semana anteriores, cortados a la misma hora del día. Solo cuentan los días en que hubo ventas.
  const historicos = [];
  for (let k = 1; k <= semanas; k++) {
    const corte = haceDias(ahora, 7 * k);
    const dia0 = inicioDia(corte);
    if (!ventas.some((v) => v.ts >= dia0 && v.ts < dia0 + DIA)) continue;
    historicos.push([dia0, corte + 1]);
  }
  if (historicos.length < 4) return out;
  const ventasEn = (r) => ventas.filter((v) => enRango(v.ts, r));
  const cancEn = (r) => (cuentas || []).filter((c) => c.estado === "cancelada" && n0(c.montoCancelado) > 0 && n0(c.canceladaTs) && enRango(c.canceladaTs, r));
  const estadoRobusto = (vals) => { const m = mediana(vals); const mad = mediana(vals.map((x) => Math.abs(x - m))); return { m, sigma: Math.max(1.4826 * mad, 0.1 * Math.abs(m), 1) }; };
  const dinero = (x) => `$${Math.round(x).toLocaleString("es-CO")}`;

  // Ventas por debajo de lo habitual
  const vh = historicos.map((r) => ventasEn(r).reduce((s, v) => s + v.venta, 0));
  const vHoy = ventasEn(hoyRango).reduce((s, v) => s + v.venta, 0);
  const rv = estadoRobusto(vh);
  if (rv.m >= 20000) {
    const z = (vHoy - rv.m) / rv.sigma;
    if (z <= -u.z[0]) out.push({ id: "base-ventas", nivel: z <= -u.z[1] ? "alta" : "media", titulo: `Ventas ${Math.round((1 - vHoy / rv.m) * 100)}% por debajo de lo habitual`, detalle: `Hoy llevas ${dinero(vHoy)}; un ${dia} a esta hora suele haber ${dinero(rv.m)}.`, vista: "analisis", donde: "Menú › Análisis y control" });
  }
  // Ticket promedio bajo
  const th = historicos.map((r) => { const v = ventasEn(r); return v.length >= 3 ? v.reduce((s, x) => s + x.venta, 0) / v.length : null; }).filter((x) => x !== null);
  const vh0 = ventasEn(hoyRango);
  if (th.length >= 4 && vh0.length >= 5) {
    const rt = estadoRobusto(th); const tHoy = vHoy / vh0.length; const z = (tHoy - rt.m) / rt.sigma;
    if (z <= -u.z[0]) out.push({ id: "base-ticket", nivel: "media", titulo: "El ticket promedio está más bajo de lo normal", detalle: `Hoy ${dinero(tHoy)} por cuenta; lo habitual a esta hora es ${dinero(rt.m)}.`, vista: "analisis", donde: "Menú › Análisis y control" });
  }
  // Cancelaciones inusuales (conteos pequeños → Poisson)
  const ch = historicos.map((r) => cancEn(r).length);
  const cHoy = cancEn(hoyRango);
  const lambda = promedio(ch);
  if (cHoy.length >= 2) {
    const p = poissonColaSuperior(cHoy.length, lambda);
    if (p < u.p[0]) out.push({ id: "base-cancelaciones", nivel: p < u.p[1] ? "alta" : "media", titulo: `Hoy hay ${cHoy.length} cancelaciones, más de lo normal`, detalle: `A esta hora lo habitual es ${lambda < 0.5 ? "casi ninguna" : `~${Math.round(lambda)}`}. Suman ${dinero(cHoy.reduce((s, c) => s + n0(c.montoCancelado), 0))}. Revisa quién y por qué.`, vista: "analisis", donde: "Menú › Análisis y control › Pérdidas" });
  }
  // Descuentos inusuales (% de lo que se habría vendido)
  const pct = (r) => { const v = ventasEn(r); const d = v.reduce((s, x) => s + x.descuento, 0); const b = v.reduce((s, x) => s + x.subtotal, 0); return b > 0 ? d / b : 0; };
  const dh = historicos.map(pct); const dHoy = pct(hoyRango);
  const rd = estadoRobusto(dh.map((x) => x * 100));
  if (vh0.length >= 5 && dHoy * 100 >= 3) {
    const z = (dHoy * 100 - rd.m) / Math.max(rd.sigma, 1);
    if (z >= u.z[0]) out.push({ id: "base-descuentos", nivel: z >= u.z[1] ? "alta" : "media", titulo: `Descuentos altos hoy: ${(dHoy * 100).toFixed(1)}% de lo consumido`, detalle: `Lo habitual a esta hora es ${rd.m.toFixed(1)}%.`, vista: "analisis", donde: "Menú › Análisis y control › Pérdidas" });
  }
  return out;
}

/*
 * Lógica de negocio nueva (sin pantallas): variantes y modificadores,
 * estaciones de preparación, inventario y pedidos para llevar / domicilio.
 */

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
export function money(n) {
  return `$${Math.round(n || 0).toLocaleString("es-CO")}`;
}
// Cantidades de inventario: hasta 2 decimales, sin ceros de sobra (1,5 · 12 · 0,25)
export function fmtNum(n) {
  const r = Math.round((Number(n) || 0) * 100) / 100;
  return r.toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

/* ───────────── Variantes y modificadores ─────────────
 * Un producto puede tener "grupos" de opciones:
 *   grupos: [{ id, nombre, tipo: "uno" | "varios", requerido, max, opciones: [{ id, nombre, precio }] }]
 * Cada combinación elegida es una LÍNEA distinta del pedido (2 hamburguesas
 * distintas = 2 líneas). El `id` de la línea incluye las opciones elegidas;
 * `baseId` es el producto del menú. `price` ya incluye lo que suman las opciones.
 */
export function claveLinea(baseId, mods) {
  if (!mods || mods.length === 0) return baseId;
  return `${baseId}~${mods.map((m) => `${m.g}:${m.o}`).sort().join("|")}`;
}
export function precioUnitario(item, mods) {
  return (item.price || 0) + (mods || []).reduce((a, m) => a + (m.p || 0), 0);
}
export function modsTexto(mods) {
  return (mods || []).map((m) => m.n).join(", ");
}
export function itemNombre(it) {
  return it.mods && it.mods.length ? `${it.name} (${modsTexto(it.mods)})` : it.name;
}
export function tieneOpciones(item) {
  return Array.isArray(item.grupos) && item.grupos.length > 0;
}

/* ───────────── Estaciones de preparación ─────────────
 * Por defecto hay una sola ("Cocina"). Si el negocio crea más (Barra,
 * Postres, Parrilla…), cada producto va a la estación de su categoría
 * (o a una elegida a mano) y cada estación ve solo lo suyo.
 */
export const ESTACION_BASE = { id: "cocina", nombre: "Cocina" };
export function getEstaciones(config) {
  const e = config && config.estaciones;
  return Array.isArray(e) && e.length > 0 ? e : [ESTACION_BASE];
}
export function estacionDe(item, config) {
  const lista = getEstaciones(config);
  const ids = new Set(lista.map((e) => e.id));
  if (item.estacion && ids.has(item.estacion)) return item.estacion;
  const porCat = ((config && config.estacionPorCategoria) || {})[item.cat];
  if (porCat && ids.has(porCat)) return porCat;
  return lista[0].id;
}
// Estación de una línea YA pedida (si esa estación se borró después, cae en la primera)
export function estacionDeLinea(it, config) {
  const lista = getEstaciones(config);
  return it.estacion && lista.some((e) => e.id === it.estacion) ? it.estacion : lista[0].id;
}

/* ───────────── Inventario ─────────────
 * insumo: { id, nombre, unidad, stock, minimo, costo }
 * producto.receta: [{ insumoId, cant }]  → cuánto insumo gasta UNA unidad
 * Al enviar un pedido se descuenta; el pedido guarda `consumo` (lo que
 * descontó) para poder devolverlo exacto si se cancela o se edita.
 */
export const UNIDADES = ["unidades", "g", "kg", "lb", "ml", "L", "porciones", "paquetes", "cajas", "bolsas", "botellas", "latas", "docenas", "rollos", "frascos"];

export function consumoDeItems(items, menu) {
  const map = {};
  (items || []).forEach((it) => {
    const m = (menu || []).find((x) => x.id === (it.baseId || it.id));
    ((m && m.receta) || []).forEach((r) => {
      if (!r.insumoId || !(r.cant > 0)) return;
      map[r.insumoId] = (map[r.insumoId] || 0) + r.cant * it.qty;
    });
  });
  return map;
}
// nuevo − viejo, solo lo que cambió (para ajustar el stock al editar un pedido)
export function difConsumo(nuevo, viejo) {
  const out = {};
  const keys = new Set([...Object.keys(nuevo || {}), ...Object.keys(viejo || {})]);
  keys.forEach((k) => {
    const d = ((nuevo || {})[k] || 0) - ((viejo || {})[k] || 0);
    if (Math.abs(d) > 1e-9) out[k] = d;
  });
  return out;
}
export function estadoStock(insumo) {
  const s = Number(insumo.stock) || 0;
  if (s <= 0) return "agotado";
  if (s <= (Number(insumo.minimo) || 0)) return "bajo";
  return "ok";
}
// ¿Falta algún insumo para preparar UNA unidad de este producto?
export function faltaStock(item, insumos) {
  return ((item && item.receta) || []).some((r) => {
    const ins = (insumos || []).find((i) => i.id === r.insumoId);
    return ins && (Number(ins.stock) || 0) < r.cant;
  });
}
export function costoReceta(receta, insumos) {
  return (receta || []).reduce((a, r) => {
    const ins = (insumos || []).find((i) => i.id === r.insumoId);
    return a + (ins ? (Number(ins.costo) || 0) * r.cant : 0);
  }, 0);
}

/* ───────────── Para llevar y domicilios ─────────────
 * Son cuentas SIN mesa: `mesa` es un id interno "ext-xxxx" y la cuenta
 * guarda el tipo, los datos del cliente y el costo del envío.
 */
export const TIPO_META = {
  mesa: { label: "Mesa", corto: "MESA" },
  llevar: { label: "Para llevar", corto: "LLEVAR" },
  domicilio: { label: "Domicilio", corto: "DOMICILIO" },
};
export function esExterna(cuenta) {
  return !!cuenta && (cuenta.tipo === "llevar" || cuenta.tipo === "domicilio");
}
export function etiquetaExterna(c) {
  const t = (TIPO_META[c.tipo] || TIPO_META.llevar).label;
  const n = c.cliente && c.cliente.nombre ? c.cliente.nombre : "";
  return n ? `${t} · ${n}` : t;
}

// Cambia el signo de un mapa de consumo (descontar ↔ devolver al inventario)
export function negar(mapa) {
  const out = {};
  Object.entries(mapa || {}).forEach(([k, v]) => { out[k] = -v; });
  return out;
}

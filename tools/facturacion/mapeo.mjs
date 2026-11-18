/*
 * Mapeo de conceptos de «Comandas» con los IDs REALES de la cuenta del proveedor (catálogos sincronizados) — PURO.
 * Cero IDs quemados: el administrador elige, con selectores, qué resolución, impuesto, medio de pago y producto contable usar.
 *   catalogo = { resoluciones:[{id,etiqueta,...}], impuestos:[{id,etiqueta,porcentaje,tipo}], mediosPago:[{id,etiqueta}], productos:[{id,etiqueta}], vendedores:[{id,etiqueta}] }
 *   mapeo    = { resolucion:"", impuestos:{inc,iva,exento}, mediosPago:{efectivo,tarjeta,transferencia}, producto:"", propina:"", vendedor:"" }   (valores = ids en texto)
 */
export const MAPEO_VACIO = Object.freeze({ resolucion: "", impuestos: { inc: "", iva: "", exento: "" }, mediosPago: { efectivo: "", tarjeta: "", transferencia: "" }, producto: "", propina: "", vendedor: "" });
export const CATALOGO_VACIO = Object.freeze({ resoluciones: [], impuestos: [], mediosPago: [], productos: [], vendedores: [] });
export const METODOS = ["efectivo", "tarjeta", "transferencia"];
export const ETIQUETA_METODO = { efectivo: "Efectivo", tarjeta: "Datáfono (tarjeta)", transferencia: "Transferencia" };
export const ETIQUETA_IMPUESTO_MAPEO = { inc: "INC 8 %", iva: "IVA 19 %", exento: "Exento (0 %)" };

/** Qué necesita cada proveedor para poder emitir (según lo que su API pide como ID). */
export const REQUISITOS = {
  // exentoMapea: si el documento exento necesita un ID de impuesto (Factus: tributo «no aplica»; Dataico: categoría). Alegra y Siigo simplemente no llevan impuesto.
  simulado: { resolucion: false, impuesto: false, medios: false, producto: false, vendedor: false, exentoMapea: false },
  factus: { resolucion: true, impuesto: true, medios: true, producto: false, vendedor: false, exentoMapea: true },
  alegra: { resolucion: true, impuesto: true, medios: true, producto: true, vendedor: false, exentoMapea: false },
  siigo: { resolucion: false, impuesto: true, medios: true, producto: true, vendedor: true, exentoMapea: false },
  dataico: { resolucion: false, impuesto: true, medios: true, producto: false, vendedor: false, exentoMapea: true },
};
const txt = (v) => (v === undefined || v === null ? "" : String(v).trim());
const MAX = 100;

export function conMapeoVacio(m) {
  const x = m && typeof m === "object" ? m : {};
  return { resolucion: txt(x.resolucion), impuestos: { ...MAPEO_VACIO.impuestos, ...(x.impuestos || {}) }, mediosPago: { ...MAPEO_VACIO.mediosPago, ...(x.mediosPago || {}) }, producto: txt(x.producto), propina: txt(x.propina), vendedor: txt(x.vendedor) };
}
export function conCatalogoVacio(c) {
  const x = c && typeof c === "object" ? c : {};
  const lista = (k) => (Array.isArray(x[k]) ? x[k].filter((i) => i && txt(i.id)) : []);
  return { ...x, resoluciones: lista("resoluciones"), impuestos: lista("impuestos"), mediosPago: lista("mediosPago"), productos: lista("productos"), vendedores: lista("vendedores") };
}
const claveImpuesto = (impuestoAjuste) => (["inc", "iva", "exento"].includes(impuestoAjuste) ? impuestoAjuste : "inc");

/**
 * Valida el mapeo. `ajustes` decide qué impuesto y si la propina va al documento; `catalogo` (si hay) confirma que cada id exista de verdad.
 * Devuelve { ok, errores, valor, faltantes } con claves como «impuestos.inc», «mediosPago.efectivo», «propina».
 */
export function validarMapeo(mapeo, { proveedor, ajustes = {}, catalogo = null } = {}) {
  const req = REQUISITOS[proveedor] || REQUISITOS.simulado;
  const m = conMapeoVacio(mapeo);
  const cat = catalogo ? conCatalogoVacio(catalogo) : null;
  const e = {};
  const existe = (lista, id) => !cat || lista.some((i) => String(i.id) === id);
  const largo = (id) => id.length <= MAX && !/[\r\n]/.test(id);
  const exigir = (clave, id, lista, mensaje) => { if (!id) e[clave] = mensaje; else if (!largo(id) || !existe(lista, id)) e[clave] = "Ese elemento ya no existe en tu cuenta del proveedor: vuelve a sincronizar los catálogos."; };
  if (req.resolucion) exigir("resolucion", m.resolucion, cat ? cat.resoluciones : [], "Elige la resolución / numeración que usará la app.");
  else if (m.resolucion && cat && !existe(cat.resoluciones, m.resolucion)) e.resolucion = "Esa numeración ya no existe en tu cuenta: vuelve a sincronizar.";
  if (req.impuesto && (claveImpuesto(ajustes.impuesto) !== "exento" || req.exentoMapea)) { const k = claveImpuesto(ajustes.impuesto); exigir(`impuestos.${k}`, m.impuestos[k], cat ? cat.impuestos : [], `Elige cuál es tu impuesto «${ETIQUETA_IMPUESTO_MAPEO[k]}» en el proveedor.`); }
  if (req.medios) for (const k of METODOS) exigir(`mediosPago.${k}`, m.mediosPago[k], cat ? cat.mediosPago : [], `Elige el medio de pago «${ETIQUETA_METODO[k]}».`);
  if (req.producto) exigir("producto", m.producto, cat ? cat.productos : [], "Elige el producto / servicio contable con el que se facturarán las ventas.");
  if (req.vendedor) exigir("vendedor", m.vendedor, cat ? cat.vendedores : [], "Elige el usuario vendedor que firmará las facturas.");
  if (ajustes.propina === "incluir") exigir("propina", m.propina, cat ? cat.productos : [], "Para incluir la propina debes elegir el ítem / cuenta contable de propinas.");
  return { ok: Object.keys(e).length === 0, errores: e, faltantes: Object.keys(e), valor: m };
}

/** Atajo para los adaptadores: error claro si falta algo, o los ids ya listos. */
export const idImpuesto = (mapeo, tipo) => conMapeoVacio(mapeo).impuestos[String(tipo).toLowerCase()] || "";
export const idMedioPago = (mapeo, metodo) => conMapeoVacio(mapeo).mediosPago[METODOS.includes(metodo) ? metodo : "efectivo"] || "";

/*
 * Alertas AMARILLAS preventivas de la facturación — funciones PURAS (npm run fiscal:probar).
 * Se muestran en la configuración y en Caja. Nunca bloquean la venta: avisan a tiempo.
 */
export const UMBRAL_DIAS = 15;          // resolución «por vencer»: quedan 15 días o menos
export const UMBRAL_FOLIOS_PCT = 0;     // (sin umbral por porcentaje)
export const UMBRAL_FOLIOS_MIN = 25;    // folios «por agotarse»: quedan 25 o menos
export const UVT_POR_DEFECTO = 52374;   // valor del UVT 2026 (COP). Es configurable: confírmalo cada enero con la DIAN.
export const TOPE_POS_UVT = 5;          // tope legal del Documento Equivalente POS, en UVT.

const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

/**
 * Folios de la resolución. `ultimoConsecutivo` = el mayor número ya emitido dentro de ese rango (0 si ninguno).
 * Estados: sin_datos · ok · por_agotarse · agotada.
 */
export function estadoFolios(resolucion, ultimoConsecutivo = 0) {
  const desde = n(resolucion && resolucion.desde), hasta = n(resolucion && resolucion.hasta);
  if (!(desde >= 1) || !(hasta >= desde)) return { estado: "sin_datos", total: 0, usados: 0, disponibles: 0, porcentajeLibre: null };
  const total = hasta - desde + 1;
  const ultimo = Math.min(Math.max(n(ultimoConsecutivo), desde - 1), hasta);
  const usados = ultimo - desde + 1, disponibles = hasta - ultimo;
  const porcentajeLibre = Math.round((disponibles / total) * 1000) / 10;
  const estado = disponibles <= 0 ? "agotada" : (porcentajeLibre <= UMBRAL_FOLIOS_PCT || disponibles <= UMBRAL_FOLIOS_MIN ? "por_agotarse" : "ok");
  return { estado, total, usados, disponibles, porcentajeLibre };
}

/**
 * Último número ya USADO para contar folios: el mayor entre lo emitido por la app y «consecutivo actual − 1» que el administrador escribió
 * (restaurantes que migran de otro sistema o que facturaron a mano en el portal del proveedor). La app NUNCA asigna números: lo hace el proveedor.
 */
export function ultimoEfectivo(resolucion, ultimoEmitido = 0) {
  const sig = Number(String((resolucion && resolucion.siguiente) || "").replace(/\D/g, ""));
  const desdeSig = Number.isFinite(sig) && sig > 0 ? sig - 1 : 0;
  return Math.max(n(ultimoEmitido), desdeSig);
}

/** Mayor consecutivo emitido con el prefijo dado, a partir de los documentos (`{ prefijo, numero, estado }`). */
export function ultimoConsecutivo(documentos, prefijo = "") {
  let max = 0;
  for (const d of documentos || []) {
    if (!d || !["emitida", "anulada"].includes(d.estado) || String(d.prefijo || "") !== String(prefijo || "")) continue;
    const num = Number(String(d.numero || "").replace(String(prefijo || ""), "").replace(/\D/g, ""));
    if (Number.isFinite(num) && num > max) max = num;
  }
  return max;
}

/** Topes del Documento Equivalente POS: si la cuenta pasa de 5 UVT conviene pedir los datos del cliente y emitir Factura Electrónica de Venta. */
export function alertaTopeUvt({ tipoDocumento, totalDocumento, valorUvt = UVT_POR_DEFECTO, topeUvt = TOPE_POS_UVT }) {
  if (tipoDocumento !== "pos") return null;
  const tope = Math.round(n(valorUvt) * topeUvt);
  if (!(tope > 0) || n(totalDocumento) <= tope) return null;
  return { clave: "tope_uvt", nivel: "alerta", tope, texto: `Esta cuenta supera los ${topeUvt} UVT ($${tope.toLocaleString("es-CO")}), el tope del Documento Equivalente POS. Pide los datos del cliente para emitir una Factura Electrónica de Venta.` };
}

/** Todas las alertas de la resolución a una fecha (`hoy` = «AAAA-MM-DD») y con el último consecutivo emitido. */
export function alertasResolucion({ resolucion, hoy, ultimo = 0, estadoRes }) {
  const out = [];
  if (estadoRes && estadoRes.estado === "vencida") out.push({ clave: "resolucion_vencida", nivel: "alerta", texto: "La resolución de facturación está vencida: no se puede facturar en producción. Solicita la nueva a la DIAN." });
  else if (estadoRes && estadoRes.estado === "por_vencer") out.push({ clave: "resolucion_por_vencer", nivel: "alerta", texto: `La resolución vence en ${estadoRes.dias} día${estadoRes.dias === 1 ? "" : "s"}. Solicita la nueva a la DIAN con tiempo.` });
  const f = estadoFolios(resolucion, ultimo);
  if (f.estado === "agotada") out.push({ clave: "folios_agotados", nivel: "alerta", texto: "Se agotaron los números (folios) de la resolución: no se podrá facturar hasta solicitar un nuevo rango." });
  else if (f.estado === "por_agotarse") out.push({ clave: "folios_por_agotarse", nivel: "alerta", texto: `Quedan ${f.disponibles} números (folios) de la resolución. Solicita un nuevo rango a la DIAN.` });
  return out;
}

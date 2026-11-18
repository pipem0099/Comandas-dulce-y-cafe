/*
 * Qué mostrar de una factura en Caja (puro). Entradas:
 *   doc     documento guardado por el servidor (facturacion/documentos/{cuentaId}) o null
 *   enCola  true si hay una solicitud de emisión guardada en el equipo esperando internet
 * Salida: { clave, etiqueta, tono, puedeEmitir, puedeReenviar, puedeAnular, puedeVerPdf, detalle }
 *   tono: "ok" | "info" | "alerta" | "error" | "neutro"  (amarillo/alerta solo para avisos, nunca para botones sueltos)
 */
import { proximoReintento } from "../../tools/facturacion/errores.mjs";

export function estadoFactura({ doc, enCola = false, esAdmin = false }) {
  const base = { puedeEmitir: false, puedeReenviar: false, puedeAnular: false, puedeVerPdf: false, detalle: "" };
  if (doc && doc.estado === "emitida") return { ...base, clave: "emitida", etiqueta: "Emitida", tono: "ok", puedeReenviar: true, puedeAnular: esAdmin, puedeVerPdf: true };
  if (doc && doc.estado === "anulada") return { ...base, clave: "anulada", etiqueta: "Anulada", tono: "neutro", puedeVerPdf: true, detalle: (doc.anulacion && doc.anulacion.numeroNota) ? `Nota crédito ${doc.anulacion.numeroNota}` : "" };
  if (enCola) return { ...base, clave: "pendiente", etiqueta: "Pendiente de envío (Sin consecutivo asignado)", tono: "info", detalle: "Se enviará sola cuando vuelva el internet. El número lo asigna el proveedor al emitir; nunca esta app." };
  if (doc && doc.estado === "procesando") return { ...base, clave: "procesando", etiqueta: "Enviando…", tono: "info" };
  if (doc && doc.estado === "error") {
    const e = doc.error || {};
    // Clasificación (la guarda el servidor): datos → el cajero corrige y «Reintenta emisión»; red segura → se reintenta sola; incierta/credenciales/configuración → solo administrador.
    const soloAdmin = e.incierto === true || e.clase === "credenciales" || e.clase === "configuracion";
    const aut = proximoReintento(doc, Date.now());
    return { ...base, clave: "error", etiqueta: "Error", tono: "error", puedeEmitir: !soloAdmin || esAdmin, detalle: [e.mensaje || "No se pudo emitir.", e.accion].filter(Boolean).join(" "), incierto: !!e.incierto,
      requiereCorreccion: e.requiereCorreccion === true, reintentoAutomatico: e.reintentoAutomatico === true && !aut.agotado, reintentosAgotados: !!aut.agotado, etiquetaReintento: "Reintentar emisión" };
  }
  return { ...base, clave: "ninguna", etiqueta: "Sin facturar", tono: "neutro", puedeEmitir: true };
}

/** Solo las cuentas cobradas hace poco se emiten solas (así activar la opción no factura de golpe cuentas viejas). */
export const VENTANA_AUTOMATICA_MS = 15 * 60 * 1000;
export function debeEmitirSola({ ajustes, cuenta, doc, enCola, ahora }) {
  return !!(ajustes && ajustes.activa && ajustes.emisionAutomatica && cuenta && cuenta.estado === "pagada" && !doc && !enCola && ahora - (cuenta.pagadaTs || 0) < VENTANA_AUTOMATICA_MS);
}

/** URL para ver/descargar el PDF: la del proveedor, o (simulado) el PDF que genera la app. `generar` es generarPdfSimulado. */
export function urlPdf(doc, generar) {
  if (!doc) return "";
  if (doc.pdfUrl && /^https:\/\//i.test(doc.pdfUrl)) return doc.pdfUrl;
  if (doc.pdfSimulado && typeof Blob !== "undefined" && typeof URL !== "undefined") return URL.createObjectURL(new Blob([generar(doc)], { type: "application/pdf" }));
  return "";
}

/**
 * Reintento automático en segundo plano: SOLO errores de red «seguros» (nada llegó a enviarse), con espera creciente y tope de intentos.
 * Los errores de datos (NIT/correo inválido) NO se reintentan solos: el cajero corrige y pulsa «Reintentar emisión» (misma cuenta = misma llave de idempotencia).
 */
export function debeReintentarSola({ ajustes, doc, enCola = false, ahora = Date.now() }) {
  if (!(ajustes && ajustes.activa) || enCola || !doc) return false;
  return proximoReintento(doc, ahora).reintentar === true;
}

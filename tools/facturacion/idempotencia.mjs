/*
 * Idempotencia y estados del documento electrónico — lógica PURA (npm run fiscal:probar).
 * La LLAVE ÚNICA es el id de la cuenta: hay como máximo UN documento por cuenta (`facturacion/documentos/{cuentaId}`).
 * Un reintento (red caída, doble toque, la cola sin conexión que se repite) devuelve el documento que ya existe en vez de crear otro.
 */
export const ESTADOS = ["pendiente", "procesando", "emitida", "error", "anulada"];
export const ETIQUETA_ESTADO = { pendiente: "Pendiente", procesando: "Enviando…", emitida: "Emitida", error: "Error", anulada: "Anulada" };
export const VENTANA_PROCESANDO_MS = 2 * 60 * 1000; // un envío «en curso» más viejo que esto se considera caído

/** Referencia que se manda al proveedor (campo «reference» u homólogo): estable por cuenta, así un reintento no crea otra. */
export const referenciaProveedor = (cuentaId) => `CMD-${String(cuentaId).replace(/[^A-Za-z0-9_-]/g, "")}`.slice(0, 60);

/** Los ids de cuenta de Comandas ya son llaves válidas de Firebase; aquí se verifica (sin . $ # [ ] /) antes de usarlos en una ruta. */
export const cuentaIdValido = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id);

/**
 * ¿Qué hacer con una solicitud de emitir, dado el documento que ya exista?
 *  emitir     → no hay nada: se reserva y se envía.
 *  devolver   → ya está emitida (o anulada): se responde con lo que hay, SIN llamar al proveedor.
 *  esperar    → otra solicitud lo está enviando ahora mismo.
 *  reintentar → falló de forma DEFINITIVA (el proveedor lo rechazó): se puede volver a enviar.
 *  revisar    → quedó en duda (se cortó la red tras enviar): puede que el proveedor SÍ lo haya emitido. Solo un administrador
 *               puede forzar el reintento, después de revisar el portal del proveedor.
 */
export function decidirEmision(doc, { ahora = Date.now(), forzar = false, esAdmin = false } = {}) {
  if (!doc) return { accion: "emitir" };
  switch (doc.estado) {
    case "emitida": case "anulada": return { accion: "devolver" };
    case "procesando":
      if (ahora - (doc.ts || 0) < VENTANA_PROCESANDO_MS) return { accion: "esperar" };
      return forzar && esAdmin ? { accion: "reintentar" } : { accion: "revisar", motivo: "El envío anterior no terminó y no sabemos si el proveedor llegó a emitirlo." };
    case "error":
      if (doc.error && doc.error.incierto) return forzar && esAdmin ? { accion: "reintentar" } : { accion: "revisar", motivo: "El último intento quedó en duda: revisa en el portal del proveedor si la factura existe." };
      return { accion: "reintentar" };
    case "pendiente": return { accion: "emitir" };
    default: return { accion: "emitir" };
  }
}

/** Solo se anula una factura EMITIDA, con un motivo escrito, y solo un administrador. */
export function puedeAnular(doc, { esAdmin, motivo }) {
  if (!esAdmin) return { ok: false, codigo: "permiso", mensaje: "Solo un administrador puede anular una factura." };
  if (!doc || doc.estado !== "emitida") return { ok: false, codigo: "estado", mensaje: doc && doc.estado === "anulada" ? "Esa factura ya está anulada." : "Solo se anula una factura emitida." };
  if (String(motivo || "").trim().length < 5) return { ok: false, codigo: "motivo", mensaje: "Escribe el motivo de la anulación (mínimo 5 letras)." };
  return { ok: true };
}

/*
 * Dirección que va dentro del código QR de la factura. Se usa la consulta oficial de la DIAN por llave de documento (CUFE/CUDE):
 *   Producción:  https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey={CUFE}
 *   Habilitación (pruebas): https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey={CUFE}
 * Si el proveedor ya entrega su propio texto de QR (qrUrl), ese manda.
 */
export function urlQrDian(cufe, modo = "produccion") {
  const c = String(cufe || "").trim();
  if (!c) return "";
  return `https://catalogo-vpfe${modo === "produccion" ? "" : "-hab"}.dian.gov.co/document/searchqr?documentkey=${encodeURIComponent(c)}`;
}
export const textoQr = (doc) => (doc && doc.qrUrl && /^https?:\/\//.test(doc.qrUrl) ? doc.qrUrl : urlQrDian(doc && doc.cufe, doc && doc.payload && doc.payload.modo));

/*
 * PDF mínimo (una página, texto) para el proveedor SIMULADO: así «Ver / descargar PDF» funciona en demos y pruebas sin depender de un proveedor.
 * No es un documento válido ante la DIAN. Sin librerías: se arma el PDF a mano (Helvetica, Latin-1: tildes y ñ salen bien).
 */
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const latin1 = (s) => String(s).replace(/[^\x20-\xFF]/g, "?");
const cop = (n) => `$ ${Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export function lineasDelPdf(doc) {
  const d = (doc && doc.payload) || {};
  const t = d.totales || {};
  const L = [];
  L.push("DOCUMENTO SIMULADO - SIN VALIDEZ ANTE LA DIAN");
  L.push(`${d.tipoDocumento === "factura" ? "Factura Electronica de Venta" : "Documento Equivalente Electronico POS"}  ${doc.prefijo || ""}${doc.numero || ""}`);
  L.push(`Fecha: ${d.fecha || ""}   Ambiente: ${d.modo === "produccion" ? "Produccion" : "Pruebas"}`);
  L.push(`Cliente: ${(d.cliente && d.cliente.nombre) || "Consumidor final"}  ${(d.cliente && d.cliente.numero) || ""}`);
  L.push(`CUFE: ${doc.cufe || ""}`.slice(0, 90));
  L.push("");
  L.push("Cant  Descripcion                              Total");
  (d.lineas || []).slice(0, 30).forEach((l) => L.push(`${String(l.cantidad).padEnd(5)} ${String(l.descripcion).slice(0, 36).padEnd(37)} ${cop(l.total)}`));
  L.push("");
  if (t.descuento) L.push(`Descuento: ${cop(t.descuento)}`);
  L.push(`Base gravable: ${cop(t.baseGravable)}   Base exenta: ${cop(t.baseExenta)}`);
  L.push(`${(d.impuesto && d.impuesto.tipo) || "Impuesto"}: ${cop(t.valorImpuesto)}`);
  if (t.propinaEnDocumento) L.push(`Propina (ingreso para terceros, no gravado): ${cop(t.propina)}`);
  else if (t.propina) L.push(`Propina voluntaria (fuera del documento): ${cop(t.propina)}`);
  L.push(`TOTAL DEL DOCUMENTO: ${cop(t.totalDocumento)}`);
  if (doc.estado === "anulada") L.push(`ANULADA - Nota credito ${(doc.anulacion && doc.anulacion.numeroNota) || ""}`);
  return L;
}

export function generarPdfSimulado(doc) {
  const lineas = lineasDelPdf(doc);
  const contenido = ["BT", "/F1 10 Tf", "14 TL", "50 790 Td", ...lineas.map((l) => `(${esc(latin1(l))}) Tj T*`), "ET"].join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n"; const pos = [];
  objetos.forEach((o, i) => { pos.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

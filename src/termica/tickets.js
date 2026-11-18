/*
 * Tickets para impresora térmica, armados con los MISMOS datos del comprobante de la app (datosComprobante) y del pedido de cocina.
 * Puros: se prueban con `npm run termica:probar`.
 */
import { nuevoTicket } from "./escpos.js";

const dinero = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-CO")}`;
const fechaCorta = (ts) => new Date(ts).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Cuenta de consumo o comprobante de venta. `d` viene de datosComprobante(...). */
export function ticketRecibo(d, { columnas = 48, tabla = 19 } = {}) {
  const t = nuevoTicket({ columnas, tabla });
  t.centro();
  if (d.negocio) t.negrita().altoDoble().linea(d.negocio).normal().centro();
  if (d.nit) t.linea(`NIT ${d.nit}`);
  if (d.direccion) t.linea(d.direccion);
  if (d.telefono) t.linea(`Tel. ${d.telefono}`);
  t.separador("-").negrita().linea(d.titulo).negrita(false);
  if (d.tipo === "comprobante") t.linea(`N.° ${d.numero}`);
  t.linea(fechaCorta(d.cuando)).izquierda().linea(`${d.lugar}${d.mesero ? ` · Atendió: ${d.mesero}` : ""}`);
  if (d.cliente) t.linea(`Cliente: ${d.cliente}`);
  if (d.documento) t.linea(`Documento: ${d.documento}`);
  t.separador("-");
  d.lineas.forEach((l) => t.dos(`${l.qty} ${l.name}`, dinero(l.total)));
  t.separador("-").dos("Subtotal", dinero(d.subtotal));
  if (d.descuento) t.dos("Descuento", `-${dinero(d.descuento)}`);
  if (d.envio) t.dos("Domicilio", dinero(d.envio));
  if (d.propina) t.dos("Propina", dinero(d.propina));
  t.negrita().altoDoble().dos("TOTAL", dinero(d.total)).normal();
  if (d.propinaSugerida) t.izquierda().linea(`Propina sugerida (10%, voluntaria): ${dinero(d.propinaSugerida)}`);
  if (d.pagos && d.pagos.length) { t.separador("-"); d.pagos.forEach((p) => t.dos(`Pagó con ${String(p.metodo).toLowerCase()}`, dinero(p.monto))); }
  t.separador("-").centro().linea(d.mensaje || "").linea(d.leyenda || "").avanzar(3).cortar();
  return t.bytes();
}

/** Ticket de cocina: lo que hay que preparar, grande y sin precios. `reimpresion` lo marca como copia; `destino` (opcional) dice a qué estación/piso va. */
export function ticketCocina({ pedido, lugar = "", mesero = "", ronda = 0, reimpresion = false, destino = "" }, { columnas = 48, tabla = 19 } = {}) {
  const t = nuevoTicket({ columnas, tabla });
  t.centro().negrita().linea(reimpresion ? "COCINA · REIMPRESIÓN" : "COCINA").negrita(false).doble().linea(lugar || "Pedido").normal().centro();
  if (destino) t.negrita().linea(destino).negrita(false);
  t.linea(`${fechaCorta(pedido.ts)}${ronda > 1 ? ` · Ronda ${ronda}` : ""}${mesero ? ` · ${mesero}` : ""}`);
  t.separador("=").izquierda();
  (pedido.items || []).forEach((it) => {
    t.negrita().altoDoble().linea(`${it.qty} x ${it.name}`).normal();
    if (it.dest) t.linea(`   -> ${it.dest}`);
    if (it.nota) t.linea(`   > ${it.nota}`);
  });
  if (pedido.nota) t.separador("-").negrita().linea(`NOTA: ${pedido.nota}`).negrita(false);
  t.separador("=").avanzar(3).cortar();
  return t.bytes();
}

/** Ticket de AJUSTE: lo que se agregó (+) o se canceló (-) de un pedido que ya se había enviado. */
export function ticketAjusteCocina({ pedido, ajuste, lugar = "", mesero = "", ronda = 0 }, { columnas = 48, tabla = 19 } = {}) {
  const t = nuevoTicket({ columnas, tabla });
  t.centro().negrita().linea("COCINA · AJUSTE").negrita(false).doble().linea(lugar || "Pedido").normal().centro();
  t.linea(`${fechaCorta(ajuste.ts)}${ronda >= 1 ? ` · Ronda ${ronda}` : ""}${mesero ? ` · ${mesero}` : ""}`);
  t.separador("=").izquierda();
  (ajuste.agregados || []).forEach((it) => {
    t.negrita().altoDoble().linea(`+ ${it.qty} x ${it.name}`).normal();
    if (it.nota) t.linea(`   > ${it.nota}`);
  });
  (ajuste.cancelados || []).forEach((it) => { t.negrita().altoDoble().linea(`- ${it.qty} x ${it.name}`).normal(); t.linea("   CANCELADO: no lo preparen"); });
  (ajuste.notas || []).forEach((n) => t.linea(`Nota de ${n.name}: ${n.nota || "(se quitó)"}`));
  if (ajuste.notaGeneral !== undefined && ajuste.notaGeneral !== null) t.separador("-").negrita().linea(`NOTA: ${ajuste.notaGeneral || "(se quitó)"}`).negrita(false);
  t.separador("=").avanzar(3).cortar();
  return t.bytes();
}

/** Prueba de impresión: sirve para ver si las tildes salen bien y cuántas letras caben por renglón. */
export function ticketPrueba({ columnas = 48, tabla = 19, nombre = "" } = {}) {
  const t = nuevoTicket({ columnas, tabla });
  t.centro().negrita().altoDoble().linea("Prueba de impresión").normal().centro();
  if (nombre) t.linea(nombre);
  t.separador("-").izquierda().linea("Tildes y eñes: áéíóú ÁÉÍÓÚ ñ Ñ ü ¿? ¡!").linea("Dinero: $18.000 · $1.250.000").linea("1234567890".repeat(Math.ceil(columnas / 10)).slice(0, columnas));
  t.dos("Izquierda", "Derecha").separador("-").centro().linea("Si todo se lee bien, la impresora está lista.").avanzar(3).cortar();
  return t.bytes();
}

const fechaHoraDoc = (d) => `${d.fecha || ""} ${d.hora || ""}`.trim();
const ETIQUETA_REGIMEN_T = { responsable_iva: "Responsable de IVA", no_responsable: "No responsable de IVA", simple: "Régimen Simple de Tributación" };
const NOMBRE_DOC = { factura: "FACTURA ELECTRÓNICA DE VENTA", pos: "DOCUMENTO EQUIVALENTE ELECTRÓNICO POS" };

/**
 * Tirilla de la FACTURA ELECTRÓNICA / documento POS (o de su Nota Crédito si `nota: true`).
 * `doc` = documento guardado por el servidor (numero, prefijo, cufe, qrUrl, payload, anulacion). No inventa consecutivos: sin número no imprime documento.
 * Incluye: emisor, resolución DIAN (número, prefijo, rango, vigencia), base e INC/IVA, CUFE/CUDE completo y QR.
 */
export function ticketFactura(doc, { columnas = 48, tabla = 19, nota = false, textoQrDe } = {}) {
  const p = (doc && doc.payload) || {};
  const e = p.emisor || {}, r = p.resolucion || {}, t = p.totales || {}, c = p.cliente || {};
  const an = (doc && doc.anulacion) || {};
  const tk = nuevoTicket({ columnas, tabla });
  tk.centro();
  if (e.razonSocial) tk.negrita().linea(e.razonSocial).negrita(false);
  if (e.nit) tk.linea(`NIT ${e.nit}${e.dv ? `-${e.dv}` : ""}`);
  if (e.regimen) tk.linea(ETIQUETA_REGIMEN_T[e.regimen] || e.regimen);
  if (e.municipio) tk.linea(e.municipio);
  if (e.correo) tk.linea(e.correo);
  tk.separador("-").negrita().linea(nota ? "NOTA CRÉDITO ELECTRÓNICA" : (NOMBRE_DOC[p.tipoDocumento] || NOMBRE_DOC.pos)).negrita(false);
  if (p.modo !== "produccion") tk.linea("*** AMBIENTE DE PRUEBAS - SIN VALIDEZ FISCAL ***");
  if (nota) { tk.linea(`N.° ${an.numeroNota || "(sin número)"}`); tk.linea(`Afecta: ${doc.prefijo || ""}${doc.numero || ""}`); }
  else tk.linea(`N.° ${doc.prefijo || ""}${doc.numero || ""}`);
  tk.izquierda().linea(`Fecha: ${nota && an.ts ? fechaCorta(an.ts) : fechaHoraDoc(p)}`);
  if (r.numero) {
    tk.separador("-").linea(`Resolución DIAN N.° ${r.numero}`);
    tk.linea(`Prefijo ${r.prefijo || "-"} · Rango ${r.desde || "?"} al ${r.hasta || "?"}`);
    if (r.vigenciaDesde || r.vigenciaHasta) tk.linea(`Vigencia ${r.vigenciaDesde || "?"} a ${r.vigenciaHasta || "?"}`);
  }
  tk.separador("-").linea(`Cliente: ${c.nombre || "Consumidor final"}`).linea(`${c.tipoDoc || "CC"} ${c.numero || ""}${c.dv ? `-${c.dv}` : ""}`);
  tk.separador("-");
  (p.lineas || []).forEach((l) => tk.dos(`${l.cantidad} ${l.descripcion}`, dinero(l.total)));
  tk.separador("-");
  if (t.subtotalBruto !== undefined) tk.dos("Subtotal", dinero(t.subtotalBruto));
  if (t.descuento) tk.dos("Descuento", `-${dinero(t.descuento)}`);
  tk.dos("Base gravable", dinero(t.baseGravable));
  if (t.baseExenta) tk.dos("Base exenta", dinero(t.baseExenta));
  const tipoImp = (p.impuesto && p.impuesto.tipo) || "Impuesto";
  tk.dos(`${tipoImp}${p.impuesto && p.impuesto.porcentaje ? ` ${p.impuesto.porcentaje}%` : ""}`, dinero(t.valorImpuesto));
  if (t.propinaEnDocumento) tk.dos("Propina (terceros, no gravada)", dinero(t.propina));
  tk.negrita().altoDoble().dos(nota ? "TOTAL NOTA" : "TOTAL", dinero(nota && an.monto ? an.monto : t.totalDocumento)).normal();
  if (!t.propinaEnDocumento && t.propina) tk.izquierda().linea(`Propina voluntaria (fuera del documento): ${dinero(t.propina)}`);
  if (p.pagos && p.pagos.length) { tk.separador("-"); p.pagos.forEach((x) => tk.dos(`Pagó con ${x.metodo}`, dinero(x.monto))); }
  if (nota && an.motivo) tk.separador("-").linea(`Motivo: ${an.motivo}`);
  const cufe = nota ? an.cufeNota : doc.cufe;
  tk.separador("-").centro();
  if (cufe) {
    tk.negrita().linea(nota ? "CUDE" : (p.tipoDocumento === "pos" ? "CUDE" : "CUFE")).negrita(false).izquierda().linea(cufe).centro();
    const qr = textoQrDe ? textoQrDe(doc, cufe) : (doc.qrUrl && /^https?:\/\//.test(doc.qrUrl) && !nota ? doc.qrUrl : `https://catalogo-vpfe${p.modo === "produccion" ? "" : "-hab"}.dian.gov.co/document/searchqr?documentkey=${encodeURIComponent(cufe)}`);
    tk.qr(qr, columnas <= 32 ? 4 : 6);
  } else tk.linea("Documento pendiente de envío a la DIAN (sin consecutivo asignado)");
  tk.linea("Representación gráfica de documento electrónico").avanzar(3).cortar();
  return tk.bytes();
}

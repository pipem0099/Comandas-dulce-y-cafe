/*
 * Adaptador ALEGRA (https://alegra.com) — API REST v1 con autenticación básica (correo:token).
 *
 * ESTADO DE VERIFICACIÓN: escrito a partir de la documentación pública (developer.alegra.com). NO probado contra una cuenta real.
 * Alegra no tiene sandbox separado: usa una cuenta de pruebas (el modo «Pruebas» de Comandas solo cambia la etiqueta; la base es la misma).
 *
 * Endpoints usados (base https://api.alegra.com/api/v1):
 *   GET  /company                      probar conexión
 *   GET  /contacts?identification=…    buscar al cliente · POST /contacts  crearlo
 *   GET  catálogos (impuestos, ítems/productos, numeraciones, usuarios, formas de pago) → el administrador los mapea (CERO IDs quemados)
 *   GET  /taxes                        impuestos de la cuenta (para elegir INC / IVA)
 *   GET  /number-templates             numeraciones (se elige la que coincide con el prefijo de la resolución)
 *   POST /invoices                     crea la factura (con stamp: generateStamp → se emite ante la DIAN)
 *   POST /credit-notes                 Nota Crédito que anula la factura (VERIFICAR campos)
 *   POST /invoices/{id}/email          reenvío por correo
 *
 * IDs de CATÁLOGO que dependen de la cuenta del cliente (el dueño debe prepararlos en Alegra UNA vez):
 *   · El administrador elige en la app (Facturación electrónica → catálogos) qué ítem/producto contable usan las ventas.
 *     Si no existe, el error dice qué crear.
 *   · El impuesto INC/IVA: se busca en GET /taxes por nombre/porcentaje (INC 8 %, IVA 19 %). Si no se encuentra, el error lo dice.
 *   · La numeración electrónica: se busca por prefijo; si no hay prefijo, se usa la preferida de la cuenta.
 * Documento Equivalente POS: sin mapear (Alegra lo maneja con otro módulo): solo Factura Electrónica de Venta.
 */
import { solicitar, ErrorProveedor, valoresSecretos, base64, sinPos, DIAN_TIPO_DOC, esPersonaJuridica, filasSinImpuesto, exigirMapeo, catalogoVacio } from "./interfaz.js";

const BASE = "https://api.alegra.com/api/v1";
const cab = (c) => ({ Authorization: `Basic ${base64(`${c.correo}:${c.tokenApi}`)}` });
const get = (ctx, ruta) => solicitar(ctx.fetch, `${BASE}${ruta}`, { cabeceras: cab(ctx.credenciales), secretos: valoresSecretos(ctx.credenciales) });
const enviar = (ctx, ruta, json) => solicitar(ctx.fetch, `${BASE}${ruta}`, { metodo: "POST", cabeceras: cab(ctx.credenciales), json, secretos: valoresSecretos(ctx.credenciales) });
const lista = (r) => (Array.isArray(r.datos) ? r.datos : (r.datos && r.datos.data) || []);
const falta = (mensaje, detalle = "") => new ErrorProveedor({ mensaje, codigo: "configuracion", detalle });

async function contacto(ctx, c) {
  const r = await get(ctx, `/contacts?identification=${encodeURIComponent(c.numero)}&type=client`);
  const hallado = lista(r).find((x) => x.identification && String(x.identification.number || x.identification) === c.numero) || lista(r)[0];
  if (hallado) return hallado.id;
  const nuevo = await enviar(ctx, "/contacts", { name: c.nombre, identificationObject: { type: c.tipoDoc === "CC" ? "CC" : c.tipoDoc, number: c.numero, ...(c.dv ? { dv: c.dv } : {}) }, kindOfPerson: esPersonaJuridica(c) ? "LEGAL_ENTITY" : "PERSON_ENTITY", regime: "SIMPLIFIED_REGIME", email: c.correo || undefined, type: ["client"] });
  return nuevo.datos.id;
}
// Medios de pago de Alegra: códigos fijos del API (VERIFICAR la lista exacta en tu versión).
const MEDIOS_ALEGRA = [{ id: "CASH", etiqueta: "Efectivo" }, { id: "DEBIT_CARD", etiqueta: "Tarjeta débito" }, { id: "CREDIT_CARD", etiqueta: "Tarjeta crédito" }, { id: "TRANSFER_DEBIT_BANK", etiqueta: "Transferencia débito bancaria" }, { id: "TRANSFER_CREDIT_BANK", etiqueta: "Transferencia crédito bancaria" }];
const idsImpuesto = (m, p) => (p.impuesto.tipo === "EXENTO" ? [] : [{ id: Number(m.impuestos[p.impuesto.tipo.toLowerCase()]) }]);

export const alegra = {
  id: "alegra", nombre: "Alegra",
  /** Sincroniza catálogos de TU cuenta: impuestos, servicios/ítems (producto contable y propina), numeraciones de factura electrónica. */
  async probarConexionYSincronizar(ctx) {
    const empresa = await get(ctx, "/company");
    const [imp, its, num] = [await get(ctx, "/taxes"), await get(ctx, "/items?limit=30&type=service"), await get(ctx, "/number-templates")];
    const impuestos = lista(imp).map((x) => ({ id: String(x.id), etiqueta: `${x.name} · ${Number(x.percentage)} %`, porcentaje: Number(x.percentage), tipo: /consumo|INC|ICL/i.test(`${x.name} ${x.type}`) ? "INC" : /IVA/i.test(`${x.name} ${x.type}`) ? "IVA" : String(x.type || "") }));
    const productos = lista(its).map((x) => ({ id: String(x.id), etiqueta: `${x.name}${x.reference ? ` (${x.reference})` : ""}` }));
    const resoluciones = lista(num).filter((x) => /invoice|electronic/i.test(`${x.documentType || ""} ${x.isElectronic ? "electronic" : ""}`)).map((x) => ({ id: String(x.id), etiqueta: `${x.prefix || "(sin prefijo)"} · ${x.name || x.documentType || "numeración"}${x.endDate ? ` · vence ${x.endDate}` : ""}`, prefijo: x.prefix || "", desde: String(x.startNumber || ""), hasta: String(x.endNumber || ""), vigenciaHasta: x.endDate || "" }));
    return { ok: true, mensaje: `Conexión correcta con Alegra${empresa.datos && empresa.datos.name ? ` (${empresa.datos.name})` : ""}. ${impuestos.length} impuestos, ${productos.length} servicios y ${resoluciones.length} numeraciones encontrados.`, catalogos: { ...catalogoVacio(), resoluciones, impuestos, productos, mediosPago: MEDIOS_ALEGRA } };
  },
  async emitirDocumento(ctx) {
    const { payload: p } = ctx;
    if (p.tipoDocumento === "pos") throw sinPos("Alegra");
    const m = exigirMapeo(ctx, "alegra");
    const clienteId = await contacto(ctx, p.cliente);
    const tax = idsImpuesto(m, p);
    const numberTemplate = m.resolucion ? { id: Number(m.resolucion) } : undefined;
    const metodo = ["efectivo", "tarjeta", "transferencia"].includes((p.pagos[0] || {}).metodo) ? p.pagos[0].metodo : "efectivo";
    // En Alegra el precio del ítem va SIN impuestos: se envía la base y el impuesto lo calcula Alegra. Cortesías: precio de lista + discount 100.
    const r = await enviar(ctx, "/invoices", {
      date: p.fecha, dueDate: p.fecha, client: clienteId, ...(numberTemplate ? { numberTemplate } : {}), anotation: p.observaciones, status: "open",
      items: filasSinImpuesto(p).map((f) => ({ id: Number(f.codigo === "PROPINA" ? m.propina : m.producto), name: f.descripcion, description: f.descripcion, price: f.precio, quantity: f.cantidad, discount: f.descuentoPct, tax: f.sinImpuesto ? [] : tax })),
      stamp: { generateStamp: true }, // emitir ante la DIAN al crear (VERIFICAR nombre del campo en tu versión)
      paymentForm: "CASH",
      paymentMethod: m.mediosPago[metodo],
    });
    const d = r.datos || {};
    const tp = d.numberTemplate || {};
    if (!d.id) throw new ErrorProveedor({ mensaje: "Alegra respondió sin id de factura.", incierto: true, detalle: JSON.stringify(d).slice(0, 800) });
    return { numero: String(tp.fullNumber || `${tp.prefix || ""}${tp.number || d.id}`), prefijo: tp.prefix || "", cufe: (d.stamp && (d.stamp.cufe || d.stamp.uuid)) || "", pdfUrl: d.pdf || null, qrUrl: null, idProveedor: String(d.id), estadoProveedor: String((d.stamp && d.stamp.legalStatus) || d.status || "open"), correoEnviado: !!p.cliente.correo, clienteId: String(clienteId) };
  },
  async anularDocumento(ctx) {
    // Una factura ya emitida ante la DIAN no se «borra»: se anula con Nota Crédito (VERIFICAR campos de /credit-notes en tu cuenta).
    const { documento: d, motivo } = ctx;
    const r = await enviar(ctx, "/credit-notes", { date: new Date().toISOString().slice(0, 10), client: d.clienteId, invoices: [{ id: Number(d.idProveedor), amount: d.totalDocumento }], anotation: String(motivo).slice(0, 500), stamp: { generateStamp: true } });
    const n = r.datos || {}; const tp = n.numberTemplate || {};
    return { numeroNota: String(tp.fullNumber || n.id), cufeNota: (n.stamp && n.stamp.cufe) || "", idProveedor: String(n.id) };
  },
  async reenviarCorreo(ctx) { await enviar(ctx, `/invoices/${encodeURIComponent(ctx.documento.idProveedor)}/email`, { emails: [ctx.correo] }); return { ok: true }; },
};

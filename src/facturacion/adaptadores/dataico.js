/*
 * Adaptador DATAICO (https://dataico.com) — API REST v2 con cabecera «Auth-token».
 *
 * ESTADO DE VERIFICACIÓN: escrito a partir de la documentación pública (portaldelcliente.dataico.com y app.dataico.com/api-docs), que
 * se pudo leer solo en parte. NO probado contra una cuenta real. Los nombres de campos del cuerpo son los MÁS inciertos: confírmalos
 * contra https://app.dataico.com/api-docs antes de producción.
 *
 * Endpoints usados (base https://api.dataico.com/direct/dataico_api/v2):
 *   GET  /invoices?number=…            consulta (se usa para «Probar conexión» con una consulta vacía)
 *   POST /invoices                     crea y envía la factura a la DIAN
 *   POST /credit_notes                 Nota Crédito (VERIFICAR ruta y campos)
 *   POST /invoices/{uuid}/email        reenvío por correo (VERIFICAR)
 * Ambiente: el cuerpo lleva env = PRUEBAS | PRODUCCION (cualquier otro valor Dataico lo trata como pruebas).
 *
 * IDs/CATÁLOGOS que dependen de la cuenta: Dataico usa códigos de texto (no IDs): «Account ID» (UUID de la cuenta que dueña del Auth Token),
 * la numeración (prefijo + resolución, que se envían tal como están en la configuración de Comandas) y los códigos DIAN de impuestos
 * (IVA, INC) y de medios de pago. Régimen/responsabilidades del cliente se envían con los valores genéricos («consumidor final»).
 * Documento Equivalente POS: sin mapear: solo Factura Electrónica de Venta.
 */
import { solicitar, ErrorProveedor, valoresSecretos, DIAN_TIPO_DOC, esPersonaJuridica, partirNombre, sinPos, filasSinImpuesto, exigirMapeo, catalogoVacio } from "./interfaz.js";

const BASE = "https://api.dataico.com/direct/dataico_api/v2";
// INC = «IC» (impuesto al consumo) en Dataico — VERIFICAR el código exacto de tu cuenta.
// Catálogos FIJOS de Dataico (no hay endpoint de listas): categorías de impuesto y medios de pago del API. VERIFICAR en tu cuenta.
const IMPUESTOS_DATAICO = [{ id: "IC", etiqueta: "INC 8 % · Impuesto al consumo (IC)", porcentaje: 8, tipo: "INC" }, { id: "IVA", etiqueta: "IVA 19 %", porcentaje: 19, tipo: "IVA" }, { id: "EXENTO", etiqueta: "Exento / no responsable", porcentaje: 0, tipo: "EXENTO" }];
const MEDIOS_DATAICO = [{ id: "CASH", etiqueta: "Efectivo" }, { id: "CREDIT_CARD", etiqueta: "Tarjeta crédito" }, { id: "DEBIT_CARD", etiqueta: "Tarjeta débito" }, { id: "TRANSFER", etiqueta: "Transferencia" }];
const PRODUCTOS_DATAICO = [{ id: "PROPINA", etiqueta: "Propina voluntaria (ingreso para terceros)" }];
// Cabeceras: Auth-token y la cuenta (la cuenta también va en el cuerpo, en invoice.dataico_account_id).
const cab = (c) => ({ "Auth-token": c.authToken, ...(c.accountId ? { dataico_account_id: c.accountId } : {}) });
// Nivel tributario (responsabilidad DIAN) del cliente. Si el payload trae `cliente.nivelTributario` y es uno de los admitidos se respeta;
// si no, por defecto: persona natural → R-99-PN (no responsable de IVA), persona jurídica → O-47 (régimen simple).
export const NIVELES_TRIBUTARIOS = ["O-47", "O-48", "R-99-PN"]; // O-47 = Régimen simple · O-48 = Responsable de IVA · R-99-PN = No responsable
export const nivelTributario = (c, juridica) => (c && NIVELES_TRIBUTARIOS.includes(c.nivelTributario) ? c.nivelTributario : (juridica ? "O-47" : "R-99-PN"));
const dmy = (iso) => iso.split("-").reverse().join("/");
const llamar = (ctx, ruta, metodo = "GET", json) => solicitar(ctx.fetch, `${BASE}${ruta}`, { metodo, cabeceras: cab(ctx.credenciales), json, secretos: valoresSecretos(ctx.credenciales) });

export const dataico = {
  id: "dataico", nombre: "Dataico",
  /** Dataico no publica listas de catálogos: se valida el Auth Token y se ofrecen los códigos fijos del API. La numeración sale de «Resolución y numeración». */
  async probarConexionYSincronizar(ctx) {
    await llamar(ctx, `/invoices?number=COMANDAS-PRUEBA-CONEXION`).catch((e) => { if (e.estado === 404) return null; throw e; });
    return { ok: true, mensaje: "Conexión correcta con Dataico (el Auth Token fue aceptado). Los impuestos y medios de pago son códigos fijos de su API; la numeración sale de tu resolución.", catalogos: { ...catalogoVacio(), impuestos: IMPUESTOS_DATAICO, mediosPago: MEDIOS_DATAICO, productos: PRODUCTOS_DATAICO } };
  },
  async emitirDocumento(ctx) {
    const { payload: p, credenciales: cr } = ctx;
    if (p.tipoDocumento === "pos") throw sinPos("Dataico");
    const m = exigirMapeo(ctx, "dataico");
    const c = p.cliente, n = partirNombre(c.nombre), juridica = esPersonaJuridica(c);
    const metodo = ["efectivo", "tarjeta", "transferencia"].includes((p.pagos[0] || {}).metodo) ? p.pagos[0].metodo : "efectivo";
    const r = await llamar(ctx, "/invoices", "POST", {
      actions: { send_dian: true, send_email: !!c.correo },
      invoice: {
        env: ctx.modo === "produccion" ? "PRODUCCION" : "PRUEBAS", dataico_account_id: cr.accountId, order_reference: p.referencia, // referencia estable por cuenta
        issue_date: dmy(p.fecha), payment_date: dmy(p.fecha), invoice_type_code: "FACTURA_VENTA", payment_means_type: "DEBITO", payment_means: m.mediosPago[metodo],
        numbering: { prefix: p.resolucion.prefijo || undefined, resolution_number: p.resolucion.numero || undefined, flexible: true }, notes: [p.observaciones],
        customer: { party_identification: c.numero, party_type: juridica ? "PERSONA_JURIDICA" : "PERSONA_NATURAL", tax_level_code: nivelTributario(c, juridica), // VERIFICAR los códigos en tu cuenta de Dataico
           id_type: DIAN_TIPO_DOC[c.tipoDoc] || "13", email: c.correo || undefined, address_line: c.direccion || undefined, country_code: "CO",
          ...(juridica ? { company_name: c.nombre } : { first_name: n.nombres, family_name: n.apellidos }) },
        items: filasSinImpuesto(p).map((f) => ({ sku: String(f.codigo === "PROPINA" ? m.propina : (f.codigo || `L${f.indice}`)).slice(0, 40), description: f.descripcion, quantity: f.cantidad, price: f.precio, discount_rate: f.descuentoPct,
          taxes: f.sinImpuesto || p.impuesto.tipo === "EXENTO" ? [] : [{ tax_category: m.impuestos[p.impuesto.tipo.toLowerCase()], tax_rate: p.impuesto.porcentaje }] })),
      },
    });
    const d = r.datos || {};
    const num = d.number || (d.invoice && d.invoice.number);
    if (!num) throw new ErrorProveedor({ mensaje: "Dataico respondió sin número de factura.", incierto: true, detalle: JSON.stringify(d).slice(0, 800) });
    return { numero: String(num), prefijo: p.resolucion.prefijo || "", cufe: d.cufe || (d.invoice && d.invoice.cufe) || "", pdfUrl: d.pdf_url || null, qrUrl: d.qr_url || null, idProveedor: String(d.uuid || d.id || num), estadoProveedor: String(d.status || d.dian_status || ""), correoEnviado: !!c.correo };
  },
  async anularDocumento(ctx) {
    const { documento: d, motivo } = ctx;
    const r = await llamar(ctx, "/credit_notes", "POST", { credit_note: { env: ctx.modo === "produccion" ? "PRODUCCION" : "PRUEBAS", dataico_account_id: ctx.credenciales.accountId, invoice_number: d.numero, reason_code: "2", notes: [String(motivo).slice(0, 250)], issue_date: dmy(new Date().toISOString().slice(0, 10)) }, actions: { send_dian: true } });
    const n = r.datos || {};
    return { numeroNota: String(n.number || n.id), cufeNota: n.cufe || "", idProveedor: String(n.uuid || n.id || n.number) };
  },
  async reenviarCorreo(ctx) { await llamar(ctx, `/invoices/${encodeURIComponent(ctx.documento.idProveedor)}/email`, "POST", { email: ctx.correo }); return { ok: true }; },
};

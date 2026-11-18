/*
 * Adaptador FACTUS (https://factus.com.co) — API REST con OAuth2.
 *
 * ESTADO DE VERIFICACIÓN: mapeo escrito a partir de la documentación pública y de la estructura conocida de la API. NO se ha
 * probado contra el sandbox real. Antes de producción corre «Probar conexión» y una factura de prueba en sandbox (docs/FACTURACION_DIAN.md).
 * Los puntos marcados «VERIFICAR» son los que más probablemente necesiten ajuste.
 *
 * Endpoints usados (base: sandbox https://api-sandbox.factus.com.co · producción https://api.factus.com.co):
 *   POST /oauth/token                      grant_type=password + client_id + client_secret + username + password
 *   GET  /v1/numbering-ranges              rangos de numeración (para elegir el del prefijo configurado)
 *   POST /v1/bills/validate                crea y valida con la DIAN una factura de venta
 *   POST /v1/credit-notes/validate         Nota Crédito que anula la factura (concepto 2: anulación)
 *   POST /v1/bills/send-email/{number}     reenvío por correo (VERIFICAR ruta exacta en tu versión de la API)
 *
 * IDs de CATÁLOGO que dependen del cliente o de Factus (VERIFICAR en https://developers.factus.com.co → Catálogos):
 *   · numbering_range_id: lo elige el administrador al sincronizar catálogos (`mapeo.resolucion`). La Nota Crédito busca su propio rango activo.
 *   · identification_document_id (tipo de documento del cliente): CC=3, CE=5, NIT=6, Pasaporte=7.
 *   · tribute_id de la línea: sale del mapeo del administrador (por defecto del catálogo fijo: IVA=1, INC=4, no aplica/exento=21).
 *   · legal_organization_id: 1 persona jurídica, 2 persona natural.  · unit_measure_id 70 (unidad), standard_code_id 1 (estándar interno).
 *   · payment_method_code: del mapeo del administrador (catálogo fijo: efectivo=10, tarjeta crédito=48, tarjeta débito=49, transferencia=47).
 * PRECIO: Factus espera `price` por unidad CON impuestos incluidos y calcula la base internamente (VERIFICAR); por eso se envía el
 *   total de la línea ÷ cantidad. Puede haber diferencias de centavos frente al desglose de Comandas: se revisan en el sandbox.
 * Documento Equivalente POS: sin mapear (la app solo emite Factura Electrónica de Venta con Factus).
 */
import { solicitar, ErrorProveedor, valoresSecretos, sinPos, aTexto2, filasConImpuesto, exigirMapeo, catalogoVacio } from "./interfaz.js";

const BASE = { pruebas: "https://api-sandbox.factus.com.co", produccion: "https://api.factus.com.co" };
const DOC_ID = { CC: 3, CE: 5, NIT: 6, PAS: 7 };
// Catálogos FIJOS de Factus (los tributos y medios de pago son códigos DIAN, no de tu cuenta). VERIFICAR contra https://developers.factus.com.co
const IMPUESTOS_FACTUS = [{ id: "4", etiqueta: "INC 8 % · Impuesto nacional al consumo", porcentaje: 8, tipo: "INC" }, { id: "1", etiqueta: "IVA 19 %", porcentaje: 19, tipo: "IVA" }, { id: "21", etiqueta: "No aplica / Exento", porcentaje: 0, tipo: "EXENTO" }];
const PRODUCTOS_FACTUS = [{ id: "PROPINA", etiqueta: "Propina voluntaria (ingreso para terceros)" }];
const MEDIOS_FACTUS = [{ id: "10", etiqueta: "Efectivo" }, { id: "48", etiqueta: "Tarjeta crédito" }, { id: "49", etiqueta: "Tarjeta débito" }, { id: "47", etiqueta: "Transferencia débito bancaria" }];

async function token({ credenciales: c, modo, fetch: f }) {
  const r = await solicitar(f, `${BASE[modo]}/oauth/token`, { metodo: "POST", secretos: valoresSecretos(c), seguro: true,
    formulario: { grant_type: "password", client_id: c.clientId, client_secret: c.clientSecret, username: c.usuario, password: c.contrasena } });
  if (!r.datos || !r.datos.access_token) throw new ErrorProveedor({ mensaje: "Factus no devolvió un token de acceso.", detalle: "Respuesta sin access_token", codigo: "credenciales" });
  return r.datos.access_token;
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function rangos(ctx, tokenAcceso) {
  const r = await solicitar(ctx.fetch, `${BASE[ctx.modo]}/v1/numbering-ranges?filter[is_active]=1`, { cabeceras: auth(tokenAcceso), secretos: valoresSecretos(ctx.credenciales) });
  return (r.datos && (r.datos.data && r.datos.data.data ? r.datos.data.data : r.datos.data)) || [];
}
async function rangoDe(ctx, tokenAcceso, prefijo, documento = "Factura de Venta") {
  const r = await solicitar(ctx.fetch, `${BASE[ctx.modo]}/v1/numbering-ranges?filter[is_active]=1`, { cabeceras: auth(tokenAcceso), secretos: valoresSecretos(ctx.credenciales) });
  const lista = (r.datos && (r.datos.data && r.datos.data.data ? r.datos.data.data : r.datos.data)) || [];
  const activos = lista.filter((x) => !x.document || x.document === documento);
  const elegido = prefijo ? activos.find((x) => String(x.prefix).toUpperCase() === prefijo) : (activos.length === 1 ? activos[0] : null);
  if (!elegido) throw new ErrorProveedor({ mensaje: prefijo ? `En Factus no hay un rango de numeración activo con el prefijo «${prefijo}».` : "Escribe el prefijo de tu resolución: en Factus hay varios rangos activos.", codigo: "configuracion", detalle: `Rangos activos: ${activos.map((x) => x.prefix).join(", ") || "ninguno"}` });
  return elegido.id;
}

function cliente(c) {
  const juridica = c.tipoDoc === "NIT";
  return {
    identification_document_id: String(DOC_ID[c.tipoDoc] || 3), identification: String(c.numero), ...(juridica ? { dv: String(c.dv || "") } : {}),
    ...(juridica ? { company: c.nombre } : { names: c.nombre }), address: c.direccion || undefined, email: c.correo || undefined,
    legal_organization_id: juridica ? "1" : "2", tribute_id: "21",
  };
}
/** price = valor unitario CON impuesto (VERIFICAR en sandbox). La propina (ingreso para terceros) va como ítem excluido, sin impuesto. */
function items(p, m) {
  const tribId = (tipo) => Number((m.impuestos && m.impuestos[tipo.toLowerCase()]) || 0) || undefined;
  return filasConImpuesto(p).map((f) => ({
    code_reference: String(f.codigo === "PROPINA" ? m.propina : (f.codigo || `L${f.indice}`)).slice(0, 40), name: f.descripcion, quantity: f.cantidad,
    discount_rate: f.descuentoPct, price: f.precio, tax_rate: f.sinImpuesto ? "0.00" : aTexto2(p.impuesto.porcentaje), unit_measure_id: 70, standard_code_id: 1,
    is_excluded: f.sinImpuesto || p.impuesto.tipo === "EXENTO" ? 1 : 0, tribute_id: f.sinImpuesto ? (tribId("EXENTO") || 21) : tribId(p.impuesto.tipo), withholding_taxes: [],
  }));
}

export const factus = {
  id: "factus", nombre: "Factus",
  /** Sincroniza catálogos: rangos de numeración de TU cuenta; impuestos y medios de pago son códigos fijos de la DIAN. */
  async probarConexionYSincronizar(ctx) {
    const t = await token(ctx);
    const lista = await rangos(ctx, t);
    const resoluciones = lista.filter((x) => !x.document || /factura/i.test(x.document)).map((x) => ({ id: String(x.id), etiqueta: `${x.prefix || "(sin prefijo)"} · res. ${x.resolution_number || "?"} · ${x.from || "?"}-${x.to || "?"}${x.end_date ? ` · vence ${x.end_date}` : ""}`, prefijo: x.prefix || "", desde: String(x.from || ""), hasta: String(x.to || ""), numero: String(x.resolution_number || ""), vigenciaHasta: x.end_date || "" }));
    return { ok: true, mensaje: `Conexión correcta con Factus (${ctx.modo === "produccion" ? "producción" : "sandbox"}). ${resoluciones.length} rango(s) de numeración encontrados.`, catalogos: { ...catalogoVacio(), resoluciones, impuestos: IMPUESTOS_FACTUS, mediosPago: MEDIOS_FACTUS, productos: PRODUCTOS_FACTUS } };
  },
  async emitirDocumento(ctx) {
    const { payload: p } = ctx;
    if (p.tipoDocumento === "pos") throw sinPos("Factus");
    const m = exigirMapeo(ctx, "factus");
    const t = await token(ctx);
    const rango = Number(m.resolucion);
    // reference_code = id de la cuenta: Factus no repite un mismo código de referencia (idempotencia en el proveedor) — VERIFICAR
    const r = await solicitar(ctx.fetch, `${BASE[ctx.modo]}/v1/bills/validate`, { metodo: "POST", cabeceras: auth(t), secretos: valoresSecretos(ctx.credenciales), json: {
      numbering_range_id: rango, reference_code: p.referencia, observation: p.observaciones, payment_form: "1", payment_method_code: String(m.mediosPago[["efectivo", "tarjeta", "transferencia"].includes((p.pagos[0] || {}).metodo) ? p.pagos[0].metodo : "efectivo"]),
      send_email: !!p.cliente.correo, customer: cliente(p.cliente), items: items(p, m),
    } });
    const b = (r.datos && r.datos.data && (r.datos.data.bill || r.datos.data)) || {};
    if (!b.number || !b.cufe) throw new ErrorProveedor({ mensaje: "Factus respondió sin número o CUFE.", incierto: true, detalle: JSON.stringify(r.datos).slice(0, 800) });
    return { numero: String(b.number), prefijo: b.prefix || p.resolucion.prefijo || "", cufe: b.cufe, pdfUrl: b.public_url || null, qrUrl: b.qr || b.qr_image || null, idProveedor: String(b.id || b.number), estadoProveedor: String(b.status || "validated"), correoEnviado: !!p.cliente.correo };
  },
  async anularDocumento(ctx) {
    const { documento: d, motivo, payload: p } = ctx;
    const m = exigirMapeo(ctx, "factus");
    const t = await token(ctx);
    const rango = await rangoDe(ctx, t, "", "Nota Crédito");
    const r = await solicitar(ctx.fetch, `${BASE[ctx.modo]}/v1/credit-notes/validate`, { metodo: "POST", cabeceras: auth(t), secretos: valoresSecretos(ctx.credenciales), json: {
      numbering_range_id: rango, bill_id: Number(d.idProveedor) || undefined, correction_concept_code: 2, customization_id: 20, reference_code: `NC-${d.referencia || d.numero}`, observation: String(motivo).slice(0, 250),
      payment_method_code: String(m.mediosPago.efectivo), items: items(p, m),
    } });
    const n = (r.datos && r.datos.data && (r.datos.data.credit_note || r.datos.data)) || {};
    if (!n.number) throw new ErrorProveedor({ mensaje: "Factus respondió sin número de nota crédito.", incierto: true, detalle: JSON.stringify(r.datos).slice(0, 800) });
    return { numeroNota: String(n.number), cufeNota: n.cufe || "", idProveedor: String(n.id || n.number) };
  },
  async reenviarCorreo(ctx) {
    const t = await token(ctx);
    await solicitar(ctx.fetch, `${BASE[ctx.modo]}/v1/bills/send-email/${encodeURIComponent(ctx.documento.numero)}`, { metodo: "POST", cabeceras: auth(t), json: { email: ctx.correo }, secretos: valoresSecretos(ctx.credenciales) });
    return { ok: true };
  },
};

/*
 * Adaptador SIIGO (Siigo Nube — https://developers.siigo.com) — API REST con token.
 *
 * ESTADO DE VERIFICACIÓN: escrito a partir de la documentación pública. NO probado contra una cuenta real. Siigo no ofrece un
 * sandbox general: se usa una cuenta de pruebas con el «Usuario API» y el «Access Key» (el modo solo cambia la etiqueta).
 *
 * Endpoints usados (base https://api.siigo.com):
 *   POST /auth                         { username, access_key } → access_token       (cabecera Partner-Id obligatoria en las demás llamadas)
 *   GET  /v1/customers?identification= buscar al cliente · POST /v1/customers  crearlo
 *   GET  catálogos (impuestos, ítems/productos, numeraciones, usuarios, formas de pago) → el administrador los mapea (CERO IDs quemados)
 *   GET  /v1/taxes                     impuestos de la cuenta (INC / IVA)
 *   GET  /v1/users                     vendedor (se usa el primero activo)
 *   GET  /v1/payment-types?document_type=FV   formas de pago
 *   POST /v1/invoices                  crea el comprobante y, con stamp.send, lo envía a la DIAN
 *   GET  /v1/document-types?type=NC    comprobante de Nota Crédito · POST /v1/credit-notes  la crea (VERIFICAR campos)
 *   POST /v1/invoices/{id}/mail        reenvío por correo (VERIFICAR ruta)
 *
 * IDs de CATÁLOGO que dependen de la cuenta del cliente:
 *   · «ID Tipo Comprobante» (document.id): lo escribe el dueño en la app; sale de Siigo (comprobante de factura de venta electrónica,
 *     o el del Documento Equivalente POS). Por eso este proveedor SÍ admite POS: lo decide ese ID.
 *   · El administrador elige en la app (Facturación electrónica → catálogos) qué ítem/producto contable usan las ventas.
 *   · Impuestos, vendedor y forma de pago: se descubren con las consultas de arriba; si no se encuentran, el error dice qué falta.
 * Partner-Id: se envía «ComandasApp» (identifica a la aplicación integradora; Siigo puede pedir otro valor registrado).
 */
import { solicitar, ErrorProveedor, valoresSecretos, DIAN_TIPO_DOC, esPersonaJuridica, partirNombre, filasSinImpuesto, exigirMapeo, catalogoVacio } from "./interfaz.js";

const BASE = "https://api.siigo.com";
const PARTNER = "ComandasApp";
const falta = (mensaje, detalle = "") => new ErrorProveedor({ mensaje, codigo: "configuracion", detalle });

async function token(ctx) {
  const c = ctx.credenciales;
  const r = await solicitar(ctx.fetch, `${BASE}/auth`, { metodo: "POST", cabeceras: { "Partner-Id": PARTNER }, json: { username: c.usuarioApi, access_key: c.accessKey }, secretos: valoresSecretos(c), seguro: true });
  if (!r.datos || !r.datos.access_token) throw new ErrorProveedor({ mensaje: "Siigo no devolvió un token de acceso.", codigo: "credenciales", detalle: "Respuesta sin access_token" });
  return r.datos.access_token;
}
const con = (ctx, t) => ({ get: (ruta) => solicitar(ctx.fetch, `${BASE}${ruta}`, { cabeceras: { Authorization: `Bearer ${t}`, "Partner-Id": PARTNER }, secretos: valoresSecretos(ctx.credenciales) }),
  post: (ruta, json) => solicitar(ctx.fetch, `${BASE}${ruta}`, { metodo: "POST", cabeceras: { Authorization: `Bearer ${t}`, "Partner-Id": PARTNER }, json, secretos: valoresSecretos(ctx.credenciales) }) });
const filas = (r) => (r.datos && (r.datos.results || r.datos)) || [];

async function cliente(api, c) {
  const r = await api.get(`/v1/customers?identification=${encodeURIComponent(c.numero)}`);
  if (filas(r).length) return { identification: c.numero, branch_office: filas(r)[0].branch_office || 0 };
  const juridica = esPersonaJuridica(c); const n = partirNombre(c.nombre);
  await api.post("/v1/customers", { type: "Customer", person_type: juridica ? "Company" : "Person", id_type: DIAN_TIPO_DOC[c.tipoDoc] || "13", identification: c.numero, ...(juridica ? { check_digit: c.dv } : {}),
    name: juridica ? [c.nombre] : [n.nombres, n.apellidos], contacts: c.correo ? [{ first_name: n.nombres, email: c.correo }] : undefined });
  return { identification: c.numero, branch_office: 0 };
}

export const siigo = {
  id: "siigo", nombre: "Siigo",
  /** Sincroniza catálogos de TU cuenta: tipos de comprobante, impuestos, productos, usuarios vendedores y formas de pago. */
  async probarConexionYSincronizar(ctx) {
    const api = con(ctx, await token(ctx));
    const [tp, im, pr, us, pg] = [await api.get("/v1/document-types?type=FV"), await api.get("/v1/taxes"), await api.get("/v1/products?page_size=50"), await api.get("/v1/users"), await api.get("/v1/payment-types?document_type=FV")];
    const resoluciones = filas(tp).filter((t) => t.active !== false).map((t) => ({ id: String(t.id), etiqueta: `${t.code || ""} ${t.name || ""}${t.electronic_type ? ` · ${t.electronic_type}` : ""}`.trim() || `Comprobante ${t.id}`, prefijo: String(t.code || "") }));
    const impuestos = filas(im).map((t) => ({ id: String(t.id), etiqueta: `${t.name} · ${Number(t.percentage)} %`, porcentaje: Number(t.percentage), tipo: /consumo|INC/i.test(`${t.name} ${t.type}`) ? "INC" : /IVA/i.test(`${t.name} ${t.type}`) ? "IVA" : String(t.type || "") }));
    const productos = filas(pr).map((x) => ({ id: String(x.code), etiqueta: `${x.code} · ${x.name || ""}`.trim() }));
    const vendedores = filas(us).filter((u) => u.active !== false).map((u) => ({ id: String(u.id), etiqueta: `${u.first_name || ""} ${u.last_name || u.username || ""}`.trim() || `Usuario ${u.id}` }));
    const mediosPago = filas(pg).map((x) => ({ id: String(x.id), etiqueta: String(x.name || x.id) }));
    return { ok: true, mensaje: `Conexión correcta con Siigo. ${impuestos.length} impuestos, ${productos.length} productos, ${vendedores.length} vendedores y ${mediosPago.length} formas de pago encontrados.`, catalogos: { ...catalogoVacio(), resoluciones, impuestos, productos, vendedores, mediosPago } };
  },
  async emitirDocumento(ctx) {
    const { payload: p, credenciales: cr } = ctx;
    const m = exigirMapeo(ctx, "siigo");
    const api = con(ctx, await token(ctx));
    const cli = await cliente(api, p.cliente);
    const taxId = p.impuesto.tipo === "EXENTO" ? null : Number(m.impuestos[p.impuesto.tipo.toLowerCase()]);
    const metodo = ["efectivo", "tarjeta", "transferencia"].includes((p.pagos[0] || {}).metodo) ? p.pagos[0].metodo : "efectivo";
    // document.id = comprobante: el ID que escribió el dueño; si en el mapeo eligió otro tipo de comprobante, ese manda. Aquí se decide también POS.
    const r = await api.post("/v1/invoices", {
      document: { id: Number(m.resolucion || cr.idTipoComprobante) }, date: p.fecha, customer: cli, seller: Number(m.vendedor), observations: p.observaciones,
      stamp: { send: true }, mail: { send: !!p.cliente.correo },
      items: filasSinImpuesto(p).map((f) => ({ code: f.codigo === "PROPINA" ? m.propina : m.producto, description: f.descripcion, quantity: f.cantidad, price: f.precio, discount: f.descuentoPct, ...(taxId && !f.sinImpuesto ? { taxes: [{ id: taxId }] } : {}) })),
      payments: [{ id: Number(m.mediosPago[metodo]), value: p.totales.totalDocumento, due_date: p.fecha }],
    });
    const d = r.datos || {};
    if (!d.id) throw new ErrorProveedor({ mensaje: "Siigo respondió sin id de comprobante.", incierto: true, detalle: JSON.stringify(d).slice(0, 800) });
    return { numero: String(d.name || d.number || d.id), prefijo: (String(d.name || "").match(/^[A-Za-z]+/) || [""])[0], cufe: (d.stamp && d.stamp.cufe) || "", pdfUrl: (d.public_url) || null, qrUrl: null, idProveedor: String(d.id), estadoProveedor: String((d.stamp && d.stamp.status) || ""), correoEnviado: !!(d.mail && d.mail.status) };
  },
  async anularDocumento(ctx) {
    const { documento: d, motivo } = ctx;
    const api = con(ctx, await token(ctx));
    // El comprobante de Nota Crédito (document.id) es otro distinto al de la factura y depende de la cuenta: se busca entre los tipos «NC» (VERIFICAR).
    const tipos = await api.get("/v1/document-types?type=NC");
    const nc = filas(tipos).find((t) => t.active !== false);
    if (!nc) throw falta("En Siigo no encontré un comprobante de Nota Crédito activo. Créalo en Siigo (Configuración → Comprobantes) y vuelve a intentar.");
    const r = await api.post("/v1/credit-notes", { document: { id: nc.id }, invoice: d.idProveedor, date: new Date().toISOString().slice(0, 10), reason: "2", observations: String(motivo).slice(0, 250), stamp: { send: true } });
    const n = r.datos || {};
    return { numeroNota: String(n.name || n.id), cufeNota: (n.stamp && n.stamp.cufe) || "", idProveedor: String(n.id) };
  },
  async reenviarCorreo(ctx) { const api = con(ctx, await token(ctx)); await api.post(`/v1/invoices/${encodeURIComponent(ctx.documento.idProveedor)}/mail`, { mail_to: ctx.correo }); return { ok: true }; },
};

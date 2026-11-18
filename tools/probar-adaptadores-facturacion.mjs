// Pruebas de los adaptadores con un `fetch` simulado (NO hablan con los proveedores reales) y de la capa de Firebase administrador.
import { generateKeyPairSync, createVerify } from "node:crypto";
import { ADAPTADORES } from "../src/facturacion/adaptadores/index.js";
import { cumpleContrato, redactar, solicitar, ErrorProveedor } from "../src/facturacion/adaptadores/interfaz.js";
import { generarPdfSimulado } from "../src/facturacion/pdfSimulado.js";
import { construirPayload } from "./facturacion/payload.mjs";
import { leerCuentaServicio, firmarJwt, crearDbAdmin } from "../netlify/lib/firebaseAdmin.mjs";
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };
const lanza = async (f) => { try { await f(); return null; } catch (e) { return e; } };

const ajustes = (o = {}) => ({ modo: "pruebas", tipoDocumento: "factura", impuesto: "inc", precios: "incluyen", propina: "excluir", resolucion: { prefijo: "SETT", numero: "18760000001", desde: "1", hasta: "5000", vigenciaDesde: "2026-01-01", vigenciaHasta: "2027-12-31" }, ...o });
const cuenta = { id: "c1", mesa: 3, pagadaTs: 1_760_000_000_000, pagos: [{ monto: 21600, metodoPago: "efectivo" }], datosFiscales: { tipoDoc: "NIT", numero: "900123456", dv: "7", nombre: "Mi Empresa SAS", correo: "fac@empresa.co", direccion: "Calle 1" } };
const pedidos = [{ estado: "listo", items: [{ id: "m1", name: "Almuerzo", qty: 2, price: 10800 }] }];
const payload = (o) => construirPayload({ cuenta, pedidos, ajustes: ajustes(o) });

console.log("── Contrato común ──");
ok(Object.values(ADAPTADORES).length === 5 && Object.values(ADAPTADORES).every(cumpleContrato), "los 5 adaptadores tienen emitirDocumento, anularDocumento, reenviarCorreo y probarConexionYSincronizar");

console.log("\n── Payload estándar ──");
const p = payload();
ok(p.referencia === "CMD-c1" && p.fecha === "2025-10-09" && p.cliente.tipoDoc === "NIT" && p.totales.totalDocumento === 21600 && p.lineas.length === 1, "referencia por cuenta, fecha de Colombia, cliente y totales");
ok(construirPayload({ cuenta: { ...cuenta, datosFiscales: null }, pedidos, ajustes: ajustes() }).cliente.numero === "222222222222", "sin datos fiscales: consumidor final genérico de la DIAN");

console.log("\n── Simulado ──");
const s = ADAPTADORES.simulado;
const r1 = await s.emitirDocumento({ payload: p }), r2 = await s.emitirDocumento({ payload: p });
ok(r1.numero === r2.numero && r1.cufe === r2.cufe && r1.numero.startsWith("SETT"), "es determinista: misma cuenta → mismo número y CUFE");
ok((await lanza(() => s.emitirDocumento({ payload: { ...p, cliente: { ...p.cliente, correo: "a@red.test" } } }))).incierto === true, "@red.test simula error dudoso");
const pdf = generarPdfSimulado({ ...r1, estado: "emitida", payload: p });
ok(new TextDecoder("latin1").decode(pdf.slice(0, 8)).startsWith("%PDF-1.4") && new TextDecoder("latin1").decode(pdf).includes("%%EOF") && new TextDecoder("latin1").decode(pdf).includes("SIN VALIDEZ"), "genera un PDF válido que dice que no tiene validez DIAN");

console.log("\n── Redacción de secretos ──");
const t = redactar('{"access_token":"abcdef123456","password":"hunter2hunter2"} Authorization: Bearer ZZZZZZZZZZZZZ clave=MISECRETO99', ["MISECRETO99"]);
ok(!/abcdef123456|hunter2|ZZZZZZ|MISECRETO/.test(t), "tokens, contraseñas, cabeceras y valores exactos de las credenciales desaparecen");
const fetchRed = async () => { throw new Error("ECONNRESET con MISECRETO99"); };
let er = await lanza(() => solicitar(fetchRed, "https://x.test/a", { metodo: "POST", secretos: ["MISECRETO99"] }));
ok(er instanceof ErrorProveedor && er.incierto && !er.detalle.includes("MISECRETO99"), "caída de red → error «incierto» sin secretos en el detalle");
const fetch4 = async () => ({ ok: false, status: 422, text: async () => '{"message":"NIT inválido","password":"zzzzzzzz"}' });
er = await lanza(() => solicitar(fetch4, "https://x.test/a"));
ok(er.estado === 422 && er.incierto === false && er.message === "NIT inválido" && !er.detalle.includes("zzzzzzzz"), "422: rechazo definitivo con el mensaje del proveedor");
er = await lanza(() => solicitar(async () => ({ ok: false, status: 503, text: async () => "" }), "https://x.test/a", { metodo: "POST" }));
ok(er.incierto === true, "5xx al CREAR algo → incierto");
er = await lanza(() => solicitar(async () => ({ ok: false, status: 503, text: async () => "" }), "https://x.test/a"));
ok(er.incierto === false, "5xx en una CONSULTA (GET/autenticación) → seguro de repetir, no incierto");
er = await lanza(() => solicitar(fetchRed, "https://x.test/a", { metodo: "POST", seguro: true }));
ok(er.incierto === false && er.codigo === "red", "red caída en la autenticación → seguro de repetir");

// Fetch simulado que registra llamadas y responde por ruta
function servidor(rutas) {
  const llamadas = [];
  const f = async (url, init = {}) => {
    const u = new URL(url); const clave = `${init.method || "GET"} ${u.pathname}`; llamadas.push({ clave, url, init, cuerpo: init.body && (init.headers["Content-Type"] || "").includes("json") ? JSON.parse(init.body) : init.body });
    const h = rutas[clave] || Object.entries(rutas).find(([k]) => clave.startsWith(k.replace(/\*$/, "")) && k.endsWith("*"))?.[1];
    if (!h) return { ok: false, status: 404, text: async () => JSON.stringify({ message: `sin ruta ${clave}` }) };
    const res = typeof h === "function" ? h(init) : h; return { ok: (res.status || 200) < 400, status: res.status || 200, text: async () => JSON.stringify(res.cuerpo ?? {}) };
  };
  return { f, llamadas };
}

console.log("\n── Factus ──");
const MF = { resolucion: "8", impuestos: { inc: "4" }, mediosPago: { efectivo: "10", tarjeta: "48", transferencia: "47" } };
const credF = { clientId: "CID", clientSecret: "CSECRET-123456", usuario: "u@x.co", contrasena: "PWD-123456" };
let sv = servidor({ "POST /oauth/token": { cuerpo: { access_token: "TOK-F" } }, "GET /v1/numbering-ranges": { cuerpo: { data: [{ id: 8, prefix: "SETT", document: "Factura de Venta" }, { id: 9, prefix: "NC", document: "Nota Crédito" }] } },
  "POST /v1/bills/validate": { cuerpo: { data: { bill: { id: 77, number: "SETT1001", cufe: "CUFE-F", public_url: "https://pdf/f" } } } } });
let r = await ADAPTADORES.factus.emitirDocumento({ payload: p, credenciales: credF, mapeo: MF, modo: "pruebas", fetch: sv.f });
const bill = sv.llamadas.find((l) => l.clave === "POST /v1/bills/validate");
ok(r.numero === "SETT1001" && r.cufe === "CUFE-F" && r.pdfUrl === "https://pdf/f" && r.idProveedor === "77", "emite y devuelve número, CUFE, PDF e id");
ok(sv.llamadas[0].url.startsWith("https://api-sandbox.factus.com.co") && /grant_type=password/.test(sv.llamadas[0].cuerpo) && /client_secret=CSECRET-123456/.test(sv.llamadas[0].cuerpo), "modo pruebas usa el sandbox y el flujo OAuth con contraseña");
ok(bill.init.headers.Authorization === "Bearer TOK-F" && bill.cuerpo.reference_code === "CMD-c1" && bill.cuerpo.numbering_range_id === 8 && bill.cuerpo.items[0].tax_rate === "8.00" && bill.cuerpo.items[0].tribute_id === 4 && bill.cuerpo.items[0].price === 10800 && bill.cuerpo.customer.legal_organization_id === "1", "mapea referencia idempotente, rango por prefijo, INC 8 %, tributo y cliente jurídico");
sv = servidor({ "POST /oauth/token": { cuerpo: { access_token: "T" } }, "GET /v1/numbering-ranges": { cuerpo: { data: [{ id: 8, prefix: "SETT", resolution_number: "18760000001", from: 1, to: 5000, end_date: "2027-12-31", document: "Factura de Venta" }, { id: 9, prefix: "NC", document: "Nota Crédito" }] } } });
const sin = await ADAPTADORES.factus.probarConexionYSincronizar({ credenciales: credF, modo: "produccion", fetch: sv.f });
ok(sv.llamadas[0].url.startsWith("https://api.factus.com.co/"), "modo producción usa la API de producción");
ok(sin.catalogos.resoluciones.length === 1 && sin.catalogos.resoluciones[0].id === "8" && sin.catalogos.resoluciones[0].hasta === "5000" && sin.catalogos.impuestos.map((i) => i.id).join() === "4,1,21" && sin.catalogos.mediosPago.length === 4, "Factus: sincroniza los rangos REALES de la cuenta (solo de factura) y ofrece los códigos fijos de impuestos y medios de pago");
er = await lanza(() => ADAPTADORES.factus.probarConexionYSincronizar({ credenciales: credF, mapeo: MF, modo: "pruebas", fetch: servidor({ "POST /oauth/token": { status: 401, cuerpo: { error: "invalid_client", client_secret: "CSECRET-123456" } } }).f }));
ok(er.codigo === "credenciales" && er.estado === 401 && !JSON.stringify(er).includes("CSECRET-123456"), "credenciales malas: error claro y sin filtrar el secreto");
er = await lanza(() => ADAPTADORES.factus.emitirDocumento({ payload: payload({ tipoDocumento: "pos" }), credenciales: credF, mapeo: MF, modo: "pruebas", fetch: sv.f }));
ok(er && er.codigo === "no_soportado", "POS no mapeado: error claro ANTES de llamar al proveedor");
sv = servidor({ "POST /oauth/token": { cuerpo: { access_token: "T" } }, "GET /v1/numbering-ranges": { cuerpo: { data: [{ id: 9, prefix: "NC", document: "Nota Crédito" }] } }, "POST /v1/credit-notes/validate": { cuerpo: { data: { credit_note: { id: 5, number: "NC1", cufe: "CN" } } } } });
r = await ADAPTADORES.factus.anularDocumento({ documento: { idProveedor: "77", numero: "SETT1001", referencia: "CMD-c1" }, motivo: "Error", payload: p, credenciales: credF, mapeo: MF, modo: "pruebas", fetch: sv.f });
ok(r.numeroNota === "NC1" && sv.llamadas.at(-1).cuerpo.bill_id === 77 && sv.llamadas.at(-1).cuerpo.correction_concept_code === 2, "anula con Nota Crédito que referencia la factura");

console.log("\n── Alegra ──");
const MA = { resolucion: "41", impuestos: { inc: "31" }, mediosPago: { efectivo: "CASH", tarjeta: "CREDIT_CARD", transferencia: "TRANSFER_DEBIT_BANK" }, producto: "21" };
const credA = { correo: "dueno@resto.co", tokenApi: "TOKEN-ALEGRA-9999" };
sv = servidor({ "GET /api/v1/contacts": { cuerpo: [{ id: 11, identification: { number: "900123456" } }] }, "GET /api/v1/items": { cuerpo: [{ id: 21, name: "COMANDAS-CONSUMO" }] },
  "GET /api/v1/taxes": { cuerpo: [{ id: 31, name: "Impuesto al consumo", percentage: "8.00", type: "INC" }] }, "GET /api/v1/number-templates": { cuerpo: [{ id: 41, prefix: "SETT", documentType: "invoice", isElectronic: true }] },
  "POST /api/v1/invoices": { cuerpo: { id: 99, numberTemplate: { prefix: "SETT", fullNumber: "SETT55" }, stamp: { cufe: "CUFE-A" }, pdf: "https://pdf/a" } } });
r = await ADAPTADORES.alegra.emitirDocumento({ payload: p, credenciales: credA, mapeo: MA, modo: "pruebas", fetch: sv.f });
const inv = sv.llamadas.find((l) => l.clave === "POST /api/v1/invoices");
ok(r.numero === "SETT55" && r.cufe === "CUFE-A" && r.idProveedor === "99" && r.clienteId === "11", "emite y devuelve número, CUFE e id");
ok(inv.init.headers.Authorization === `Basic ${Buffer.from("dueno@resto.co:TOKEN-ALEGRA-9999").toString("base64")}` && inv.cuerpo.client === 11 && inv.cuerpo.numberTemplate.id === 41 && inv.cuerpo.items[0].id === 21 && inv.cuerpo.items[0].tax[0].id === 31 && inv.cuerpo.items[0].price === 10000 && inv.cuerpo.stamp.generateStamp === true, "autenticación básica, contacto, numeración por prefijo, ítem genérico, impuesto y precio SIN impuesto");
sv = servidor({ "GET /api/v1/contacts": { cuerpo: [{ id: 11, identification: { number: "900123456" } }] } });
er = await lanza(() => ADAPTADORES.alegra.emitirDocumento({ payload: p, credenciales: credA, mapeo: { ...MA, producto: "" }, modo: "pruebas", fetch: sv.f }));
ok(er && er.codigo === "configuracion" && /mapear/.test(er.message) && sv.llamadas.length === 0, "si falta mapear el ítem contable, dice qué elegir y NO llama al proveedor");

console.log("\n── Siigo ──");
const MS = { impuestos: { inc: "7" }, mediosPago: { efectivo: "3", tarjeta: "3", transferencia: "3" }, producto: "COMANDAS-CONSUMO", vendedor: "900" };
const credS = { usuarioApi: "api@resto.co", accessKey: "ACCESSKEY-SIIGO-0001", idTipoComprobante: "5113" };
sv = servidor({ "POST /auth": { cuerpo: { access_token: "TOK-S" } }, "GET /v1/customers": { cuerpo: { results: [{ branch_office: 0 }] } }, "GET /v1/products": { cuerpo: { results: [{ code: "COMANDAS-CONSUMO" }] } },
  "GET /v1/taxes": { cuerpo: [{ id: 7, name: "Impuesto al consumo INC", percentage: 8, type: "Consumo" }] }, "GET /v1/users": { cuerpo: { results: [{ id: 900, active: true }] } }, "GET /v1/payment-types": { cuerpo: [{ id: 3 }] },
  "POST /v1/invoices": { cuerpo: { id: "uuid-1", name: "FV-1-123", stamp: { cufe: "CUFE-S" }, mail: { status: "sent" } } } });
r = await ADAPTADORES.siigo.emitirDocumento({ payload: payload({ tipoDocumento: "pos" }), credenciales: credS, mapeo: MS, modo: "pruebas", fetch: sv.f });
const si = sv.llamadas.find((l) => l.clave === "POST /v1/invoices");
ok(r.numero === "FV-1-123" && r.cufe === "CUFE-S" && r.idProveedor === "uuid-1", "emite (incluido POS: lo decide el ID de comprobante)");
ok(sv.llamadas[0].cuerpo.username === "api@resto.co" && sv.llamadas[0].cuerpo.access_key === "ACCESSKEY-SIIGO-0001" && si.init.headers["Partner-Id"] && si.init.headers.Authorization === "Bearer TOK-S" && si.cuerpo.document.id === 5113 && si.cuerpo.seller === 900 && si.cuerpo.items[0].taxes[0].id === 7 && si.cuerpo.payments[0].value === 21600, "auth con usuario+access key, Partner-Id, ID de comprobante del dueño, vendedor, impuesto y pago");
sv = servidor({ "POST /auth": { cuerpo: { access_token: "T" } }, "GET /v1/document-types": { cuerpo: [{ id: 5113, code: "FV", name: "Factura de venta", active: true }, { id: 9, code: "X", name: "Inactivo", active: false }] },
  "GET /v1/taxes": { cuerpo: [{ id: 7, name: "Impuesto al consumo INC", percentage: 8, type: "Consumo" }, { id: 8, name: "IVA 19%", percentage: 19, type: "IVA" }] }, "GET /v1/products": { cuerpo: { results: [{ code: "SKU1", name: "Consumo" }] } },
  "GET /v1/users": { cuerpo: { results: [{ id: 900, first_name: "Ana", last_name: "Pérez", active: true }, { id: 901, active: false }] } }, "GET /v1/payment-types": { cuerpo: [{ id: 3, name: "Efectivo" }, { id: 4, name: "Tarjeta" }] } });
const ss = await ADAPTADORES.siigo.probarConexionYSincronizar({ credenciales: credS, modo: "pruebas", fetch: sv.f });
ok(ss.ok && ss.catalogos.resoluciones.length === 1 && ss.catalogos.impuestos.find((i) => i.id === "7").tipo === "INC" && ss.catalogos.impuestos.find((i) => i.id === "8").tipo === "IVA" && ss.catalogos.productos[0].id === "SKU1" && ss.catalogos.vendedores.length === 1 && ss.catalogos.mediosPago.length === 2, "Siigo: sincroniza comprobantes activos, impuestos clasificados, productos, vendedores activos y formas de pago");

console.log("\n── Dataico ──");
const MD = { impuestos: { inc: "IC" }, mediosPago: { efectivo: "CASH", tarjeta: "CREDIT_CARD", transferencia: "TRANSFER" } };
const credD = { authToken: "AUTH-DATAICO-5555", accountId: "acc-uuid" };
sv = servidor({ "POST /direct/dataico_api/v2/invoices": { cuerpo: { number: "SETT7", cufe: "CUFE-D", uuid: "u-1", pdf_url: "https://pdf/d" } } });
r = await ADAPTADORES.dataico.emitirDocumento({ payload: p, credenciales: credD, mapeo: MD, modo: "produccion", fetch: sv.f });
const di = sv.llamadas[0];
ok(r.numero === "SETT7" && r.cufe === "CUFE-D" && di.init.headers["Auth-token"] === "AUTH-DATAICO-5555" && di.cuerpo.invoice.env === "PRODUCCION" && di.cuerpo.invoice.dataico_account_id === "acc-uuid" && di.cuerpo.invoice.order_reference === "CMD-c1" && di.cuerpo.invoice.items[0].taxes[0].tax_rate === 8, "cabecera Auth-token, ambiente, cuenta, referencia idempotente e impuesto");
ok((await lanza(() => ADAPTADORES.dataico.emitirDocumento({ payload: payload({ tipoDocumento: "pos" }), credenciales: credD, mapeo: MD, modo: "pruebas", fetch: sv.f }))).codigo === "no_soportado", "POS no mapeado → error claro");

console.log("\n── Firebase administrador (cuenta de servicio, ETag) ──");
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const cuentaSrv = leerCuentaServicio(JSON.stringify({ client_email: "svc@p.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }));
const jwt = firmarJwt(cuentaSrv, 1_760_000_000_000); const [h, c, f] = jwt.split(".");
ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(f, "base64url")) && JSON.parse(Buffer.from(c, "base64url")).scope.includes("firebase.database"), "el JWT de la cuenta de servicio está bien firmado (RS256) con el alcance de base de datos");
ok((await lanza(() => leerCuentaServicio("no json"))) && (await lanza(() => leerCuentaServicio(""))) && (await lanza(() => leerCuentaServicio("{}"))), "una cuenta de servicio mala se rechaza con mensaje claro");
let valor = { estado: "x" }, etag = "e1"; const reg = [];
const fb = async (url, init = {}) => { reg.push({ url, init }); const m = init.method || "GET";
  if (m === "GET") return { ok: true, status: 200, headers: { get: () => etag }, json: async () => valor };
  if (init.headers && init.headers["if-match"] !== etag) return { ok: false, status: 412, json: async () => valor };
  valor = JSON.parse(init.body); etag = "e" + Math.random(); return { ok: true, status: 200, json: async () => valor }; };
const dba = crearDbAdmin({ databaseUrl: "https://x.firebaseio.com/", tokenAcceso: async () => "TOK", fetchFn: fb });
let rr = await dba.transaccion("facturacion/documentos/c1", (a) => ({ ...a, estado: "procesando" }));
ok(rr.committed && valor.estado === "procesando" && reg[1].init.headers["if-match"] === "e1" && reg[0].url.includes("access_token=TOK"), "la transacción escribe con If-Match del ETag leído");
let primera = true; const fb2 = async (u, i = {}) => { if (primera && i.method === "PUT") { primera = false; etag = "otro"; return { ok: false, status: 412, json: async () => ({}) }; } return fb(u, i); };
rr = await crearDbAdmin({ databaseUrl: "https://x.firebaseio.com", tokenAcceso: async () => "T", fetchFn: fb2 }).transaccion("a/b", (a) => ({ ...a, n: 1 }));
ok(rr.committed, "si otro escribió en medio (412), reintenta con el dato nuevo");
rr = await dba.transaccion("a/b", () => undefined);
ok(rr.committed === false, "si la función decide no escribir, no escribe");

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

// Pruebas de CONTRATO y CUADRE MATEMÁTICO de los adaptadores DIAN (Factus, Alegra, Siigo, Dataico). Sin red: `fetch` simulado.
//
// QUÉ SÍ DEMUESTRA: que el JSON que arma cada adaptador (a) trae los campos y tipos que se esperan de cada API y (b) suma, con la
// aritmética de ese proveedor y en centavos enteros, EXACTAMENTE lo que se cobró.
// QUÉ NO DEMUESTRA: que el esquema de abajo sea idéntico al oficial. Los esquemas se escribieron a partir de la documentación pública
// (leída solo en parte) y de la lista de campos acordada; NO se compararon contra un sandbox real ni contra el OpenAPI de cada proveedor.
// Si un proveedor cambia un campo, esta prueba seguirá pasando: hay que validar contra su sandbox (docs/FACTURACION_DIAN.md).
import { ADAPTADORES } from "../src/facturacion/adaptadores/index.js";
import { impuestoDeBase } from "../src/facturacion/adaptadores/interfaz.js";
import { construirPayload } from "./facturacion/payload.mjs";

let total = 0, fallas = 0, avisos = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };
const aviso = (t) => { avisos++; console.log(`⚠ ${t}`); };

/* ───────────── Mini validador de esquemas ───────────── */
const dec2 = (x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-7;
const TIPOS = {
  str: (v) => typeof v === "string" && v.length > 0, num: (v) => typeof v === "number" && Number.isFinite(v), int: (v) => Number.isInteger(v),
  bool: (v) => typeof v === "boolean", arr: (v) => Array.isArray(v), obj: (v) => v && typeof v === "object" && !Array.isArray(v),
  pos: (v) => typeof v === "number" && v > 0, dinero: (v) => typeof v === "number" && v >= 0 && dec2(v), pct: (v) => typeof v === "number" && v >= 0 && v <= 100,
  iso: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v), dmy: (v) => typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v),
  digitos: (v) => typeof v === "string" && /^\d+$/.test(v), tasa: (v) => typeof v === "string" && /^\d+\.\d{2}$/.test(v), cualquiera: () => true,
};
function validar(obj, esquema, ruta, errores) {
  for (const [campo, tipo] of Object.entries(esquema)) {
    const opcional = tipo.endsWith("?"), t = opcional ? tipo.slice(0, -1) : tipo, v = obj ? obj[campo] : undefined;
    if (v === undefined || v === null) { if (!opcional) errores.push(`${ruta}.${campo}: falta`); continue; }
    if (t.startsWith("enumn:")) { if (typeof v !== "number" || !t.slice(6).split("|").includes(String(v))) errores.push(`${ruta}.${campo}: ${JSON.stringify(v)} debe ser un número de [${t.slice(6)}]`); continue; }
    if (t.startsWith("enum:")) { if (typeof v !== "string") { errores.push(`${ruta}.${campo}: debe ser texto, llegó ${typeof v}`); continue; } if (!t.slice(5).split("|").includes(String(v))) errores.push(`${ruta}.${campo}: «${v}» no está en [${t.slice(5)}]`); continue; }
    if (!(TIPOS[t] || (() => false))(v)) errores.push(`${ruta}.${campo}: tipo/valor inválido (${JSON.stringify(v)} ≠ ${t})`);
  }
}
const noVacio = (arr, ruta, errores) => { if (!Array.isArray(arr) || arr.length === 0) { errores.push(`${ruta}: arreglo vacío o ausente`); return false; } return true; };

/* ───────────── Esquemas por proveedor ───────────── */
function esquemaFactus(b, { nit }) {
  const e = [];
  validar(b, { numbering_range_id: "int", reference_code: "str", observation: "str", payment_form: "enum:1|2", payment_method_code: "digitos", send_email: "bool", customer: "obj", items: "arr" }, "factus", e);
  if (b.customer) {
    validar(b.customer, { identification: "digitos", identification_document_id: "digitos", legal_organization_id: "enum:1|2", tribute_id: "digitos", ...(nit ? { dv: "digitos", company: "str" } : { names: "str" }) }, "factus.customer", e);
    if (!nit && b.customer.dv !== undefined) e.push("factus.customer.dv: solo se envía con NIT");
  }
  if (noVacio(b.items, "factus.items", e)) b.items.forEach((it, i) => {
    validar(it, { code_reference: "str", name: "str", quantity: "pos", discount_rate: "pct", price: "dinero", tax_rate: "tasa", unit_measure_id: "int", standard_code_id: "int", is_excluded: "enumn:0|1", tribute_id: "int", withholding_taxes: "arr" }, `factus.items[${i}]`, e);
    if (!Number.isInteger(it.quantity)) e.push(`factus.items[${i}].quantity: debe ser entero`);
    if (it.price === 0 && it.discount_rate !== 100) e.push(`factus.items[${i}]: precio 0 sin descuento del 100 % declarado`);
  });
  return e;
}
function esquemaAlegra(b) {
  const e = [];
  validar(b, { date: "iso", dueDate: "iso", items: "arr", paymentForm: "enum:CASH|CREDIT", paymentMethod: "enum:CASH|DEBIT_CARD|CREDIT_CARD|TRANSFER_DEBIT_BANK|TRANSFER_CREDIT_BANK|CHECK", stamp: "obj" }, "alegra", e);
  if (!(Number.isInteger(b.client) || (b.client && typeof b.client === "object" && (b.client.id || b.client.name)))) e.push("alegra.client: debe ser un id o un objeto con id/datos");
  if (!b.stamp || b.stamp.generateStamp !== true) e.push("alegra.stamp.generateStamp: debe ser true (timbrado DIAN)");
  if (noVacio(b.items, "alegra.items", e)) b.items.forEach((it, i) => {
    validar(it, { id: "int", price: "dinero", quantity: "pos", discount: "pct", tax: "arr" }, `alegra.items[${i}]`, e);
    (it.tax || []).forEach((t, k) => { if (!(Number.isInteger(t) || (t && Number.isInteger(t.id)))) e.push(`alegra.items[${i}].tax[${k}]: debe ser un id (o {id})`); });
    if (it.price === 0 && it.discount !== 100) e.push(`alegra.items[${i}]: precio 0 sin descuento del 100 % declarado`);
  });
  return e;
}
function esquemaSiigo(b) {
  const e = [];
  validar(b, { document: "obj", date: "iso", customer: "obj", seller: "int", items: "arr", payments: "arr" }, "siigo", e);
  if (b.document) validar(b.document, { id: "int" }, "siigo.document", e);
  if (b.customer) validar(b.customer, { identification: "digitos", branch_office: "int" }, "siigo.customer", e);
  if (noVacio(b.items, "siigo.items", e)) b.items.forEach((it, i) => {
    validar(it, { code: "str", quantity: "pos", price: "dinero", discount: "pct", taxes: "arr?" }, `siigo.items[${i}]`, e);
    (it.taxes || []).forEach((t, k) => { if (!t || !Number.isInteger(t.id)) e.push(`siigo.items[${i}].taxes[${k}].id: falta o no es entero`); });
    if (it.price === 0 && it.discount !== 100) e.push(`siigo.items[${i}]: precio 0 sin descuento del 100 % declarado`);
  });
  if (noVacio(b.payments, "siigo.payments", e)) b.payments.forEach((x, i) => validar(x, { id: "int", value: "dinero", due_date: "iso" }, `siigo.payments[${i}]`, e));
  return e;
}
function esquemaDataico(b, cabeceras) {
  const e = [];
  const h = Object.fromEntries(Object.entries(cabeceras || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (!h["auth-token"]) e.push("dataico.cabecera auth-token: falta");
  if (!h["dataico_account_id"]) e.push("dataico.cabecera dataico_account_id: falta");
  validar(b, { invoice: "obj", actions: "obj" }, "dataico", e);
  const i = b.invoice || {};
  validar(i, { env: "enum:PRUEBAS|PRODUCCION", dataico_account_id: "str", issue_date: "dmy", invoice_type_code: "enum:FACTURA_VENTA", payment_means: "enum:CASH|CREDIT_CARD|DEBIT_CARD|TRANSFER|CHECK", payment_means_type: "enum:DEBITO|CREDITO", numbering: "obj", customer: "obj", items: "arr" }, "dataico.invoice", e);
  if (i.numbering) validar(i.numbering, { resolution_number: "str", prefix: "str" }, "dataico.invoice.numbering", e);
  if (i.customer) validar(i.customer, { party_identification: "digitos", party_type: "enum:PERSONA_NATURAL|PERSONA_JURIDICA", tax_level_code: "str" }, "dataico.invoice.customer", e);
  if (h["dataico_account_id"] && i.dataico_account_id && h["dataico_account_id"] !== i.dataico_account_id) e.push("dataico: la cuenta de la cabecera y la del cuerpo no coinciden");
  if (noVacio(i.items, "dataico.invoice.items", e)) i.items.forEach((it, k) => {
    validar(it, { sku: "str", quantity: "pos", price: "dinero", discount_rate: "pct", taxes: "arr" }, `dataico.invoice.items[${k}]`, e);
    if (it.price === 0 && it.discount_rate !== 100) e.push(`dataico.items[${k}]: precio 0 sin descuento del 100 % declarado`);
  });
  return e;
}

/* ───────────── Aritmética de cada proveedor (centavos enteros) ───────────── */
const C = (x) => Math.round(x * 100);
const divRed = (n, d) => Math.floor((2 * n + d) / (2 * d));
const esPropina = (txt) => /propina voluntaria/i.test(String(txt || ""));
/** Devuelve { base, descuento, impuesto, propina, total } en centavos, con la fórmula (precio_base × cantidad) − descuentos + impuestos + propina de terceros. */
function cuadre(prov, b, { tasaDe }) {
  let base = 0, descuento = 0, impuesto = 0, propina = 0;
  const filas = prov === "dataico" ? b.invoice.items : b.items;
  for (const it of filas) {
    const cant = it.quantity, precio = it.price;
    if (prov === "factus") { // precio CON impuesto incluido: se extrae la base como lo hace el proveedor
      const lista = C(precio) * cant, desc = divRed(lista * (it.discount_rate || 0), 100), neto = lista - desc;
      const bp = Math.round(Number(it.tax_rate) * 100);
      if (esPropina(it.name)) { propina += neto; descuento += desc; base += 0; continue; }
      const bs = it.is_excluded || bp === 0 ? neto : divRed(neto * 10000, 10000 + bp);
      base += bs + desc; descuento += desc; impuesto += neto - bs; continue;
    }
    const pct = prov === "dataico" ? it.discount_rate : it.discount;
    const lista = C(precio) * cant, desc = divRed(lista * (pct || 0), 100), neto = lista - desc;
    const tasas = prov === "alegra" ? (it.tax || []).map((t) => tasaDe(t.id ?? t)) : prov === "siigo" ? (it.taxes || []).map((t) => tasaDe(t.id)) : (it.taxes || []).map((t) => Math.round(Number(t.tax_rate) * 100));
    if (esPropina(it.name || it.description)) { propina += neto; descuento += desc; continue; }
    base += lista; descuento += desc; impuesto += tasas.reduce((a, bp) => a + impuestoDeBase(neto, bp), 0);
  }
  return { base, descuento, impuesto, propina, total: base - descuento + impuesto + propina };
}

/* ───────────── Fetch simulado y captura del cuerpo de la factura ───────────── */
function servidor(rutas) {
  const llamadas = [];
  const f = async (url, init = {}) => {
    const u = new URL(url); const clave = `${init.method || "GET"} ${u.pathname}`;
    llamadas.push({ clave, url, init, cuerpo: init.body && (init.headers["Content-Type"] || "").includes("json") ? JSON.parse(init.body) : init.body });
    const h = rutas[clave];
    if (!h) return { ok: false, status: 404, text: async () => JSON.stringify({ message: `sin ruta ${clave}` }) };
    return { ok: true, status: 200, text: async () => JSON.stringify(h) };
  };
  return { f, llamadas };
}
const TASAS_ALEGRA = { 31: 800, 32: 1900 }, TASAS_SIIGO = { 71: 800, 72: 1900 };
const mocks = {
  factus: () => servidor({ "POST /oauth/token": { access_token: "T" }, "GET /v1/numbering-ranges": { data: [{ id: 8, prefix: "SETT", document: "Factura de Venta" }] }, "POST /v1/bills/validate": { data: { bill: { id: 1, number: "SETT1", cufe: "C" } } } }),
  alegra: () => servidor({ "GET /api/v1/contacts": [{ id: 11, identification: { number: "900123456" } }], "POST /api/v1/contacts": { id: 12 }, "GET /api/v1/items": [{ id: 21, name: "COMANDAS-CONSUMO" }],
    "GET /api/v1/taxes": [{ id: 31, name: "Impuesto al consumo", percentage: "8.00", type: "INC" }, { id: 32, name: "IVA", percentage: "19.00", type: "IVA" }], "GET /api/v1/number-templates": [{ id: 41, prefix: "SETT", documentType: "invoice", isElectronic: true }],
    "GET /api/v1/company": { name: "Mi Restaurante" }, "POST /api/v1/invoices": { id: 9, numberTemplate: { prefix: "SETT", fullNumber: "SETT1" }, stamp: { cufe: "C" } } }),
  siigo: () => servidor({ "POST /auth": { access_token: "T" }, "GET /v1/customers": { results: [] }, "POST /v1/customers": { id: "x" }, "GET /v1/products": { results: [{ code: "SKU-CONSUMO", name: "Consumo" }, { code: "SKU-PROPINA", name: "Propina" }] }, "GET /v1/document-types": [{ id: 5151, code: "FV", name: "Factura de venta", active: true }],
    "GET /v1/taxes": [{ id: 71, name: "Impuesto al consumo", percentage: 8, type: "INC" }, { id: 72, name: "IVA 19", percentage: 19, type: "IVA" }], "GET /v1/users": { results: [{ id: 5, active: true }] },
    "GET /v1/payment-types": [{ id: 3, name: "Efectivo" }, { id: 4, name: "Tarjeta" }, { id: 5, name: "Transferencia" }], "POST /v1/invoices": { id: "i1", name: "FV-1", stamp: { cufe: "C" } } }),
  dataico: () => servidor({ "GET /direct/dataico_api/v2/invoices": {}, "POST /direct/dataico_api/v2/invoices": { number: "SETT1", cufe: "C", uuid: "u" } }),
};
const RUTA_FACTURA = { factus: "POST /v1/bills/validate", alegra: "POST /api/v1/invoices", siigo: "POST /v1/invoices", dataico: "POST /direct/dataico_api/v2/invoices" };
const CRED = { factus: { clientId: "CID", clientSecret: "CSECRET-123456", usuario: "u@x.co", contrasena: "PWD-123456" }, alegra: { correo: "d@r.co", tokenApi: "TOKEN-9999" },
  siigo: { usuarioApi: "u@r.co", accessKey: "KEY-123456789", idTipoComprobante: "5151" }, dataico: { authToken: "AUTH-TOKEN-1", accountId: "ACC-123" } };
// IDs que el administrador eligió al sincronizar catálogos (CERO IDs quemados en los adaptadores).
const MEDIOS_CODIGOS = { factus: { efectivo: "10", tarjeta: "48", transferencia: "47" }, alegra: { efectivo: "CASH", tarjeta: "CREDIT_CARD", transferencia: "TRANSFER_DEBIT_BANK" }, siigo: { efectivo: "3", tarjeta: "4", transferencia: "5" }, dataico: { efectivo: "CASH", tarjeta: "CREDIT_CARD", transferencia: "TRANSFER" } };
const MAPEOS = {
  factus: { resolucion: "8", impuestos: { inc: "4", iva: "1", exento: "21" }, mediosPago: MEDIOS_CODIGOS.factus, propina: "PROPINA" },
  alegra: { resolucion: "41", impuestos: { inc: "31", iva: "32", exento: "33" }, mediosPago: MEDIOS_CODIGOS.alegra, producto: "21", propina: "22" },
  siigo: { impuestos: { inc: "71", iva: "72", exento: "73" }, mediosPago: MEDIOS_CODIGOS.siigo, producto: "SKU-CONSUMO", vendedor: "5", propina: "SKU-PROPINA" },
  dataico: { impuestos: { inc: "IC", iva: "IVA", exento: "EXENTO" }, mediosPago: MEDIOS_CODIGOS.dataico, propina: "PROPINA" },
};
const tasaDe = (prov) => (id) => (prov === "alegra" ? TASAS_ALEGRA : TASAS_SIIGO)[id];

async function capturar(prov, payload) {
  const sv = mocks[prov]();
  await ADAPTADORES[prov].emitirDocumento({ payload, credenciales: CRED[prov], mapeo: MAPEOS[prov], emisor: payload.emisor, modo: "pruebas", fetch: sv.f });
  const l = sv.llamadas.find((x) => x.clave === RUTA_FACTURA[prov]);
  return { cuerpo: l.cuerpo, cabeceras: l.init.headers };
}

/* ───────────── Datos de los escenarios ───────────── */
const AJ = (o = {}) => ({ modo: "pruebas", tipoDocumento: "factura", impuesto: "inc", precios: "incluyen", propina: "excluir", resolucion: { prefijo: "SETT", numero: "18760000001", desde: "1", hasta: "5000", vigenciaDesde: "2026-01-01", vigenciaHasta: "2027-12-31" }, ...o });
const NIT = { tipoDoc: "NIT", numero: "900123456", dv: "7", nombre: "Mi Empresa SAS", correo: "fac@empresa.co", direccion: "Calle 1 # 2-3" };
const TS = 1_760_000_000_000;
const it = (id, name, qty, price) => ({ id, name, qty, price });
function armar({ items, propina = 0, descuento = 0, datosFiscales = null, ajustes = {} }) {
  const cuenta = { id: "c1", mesa: 3, pagadaTs: TS, pagos: [{ monto: 1, metodoPago: "efectivo" }], datosFiscales, ...(propina ? { propina: { monto: propina } } : {}), ...(descuento ? { descuento: { monto: descuento } } : {}) };
  const pedidos = [{ estado: "listo", items }];
  const p0 = construirPayload({ cuenta, pedidos, ajustes: AJ(ajustes) });
  cuenta.pagos = [{ monto: p0.totales.totalCobrado, metodoPago: "efectivo" }]; // lo cobrado = lo que dice el motor; luego se verifica contra el proveedor
  return construirPayload({ cuenta, pedidos, ajustes: AJ(ajustes) });
}
const PROVS = ["factus", "alegra", "siigo", "dataico"];
const VALIDAR = { factus: (c, x) => esquemaFactus(c.cuerpo, x), alegra: (c) => esquemaAlegra(c.cuerpo), siigo: (c) => esquemaSiigo(c.cuerpo), dataico: (c) => esquemaDataico(c.cuerpo, c.cabeceras) };
const dinero = (c) => (c / 100).toLocaleString("es-CO", { minimumFractionDigits: 2 });

/** Corre un escenario en los 4 adaptadores: esquema + cuadre estricto. */
async function escenario(nombre, payload, { esperaPropina = false } = {}) {
  console.log(`\n── ${nombre} ──`);
  const sumaPagos = payload.pagos.reduce((a, x) => a + C(x.monto), 0), totalDoc = C(payload.totales.totalDocumento);
  ok(esperaPropina ? sumaPagos === totalDoc : sumaPagos >= totalDoc, `(motor) el total del documento ${dinero(totalDoc)} ${esperaPropina ? "= lo cobrado" : "≤ lo cobrado"} ${dinero(sumaPagos)}`);
  for (const prov of PROVS) {
    const cap = await capturar(prov, payload);
    const errores = VALIDAR[prov](cap, { nit: payload.cliente.tipoDoc === "NIT" });
    ok(errores.length === 0, `${prov}: el JSON cumple el esquema`, errores.join("\n    "));
    const c = cuadre(prov, cap.cuerpo, { tasaDe: tasaDe(prov) });
    const pagosSiigo = prov === "siigo" ? cap.cuerpo.payments.reduce((a, x) => a + C(x.value), 0) : totalDoc;
    ok(c.total === totalDoc && c.total - pagosSiigo === 0, `${prov}: cuadre exacto — (base ${dinero(c.base)}) − (desc ${dinero(c.descuento)}) + (imp ${dinero(c.impuesto)}) + (propina ${dinero(c.propina)}) = ${dinero(c.total)}; esperado ${dinero(totalDoc)}; diferencia ${c.total - totalDoc}`);
    if (esperaPropina) ok(c.propina === C(payload.totales.propina), `${prov}: la propina de terceros (${dinero(c.propina)}) viaja sin impuesto`);
  }
}

/* ═════════════ 1. Consumidor final ═════════════ */
const cf = armar({ items: [it("m1", "Almuerzo", 1, 17500), it("m2", "Jugo", 2, 8300)] });
await escenario("Venta a Consumidor Final (222222222222)", cf);
for (const prov of PROVS) {
  const { cuerpo } = await capturar(prov, cf);
  const id = prov === "dataico" ? cuerpo.invoice.customer.party_identification : prov === "factus" ? cuerpo.customer.identification : prov === "siigo" ? cuerpo.customer.identification : null;
  if (id !== null) ok(id === "222222222222", `${prov}: el cliente viaja con la identificación 222222222222`);
}
{ const sv = mocks.alegra(); await ADAPTADORES.alegra.emitirDocumento({ payload: cf, credenciales: CRED.alegra, mapeo: MAPEOS.alegra, modo: "pruebas", fetch: sv.f });
  ok(sv.llamadas.some((x) => x.clave === "GET /api/v1/contacts" && /identification=222222222222/.test(x.url)), "alegra: busca el contacto por la identificación 222222222222"); }

/* ═════════════ 2. INC 8 % incluido + propina como ingreso para terceros ═════════════ */
await escenario("INC 8 % incluido en el precio + propina para terceros ($17.500, $23.900, $8.300)",
  armar({ items: [it("m1", "Almuerzo ejecutivo", 3, 17500), it("m2", "Bandeja paisa", 2, 23900), it("m3", "Limonada", 3, 8300)], propina: 5000, datosFiscales: NIT, ajustes: { propina: "incluir" } }), { esperaPropina: true });

/* ═════════════ 3. Cortesía: descuento del 100 % ═════════════ */
{
  const todo = armar({ items: [it("m1", "Almuerzo", 2, 17500), it("m2", "Limonada", 1, 8300)], descuento: 17500 * 2 + 8300 });
  ok(todo.lineas.every((l) => l.total === 0 && l.brutoAntesDescuento > 0), "(motor) con descuento total las líneas quedan en 0 pero conservan su valor de lista");
  console.log("\n── Cortesía: la cuenta completa con descuento del 100 % ──");
  for (const prov of PROVS) {
    const cap = await capturar(prov, todo);
    const filas = prov === "dataico" ? cap.cuerpo.invoice.items : cap.cuerpo.items;
    const pct = (f) => (prov === "dataico" ? f.discount_rate : prov === "factus" ? f.discount_rate : f.discount);
    ok(filas.every((f) => f.price > 0 && pct(f) === 100), `${prov}: ningún ítem viaja con precio 0; todos declaran descuento del 100 %`);
    const errores = VALIDAR[prov](cap, { nit: false });
    ok(errores.length === 0, `${prov}: cumple el esquema`, errores.join("\n    "));
    const c = cuadre(prov, cap.cuerpo, { tasaDe: tasaDe(prov) });
    ok(c.total === 0 && c.descuento === c.base, `${prov}: cuadre exacto — descuento ${dinero(c.descuento)} = base ${dinero(c.base)}; total ${dinero(c.total)}`);
  }
  // Mezcla: un ítem de cortesía (100 %) junto a ítems normales. El motor reparte el descuento de la cuenta, así que se arma la línea a mano.
  const mix = armar({ items: [it("m1", "Almuerzo", 2, 17500), it("m2", "Postre", 1, 8300)] });
  const l2 = mix.lineas[1];
  mix.lineas[1] = { ...l2, descuento: l2.brutoAntesDescuento, base: 0, impuesto: 0, total: 0, precioUnitarioBase: 0 };
  const mixTot = mix.lineas.reduce((a, l) => a + C(l.total), 0);
  mix.totales = { ...mix.totales, descuento: l2.brutoAntesDescuento, baseGravable: mix.lineas.reduce((a, l) => a + l.base, 0), valorImpuesto: mix.lineas.reduce((a, l) => a + l.impuesto, 0), totalDocumento: mixTot / 100, totalCobrado: mixTot / 100 };
  console.log("\n── Cortesía: un ítem al 100 % junto a ítems normales ──");
  for (const prov of PROVS) {
    const cap = await capturar(prov, mix);
    const filas = prov === "dataico" ? cap.cuerpo.invoice.items : cap.cuerpo.items;
    const pct = (f) => (prov === "dataico" || prov === "factus" ? f.discount_rate : f.discount);
    const cero = filas.filter((f) => f.price === 0);
    ok(cero.length === 0 && filas.some((f) => pct(f) === 100), `${prov}: el ítem de cortesía lleva su precio de lista y descuento 100 % (sin precio 0 suelto)`);
    const c = cuadre(prov, cap.cuerpo, { tasaDe: tasaDe(prov) });
    ok(c.total === mixTot, `${prov}: cuadre exacto — ${dinero(c.total)} = ${dinero(mixTot)}`);
  }
}

/* ═════════════ 4. Otras reglas tributarias (IVA 19 %, precios que suman, exento) ═════════════ */
for (const [nombre, aj] of [["IVA 19 % ya incluido", { impuesto: "iva", precios: "incluyen" }], ["IVA 19 % sumado al subtotal", { impuesto: "iva", precios: "suman" }], ["INC 8 % sumado al subtotal", { impuesto: "inc", precios: "suman" }], ["Exento / no responsable (0 %)", { impuesto: "exento" }]]) {
  await escenario(`${nombre} + propina para terceros`, armar({ items: [it("m1", "Almuerzo", 3, 17500), it("m2", "Bandeja", 2, 23900), it("m3", "Limonada", 3, 8300)], propina: 3000, datosFiscales: NIT, ajustes: { ...aj, propina: "incluir" } }), { esperaPropina: true });
}
await escenario("Descuento parcial de la cuenta (INC 8 % incluido)", armar({ items: [it("m1", "Almuerzo", 3, 17500), it("m2", "Bandeja", 2, 23900), it("m3", "Limonada", 3, 8300)], descuento: 9999, ajustes: {} }));

/* ═════════════ 4a. Los IDs del documento salen del MAPEO del administrador, no del código ═════════════ */
console.log("\n── IDs mapeados por el administrador ──");
{
  const p = armar({ items: [it("m1", "Almuerzo", 3, 17500)], propina: 2000, datosFiscales: NIT, ajustes: { propina: "incluir" } });
  const f = (await capturar("factus", { ...p, pagos: [{ metodo: "tarjeta", monto: 1 }] })).cuerpo;
  ok(f.numbering_range_id === 8 && f.payment_method_code === "48" && f.items[0].tribute_id === 4 && f.items.at(-1).code_reference === "PROPINA", "factus: rango, medio de pago, tributo y código de propina vienen del mapeo");
  const a = (await capturar("alegra", { ...p, pagos: [{ metodo: "transferencia", monto: 1 }] })).cuerpo;
  ok(a.numberTemplate.id === 41 && a.items[0].id === 21 && a.items[0].tax[0].id === 31 && a.items.at(-1).id === 22 && a.items.at(-1).tax.length === 0 && a.paymentMethod === "TRANSFER_DEBIT_BANK", "alegra: numeración, ítem, impuesto, ítem de propina (sin impuesto) y medio de pago del mapeo");
  const si = (await capturar("siigo", { ...p, pagos: [{ metodo: "tarjeta", monto: 1 }] })).cuerpo;
  ok(si.seller === 5 && si.document.id === 5151 && si.items[0].code === "SKU-CONSUMO" && si.items[0].taxes[0].id === 71 && si.items.at(-1).code === "SKU-PROPINA" && !si.items.at(-1).taxes && si.payments[0].id === 4, "siigo: vendedor, comprobante, SKU, impuesto, SKU de propina y forma de pago del mapeo");
  const d = (await capturar("dataico", { ...p, pagos: [{ metodo: "tarjeta", monto: 1 }] })).cuerpo.invoice;
  ok(d.payment_means === "CREDIT_CARD" && d.items[0].taxes[0].tax_category === "IC" && d.items.at(-1).sku === "PROPINA" && d.items.at(-1).taxes.length === 0, "dataico: medio de pago, categoría de impuesto y SKU de propina del mapeo");
  for (const prov of PROVS) {
    let er = null; try { await ADAPTADORES[prov].emitirDocumento({ payload: p, credenciales: CRED[prov], mapeo: { ...MAPEOS[prov], impuestos: {} }, modo: "pruebas", fetch: mocks[prov]().f }); } catch (e) { er = e; }
    ok(er && er.codigo === "configuracion", `${prov}: sin mapear el impuesto no emite (error de configuración, sin llamar a la API de facturas)`);
  }
}

console.log("\n── Sincronización de catálogos (forma común) ──");
for (const prov of ["simulado", ...PROVS]) {
  const r = await ADAPTADORES[prov].probarConexionYSincronizar({ payload: null, credenciales: CRED[prov] || {}, modo: "pruebas", fetch: (prov === "simulado" ? null : mocks[prov]().f) });
  const cat = r.catalogos || {};
  const bien = ["resoluciones", "impuestos", "mediosPago", "productos", "vendedores"].every((k) => Array.isArray(cat[k]) && cat[k].every((i) => typeof i.id === "string" && i.id && typeof i.etiqueta === "string" && i.etiqueta));
  ok(r.ok === true && bien && cat.impuestos.length >= 2 && cat.mediosPago.length >= 3, `${prov}: devuelve catálogos con id y etiqueta (impuestos ${cat.impuestos.length}, medios de pago ${cat.mediosPago.length})`);
}

/* ═════════════ 4b. Dataico: nivel tributario del cliente (tax_level_code) ═════════════ */
console.log("\n── Dataico: tax_level_code ──");
for (const [cliente, esperado, texto] of [[NIT, "O-47", "persona jurídica sin dato → O-47"], [{ ...NIT, nivelTributario: "O-48" }, "O-48", "Responsable de IVA → O-48"], [{ ...NIT, nivelTributario: "O-47" }, "O-47", "O-47 explícito"],
  [{ tipoDoc: "CC", numero: "1032456789", nombre: "Ana Pérez", nivelTributario: "R-99-PN" }, "R-99-PN", "persona natural → R-99-PN"], [{ tipoDoc: "CC", numero: "1032456789", nombre: "Ana Pérez" }, "R-99-PN", "persona natural sin dato → R-99-PN"],
  [{ ...NIT, nivelTributario: "X-99" }, "O-47", "valor desconocido se ignora y usa el predeterminado"], [null, "R-99-PN", "consumidor final → R-99-PN"]]) {
  const cap = await capturar("dataico", armar({ items: [it("m1", "Almuerzo", 3, 17500)], datosFiscales: cliente }));
  ok(cap.cuerpo.invoice.customer.tax_level_code === esperado, `dataico: ${texto} (${cap.cuerpo.invoice.customer.tax_level_code})`);
}

/* ═════════════ 5. Barrido: ¿qué pasa con muchos precios impares? ═════════════ */
console.log("\n── Barrido de precios (INC 8 % incluido, cantidades 1 a 12) ──");
{
  const precios = [17500, 23900, 8300, 9900, 12700, 15500, 3300, 41900, 6700, 28100, 1900, 7900];
  let lineas = 0, factusMal = 0, sinResiduoMal = 0, conResiduo = 0, peorDif = 0; const ejemplos = [];
  for (const precio of precios) for (let q = 1; q <= 12; q++) {
    const p = armar({ items: [it("m1", "Plato", q, precio)] });
    lineas++;
    const t = C(p.totales.totalDocumento);
    const fc = await capturar("factus", p);
    if (cuadre("factus", fc.cuerpo, {}).total !== t) factusMal++;
    for (const prov of ["alegra", "siigo", "dataico"]) {
      const cap = await capturar(prov, p);
      const d = cuadre(prov, cap.cuerpo, { tasaDe: tasaDe(prov) }).total - t;
      if (d !== 0) { conResiduo++; peorDif = Math.max(peorDif, Math.abs(d)); if (ejemplos.length < 6 && prov === "alegra") ejemplos.push(`$${precio.toLocaleString("es-CO")} × ${q}: ${d > 0 ? "+" : ""}${d} centavo(s)`); }
    }
  }
  ok(factusMal === 0, `factus: ${lineas} combinaciones precio × cantidad cuadran exactas (precio con impuesto incluido)`);
  ok(peorDif <= 1, `alegra/siigo/dataico: ninguna diferencia supera 1 centavo (peor caso: ${peorDif})`);
  if (conResiduo > 0) aviso(`LÍMITE CONOCIDO: en ${conResiduo} de ${lineas * 3} combinaciones (proveedor × precio × cantidad) los proveedores que calculan el impuesto ELLOS MISMOS sobre la base (Alegra, Siigo, Dataico) no pueden sumar exactamente lo cobrado: con INC 8 % incluido no existe una base de 2 decimales cuyo impuesto redondeado complete justo el precio (ejemplos: ${ejemplos.join("; ")}). Aparece en ~7 % de los precios en pesos enteros cuando la fila tiene cantidad 1 y no se puede repartir. La diferencia es de 1 centavo y no se corrige desde la app; hay que confirmar en cada proveedor cómo redondea (ver docs/FACTURACION_DIAN.md).`);
  else ok(true, "sin diferencias de redondeo en ninguna combinación");
}

console.log(`\n${total - fallas}/${total} pruebas correctas${fallas ? ` · ${fallas} fallaron` : ""}${avisos ? ` · ${avisos} aviso(s) de límite conocido` : ""}.`);
process.exit(fallas ? 1 : 0);

// Pruebas del cliente de la función y del estado visible de una factura.
import { crearClienteFacturacion, ErrorReintentable } from "../src/facturacion/cliente.js";
import { estadoFactura, debeEmitirSola, debeReintentarSola, urlPdf, VENTANA_AUTOMATICA_MS } from "../src/facturacion/estado.js";
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };
const lanza = async (f) => { try { await f(); return null; } catch (e) { return e; } };
const resp = (status, cuerpo) => async () => ({ status, json: async () => { if (cuerpo === undefined) throw new Error("no json"); return cuerpo; } });
const cl = (fetchFn, tok = "T") => crearClienteFacturacion({ obtenerToken: async () => tok, fetchFn });

console.log("── Cliente ──");
let visto; const c1 = cl(async (u, i) => { visto = { u, i }; return { status: 200, json: async () => ({ ok: true }) }; });
const r = await c1.llamar({ accion: "emitir", cuentaId: "c1" });
ok(r.status === 200 && visto.u === "/.netlify/functions/facturacion" && visto.i.headers.Authorization === "Bearer T" && JSON.parse(visto.i.body).cuentaId === "c1", "envía el token y la solicitud a la función");
ok((await lanza(() => cl(async () => { throw new Error("offline"); }).llamar({}))) instanceof ErrorReintentable, "sin red → reintentable (la bandeja la guarda)");
for (const s of [401, 500, 502, 504]) ok((await lanza(() => cl(resp(s, {})).llamar({}))) instanceof ErrorReintentable, `HTTP ${s} → reintentable`);
for (const s of [400, 403, 404, 409, 503]) ok((await lanza(() => cl(resp(s, { ok: false })).llamar({}))) === null, `HTTP ${s} → respuesta definitiva (no se reintenta)`);
ok((await lanza(() => cl(resp(200, {}), "").llamar({}))) instanceof ErrorReintentable, "sin sesión → reintentable");
const noJson = await cl(resp(404, undefined)).llamar({});
ok(noJson.cuerpo.error === "no_disponible", "una página 404 de Netlify (función no desplegada) se explica, no revienta");

console.log("\n── Estado visible ──");
const e = (o) => estadoFactura(o);
ok(e({ doc: null }).clave === "ninguna" && e({ doc: null }).puedeEmitir, "sin documento: se puede emitir");
ok(e({ doc: null, enCola: true }).etiqueta === "Pendiente de envío (Sin consecutivo asignado)" && !e({ doc: null, enCola: true }).puedeEmitir, "en cola: «Pendiente de envío» y sin segundo botón (no duplica)");
ok(e({ doc: { estado: "procesando" } }).clave === "procesando" && !e({ doc: { estado: "procesando" } }).puedeEmitir, "enviando: sin botón");
const em = { estado: "emitida", numero: "SETT1" };
ok(e({ doc: em }).puedeReenviar && e({ doc: em }).puedeVerPdf && !e({ doc: em }).puedeAnular, "emitida + cajero: reenviar y PDF, SIN anular");
ok(e({ doc: em, esAdmin: true }).puedeAnular, "emitida + administrador: puede anular");
ok(e({ doc: { estado: "anulada", anulacion: { numeroNota: "NC1" } } }).detalle === "Nota crédito NC1" && !e({ doc: { estado: "anulada" }, esAdmin: true }).puedeAnular, "anulada: muestra la nota crédito y ya no se anula");
ok(e({ doc: { estado: "error", error: { mensaje: "Rechazado" } } }).puedeEmitir && e({ doc: { estado: "error", error: { mensaje: "x" } } }).tono === "error", "error definitivo: reintentar");
ok(!e({ doc: { estado: "error", error: { mensaje: "x", incierto: true } } }).puedeEmitir && e({ doc: { estado: "error", error: { mensaje: "x", incierto: true } }, esAdmin: true }).puedeEmitir, "error dudoso: solo el administrador puede reintentar");
ok(e({ doc: { estado: "emitida" }, enCola: true }).clave === "emitida", "si ya está emitida, manda el documento (aunque quede algo en cola)");

console.log("\n── Emisión automática ──");
const aj = { activa: true, emisionAutomatica: true }, cu = { estado: "pagada", pagadaTs: 1000000 };
ok(debeEmitirSola({ ajustes: aj, cuenta: cu, doc: null, enCola: false, ahora: 1000000 + 60000 }), "cuenta recién pagada con emisión automática: se emite");
ok(!debeEmitirSola({ ajustes: aj, cuenta: cu, doc: null, enCola: false, ahora: 1000000 + VENTANA_AUTOMATICA_MS + 1 }), "cuenta vieja: no se factura sola al activar la opción");
ok(!debeEmitirSola({ ajustes: aj, cuenta: cu, doc: { estado: "error" }, enCola: false, ahora: 1000000 + 1 }) && !debeEmitirSola({ ajustes: aj, cuenta: cu, doc: null, enCola: true, ahora: 1000001 }), "con documento (aunque sea error) o en cola: no repite sola");
ok(!debeEmitirSola({ ajustes: { activa: true, emisionAutomatica: false }, cuenta: cu, doc: null, enCola: false, ahora: 1000001 }) && !debeEmitirSola({ ajustes: { activa: false, emisionAutomatica: true }, cuenta: cu, doc: null, enCola: false, ahora: 1000001 }), "apagada: no emite");

console.log("\n── PDF ──");
ok(urlPdf({ pdfUrl: "https://prov/x.pdf" }, () => null) === "https://prov/x.pdf" && urlPdf({ pdfUrl: "javascript:alert(1)" }, () => null) === "" && urlPdf(null) === "", "solo enlaces https del proveedor (nunca javascript:)");
ok(urlPdf({ pdfSimulado: true }, () => new Uint8Array([37, 80])).startsWith("blob:"), "simulado: la app genera el PDF");


console.log("── Errores: reintento automático vs corrección (v23) ──");
const aj23 = { activa: true };
const errRed = { estado: "error", ts: 1000, intentosAuto: 0, error: { mensaje: "Sin conexión", clase: "red", reintentoAutomatico: true, incierto: false } };
ok(!debeReintentarSola({ ajustes: aj23, doc: errRed, ahora: 1000 + 29000 }) && debeReintentarSola({ ajustes: aj23, doc: errRed, ahora: 1000 + 30000 }), "error de red seguro: se reintenta solo a los 30 s, no antes");
ok(!debeReintentarSola({ ajustes: aj23, doc: { ...errRed, intentosAuto: 3 }, ahora: 9e9 }) && e({ doc: { ...errRed, intentosAuto: 3 } }).reintentosAgotados === true, "tras 3 intentos automáticos se detiene y queda para reintento manual");
const errDatos = { estado: "error", ts: 1000, error: { mensaje: "NIT inválido", clase: "datos", requiereCorreccion: true, reintentoAutomatico: false, accion: "Corrige los datos del cliente y pulsa «Reintentar emisión»." } };
ok(!debeReintentarSola({ ajustes: aj23, doc: errDatos, ahora: 9e9 }), "error de datos (NIT/correo): NO se reintenta solo");
const eD = e({ doc: errDatos, esAdmin: false });
ok(eD.puedeEmitir && eD.requiereCorreccion && eD.etiquetaReintento === "Reintentar emisión" && eD.detalle.includes("NIT inválido"), "error de datos: el cajero ve el motivo y puede «Reintentar emisión»");
ok(!debeReintentarSola({ ajustes: aj23, doc: { ...errRed, error: { ...errRed.error, incierto: true, reintentoAutomatico: false } }, ahora: 9e9 }), "error incierto: nunca se reintenta a ciegas (podría duplicar la factura)");
ok(!e({ doc: { estado: "error", error: { clase: "configuracion", mensaje: "Falta mapear" } }, esAdmin: false }).puedeEmitir && e({ doc: { estado: "error", error: { clase: "configuracion", mensaje: "Falta mapear" } }, esAdmin: true }).puedeEmitir, "error de configuración o credenciales: solo el administrador reintenta");
ok(!debeReintentarSola({ ajustes: aj23, doc: errRed, enCola: true, ahora: 9e9 }), "si hay una solicitud en cola no se duplica");

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

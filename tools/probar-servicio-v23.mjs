// v23 — servicio: catálogos sincronizados y mapeo, credenciales por ambiente (rotación), prueba de emisión, clasificación de errores,
// reintentos con la misma llave de idempotencia, reverso de la Nota Crédito para caja y fecha/hora original del cobro.
import { procesar, RUTAS } from "./facturacion/servicio.mjs";
import { crearDbMemoria } from "./facturacion/dbMemoria.mjs";
import { generarLlave, cargarLlave } from "./facturacion/cifrado.mjs";
import { ADAPTADORES } from "../src/facturacion/adaptadores/index.js";
import { ErrorProveedor } from "../src/facturacion/adaptadores/interfaz.js";
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };

const LLAVE = generarLlave();
const T0 = Date.UTC(2026, 10, 17, 15, 30, 0); // 17-nov-2026 10:30 en Bogotá
let reloj = T0, n = 0;
const EM = { razonSocial: "Café Dulce SAS", nit: "800197268", regimen: "responsable_iva", municipio: "Bogotá", codigoDane: "11001", correo: "facturas@cafe.co" };
const MAPEO_ALEGRA = { resolucion: "41", impuestos: { inc: "31" }, mediosPago: { efectivo: "CASH", tarjeta: "CREDIT_CARD", transferencia: "TRANSFER_DEBIT_BANK" }, producto: "21" };
function entorno({ ajustes = {}, extra = {}, adaptadores = ADAPTADORES } = {}) {
  const db = crearDbMemoria({
    perfiles: { adm: { activo: true, nombre: "Ana Admin", roles: { admin: true } }, caj: { activo: true, nombre: "Caro Cajera", roles: { cajero: true } } },
    cuentas: { c1: { estado: "pagada", mesa: 4, turnoId: "t9", pagadaTs: T0 - 3 * 3600 * 1000, pagos: [{ monto: 21600, metodoPago: "efectivo" }], datosFiscales: { tipoDoc: "CC", numero: "123456789", nombre: "Juan Pérez", correo: "juan@correo.co" } } },
    orders: { o1: { cuentaId: "c1", estado: "listo", items: [{ id: "m1", name: "Almuerzo", qty: 2, price: 10800 }] } },
    facturacion: { ajustes: { activa: true, modo: "pruebas", proveedor: "simulado", tipoDocumento: "factura", impuesto: "inc", precios: "incluyen", propina: "excluir", emisor: EM, ...ajustes } },
    ...extra,
  });
  const deps = { verificarToken: async (t) => ({ uid: t.slice(4) }), db, llave: () => cargarLlave(LLAVE), adaptadores, fetch: async () => { throw new Error("sin red"); }, ahora: () => reloj, nuevoId: () => String(++n) };
  return { db, deps, llamar: (sol, tok = "tok-adm") => procesar(sol, tok, deps) };
}
const CRED = { correo: "dueno@resto.co", tokenApi: "TOKEN-SECRETO-ABCD1234" };

console.log("── Sincronizar catálogos y mapear ──");
let e = entorno();
ok((await e.llamar({ accion: "sincronizar_catalogos" }, "tok-caj")).status === 403, "el cajero no sincroniza catálogos → 403");
let r = await e.llamar({ accion: "sincronizar_catalogos" });
ok(r.status === 200 && r.cuerpo.ok && r.cuerpo.catalogos.impuestos.length === 3 && r.cuerpo.catalogos.mediosPago.length === 3, "simulado devuelve catálogos realistas (impuestos, medios de pago…)");
ok((await e.db.leer(`${RUTAS.catalogo}/pruebas`)).productos.length === 2, "el catálogo queda guardado en el ambiente de Pruebas");
ok(!(await e.db.leer(`${RUTAS.catalogo}/produccion`)), "…y no en Producción");
ok((await e.llamar({ accion: "guardar_mapeo", mapeo: {} }, "tok-caj")).status === 403, "el cajero no guarda el mapeo → 403");
r = await e.llamar({ accion: "guardar_mapeo", mapeo: { resolucion: "sim-res-1", impuestos: { inc: "sim-inc" }, producto: "SIM-CONSUMO" } });
ok(r.status === 200 && r.cuerpo.completo === true, "mapeo del simulado guardado y completo (no exige medios de pago)");
ok((await e.db.leer(`${RUTAS.mapeo}/pruebas`)).impuestos.inc === "sim-inc", "el mapeo queda en su ambiente");
e = entorno({ ajustes: { proveedor: "alegra" } });
r = await e.llamar({ accion: "guardar_mapeo", mapeo: MAPEO_ALEGRA });
ok(r.status === 409 && r.cuerpo.error === "catalogo", "con un proveedor real, primero hay que sincronizar los catálogos");
const catAlegra = { resoluciones: [{ id: "41", etiqueta: "SETT" }], impuestos: [{ id: "31", etiqueta: "INC 8 %", porcentaje: 8, tipo: "INC" }], mediosPago: [{ id: "CASH" }, { id: "CREDIT_CARD" }, { id: "TRANSFER_DEBIT_BANK" }], productos: [{ id: "21" }, { id: "22" }], vendedores: [] };
const conAlegra = (extra = {}) => ({ ...ADAPTADORES, alegra: { ...ADAPTADORES.alegra, probarConexionYSincronizar: async () => ({ ok: true, mensaje: "ok", catalogos: catAlegra }), ...extra } });
e.deps.adaptadores = conAlegra();
await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", credenciales: CRED });
r = await e.llamar({ accion: "sincronizar_catalogos" });
ok(r.cuerpo.ok && r.cuerpo.mapeoCompleto === false && r.cuerpo.mapeoPendiente.producto, "al sincronizar avisa qué falta por mapear");
r = await e.llamar({ accion: "guardar_mapeo", mapeo: { ...MAPEO_ALEGRA, producto: "NO-EXISTE" } });
ok(r.cuerpo.ok && r.cuerpo.completo === false && /sincronizar/.test(r.cuerpo.pendiente.producto), "un ID que no existe en el catálogo se marca como pendiente");
r = await e.llamar({ accion: "guardar_mapeo", mapeo: MAPEO_ALEGRA });
ok(r.cuerpo.completo === true, "mapeo completo contra el catálogo real");
r = await e.llamar({ accion: "sincronizar_catalogos" });
ok(r.cuerpo.mapeoCompleto === true, "volver a sincronizar conserva el mapeo y confirma que sigue válido");

console.log("\n── Credenciales por ambiente y rotación ──");
e = entorno({ ajustes: { proveedor: "alegra" } }); e.deps.adaptadores = conAlegra();
await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", modo: "pruebas", credenciales: CRED });
await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", modo: "produccion", credenciales: { correo: "dueno@resto.co", tokenApi: "TOKEN-PRODUCCION-ZZZ9999" } });
ok((await e.db.leer(`${RUTAS.credencial}/pruebas`)).mascara === "••••1234" && (await e.db.leer(`${RUTAS.credencial}/produccion`)).mascara === "••••9999", "Sandbox y Producción tienen credenciales independientes");
ok(!!(await e.db.leer(`${RUTAS.secretos}/pruebas`)) && !!(await e.db.leer(`${RUTAS.secretos}/produccion`)), "cada ambiente tiene su espacio cifrado");
let visto = null;
e.deps.adaptadores = conAlegra({ probarConexionYSincronizar: async (x) => { visto = x; return { ok: true, mensaje: "ok", catalogos: catAlegra }; } });
await e.llamar({ accion: "sincronizar_catalogos", modo: "produccion" });
ok(visto.credenciales.tokenApi === "TOKEN-PRODUCCION-ZZZ9999" && visto.modo === "produccion", "al probar Producción se usan SOLO las llaves de Producción");
await e.llamar({ accion: "sincronizar_catalogos", modo: "pruebas" });
ok(visto.credenciales.tokenApi === "TOKEN-SECRETO-ABCD1234" && visto.modo === "pruebas", "y al probar Pruebas, las de Pruebas");
await e.llamar({ accion: "guardar_mapeo", modo: "pruebas", mapeo: MAPEO_ALEGRA });
await e.db.escribir(`${RUTAS.documentos}/histo1`, { estado: "emitida", numero: "SETT1", cuentaId: "histo1" });
r = await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", modo: "pruebas", credenciales: { correo: "nuevo@resto.co", tokenApi: "TOKEN-ROTADO-5555" } });
ok(r.cuerpo.ok && r.cuerpo.mascara === "••••5555" && r.cuerpo.catalogosReiniciados === false, "rotar las llaves del mismo proveedor funciona");
ok(!!(await e.db.leer(`${RUTAS.documentos}/histo1`)) && !!(await e.db.leer(`${RUTAS.mapeo}/pruebas`)) && !!(await e.db.leer(`${RUTAS.catalogo}/pruebas`)), "…sin borrar el historial de facturas ni el mapeo ni los catálogos");
ok(!JSON.stringify(e.db.volcar()).includes("TOKEN-ROTADO"), "la llave nueva tampoco queda en claro");
r = await e.llamar({ accion: "guardar_credenciales", proveedor: "siigo", modo: "pruebas", credenciales: { usuarioApi: "u@r.co", accessKey: "KEY-123456789", idTipoComprobante: "5151" } });
ok(r.cuerpo.catalogosReiniciados === true && !(await e.db.leer(`${RUTAS.mapeo}/pruebas`)) && !(await e.db.leer(`${RUTAS.catalogo}/pruebas`)), "cambiar de proveedor reinicia catálogos y mapeo de ESE ambiente (los IDs eran de otra cuenta)");
ok(!!(await e.db.leer(`${RUTAS.secretos}/produccion`)) && !!(await e.db.leer(`${RUTAS.documentos}/histo1`)), "…pero Producción y el historial siguen intactos");

console.log("\n── Prueba de emisión ──");
e = entorno();
ok((await e.llamar({ accion: "prueba_emision" }, "tok-caj")).status === 403, "el cajero no ejecuta la prueba de emisión → 403");
r = await e.llamar({ accion: "prueba_emision" });
ok(r.cuerpo.ok && r.cuerpo.prueba && r.cuerpo.numero && r.cuerpo.cufe.length >= 64, "simulado: ciclo completo con número y CUFE");
ok(Object.keys((await e.db.leer(RUTAS.documentos)) || {}).length === 0, "la prueba no deja documentos ni consume folios de cuentas reales");
ok(Object.values((await e.db.leer("auditoria")) || {}).some((a) => a.accion === "prueba_emision_fiscal"), "queda en la bitácora");
e = entorno({ ajustes: { proveedor: "alegra", modo: "produccion" } });
ok((await e.llamar({ accion: "prueba_emision" })).cuerpo.error === "produccion", "con un proveedor real, la prueba de emisión se niega en Producción");
e = entorno({ ajustes: { proveedor: "alegra" } });
await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", credenciales: CRED });
r = await e.llamar({ accion: "prueba_emision" });
ok(r.status === 409 && /mapear/.test(r.cuerpo.mensaje), "sin mapeo completo no se prueba: dice qué falta");
let ctxVisto = null;
e.deps.adaptadores = conAlegra({ emitirDocumento: async (x) => { ctxVisto = x; return { numero: "A1", prefijo: "SETT", cufe: "C".repeat(96), estadoProveedor: "ok" }; } });
await e.db.escribir(`${RUTAS.catalogo}/pruebas`, { ...catAlegra, ts: 1, proveedor: "alegra" });
await e.llamar({ accion: "guardar_mapeo", mapeo: MAPEO_ALEGRA });
r = await e.llamar({ accion: "prueba_emision" });
ok(r.cuerpo.ok && ctxVisto.mapeo.producto === "21" && ctxVisto.emisor.nit === "800197268" && ctxVisto.payload.cliente.numero === "222222222222" && ctxVisto.payload.cliente.correo === "facturas@cafe.co", "la prueba usa el mapeo, el emisor y un Consumidor Final con el correo del restaurante");

console.log("\n── Emisión con mapeo, errores clasificados y reintentos ──");
e = entorno({ ajustes: { proveedor: "alegra" } });
await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", credenciales: CRED });
const llamadas = []; let modoFalla = null;
const stub = { emitirDocumento: async (x) => { llamadas.push(x); if (modoFalla) throw modoFalla(); return { numero: "SETT7", prefijo: "SETT", cufe: "D".repeat(96), idProveedor: "77", estadoProveedor: "ok" }; }, anularDocumento: async (x) => ({ numeroNota: "NC7", cufeNota: "E".repeat(96), idProveedor: "n7" }) };
e.deps.adaptadores = conAlegra(stub);
r = await e.llamar({ accion: "emitir", cuentaId: "c1" }, "tok-caj");
ok(r.status === 409 && /mapear/.test(r.cuerpo.mensaje) && llamadas.length === 0, "sin mapeo: no se llama al proveedor y se dice qué falta");
await e.db.escribir(`${RUTAS.catalogo}/pruebas`, { ...catAlegra, ts: 1, proveedor: "alegra" });
await e.llamar({ accion: "guardar_mapeo", mapeo: MAPEO_ALEGRA });
modoFalla = () => new ErrorProveedor({ mensaje: "NIT inválido", estado: 422, detalle: "HTTP 422", incierto: false });
r = await e.llamar({ accion: "emitir", cuentaId: "c1" }, "tok-caj");
let doc = await e.db.leer(`${RUTAS.documentos}/c1`);
ok(r.cuerpo.ok === false && doc.estado === "error" && doc.error.clase === "datos" && doc.error.requiereCorreccion === true && doc.error.reintentoAutomatico === false, "422 → error de datos: el cajero debe corregir, sin reintento automático");
const ref = doc.referencia;
await e.db.parchar("cuentas/c1", { datosFiscales: { tipoDoc: "CC", numero: "987654321", nombre: "Juan Pérez", correo: "juan@correo.co" } });
modoFalla = null; reloj += 5000;
r = await e.llamar({ accion: "emitir", cuentaId: "c1" }, "tok-caj");
doc = await e.db.leer(`${RUTAS.documentos}/c1`);
ok(r.cuerpo.ok && doc.estado === "emitida" && doc.referencia === ref && doc.payload.cliente.numero === "987654321", "el cajero corrige el cliente y «Reintentar emisión» usa la MISMA llave (referencia) con los datos nuevos");
ok(llamadas.at(-1).mapeo.mediosPago.efectivo === "CASH" && llamadas.at(-1).emisor.razonSocial === "Café Dulce SAS", "el adaptador recibe el mapeo y los datos del emisor");
ok(doc.payload.fecha === "2026-11-17" && doc.payload.hora === "07:30:00", "fecha y hora del documento = momento ORIGINAL del cobro (07:30), no la hora en que se procesó");
// red caída ANTES de enviar (error seguro) → reintento automático
await e.db.escribir(`${RUTAS.documentos}/c1`, null);
modoFalla = () => new ErrorProveedor({ mensaje: "Sin conexión", estado: 0, incierto: false, codigo: "red" });
reloj += 1000; r = await e.llamar({ accion: "emitir", cuentaId: "c1" }, "tok-caj");
doc = await e.db.leer(`${RUTAS.documentos}/c1`);
ok(doc.estado === "error" && doc.error.clase === "red" && doc.error.reintentoAutomatico === true && doc.intentosAuto === 0, "red caída antes de enviar → se reintentará sola");
reloj += 31_000; r = await e.llamar({ accion: "emitir", cuentaId: "c1", reintentoAuto: true }, "tok-caj");
doc = await e.db.leer(`${RUTAS.documentos}/c1`);
ok(doc.intentosAuto === 1, "cuenta el intento automático");
// error incierto → no se reintenta a ciegas
modoFalla = () => new ErrorProveedor({ mensaje: "Se cortó", estado: 502, incierto: true });
reloj += 31_000; await e.llamar({ accion: "emitir", cuentaId: "c1", reintentoAuto: true }, "tok-caj");
doc = await e.db.leer(`${RUTAS.documentos}/c1`);
ok(doc.error.clase === "red" && doc.error.reintentoAutomatico === false && doc.error.incierto === true, "5xx tras enviar → incierto: NO se reintenta solo");
const antes = llamadas.length; modoFalla = null;
r = await e.llamar({ accion: "emitir", cuentaId: "c1", reintentoAuto: true }, "tok-caj");
ok(r.status === 409 && r.cuerpo.error === "revisar" && llamadas.length === antes, "un cajero no puede forzar el reintento de algo incierto (podría duplicar la factura)");
r = await e.llamar({ accion: "emitir", cuentaId: "c1", forzar: true }, "tok-adm");
ok(r.cuerpo.ok && (await e.db.leer(`${RUTAS.documentos}/c1`)).estado === "emitida", "el administrador, tras revisar el portal del proveedor, sí puede forzarlo");

console.log("\n── Anulación y caja ──");
r = await e.llamar({ accion: "anular", cuentaId: "c1", motivo: "Error en los datos del cliente" }, "tok-adm");
doc = await e.db.leer(`${RUTAS.documentos}/c1`);
ok(doc.estado === "anulada" && doc.anulacion.monto === Math.round(doc.totalDocumento) && doc.anulacion.turnoId === "t9" && doc.anulacion.pagos[0].metodo === "efectivo" && doc.anulacion.pagos[0].monto === 21600, "la anulación guarda monto, pagos y turno para el reverso en caja");

console.log(`\n${total - fallas}/${total} pruebas correctas${fallas ? ` · ${fallas} fallaron` : ""}.`);
process.exit(fallas ? 1 : 0);

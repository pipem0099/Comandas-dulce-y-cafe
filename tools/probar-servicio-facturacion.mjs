// Pruebas del servicio de facturación (seguridad, roles, idempotencia, cifrado en reposo) con base en memoria y adaptador simulado.
import { procesar, RUTAS } from "./facturacion/servicio.mjs";
import { crearDbMemoria } from "./facturacion/dbMemoria.mjs";
import { generarLlave, cargarLlave } from "./facturacion/cifrado.mjs";
import { ADAPTADORES } from "../src/facturacion/adaptadores/index.js";
import { ErrorProveedor } from "../src/facturacion/adaptadores/interfaz.js";
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };

const LLAVE = generarLlave();
let reloj = 1_760_000_000_000, n = 0;
function entorno({ ajustes = {}, adaptadores = ADAPTADORES, llave = LLAVE } = {}) {
  const db = crearDbMemoria({
    perfiles: { adm: { activo: true, nombre: "Ana Admin", roles: { admin: true } }, caj: { activo: true, nombre: "Caro Cajera", roles: { cajero: true } }, mes: { activo: true, nombre: "Meli", roles: { mesero: true } }, baja: { activo: false, nombre: "X", roles: { admin: true } } },
    cuentas: { c1: { estado: "pagada", mesa: 4, pagadaTs: reloj, propina: { monto: 1000 }, pagos: [{ monto: 22800, metodoPago: "tarjeta" }], datosFiscales: { tipoDoc: "CC", numero: "123456789", nombre: "Juan Pérez", correo: "juan@correo.co" } }, c2: { estado: "abierta", mesa: 5 } },
    orders: { o1: { cuentaId: "c1", estado: "listo", items: [{ id: "m1", name: "Almuerzo", qty: 2, price: 10800 }] } },
    facturacion: { ajustes: { activa: true, modo: "pruebas", proveedor: "simulado", tipoDocumento: "pos", impuesto: "inc", precios: "incluyen", propina: "excluir", ...ajustes } },
  });
  const deps = { verificarToken: async (t) => { if (!/^tok-/.test(t)) throw new Error("mal"); return { uid: t.slice(4) }; }, db, llave: () => cargarLlave(llave), adaptadores, fetch: async () => { throw new Error("sin red en pruebas"); }, ahora: () => reloj, nuevoId: () => String(++n) };
  return { db, deps, llamar: (sol, tok = "tok-caj") => procesar(sol, tok, deps) };
}
const contar = (adaptadores, id) => { let c = 0; const real = adaptadores[id]; return { adaptadores: { ...adaptadores, [id]: { ...real, emitirDocumento: async (x) => { c++; return real.emitirDocumento(x); } } }, veces: () => c }; };

console.log("── Sesión y permisos ──");
let e = entorno();
ok((await e.llamar({ accion: "emitir", cuentaId: "c1" }, "basura")).status === 401, "token inválido → 401");
ok((await e.llamar({ accion: "emitir", cuentaId: "c1" }, "tok-nadie")).status === 403, "usuario sin perfil → 403");
ok((await e.llamar({ accion: "emitir", cuentaId: "c1" }, "tok-baja")).status === 403, "perfil desactivado (aunque fue admin) → 403");
ok((await e.llamar({ accion: "emitir", cuentaId: "c1" }, "tok-mes")).status === 403, "mesero no factura → 403");
ok((await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", credenciales: {} }, "tok-caj")).status === 403, "cajero no guarda credenciales → 403");
ok((await e.llamar({ accion: "probar_conexion" }, "tok-caj")).status === 403, "cajero no prueba conexión → 403");
ok((await e.llamar({ accion: "inventada" }, "tok-adm")).status === 400, "acción desconocida → 400");
ok((await e.llamar({ accion: "emitir", cuentaId: "../perfiles" })).status === 400, "id de cuenta con ruta maliciosa → 400");

console.log("\n── Emisión con el adaptador simulado ──");
e = entorno();
let r = await e.llamar({ accion: "emitir", cuentaId: "c1" });
const doc = r.cuerpo.documento;
ok(r.status === 200 && r.cuerpo.ok && doc.estado === "emitida" && doc.numero && doc.cufe.length === 96, "cajero emite: estado «emitida» con número y CUFE");
ok(doc.payload.totales.totalDocumento === 21600 && doc.payload.totales.valorImpuesto === 1600 && doc.payload.totales.propina === 1000 && doc.payload.totales.propinaEnDocumento === false, "los montos se recalculan en el servidor (2 × $10.800 con INC incluido; propina fuera)");
ok(doc.payload.cliente.nombre === "Juan Pérez" && doc.payload.pagos[0].metodo === "tarjeta" && doc.payload.referencia === "CMD-c1", "cliente, método de pago y referencia idempotente en el payload");
const aud = Object.values((await e.db.leer("auditoria")) || {});
ok(aud.some((a) => a.accion === "emitir_factura" && a.uid === "caj" && a.cuentaId === "c1"), "la emisión queda en la bitácora");
ok((await e.llamar({ accion: "emitir", cuentaId: "c2" })).status === 409, "cuenta sin pagar → 409");
ok((await e.llamar({ accion: "emitir", cuentaId: "zzz" })).status === 404, "cuenta inexistente → 404");
e = entorno({ ajustes: { activa: false } });
ok((await e.llamar({ accion: "emitir", cuentaId: "c1" })).status === 409, "facturación apagada → 409");

console.log("\n── Idempotencia: nunca dos facturas por cuenta ──");
const cont = contar(ADAPTADORES, "simulado");
e = entorno({ adaptadores: cont.adaptadores });
const [a, b, c] = await Promise.all([1, 2, 3].map(() => e.llamar({ accion: "emitir", cuentaId: "c1" })));
ok(cont.veces() === 1, `3 solicitudes simultáneas → el proveedor se llama UNA vez (se llamó ${cont.veces()})`);
ok([a, b, c].filter((x) => x.status === 200 && x.cuerpo.ok).length >= 1 && [a, b, c].every((x) => x.status === 200 || x.status === 409), "las demás reciben el documento existente o «en proceso», nunca un error de servidor");
r = await e.llamar({ accion: "emitir", cuentaId: "c1" });
ok(r.status === 200 && r.cuerpo.repetido === true && cont.veces() === 1, "reintento posterior: devuelve el documento ya emitido, sin llamar al proveedor");
ok(Object.keys((await e.db.leer(RUTAS.documentos)) || {}).length === 1, "existe un único documento para la cuenta");

console.log("\n── Errores del proveedor ──");
const falla = (inc) => ({ ...ADAPTADORES, simulado: { ...ADAPTADORES.simulado, emitirDocumento: async () => { throw new ErrorProveedor({ mensaje: "Rechazado", estado: inc ? 0 : 422, incierto: inc, detalle: "detalle técnico" }); } } });
e = entorno({ adaptadores: falla(false) });
r = await e.llamar({ accion: "emitir", cuentaId: "c1" });
ok(r.status === 200 && r.cuerpo.ok === false && r.cuerpo.documento.estado === "error" && r.cuerpo.detalle === "detalle técnico", "rechazo definitivo: estado «error» con el detalle técnico");
e.deps.adaptadores = ADAPTADORES;
r = await e.llamar({ accion: "emitir", cuentaId: "c1" });
ok(r.cuerpo.ok && r.cuerpo.documento.estado === "emitida" && r.cuerpo.documento.intentos === 2 && !r.cuerpo.documento.error, "tras un rechazo definitivo se puede reintentar y queda emitida");
e = entorno({ adaptadores: falla(true) });
await e.llamar({ accion: "emitir", cuentaId: "c1" });
e.deps.adaptadores = ADAPTADORES;
r = await e.llamar({ accion: "emitir", cuentaId: "c1" });
ok(r.status === 409 && r.cuerpo.error === "revisar", "error dudoso: el cajero NO puede reintentar a ciegas (podría duplicar)");
r = await e.llamar({ accion: "emitir", cuentaId: "c1", forzar: true });
ok(r.status === 409, "el cajero tampoco puede forzar");
r = await e.llamar({ accion: "emitir", cuentaId: "c1", forzar: true }, "tok-adm");
ok(r.status === 200 && r.cuerpo.ok, "un administrador sí puede forzar tras revisar el portal");
e = entorno();
await e.db.escribir("facturacion/documentos/c1", { estado: "procesando", ts: reloj - 10 * 60 * 1000 });
r = await e.llamar({ accion: "emitir", cuentaId: "c1" });
ok(r.status === 409 && r.cuerpo.error === "revisar", "envío «procesando» abandonado hace 10 min: pide revisar, no reenvía");
await e.db.escribir("facturacion/documentos/c1", { estado: "procesando", ts: reloj - 1000 });
ok((await e.llamar({ accion: "emitir", cuentaId: "c1" })).cuerpo.error === "en_proceso", "envío en curso hace 1 s: «en proceso»");
e = entorno(); r = await (async () => { await e.db.escribir("cuentas/c1/datosFiscales/correo", "x@falla.test"); return e.llamar({ accion: "emitir", cuentaId: "c1" }); })();
ok(r.cuerpo.ok === false && r.cuerpo.documento.estado === "error", "el simulado rechaza con @falla.test (sirve para probar el flujo de error)");

console.log("\n── Anulación: solo administrador, con motivo ──");
e = entorno(); await e.llamar({ accion: "emitir", cuentaId: "c1" });
r = await e.llamar({ accion: "anular", cuentaId: "c1", motivo: "Error de digitación" }, "tok-caj");
ok(r.status === 403 && (await e.db.leer("facturacion/documentos/c1")).estado === "emitida", "cajero NO anula (403) y la factura sigue emitida");
r = await e.llamar({ accion: "anular", cuentaId: "c1", motivo: "  " }, "tok-adm");
ok(r.status === 400 && r.cuerpo.error === "motivo", "admin sin motivo → 400");
r = await e.llamar({ accion: "anular", cuentaId: "c1", motivo: "Cliente pidió otra razón social" }, "tok-adm");
ok(r.status === 200 && r.cuerpo.documento.estado === "anulada" && r.cuerpo.documento.anulacion.numeroNota && r.cuerpo.documento.anulacion.motivo.includes("razón social"), "admin anula con motivo: queda «anulada» con número de Nota Crédito");
ok(Object.values(await e.db.leer("auditoria")).some((x) => x.accion === "anular_factura" && x.uid === "adm" && /razón social/.test(x.motivo)), "la anulación queda en la bitácora con motivo y responsable");
r = await e.llamar({ accion: "anular", cuentaId: "c1", motivo: "Otra vez por favor" }, "tok-adm");
ok(r.status === 409, "no se anula dos veces");
r = await e.llamar({ accion: "emitir", cuentaId: "c1" });
ok(r.cuerpo.repetido && r.cuerpo.documento.estado === "anulada", "una cuenta anulada no se vuelve a facturar sola");
e = entorno(); ok((await e.llamar({ accion: "anular", cuentaId: "c1", motivo: "Un motivo largo" }, "tok-adm")).status === 409, "no se anula lo que nunca se emitió");

console.log("\n── Reenviar por correo ──");
e = entorno(); await e.llamar({ accion: "emitir", cuentaId: "c1" });
r = await e.llamar({ accion: "reenviar_correo", cuentaId: "c1" });
ok(r.status === 200 && r.cuerpo.documento.ultimoCorreo.a === "juan@correo.co", "reenvía al correo del cliente");
ok((await e.llamar({ accion: "reenviar_correo", cuentaId: "c1", correo: "malo" })).status === 400, "correo inválido → 400");
e = entorno(); ok((await e.llamar({ accion: "reenviar_correo", cuentaId: "c1" })).status === 409, "sin factura emitida no hay qué reenviar");

console.log("\n── Credenciales: cifradas en reposo, nunca devueltas ──");
e = entorno({ ajustes: { proveedor: "alegra", tipoDocumento: "factura" } });
r = await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", credenciales: { correo: "dueno@resto.co", tokenApi: "TOKEN-SECRETO-ABCD1234" } }, "tok-adm");
ok(r.status === 200 && r.cuerpo.mascara === "••••1234", "guarda y responde solo «••••1234»");
ok(!JSON.stringify(r.cuerpo).includes("SECRETO") && !JSON.stringify(r.cuerpo).includes("dueno@"), "la respuesta no contiene ningún secreto");
const volcado = JSON.stringify(e.db.volcar());
ok(!volcado.includes("TOKEN-SECRETO") && !volcado.includes("dueno@resto.co"), "en la base de datos NO hay ningún secreto en claro (ni el correo)");
ok((await e.db.leer(`${RUTAS.credencial}/pruebas`)).mascara === "••••1234" && !("datos" in (await e.db.leer(`${RUTAS.credencial}/pruebas`))), "la rama visible solo tiene proveedor y máscara");
r = await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", credenciales: { correo: "x" } }, "tok-adm");
ok(r.status === 400 && r.cuerpo.errores.tokenApi, "credenciales incompletas → 400 con el campo");
let visto = null;
const espia = { ...ADAPTADORES, alegra: { ...ADAPTADORES.alegra, probarConexionYSincronizar: async (x) => { visto = x; return { ok: true, mensaje: "ok" }; } } };
e.deps.adaptadores = espia;
r = await e.llamar({ accion: "probar_conexion" }, "tok-adm");
ok(r.cuerpo.ok && visto.credenciales.tokenApi === "TOKEN-SECRETO-ABCD1234" && !JSON.stringify(r.cuerpo).includes("SECRETO"), "probar conexión: el servidor descifra y usa el secreto, pero no lo devuelve");
e.deps.adaptadores = { ...ADAPTADORES, alegra: { ...ADAPTADORES.alegra, probarConexionYSincronizar: async () => { throw new ErrorProveedor({ mensaje: "401", estado: 401, detalle: "HTTP 401 GET /company → no autorizado" }); } } };
r = await e.llamar({ accion: "probar_conexion" }, "tok-adm");
ok(r.status === 200 && r.cuerpo.ok === false && r.cuerpo.detalle.includes("HTTP 401"), "probar conexión fallida: devuelve el detalle técnico del proveedor al administrador");
e.deps.llave = () => cargarLlave(generarLlave());
r = await e.llamar({ accion: "probar_conexion" }, "tok-adm");
ok(r.cuerpo.ok === false && r.cuerpo.error === "cifrado", "si cambia la llave maestra, avisa que hay que volver a guardar (no se rompe)");
e = entorno({ ajustes: { proveedor: "alegra", tipoDocumento: "factura" }, llave: "" });
r = await e.llamar({ accion: "guardar_credenciales", proveedor: "alegra", credenciales: { correo: "a@b.co", tokenApi: "token-largo-12345" } }, "tok-adm");
ok(r.status === 503 && /CLAVE_CIFRADO_FACTURACION/.test(r.cuerpo.mensaje), "sin llave maestra en Netlify: 503 con mensaje claro (y no guarda nada)");
ok(!(await e.db.leer(`${RUTAS.secretos}/pruebas`)), "…y no se guardó nada en claro");
e = entorno({ ajustes: { proveedor: "factus", tipoDocumento: "factura" } });
r = await e.llamar({ accion: "emitir", cuentaId: "c1" });
ok(r.status === 409, "proveedor real sin credenciales guardadas: no se activa ni emite");

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

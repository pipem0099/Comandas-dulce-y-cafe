import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut } from "firebase/auth";
import { getDatabase, ref, onValue, get, query, orderByChild, startAt, equalTo, set, update, remove, increment, runTransaction } from "firebase/database";
import { uid as nuevoId } from "./logica.js";
import { almacenIndexedDB } from "./sinConexion/almacen.js";
import { crearBandeja } from "./sinConexion/bandeja.js";
import { crearEspejo } from "./sinConexion/espejo.js";
import { aplicarPendientes } from "./sinConexion/superposicion.js";
import { fusionar } from "./sinConexion/fusion.js";
import { crearClienteFacturacion, ErrorReintentable } from "./facturacion/cliente.js";

/*
 * ───────────────────────────────────────────────────────────
 *  CONFIGURACIÓN DE FIREBASE (una por negocio)
 * ───────────────────────────────────────────────────────────
 *  Cada negocio usa SU PROPIO proyecto de Firebase. La configuración se lee de variables de
 *  entorno (en Netlify: Site configuration → Environment variables; en tu computador: archivo
 *  .env, ver .env.example). Pasos completos en docs/INSTALACION.md.
 *
 *  IMPORTANTE: al crear la base de datos NO elijas "modo de prueba" (deja todo abierto al
 *  mundo). Elige "modo bloqueado" y publica de inmediato el archivo database.rules.json.
 *
 *  Si no hay variables de entorno se usa la configuración de abajo (la de este negocio).
 *  Al entregar el proyecto a otro negocio, BORRA ese objeto y deja solo las variables.
 * ───────────────────────────────────────────────────────────
 */
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const configDeEntorno = env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_DATABASE_URL ? {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
} : null;
// <<CONFIG-DE-RESPALDO-INICIO>>
const configDeRespaldo = {
  apiKey: "AIzaSyBOxKCrmZs_Osa7_TRpcndE9i69hJASYGE",
  authDomain: "dulce-y-cafe-dabf3.firebaseapp.com",
  databaseURL: "https://dulce-y-cafe-dabf3-default-rtdb.firebaseio.com",
  projectId: "dulce-y-cafe-dabf3",
  storageBucket: "dulce-y-cafe-dabf3.firebasestorage.app",
  messagingSenderId: "354247335288",
  appId: "1:354247335288:web:fe5be065ce836a50797c8d",
};
// <<CONFIG-DE-RESPALDO-FIN>>
const firebaseConfig = configDeEntorno || configDeRespaldo;
if (!firebaseConfig) {
  const aviso = "Falta la configuración de Firebase de este negocio. Cárgala en las variables de entorno (ver docs/INSTALACION.md).";
  if (typeof document !== "undefined") document.body.innerHTML = `<div style="font-family:system-ui;padding:32px;max-width:480px;margin:10vh auto;line-height:1.5"><h2>Falta configurar la app</h2><p>${aviso}</p></div>`;
  throw new Error(aviso);
}

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  TRABAJO SIN CONEXIÓN
 * ─────────────────────────────────────────────────────────────────────────
 *  · Copia local ("espejo") de lo último que mandó el servidor: la app abre con datos aunque no haya internet.
 *  · Bandeja de cambios pendientes: lo que se hace sin internet (pedidos, cobros, turnos...) se guarda en el equipo, se ve de inmediato
 *    y se envía solo, en orden, al volver la conexión. Las cuentas se fusionan con lo que pasó en el servidor (ver sinConexion/fusion.js);
 *    si hay un choque grave (ej. la cuenta ya se cerró desde otro dispositivo) NO se aplica y queda para revisión.
 *  Límite honesto: sin internet los dispositivos no se ven entre sí (la cocina no recibe el pedido hasta que vuelva la conexión).
 */
const almacenLocal = almacenIndexedDB();
const bandeja = crearBandeja({ almacen: almacenLocal });
const espejo = crearEspejo({ almacen: almacenLocal });
const bandejaLista = bandeja.iniciar().catch((e) => console.error("No se pudo leer la bandeja local:", e));
const clienteFacturacion = crearClienteFacturacion({ obtenerToken: () => obtenerIdToken() });
let conectado = typeof navigator === "undefined" ? true : navigator.onLine !== false; // hasta que Firebase confirme
const escuchasConexion = new Set();
const suscripciones = new Set();   // listas abiertas: cada una sabe volver a pintarse con los pendientes encima
const estadoConexion = () => ({ conectado, ...bandeja.resumen() });
const avisarConexion = () => { const e = estadoConexion(); escuchasConexion.forEach((f) => f(e)); };
export const estaConectado = () => conectado;
/** cb({ conectado, pendientes, conflictos, sincronizando }) cada vez que algo cambie. */
export function observarConexion(cb) { escuchasConexion.add(cb); cb(estadoConexion()); return () => escuchasConexion.delete(cb); }
bandeja.alCambiar(() => { avisarConexion(); suscripciones.forEach((sub) => sub.emitir()); });
export const conflictosSinConexion = () => bandeja.conflictos();
export const descartarConflictoSinConexion = (id) => bandeja.descartarConflicto(id);
export async function reintentarConflictoSinConexion(id) { await bandeja.reintentarConflicto(id); return drenarBandeja(); }
export const sincronizarAhora = () => drenarBandeja();

/* ── Facturación electrónica: emitir con cola sin internet ─────────────────────────────────────── */
/** ids de cuenta con una emisión guardada en este equipo esperando internet. */
export const facturasEnCola = () => new Set(bandeja.pendientes().filter((o) => o.tipo === "facturacion" && o.accion === "emitir").map((o) => o.cuentaId));
/** Llamada directa (anular, reenviar, probar conexión…). Lanza ErrorReintentable si no hay conexión. */
export const solicitarFacturacion = (solicitud) => clienteFacturacion.llamar(solicitud);
/**
 * Emite la factura de una cuenta. Sin internet (o si la red falla a mitad) la solicitud queda en la bandeja como «Pendiente de envío»
 * y se ejecuta sola al volver la conexión, sin duplicar (la bandeja no repite la misma cuenta y el servidor es idempotente).
 * Devuelve { enCola: true } o { status, cuerpo }.
 */
export async function emitirFacturaCuenta(cuentaId, extra = {}) {
  await bandejaLista;
  if (facturasEnCola().has(cuentaId)) return { enCola: true };
  const encolar = async () => { await encolarSinConexion({ tipo: "facturacion", accion: "emitir", cuentaId, ruta: `facturacion/documentos/${cuentaId}` }); return { enCola: true }; };
  if (!conectado) return encolar();
  try { return await clienteFacturacion.llamar({ accion: "emitir", cuentaId, ...extra }); }
  catch (e) { if (e instanceof ErrorReintentable) return encolar(); throw e; }
}
if (typeof window !== "undefined") window.addEventListener("pagehide", () => { espejo.volcarTodo(); });

const esErrorDePermiso = (e) => String((e && e.code) || e || "").toUpperCase().includes("PERMISSION");
const clonar = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
async function encolarSinConexion(op) { await bandejaLista; await bandeja.encolar(op); return true; }
function leerLocal(ruta) {
  const [col, id] = String(ruta).split("/");
  let hallado;
  suscripciones.forEach((sub) => { if (sub.coleccion === col && sub.visible.has(id)) hallado = sub.visible.get(id); });
  return hallado;
}

/** Cómo se reenvía cada tipo de cambio al volver el internet. */
async function ejecutarOp(op) {
  try {
    switch (op.tipo) {
      case "set": await set(ref(db, op.ruta), op.valor); return { ok: true };
      case "mezclar": await update(ref(db, op.ruta), op.parche); return { ok: true };
      case "borrar": await remove(ref(db, op.ruta)); return { ok: true };
      case "incremento": await update(ref(db), { [op.ruta]: increment(op.delta) }); return { ok: true };
      case "pedidoStock": {
        const ya = await get(ref(db, `orders/${op.pedido.id}`));
        if (ya.exists()) return { ok: true }; // ya había llegado (se cortó justo antes de confirmarse): no se descuenta el inventario dos veces
        const cambios = { [`orders/${op.pedido.id}`]: op.pedido };
        Object.entries(op.deltas || {}).forEach(([insumoId, d]) => { if (d) cambios[`inventario/${insumoId}/stock`] = increment(d); });
        await update(ref(db), cambios);
        return { ok: true };
      }
      case "registro": {
        const refReg = ref(db, op.ruta);
        const actual = (await get(refReg)).val();
        if (actual === null) {
          if (op.base) return { conflicto: { motivo: "borrado-en-servidor", mensaje: "Ese registro ya no existe en el servidor." } };
          await set(refReg, op.nuevo); return { ok: true };
        }
        let f = null;
        const res = await runTransaction(refReg, (remoto) => {
          if (remoto === null) return remoto; // suposición vacía del SDK: se reintenta con el valor real
          f = fusionar(op.base, op.nuevo, remoto);
          return f.aplicable ? sanitizeForFirebase(f.valor) : undefined;
        });
        if (f && !f.aplicable) return { conflicto: { motivo: (f.conflictos.find((c) => c.grave) || {}).motivo || "choque", conflictos: f.conflictos } };
        if (!res.committed) throw new Error("sin confirmar");
        return { ok: true, avisos: f ? f.conflictos : [] };
      }
      case "facturacion": {
        // Emitir una factura que se pidió sin internet. El servidor es idempotente por cuenta: si la solicitud ya había llegado, devuelve la factura existente.
        const r = await clienteFacturacion.llamar({ accion: op.accion, cuentaId: op.cuentaId });
        if (r.status === 403) return { conflicto: { motivo: "sin-permiso", mensaje: "Esta cuenta no tiene permiso para facturar." } };
        if (r.status === 503 || (r.cuerpo && r.cuerpo.error === "no_disponible")) return { conflicto: { motivo: "facturacion-no-disponible", mensaje: (r.cuerpo && r.cuerpo.mensaje) || "La facturación electrónica no está disponible en el servidor." } };
        return { ok: true }; // 200 (emitida, o rechazada por el proveedor: queda visible en la cuenta) o 4xx: ya no hay nada que reintentar
      }
      default: return { conflicto: { motivo: "tipo-desconocido" } };
    }
  } catch (e) {
    if (esErrorDePermiso(e)) return { conflicto: { motivo: "sin-permiso", mensaje: "Esta cuenta no tiene permiso para guardar ese cambio." } };
    throw e;
  }
}
let reintentoProgramado = null;
async function drenarBandeja() {
  if (!conectado || !auth.currentUser) return;
  await bandejaLista;
  if (bandeja.pendientes().length === 0) return;
  const r = await bandeja.drenar(ejecutarOp);
  if (r && r.detenido && !reintentoProgramado) { reintentoProgramado = setTimeout(() => { reintentoProgramado = null; drenarBandeja(); }, 5000); }
  return r;
}
/* Al abrir la app, Firebase dice «desconectado» unos instantes mientras abre su conexión, aunque haya internet. Eso NO es estar sin internet:
 * durante los primeros segundos (y solo si el equipo sí tiene red) no se toma como desconexión, para no mostrar el aviso ni guardar en la bandeja
 * cosas que Firebase puede enviar enseguida. Si pasado ese tiempo sigue sin conectar, entonces sí se considera sin internet. */
const GRACIA_ARRANQUE_MS = 4000;
const horaArranque = Date.now();
let hubo = false, ultimoReal = conectado, revisionArranque = null;
onValue(ref(db, ".info/connected"), (snap) => {
  const real = snap.val() === true;
  ultimoReal = real;
  if (real) hubo = true;
  const redEquipo = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  if (!real && !hubo && redEquipo && Date.now() - horaArranque < GRACIA_ARRANQUE_MS) {
    if (!revisionArranque) revisionArranque = setTimeout(() => { revisionArranque = null; if (!hubo) { conectado = ultimoReal; avisarConexion(); } }, GRACIA_ARRANQUE_MS - (Date.now() - horaArranque) + 50);
    return;
  }
  conectado = real; avisarConexion(); if (conectado) drenarBandeja();
});

/** Lista en vivo con copia local y con los cambios pendientes encima. Entrega siempre un array al callback. */
function suscribirLista({ coleccion, clave, consulta, alError, alLlegar, callback }) {
  let ultimo = null, llegoServidor = false;
  const sub = { coleccion, visible: new Map(), emitir };
  function emitir() {
    if (ultimo === null) return;
    const visible = aplicarPendientes(bandeja.pendientes(), coleccion, ultimo);
    sub.visible = new Map(visible.filter(Boolean).map((r) => [String(r.id), r]));
    callback(visible);
  }
  suscripciones.add(sub);
  espejo.leer(clave).then((c) => { if (!llegoServidor && c && Array.isArray(c.valor)) { ultimo = c.valor; emitir(); } });
  // Si Firebase cancela la suscripción por un error (permiso o red), ya no vuelve a avisar: se reintenta sola con espera creciente.
  // Mientras tanto se conservan los últimos datos buenos (antes se vaciaba la lista y parecía que "no había pedidos").
  let quitar = null, cancelado = false, espera = 3000, temporizador = null;
  function conectar() {
    quitar = onValue(
      consulta,
      (snapshot) => {
        const val = snapshot.val();
        llegoServidor = true; espera = 3000;
        ultimo = alLlegar ? alLlegar(val) : (val ? Object.values(val) : []);
        espejo.guardar(clave, ultimo);
        emitir();
      },
      (error) => {
        console.error(alError, error);
        llegoServidor = true;
        if (ultimo === null) { ultimo = []; emitir(); }
        quitar = null;
        if (cancelado) return;
        temporizador = setTimeout(() => { temporizador = null; if (!cancelado) conectar(); }, espera);
        espera = Math.min(espera * 2, 60000);
      }
    );
  }
  conectar();
  return () => { cancelado = true; suscripciones.delete(sub); if (temporizador) clearTimeout(temporizador); if (quitar) quitar(); };
}
/** Prueba de que quien llama es quien dice ser (para funciones del servidor). Vacío si no hay sesión. */
export async function obtenerIdToken() {
  try { return auth.currentUser ? await auth.currentUser.getIdToken() : ""; } catch (e) { return ""; }
}

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  CUENTAS DE USUARIO (protegen la base de datos)
 * ─────────────────────────────────────────────────────────────────────────
 * Cada persona del equipo entra con SU correo y SU clave (Firebase
 * Authentication). Su rol (admin, mesero, cajero, cocina) y si está activa
 * viven en `perfiles/{uid}`, y las reglas de la base de datos
 * (database.rules.json) se apoyan en eso: sin perfil activo no se puede leer
 * ni escribir nada, y cada rol solo puede escribir lo que le corresponde.
 */

/** Avisa cuando hay sesión iniciada (usuario de Firebase) o no (null). */
export function observarSesion(callback) {
  return onAuthStateChanged(auth, (user) => { if (user) setTimeout(drenarBandeja, 0); callback(user || null); });
}
export async function iniciarSesion(correo, clave) {
  try {
    await signInWithEmailAndPassword(auth, correo.trim(), clave);
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.code || "error" };
  }
}
/**
 * Crea una cuenta nueva Y deja la sesión iniciada con ella. Se usa solo en el primer ingreso:
 * quien configura el negocio crea su cuenta y queda como propietario.
 */
export async function crearCuentaPropietaria(correo, clave) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, correo.trim(), clave);
    // Se manda el correo de verificación: sin él, cualquiera podría registrar un correo ajeno (ver docs/SEGURIDAD.md).
    try { await sendEmailVerification(cred.user); } catch (_) { /* se puede reenviar desde la pantalla de acceso */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.code || "error" };
  }
}
/** Deja constancia (que nadie puede editar ni borrar) de una cancelación, descuento o anulación: quién, cuándo y cuánto. */
// Hora del servidor: si el reloj del celular está adelantado o atrasado, la bitácora (que valida la hora) no se pierde.
let desfaseReloj = 0;
try { onValue(ref(db, ".info/serverTimeOffset"), (s) => { desfaseReloj = Number(s.val()) || 0; }, () => {}); } catch (e) { /* sin red: se usa el reloj del dispositivo */ }
export const ahoraServidor = () => Date.now() + desfaseReloj;

export async function registrarAuditoria(evento) {
  try {
    const id = `${Date.now().toString(36)}${nuevoId()}`;
    const limpio = {};
    Object.entries({ ts: ahoraServidor(), ...evento }).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") limpio[k] = typeof v === "string" ? v.slice(0, 300) : v; });
    const ok = await saveRecord("auditoria", id, limpio);
    if (!ok) console.error("No se pudo guardar el registro de auditoría", limpio.accion);
    return ok;
  } catch (e) { console.error("Auditoría:", e); return false; } // la bitácora nunca debe impedir cobrar
}
/** Reenvía el correo para confirmar que la dirección es de quien inició sesión. */
export async function reenviarVerificacion() {
  try { if (!auth.currentUser) return { ok: false, code: "auth/no-user" }; await sendEmailVerification(auth.currentUser); return { ok: true }; }
  catch (e) { return { ok: false, code: e.code || "error" }; }
}
/** Vuelve a leer la cuenta (y renueva su prueba de sesión) para saber si ya verificó el correo. */
export async function sesionVerificada() {
  try { if (!auth.currentUser) return false; await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); return auth.currentUser.emailVerified === true; }
  catch (e) { return false; }
}
export async function cerrarSesion() {
  try { await espejo.vaciar(); } catch (e) { /* si no se pudo limpiar, igual se cierra la sesión */ }   // nada de datos del negocio queda en un equipo ajeno (los cambios pendientes por enviar SÍ se conservan)
  try { await signOut(auth); } catch (e) { console.error("Error al cerrar sesión:", e); }
}
export async function enviarCorreoCambioClave(correo) {
  try {
    await sendPasswordResetEmail(auth, correo.trim());
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.code || "error" };
  }
}

/**
 * Crea la cuenta de un empleado SIN sacar al administrador de su sesión.
 * (createUserWithEmailAndPassword inicia sesión con la cuenta nueva; por eso
 * se hace en una segunda "app" de Firebase aparte, que se cierra enseguida.)
 * Devuelve el uid de la cuenta para crear su perfil.
 */
export async function crearCuentaEmpleado(correo, clave) {
  const sec = getApps().find((a) => a.name === "secundaria") || initializeApp(app.options, "secundaria");
  const secAuth = getAuth(sec);
  try {
    let uid;
    try {
      const cred = await createUserWithEmailAndPassword(secAuth, correo.trim(), clave);
      uid = cred.user.uid;
      try { await sendEmailVerification(cred.user); } catch (_) { /* el empleado puede pedirlo de nuevo al entrar */ }
    } catch (e) {
      // Si la cuenta ya existe (por ejemplo, un intento anterior que se cortó antes de crear
      // el perfil) y la clave es la misma, se reutiliza en vez de dejar al empleado a medias.
      if (e.code !== "auth/email-already-in-use") throw e;
      uid = (await signInWithEmailAndPassword(secAuth, correo.trim(), clave)).user.uid;
    }
    await signOut(secAuth);
    return { ok: true, uid };
  } catch (e) {
    try { await signOut(secAuth); } catch (_) {}
    return { ok: false, code: e.code || "error" };
  }
}

/**
 * Se suscribe en vivo a una "carpeta" de datos (menu, orders, cuentas, etc).
 * El callback se llama inmediatamente con el valor actual, y de nuevo cada
 * vez que cambie — desde este dispositivo o cualquier otro.
 * Devuelve una función para cancelar la suscripción.
 */
// Claves cuya última lectura FALLÓ (permisos, sesión vencida…). Mientras tanto la pantalla muestra los datos de fábrica,
// y se bloquea guardar encima: así nadie pisa el menú o las mesas reales con los de fábrica.
const lecturasFallidas = new Set();
export function subscribeShared(key, defaultValue, callback) {
  const r = ref(db, key);
  let llegoServidor = false;
  espejo.leer(`doc:${key}`).then((c) => { if (!llegoServidor && c && c.valor !== undefined && !lecturasFallidas.has(key)) callback(c.valor === null ? defaultValue : c.valor); });
  let quitar = null, cancelado = false, espera = 3000, temporizador = null;
  function conectar() {
    quitar = onValue(
      r,
      (snapshot) => {
        llegoServidor = true; espera = 3000;
        lecturasFallidas.delete(key);
        const val = snapshot.val();
        espejo.guardar(`doc:${key}`, val === undefined ? null : val);
        callback(val === null || val === undefined ? defaultValue : val);
      },
      (error) => {
        llegoServidor = true;
        console.error(`Error leyendo "${key}" desde Firebase:`, error);
        const primera = !lecturasFallidas.has(key);
        lecturasFallidas.add(key);
        if (primera) callback(defaultValue);
        quitar = null;
        if (cancelado) return;
        temporizador = setTimeout(() => { temporizador = null; if (!cancelado) conectar(); }, espera);
        espera = Math.min(espera * 2, 60000);
      }
    );
  }
  conectar();
  return () => { cancelado = true; if (temporizador) clearTimeout(temporizador); if (quitar) quitar(); };
}

/**
 * Firebase Realtime Database rechaza CUALQUIER escritura que contenga el
 * valor `undefined` en algún campo (falla la operación completa, no solo
 * ese campo). Esta limpieza convierte cualquier `undefined` en algo válido
 * antes de guardar, para que un dato faltante nunca cause que se pierda un
 * pedido o una cuenta completa.
 */
/* Cambios que ya se pidieron guardar pero el servidor todavía no confirma (sin internet se quedan aquí y se suben solos al volver). */
let escriturasPendientes = 0;
const escuchasPendientes = new Set();
const avisarPendientes = () => escuchasPendientes.forEach((f) => f(escriturasPendientes));
export function observarPendientes(cb) {
  escuchasPendientes.add(cb);
  cb(escriturasPendientes);
  return () => escuchasPendientes.delete(cb);
}
async function rastreado(fn) {
  escriturasPendientes += 1; avisarPendientes();
  try { return await fn(); } finally { escriturasPendientes -= 1; avisarPendientes(); }
}

/** Código del último error al escribir (p. ej. "PERMISSION_DENIED"), para dar un aviso más preciso. */
let ultimoErrorEscritura = "";
export const ultimoErrorDeEscritura = () => ultimoErrorEscritura;

function sanitizeForFirebase(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

/** Guarda (sobrescribe) el valor completo de una "carpeta" de datos. Úsalo
 * solo para datos que se quedan pequeños siempre (menú, mesas, config) —
 * para listas que crecen sin parar (pedidos, cuentas, turnos) usa las
 * funciones de "colección" de más abajo, que guardan registro por registro. */
export async function saveShared(key, value) {
  if (lecturasFallidas.has(key)) { ultimoErrorEscritura = "READ_FAILED"; console.error(`No se guarda "${key}": no se pudo leer y se pisarían los datos reales.`); return false; }
  try {
    await rastreado(() => set(ref(db, key), sanitizeForFirebase(value)));
    return true;
  } catch (e) {
    ultimoErrorEscritura = (e && e.code) || "";
    console.error(`Error guardando "${key}" en Firebase:`, e);
    return false;
  }
}

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  COLECCIONES (pedidos, cuentas, turnos)
 * ─────────────────────────────────────────────────────────────────────────
 * En vez de un array plano, estas se guardan como { [id]: registro } dentro
 * de Firebase. Así, guardar UN pedido nuevo solo escribe ESE pedido — nunca
 * hay que reenviar todo el historial completo. Esto evita que la app se
 * vuelva más lenta con los meses, y evita que dos cambios simultáneos desde
 * dispositivos distintos se sobrescriban entre sí.
 */

/** Se suscribe en vivo a una colección y siempre entrega un array al callback. */
export function subscribeCollection(path, callback) {
  const r = ref(db, path);
  return suscribirLista({
    coleccion: path, clave: `lista:${path}`, consulta: r, callback,
    alError: `Error leyendo colección "${path}" desde Firebase:`,
    alLlegar: (val) => {
      if (val === null || val === undefined) return [];
      // Migración automática y única: si estos datos todavía están guardados como un array plano (formato viejo),
      // los reescribe una sola vez en el formato por registro, sin perder nada.
      if (Array.isArray(val)) {
        const map = {};
        val.forEach((rec, i) => { if (rec) map[rec.id || String(i)] = rec; });
        set(r, map).catch((e) => console.error(`No se pudo migrar "${path}":`, e));
        return val.filter(Boolean);
      }
      return Object.values(val);
    },
  });
}

/** Guarda o actualiza UN solo registro de una colección (un pedido, una cuenta, un turno). */
export async function saveRecord(path, id, value) {
  if (!conectado) return encolarSinConexion({ tipo: "set", ruta: `${path}/${id}`, valor: sanitizeForFirebase(value) });
  try {
    await rastreado(() => set(ref(db, `${path}/${id}`), sanitizeForFirebase(value)));
    return true;
  } catch (e) {
    ultimoErrorEscritura = (e && e.code) || "";
    console.error(`Error guardando registro en "${path}/${id}":`, e);
    return false;
  }
}

/** Guarda o actualiza varios registros de una colección en una sola operación
 * (por ejemplo, al trasladar una mesa se mueven varios pedidos a la vez). */
export async function saveRecords(path, recordsById) {
  if (!conectado) { for (const [id, value] of Object.entries(recordsById)) await encolarSinConexion({ tipo: "set", ruta: `${path}/${id}`, valor: sanitizeForFirebase(value) }); return true; }
  try {
    const updates = {};
    Object.entries(recordsById).forEach(([id, value]) => {
      updates[`${path}/${id}`] = sanitizeForFirebase(value);
    });
    await rastreado(() => update(ref(db), updates));
    return true;
  } catch (e) {
    ultimoErrorEscritura = (e && e.code) || "";
    console.error(`Error guardando varios registros en "${path}":`, e);
    return false;
  }
}

/** Borra un solo registro de una colección. */
/** Borra una colección completa (solo administradores; p. ej. limpiar el registro de errores). */
export async function borrarColeccion(path) {
  try { await rastreado(() => remove(ref(db, path))); return true; } catch (e) { ultimoErrorEscritura = (e && e.code) || ""; return false; }
}

export async function deleteRecord(path, id) {
  if (!conectado) return encolarSinConexion({ tipo: "borrar", ruta: `${path}/${id}` });
  try {
    await rastreado(() => remove(ref(db, `${path}/${id}`)));
    return true;
  } catch (e) {
    ultimoErrorEscritura = (e && e.code) || "";
    console.error(`Error borrando registro en "${path}/${id}":`, e);
    return false;
  }
}

/** Reemplaza una colección completa de una sola vez — solo para restaurar un
 * respaldo (operación rara y manual, no el guardado normal del día a día). */
/** Agrega o reemplaza registros de una colección SIN borrar los demás (a diferencia de saveCollectionArray).
 * Se usa al restaurar las cuentas pendientes de un respaldo: no debe borrar las deudas ya saldadas que sirven de historial. */
export async function mergeCollectionArray(path, arrayOfRecords) {
  try {
    const map = {};
    (arrayOfRecords || []).forEach((rec, i) => { if (rec) map[rec.id || String(i)] = sanitizeForFirebase(rec); });
    if (Object.keys(map).length > 0) await rastreado(() => update(ref(db, path), map));
    return true;
  } catch (e) {
    console.error(`Error restaurando colección \"${path}\":`, e);
    return false;
  }
}

export async function saveCollectionArray(path, arrayOfRecords) {
  try {
    const map = {};
    (arrayOfRecords || []).forEach((rec, i) => { if (rec) map[rec.id || String(i)] = sanitizeForFirebase(rec); });
    await rastreado(() => set(ref(db, path), map));
    return true;
  } catch (e) {
    console.error(`Error restaurando colección "${path}":`, e);
    return false;
  }
}

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  CARGA ACOTADA POR FECHA
 * ─────────────────────────────────────────────────────────────────────────
 * Para que la app no se vuelva más lenta con los años, el día a día
 * (Mesero, Cocina, Caja, Turno, Reportes de hoy/7/30 días) solo mantiene en
 * vivo una VENTANA reciente de pedidos y cuentas — no todo el historial.
 * El historial completo solo se pide bajo demanda (una sola vez, no en
 * vivo) cuando alguien entra a Historial o exporta/respalda todo.
 */

/** Se suscribe en vivo a una colección, pero solo a los registros cuyo campo
 * de fecha (tsField) sea posterior a `sinceTs`. Esta ventana SIEMPRE pesa lo
 * mismo, sin importar cuántos años de historial se hayan acumulado en total. */
export function subscribeCollectionSince(path, tsField, sinceTs, callback) {
  return suscribirLista({
    coleccion: path, clave: `ventana:${path}:${tsField}`, consulta: query(ref(db, path), orderByChild(tsField), startAt(sinceTs)), callback,
    alError: `Error leyendo ventana reciente de "${path}":`,
  });
}

/** Se suscribe en vivo solo a los registros cuyo campo `campo` vale `valor` (requiere `.indexOn` de ese campo en las reglas).
 * Se usa para las cuentas pendientes: solo se descargan las que siguen sin cobrar, sin importar cuántas deudas ya saldadas haya. */
export function subscribeCollectionWhere(path, campo, valor, callback) {
  return suscribirLista({
    coleccion: path, clave: `donde:${path}:${campo}=${valor}`, consulta: query(ref(db, path), orderByChild(campo), equalTo(valor)), callback,
    alError: `Error leyendo "${path}" filtrado por ${campo}:`,
  });
}

/** Trae TODA una colección de una sola vez (sin quedarse suscrito en vivo).
 * Se usa solo cuando alguien pide ver historial viejo, exportar a Excel, o
 * descargar un respaldo — nunca durante el uso normal del día a día. */
export async function getCollectionAll(path) {
  try {
    const snapshot = await get(ref(db, path));
    const val = snapshot.val();
    return val ? Object.values(val) : [];
  } catch (e) {
    console.error(`Error trayendo colección completa "${path}":`, e);
    return [];
  }
}

/** Trae solo los registros de una colección entre dos fechas (ambas incluidas)
 * — a diferencia de getCollectionAll, esto NUNCA crece con los años: siempre
 * trae únicamente lo de ese rango puntual, así el respaldo automático diario
 * pueda funcionar sin volverse más pesado con el tiempo. */
export async function getCollectionRange(path, tsField, fromTs, toTs) {
  try {
    const q = query(ref(db, path), orderByChild(tsField), startAt(fromTs));
    const snapshot = await get(q);
    const val = snapshot.val();
    const todos = val ? Object.values(val) : [];
    return todos.filter((r) => r[tsField] <= toTs);
  } catch (e) {
    console.error(`Error trayendo rango de "${path}":`, e);
    return [];
  }
}

/** Lee un solo registro suelto (no una colección) — ej. un marcador o un respaldo del día. */
export async function getRecord(path) {
  try {
    const snapshot = await get(ref(db, path));
    return snapshot.val();
  } catch (e) {
    if (conectado) console.error(`Error leyendo "${path}":`, e); // sin internet es lo esperado: no es un error que reportar
    return null;
  }
}

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  INVENTARIO
 * ─────────────────────────────────────────────────────────────────────────
 * El stock se ajusta con `increment`: si dos meseros envían pedidos al mismo
 * tiempo, los dos descuentos se suman bien (no se pisan entre sí).
 */
export async function ajustarStock(id, delta) {
  if (!conectado) return encolarSinConexion({ tipo: "incremento", ruta: `inventario/${id}/stock`, delta });
  try {
    await rastreado(() => update(ref(db), { [`inventario/${id}/stock`]: increment(delta) }));
    return true;
  } catch (e) {
    console.error(`Error ajustando stock de "${id}":`, e);
    return false;
  }
}

/**
 * Cambia una cuenta SOBRE LA VERSIÓN MÁS RECIENTE del servidor (transacción): si otro dispositivo la tocó hace un instante,
 * su cambio no se pierde. `mutador(actual)` recibe la cuenta tal como está y devuelve la nueva, o `undefined` para cancelar.
 * Con { permitirNuevo: true } el mutador recibe null cuando la cuenta no existe (para crearla solo si nadie más lo hizo).
 * Devuelve { ok, valor } (valor = la cuenta como quedó o como estaba si se canceló).
 */
export async function actualizarCuenta(id, mutador, { permitirNuevo = false } = {}) {
  if (!conectado) return actualizarRegistroSinConexion("cuentas", id, mutador, permitirNuevo);
  try {
    const res = await rastreado(() => runTransaction(ref(db, `cuentas/${id}`), (actual) => {
      if (actual === null && !permitirNuevo) return actual; // aún no llegó del servidor: Firebase reintenta con el valor real
      const nuevo = mutador(actual);
      return nuevo === undefined || nuevo === null ? undefined : sanitizeForFirebase(nuevo);
    }));
    return { ok: !!res.committed, valor: res.snapshot ? res.snapshot.val() : null };
  } catch (e) {
    ultimoErrorEscritura = (e && e.code) || "";
    console.error(`Error actualizando la cuenta "${id}":`, e);
    return { ok: false, valor: null, error: e };
  }
}

/** Cambio de un registro SIN internet: se calcula sobre la última versión que se conoce, se ve de inmediato y se fusiona con el servidor al volver. */
async function actualizarRegistroSinConexion(coleccion, id, mutador, permitirNuevo) {
  const actual = leerLocal(`${coleccion}/${id}`);
  if (actual === undefined && !permitirNuevo) return { ok: false, valor: null, error: { code: "sin-datos-locales" } };
  const base = actual === undefined ? null : clonar(actual);
  const nuevo = mutador(clonar(actual === undefined ? null : actual));
  if (nuevo === undefined || nuevo === null) return { ok: false, valor: null };
  const limpio = sanitizeForFirebase(nuevo);
  await encolarSinConexion({ tipo: "registro", ruta: `${coleccion}/${id}`, base, nuevo: limpio });
  return { ok: true, valor: limpio, sinConexion: true };
}

/**
 * Cambia una deuda (cuenta pendiente) SOBRE LA VERSIÓN MÁS RECIENTE del servidor, igual que actualizarCuenta:
 * si otro cajero la cobró un instante antes, el mutador la recibe ya cobrada y puede rechazar el cambio.
 * `mutador(actual)` devuelve la deuda nueva, o `undefined` para cancelar. Con { permitirNuevo: true } recibe null si no existe.
 */
export async function actualizarDeuda(id, mutador, { permitirNuevo = false } = {}) {
  if (!conectado) return actualizarRegistroSinConexion("deudas", id, mutador, permitirNuevo);
  try {
    const res = await rastreado(() => runTransaction(ref(db, `deudas/${id}`), (actual) => {
      if (actual === null && !permitirNuevo) return actual; // aún no llegó del servidor: Firebase reintenta con el valor real
      const nuevo = mutador(actual);
      return nuevo === undefined || nuevo === null ? undefined : sanitizeForFirebase(nuevo);
    }));
    return { ok: !!res.committed, valor: res.snapshot ? res.snapshot.val() : null };
  } catch (e) {
    ultimoErrorEscritura = (e && e.code) || "";
    console.error(`Error actualizando la deuda "${id}":`, e);
    return { ok: false, valor: null, error: e };
  }
}

/** Guarda un pedido y mueve el inventario en UNA sola escritura: o pasan las dos cosas o ninguna. */
export async function guardarPedidoYStock(order, deltas = {}) {
  if (!conectado) return encolarSinConexion({ tipo: "pedidoStock", pedido: sanitizeForFirebase(order), deltas });
  try {
    const cambios = { [`orders/${order.id}`]: sanitizeForFirebase(order) };
    Object.entries(deltas).forEach(([insumoId, d]) => { if (d) cambios[`inventario/${insumoId}/stock`] = increment(d); });
    await rastreado(() => update(ref(db), cambios));
    return true;
  } catch (e) {
    ultimoErrorEscritura = (e && e.code) || "";
    console.error(`Error guardando el pedido "${order.id}":`, e);
    return false;
  }
}

/** Cambia solo algunos campos de un registro (sin pisar el resto, ej. el stock). */
export async function updateRecord(path, id, partial) {
  if (!conectado) return encolarSinConexion({ tipo: "mezclar", ruta: `${path}/${id}`, parche: sanitizeForFirebase(partial) });
  try {
    await rastreado(() => update(ref(db, `${path}/${id}`), sanitizeForFirebase(partial)));
    return true;
  } catch (e) {
    ultimoErrorEscritura = (e && e.code) || "";
    console.error(`Error actualizando "${path}/${id}":`, e);
    return false;
  }
}

/** Cambia solo algunos campos de una carpeta (sin pisar el resto). */
export async function updateShared(path, partial) {
  try {
    await rastreado(() => update(ref(db, path), sanitizeForFirebase(partial)));
    return true;
  } catch (e) {
    ultimoErrorEscritura = (e && e.code) || "";
    console.error(`Error actualizando "${path}":`, e);
    return false;
  }
}

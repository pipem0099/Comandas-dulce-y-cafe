import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { getDatabase, ref, onValue, get, query, orderByChild, startAt, set, update, remove, increment } from "firebase/database";

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
  return onAuthStateChanged(auth, (user) => callback(user || null));
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
    await createUserWithEmailAndPassword(auth, correo.trim(), clave);
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.code || "error" };
  }
}
export async function cerrarSesion() {
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
      uid = (await createUserWithEmailAndPassword(secAuth, correo.trim(), clave)).user.uid;
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
export function subscribeShared(key, defaultValue, callback) {
  const r = ref(db, key);
  return onValue(
    r,
    (snapshot) => {
      const val = snapshot.val();
      callback(val === null || val === undefined ? defaultValue : val);
    },
    (error) => {
      console.error(`Error leyendo "${key}" desde Firebase:`, error);
      callback(defaultValue);
    }
  );
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
  return onValue(
    r,
    (snapshot) => {
      const val = snapshot.val();
      if (val === null || val === undefined) { callback([]); return; }

      // Migración automática y única: si estos datos todavía están guardados
      // como un array plano (formato viejo), los reescribe una sola vez en
      // el formato por registro, sin perder nada.
      if (Array.isArray(val)) {
        const map = {};
        val.forEach((rec, i) => { if (rec) map[rec.id || String(i)] = rec; });
        set(r, map).catch((e) => console.error(`No se pudo migrar "${path}":`, e));
        callback(val.filter(Boolean));
        return;
      }

      callback(Object.values(val));
    },
    (error) => {
      console.error(`Error leyendo colección "${path}" desde Firebase:`, error);
      callback([]);
    }
  );
}

/** Guarda o actualiza UN solo registro de una colección (un pedido, una cuenta, un turno). */
export async function saveRecord(path, id, value) {
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
  const q = query(ref(db, path), orderByChild(tsField), startAt(sinceTs));
  return onValue(
    q,
    (snapshot) => {
      const val = snapshot.val();
      callback(val ? Object.values(val) : []);
    },
    (error) => {
      console.error(`Error leyendo ventana reciente de "${path}":`, error);
      callback([]);
    }
  );
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
    console.error(`Error leyendo "${path}":`, e);
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
  try {
    await rastreado(() => update(ref(db), { [`inventario/${id}/stock`]: increment(delta) }));
    return true;
  } catch (e) {
    console.error(`Error ajustando stock de "${id}":`, e);
    return false;
  }
}

/** Cambia solo algunos campos de un registro (sin pisar el resto, ej. el stock). */
export async function updateRecord(path, id, partial) {
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

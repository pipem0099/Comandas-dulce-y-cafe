import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getDatabase, ref, onValue, get, query, orderByChild, startAt, set, update, remove, increment } from "firebase/database";

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  PASO OBLIGATORIO ANTES DE DESPLEGAR
 * ─────────────────────────────────────────────────────────────────────────
 *  1. Ve a https://console.firebase.google.com y crea un proyecto (gratis).
 *  2. En el menú lateral: "Compilación" → "Realtime Database" → "Crear base
 *     de datos". Elige la región más cercana. Cuando pregunte por las reglas
 *     de seguridad, elige "Modo de prueba" para empezar rápido (puedes
 *     endurecerlas después, ver database.rules.json en la raíz del proyecto).
 *  3. En "Configuración del proyecto" (ícono de engranaje) → pestaña
 *     "General" → sección "Tus apps" → clic en el ícono web </> para crear
 *     una app web. Copia el objeto de configuración que te da Firebase y
 *     pégalo reemplazando el objeto de aquí abajo.
 *  4. Guarda este archivo y sube el proyecto a Netlify. Listo — todos los
 *     dispositivos que abran el link verán los mismos datos, en vivo, y
 *     nada se borra al cerrar o refrescar la página.
 * ─────────────────────────────────────────────────────────────────────────
 */
const firebaseConfig = {
  apiKey: "AIzaSyBOxKCrmZs_Osa7_TRpcndE9i69hJASYGE",
  authDomain: "dulce-y-cafe-dabf3.firebaseapp.com",
  databaseURL: "https://dulce-y-cafe-dabf3-default-rtdb.firebaseio.com",
  projectId: "dulce-y-cafe-dabf3",
  storageBucket: "dulce-y-cafe-dabf3.firebasestorage.app",
  messagingSenderId: "354247335288",
  appId: "1:354247335288:web:fe5be065ce836a50797c8d",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  ACCESO AL NEGOCIO (protege la base de datos)
 * ─────────────────────────────────────────────────────────────────────────
 * Cada dispositivo se "vincula" UNA vez con la clave del negocio y queda
 * vinculado (no la vuelve a pedir). Las reglas de la base de datos
 * (database.rules.json) solo dejan leer y escribir a esa cuenta, así que
 * quien tenga el link de la app pero no la clave no puede ver ni tocar nada.
 * El correo es fijo: en Firebase se crea un usuario con ESTE correo y la
 * clave que tú elijas.
 */
export const CORREO_NEGOCIO = "negocio@comandas.app";

/** Avisa cuando este dispositivo queda vinculado (usuario) o no (null). */
export function observarSesion(callback) {
  return onAuthStateChanged(auth, (user) => callback(user || null));
}
export async function vincularDispositivo(clave) {
  try {
    await signInWithEmailAndPassword(auth, CORREO_NEGOCIO, clave);
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.code || "error" };
  }
}
export async function desvincularDispositivo() {
  try { await signOut(auth); } catch (e) { console.error("Error al desvincular:", e); }
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
    await set(ref(db, key), sanitizeForFirebase(value));
    return true;
  } catch (e) {
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
    await set(ref(db, `${path}/${id}`), sanitizeForFirebase(value));
    return true;
  } catch (e) {
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
    await update(ref(db), updates);
    return true;
  } catch (e) {
    console.error(`Error guardando varios registros en "${path}":`, e);
    return false;
  }
}

/** Borra un solo registro de una colección. */
export async function deleteRecord(path, id) {
  try {
    await remove(ref(db, `${path}/${id}`));
    return true;
  } catch (e) {
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
    await set(ref(db, path), map);
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
    await update(ref(db), { [`inventario/${id}/stock`]: increment(delta) });
    return true;
  } catch (e) {
    console.error(`Error ajustando stock de "${id}":`, e);
    return false;
  }
}

/** Cambia solo algunos campos de un registro (sin pisar el resto, ej. el stock). */
export async function updateRecord(path, id, partial) {
  try {
    await update(ref(db, `${path}/${id}`), sanitizeForFirebase(partial));
    return true;
  } catch (e) {
    console.error(`Error actualizando "${path}/${id}":`, e);
    return false;
  }
}

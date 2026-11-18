export const store = { cuentas: {}, deudas: {}, auditoria: [] };
const clon = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
export async function actualizarCuenta(id, mut) { const r = mut(clon(store.cuentas[id]) ?? null); if (r === undefined || r === null) return { ok: true, valor: store.cuentas[id] }; store.cuentas[id] = clon(r); return { ok: true, valor: r }; }
export async function actualizarDeuda(id, mut, { permitirNuevo = false } = {}) { const a = clon(store.deudas[id]) ?? null; if (a === null && !permitirNuevo) return { ok: true, valor: null }; const r = mut(a); if (r === undefined || r === null) return { ok: true, valor: store.deudas[id] }; store.deudas[id] = clon(r); return { ok: true, valor: r }; }
export function registrarAuditoria(e) { store.auditoria.push(e); }
export async function getCollectionRange() { return Object.values(store.deudas); }
export const saveOrdersMap = async () => {};
const noop = () => {};
export const parcharCuenta = async (id, patch) => { store.cuentas[id] = { ...store.cuentas[id], ...patch }; };
export const  avisarFalloGuardado = noop, observarPendientes = noop, ultimoErrorDeEscritura = () => "";
export const obtenerIdToken = async () => "t";
export const updateRecord = async () => true, saveShared = async () => true, getRecord = async () => null, saveCollectionArray = async () => true, mergeCollectionArray = async () => true;
export const subscribeShared = () => () => {}, subscribeCollection = () => () => {}, saveRecord = async () => true, deleteRecord = async () => true, subscribeCollectionSince = () => () => {}, getCollectionAll = async () => [], subscribeCollectionWhere = () => () => {};
// Funciones del trabajo sin conexión (en las pruebas siempre hay "internet")
export const observarConexion = (cb) => { cb({ conectado: true, pendientes: 0, conflictos: 0, sincronizando: false }); return () => {}; };
export const estaConectado = () => true;
export const conflictosSinConexion = () => [];
export const descartarConflictoSinConexion = async () => {};
export const reintentarConflictoSinConexion = async () => {};
export const sincronizarAhora = async () => {};

/*
 * Cuentas pendientes (saldos deudores): un cliente se va sin pagar todo y la deuda queda registrada para cobrarla después.
 * Funciones PURAS (sin pantalla ni base de datos), igual que cobros.js: reciben la versión MÁS RECIENTE del registro
 * (la del servidor) y devuelven la nueva, así dos cajeros que actúan a la vez no se pisan. `npm run deudas:probar`.
 *
 * Dónde vive cada cosa:
 *  · cuentas/{id}  → estado "pendiente" (la mesa queda libre sola: la sala solo ocupa mesas con cuentas "abierta").
 *                    Los pagos hechos antes y los cobros posteriores se guardan en cuenta.pagos con su propia hora (ts),
 *                    por eso el arqueo del turno donde se cobra la deuda suma ese dinero sin tocar turnos ya cerrados.
 *  · deudas/{id}   → la deuda misma: cliente, saldo, copia de lo consumido y cada cobro. Es lo que lee el módulo
 *                    "Pendientes" (no depende de la ventana de días de las cuentas, así una deuda vieja siempre aparece).
 *
 * Estados de una deuda:  pendiente → pagada | condonada.
 * Estados de la cuenta:  abierta → pendiente → pagada | condonada.
 */
import { cuentaGranTotal, pagosDe, pagosTotal } from "./dinero.js";

export const ESTADOS_DEUDA = ["pendiente", "pagada", "condonada"];
export const MAX_ITEMS_DEUDA = 40;

export const idDeuda = (cuentaId) => `d-${cuentaId}`;

/** Minúsculas y sin tildes: para buscar "Maria" y encontrar "María". */
export const normalizar = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const soloDigitos = (s) => String(s || "").replace(/\D/g, "");

/** Limpia y acota lo que escribió el cajero, y arma el texto de búsqueda. */
export function limpiarCliente(c) {
  const nombre = String((c && c.nombre) || "").trim().slice(0, 80);
  const telefono = String((c && c.telefono) || "").trim().slice(0, 30);
  const doc = String((c && c.doc) || "").trim().slice(0, 30);
  return { nombre, telefono, doc, busqueda: normalizar(`${nombre} ${soloDigitos(telefono)} ${doc}`) };
}

/** Obligatorio al menos un dato real del cliente: nombre (2+ letras), teléfono (7+ dígitos) o documento (4+ caracteres). */
export function clienteValido(c) {
  const l = limpiarCliente(c);
  return l.nombre.length >= 2 || soloDigitos(l.telefono).length >= 7 || l.doc.length >= 4;
}

/** Nombre para mostrar: lo más identificable que haya. */
export function clienteEtiqueta(c) {
  const x = c || {};
  return x.nombre || x.telefono || x.doc || "Cliente sin nombre";
}

/**
 * Convierte una cuenta ABIERTA con saldo en pendiente.
 * `items` = lo consumido [{ name, qty, price }] (se guarda una copia para el comprobante y la consulta).
 * Devuelve { cuenta, deuda } o { error }:  "no-existe" · "no-abierta" · "cliente-obligatorio" · "sin-saldo"
 */
export function dejarPendiente(actual, orders, { cliente, nota = "", usuario = "", lugar = "", items = [], ahora = Date.now() }) {
  if (!actual) return { error: "no-existe" };
  if (actual.estado && actual.estado !== "abierta") return { error: "no-abierta", estado: actual.estado };
  if (!clienteValido(cliente)) return { error: "cliente-obligatorio" };
  const total = cuentaGranTotal(orders, actual);
  const pagado = pagosTotal(actual);
  const saldo = Math.round(total - pagado);
  if (saldo < 1) return { error: "sin-saldo" };
  const id = idDeuda(actual.id);
  const deuda = {
    id, cuentaId: actual.id, mesa: String(actual.mesa), lugar: String(lugar || actual.mesa), ts: ahora,
    total: Math.round(total), pagadoAntes: Math.round(pagado), saldo,
    estado: "pendiente", registradaPor: String(usuario || "").slice(0, 120), nota: String(nota || "").trim().slice(0, 300),
    cliente: limpiarCliente(cliente),
    items: (items || []).slice(0, MAX_ITEMS_DEUDA).map((it) => ({ name: String(it.name || "").slice(0, 120), qty: Number(it.qty) || 0, price: Number(it.price) || 0 })),
    cobros: [],
  };
  const extras = Array.isArray(actual.mesasExtra) && actual.mesasExtra.length > 0 ? { mesasExtraAntes: actual.mesasExtra } : {};
  const cuenta = { ...actual, ...extras, mesasExtra: [], estado: "pendiente", liberada: true, liberadaTs: ahora, liberadaPor: String(usuario || ""), deudaId: id, pendienteTs: ahora };
  return { cuenta, deuda };
}

/** Vuelve la cuenta a "abierta" (solo si falló el guardado de la deuda y no puede quedar una cuenta pendiente sin deuda). */
export function revertirPendiente(actual) {
  if (!actual || actual.estado !== "pendiente") return actual || null;
  const { deudaId, pendienteTs, liberadaTs, liberadaPor, mesasExtraAntes, liberada, ...resto } = actual;
  return { ...resto, estado: "abierta", mesasExtra: mesasExtraAntes || [] };
}

/**
 * Cobra (todo o un abono) sobre la deuda tal como está en el servidor.
 * `pago` = { id, metodoPago, monto, procesadoPor }.  Devuelve { deuda, completo, yaAplicado } o { error }:
 *  "no-existe" · "no-pendiente" (otro cajero ya la cobró o se condonó) · "monto-invalido"
 * Un reintento con el mismo pago.id devuelve yaAplicado=true y NO cobra dos veces.
 */
export function cobrarDeuda(actual, pago, ahora = Date.now()) {
  if (!actual) return { error: "no-existe" };
  const previos = Array.isArray(actual.cobros) ? actual.cobros.filter(Boolean) : Object.values(actual.cobros || {}).filter(Boolean);
  if (pago && pago.id && previos.some((c) => c.id === pago.id)) return { deuda: actual, completo: actual.estado === "pagada", yaAplicado: true };
  if (actual.estado !== "pendiente") return { error: "no-pendiente", estado: actual.estado };
  const monto = Math.round(Number(pago && pago.monto) || 0);
  if (!(pago && pago.id) || !pago.metodoPago || monto < 1 || monto > actual.saldo) return { error: "monto-invalido" };
  const saldo = actual.saldo - monto;
  const cobro = { id: pago.id, ts: ahora, monto, metodoPago: pago.metodoPago, procesadoPor: String(pago.procesadoPor || "").slice(0, 120) };
  const completo = saldo <= 0;
  const deuda = { ...actual, saldo, estado: completo ? "pagada" : "pendiente", cobros: [...previos, cobro], ...(completo ? { pagadaTs: ahora } : {}) };
  return { deuda, completo, yaAplicado: false, cobro };
}

/**
 * Refleja el cobro en la cuenta: el pago entra a cuenta.pagos con la hora de HOY (así lo suma el arqueo del turno actual)
 * y, si la deuda quedó saldada, la cuenta pasa a "pagada". Es idempotente por pago.id.
 * Devuelve { cuenta, yaAplicado } o { error }: "no-existe" · "no-pendiente"
 */
export function aplicarCobroACuenta(actual, cobro, { completo = false, ahora = Date.now() } = {}) {
  if (!actual) return { error: "no-existe" };
  const previos = pagosDe(actual);
  const ya = previos.some((p) => p.id === cobro.id);
  if (!ya && actual.estado !== "pendiente") return { error: "no-pendiente", estado: actual.estado };
  const pagos = ya ? previos : [...previos, { id: cobro.id, ts: ahora, metodoPago: cobro.metodoPago, monto: cobro.monto, tipo: "deuda", etiqueta: "Cobro de saldo pendiente", procesadoPor: cobro.procesadoPor || "" }];
  const cierra = completo && actual.estado !== "pagada";
  const cuenta = { ...actual, pagos, ...(cierra ? { estado: "pagada", pagadaTs: ahora, liberada: true } : {}) };
  return { cuenta, yaAplicado: ya };
}

/** El administrador perdona el saldo que queda. El motivo es obligatorio. Devuelve { deuda } o { error }. */
export function condonarDeuda(actual, { usuario = "", motivo = "", ahora = Date.now() }) {
  if (!actual) return { error: "no-existe" };
  if (actual.estado === "condonada") return { deuda: actual, yaAplicado: true }; // un reintento (tras un fallo a medias) no condona dos veces
  if (actual.estado !== "pendiente") return { error: "no-pendiente", estado: actual.estado };
  const m = String(motivo || "").trim();
  if (!m) return { error: "motivo-obligatorio" };
  const deuda = { ...actual, estado: "condonada", saldoCondonado: actual.saldo, saldo: 0, condonacion: { ts: ahora, por: String(usuario || "").slice(0, 120), motivo: m.slice(0, 300), monto: actual.saldo } };
  return { deuda, yaAplicado: false };
}

/** Refleja la condonación en la cuenta. Idempotente. */
export function condonarCuenta(actual, { usuario = "", monto = 0, ahora = Date.now() }) {
  if (!actual) return { error: "no-existe" };
  if (actual.estado === "condonada") return { cuenta: actual, yaAplicado: true };
  if (actual.estado !== "pendiente") return { error: "no-pendiente", estado: actual.estado };
  return { cuenta: { ...actual, estado: "condonada", condonadaTs: ahora, condonadaPor: String(usuario || ""), montoCondonado: Math.round(monto), liberada: true }, yaAplicado: false };
}

/* ───────────── consulta ───────────── */

const inicioDia = (clave) => { const [y, m, d] = String(clave).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime(); };

/**
 * Filtra y ordena (la más reciente primero).
 *  texto   busca en nombre, teléfono, documento, mesa y nota (sin tildes, sin importar mayúsculas)
 *  desde / hasta   "AAAA-MM-DD" (ambos incluidos), sobre la fecha en que quedó pendiente
 *  estado  "pendiente" | "pagada" | "condonada" | "todas"
 */
export function buscarDeudas(deudas, { texto = "", desde = "", hasta = "", estado = "pendiente" } = {}) {
  const q = normalizar(texto);
  const qDigitos = soloDigitos(texto);
  const d0 = desde ? inicioDia(desde) : -Infinity;
  const d1 = hasta ? inicioDia(hasta) + 86400000 : Infinity;
  return (deudas || []).filter((d) => {
    if (!d || !d.cliente) return false;
    if (estado !== "todas" && d.estado !== estado) return false;
    if (d.ts < d0 || d.ts >= d1) return false;
    if (!q) return true;
    if (d.cliente.busqueda && d.cliente.busqueda.includes(q)) return true;
    if (qDigitos.length >= 3 && soloDigitos(d.cliente.telefono).includes(qDigitos)) return true;
    return normalizar(`${d.lugar || ""} ${d.nota || ""}`).includes(q);
  }).sort((a, b) => b.ts - a.ts);
}

/** Total que falta por cobrar de las deudas pendientes. */
export const totalPendiente = (deudas) => (deudas || []).filter((d) => d && d.estado === "pendiente").reduce((s, d) => s + (d.saldo || 0), 0);

/** Días enteros entre la fecha de la deuda y ahora (por calendario, no por 24 h). */
export function diasDesde(ts, ahora = Date.now()) {
  const a = new Date(ts), b = new Date(ahora);
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.max(0, Math.round((db - da) / 86400000));
}
export function antiguedadLabel(ts, ahora = Date.now()) {
  const n = diasDesde(ts, ahora);
  if (n === 0) return "hoy";
  if (n === 1) return "ayer";
  return `hace ${n} días`;
}

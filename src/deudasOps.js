// Operaciones de cuentas pendientes que guardan en Firebase, avisan a la persona y dejan rastro en la bitácora.
// La lógica de cada cambio vive en deudas.js (pura y probada); aquí solo se ordenan las escrituras.
//
// Orden de escritura (para que nunca quede dinero "invisible"):
//  · Dejar pendiente: primero la CUENTA (transacción: valida que siga abierta y calcula el saldo con los datos más nuevos),
//    luego la DEUDA. Si la deuda no se puede guardar, la cuenta vuelve a "abierta" y se avisa.
//  · Cobrar: primero la DEUDA (transacción: aquí se decide quién cobró primero), luego la CUENTA (el pago entra con la hora de hoy
//    y lo suma el arqueo del turno actual). Cada paso es idempotente por id de pago: si el segundo falla, "Reintentar" no cobra doble.
import { actualizarCuenta, actualizarDeuda, registrarAuditoria } from "./firebase.js";
import { avisar } from "./avisos.jsx";
import { money } from "./logica.js";
import { tieneRol } from "./utilidades.js";
import { dejarPendiente, revertirPendiente, cobrarDeuda, aplicarCobroACuenta, condonarDeuda, condonarCuenta, clienteEtiqueta } from "./deudas.js";

const rolDe = (u) => (tieneRol(u, "admin") ? "admin" : tieneRol(u, "cajero") ? "cajero" : "mesero");

const auditar = (usuario, accion, deuda, monto, motivo) => registrarAuditoria({
  accion, monto: Math.max(0, Math.round(monto || 0)), motivo: motivo || "", cuentaId: deuda.cuentaId, mesa: deuda.mesa,
  responsable: clienteEtiqueta(deuda.cliente), uid: usuario.uid, nombre: usuario.nombre, rol: rolDe(usuario),
});

const MENSAJES = {
  "no-abierta": ["Esta cuenta ya no está abierta", "Otro dispositivo la cerró un instante antes."],
  "no-existe": ["No se encontró la cuenta", "Actualiza la pantalla e inténtalo de nuevo."],
  "cliente-obligatorio": ["Falta identificar al cliente", "Escribe un nombre, un teléfono o un documento."],
  "sin-saldo": ["La cuenta no tiene saldo pendiente", "Ya está pagada por completo."],
  "no-pendiente": ["Esta deuda ya fue resuelta", "Otro cajero la cobró o se condonó un instante antes. No se cobró de nuevo."],
  "monto-invalido": ["Monto no válido", "El abono no puede ser mayor al saldo."],
  "motivo-obligatorio": ["Falta el motivo", "Para condonar una deuda hay que escribir por qué."],
};
const avisarError = (codigo, porDefecto = "No se pudo guardar el cambio") => {
  const m = MENSAJES[codigo];
  avisar({ texto: m ? m[0] : porDefecto, detalle: m ? m[1] : "Revisa tu conexión e inténtalo de nuevo.", tipo: m ? "info" : "error" });
};

/**
 * Deja el saldo restante de una cuenta como deuda del cliente y libera la mesa.
 * `items` = lo consumido [{ name, qty, price }]. Devuelve { ok, deuda?, error? }.
 */
export async function registrarPendiente({ cuenta, orders, cliente, nota, usuario, lugar, items }) {
  let r = null;
  const ahora = Date.now();
  const res = await actualizarCuenta(cuenta.id, (actual) => {
    r = dejarPendiente(actual, orders, { cliente, nota, usuario: usuario.nombre, lugar, items, ahora });
    return r.error ? undefined : r.cuenta;
  });
  if (!res.ok || !r || r.error) {
    const codigo = r && r.error;
    avisarError(codigo);
    return { ok: false, error: codigo || "guardado" };
  }
  let guardada = false;
  for (let intento = 0; intento < 3 && !guardada; intento++) {
    const d = await actualizarDeuda(r.deuda.id, (actual) => actual || r.deuda, { permitirNuevo: true });
    guardada = d.ok;
  }
  if (!guardada) {
    await actualizarCuenta(cuenta.id, (actual) => revertirPendiente(actual));
    avisar({ texto: "No se pudo registrar el saldo pendiente", detalle: "La mesa sigue abierta. Revisa tu conexión e inténtalo de nuevo.", tipo: "error" });
    return { ok: false, error: "deuda" };
  }
  auditar(usuario, "dejar_pendiente", r.deuda, r.deuda.saldo, `${clienteEtiqueta(r.deuda.cliente)}${r.deuda.nota ? ` · ${r.deuda.nota}` : ""}`);
  avisar({ texto: "Saldo pendiente registrado", detalle: `${clienteEtiqueta(r.deuda.cliente)} · ${money(r.deuda.saldo)} · mesa liberada`, tipo: "info" });
  return { ok: true, deuda: r.deuda };
}

/**
 * Cobra una deuda (total o abono). `pago` = { id, metodoPago, monto, procesadoPor }: el id debe conservarse si se reintenta.
 * Devuelve { ok, completo?, deuda?, error?, parcial? }. `parcial` = quedó anotado en la deuda pero no en la cuenta: hay que reintentar.
 */
export async function cobrarPendiente({ deuda, pago, usuario }) {
  let rd = null;
  const ahora = Date.now();
  const paso1 = await actualizarDeuda(deuda.id, (actual) => {
    rd = cobrarDeuda(actual, pago, ahora);
    return rd.error ? undefined : rd.deuda;
  });
  if (!paso1.ok || !rd || rd.error) {
    const codigo = rd && rd.error;
    avisarError(codigo);
    return { ok: false, error: codigo || "guardado" };
  }
  const cobros = Array.isArray(rd.deuda.cobros) ? rd.deuda.cobros : Object.values(rd.deuda.cobros || {});
  const cobro = rd.cobro || cobros.find((c) => c && c.id === pago.id);
  let rc = null;
  const paso2 = await actualizarCuenta(deuda.cuentaId, (actual) => {
    rc = aplicarCobroACuenta(actual, cobro, { completo: rd.completo, ahora });
    return rc.error ? undefined : rc.cuenta;
  });
  if (!paso2.ok || !rc || rc.error) {
    avisar({ texto: "El cobro quedó a medias", detalle: "Se anotó en la deuda pero no en la caja. Toca «Reintentar» (no se cobra doble).", tipo: "error", duracion: 12000 });
    return { ok: false, parcial: true, error: (rc && rc.error) || "guardado-cuenta" };
  }
  if (!rd.yaAplicado) {
    auditar(usuario, "cobrar_pendiente", deuda, cobro ? cobro.monto : pago.monto, rd.completo ? "Deuda saldada" : `Abono · quedan ${money(rd.deuda.saldo)}`);
  }
  avisar({
    texto: rd.completo ? "Deuda saldada" : "Abono registrado",
    detalle: rd.completo ? `${clienteEtiqueta(deuda.cliente)} · ${money(cobro ? cobro.monto : pago.monto)}` : `${money(cobro ? cobro.monto : pago.monto)} · quedan ${money(rd.deuda.saldo)}`,
  });
  return { ok: true, completo: rd.completo, deuda: rd.deuda };
}

/** El administrador perdona el saldo que queda (motivo obligatorio). Devuelve { ok, error? }. */
export async function condonarPendiente({ deuda, motivo, usuario }) {
  if (!tieneRol(usuario, "admin")) return { ok: false, error: "sin-permiso" };
  let rd = null;
  const ahora = Date.now();
  const paso1 = await actualizarDeuda(deuda.id, (actual) => {
    rd = condonarDeuda(actual, { usuario: usuario.nombre, motivo, ahora });
    return rd.error ? undefined : rd.deuda;
  });
  if (!paso1.ok || !rd || rd.error) {
    const codigo = rd && rd.error;
    avisarError(codigo);
    return { ok: false, error: codigo || "guardado" };
  }
  let rc = null;
  const paso2 = await actualizarCuenta(deuda.cuentaId, (actual) => {
    rc = condonarCuenta(actual, { usuario: usuario.nombre, monto: rd.deuda.saldoCondonado, ahora });
    return rc.error ? undefined : rc.cuenta;
  });
  if (!paso2.ok || !rc || rc.error) {
    avisar({ texto: "La condonación quedó a medias", detalle: "Se anotó en la deuda pero no en la cuenta. Vuelve a intentarlo.", tipo: "error", duracion: 12000 });
    return { ok: false, parcial: true, error: (rc && rc.error) || "guardado-cuenta" };
  }
  if (!rd.yaAplicado) auditar(usuario, "condonar_deuda", deuda, rd.deuda.saldoCondonado, rd.deuda.condonacion.motivo);
  avisar({ texto: "Deuda condonada", detalle: `${clienteEtiqueta(deuda.cliente)} · ${money(rd.deuda.saldoCondonado)}`, tipo: "info" });
  return { ok: true };
}

// Pruebas locales (sin internet) de la propina en "Por producto" y de las cuentas pendientes.   npm run deudas:probar
import { propinaPersona, resumenPropina, personasPorProducto, limitarPagadores } from "../src/propinaSplit.js";
import { aplicarPagos } from "../src/cobros.js";
import { dejarPendiente, revertirPendiente, cobrarDeuda, aplicarCobroACuenta, condonarDeuda, condonarCuenta, clienteValido, limpiarCliente, buscarDeudas, totalPendiente, antiguedadLabel, diasDesde, idDeuda } from "../src/deudas.js";
import { cuentaGranTotal, pagosDe } from "../src/dinero.js";
import { ventasEnRango } from "../src/utilidades.js";

let total = 0, fallas = 0;
const ok = (cond, texto) => { total++; if (!cond) fallas++; console.log(`${cond ? "✔" : "✘"} ${texto}`); };

/* ───────── Propina proporcional / equitativa ───────── */
console.log("── Propina por producto ──");
const P = 10000, SUB = 100000;
ok(propinaPersona({ modo: "proporcional", propinaTotal: P, subtotal: SUB, montoItems: 30000 }) === 3000, "proporcional: 10% sobre lo que consumió (30.000 → 3.000)");
ok(propinaPersona({ modo: "equitativa", propinaTotal: P, subtotal: SUB, montoItems: 5000, nPagadores: 10 }) === 1000, "equitativa: la propina de la mesa ÷ 10 pagadores (1.000 cada uno)");
ok(propinaPersona({ modo: "equitativa", propinaTotal: 10001, subtotal: SUB, montoItems: 1, personasPagadas: 9, propinaYaCobrada: 9000, nPagadores: 10 }) === 1001, "equitativa: el último pagador absorbe el redondeo");
ok(propinaPersona({ modo: "proporcional", propinaTotal: P, subtotal: SUB, montoItems: 20000, propinaYaCobrada: 9000, esUltimo: true }) === 1000, "proporcional: quien paga todo lo que queda se lleva la propina que falta");
ok(propinaPersona({ modo: "proporcional", propinaTotal: 0, subtotal: SUB, montoItems: 20000 }) === 0, "sin propina no se cobra nada");
ok(propinaPersona({ modo: "proporcional", propinaTotal: P, subtotal: 0, montoItems: 0 }) === 0, "subtotal en cero no divide por cero");
ok(limitarPagadores(1) === 2 && limitarPagadores(99) === 20 && limitarPagadores("x") === 2, "el número de pagadores se limita entre 2 y 20");

// Para cualquier reparto, la suma de propinas cobradas es EXACTAMENTE la propina de la cuenta.
function repartir(modo, propinaTotal, consumos, nPagadores) {
  const subtotal = consumos.reduce((a, b) => a + b, 0);
  const pagos = []; let cobrada = 0;
  consumos.forEach((m, i) => {
    const t = propinaPersona({ modo, propinaTotal, subtotal, montoItems: m, propinaYaCobrada: cobrada, personasPagadas: i, nPagadores, esUltimo: i === consumos.length - 1 });
    cobrada += t; pagos.push(t);
  });
  return { pagos, cobrada };
}
let cuadra = true, noNegativa = true;
for (let n = 2; n <= 20; n++) {
  for (const propina of [1, 7, 999, 10001, 123457]) {
    const consumos = Array.from({ length: n }, (_, i) => 1500 + ((i * 7919) % 9000));
    for (const modo of ["proporcional", "equitativa"]) {
      const r = repartir(modo, propina, consumos, n);
      if (r.cobrada !== propina) cuadra = false;
      if (r.pagos.some((x) => x < 0)) noNegativa = false;
    }
  }
}
ok(cuadra, "en 2 a 20 personas y 5 propinas distintas, la suma repartida = la propina de la cuenta (ambos modos)");
ok(noNegativa, "nunca se cobra una propina negativa");

console.log("\n── La vuelta dejada como propina no se cobra dos veces ──");
const cuentaV = { propina: { pct: 10, monto: 10500 } };
const pagosV = [{ id: "a", tipo: "por_producto", monto: 5500, propinaMonto: 5000, propinaVuelta: 500 }];
const rs = resumenPropina(cuentaV, pagosV);
ok(rs.planificada === 10000 && rs.cobrada === 5000 && rs.falta === 5000, "resumen: la propina planificada excluye la vuelta que ya dejó otro cliente");
ok(personasPorProducto([{ id: "1", tipo: "por_producto", grupo: "g" }, { id: "2", tipo: "por_producto", grupo: "g" }, { id: "3", tipo: "por_producto" }, { id: "4", tipo: "mixto" }]) === 2, "un pago con varios métodos cuenta como una sola persona");

console.log("\n── Cierra la cuenta completa con propina (integración con aplicarPagos) ──");
const orders = [{ id: "o1", cuentaId: "c1", estado: "listo", items: [{ id: "a", qty: 1, price: 40000 }, { id: "b", qty: 1, price: 35000 }, { id: "c", qty: 1, price: 25000 }] }]; // subtotal 100.000
for (const modo of ["proporcional", "equitativa"]) {
  let cuenta = { id: "c1", mesa: "1", ts: 1, estado: "abierta", propina: { pct: 10, monto: 10000 } };
  const consumos = [40000, 35000, 25000]; let cobradaProp = 0; let res = null;
  consumos.forEach((m, i) => {
    const t = propinaPersona({ modo, propinaTotal: 10000, subtotal: 100000, montoItems: m, propinaYaCobrada: cobradaProp, personasPagadas: i, nPagadores: 3, esUltimo: i === 2 });
    cobradaProp += t;
    res = aplicarPagos(cuenta, [{ pago: { id: `p${i}`, ts: 5, metodoPago: "efectivo", monto: m + t, propinaMonto: t, tipo: "por_producto", etiqueta: `Persona ${i + 1}` }, vuelta: 0 }], { orders, modoSplit: "producto", extra: i === 0 ? { propinaModo: modo, propinaPagadores: modo === "equitativa" ? 3 : null } : null });
    cuenta = res.cuenta;
  });
  ok(res.completo && cuenta.estado === "pagada" && res.totalPagado === 110000, `${modo}: tres personas pagan y la cuenta cierra en $110.000 exactos`);
  ok(cuenta.propinaModo === modo, `${modo}: el modo queda guardado en la cuenta junto con el primer pago`);
}
const prop = [40000, 35000, 25000].map((m, i) => propinaPersona({ modo: "proporcional", propinaTotal: 10000, subtotal: 100000, montoItems: m, propinaYaCobrada: [0, 4000, 7500][i], personasPagadas: i, esUltimo: i === 2 }));
ok(prop.join() === "4000,3500,2500", "proporcional: 40.000 → 4.000 · 35.000 → 3.500 · 25.000 → 2.500");

/* ───────── Cuentas pendientes ───────── */
console.log("\n── Dejar como saldo pendiente ──");
const T0 = new Date(2026, 10, 3, 20, 0).getTime();
const base = { id: "c1", mesa: "5", ts: 1000, estado: "abierta", mesero: "Ana", pagos: [{ id: "p1", ts: T0 - 1000, metodoPago: "efectivo", monto: 60000 }], mesasExtra: ["6"] };
const clienteOk = { nombre: "Carlos Pérez", telefono: "300 123 4567" };
const r1 = dejarPendiente(base, orders, { cliente: clienteOk, nota: "Le falta la billetera", usuario: "Caja", lugar: "Mesa 5", items: [{ name: "Plato", qty: 1, price: 40000 }], ahora: T0 });
ok(!r1.error && r1.deuda.saldo === 40000 && r1.deuda.total === 100000 && r1.deuda.pagadoAntes === 60000, "el saldo es lo que falta por pagar (100.000 − 60.000)");
ok(r1.cuenta.estado === "pendiente" && r1.cuenta.liberada === true && r1.cuenta.deudaId === idDeuda("c1"), "la cuenta pasa a 'pendiente' y la mesa queda liberada");
ok(Array.isArray(r1.cuenta.mesasExtra) && r1.cuenta.mesasExtra.length === 0 && r1.cuenta.mesasExtraAntes[0] === "6", "las mesas juntas se sueltan (y se recuerdan por si se revierte)");
ok(r1.deuda.id === "d-c1" && r1.deuda.cuentaId === "c1" && r1.deuda.estado === "pendiente" && r1.deuda.cobros.length === 0, "la deuda tiene id estable (no se duplica con un reintento)");
ok(dejarPendiente(base, orders, { cliente: {}, usuario: "Caja" }).error === "cliente-obligatorio", "sin identificar al cliente NO se puede dejar pendiente");
ok(dejarPendiente(base, orders, { cliente: { nombre: "A" } }).error === "cliente-obligatorio", "un nombre de una letra no basta");
ok(clienteValido({ telefono: "3001234567" }) && clienteValido({ doc: "1020304050" }) && clienteValido({ nombre: "Ana" }), "sirve nombre, teléfono o documento");
ok(dejarPendiente({ ...base, pagos: [{ id: "x", metodoPago: "efectivo", monto: 100000 }] }, orders, { cliente: clienteOk }).error === "sin-saldo", "una cuenta ya pagada no deja saldo");
ok(dejarPendiente({ ...base, estado: "pagada" }, orders, { cliente: clienteOk }).error === "no-abierta", "no se deja pendiente una cuenta ya cerrada por otro dispositivo");
ok(dejarPendiente(null, orders, { cliente: clienteOk }).error === "no-existe", "si la cuenta ya no existe, no inventa una");
const rev = revertirPendiente(r1.cuenta);
ok(rev.estado === "abierta" && !("deudaId" in rev) && rev.mesasExtra[0] === "6" && pagosDe(rev).length === 1, "revertir devuelve la cuenta a 'abierta' con sus pagos y mesas");
ok(cuentaGranTotal(orders, r1.cuenta) === 100000, "el total de la cuenta no cambia");

console.log("\n── Cobrar una cuenta vieja ──");
const T1 = T0 + 2 * 86400000;
const pagoA = { id: "q1", metodoPago: "tarjeta", monto: 15000, procesadoPor: "Luis" };
const c1 = cobrarDeuda(r1.deuda, pagoA, T1);
ok(!c1.error && c1.deuda.saldo === 25000 && c1.deuda.estado === "pendiente" && !c1.completo && c1.deuda.cobros.length === 1, "un abono baja el saldo y la deuda sigue pendiente");
ok(cobrarDeuda(c1.deuda, pagoA, T1).yaAplicado === true && cobrarDeuda(c1.deuda, pagoA, T1).deuda.saldo === 25000, "un reintento con el mismo id de pago NO cobra dos veces");
ok(cobrarDeuda(c1.deuda, { id: "q2", metodoPago: "efectivo", monto: 25001 }, T1).error === "monto-invalido", "no se puede cobrar más que el saldo");
ok(cobrarDeuda(c1.deuda, { id: "q2", metodoPago: "efectivo", monto: 0 }, T1).error === "monto-invalido", "no se cobra un monto de cero");
const c2 = cobrarDeuda(c1.deuda, { id: "q2", metodoPago: "efectivo", monto: 25000, procesadoPor: "Luis" }, T1 + 1);
ok(c2.completo && c2.deuda.estado === "pagada" && c2.deuda.saldo === 0 && c2.deuda.pagadaTs === T1 + 1, "el último abono salda la deuda");
ok(cobrarDeuda(c2.deuda, { id: "q3", metodoPago: "efectivo", monto: 1 }, T1 + 2).error === "no-pendiente", "dos cajeros a la vez: el segundo recibe 'ya cobrada'");

const k1 = aplicarCobroACuenta(r1.cuenta, c1.cobro, { completo: false, ahora: T1 });
ok(!k1.error && pagosDe(k1.cuenta).length === 2 && k1.cuenta.estado === "pendiente" && pagosDe(k1.cuenta)[1].ts === T1, "el abono entra a la cuenta con la hora de HOY");
ok(aplicarCobroACuenta(k1.cuenta, c1.cobro, { ahora: T1 }).yaAplicado === true && pagosDe(aplicarCobroACuenta(k1.cuenta, c1.cobro, { ahora: T1 }).cuenta).length === 2, "reflejar el mismo cobro dos veces no lo duplica");
const k2 = aplicarCobroACuenta(k1.cuenta, c2.cobro, { completo: true, ahora: T1 + 1 });
ok(k2.cuenta.estado === "pagada" && k2.cuenta.pagadaTs === T1 + 1 && pagosDe(k2.cuenta).length === 3, "al saldar, la cuenta queda pagada");
ok(aplicarCobroACuenta({ ...r1.cuenta, estado: "abierta" }, c1.cobro, {}).error === "no-pendiente", "no se cobra sobre una cuenta que no está pendiente");

console.log("\n── Caja: el dinero entra al turno donde se cobra ──");
const turnoViejo = [T0 - 3600000, T0 + 3600000], turnoHoy = [T1 - 3600000, T1 + 3600000];
const efViejo = ventasEnRango([k2.cuenta], ...turnoViejo), efHoy = ventasEnRango([k2.cuenta], ...turnoHoy);
ok(efViejo.efectivo === 60000 && efViejo.tarjeta === 0, "el turno viejo conserva solo lo que se cobró ese día (60.000)");
ok(efHoy.tarjeta === 15000 && efHoy.efectivo === 25000, "el turno de hoy suma el cobro tardío (15.000 tarjeta + 25.000 efectivo)");

console.log("\n── Condonar ──");
ok(condonarDeuda(r1.deuda, { usuario: "Jefe", motivo: "  " }).error === "motivo-obligatorio", "condonar exige un motivo");
const cd = condonarDeuda(c1.deuda, { usuario: "Jefe", motivo: "Cortesía de la casa", ahora: T1 });
ok(cd.deuda.estado === "condonada" && cd.deuda.saldo === 0 && cd.deuda.saldoCondonado === 25000 && cd.deuda.condonacion.por === "Jefe", "queda registrado quién condonó, por qué y cuánto");
ok(condonarDeuda(cd.deuda, { usuario: "Otro", motivo: "x" }).yaAplicado === true, "condonar dos veces no duplica");
ok(condonarDeuda(c2.deuda, { usuario: "Jefe", motivo: "x" }).error === "no-pendiente", "no se condona una deuda ya pagada");
const cc = condonarCuenta(k1.cuenta, { usuario: "Jefe", monto: 25000, ahora: T1 });
ok(cc.cuenta.estado === "condonada" && cc.cuenta.montoCondonado === 25000, "la cuenta también queda condonada");
ok(cobrarDeuda(cd.deuda, { id: "z", metodoPago: "efectivo", monto: 1 }).error === "no-pendiente", "una deuda condonada ya no se cobra");

console.log("\n── Buscador y listado ──");
const mk = (id, nombre, tel, ts, estado = "pendiente", saldo = 10000) => ({ id, cuentaId: id, lugar: "Mesa 1", ts, estado, saldo, cliente: limpiarCliente({ nombre, telefono: tel }) });
const lista = [mk("a", "María López", "3001112233", T0), mk("b", "José Gómez", "3105554444", T0 - 5 * 86400000), mk("c", "Marta Díaz", "", T0 - 9 * 86400000, "pagada"), mk("d", "Pedro", "3001112233", T0 - 20 * 86400000, "condonada")];
ok(buscarDeudas(lista, { texto: "maria" }).length === 1, "busca sin tildes ni mayúsculas (maria → María)");
ok(buscarDeudas(lista, { texto: "300 111" }).length === 1 && buscarDeudas(lista, { texto: "3001112233", estado: "todas" }).length === 2, "busca por teléfono aunque tenga espacios");
ok(buscarDeudas(lista, { texto: "mar", estado: "todas" }).length === 2, "búsqueda parcial en nombre");
ok(buscarDeudas(lista, {}).length === 2 && buscarDeudas(lista, { estado: "pagada" }).length === 1, "filtra por estado (por defecto, las pendientes)");
ok(buscarDeudas(lista, { desde: "2026-10-29", hasta: "2026-10-29", estado: "todas" }).map((d) => d.id).join() === "b", "filtra por fecha (desde/hasta incluidos)");
ok(buscarDeudas(lista, { estado: "todas" })[0].id === "a", "la más reciente primero");
ok(totalPendiente(lista) === 20000, "el total por cobrar suma solo las pendientes");
ok(diasDesde(T0, T1) === 2 && antiguedadLabel(T0, T0) === "hoy" && antiguedadLabel(T0, T0 + 86400000) === "ayer" && antiguedadLabel(T0, T1) === "hace 2 días", "antigüedad en palabras");

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

// Pruebas locales de los cobros (sin internet): que dos dispositivos no se pisen, deshacer, ids y velocidad.   npm run cobros:probar
import { aplicarPagos, deshacerPagos, deshacerCancelacionDe, idCuentaNueva, claveMesa } from "../src/cobros.js";
import { cuentaGranTotal, cuentaOrders, pagosDe, dayKey } from "../src/dinero.js";

let total = 0, fallas = 0;
const ok = (cond, texto) => { total++; if (!cond) fallas++; console.log(`${cond ? "✔" : "✘"} ${texto}`); };
const orders = [{ id: "o1", cuentaId: "c1", estado: "listo", items: [{ id: "a", qty: 2, price: 10000 }, { id: "b", qty: 1, price: 5000 }] }, { id: "o2", cuentaId: "c1", estado: "cancelado", items: [{ id: "x", qty: 9, price: 99999 }] }];
const base = { id: "c1", mesa: "1", ts: 1, estado: "abierta" };            // total = 25.000
const pago = (id, monto, metodo = "efectivo") => ({ id, ts: 5, metodoPago: metodo, monto });

console.log("── Cobrar ──");
const r1 = aplicarPagos(base, [{ pago: pago("p1", 25000), vuelta: 0 }], { orders, ahora: 777 });
ok(r1.completo && r1.cuenta.estado === "pagada" && r1.cuenta.pagadaTs === 777 && r1.totalNuevo === 25000, "un pago por el total cierra la cuenta");
ok(r1.cuenta.liberada === false, "la mesa queda por liberar");
const r2 = aplicarPagos(base, [{ pago: pago("p1", 10000), vuelta: 0 }], { orders });
ok(!r2.completo && r2.cuenta.estado === "abierta" && pagosDe(r2.cuenta).length === 1 && r2.montoRegistrado === 10000, "un pago parcial deja la cuenta abierta");
const r3 = aplicarPagos(r2.cuenta, [{ pago: pago("p2", 15000, "tarjeta"), vuelta: 0 }], { orders, ahora: 9 });
ok(r3.completo && pagosDe(r3.cuenta).length === 2, "el segundo pago completa la cuenta");
const rv = aplicarPagos(base, [{ pago: pago("p1", 25000), vuelta: 2000 }], { orders });
ok(rv.cuenta.propina.monto === 2000 && rv.totalNuevo === 27000 && rv.completo && pagosDe(rv.cuenta)[0].monto === 27000, "la vuelta dejada como propina sube propina y monto cobrado");
const rd = aplicarPagos({ ...base, descuento: { monto: 5000 }, propina: { monto: 1000 } }, [{ pago: pago("p1", 21000), vuelta: 0 }], { orders });
ok(rd.completo && rd.totalNuevo === 21000, "usa el descuento y la propina más recientes de la cuenta");
const rr = aplicarPagos(base, [1, 2, 3].map((i) => ({ pago: pago("s" + i, 8334), vuelta: 0 })), { orders });
ok(rr.completo, "dividir en 3 con redondeo hacia arriba cierra la cuenta");

console.log("\n── Dos dispositivos a la vez ──");
// Cada dispositivo aplica su pago sobre la versión MÁS RECIENTE de la cuenta (así lo hace la transacción):
const trasA = aplicarPagos(base, [{ pago: pago("pa", 10000), vuelta: 0 }], { orders }).cuenta;
const trasB = aplicarPagos(trasA, [{ pago: pago("pb", 15000, "tarjeta"), vuelta: 0 }], { orders });
ok(pagosDe(trasB.cuenta).map((p) => p.id).join() === "pa,pb" && trasB.completo, "dos pagos desde dos dispositivos quedan los DOS (antes uno borraba al otro)");
const doble = aplicarPagos(r1.cuenta, [{ pago: pago("otro", 25000), vuelta: 0 }], { orders });
ok(doble.error === "no-abierta" && doble.estado === "pagada", "cobrar una cuenta que otro ya cobró se rechaza (no se cobra doble)");
ok(aplicarPagos({ ...base, estado: "cancelada" }, [{ pago: pago("z", 1), vuelta: 0 }], { orders }).error === "no-abierta", "tampoco se cobra una cuenta cancelada");
ok(aplicarPagos(r2.cuenta, [{ pago: pago("p1", 10000), vuelta: 0 }], { orders }).error === "duplicado", "un reintento del mismo pago no se repite");
ok(aplicarPagos(null, [{ pago: pago("p", 1), vuelta: 0 }], { orders }).error === "no-existe", "si la cuenta ya no existe, no inventa una");

console.log("\n── Deshacer ──");
const nuevos = r3.nuevos;
const conOtroPago = { ...r3.cuenta, pagos: [...pagosDe(r3.cuenta), pago("ajeno", 0)] };
const undo = deshacerPagos(conOtroPago, r2.cuenta, nuevos);
ok(pagosDe(undo).map((p) => p.id).join() === "p1,ajeno" && undo.estado === "abierta" && undo.pagadaTs === undefined, "deshacer quita solo los pagos que acabas de hacer y reabre la cuenta");
ok(deshacerPagos(r3.cuenta, r2.cuenta, [{ monto: 1 }]).pagos.length === 1, "pagos viejos sin id: se restaura la copia anterior");
const canc = { ...base, estado: "cancelada", canceladaTs: 1, canceladaPor: "Jefe", motivoCancelacion: "x", montoCancelado: 25000, mesa: "1" };
const desc = deshacerCancelacionDe(canc, base);
ok(desc.estado === "abierta" && !("canceladaTs" in desc) && !("montoCancelado" in desc) && desc.mesa === "1", "deshacer una cancelación limpia solo los datos de la cancelación");

console.log("\n── Ids de cuenta y mesas ──");
const t = new Date(2026, 9, 27, 10).getTime();
ok(idCuentaNueva("5", t, 1) === `c-5-${dayKey(t)}-1` && idCuentaNueva("5", t, 1) === idCuentaNueva("5", t + 5000, 1), "dos meseros abriendo la misma mesa generan el MISMO id");
ok(idCuentaNueva("5", t, 2) !== idCuentaNueva("5", t, 1) && idCuentaNueva("6", t, 1) !== idCuentaNueva("5", t, 1), "otra mesa u otro número dan otro id");
ok(!/[.#$\[\]\/\s]/.test(claveMesa("Terraza 1.2/[A]#$")), "el nombre de la mesa no rompe las claves de Firebase");

console.log("\n── Velocidad con historial grande ──");
const MUCHAS = 20000, ords = [];
for (let i = 0; i < MUCHAS * 3; i++) ords.push({ id: "o" + i, cuentaId: "c" + (i % MUCHAS), estado: "listo", items: [{ qty: 1, price: 1000 }] });
const t0 = Date.now(); let suma = 0;
for (let i = 0; i < MUCHAS; i++) suma += cuentaGranTotal(ords, { id: "c" + i });
const ms = Date.now() - t0;
ok(suma === MUCHAS * 3000 && ms < 1500, `20.000 cuentas × 60.000 pedidos se suman en ${ms} ms (antes: cuadrático, minutos)`);
const lista = cuentaOrders(ords, "c1"); lista.length = 0;
ok(cuentaOrders(ords, "c1").length === 3, "quien recibe la lista puede modificarla sin dañar el índice");
ok(pagosDe({ pagos: { 0: pago("a", 1), 2: pago("b", 2) } }).length === 2, "pagos guardados como objeto (huecos) también se leen");

console.log(`\n${total - fallas} de ${total} pruebas cumplen lo esperado.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron.`); process.exit(1); }

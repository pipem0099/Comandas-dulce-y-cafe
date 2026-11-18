// Pruebas de pisos, varias cajas y destino de preparación (sin internet).   npm run pisos:probar
import { destinoCompleto as _dc } from "../src/pisos.js";
import { turnosSinCaja, getPisos, hayVariosPisos, pisoIdDeMesa, pisoDeMesaId, mesasDelPiso, planoDe, conPlano, getCajas, hayVariasCajas, cajaDePago, turnoDeEsteEquipo, pisoPrepDeLinea, pisoEntregaDeLinea, PISO_BASE, CAJA_BASE } from "../src/pisos.js";
import { aplicarPagos, deshacerPagos } from "../src/cobros.js";
import { ventasEnRango, ventasDelTurno, propinasEnRango, mesasDeReserva, reservaProxima } from "../src/utilidades.js";
import { destinoCompleto, DESTINO_INICIAL, resumenDestino } from "../src/pisos.js";
import { cobrarDeuda, aplicarCobroACuenta } from "../src/deudas.js";

let total = 0, fallas = 0;
const ok = (cond, texto) => { total++; if (!cond) fallas++; console.log(`${cond ? "✔" : "✘"} ${texto}`); };

console.log("── Pisos ──");
const uno = {};
ok(getPisos(uno).length === 1 && getPisos(uno)[0].id === PISO_BASE && !hayVariosPisos(uno), "sin configurar: un solo piso y nada cambia");
const cfg = { pisos: [{ id: "p1", nombre: "Piso 1" }, { id: "p2", nombre: "Piso 2" }, { id: "p3", nombre: "Piso 3" }], plano: { zonas: [{ id: "z1" }], alto: 120 }, planos: { p2: { zonas: [{ id: "z2" }], alto: 90 } } };
const mesas = [{ id: "m1", nombre: "1" }, { id: "m2", nombre: "2", piso: "p2" }, { id: "m3", nombre: "3", piso: "p3" }, { id: "m4", nombre: "4", piso: "borrado" }];
ok(hayVariosPisos(cfg), "con 3 pisos se activan los pisos");
ok(pisoIdDeMesa(mesas[0], cfg) === "p1", "una mesa sin piso cae en el piso base");
ok(pisoIdDeMesa(mesas[1], cfg) === "p2" && pisoDeMesaId(mesas, "m3", cfg) === "p3", "cada mesa sabe su piso");
ok(pisoIdDeMesa(mesas[3], cfg) === "p1", "una mesa de un piso borrado vuelve al piso base");
ok(pisoDeMesaId(mesas, "ext-123", cfg) === null, "para llevar / domicilio no tienen piso");
ok(mesasDelPiso(mesas, "p1", cfg).map((m) => m.id).join() === "m1,m4", "las mesas del piso base incluyen las sin piso");
ok(planoDe(cfg, "p1").alto === 120 && planoDe(cfg, "p2").alto === 90 && planoDe(cfg, "p3").zonas.length === 0, "cada piso tiene su plano (el 3 aún vacío)");
const c2 = conPlano(cfg, "p3", { zonas: [{ id: "z3" }], alto: 100 });
ok(c2.planos.p3.zonas[0].id === "z3" && c2.planos.p2.alto === 90 && c2.plano.alto === 120, "guardar el plano de un piso no toca los otros");
ok(conPlano(cfg, "p1", { zonas: [], alto: 80 }).plano.alto === 80, "el plano del piso base sigue en config.plano (datos viejos compatibles)");

console.log("\n── Destino de cada línea ──");
ok(pisoPrepDeLinea({}, cfg) === "p1" && pisoEntregaDeLinea({}, cfg) === "p1", "un pedido viejo (sin piso) se prepara y entrega en el piso base");
ok(pisoPrepDeLinea({ pisoPrep: "p2", pisoEntrega: "p3" }, cfg) === "p2" && pisoEntregaDeLinea({ pisoPrep: "p2", pisoEntrega: "p3" }, cfg) === "p3", "se prepara en el 2 y se entrega en el 3");
ok(pisoEntregaDeLinea({ pisoPrep: "p2" }, cfg) === "p2", "sin piso de entrega, se entrega donde se prepara");
ok(pisoPrepDeLinea({ pisoPrep: "borrado" }, cfg) === "p1", "un piso borrado no deja la línea huérfana");
ok(!destinoCompleto(DESTINO_INICIAL, true, true) && destinoCompleto({ estacion: "auto", pisoPrep: "mesa", pisoEntrega: "mesa", porLinea: {} }, true, true), "el mesero debe elegir estación y pisos antes de enviar");
ok(destinoCompleto(DESTINO_INICIAL, false, false), "con una sola estación y un solo piso no se pregunta nada");
ok(destinoCompleto({ estacion: "e1", porLinea: {} }, true, false) && !destinoCompleto({ estacion: null, porLinea: {} }, true, false), "con varios pisos no, pero varias estaciones sí exigen elegir");
const est = [{ id: "e1", nombre: "Cocina" }, { id: "e2", nombre: "Barra" }];
ok(resumenDestino({ estacion: "e1", pisoPrep: "p2", pisoEntrega: "p3", porLinea: {} }, est, cfg.pisos, "Piso 3") === "Cocina · Piso 2 → Piso 3", "el resumen dice 'Cocina · Piso 2 → Piso 3'");
ok(resumenDestino({ estacion: "e2", pisoPrep: "mesa", pisoEntrega: "mesa", porLinea: { a: {} } }, est, cfg.pisos, "Piso 3") === "Barra · Piso 3 (+1)", "el resumen cuenta los productos que van a otro lado");

console.log("\n── Varias cajas ──");
ok(getCajas({}).length === 1 && getCajas({})[0].id === CAJA_BASE && !hayVariasCajas({}), "sin configurar: una sola caja");
const cj = { cajas: [{ id: "principal", nombre: "Caja 1" }, { id: "c2", nombre: "Caja piso 3" }] };
const orders = [{ id: "o1", cuentaId: "c1", estado: "listo", items: [{ id: "a", qty: 1, price: 20000 }] }];
const cuenta = { id: "c1", mesa: "1", ts: 1, estado: "abierta" };
const p = (id, monto, metodo = "efectivo") => ({ id, ts: 1000, metodoPago: metodo, monto });
const r1 = aplicarPagos(cuenta, [{ pago: p("x1", 20000), vuelta: 0 }], { orders, ahora: 1000, cajaId: "c2" });
ok(r1.completo && r1.cuenta.pagos[0].cajaId === "c2" && r1.cuenta.cajaId === "c2", "el cobro queda sellado con la caja que recibió el dinero");
const r0 = aplicarPagos(cuenta, [{ pago: p("x1", 20000), vuelta: 0 }], { orders, ahora: 1000 });
ok(r0.cuenta.pagos[0].cajaId === undefined && r0.cuenta.cajaId === undefined, "con una sola caja no se agrega ningún campo (todo igual que antes)");
ok(cajaDePago(r0.cuenta.pagos[0], r0.cuenta) === CAJA_BASE && cajaDePago(r1.cuenta.pagos[0], r1.cuenta) === "c2", "un pago viejo es de la caja principal");
// dos cuentas cobradas en cajas distintas el mismo día
const cuentaB = { id: "c1b", mesa: "2", ts: 1, estado: "abierta" };
const ordersB = [...orders, { id: "o2", cuentaId: "c1b", estado: "listo", items: [{ id: "a", qty: 1, price: 30000 }] }];
const rB = aplicarPagos(cuentaB, [{ pago: p("y1", 30000, "tarjeta"), vuelta: 0 }], { orders: ordersB, ahora: 1500, cajaId: "principal" });
const todas = [r1.cuenta, rB.cuenta];
ok(ventasEnRango(todas, 0, Infinity).efectivo === 20000 && ventasEnRango(todas, 0, Infinity).tarjeta === 30000, "sin filtro: el total del negocio suma todas las cajas");
ok(ventasEnRango(todas, 0, Infinity, "c2").efectivo === 20000 && ventasEnRango(todas, 0, Infinity, "c2").tarjeta === 0, "la caja del piso 3 solo cuenta lo que ella cobró");
ok(ventasEnRango(todas, 0, Infinity, "principal").efectivo === 0 && ventasEnRango(todas, 0, Infinity, "principal").tarjeta === 30000, "la caja principal no se queda con lo de la otra");
ok(ventasDelTurno(todas, { aperturaTs: 0, cajaId: "c2" }).efectivo === 20000 && ventasDelTurno(todas, { aperturaTs: 0 }).tarjeta === 30000, "el turno de una caja cuadra con SU efectivo; un turno viejo sin caja suma todo");
const conProp = { ...r1.cuenta, propina: { monto: 2000 }, pagadaTs: 1000 };
ok(propinasEnRango([conProp, rB.cuenta], 0, Infinity, "c2") === 2000 && propinasEnRango([conProp, rB.cuenta], 0, Infinity, "principal") === 0, "las propinas también se reparten por caja");
// un cliente paga una parte en cada caja
const parte1 = aplicarPagos(cuenta, [{ pago: p("z1", 8000), vuelta: 0 }], { orders, ahora: 1100, cajaId: "principal" });
const parte2 = aplicarPagos(parte1.cuenta, [{ pago: p("z2", 12000, "tarjeta"), vuelta: 0 }], { orders, ahora: 1200, cajaId: "c2" });
ok(parte2.completo && parte2.cuenta.pagos[0].cajaId === "principal" && parte2.cuenta.pagos[1].cajaId === "c2", "un cliente puede pagar una parte en cada caja");
ok(ventasEnRango([parte2.cuenta], 0, Infinity, "principal").efectivo === 8000 && ventasEnRango([parte2.cuenta], 0, Infinity, "c2").tarjeta === 12000, "cada caja cuenta solo su parte");
const des = deshacerPagos(parte2.cuenta, parte1.cuenta, parte2.nuevos);
ok(des.estado === "abierta" && des.pagos.length === 1, "deshacer el pago quita solo lo de ese pago");
// deudas
const deuda = { id: "d1", cuentaId: "c1", saldo: 5000, estado: "pendiente", cobros: [] };
const rd = cobrarDeuda(deuda, { id: "k1", metodoPago: "efectivo", monto: 5000, procesadoPor: "Ana", cajaId: "c2" }, 3000);
ok(rd.cobro.cajaId === "c2", "el cobro de una deuda guarda la caja");
const pend = { id: "c1", estado: "pendiente", pagos: [] };
const rc = aplicarCobroACuenta(pend, rd.cobro, { completo: true, ahora: 3000 });
ok(rc.cuenta.pagos[0].cajaId === "c2" && rc.cuenta.cajaId === "c2" && rc.cuenta.estado === "pagada", "y llega a la cuenta con su caja");
const rdSin = cobrarDeuda(deuda, { id: "k2", metodoPago: "efectivo", monto: 5000 }, 3000);
ok(!("cajaId" in rdSin.cobro), "sin caja elegida el cobro de deuda queda como antes");

console.log("\n── Qué turno usa cada dispositivo ──");
const t1 = { id: "t1", estado: "abierto", cajaId: "principal", responsableActual: { uid: "u1" } };
const t2 = { id: "t2", estado: "abierto", cajaId: "c2", responsableActual: { uid: "u2" } };
const tc = { id: "t0", estado: "cerrado", cajaId: "c2" };
ok(turnoDeEsteEquipo([t1, tc], {}, null, { uid: "x" }).id === "t1", "con una sola caja: el turno abierto de siempre");
ok(turnoDeEsteEquipo([t1, t2], cj, "c2", { uid: "u1" }).id === "t2", "con dos cajas: la que eligió este dispositivo");
ok(turnoDeEsteEquipo([t1, t2], cj, null, { uid: "u2" }).id === "t2", "sin elegir: la caja que tiene a su cargo");
ok(turnoDeEsteEquipo([t1, t2], cj, null, { uid: "u9" }) === null, "sin elegir y sin caja a su cargo: ninguna (debe elegir)");
ok(turnoDeEsteEquipo([t1], cj, "c2", { uid: "u1" }) === null, "la caja elegida está cerrada: se ofrece abrirla");
ok(turnoDeEsteEquipo([t1], cj, null, { uid: "u9" }).id === "t1", "si hay una sola abierta y no eligió, usa esa");

console.log("\n── Agregar una caja con el turno abierto ──");
const viejo = { id: "tv", estado: "abierto", aperturaTs: 0 };
ok(turnosSinCaja([viejo, t2]).length === 1 && turnosSinCaja([viejo, t2])[0].id === "tv", "solo se marcan los turnos que no tenían caja");
const cobradoAntes = aplicarPagos(cuenta, [{ pago: p("w1", 20000), vuelta: 0 }], { orders, ahora: 500 }).cuenta; // cobrado cuando había UNA caja (sin marca)
const cobradoDespues = aplicarPagos(cuentaB, [{ pago: p("w2", 30000), vuelta: 0 }], { orders: ordersB, ahora: 2000, cajaId: "c2" }).cuenta;
const marcado = { ...viejo, cajaId: "principal" };
ok(ventasDelTurno([cobradoAntes, cobradoDespues], marcado).efectivo === 20000, "tras marcar el turno como principal, su arqueo conserva lo cobrado antes y no suma lo de la caja nueva");
ok(ventasDelTurno([cobradoAntes, cobradoDespues], { aperturaTs: 0, cajaId: "c2" }).efectivo === 30000, "la caja nueva solo cuenta lo suyo");
ok(turnoDeEsteEquipo([marcado], cj, "principal", { uid: "u1" }).id === "tv", "el dispositivo que elige la Caja 1 sigue viendo su turno abierto");

console.log("\n── Reservas con varias mesas juntas ──");
const ahoraR = Date.now();
const resv = { id: "r1", estado: "confirmada", ts: ahoraR + 30 * 60e3, mesaId: "m1", mesasExtra: ["m2", "m3"] };
ok(mesasDeReserva(resv).join() === "m1,m2,m3", "una reserva puede tener varias mesas juntas");
ok(mesasDeReserva({ mesaId: "m1" }).join() === "m1" && mesasDeReserva({}).length === 0, "las reservas viejas (una mesa o ninguna) siguen igual");
ok(["m1", "m2", "m3"].every((m) => reservaProxima([resv], m, ahoraR)), "cada mesa de la reserva muestra el aviso de que llega pronto");
ok(!reservaProxima([resv], "m4", ahoraR), "una mesa que no es de la reserva no lo muestra");

console.log(`\n${total - fallas} de ${total} pruebas cumplen lo esperado.`);
process.exit(fallas ? 1 : 0);

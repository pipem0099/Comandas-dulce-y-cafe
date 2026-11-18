// Pruebas del reverso de caja por Nota Crédito: npm run fiscal:probar
import { repartoReverso, reversosEnRango } from "../src/facturacion/reversos.js";
let total = 0, fallas = 0;
const ok = (c, t) => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const nc = (id, ts, monto, pagos) => ({ cuentaId: id, estado: "anulada", prefijo: "SETT", numero: id, anulacion: { ts, monto, pagos, numeroNota: `NC${id}`, motivo: "Error" } });
ok(JSON.stringify(repartoReverso({ monto: 10000, pagos: [{ metodo: "efectivo", monto: 10000 }] })) === '{"efectivo":10000,"tarjeta":0,"transferencia":0,"otro":0}', "pago en efectivo: todo el reverso sale del cajón");
const r = repartoReverso({ monto: 17500, pagos: [{ metodo: "efectivo", monto: 10000 }, { metodo: "tarjeta", monto: 9250 }] });
ok(r.efectivo + r.tarjeta === 17500 && r.efectivo > 0 && r.tarjeta > 0, "pago mixto con propina: el reverso se reparte y suma exacto el valor de la nota");
ok(repartoReverso({ monto: 5000, pagos: [] }).otro === 5000, "sin detalle de pagos no se pierde el monto");
ok(repartoReverso({ monto: 7, pagos: [{ metodo: "efectivo", monto: 3 }, { metodo: "tarjeta", monto: 3 }, { metodo: "transferencia", monto: 3 }] }).efectivo + 0 >= 0 && Object.values(repartoReverso({ monto: 7, pagos: [{ metodo: "efectivo", monto: 3 }, { metodo: "tarjeta", monto: 3 }, { metodo: "transferencia", monto: 3 }] })).reduce((a, b) => a + b, 0) === 7, "el redondeo no pierde ni inventa pesos");
const docs = { a: nc("1", 1000, 10000, [{ metodo: "efectivo", monto: 10000 }]), b: nc("2", 2000, 5000, [{ metodo: "tarjeta", monto: 5000 }]), c: { estado: "emitida", cuentaId: "3" }, d: nc("4", 9000, 3000, [{ metodo: "efectivo", monto: 3000 }]) };
const t = reversosEnRango(docs, 0, 5000);
ok(t.efectivo === 10000 && t.tarjeta === 5000 && t.cantidad === 2 && t.monto === 15000, "suma los reversos del rango por método");
ok(reversosEnRango(docs, 5000, Infinity).efectivo === 3000, "una nota fuera del rango no cuenta (cuenta cuando se emite la nota)");
ok(reversosEnRango(Object.values(docs), 0, 5000).notas.length === 2 && reversosEnRango(null).cantidad === 0, "acepta lista u objeto y tolera vacío");
ok(reversosEnRango(docs, 0, 1000).cantidad === 0, "el límite superior es exclusivo");
console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas) process.exit(1);

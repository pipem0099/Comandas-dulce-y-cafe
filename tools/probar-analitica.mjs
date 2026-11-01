// Pruebas locales (sin internet) de la lógica de analítica, control y alertas.   npm run analitica:probar
import { prepararVentas, rangosComparables, resumenPeriodo, comparar, descomponerVenta, rentabilidad, productosMuertos, metricasEmpleados,
  planificacionSemanal, comprasSugeridas, alertasBaseline, poissonColaSuperior, sugerirPlantillaCostos, precioSugerido, costoDeLinea, DIA, mediana } from "../src/analitica.js";

let total = 0, fallas = 0;
const ok = (cond, texto) => { total++; if (!cond) fallas++; console.log(`${cond ? "✔" : "✘"} ${texto}`); };
const casi = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// "Ahora": un martes a las 15:00
const AHORA = new Date(2026, 9, 27, 15, 0, 0).getTime();
const en = (diasAtras, h, m = 0) => { const d = new Date(AHORA); d.setDate(d.getDate() - diasAtras); d.setHours(h, m, 0, 0); return d.getTime(); };
let n = 0;
const cuentas = [], orders = [];
function venta({ ts, mesero = "Ana", items, descuento = 0, propina = 0, personas, motivo = "cliente frecuente", autor = "Jefe" }) {
  const id = "c" + (++n);
  cuentas.push({ id, mesa: "1", ts, estado: "pagada", pagadaTs: ts, mesero, personas, ...(descuento ? { descuento: { monto: descuento, motivo, aplicadoPor: autor } } : {}), ...(propina ? { propina: { monto: propina } } : {}) });
  orders.push({ id: "o" + n, cuentaId: id, estado: "entregado", ts, items });
  return id;
}
const cancelar = (ts, monto, mesero = "Ana") => { const id = "x" + (++n); cuentas.push({ id, mesa: "2", ts, estado: "cancelada", canceladaTs: ts, montoCancelado: monto, mesero, canceladaPor: "Jefe", motivoCancelacion: "error" }); };
const cafe = (qty = 1, extra = {}) => ({ id: "m1", baseId: "m1", name: "Café", price: 5000, cost: 1000, qty, ...extra });
const torta = (qty = 1, extra = {}) => ({ id: "m2", baseId: "m2", name: "Torta", price: 10000, cost: 0, qty, ...extra });

console.log("── Venta neta y comparaciones ──");
venta({ ts: en(0, 10), items: [cafe(2)], propina: 1000, personas: 2 });
let v = prepararVentas(cuentas, orders);
ok(v.length === 1 && v[0].venta === 10000, "la venta neta no incluye la propina");
venta({ ts: en(0, 11), items: [cafe(4)], descuento: 2000 });
v = prepararVentas(cuentas, orders);
ok(v[1].venta === 18000 && v[1].subtotal === 20000, "el descuento se resta de la venta neta");
ok(prepararVentas([{ id: "z", estado: "abierta", pagadaTs: en(0, 9) }], []).length === 0, "una cuenta abierta no es venta");
const r = rangosComparables("hoy", AHORA);
ok(r.A[0] === en(0, 0) && r.B[1] === en(7, 15) + 0 && r.B[0] === en(7, 0), "'hoy' se compara contra el mismo día y la misma hora de la semana pasada");
const rs = rangosComparables("semana", AHORA);
ok(rs.A[0] - rs.B[0] === 7 * DIA && rs.B[1] === rs.A[0], "'semana' = 7 días contra los 7 anteriores, sin solaparse");
const rm = rangosComparables("mes", AHORA);
ok(rm.B[1] - rm.B[0] === AHORA - rm.A[0], "'mes' compara el mismo tramo de días del mes pasado");
ok(comparar({ venta: 100, cuentas: 9 }, { venta: 0, cuentas: 0 }).nivel === "sin-base", "sin base suficiente no se inventa un porcentaje");
ok(comparar({ venta: 100, cuentas: 9 }, { venta: 100, cuentas: 3 }).nivel === "sin-base", "con menos de 5 cuentas en la base tampoco");
const c1 = comparar({ venta: 88, cuentas: 9 }, { venta: 100, cuentas: 9 });
ok(casi(c1.pct, -12) && c1.nivel === "baja", "88 contra 100 = −12%");
ok(comparar({ venta: 102, cuentas: 9 }, { venta: 100, cuentas: 9 }).nivel === "igual", "±5% se considera igual");

console.log("\n── Ticket: afluencia vs. consumo ──");
const A = { venta: 1200, cuentas: 10, ticket: 120 }, B = { venta: 900, cuentas: 12, ticket: 75 };
const d = descomponerVenta(A, B);
ok(casi(d.total, A.venta - B.venta), "los dos efectos suman exactamente la diferencia");
ok(d.afluencia < 0 && d.ticket > 0, "menos clientes pero más consumo por cuenta se distingue");
const R0 = descomponerVenta({ venta: 0, cuentas: 0, ticket: 0 }, { venta: 500, cuentas: 5, ticket: 100 });
ok(casi(R0.total, -500), "funciona aunque hoy no haya ventas");
const rp = resumenPeriodo(prepararVentas(cuentas, orders), [en(0, 0), AHORA + 1]);
ok(rp.cuentas === 2 && rp.personas === 2 && casi(rp.ticketPersona, 5000), "ticket por persona solo con las cuentas que tienen personas");

console.log("\n── Rentabilidad ──");
{
  const cu = [], od = [];
  const add = (id, items, descuento = 0) => { cu.push({ id, estado: "pagada", pagadaTs: en(1, 12), ...(descuento ? { descuento: { monto: descuento } } : {}) }); od.push({ id: "o" + id, cuentaId: id, estado: "x", items }); };
  add("a", [cafe(10), torta(2)]);                // torta sin costo
  add("b", [cafe(2)], 1000);                     // descuento de 1000 sobre 10000
  const vv = prepararVentas(cu, od);
  const rr = rentabilidad(vv, [{ id: "m1", name: "Café", cat: "Bebidas" }, { id: "m2", name: "Torta", cat: "Postres" }]);
  const pc = rr.productos.find((p) => p.id === "m1");
  ok(casi(pc.venta, 10 * 5000 + 2 * 5000 - 1000) && casi(pc.margen, 59000 - 12 * 1000), "margen neto del café = venta − descuento prorrateado − costo");
  ok(!rr.productos.find((p) => p.id === "m2") && rr.sinCosto.length === 1, "un producto sin costo NO entra al ranking (no se inventa margen)");
  ok(rr.cobertura < 1 && casi(rr.cobertura, 59000 / (59000 + 20000)), "la cobertura de costos dice qué parte de la venta tiene costo");
  const re = rentabilidad(vv, [{ id: "m1", name: "Café", cat: "Bebidas" }, { id: "m2", name: "Torta", cat: "Postres" }], { plantilla: { Postres: 30 } });
  const pt = re.productos.find((p) => p.id === "m2");
  ok(pt && pt.estimado && casi(pt.costo, 2 * 10000 * 0.3), "con plantilla por categoría el costo se estima y se marca como estimado");
  ok(re.hayEstimado && re.coberturaReal < re.cobertura, "lo estimado se distingue de lo real");
  const cr = costoDeLinea({ price: 8000, qty: 1 }, { id: "m9", cat: "X", receta: [{ insumoId: "i1", cant: 2 }] }, [{ id: "i1", costo: 500 }], {});
  ok(cr.fuente === "real" && cr.costo === 1000, "el costo sale de la receta si el pedido no lo trae");
}
ok(casi(precioSugerido(3000, 70), 10000, 1e-6), "precio sugerido = costo / (1 − margen objetivo)");
ok(precioSugerido(0, 70) === null, "sin costo no hay precio sugerido");
const pl = sugerirPlantillaCostos([{ cat: "Bebidas Calientes" }, { cat: "Tortas y Postres" }, { cat: "Otros" }]);
ok(pl["Bebidas Calientes"] === 25 && pl["Tortas y Postres"] === 30 && pl["Otros"] === 30, "la plantilla sugerida reconoce categorías por su nombre");

console.log("\n── Productos muertos y clasificación ──");
{
  const menu = [{ id: "m1", name: "Café" }, { id: "m2", name: "Torta" }, { id: "m3", name: "Nuevo", creadoTs: AHORA - 3 * DIA }, { id: "m4", name: "Navidad", temporada: true }, { id: "m5", name: "Olvidado" }];
  const cu = [], od = [];
  for (let i = 1; i <= 40; i++) { cu.push({ id: "k" + i, estado: "pagada", pagadaTs: en(i, 12) }); od.push({ id: "p" + i, cuentaId: "k" + i, estado: "x", items: [cafe(1)] }); }
  cu.push({ id: "kt", estado: "pagada", pagadaTs: en(2, 12) }); od.push({ id: "pt", cuentaId: "kt", estado: "x", items: [torta(1)] });
  const m = productosMuertos(prepararVentas(cu, od), menu, { ahora: AHORA });
  ok(m.muertos.length === 1 && m.muertos[0].id === "m5", "muerto = sin ventas en 30 días (no cuenta lo nuevo ni lo de temporada)");
  ok(m.moribundos.some((x) => x.id === "m2"), "moribundo = casi sin ventas");
  const corto = productosMuertos(prepararVentas(cu.slice(0, 3), od.slice(0, 3)), menu, { ahora: AHORA });
  ok(corto.datosInsuficientes && corto.muertos.length === 0, "con menos de 30 días de datos no se acusa a nadie de 'muerto'");
  const mk = (id, name, price, cost, qty) => ({ id, name, price, cost, qty });
  const ids = [mk("a", "Estrella", 10000, 2000, 50), mk("b", "Caballo", 5000, 4500, 60), mk("c", "Puzzle", 20000, 5000, 2), mk("d", "Perro", 4000, 3800, 1)];
  const c2 = ids.map((x, i) => ({ id: "q" + i, estado: "pagada", pagadaTs: en(1, 12) })); const o2 = ids.map((x, i) => ({ id: "w" + i, cuentaId: "q" + i, estado: "x", items: [{ id: x.id, baseId: x.id, name: x.name, price: x.price, cost: x.cost, qty: x.qty }] }));
  const rc = rentabilidad(prepararVentas(c2, o2), ids.map((x) => ({ id: x.id, name: x.name, cat: "c" })));
  const cl = Object.fromEntries(rc.productos.map((p) => [p.name, p.clase]));
  ok(cl.Estrella === "estrella" && cl.Caballo === "caballo" && cl.Puzzle === "puzzle" && cl.Perro === "perro", "clasifica estrella / caballo / puzzle / perro");
  ok(rc.productos[0].name === "Estrella", "el ranking es por ganancia, no por unidades (el más vendido no es el que más deja)");
}

console.log("\n── Control de pérdidas ──");
{
  const cu = [], od = [];
  const nombres = ["Ana", "Beto", "Carla", "Dani"];
  nombres.forEach((nom, j) => { for (let i = 0; i < 20; i++) { const id = `${nom}${i}`; cu.push({ id, estado: "pagada", pagadaTs: en(1, 10 + (i % 8)), mesero: nom, ...(nom === "Dani" && i < 10 ? { descuento: { monto: 5000, motivo: "amigo", aplicadoPor: "Dani" } } : {}) }); od.push({ id: "o" + id, cuentaId: id, estado: "x", items: [cafe(2)] }); } });
  for (let i = 0; i < 4; i++) cu.push({ id: "cx" + i, estado: "cancelada", canceladaTs: en(1, 20), montoCancelado: 8000, mesero: "Beto", canceladaPor: "Jefe", motivoCancelacion: "error", mesa: "3" });
  const mv = metricasEmpleados(cu, prepararVentas(cu, od), [en(2, 0), AHORA]);
  const dani = mv.empleados.find((e) => e.nombre === "Dani"), beto = mv.empleados.find((e) => e.nombre === "Beto");
  ok(dani.descN === 10 && dani.descMonto === 50000, "cuenta los descuentos por responsable");
  ok(beto.cancelN === 4 && beto.cancelMonto === 32000, "cuenta las cancelaciones por responsable");
  ok(mv.equipoSuficiente && dani.revisar && beto.revisar && !mv.empleados.find((e) => e.nombre === "Ana").revisar, "marca 'para revisar' solo a quien se desvía del equipo");
  ok(mv.eventos.length === 14 && mv.eventos[0].ts >= mv.eventos[13].ts, "arma la línea de tiempo de eventos, la más reciente primero");
  ok(mv.eventos.some((e) => e.tipo === "cancelacion" && e.autorizo === "Jefe" && e.motivo === "error"), "cada evento guarda quién autorizó y el motivo");
  const pocos = metricasEmpleados(cu.filter((c) => /^(Ana|Beto)/.test(c.id)), prepararVentas(cu.filter((c) => /^(Ana|Beto)/.test(c.id)), od), [en(2, 0), AHORA]);
  ok(!pocos.equipoSuficiente && pocos.empleados.every((e) => e.vsCancel === null), "con menos de 3 personas no se compara (no hay con quién)");
}

console.log("\n── Planificación ──");
{
  const cu = [], od = [];
  for (let i = 1; i <= 70; i++) {                       // 10 semanas; los sábados venden el triple
    const ts = en(i, 12); const w = new Date(ts).getDay(); const k = w === 6 ? 6 : 2;
    for (let j = 0; j < k; j++) { const id = `d${i}_${j}`; cu.push({ id, estado: "pagada", pagadaTs: en(i, 12 + (j % 2), j), mesero: "Ana" }); od.push({ id: "o" + id, cuentaId: id, estado: "x", items: [{ id: "m1", baseId: "m1", name: "Café", price: 5000, cost: 1000, qty: 2 }] }); }
  }
  const pv = planificacionSemanal(prepararVentas(cu, od), { ahora: AHORA, cuentasPorMeseroHora: 2 });
  const sab = pv.dias[6], mar = pv.dias[2];
  ok(pv.suficiente && sab.pronostico > 2.5 * mar.pronostico, "el sábado se pronostica claramente más alto que el martes");
  ok(sab.p25 <= sab.mediana && sab.mediana <= sab.p75, "el rango p25–p75 envuelve la mediana");
  ok(sab.franja && sab.franja.desde >= 12 && sab.franja.hasta <= 14, "detecta la franja fuerte del día");
  ok(sab.personalPico >= mar.personalPico && sab.personalPico >= 1, "el personal sugerido sube con el movimiento");
  ok(casi(pv.g, 1), "sin tendencia el factor es 1");
  ok(!planificacionSemanal(prepararVentas(cu.slice(0, 6), od.slice(0, 6)), { ahora: AHORA }).suficiente, "con poca historia avisa que no alcanza");
  const menu = [{ id: "m1", name: "Café", receta: [{ insumoId: "i1", cant: 20 }] }];
  const ins = [{ id: "i1", nombre: "Café molido", unidad: "g", stock: 100, minimo: 50, costo: 40 }];
  const cs = comprasSugeridas(prepararVentas(cu, od), menu, ins, { ahora: AHORA, diasAdelante: 3 });
  ok(cs.suficiente && cs.filas.length === 1 && cs.filas[0].comprar > 0, "sugiere comprar lo que falta para los próximos días");
  ok(casi(cs.filas[0].comprar, Math.max(0, cs.filas[0].demanda + 50 - 100)), "comprar = demanda + mínimo − stock");
}

console.log("\n── Alertas contra el histórico ──");
{
  const base = () => { n = 0; cuentas.length = 0; orders.length = 0; };
  const semanasNormales = () => { for (let k = 1; k <= 8; k++) for (let j = 0; j < 8; j++) venta({ ts: en(7 * k, 8 + j), items: [cafe(2)], personas: 2 }); };
  base(); semanasNormales();
  for (let j = 0; j < 7; j++) venta({ ts: en(0, 8 + j), items: [cafe(2)], personas: 2 });
  ok(alertasBaseline(prepararVentas(cuentas, orders), cuentas, { ahora: AHORA }).length === 0, "un día normal NO dispara alertas");
  base(); semanasNormales();
  venta({ ts: en(0, 9), items: [cafe(1)] });
  const bajas = alertasBaseline(prepararVentas(cuentas, orders), cuentas, { ahora: AHORA });
  ok(bajas.some((a) => a.id === "base-ventas"), "ventas muy por debajo de lo habitual → alerta");
  base(); semanasNormales(); for (let j = 0; j < 8; j++) venta({ ts: en(0, 8 + j), items: [cafe(2)] });
  for (let i = 0; i < 3; i++) cancelar(en(0, 10 + i), 9000);
  const canc = alertasBaseline(prepararVentas(cuentas, orders), cuentas, { ahora: AHORA });
  ok(canc.some((a) => a.id === "base-cancelaciones" && /3 cancelaciones/.test(a.titulo)), "3 cancelaciones cuando lo habitual es ninguna → alerta");
  base(); semanasNormales(); for (let k = 1; k <= 8; k++) cancelar(en(7 * k, 10), 5000); for (let k = 1; k <= 6; k++) cancelar(en(7 * k, 11), 5000);
  for (let j = 0; j < 8; j++) venta({ ts: en(0, 8 + j), items: [cafe(2)] }); cancelar(en(0, 10), 5000); cancelar(en(0, 11), 5000);
  ok(!alertasBaseline(prepararVentas(cuentas, orders), cuentas, { ahora: AHORA }).some((a) => a.id === "base-cancelaciones"), "2 cancelaciones cuando lo habitual ya es 2 → sin alerta (se aprende del negocio)");
  base(); for (let k = 1; k <= 3; k++) for (let j = 0; j < 8; j++) venta({ ts: en(7 * k, 8 + j), items: [cafe(2)] });
  venta({ ts: en(0, 9), items: [cafe(1)] });
  ok(alertasBaseline(prepararVentas(cuentas, orders), cuentas, { ahora: AHORA }).length === 0, "con menos de 4 semanas de historia no alerta (evita falsas alarmas)");
  base(); semanasNormales(); for (let j = 0; j < 8; j++) venta({ ts: en(0, 8 + j), items: [cafe(2)], descuento: 4000 });
  ok(alertasBaseline(prepararVentas(cuentas, orders), cuentas, { ahora: AHORA }).some((a) => a.id === "base-descuentos"), "descuentos mucho más altos que lo habitual → alerta");
  ok(casi(poissonColaSuperior(3, 0.5), 1 - Math.exp(-0.5) * (1 + 0.5 + 0.125)), "la probabilidad de Poisson es la correcta");
  ok(casi(mediana([5, 1, 3]), 3) && casi(mediana([1, 2, 3, 4]), 2.5), "mediana");
}

console.log(`\n${total - fallas} de ${total} pruebas cumplen lo esperado.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron.`); process.exit(1); }

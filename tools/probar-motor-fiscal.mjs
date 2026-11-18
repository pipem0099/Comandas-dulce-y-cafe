// Pruebas del motor tributario (puro).   npm run fiscal:probar
import { calcularDesgloseFiscal, repartirProporcional, cuentaParaFiscal, TIPOS_DOCUMENTO, IMPUESTOS, PRECIOS, PROPINAS } from "./facturacion/motor.mjs";
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };
const cent = (x) => Math.round(x * 100);
const cfg = (o = {}) => ({ tipoDocumento: "factura", impuesto: "inc", precios: "incluyen", propina: "excluir", ...o });

console.log("── Reparto proporcional (mayor resto) ──");
ok(repartirProporcional(100, [1, 1, 1]).reduce((a, b) => a + b, 0) === 100, "100 centavos entre 3 iguales suman exactamente 100");
ok(JSON.stringify(repartirProporcional(0, [5, 5])) === "[0,0]" && JSON.stringify(repartirProporcional(10, [0, 0])) === "[0,0]", "descuento 0 o sin pesos reparte ceros");
ok(JSON.stringify(repartirProporcional(1, [3, 3, 3])) === "[1,0,0]", "un centavo entre tres iguales va a la primera línea (determinista)");

console.log("\n── Casos calculados a mano ──");
let d = calcularDesgloseFiscal({ items: [{ id: "a", name: "Almuerzo", qty: 1, price: 10800 }] }, cfg());
ok(d.baseGravable === 10000 && d.valorImpuesto === 800 && d.totalDocumento === 10800, "INC 8 % incluido: $10.800 → base $10.000 + INC $800", JSON.stringify(d));
d = calcularDesgloseFiscal({ items: [{ id: "a", name: "Almuerzo", qty: 1, price: 10000 }] }, cfg({ precios: "suman" }));
ok(d.baseGravable === 10000 && d.valorImpuesto === 800 && d.totalDocumento === 10800, "INC 8 % que se suma: $10.000 → total $10.800");
d = calcularDesgloseFiscal({ items: [{ id: "a", name: "Almuerzo", qty: 1, price: 11900 }] }, cfg({ impuesto: "iva" }));
ok(d.baseGravable === 10000 && d.valorImpuesto === 1900 && d.totalDocumento === 11900, "IVA 19 % incluido: $11.900 → base $10.000 + IVA $1.900");
d = calcularDesgloseFiscal({ items: [{ id: "a", name: "Café", qty: 2, price: 5000 }] }, cfg({ impuesto: "exento" }));
ok(d.baseGravable === 0 && d.baseExenta === 10000 && d.valorImpuesto === 0 && d.totalDocumento === 10000 && d.impuesto.tipo === "EXENTO", "Exento: sin base gravable ni impuesto");
d = calcularDesgloseFiscal({ items: [{ id: "a", name: "Café", qty: 1, price: 10000 }], propina: 1000 }, cfg({ precios: "suman", propina: "incluir" }));
ok(d.totalDocumento === 11800 && d.totalCobrado === 11800 && d.propina.enDocumento === true && d.valorImpuesto === 800, "propina incluida: va al total del documento y NO paga impuesto");
d = calcularDesgloseFiscal({ items: [{ id: "a", name: "Café", qty: 1, price: 10000 }], propina: 1000 }, cfg({ precios: "suman", propina: "excluir" }));
ok(d.totalDocumento === 10800 && d.totalCobrado === 11800 && d.propina.enDocumento === false, "propina excluida: no entra al documento, pero sí al total cobrado");
d = calcularDesgloseFiscal({ items: [{ id: "a", name: "Café", qty: 1, price: 10000 }], envio: 3000 }, cfg({ precios: "suman" }));
ok(d.lineas.length === 2 && d.lineas[1].codigo === "DOMICILIO" && d.totalDocumento === 14040, "el domicilio es una línea con impuesto");
d = calcularDesgloseFiscal({ items: [{ id: "a", name: "A", qty: 1, price: 10000 }, { id: "b", name: "B", qty: 1, price: 0 }, { id: "c", name: "C", qty: 0, price: 5000 }] }, cfg());
ok(d.lineas.length === 1, "cortesías (precio 0) y cantidades 0 no generan línea");
d = calcularDesgloseFiscal({ items: [{ id: "a", name: "A", qty: 1, price: 4000 }], descuento: 999999 }, cfg());
ok(d.descuento === 4000 && d.totalDocumento === 0, "un descuento mayor al subtotal se limita al subtotal");
d = calcularDesgloseFiscal({ items: [{ id: "a", name: "A", qty: 1, price: 5000 }, { id: "a", name: "A", qty: 2, price: 5000 }] }, cfg());
ok(d.lineas.length === 1 && d.lineas[0].cantidad === 3, "renglones iguales se juntan");
d = calcularDesgloseFiscal({ items: [] }, cfg());
ok(d.totalDocumento === 0 && d.lineas.length === 0, "cuenta vacía: todo en cero");

console.log("\n── Configuración inválida se rechaza ──");
for (const [campo, malo] of [["tipoDocumento", "x"], ["impuesto", "iva19"], ["precios", "?"], ["propina", "si"]]) {
  let lanzo = false; try { calcularDesgloseFiscal({ items: [] }, cfg({ [campo]: malo })); } catch (e) { lanzo = true; }
  ok(lanzo, `${campo} = «${malo}» lanza error en vez de calcular mal`);
}
let l2 = false; try { calcularDesgloseFiscal({ items: [] }, null); } catch (e) { l2 = true; }
ok(l2, "sin configuración lanza error");

console.log("\n── Las 24 combinaciones × 300 cuentas al azar: invariantes exactos ──");
let semilla = 12345; const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
const entero = (a, b) => a + Math.floor(azar() * (b - a + 1));
let combos = 0, malas = [];
for (const tipoDocumento of TIPOS_DOCUMENTO) for (const impuesto of IMPUESTOS) for (const precios of PRECIOS) for (const propina of PROPINAS) {
  combos++;
  for (let n = 0; n < 300; n++) {
    const items = Array.from({ length: entero(1, 8) }, (_, i) => ({ id: `p${entero(1, 5)}`, name: `P${i}`, qty: entero(1, 7), price: entero(1, 400) * 50 + (azar() < 0.3 ? entero(1, 49) : 0) }));
    const bruto = items.reduce((a, it) => a + it.price * it.qty, 0);
    const cuenta = { items, descuento: azar() < 0.5 ? Math.round(bruto * azar() * 0.6) : 0, propina: azar() < 0.6 ? entero(0, 30) * 500 : 0, envio: azar() < 0.2 ? entero(1, 10) * 1000 : 0 };
    const r = calcularDesgloseFiscal(cuenta, { tipoDocumento, impuesto, precios, propina });
    const sum = (k) => r.lineas.reduce((a, l) => a + cent(l[k]), 0);
    const c = r._centavos;
    const errs = [];
    if (sum("base") !== c.base) errs.push("suma de bases ≠ base del documento");
    if (sum("impuesto") !== c.impuesto) errs.push("suma de impuestos ≠ impuesto del documento");
    if (sum("descuento") !== c.descuento) errs.push("suma de descuentos ≠ descuento");
    if (r.lineas.some((l) => cent(l.base) + cent(l.impuesto) !== cent(l.total))) errs.push("línea: base + impuesto ≠ total");
    if (c.totalCobrado !== c.base + c.impuesto + c.propina) errs.push("total cobrado mal");
    if (c.totalDocumento !== c.base + c.impuesto + (r.propina.enDocumento ? c.propina : 0)) errs.push("total documento mal");
    const netoEsperado = cent(bruto) + cent(cuenta.envio) - c.descuento;
    if (precios === "incluyen" || impuesto === "exento") { if (c.base + c.impuesto !== netoEsperado) errs.push("con precios incluidos el cliente debe pagar exactamente lo de la carta menos el descuento"); }
    else if (c.base !== netoEsperado) errs.push("con impuesto sumado la base debe ser el neto");
    if (impuesto === "exento" && c.impuesto !== 0) errs.push("exento con impuesto");
    const tasa = { inc: 0.08, iva: 0.19, exento: 0 }[impuesto];
    if (r.lineas.some((l) => Math.abs(cent(l.impuesto) - cent(l.base) * tasa) > (precios === "incluyen" ? 1.01 : 0.51))) errs.push("impuesto de una línea se aleja de base × tasa más de lo permitido por el redondeo");
    if (r.lineas.some((l) => [l.base, l.impuesto, l.total, l.descuento].some((x) => x < 0))) errs.push("monto negativo");
    if (!Number.isInteger(c.totalDocumento)) errs.push("centavos no enteros");
    if (errs.length) malas.push(`${tipoDocumento}/${impuesto}/${precios}/${propina}: ${errs[0]} ${JSON.stringify(cuenta)}`);
  }
}
ok(combos === 24, "se cubren las 24 combinaciones de configuración");
ok(malas.length === 0, `7.200 cuentas al azar cumplen todos los invariantes (sin pérdida de centavos)`, malas.slice(0, 2).join("\n    "));

console.log("\n── Adaptar cuenta + pedidos de Comandas ──");
const e = cuentaParaFiscal({ id: "c1", descuento: { monto: 500 }, propina: { monto: 1000 }, costoEnvio: 2000 }, [
  { estado: "listo", items: [{ id: "m1", name: "Limonada", qty: 2, price: 9000 }] },
  { estado: "cancelado", items: [{ id: "m2", name: "Americano", qty: 9, price: 3000 }] },
]);
ok(e.items.length === 1 && e.descuento === 500 && e.propina === 1000 && e.envio === 2000, "los pedidos cancelados no se facturan; descuento, propina y envío salen de la cuenta");
ok(cuentaParaFiscal({}, null).items.length === 0, "cuenta sin datos no rompe");

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

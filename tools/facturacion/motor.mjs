/*
 * Motor tributario de «Comandas» — función PURA (sin red, sin base de datos, sin reloj).
 *   calcularDesgloseFiscal(cuenta, configFiscal)  →  desglose listo para el documento electrónico.
 * Se prueba con `npm run fiscal:probar` y lo usan la pantalla de Caja (vista previa) y la función del servidor (documento real).
 *
 * Reglas:
 *  · Todo se calcula en CENTAVOS enteros (nunca con decimales flotantes): no se pierde ni se inventa un solo centavo.
 *  · El descuento de la cuenta se reparte entre las líneas de productos en proporción a su valor (método del mayor resto,
 *    que garantiza que la suma de las partes es EXACTAMENTE el descuento).
 *  · Impuesto por línea (así lo valida la DIAN): el total del documento es la suma de sus líneas, sin ajustes ocultos.
 *      - precios «incluyen»: base = bruto ÷ (1 + tasa) redondeada; impuesto = bruto − base (el cliente paga exactamente lo de la carta).
 *      - precios «suman»  : base = bruto; impuesto = base × tasa redondeada; total de la línea = base + impuesto.
 *      - exento (0 %)     : base = bruto; impuesto = 0 (no hay base gravable; se informa como base exenta).
 *  · El domicilio (costoEnvio) se factura como una línea más, con el mismo impuesto, y NO recibe descuento.
 *  · Propina voluntaria: «excluir» (no entra al documento) o «incluir» (se suma como ingreso para terceros, NO gravado).
 *    En ambos casos `totalCobrado` = lo que pagó el cliente.
 *  · Líneas con valor 0 (cortesías) no se envían: los proveedores rechazan líneas en cero.
 *
 * Entrada:  cuenta = { items: [{ id?, name, qty, price }], descuento?: pesos, propina?: pesos, envio?: pesos }
 * Montos de salida en pesos (con hasta 2 decimales).
 */

export const TASAS_BP = { inc: 800, iva: 1900, exento: 0 };       // puntos básicos: 800 = 8 %
export const NOMBRE_IMPUESTO = { inc: "INC", iva: "IVA", exento: "EXENTO" };
export const TIPOS_DOCUMENTO = ["factura", "pos"];
export const IMPUESTOS = ["inc", "iva", "exento"];
export const PRECIOS = ["incluyen", "suman"];
export const PROPINAS = ["excluir", "incluir"];

const aCentavos = (pesos) => Math.round((Number(pesos) || 0) * 100);
const aPesos = (c) => c / 100;
/** n ÷ d redondeado al entero más cercano (mitad hacia arriba), solo para n ≥ 0 y d > 0. */
const divRedondeo = (n, d) => Math.floor((2 * n + d) / (2 * d));

/** Reparte `total` (centavos enteros) entre `pesos` (≥ 0) de forma proporcional; la suma de lo repartido es exactamente `total`. */
export function repartirProporcional(total, pesos) {
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (suma <= 0 || total <= 0) return pesos.map(() => 0);
  const partes = pesos.map((p, i) => {
    const exacto = (total * p) / suma;
    const piso = Math.floor(exacto);
    return { i, piso, resto: exacto - piso };
  });
  let faltante = total - partes.reduce((a, p) => a + p.piso, 0);
  [...partes].sort((a, b) => b.resto - a.resto || a.i - b.i).forEach((p) => { if (faltante > 0) { p.piso += 1; faltante -= 1; } });
  return partes.map((p) => p.piso);
}

export function validarConfigMotor(cfg) {
  if (!cfg || typeof cfg !== "object") throw new Error("Falta la configuración fiscal.");
  if (!TIPOS_DOCUMENTO.includes(cfg.tipoDocumento)) throw new Error(`Tipo de documento no válido: ${cfg.tipoDocumento}`);
  if (!IMPUESTOS.includes(cfg.impuesto)) throw new Error(`Impuesto no válido: ${cfg.impuesto}`);
  if (!PRECIOS.includes(cfg.precios)) throw new Error(`Opción de precios no válida: ${cfg.precios}`);
  if (!PROPINAS.includes(cfg.propina)) throw new Error(`Opción de propina no válida: ${cfg.propina}`);
}

export function calcularDesgloseFiscal(cuenta, configFiscal) {
  validarConfigMotor(configFiscal);
  const cfg = configFiscal;
  const bp = TASAS_BP[cfg.impuesto];
  const items = ((cuenta && cuenta.items) || []).filter((it) => it && Number(it.qty) > 0);

  // 1) Líneas de productos (se juntan los renglones iguales: mismo producto y mismo precio).
  const agrupadas = new Map();
  for (const it of items) {
    const precio = Number(it.price) || 0;
    const clave = `${it.id || it.name}|${precio}`;
    const g = agrupadas.get(clave) || { codigo: String(it.id || "").slice(0, 40), descripcion: String(it.name || "Producto").slice(0, 200), cantidad: 0, precioUnitario: precio, brutoC: 0 };
    g.cantidad += Number(it.qty); g.brutoC += aCentavos(precio * Number(it.qty));
    agrupadas.set(clave, g);
  }
  const productos = [...agrupadas.values()].filter((g) => g.brutoC > 0);
  const subtotalBrutoC = productos.reduce((a, g) => a + g.brutoC, 0);

  // 2) Descuento repartido (nunca más que el subtotal).
  const descuentoC = Math.min(Math.max(aCentavos(cuenta && cuenta.descuento), 0), subtotalBrutoC);
  const descRep = repartirProporcional(descuentoC, productos.map((g) => g.brutoC));
  const lineasBase = productos.map((g, i) => ({ ...g, descuentoC: descRep[i], netoC: g.brutoC - descRep[i] }));

  // 3) Domicilio como una línea más, sin descuento.
  const envioC = Math.max(aCentavos(cuenta && cuenta.envio), 0);
  if (envioC > 0) lineasBase.push({ codigo: "DOMICILIO", descripcion: "Domicilio", cantidad: 1, precioUnitario: aPesos(envioC), brutoC: envioC, descuentoC: 0, netoC: envioC });

  // 4) Impuesto por línea.
  const lineas = lineasBase.map((l, i) => {
    let baseC, impC;
    if (bp === 0) { baseC = l.netoC; impC = 0; }
    else if (cfg.precios === "incluyen") { baseC = divRedondeo(l.netoC * 10000, 10000 + bp); impC = l.netoC - baseC; }
    else { baseC = l.netoC; impC = divRedondeo(baseC * bp, 10000); }
    const totalC = baseC + impC;
    return {
      indice: i + 1, codigo: l.codigo, descripcion: l.descripcion, cantidad: l.cantidad,
      precioUnitarioLista: aPesos(Math.round(l.precioUnitario * 100)),
      brutoAntesDescuento: aPesos(l.brutoC), descuento: aPesos(l.descuentoC),
      base: aPesos(baseC), impuesto: aPesos(impC), total: aPesos(totalC),
      precioUnitarioBase: l.cantidad > 0 ? Math.round((baseC / l.cantidad)) / 100 : 0,
      _c: { baseC, impC, totalC },
    };
  });

  const sumaC = (campo) => lineas.reduce((a, l) => a + l._c[campo], 0);
  const baseC = sumaC("baseC"), impC = sumaC("impC");
  const propinaC = Math.max(aCentavos(cuenta && cuenta.propina), 0);
  const propinaEnDoc = cfg.propina === "incluir" && propinaC > 0;
  const totalDocC = baseC + impC + (propinaEnDoc ? propinaC : 0);
  const totalCobradoC = baseC + impC + propinaC;

  return {
    moneda: "COP",
    tipoDocumento: cfg.tipoDocumento,
    impuesto: { tipo: NOMBRE_IMPUESTO[cfg.impuesto], tasa: bp / 10000, porcentaje: bp / 100 },
    preciosIncluyenImpuesto: cfg.precios === "incluyen",
    lineas: lineas.map(({ _c, ...l }) => l),
    subtotalBruto: aPesos(subtotalBrutoC + envioC),   // lo que muestra la carta + domicilio, antes de descuentos
    descuento: aPesos(descuentoC),
    baseGravable: bp === 0 ? 0 : aPesos(baseC),
    baseExenta: bp === 0 ? aPesos(baseC) : 0,
    valorImpuesto: aPesos(impC),
    propina: { monto: aPesos(propinaC), enDocumento: propinaEnDoc, noGravada: true },
    totalDocumento: aPesos(totalDocC),   // lo que se factura electrónicamente
    totalCobrado: aPesos(totalCobradoC), // lo que realmente pagó el cliente (incluye la propina aunque no vaya en el documento)
    _centavos: { base: baseC, impuesto: impC, propina: propinaC, totalDocumento: totalDocC, totalCobrado: totalCobradoC, descuento: descuentoC },
  };
}

/** Atajo para la pantalla y el servidor: arma la entrada del motor a partir de una cuenta y sus pedidos de Comandas. */
export function cuentaParaFiscal(cuenta, pedidos) {
  const items = (pedidos || []).filter((o) => o && o.estado !== "cancelado").flatMap((o) => (o.items || []).map((it) => ({ id: it.id, name: it.name, qty: it.qty, price: it.price })));
  return { items, descuento: (cuenta && cuenta.descuento && cuenta.descuento.monto) || 0, propina: (cuenta && cuenta.propina && cuenta.propina.monto) || 0, envio: Number(cuenta && cuenta.costoEnvio) || 0 };
}

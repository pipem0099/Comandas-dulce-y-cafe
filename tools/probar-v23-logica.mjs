// Pruebas de la lógica pura nueva de la v23: emisor y DV (módulo 11), folios y alertas amarillas, tope UVT del POS,
// clasificación de errores y reintentos, y mapeo de catálogos del proveedor.
import { calcularDv, validarEmisor, CODIGO_RESPONSABILIDAD, REGIMENES } from "./facturacion/emisor.mjs";
import { estadoFolios, ultimoConsecutivo, alertaTopeUvt, alertasResolucion, UVT_POR_DEFECTO } from "./facturacion/alertas.mjs";
import { clasificarError, proximoReintento, MAX_REINTENTOS_AUTOMATICOS } from "./facturacion/errores.mjs";
import { validarMapeo, conMapeoVacio, idImpuesto, idMedioPago, REQUISITOS } from "./facturacion/mapeo.mjs";
import { estadoResolucion } from "./facturacion/config.mjs";
import { PROVEEDORES } from "./facturacion/config.mjs";
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };

console.log("── Dígito de verificación (módulo 11 DIAN) ──");
for (const [nit, dv, quien] of [["800197268", "4", "DIAN"], ["890903938", "8", "Bancolombia"], ["860034313", "7", "Davivienda"], ["900123456", "", "calculado"]]) {
  const c = calcularDv(nit);
  ok(dv === "" ? /^\d$/.test(c) : c === dv, `DV de ${nit} (${quien}) = ${c}`);
}
ok(calcularDv("800.197.268-4") === "4" && calcularDv("") === "" && calcularDv("abc") === "", "acepta puntos y guion; vacío → sin DV");

console.log("\n── Emisor ──");
const E = { razonSocial: "Café Dulce SAS", nit: "800197268", regimen: "responsable_iva", municipio: "Bogotá D.C.", codigoDane: "11001", correo: "Facturas@Cafe.co" };
let v = validarEmisor(E);
ok(v.ok && v.valor.dv === "4" && v.valor.correo === "facturas@cafe.co", "emisor válido: calcula el DV y normaliza el correo");
ok(validarEmisor({ ...E, nit: "800197268-4" }).ok, "acepta el NIT con su DV correcto");
ok(validarEmisor({ ...E, nit: "800197268-9" }).errores.nit.includes("es 4"), "DV equivocado → dice cuál es el correcto");
ok(Object.keys(validarEmisor({}).errores).length === 6, "emisor vacío con exigir: 6 errores (razón social, NIT, régimen, municipio, DANE, correo)");
ok(validarEmisor({}, { exigir: false }).ok, "emisor vacío sin exigir: aún no configurado, sin error");
ok(validarEmisor({ ...E, codigoDane: "1100" }).errores.codigoDane && validarEmisor({ ...E, regimen: "x" }).errores.regimen && validarEmisor({ ...E, correo: "a@b" }).errores.correo, "DANE de 5 dígitos, régimen y correo válidos");
ok(REGIMENES.every((r) => CODIGO_RESPONSABILIDAD[r]) && CODIGO_RESPONSABILIDAD.responsable_iva === "O-48" && CODIGO_RESPONSABILIDAD.simple === "O-47" && CODIGO_RESPONSABILIDAD.no_responsable === "R-99-PN", "cada régimen tiene su código DIAN (O-48, O-47, R-99-PN)");

console.log("\n── Resolución: vigencia y folios ──");
const R = { prefijo: "SETT", numero: "18760000001", desde: "1", hasta: "1000", vigenciaDesde: "2026-01-01", vigenciaHasta: "2027-01-01" };
ok(estadoResolucion(R, "2026-06-01").estado === "vigente" && estadoResolucion(R, "2026-12-15").estado === "por_vencer" && estadoResolucion(R, "2027-02-01").estado === "vencida", "vigente / por vencer (≤30 días) / vencida");
let f = estadoFolios(R, 0);
ok(f.estado === "ok" && f.total === 1000 && f.disponibles === 1000, "sin consecutivos usados: 1000 disponibles");
f = estadoFolios(R, 500); ok(f.usados === 500 && f.disponibles === 500 && f.estado === "ok", "a mitad de rango: ok");
f = estadoFolios(R, 901); ok(f.estado === "por_agotarse" && f.disponibles === 99, "quedan 99 (≤10 %): por agotarse");
f = estadoFolios({ ...R, hasta: "100" }, 60); ok(f.estado === "por_agotarse" && f.disponibles === 40, "rango corto: ≤50 folios → por agotarse");
f = estadoFolios(R, 1000); ok(f.estado === "agotada" && f.disponibles === 0, "último folio usado: agotada");
ok(estadoFolios({}, 0).estado === "sin_datos" && estadoFolios({ desde: "10", hasta: "5" }, 0).estado === "sin_datos", "rango vacío o invertido: sin datos");
ok(estadoFolios({ ...R, desde: "500" }, 0).usados === 0 && estadoFolios({ ...R, desde: "500" }, 0).disponibles === 501, "rango que empieza en 500: el consecutivo 0 no cuenta como usado");
const docs = [{ estado: "emitida", prefijo: "SETT", numero: "SETT12" }, { estado: "anulada", prefijo: "SETT", numero: "SETT40" }, { estado: "error", prefijo: "SETT", numero: "SETT99" }, { estado: "emitida", prefijo: "OTRO", numero: "OTRO500" }];
ok(ultimoConsecutivo(docs, "SETT") === 40, "último consecutivo: ignora errores y otros prefijos (las anuladas sí consumieron folio)");
let al = alertasResolucion({ resolucion: R, ultimo: 950, estadoRes: estadoResolucion(R, "2026-12-20") });
ok(al.length === 2 && al.every((a) => a.nivel === "alerta"), "vence pronto + pocos folios: dos alertas amarillas");
ok(alertasResolucion({ resolucion: R, ultimo: 10, estadoRes: estadoResolucion(R, "2026-06-01") }).length === 0, "todo en orden: ninguna alerta");

console.log("\n── Tope de 5 UVT en el Documento Equivalente POS ──");
const tope = Math.round(UVT_POR_DEFECTO * 5);
ok(alertaTopeUvt({ tipoDocumento: "pos", totalDocumento: tope + 1 }) !== null && alertaTopeUvt({ tipoDocumento: "pos", totalDocumento: tope + 1 }).tope === tope, `POS por encima de ${tope}: alerta`);
ok(alertaTopeUvt({ tipoDocumento: "pos", totalDocumento: tope }) === null, "justo en el tope: no alerta");
ok(alertaTopeUvt({ tipoDocumento: "factura", totalDocumento: tope * 10 }) === null, "con Factura de Venta no aplica");
ok(alertaTopeUvt({ tipoDocumento: "pos", totalDocumento: 300000, valorUvt: 50000 }).tope === 250000, "usa el valor de UVT configurado");

console.log("\n── Clasificación de errores ──");
const c = (e) => clasificarError(e);
ok(c({ estado: 422, incierto: false }).clase === "datos" && c({ estado: 422 }).requiereCorreccion && !c({ estado: 422 }).reintentoAutomatico, "422 (NIT/correo inválido) → datos: el cajero corrige y reintenta");
ok(c({ estado: 400 }).clase === "datos" && c({ estado: 409 }).clase === "datos", "400/409 → datos");
ok(c({ estado: 503, incierto: false }).clase === "red" && c({ estado: 503, incierto: false }).reintentoAutomatico, "5xx sin haber enviado nada → red, reintento automático");
ok(c({ estado: 0, incierto: false, codigo: "red" }).reintentoAutomatico, "sin red antes de enviar → reintento automático");
ok(c({ estado: 502, incierto: true }).clase === "red" && !c({ estado: 502, incierto: true }).reintentoAutomatico && c({ estado: 502, incierto: true }).soloAdmin, "5xx tras enviar (incierto) → NO se reintenta solo: lo revisa un administrador");
ok(c({ estado: 401 }).clase === "credenciales" && c({ codigo: "credenciales" }).soloAdmin, "401 → credenciales (administrador)");
ok(c({ codigo: "configuracion" }).clase === "configuracion" && c({ codigo: "no_soportado" }).clase === "configuracion", "falta configurar → configuración");
ok(c({ estado: 429 }).clase === "red" && c({ estado: 408 }).clase === "red", "408/429 → transitorios");
const base = { estado: "error", error: { reintentoAutomatico: true }, ts: 1000, intentosAuto: 0 };
ok(!proximoReintento(base, 1000 + 29_000).reintentar && proximoReintento(base, 1000 + 30_000).reintentar, "primer reintento a los 30 s");
ok(!proximoReintento({ ...base, intentosAuto: 1 }, 1000 + 119_000).reintentar && proximoReintento({ ...base, intentosAuto: 1 }, 1000 + 120_000).reintentar, "segundo a los 2 min");
ok(proximoReintento({ ...base, intentosAuto: MAX_REINTENTOS_AUTOMATICOS }, 1e12).agotado === true, "tras 3 intentos se detiene");
ok(!proximoReintento({ ...base, error: { reintentoAutomatico: false } }, 1e12).reintentar && !proximoReintento({ estado: "emitida" }, 1e12).reintentar, "no reintenta errores de datos ni documentos emitidos");

console.log("\n── Mapeo de catálogos ──");
const CAT = { resoluciones: [{ id: "8", etiqueta: "SETT" }], impuestos: [{ id: "4", etiqueta: "INC 8 %" }, { id: "1", etiqueta: "IVA 19 %" }], mediosPago: [{ id: "10" }, { id: "48" }, { id: "47" }], productos: [{ id: "SKU1" }, { id: "PROP" }], vendedores: [{ id: "5" }] };
const M = { resolucion: "8", impuestos: { inc: "4" }, mediosPago: { efectivo: "10", tarjeta: "48", transferencia: "47" }, producto: "SKU1", vendedor: "5" };
ok(validarMapeo(M, { proveedor: "factus", ajustes: { impuesto: "inc" }, catalogo: CAT }).ok, "Factus: mapeo completo válido");
ok(validarMapeo({}, { proveedor: "simulado" }).ok, "Simulado no exige mapeo");
let r = validarMapeo({ ...M, impuestos: {} }, { proveedor: "alegra", ajustes: { impuesto: "inc" }, catalogo: CAT });
ok(!r.ok && r.errores["impuestos.inc"], "falta el impuesto que usa el restaurante");
r = validarMapeo({ ...M, impuestos: { iva: "1" } }, { proveedor: "alegra", ajustes: { impuesto: "iva" }, catalogo: CAT });
ok(r.ok, "con IVA solo se exige el mapeo del IVA, no el del INC");
r = validarMapeo({ ...M, mediosPago: { efectivo: "10" } }, { proveedor: "siigo", ajustes: { impuesto: "inc" }, catalogo: CAT });
ok(!r.ok && r.errores["mediosPago.tarjeta"] && r.errores["mediosPago.transferencia"] && !r.errores["mediosPago.efectivo"], "falta tarjeta y transferencia");
r = validarMapeo({ ...M, producto: "NO-EXISTE" }, { proveedor: "alegra", ajustes: { impuesto: "inc" }, catalogo: CAT });
ok(!r.ok && /vuelve a sincronizar/.test(r.errores.producto), "un id que ya no existe en el catálogo exige volver a sincronizar");
r = validarMapeo(M, { proveedor: "alegra", ajustes: { impuesto: "inc", propina: "incluir" }, catalogo: CAT });
ok(!r.ok && r.errores.propina, "propina «incluir» exige mapear el ítem contable de propinas");
ok(validarMapeo({ ...M, propina: "PROP" }, { proveedor: "alegra", ajustes: { impuesto: "inc", propina: "incluir" }, catalogo: CAT }).ok, "con el ítem de propinas mapeado queda válido");
ok(validarMapeo(M, { proveedor: "alegra", ajustes: { impuesto: "inc", propina: "excluir" }, catalogo: CAT }).ok, "propina «excluir» (por defecto): no exige mapear propina");
ok(validarMapeo({ ...M, impuestos: {} }, { proveedor: "alegra", ajustes: { impuesto: "exento" }, catalogo: CAT }).ok && !validarMapeo({ ...M, impuestos: {} }, { proveedor: "factus", ajustes: { impuesto: "exento" }, catalogo: CAT }).ok, "exento: Alegra/Siigo no piden ID de impuesto; Factus/Dataico sí (tributo «no aplica»)");
ok(idImpuesto(M, "INC") === "4" && idImpuesto(M, "iva") === "" && idMedioPago(M, "tarjeta") === "48" && idMedioPago(M, "otro") === "10" && conMapeoVacio(null).resolucion === "", "atajos para adaptadores (otro medio → efectivo)");
ok(PROVEEDORES.every((p) => REQUISITOS[p.valor]), "todos los proveedores tienen su matriz de requisitos");

console.log(`\n${total - fallas}/${total} pruebas correctas${fallas ? ` · ${fallas} fallaron` : ""}.`);
process.exit(fallas ? 1 : 0);

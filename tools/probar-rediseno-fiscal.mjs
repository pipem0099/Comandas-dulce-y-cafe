// Pruebas del rediseño de la pantalla de Facturación: municipios de Caldas + DANE, dirección/teléfono, consecutivo,
// conversión POS → Factura (> 5 UVT) y umbrales de alerta (≤ 25 folios · ≤ 15 días).
import { MUNICIPIOS_CALDAS, MUNICIPIO_POR_DEFECTO, municipioPorNombre, municipioPorDane, buscarMunicipios, errorMunicipioDane } from "./facturacion/municipios.mjs";
import { validarEmisor, calcularDv } from "./facturacion/emisor.mjs";
import { validarResolucion, validarAjustes, conDefectos, estadoResolucion } from "./facturacion/config.mjs";
import { ultimoEfectivo, estadoFolios, alertasResolucion } from "./facturacion/alertas.mjs";
import { construirPayload } from "./facturacion/payload.mjs";
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };

console.log("── Municipios de Caldas (DIVIPOLA) ──");
ok(MUNICIPIOS_CALDAS.length === 27, "27 municipios de Caldas");
ok(MUNICIPIOS_CALDAS.every((m) => /^17\d{3}$/.test(m.dane) && m.departamento === "Caldas"), "todos con DANE de 5 dígitos que empieza en 17");
ok(new Set(MUNICIPIOS_CALDAS.map((m) => m.dane)).size === 27 && new Set(MUNICIPIOS_CALDAS.map((m) => m.municipio)).size === 27, "sin repetidos");
ok(MUNICIPIOS_CALDAS[0].municipio === MUNICIPIO_POR_DEFECTO && MUNICIPIO_POR_DEFECTO === "Manizales" && MUNICIPIOS_CALDAS[0].dane === "17001", "Manizales (17001) es el primero y el de por defecto");
ok(municipioPorNombre("neira").dane === "17486" && municipioPorNombre("Chinchina").dane === "17174" && municipioPorNombre("PACORA").dane === "17513", "búsqueda por nombre sin tildes ni mayúsculas");
ok(municipioPorDane("17873").municipio === "Villamaría" && municipioPorDane("11001") === null, "búsqueda por DANE");
ok(buscarMunicipios("mar").map((m) => m.municipio).join() === "Marmato,Marquetalia,Marulanda,Villamaría" && buscarMunicipios("").length === 27 && buscarMunicipios("zzz").length === 0, "buscador del selector");
ok(errorMunicipioDane("Neira", "17486") === "" && errorMunicipioDane("Neira", "17001") !== "" && errorMunicipioDane("Bogotá", "11001") === "", "municipio y DANE deben coincidir (otros departamentos pasan)");

console.log("\n── Emisor: dirección, teléfono y DANE ──");
const EM = { razonSocial: "Dulce y Café SAS", nit: "900123456", regimen: "no_responsable", municipio: "Manizales", codigoDane: "17001", direccion: "Cra 23 # 45-67", telefono: "3001234567", correo: "fac@dulce.co" };
let v = validarEmisor(EM);
ok(v.ok && v.valor.direccion === "Cra 23 # 45-67" && v.valor.telefono === "3001234567", "emisor completo válido con dirección y teléfono");
ok(validarEmisor({ ...EM, telefono: "abc" }).errores.telefono, "teléfono con letras se rechaza");
ok(validarEmisor({ ...EM, telefono: "" }).ok && validarEmisor({ ...EM, direccion: "" }).ok, "dirección y teléfono son opcionales");
ok(validarEmisor({ ...EM, codigoDane: "17013" }).errores.codigoDane, "Manizales con DANE de Aguadas se rechaza");
ok(validarEmisor({ ...EM, municipio: "Bogotá", codigoDane: "11001" }).ok, "municipios fuera del catálogo (datos viejos) siguen válidos");
ok(calcularDv("800197268") === "4", "DV módulo 11 (DIAN 800197268 → 4)");

console.log("\n── Resolución: consecutivo ──");
const R = { prefijo: "SETT", numero: "18760000001", desde: "100", hasta: "500", vigenciaDesde: "2026-01-01", vigenciaHasta: "2027-01-01" };
ok(validarResolucion({ ...R, siguiente: "100" }).ok && validarResolucion({ ...R, siguiente: "500" }).ok && validarResolucion(R).ok, "consecutivo dentro del rango (o vacío) es válido");
ok(validarResolucion({ ...R, siguiente: "99" }).errores.siguiente && validarResolucion({ ...R, siguiente: "501" }).errores.siguiente, "consecutivo fuera de rango se rechaza");
ok(validarResolucion({ ...R, siguiente: "12a" }).errores.siguiente, "consecutivo con letras se rechaza");
ok(validarResolucion({ ...R, hasta: "50" }).errores.hasta && validarResolucion({ ...R, vigenciaHasta: "2025-12-31" }).errores.vigenciaHasta, "hasta < desde y vigencia invertida se rechazan");
ok(conDefectos({}).resolucion.siguiente === "" && conDefectos({}).consumidorFinal === true && conDefectos({}).convertirPos === true, "valores de fábrica: consecutivo vacío, consumidor final y conversión POS activos");
ok(validarAjustes({ ...conDefectos({}), consumidorFinal: false, convertirPos: false }).valor.consumidorFinal === false && validarAjustes({ ...conDefectos({}), convertirPos: false }).valor.convertirPos === false, "los interruptores se guardan");
ok(validarAjustes(conDefectos({})).valor.consumidorFinal === true, "por defecto Consumidor Final queda activo");

console.log("\n── Folios con consecutivo escrito ──");
const RR = { ...R, desde: "1", hasta: "1000" };
ok(ultimoEfectivo({ ...RR, siguiente: "" }, 40) === 40 && ultimoEfectivo({ ...RR, siguiente: "301" }, 40) === 300 && ultimoEfectivo({ ...RR, siguiente: "10" }, 40) === 40, "último usado = mayor entre emitido por la app y consecutivo − 1");
ok(estadoFolios(RR, ultimoEfectivo({ ...RR, siguiente: "976" }, 0)).disponibles === 25 && estadoFolios(RR, 975).estado === "por_agotarse", "migración: consecutivo 976 → quedan 25 → aviso");
const al = (ult, hoy) => alertasResolucion({ resolucion: RR, ultimo: ult, estadoRes: estadoResolucion(RR, hoy) }).map((a) => a.clave).join();
ok(al(974, "2026-06-01") === "" && al(975, "2026-06-01") === "folios_por_agotarse" && al(1000, "2026-06-01") === "folios_agotados", "alerta de folios: sin aviso con 26, aviso con 25, agotada con 0");
ok(al(0, "2026-12-17") === "resolucion_por_vencer" && al(0, "2026-12-16") === "" && al(0, "2027-01-02") === "resolucion_vencida", "alerta de vigencia: 16 días sin aviso, 15 días con aviso, vencida");

console.log("\n── Conversión POS → Factura (> 5 UVT) ──");
const base = { modo: "pruebas", tipoDocumento: "pos", impuesto: "inc", precios: "incluyen", propina: "excluir", valorUvt: 52374, resolucion: R, emisor: EM };
const cta = (precio) => ({ cuenta: { id: "c9", mesa: 1, pagadaTs: 1_760_000_000_000, pagos: [], datosFiscales: null }, pedidos: [{ estado: "listo", items: [{ id: "x", name: "Cena", qty: 1, price: precio }] }] });
let p = construirPayload({ ...cta(100000), ajustes: base });
ok(p.tipoDocumento === "pos" && !p.convertidoDePos, "cuenta bajo 5 UVT: sigue como Documento Equivalente POS");
p = construirPayload({ ...cta(300000), ajustes: base });
ok(p.tipoDocumento === "factura" && p.convertidoDePos === true, "cuenta sobre 5 UVT: se emite Factura Electrónica");
p = construirPayload({ ...cta(300000), ajustes: { ...base, convertirPos: false } });
ok(p.tipoDocumento === "pos", "con la conversión apagada se respeta POS");
p = construirPayload({ ...cta(300000), ajustes: { ...base, tipoDocumento: "factura" } });
ok(p.tipoDocumento === "factura" && !p.convertidoDePos, "tipo Factura: no hay conversión");
ok(construirPayload({ ...cta(100000), ajustes: base }).cliente.numero === "222222222222", "sin cédula: Consumidor Final 222222222222");

console.log(`\n${total - fallas}/${total} pruebas correctas${fallas ? ` · ${fallas} fallaron` : ""}.`);
process.exit(fallas ? 1 : 0);

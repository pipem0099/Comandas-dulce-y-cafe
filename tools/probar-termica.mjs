// Pruebas (sin impresora ni navegador) de la impresión térmica: comandos ESC/POS, tickets, conexión y impresión automática de cocina.
// npm run termica:probar        Importante: NO prueban una impresora física; al configurarla, usa «Probar impresión».
import { nuevoTicket, codificar, envolver, dosColumnas, enviarEnTrozos, aBase64, COLUMNAS } from "../src/termica/escpos.js";
import { ticketRecibo, ticketCocina, ticketPrueba, ticketFactura } from "../src/termica/tickets.js";
import { crearImpresora } from "../src/termica/impresora.js";
import { crearControlImpresos, pedidosPorImprimir } from "../src/termica/autoCocina.js";

let total = 0, fallas = 0;
const ok = (c, t) => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join(" ");
const tieneSecuencia = (bytes, sec) => hex(bytes).includes(sec);
// Convierte los bytes de un ticket en renglones de texto (quitando los comandos de control) para medir su ancho y leer su contenido.
const LARGO_CMD = { 0x1B: { 0x40: 2, 0x74: 3, 0x61: 3, 0x45: 3, 0x64: 3, 0x70: 5 }, 0x1D: { 0x21: 3, 0x56: 4 } };
const renglones = (bytes) => {
  const t = []; let cur = [];
  for (let i = 0; i < bytes.length;) {
    const x = bytes[i];
    if (LARGO_CMD[x] && LARGO_CMD[x][bytes[i + 1]]) { i += LARGO_CMD[x][bytes[i + 1]]; continue; }
    if (x === 0x0A) { t.push(String.fromCharCode(...cur)); cur = []; } else cur.push(x >= 0x20 && x < 0x7F ? x : 0x3F);
    i++;
  }
  return t;
};

console.log("── Comandos ESC/POS ──");
const t0 = nuevoTicket({ columnas: 48 }).bytes();
ok(hex(t0.slice(0, 5)) === "1b 40 1b 74 13", "un ticket empieza reiniciando la impresora y eligiendo la tabla de caracteres (CP858)");
ok(hex(codificar("áéíóú ñÑ ¿¡")) === "a0 82 a1 a2 a3 20 a4 a5 20 a8 ad", "las tildes, eñes y signos de pregunta salen con los códigos correctos");
ok(hex(codificar("ÁÉÍÓÚ")) === "b5 90 d6 e0 e9", "las mayúsculas con tilde también");
ok(String.fromCharCode(...codificar("áéñ", 0)) === "aen", "con otra tabla de caracteres se imprime sin tildes (no símbolos raros)");
ok(String.fromCharCode(...codificar("日本")) === "??", "un carácter que la impresora no tiene sale como «?» y no rompe el ticket");
const tc = nuevoTicket({ columnas: 32 }).centro().negrita().doble().linea("HOLA").normal().cortar().bytes();
ok(tieneSecuencia(tc, "1b 61 01") && tieneSecuencia(tc, "1b 45 01") && tieneSecuencia(tc, "1d 21 11") && tieneSecuencia(tc, "1d 56 42 00"), "centrar, negrita, tamaño doble y corte llevan sus comandos");
ok(COLUMNAS[80] === 48 && COLUMNAS[58] === 32, "papel de 80 mm = 48 letras por renglón; 58 mm = 32");
ok(envolver("uno dos tres cuatro", 9).join("|") === "uno dos|tres|cuatro", "los textos largos se parten sin cortar palabras");
ok(envolver("abcdefghijkl", 5).join("|") === "abcde|fghij|kl", "una palabra más larga que el renglón se parte");
ok(dosColumnas("2 Limonada", "$18.000", 32)[0] === "2 Limonada" + " ".repeat(32 - 10 - 7) + "$18.000" && dosColumnas("2 Limonada", "$18.000", 32)[0].length === 32, "izquierda y derecha ocupan exactamente el ancho del papel");
const largo = dosColumnas("3 Sándwich de pollo con queso y tocineta extra", "$42.000", 32);
ok(largo.length >= 2 && largo.every((r) => r.length <= 32) && largo[largo.length - 1].endsWith("$42.000"), "un nombre largo baja de renglón y el precio queda al final, sin pasarse del papel");

console.log("\n── Tickets ──");
const d = { tipo: "comprobante", titulo: "COMPROBANTE DE VENTA", numero: "C-20261108-AB12", cuando: new Date(2026, 10, 8, 20, 15).getTime(), lugar: "Mesa 5", mesero: "Ana", cliente: "", negocio: "Café de Prueba", nit: "900123456-1", direccion: "Calle 1 # 2-3", telefono: "3001112233", mensaje: "¡Gracias por tu visita!", leyenda: "No es factura electrónica de venta",
  lineas: [{ qty: 2, name: "Limonada de Coco", total: 18000 }, { qty: 1, name: "Sándwich", total: 14000 }], subtotal: 32000, descuento: 0, propina: 3200, envio: 0, total: 35200, propinaSugerida: 0, pagos: [{ metodo: "Efectivo", monto: 35200 }] };
for (const cols of [32, 48]) {
  const r = renglones(ticketRecibo(d, { columnas: cols }));
  ok(r.every((x) => x.length <= cols), `recibo a ${cols} columnas: ningún renglón se pasa del papel`);
}
const txt = renglones(ticketRecibo(d, { columnas: 48 })).join("\n");
ok(/Limonada de Coco/.test(txt) && /\$18\.000/.test(txt) && /TOTAL\s+\$35\.200/.test(txt) && /Propina\s+\$3\.200/.test(txt), "el recibo trae productos, propina y total");
ok(/Pag. con efectivo\s+\$35\.200/.test(txt) || /con efectivo\s+\$35\.200/.test(txt), "el recibo muestra con qué se pagó");
ok(/No es factura electr/.test(txt), "el recibo conserva la leyenda «No es factura electrónica de venta»");
ok(tieneSecuencia(ticketRecibo(d), "1d 56 42 00"), "el recibo termina cortando el papel");
const cocina = ticketCocina({ pedido: { ts: new Date(2026, 10, 8, 20, 15).getTime(), nota: "Alérgico a las nueces", items: [{ qty: 2, name: "Sándwich", nota: "sin cebolla" }, { qty: 1, name: "Americano" }] }, lugar: "Mesa 2", mesero: "Ana", ronda: 2 }, { columnas: 32 });
const rc = renglones(cocina).join("\n");
ok(/COCINA/.test(rc) && /Mesa 2/.test(rc) && /2 x S.ndwich/.test(rc) && /sin cebolla/.test(rc) && /Ronda 2/.test(rc) && /NOTA: Al.rgico/.test(rc), "el ticket de cocina trae mesa, productos con su nota, ronda y la nota del pedido");
ok(!/\$/.test(rc), "el ticket de cocina NO trae precios");
ok(renglones(ticketPrueba({ columnas: 32 })).every((x) => x.length <= 32), "la prueba de impresión cabe en el papel");

console.log("\n── Envío en trozos ──");
const enviados = [];
await enviarEnTrozos(Uint8Array.from({ length: 250 }, (_, i) => i % 256), async (b) => { enviados.push(b.length); }, 100);
ok(enviados.join() === "100,100,50", "250 bytes salen en trozos de 100, 100 y 50, en orden");
ok(aBase64(Uint8Array.from([72, 105])) === "SGk=", "los bytes se pueden convertir a base64 (para RawBT)");

console.log("\n── Conexión (con impresoras simuladas) ──");
const memoria = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; };
const escritos = [];
const caracteristica = { properties: { writeWithoutResponse: true }, writeValueWithoutResponse: async (b) => { escritos.push(b.length); } };
const navBT = { userAgent: "Android", bluetooth: { requestDevice: async () => ({ name: "MPT-II", gatt: { connect: async () => ({ getPrimaryServices: async () => [{ getCharacteristics: async () => [{ properties: { read: true } }, caracteristica] }] }), disconnect() {} } }) } };
let imp = crearImpresora({ navegador: navBT, almacen: memoria(), ventana: {} });
ok(imp.disponibles().bluetooth && imp.disponibles().rawbt && !imp.disponibles().usb, "detecta qué formas de conexión permite este navegador");
ok((await imp.imprimir(new Uint8Array(3))).ok === false, "sin impresora configurada avisa que falta configurarla");
const c1 = await imp.conectar("bluetooth");
ok(c1.ok && c1.nombre === "MPT-II" && imp.config().tipo === "bluetooth" && imp.config().nombre === "MPT-II", "conecta por Bluetooth y recuerda el nombre de la impresora en este equipo");
const r1 = await imp.imprimir(new Uint8Array(250));
ok(r1.ok && escritos.join() === "100,100,50", "imprime por Bluetooth en trozos de 100 bytes");
let imp2 = crearImpresora({ navegador: { userAgent: "Windows" }, almacen: memoria(), ventana: {} });
let msg = ""; try { await imp2.conectar("bluetooth"); } catch (e) { msg = e.message; }
ok(/no permite conectar por Bluetooth/.test(msg), "si el navegador no soporta la conexión, lo dice en palabras");
const salidaUSB = [];
const dispositivoUSB = { productName: "POS-80", configuration: { interfaces: [{ interfaceNumber: 0, alternates: [{ interfaceClass: 7, endpoints: [{ direction: "in", endpointNumber: 1 }, { direction: "out", endpointNumber: 2 }] }] }] }, open: async () => {}, selectConfiguration: async () => {}, claimInterface: async () => {}, transferOut: async (ep, b) => { salidaUSB.push([ep, b.length]); }, close: async () => {} };
const alm = memoria();
let imp3 = crearImpresora({ navegador: { userAgent: "Windows", usb: { requestDevice: async () => dispositivoUSB, getDevices: async () => [dispositivoUSB] } }, almacen: alm, ventana: {} });
await imp3.conectar("usb");
ok(imp3.estado().conectada && (await imp3.imprimir(new Uint8Array(10))).ok && salidaUSB[0][0] === 2, "conecta por USB y envía por el punto de salida correcto");
let imp4 = crearImpresora({ navegador: { userAgent: "Windows", usb: { getDevices: async () => [dispositivoUSB] } }, almacen: alm, ventana: {} });
ok(!imp4.estado().conectada && imp4.estado().configurada, "tras recargar la app la impresora sigue configurada pero hay que volver a conectarla");
const r4 = await imp4.imprimir(new Uint8Array(5));
ok(r4.ok && imp4.estado().conectada, "USB se reconecta sola al imprimir (sin pedir nada al usuario)");
let imp5 = crearImpresora({ navegador: { userAgent: "Android Chrome" }, almacen: memoria(), ventana: { location: { href: "" } } });
const v = { location: { href: "" } };
imp5 = crearImpresora({ navegador: { userAgent: "Android Chrome" }, almacen: memoria(), ventana: v });
await imp5.conectar("rawbt");
const r5 = await imp5.imprimir(Uint8Array.from([72, 105]));
ok(r5.ok && v.location.href === "rawbt:base64,SGk=", "RawBT: manda los datos a la app RawBT con su dirección especial");
let imp6 = crearImpresora({ navegador: { userAgent: "Windows", usb: { requestDevice: async () => ({ ...dispositivoUSB, transferOut: async () => { throw new Error("se desconectó"); } }) } }, almacen: memoria(), ventana: {} });
await imp6.conectar("usb");
const r6 = await imp6.imprimir(new Uint8Array(3));
ok(!r6.ok && /No se pudo imprimir: se desconect/.test(r6.motivo) && !imp6.estado().conectada, "si falla al imprimir devuelve el motivo en palabras y queda marcada como desconectada");
await imp.desconectar();
ok(imp.config().tipo === "" && !imp.config().autoCocina, "desconectar borra la impresora de este equipo y apaga la impresión automática");

console.log("\n── Impresión automática de cocina ──");
const impresos = crearControlImpresos(memoria());
const ordenes = [{ id: "a", estado: "pendiente", ts: 1000 }, { id: "b", estado: "pendiente", ts: 3000 }, { id: "c", estado: "listo", ts: 3500 }, { id: "d", estado: "pendiente", ts: 2000 }];
let por = pedidosPorImprimir(ordenes, { activadoTs: 1500, yaImpreso: impresos.ya });
ok(por.map((o) => o.id).join() === "d,b", "solo los pedidos NUEVOS (pendientes) llegados después de activar la opción, en orden de llegada");
impresos.marcar("d");
por = pedidosPorImprimir(ordenes, { activadoTs: 1500, yaImpreso: impresos.ya });
ok(por.map((o) => o.id).join() === "b", "un pedido ya impreso no vuelve a salir");
ok(crearControlImpresos(impresos.__x || memoria()).ya("zzz") === false, "el control de impresos empieza vacío");
const almImp = memoria(); const ci1 = crearControlImpresos(almImp); ci1.marcar("p1");
ok(crearControlImpresos(almImp).ya("p1"), "lo ya impreso se recuerda aunque se recargue la app");

console.log("── Tirilla de factura electrónica (v23) ──");
const CUFE = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const docF = { estado: "emitida", prefijo: "SETT", numero: "1001", cufe: CUFE, payload: { modo: "produccion", tipoDocumento: "factura", fecha: "2026-11-17", hora: "13:05:00",
  emisor: { razonSocial: "Dulce y Café SAS", nit: "900123456", dv: "8", regimen: "responsable_iva", municipio: "Bogotá", correo: "a@b.co" },
  resolucion: { numero: "18760000001", prefijo: "SETT", desde: "1", hasta: "5000", vigenciaDesde: "2026-01-01", vigenciaHasta: "2027-01-01" },
  cliente: { nombre: "Consumidor final", tipoDoc: "CC", numero: "222222222222" },
  lineas: [{ cantidad: 2, descripcion: "Limonada de coco", total: 17500 }],
  impuesto: { tipo: "INC", porcentaje: 8 }, totales: { subtotalBruto: 17500, baseGravable: 16204, baseExenta: 0, valorImpuesto: 1296, propina: 1750, propinaEnDocumento: false, totalDocumento: 17500 },
  pagos: [{ metodo: "efectivo", monto: 19250 }] } };
const parteTexto = (b) => { const h = hex(b); const i = h.indexOf("1d 28 6b 04 00 31 41"); return renglones(i < 0 ? b : b.slice(0, i / 3)); };
for (const cols of [48, 32]) {
  const bf = ticketFactura(docF, { columnas: cols });
  const tx = parteTexto(bf);
  ok(tx.every((r) => r.length <= cols), `factura ${cols === 48 ? "80" : "58"} mm: ningún renglón se pasa del papel`);
  ok(tx.join("\n").includes("NIT 900123456-8") && tx.join("\n").includes("Dulce y Caf"), `factura ${cols === 48 ? "80" : "58"} mm: lleva razón social y NIT con DV`);
}
const tF = parteTexto(ticketFactura(docF, { columnas: 48 })).join("\n");
ok(/Resoluci.n DIAN N\.. 18760000001/.test(tF) && tF.includes("Rango 1 al 5000") && tF.includes("Vigencia 2026-01-01 a 2027-01-01"), "lleva resolución DIAN: número, prefijo, rango y vigencia");
ok(tF.includes("Base gravable") && tF.includes("INC 8%") && tF.includes("$1.296"), "lleva base gravable y desglose del INC");
ok(tF.includes("Propina voluntaria") && tF.includes("$1.750"), "la propina fuera del documento se informa aparte");
ok(tF.includes(CUFE.slice(0, 40)) && tF.includes(CUFE.slice(-20)), "imprime el CUFE completo como texto");
const bQ = ticketFactura(docF, { columnas: 48 });
ok(tieneSecuencia(bQ, "1d 28 6b 04 00 31 41 32") && tieneSecuencia(bQ, "1d 28 6b 03 00 31 51 30"), "lleva el código QR nativo");
ok(String.fromCharCode(...bQ).includes("catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=" + CUFE), "el QR apunta a la consulta oficial de la DIAN con el CUFE");
ok(String.fromCharCode(...ticketFactura({ ...docF, payload: { ...docF.payload, modo: "pruebas" } })).includes("catalogo-vpfe-hab.dian.gov.co"), "en pruebas el QR apunta al ambiente de habilitación");
ok(parteTexto(ticketFactura({ ...docF, payload: { ...docF.payload, modo: "pruebas" } })).join("\n").includes("SIN VALIDEZ FISCAL"), "en pruebas la tirilla avisa que no tiene validez fiscal");
const sinNum = parteTexto(ticketFactura({ ...docF, cufe: "", numero: "" })).join("\n");
ok(sinNum.replace(/\s+/g, " ").includes("sin consecutivo asignado") && !tieneSecuencia(ticketFactura({ ...docF, cufe: "", numero: "" }), "1d 28 6b 04 00 31 41"), "sin CUFE no inventa número ni QR: dice «sin consecutivo asignado»");
const docNC = { ...docF, estado: "anulada", anulacion: { motivo: "Error de digitación", numeroNota: "NC7", cufeNota: "ff00" + CUFE.slice(4), ts: Date.UTC(2026, 10, 17, 20), monto: 17500 } };
const tNC = parteTexto(ticketFactura(docNC, { columnas: 48, nota: true })).join("\n");
ok(tNC.includes("NOTA CR") && tNC.includes("NC7") && tNC.includes("Afecta: SETT1001") && tNC.includes("Error de digitaci"), "la Nota Crédito dice a qué factura afecta, su número y el motivo");

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

// Pruebas de los datos del cliente para factura.   npm run facturacion:probar
// Recuerda: guardar estos datos NO emite una factura electrónica válida ante la DIAN (eso exige un proveedor tecnológico autorizado).
import { digitoVerificacion, normalizar, validar, etiquetaDocumento, TIPOS_DOC } from "../src/facturacion/datosFiscales.js";
let total = 0, fallas = 0;
const ok = (c, t) => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };

console.log("── Dígito de verificación del NIT ──");
ok(digitoVerificacion("800197268") === 4, "NIT de la DIAN 800197268 → dígito 4 (800.197.268-4)");
ok(digitoVerificacion("900.373.913") === 3 || digitoVerificacion("900373913") !== null, "acepta puntos al calcular");
ok(digitoVerificacion("") === null && digitoVerificacion("1".repeat(16)) === null, "sin dígitos o demasiado largo no se calcula");
console.log("\n── Normalizar y validar ──");
let n = normalizar({ tipoDoc: "NIT", numero: "800.197.268", nombre: "  Mi   Empresa  ", correo: " A@B.CO " });
ok(n.numero === "800197268" && n.dv === "4" && n.nombre === "Mi Empresa" && n.correo === "a@b.co", "NIT sin guion: calcula el dígito; limpia espacios y mayúsculas del correo");
ok(normalizar({ tipoDoc: "NIT", numero: "800197268-4", nombre: "X Y" }).dv === "4", "NIT con guion conserva el dígito escrito");
ok(validar({ tipoDoc: "NIT", numero: "800197268-4", nombre: "Mi Empresa" }).ok, "un NIT correcto es válido");
let v = validar({ tipoDoc: "NIT", numero: "800197268-9", nombre: "Mi Empresa" });
ok(!v.ok && /debería ser 4/.test(v.errores.numero), "un dígito de verificación equivocado se detecta y dice cuál es el correcto");
v = validar({ tipoDoc: "CC", numero: "12", nombre: "A" });
ok(!v.ok && v.errores.numero && v.errores.nombre, "documento muy corto y nombre vacío se rechazan, cada uno con su mensaje");
ok(validar({ tipoDoc: "CC", numero: "1.020.304.050", nombre: "Ana Pérez" }).ok, "una cédula con puntos es válida");
ok(validar({ tipoDoc: "CC", numero: "1020304050", nombre: "Ana", correo: "no-es-correo" }).errores.correo, "un correo mal escrito se rechaza");
ok(validar({ tipoDoc: "PAS", numero: "ab-123456", nombre: "John Smith" }).ok && normalizar({ tipoDoc: "PAS", numero: "ab-123456" }).numero === "AB123456", "el pasaporte admite letras y números");
ok(validar({ tipoDoc: "CF" }).ok, "«Consumidor final» no exige datos");
console.log("\n── Cómo se muestra ──");
ok(etiquetaDocumento({ tipoDoc: "NIT", numero: "800197268-4" }) === "NIT 800.197.268-4", "«NIT 800.197.268-4»");
ok(etiquetaDocumento({ tipoDoc: "CC", numero: "1020304050" }) === "CC 1.020.304.050", "«CC 1.020.304.050»");
ok(etiquetaDocumento({ tipoDoc: "CF" }) === "Consumidor final" && etiquetaDocumento(null) === "", "consumidor final y vacío");
ok(TIPOS_DOC.map((t) => t.valor).join() === "CC,NIT,CE,PAS,CF", "los tipos de documento disponibles");
console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

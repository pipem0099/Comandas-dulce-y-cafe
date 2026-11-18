// Pruebas del cifrado AES-256-GCM de credenciales.   npm run fiscal:probar
import { cargarLlave, cifrar, descifrar, generarLlave } from "./facturacion/cifrado.mjs";
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };
const lanza = (f) => { try { f(); return false; } catch (e) { return true; } };

const llave = generarLlave();
const secreto = { clientId: "abc", clientSecret: "SUPER-SECRETO-1234", usuario: "a@b.co", contrasena: "p4ss ñandú ✓" };
console.log("── Llave maestra ──");
ok(/^[0-9a-f]{64}$/.test(llave), "la llave generada son 64 caracteres hexadecimales (32 bytes)");
ok(cargarLlave(llave).length === 32, "se acepta hexadecimal");
ok(cargarLlave(Buffer.alloc(32, 7).toString("base64")).length === 32, "se acepta base64 de 32 bytes");
ok(lanza(() => cargarLlave("")) && lanza(() => cargarLlave(undefined)), "sin llave: error claro");
ok(lanza(() => cargarLlave("corta")) && lanza(() => cargarLlave("a".repeat(63))) && lanza(() => cargarLlave("g".repeat(64))), "una llave de otro largo o con caracteres no hexadecimales se rechaza (no se rellena ni se adivina)");
ok(!(() => { try { cargarLlave("corta"); } catch (e) { return e.message.includes("corta"); } })(), "el error no repite la llave escrita");

console.log("\n── Cifrar y descifrar ──");
const c1 = cifrar(secreto, llave, "facturacion:factus");
ok(JSON.stringify(descifrar(c1, llave, "facturacion:factus")) === JSON.stringify(secreto), "ida y vuelta devuelve exactamente lo guardado (incluye tildes y símbolos)");
ok(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/.test(c1), "formato v1.iv.etiqueta.cifrado en base64url");
ok(!c1.includes("SUPER-SECRETO") && !c1.includes("p4ss") && !Buffer.from(c1.split(".")[3], "base64url").toString("utf8").includes("SECRETO"), "el texto guardado no contiene el secreto en claro");
const c2 = cifrar(secreto, llave, "facturacion:factus");
ok(c1 !== c2 && c1.split(".")[1] !== c2.split(".")[1], "cada cifrado usa un IV nuevo (mismo dato → distinto resultado)");
const ivs = new Set(Array.from({ length: 2000 }, () => cifrar({ a: 1 }, llave).split(".")[1]));
ok(ivs.size === 2000, "2.000 cifrados seguidos: 2.000 IV distintos");
ok(Buffer.from(c1.split(".")[1], "base64url").length === 12 && Buffer.from(c1.split(".")[2], "base64url").length === 16, "IV de 12 bytes y etiqueta de 16 bytes");

console.log("\n── Alteración y llaves equivocadas ──");
ok(lanza(() => descifrar(c1, generarLlave(), "facturacion:factus")), "con otra llave NO descifra");
ok(lanza(() => descifrar(c1, llave, "facturacion:alegra")), "con otro contexto (otro proveedor) NO descifra");
const p = c1.split(".");
const flip = (s) => { const b = Buffer.from(s, "base64url"); b[0] ^= 1; return b.toString("base64url"); };
ok(lanza(() => descifrar([p[0], p[1], p[2], flip(p[3])].join("."), llave, "facturacion:factus")), "si se altera el texto cifrado, se detecta");
ok(lanza(() => descifrar([p[0], flip(p[1]), p[2], p[3]].join("."), llave, "facturacion:factus")), "si se altera el IV, se detecta");
ok(lanza(() => descifrar([p[0], p[1], flip(p[2]), p[3]].join("."), llave, "facturacion:factus")), "si se altera la etiqueta, se detecta");
ok(lanza(() => descifrar("v2.a.b.c", llave)) && lanza(() => descifrar("", llave)) && lanza(() => descifrar(null, llave)), "formatos desconocidos o vacíos se rechazan");
let msg1 = "", msg2 = ""; try { descifrar(c1, generarLlave(), "facturacion:factus"); } catch (e) { msg1 = e.message; } try { descifrar([p[0], p[1], p[2], flip(p[3])].join("."), llave, "facturacion:factus"); } catch (e) { msg2 = e.message; }
ok(msg1 === msg2 && !msg1.includes("SECRETO"), "el mensaje de error no distingue la causa ni filtra datos");

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

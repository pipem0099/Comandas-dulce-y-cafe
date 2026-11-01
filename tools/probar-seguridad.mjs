// Pruebas locales (sin internet) de las defensas que no son reglas de base de datos:
// clave filtrada, identificadores, tipo real de las imágenes.   npm run seguridad:probar
import { claveFiltrada } from "../src/clavesSeguras.js";
import { uid } from "../src/logica.js";
import { firmaImagenCoincide } from "../netlify/lib/menuFoto.mjs";
import { createHash } from "node:crypto";

let total = 0, fallas = 0;
const ok = (cond, texto) => { total++; if (!cond) fallas++; console.log(`${cond ? "✔" : "✘"} ${texto}`); };

console.log("── Claves filtradas ──");
const sha = (t) => createHash("sha1").update(t).digest("hex").toUpperCase();
let pedido = "";
const falsoServicio = (filtradas) => async (url) => {
  pedido = url;
  const prefijo = url.split("/").pop();
  const lineas = filtradas.filter((c) => sha(c).startsWith(prefijo)).map((c) => `${sha(c).slice(5)}:12345`);
  return { ok: true, text: async () => ["0018A45C4D1DEF81644B54AB7F969B88D65:0", ...lineas].join("\r\n") };
};
ok(await claveFiltrada("password123", { fetchFn: falsoServicio(["password123"]) }) === true, "detecta una clave que aparece en filtraciones");
ok(await claveFiltrada("una-clave-larga-y-rara-9X!", { fetchFn: falsoServicio(["password123"]) }) === false, "deja pasar una clave que no aparece");
await claveFiltrada("password123", { fetchFn: falsoServicio([]) });
ok(/\/range\/[0-9A-F]{5}$/.test(pedido) && !pedido.includes("password123"), "solo envía 5 caracteres del hash, nunca la clave");
ok(await claveFiltrada("x", { fetchFn: async () => { throw new Error("sin internet"); } }) === false, "sin internet no bloquea a nadie");
ok(await claveFiltrada("x", { fetchFn: async () => ({ ok: false }) }) === false, "si el servicio falla no bloquea a nadie");

console.log("\n── Identificadores ──");
const ids = new Set(Array.from({ length: 5000 }, () => uid()));
ok(ids.size === 5000, "5000 identificadores sin repetirse");
ok([...ids].every((i) => /^[0-9a-f]{16}$/.test(i)), "16 caracteres hexadecimales");

console.log("\n── Tipo real de la imagen ──");
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const jpg = b64([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]); const png = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const html = Buffer.from("<html><script>alert(1)</script>").toString("base64");
ok(firmaImagenCoincide("image/jpeg", jpg), "un JPEG real se acepta como JPEG");
ok(firmaImagenCoincide("image/png", png), "un PNG real se acepta como PNG");
ok(!firmaImagenCoincide("image/jpeg", png), "un PNG que dice ser JPEG se rechaza");
ok(!firmaImagenCoincide("image/png", html), "un HTML disfrazado de imagen se rechaza");
ok(!firmaImagenCoincide("image/svg+xml", html), "tipos no permitidos se rechazan");

console.log(`\n${total - fallas} de ${total} pruebas cumplen lo esperado.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron.`); process.exit(1); }

// Prueba LOCAL (sin internet, sin Netlify, sin clave real de IA) de la función "menú desde una foto".
// Simula: el inicio de sesión de Firebase (con una firma real), el perfil del usuario y la respuesta de la IA.
//   npm run menu-foto:probar
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSign } from "node:crypto";
import { parsearMenuTexto, filasParaRevisar, aplicarFilas, normalizarNombre, unirCategorias } from "../src/menuFotoLogica.js";
import { verificarTokenFirebase, esAdminActivo, permitirUso, extraerJSON, normalizarMenuIA, leerPrecio } from "../netlify/lib/menuFoto.mjs";

let total = 0, fallas = 0;
const ok = (cond, texto) => { total++; if (!cond) fallas++; console.log(`${cond ? "✔" : "✘"} ${texto}`); };
const lanza = async (fn) => { try { await fn(); return false; } catch (e) { return true; } };

/* ── certificado y llaves de prueba (como los que publica Google) ── */
const dir = mkdtempSync(join(tmpdir(), "menufoto-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "k.pem"), "-out", join(dir, "c.pem"), "-subj", "/CN=prueba", "-days", "2"], { stdio: "ignore" });
const llavePrivada = readFileSync(join(dir, "k.pem"), "utf8"); const certificado = readFileSync(join(dir, "c.pem"), "utf8");
const b64u = (b) => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const PROYECTO = "negocio-prueba"; const AHORA = Date.UTC(2026, 9, 24, 12, 0, 0); const SEG = Math.floor(AHORA / 1000);
function crearToken({ kid = "k1", alg = "RS256", aud = PROYECTO, iss = `https://securetoken.google.com/${PROYECTO}`, exp = SEG + 3600, iat = SEG - 10, sub = "uid-admin", llave = llavePrivada } = {}) {
  const cab = b64u(JSON.stringify({ alg, kid, typ: "JWT" })), carga = b64u(JSON.stringify({ aud, iss, exp, iat, sub }));
  const firma = createSign("RSA-SHA256").update(`${cab}.${carga}`).sign(llave);
  return `${cab}.${carga}.${b64u(firma)}`;
}
const certificados = async () => ({ k1: certificado });

console.log("── Inicio de sesión de Firebase ──");
ok((await verificarTokenFirebase(crearToken(), { projectId: PROYECTO, ahora: AHORA, certificados })).uid === "uid-admin", "acepta una sesión válida y devuelve el usuario");
ok(await lanza(() => verificarTokenFirebase(crearToken({ exp: SEG - 5 }), { projectId: PROYECTO, ahora: AHORA, certificados })), "rechaza una sesión vencida");
ok(await lanza(() => verificarTokenFirebase(crearToken({ aud: "otro-proyecto" }), { projectId: PROYECTO, ahora: AHORA, certificados })), "rechaza una sesión de OTRO proyecto de Firebase");
ok(await lanza(() => verificarTokenFirebase(crearToken({ iss: "https://evil.example" }), { projectId: PROYECTO, ahora: AHORA, certificados })), "rechaza un emisor falso");
ok(await lanza(() => verificarTokenFirebase(crearToken({ kid: "desconocida" }), { projectId: PROYECTO, ahora: AHORA, certificados })), "rechaza una llave desconocida");
ok(await lanza(() => verificarTokenFirebase(crearToken({ alg: "none" }), { projectId: PROYECTO, ahora: AHORA, certificados })), "rechaza un token sin firma (alg none)");
{ const t = crearToken().split("."); const falso = [t[0], b64u(JSON.stringify({ aud: PROYECTO, iss: `https://securetoken.google.com/${PROYECTO}`, exp: SEG + 3600, sub: "otro-uid" })), t[2]].join(".");
  ok(await lanza(() => verificarTokenFirebase(falso, { projectId: PROYECTO, ahora: AHORA, certificados })), "rechaza un token con los datos cambiados a mano"); }
{ const otra = readFileSync(join(dir, "k.pem"), "utf8"); void otra;
  execFileSync("openssl", ["genrsa", "-out", join(dir, "k2.pem"), "2048"], { stdio: "ignore" });
  ok(await lanza(() => verificarTokenFirebase(crearToken({ llave: readFileSync(join(dir, "k2.pem"), "utf8") }), { projectId: PROYECTO, ahora: AHORA, certificados })), "rechaza un token firmado con otra llave"); }
ok(await lanza(() => verificarTokenFirebase("", { projectId: PROYECTO, ahora: AHORA, certificados })), "rechaza si no hay sesión");

console.log("\n── Permiso de administrador ──");
const perfil = (p, okHttp = true) => async () => ({ ok: okHttp, json: async () => p });
ok(await esAdminActivo({ uid: "u", token: "t", databaseUrl: "https://x.firebaseio.com", fetchFn: perfil({ activo: true, roles: { admin: true } }) }) === true, "administrador activo: permitido");
ok(await esAdminActivo({ uid: "u", token: "t", databaseUrl: "https://x.firebaseio.com", fetchFn: perfil({ activo: false, roles: { admin: true } }) }) === false, "administrador desactivado: NO");
ok(await esAdminActivo({ uid: "u", token: "t", databaseUrl: "https://x.firebaseio.com", fetchFn: perfil({ activo: true, roles: { mesero: true } }) }) === false, "mesero: NO");
ok(await esAdminActivo({ uid: "u", token: "t", databaseUrl: "https://x.firebaseio.com", fetchFn: perfil(null) }) === false, "sin perfil: NO");
ok(await esAdminActivo({ uid: "u", token: "t", databaseUrl: "https://x.firebaseio.com", fetchFn: perfil({}, false) }) === false, "la base rechazó la lectura: NO");

console.log("\n── Límite de uso ──");
{ let permitidos = 0; for (let i = 0; i < 15; i++) if (permitirUso("limite", { ahora: AHORA })) permitidos++;
  ok(permitidos === 12, "deja pasar 12 por hora y frena el resto"); ok(permitirUso("limite", { ahora: AHORA + 61 * 60 * 1000 }), "después de una hora vuelve a permitir"); }

console.log("\n── Lo que devuelve la IA se limpia ──");
ok(extraerJSON("```json\n{\"categorias\":[]}\n```") !== null, "entiende un JSON dentro de ```");
ok(extraerJSON("Claro, aquí está: {\"categorias\":[]} listo") !== null, "entiende un JSON con texto alrededor");
ok(extraerJSON("no es json") === null, "texto sin JSON → null");
{ const n = normalizarMenuIA({ categorias: [
  { nombre: "  Bebidas   calientes ", productos: [{ nombre: "Tinto", precio: "3.000" }, { nombre: "Café con leche", precio: 4500.4 }, { nombre: "", precio: 1000 }] },
  { nombre: "Postres", productos: [{ nombre: "Brownie", precio: 9 }, { nombre: "Torta", precio: 0 }, { nombre: "Raro", precio: -5 }, { nombre: "Carísimo", precio: 99999999 }] },
  { nombre: "Vacía", productos: [] },
] });
  ok(n.categorias.length === 2, "descarta categorías vacías y productos sin nombre");
  ok(n.categorias[0].nombre === "Bebidas calientes", "limpia espacios en los nombres");
  ok(n.categorias[0].productos[0].precio === 3000 && !n.categorias[0].productos[0].dudoso, "\"3.000\" → 3000");
  ok(n.categorias[0].productos[1].precio === 4500, "redondea los pesos");
  ok(n.categorias[1].productos[0].precio === 9000 && n.categorias[1].productos[0].dudoso, "un 9 suelto se toma como 9.000 y se marca dudoso");
  ok(n.categorias[1].productos.slice(1).every((p) => p.precio === 0 && p.dudoso), "precio 0, negativo o absurdo → 0 y dudoso"); }
{ const muchos = { categorias: [{ nombre: "X", productos: Array.from({ length: 400 }, (_, i) => ({ nombre: `P${i}`, precio: 1000 })) }] };
  ok(normalizarMenuIA(muchos).total === 150, "nunca pasa de 150 productos"); }
{ const v = (x) => Math.round(leerPrecio(x).valor);
  ok(v("6.500") === 6500 && v("12,000") === 12000 && v("$ 4.500") === 4500 && v("1.250.000") === 1250000 && v(4500) === 4500, "precios a la colombiana: 6.500 · 12,000 · $ 4.500 · 1.250.000");
  ok(v("9k") === 9000 && leerPrecio("9k").abreviado && v("9 mil") === 9000 && leerPrecio("9 mil").abreviado, "\"9k\" y \"9 mil\" son 9000 y se marcan dudosos");
  const x = normalizarMenuIA({ categorias: [{ nombre: "A", productos: [{ nombre: "Latte", precio: "6.500" }, { nombre: "Té", precio: 6.5 }, { nombre: "Jugo", precio: "9k" }] }] }).categorias[0].productos;
  ok(x[0].precio === 6500 && !x[0].dudoso, "\"6.500\" queda en 6500 y NO se marca dudoso");
  ok(x[1].precio === 6500 && x[1].dudoso, "un 6.5 suelto se toma como 6.500 y se marca dudoso");
  ok(x[2].precio === 9000 && x[2].dudoso, "\"9k\" queda en 9000 y se marca dudoso"); }
ok(normalizarMenuIA({ categorias: [{ productos: [{ nombre: "Sin categoría", precio: 5000 }] }] }).categorias[0].nombre === "Carta", "sin categoría → \"Carta\"");

console.log("\n── Texto pegado de la carta ──");
{ const txt = `CARTA

BEBIDAS CALIENTES
Tinto ........ 3.000
Café con leche - $4.500
  con leche entera o deslactosada
1. Chocolate: 5000
• Aromática   2.500

Jugos
Jugo de mora en agua    7k
Limonada (grande) 9 mil
Brownie 6.500`;
  const r = parsearMenuTexto(txt);
  const nombres = r.categorias.map((c) => c.nombre);
  ok(nombres.join("|") === "Bebidas calientes|Jugos", "detecta las categorías (títulos en MAYÚSCULAS incluidos) y descarta títulos sin productos");
  const cal = r.categorias[0].productos;
  ok(cal.length === 4 && cal[0].nombre === "Tinto" && cal[0].precio === 3000, "Tinto ........ 3.000 → \"Tinto\" 3000");
  ok(cal[1].nombre === "Café con leche" && cal[1].precio === 4500 && cal[1].descripcion.startsWith("con leche"), "la línea de abajo en minúscula queda como descripción");
  ok(cal[2].nombre === "Chocolate" && cal[2].precio === 5000 && cal[3].nombre === "Aromática" && cal[3].precio === 2500, "quita la numeración y las viñetas (\"1.\" y \"•\")");
  ok(r.categorias[1].productos[0].precio === 7000 && r.categorias[1].productos[0].dudoso, "\"7k\" → 7000 y dudoso");
  ok(r.categorias[1].productos[2].precio === 6500 && !r.categorias[1].productos[2].dudoso, "Brownie 6.500 → 6500 sin duda");
  ok(parsearMenuTexto("").total === 0 && parsearMenuTexto("solo palabras sin precio").total === 0, "texto vacío o sin precios → nada"); }

console.log("\n── Combinar con el menú que ya existe ──");
{ const actual = [{ id: "a1", name: "Tinto", price: 2500, cost: 0, cat: "Bebidas Calientes" }, { id: "a2", name: "Té Chai", price: 6000, cost: 0, cat: "Bebidas Calientes" }];
  const nuevo = { categorias: [{ nombre: "BEBIDAS CALIENTES", productos: [{ nombre: "tinto", precio: 3000 }, { nombre: "Te chai", precio: 6000 }, { nombre: "Latte", precio: 6500 }] }, { nombre: "Postres", productos: [{ nombre: "Brownie", precio: 7000 }, { nombre: "Brownie", precio: 7000 }] }] };
  const filas = filasParaRevisar(nuevo, actual);
  ok(filas.length === 4, "no repite el mismo producto dentro de la misma categoría");
  ok(filas[0].cat === "Bebidas Calientes" && filas[0].existe && !filas[0].incluir && filas[0].precioActual === 2500, "reconoce que \"tinto\" ya existe (sin importar mayúsculas) y usa la categoría ya creada");
  ok(filas[1].existe && normalizarNombre("Té Chai") === normalizarNombre("Te chai"), "reconoce \"Té Chai\" = \"Te chai\" (sin tildes)");
  ok(filas[2].incluir && !filas[2].existe, "lo nuevo queda marcado para agregar");
  let n = 0; filas[0].incluir = true; // el dueño decide actualizar el precio del tinto
  const r2 = aplicarFilas(filas, actual, () => `nuevo${++n}`);
  ok(r2.agregados === 2 && r2.actualizados === 1 && r2.menu.length === 4, "agrega 2, actualiza 1 precio y no duplica");
  ok(r2.menu.find((m) => m.id === "a1").price === 3000 && r2.menu.find((m) => m.id === "a2").price === 6000, "solo cambia el precio del producto elegido");
  ok(r2.menu.slice(2).every((m) => m.cost === 0 && m.cat && m.name && m.id.startsWith("nuevo")), "los productos nuevos traen todo lo que pide la app (id, nombre, precio, costo, categoría)");
  const r3 = aplicarFilas(filasParaRevisar(nuevo, actual), actual, () => "x");
  ok(r3.actualizados === 0 && r3.agregados === 2, "por defecto NO toca lo que ya existe"); }

{ const u = unirCategorias([{ nombre: "Bebidas", productos: [{ nombre: "A" }] }, { nombre: "BEBIDAS", productos: [{ nombre: "B" }] }, { nombre: "Postres", productos: [{ nombre: "C" }] }]);
  ok(u.categorias.length === 2 && u.total === 3 && u.categorias[0].productos.length === 2, "varias fotos: la misma categoría (aunque cambie MAYÚSCULAS) se junta en una"); }

console.log("\n── La función completa (con IA y Firebase simuladas) ──");
const manejador = (await import("../netlify/functions/menu-desde-foto.mjs")).default;
Object.assign(process.env, { ANTHROPIC_API_KEY: "sk-prueba", VITE_FIREBASE_PROJECT_ID: PROYECTO, VITE_FIREBASE_DATABASE_URL: "https://negocio-prueba-default-rtdb.firebaseio.com" });
let perfilActual = { activo: true, roles: { admin: true } }; let respuestaIA = { estado: 200, texto: JSON.stringify({ categorias: [{ nombre: "Bebidas", productos: [{ nombre: "Tinto", precio: 3000 }, { nombre: "Latte", precio: "6.500" }] }] }) }; let ultimaLlamadaIA = null;
globalThis.fetch = async (url, opciones = {}) => {
  if (String(url).includes("googleapis.com/robot")) return { ok: true, headers: { get: () => "public, max-age=3600" }, json: async () => ({ k1: certificado }) };
  if (String(url).includes("firebaseio.com")) return { ok: perfilActual !== undefined, json: async () => perfilActual };
  if (String(url).includes("api.anthropic.com")) {
    ultimaLlamadaIA = { url: String(url), cabeceras: opciones.headers, cuerpo: JSON.parse(opciones.body) };
    if (respuestaIA.lanzar) { const e = new Error("abortado"); e.name = "AbortError"; throw e; }
    return { ok: respuestaIA.estado === 200, status: respuestaIA.estado, text: async () => "error", json: async () => ({ content: [{ type: "text", text: respuestaIA.texto }] }) };
  }
  throw new Error("Llamada inesperada: " + url);
};
const FOTO = "A".repeat(400);
const pedir = (cuerpo, { metodo = "POST", token = crearToken({ exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) - 10 }) } = {}) =>
  manejador(new Request("https://sitio.netlify.app/.netlify/functions/menu-desde-foto", { method: metodo, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined }));
{ const r = await pedir({}, { metodo: "GET" }); ok(r.status === 405, "GET → 405"); }
{ const r = await pedir({ tipo: "image/jpeg", datos: FOTO }, { token: "basura" }); ok(r.status === 401, "sesión falsa → 401"); }
{ perfilActual = { activo: true, roles: { mesero: true } }; const r = await pedir({ tipo: "image/jpeg", datos: FOTO }); ok(r.status === 403, "un mesero → 403"); perfilActual = { activo: true, roles: { admin: true } }; }
{ const r = await pedir({ tipo: "application/pdf", datos: FOTO }); ok(r.status === 400, "un PDF (no es imagen) → 400"); }
{ const r = await pedir({ tipo: "image/jpeg", datos: "A".repeat(5_100_000) }); ok(r.status === 413, "foto demasiado pesada → 413"); }
{ const r = await pedir({ tipo: "image/jpeg", datos: FOTO }); const j = await r.json();
  ok(r.status === 200 && j.total === 2 && j.categorias[0].productos[1].precio === 6500, "administrador + foto válida → menú ordenado");
  ok(ultimaLlamadaIA.cabeceras["x-api-key"] === "sk-prueba" && ultimaLlamadaIA.cabeceras["anthropic-version"] === "2023-06-01", "manda la clave y la versión de la API");
  ok(ultimaLlamadaIA.cuerpo.model === "claude-sonnet-5-5" && ultimaLlamadaIA.cuerpo.messages[0].content[0].type === "image" && ultimaLlamadaIA.cuerpo.messages[0].content[0].source.media_type === "image/jpeg", "manda el modelo y la imagen en el formato correcto"); }
{ respuestaIA = { estado: 200, texto: "{\"categorias\":[]}" }; const r = await pedir({ tipo: "image/png", datos: FOTO }); ok(r.status === 422, "la IA no encontró productos → 422 con mensaje claro"); }
{ respuestaIA = { estado: 401, texto: "" }; const r = await pedir({ tipo: "image/png", datos: FOTO }); const j = await r.json(); ok(r.status === 502 && j.error === "clave", "clave de IA mala o sin saldo → mensaje para el instalador"); }
{ respuestaIA = { lanzar: true }; const r = await pedir({ tipo: "image/png", datos: FOTO }); ok(r.status === 504, "la IA tarda demasiado → 504 con consejo"); }
{ respuestaIA = { estado: 429, texto: "" }; const r = await pedir({ tipo: "image/png", datos: FOTO }); ok(r.status === 429, "la IA está ocupada → 429"); }
{ delete process.env.ANTHROPIC_API_KEY; const r = await pedir({ tipo: "image/png", datos: FOTO }); ok(r.status === 503, "sin clave configurada → 503 \"no activada\""); process.env.ANTHROPIC_API_KEY = "sk-prueba"; }
{ respuestaIA = { estado: 200, texto: "{\"categorias\":[{\"nombre\":\"A\",\"productos\":[{\"nombre\":\"x\",\"precio\":1000}]}]}" }; let ult = 0; for (let i = 0; i < 12; i++) { const r = await pedir({ tipo: "image/png", datos: FOTO }); ult = r.status; } ok(ult === 429, "pasada la cuota por hora → 429"); }

console.log(`\n${total - fallas} de ${total} pruebas cumplen lo esperado.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron.`); process.exit(1); }

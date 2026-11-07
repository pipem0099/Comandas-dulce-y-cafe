// Pruebas (sin internet ni navegador) del service worker (modo sin conexión) y de la carga diferida con reintento.
// npm run offline:probar
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { importarConReintento } from "../src/cargaDiferida.js";

let total = 0, fallas = 0;
const ok = (c, t) => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const ORIGEN = "https://app.test";
const abs = (k) => new URL(typeof k === "string" ? k : k.url, ORIGEN).href;

/* ───── Cargar el service worker en un entorno simulado ───── */
function crearEntorno({ versionCache = "v1", archivos = ["/", "/assets/app-1.js", "/assets/Caja-1.js", "/manifest.json"], almacen = new Map() } = {}) {
  // `almacen` (nombre → Map(url → Response)) se puede reutilizar para simular que el navegador reinició el service worker.
  const caches = {
    async open(n) { if (!almacen.has(n)) almacen.set(n, new Map()); const m = almacen.get(n);
      return { async match(k) { const r = m.get(abs(k)); return r ? r.clone() : undefined; }, async put(k, r) { m.set(abs(k), r.clone()); } }; },
    async match(k) { for (const m of almacen.values()) { const r = m.get(abs(k)); if (r) return r.clone(); } return undefined; },
    async keys() { return [...almacen.keys()]; },
    async delete(n) { return almacen.delete(n); },
  };
  const red = { enLinea: true, llamadas: [], retrasoMs: 0, cuerpos: { "/precache.json": JSON.stringify({ version: versionCache, archivos }), "/": "<html>index nuevo</html>", "/assets/app-1.js": "app", "/assets/Caja-1.js": "caja", "/manifest.json": "{}" } };
  const fetchFalso = async (req) => {
    const u = new URL(typeof req === "string" ? req : req.url, ORIGEN);
    red.llamadas.push(u.pathname);
    if (red.retrasoMs) await new Promise((r) => setTimeout(r, red.retrasoMs));
    if (!red.enLinea) throw new TypeError("sin conexión");
    if (red.htmlEn && red.htmlEn.includes(u.pathname)) return new Response("<html>index</html>", { status: 200, headers: { "content-type": "text/html" } }); // el hosting devuelve index.html para rutas que no existen
    const c = red.cuerpos[u.pathname];
    return c === undefined ? new Response("no", { status: 404 }) : new Response(c, { status: 200 });
  };
  const manejadores = {}; const estado = { saltado: false, reclamado: false };
  const self_ = { location: { origin: ORIGEN }, addEventListener: (t, f) => { manejadores[t] = f; }, skipWaiting: () => { estado.saltado = true; }, clients: { claim: async () => { estado.reclamado = true; } } };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { self: self_, caches, fetch: fetchFalso, Response, URL, Promise, setTimeout, console });
  const evento = (tipo) => { const e = { _p: null, waitUntil(p) { this._p = p; } }; manejadores[tipo](e); return e._p; };
  const pedir = (url, { metodo = "GET", modo = "cors" } = {}) => {
    let respuesta = null; const e = { request: { method: metodo, url: new URL(url, ORIGEN).href, mode: modo }, respondWith(p) { respuesta = p; } };
    manejadores.fetch(e); return respuesta; // null = el service worker NO interviene
  };
  return { almacen, caches, red, estado, evento, pedir };
}

console.log("── Instalar: guarda la cáscara de la app ──");
const A = crearEntorno();
await A.evento("install");
const nombreV1 = [...A.almacen.keys()].find((n) => n.startsWith("comandas-shell-"));
ok(nombreV1 === "comandas-shell-v1", "crea la caché de la versión (comandas-shell-v1)");
ok(["/", "/assets/app-1.js", "/assets/Caja-1.js", "/manifest.json"].every((u) => A.almacen.get(nombreV1).has(abs(u))), "guarda el paquete completo, incluidas las pantallas que se cargan después");
ok(A.estado.saltado, "se activa de inmediato (skipWaiting)");

console.log("\n── Sin internet ──");
await A.evento("activate");
A.red.llamadas.length = 0;
const asset = await A.pedir("/assets/app-1.js");
ok(asset && (await asset.text()) === "app" && A.red.llamadas.length === 0, "un archivo del paquete se sirve de la copia guardada, sin usar la red");
A.red.enLinea = false;
const caja = await A.pedir("/assets/Caja-1.js");
ok((await caja.text()) === "caja", "sin internet, una pantalla del paquete (Caja) sigue abriendo");
const nav = await A.pedir("/", { modo: "navigate" });
ok((await nav.text()) === "<html>index nuevo</html>", "sin internet, al abrir la app se muestra la copia guardada");
const navRuta = await A.pedir("/caja/algo", { modo: "navigate" });
ok((await navRuta.text()).includes("index"), "sin internet, cualquier ruta de navegación abre la app");

console.log("\n── El navegador reinicia el service worker (pierde la memoria) ──");
const R = crearEntorno({ almacen: A.almacen });   // mismo almacenamiento, service worker nuevo
R.red.enLinea = false;
const r0 = R.pedir("/assets/Caja-1.js");
ok(r0 !== null && (await (await r0).text()) === "caja", "reiniciado y sin internet, las pantallas guardadas siguen abriendo");
const r1n = await R.pedir("/", { modo: "navigate" });
ok((await r1n.text()).includes("index"), "reiniciado y sin internet, la app abre desde la copia guardada");

console.log("\n── Con internet ──");
A.red.enLinea = true; A.red.cuerpos["/"] = "<html>index NUEVO v2</html>";
const nav2 = await A.pedir("/", { modo: "navigate" });
ok((await nav2.text()).includes("NUEVO v2"), "con internet, al abrir recibe la versión más reciente (red primero)");
A.red.enLinea = false;
const nav3 = await A.pedir("/", { modo: "navigate" });
ok((await nav3.text()).includes("NUEVO v2"), "y esa versión nueva queda guardada para la próxima vez sin internet");

console.log("\n── Internet muy lento (más de 3 s) ──");
A.red.enLinea = true; A.red.retrasoMs = 3400; A.red.cuerpos["/"] = "<html>respuesta tardía</html>";
const t0 = Date.now();
const lenta = await A.pedir("/", { modo: "navigate" });
const txtLenta = await lenta.text();
ok(txtLenta.includes("NUEVO v2") && Date.now() - t0 < 3300, `con señal lenta abre la copia guardada en ~3 s (${((Date.now() - t0) / 1000).toFixed(1)} s) en lugar de dejar la pantalla en blanco`);
A.red.retrasoMs = 0;

console.log("\n── Lo que NO debe tocar ──");
ok(A.pedir("https://proyecto-default-rtdb.firebaseio.com/cuentas.json") === null, "las peticiones a Firebase pasan directo (los datos nunca se guardan)");
ok(A.pedir("https://identitytoolkit.googleapis.com/v1/accounts:lookup") === null, "el inicio de sesión pasa directo");
ok(A.pedir("/assets/app-1.js", { metodo: "POST" }) === null, "solo se atienden peticiones GET");
ok(A.pedir("/sw.js") === null && A.pedir("/precache.json") === null, "el propio service worker y la lista de archivos nunca se sirven de caché");
ok(![...A.almacen.values()].some((m) => [...m.keys()].some((k) => k.includes("firebase"))), "ninguna caché contiene datos de Firebase");

console.log("\n── Archivos que ya no existen en el hosting ──");
A.red.enLinea = true; A.red.htmlEn = ["/assets/viejo-9.js"];
const fantasma = await A.pedir("/assets/viejo-9.js");
await fantasma.text();
await new Promise((r) => setTimeout(r, 20));
ok(![...A.almacen.values()].some((m) => m.has(abs("/assets/viejo-9.js"))), "una página HTML que llega en lugar de un .js NO se guarda como si fuera el archivo");
A.red.htmlEn = [];

console.log("\n── Fuentes de Google ──");
A.red.enLinea = true; A.red.cuerpos["/css2"] = "fuente";
const f1 = A.pedir("https://fonts.googleapis.com/css2");
ok(f1 !== null, "las fuentes pasan por el service worker");
A.red.cuerpos["/css2"] = "fuente";
await f1;
A.red.enLinea = false;
const f2 = A.pedir("https://fonts.googleapis.com/css2");
ok(f2 !== null && (await f2.then((r) => r.text())) === "fuente", "sin internet, las fuentes ya vistas siguen disponibles");

console.log("\n── Versión nueva: limpia lo viejo ──");
const B = crearEntorno({ versionCache: "v2" });
await B.caches.open("comandas-shell-v1"); await B.caches.open("comandas-fuentes-v1"); await B.caches.open("otra-cosa");
await B.evento("install"); await B.evento("activate");
const nombres = await B.caches.keys();
ok(!nombres.includes("comandas-shell-v1") && nombres.includes("comandas-shell-v2"), "al activar una versión nueva se borra la caché de la anterior");
ok(nombres.includes("comandas-fuentes-v1") && nombres.includes("otra-cosa"), "no borra las fuentes ni cachés ajenas");
ok(B.estado.reclamado, "toma el control de las pestañas abiertas");

console.log("\n── Versión nueva con una pantalla vieja todavía abierta ──");
const D = crearEntorno({ versionCache: "v1" }); await D.evento("install");
const D2 = crearEntorno({ versionCache: "v2", archivos: ["/", "/assets/app-2.js"], almacen: D.almacen });
D2.red.cuerpos["/assets/app-2.js"] = "app2"; await D2.evento("install"); D2.red.enLinea = false;
const viejo = D2.pedir("/assets/Caja-1.js");
ok(viejo !== null && (await (await viejo).text()) === "caja", "mientras no se limpie, un archivo de la versión anterior sigue disponible (la pestaña vieja no se rompe)");
await D2.evento("activate");
ok(!(await D2.caches.keys()).includes("comandas-shell-v1"), "al activarse la nueva, la versión anterior se borra");

console.log("\n── Sin lista de archivos (modo desarrollo) ──");
const C = crearEntorno();
C.red.cuerpos["/precache.json"] = undefined;
await C.evento("install");
ok(C.estado.saltado && C.almacen.size === 0, "si falta precache.json la app se instala igual y no guarda nada");

console.log("\n── Carga diferida con reintento ──");
let n = 0;
const r1 = await importarConReintento(async () => { n++; if (n < 2) throw new Error("red"); return "ok"; }, { esperaMs: 1 });
ok(r1 === "ok" && n === 2, "si la primera descarga falla, la reintenta y funciona");
let m = 0, aviso = null;
try { await importarConReintento(async () => { m++; throw new Error("archivo no existe"); }, { esperaMs: 1, alFallar: (e) => { aviso = e.message; } }); } catch (e) { ok(m === 2 && aviso === "archivo no existe" && e.message === "archivo no existe", "si sigue fallando, avisa (para recargar la app una vez) y relanza el error"); }

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

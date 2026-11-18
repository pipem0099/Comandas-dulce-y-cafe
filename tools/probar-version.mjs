// Pruebas del aviso «Hay una versión nueva» y de la actualización segura (sin navegador).   npm run version:probar
import { hayVersionNueva, avisoVisible, buildIdDePrecache, crearVigilanteVersion } from "../src/versionApp.js";
import { crearActualizador } from "../src/actualizarApp.js";
import { readFileSync } from "node:fs";

let total = 0, fallas = 0;
const ok = (cond, texto) => { total++; if (!cond) fallas++; console.log(`${cond ? "✔" : "✘"} ${texto}`); };
const pausa = (ms = 0) => new Promise((r) => setTimeout(r, ms));

console.log("── Comparar versiones ──");
ok(hayVersionNueva("aaa", "bbb"), "distinto identificador → hay versión nueva");
ok(!hayVersionNueva("aaa", "aaa"), "el mismo identificador → no hay nada nuevo");
ok(!hayVersionNueva("dev", "bbb"), "en desarrollo (dev) nunca se avisa");
ok(!hayVersionNueva("aaa", "") && !hayVersionNueva("aaa", undefined) && !hayVersionNueva("", "bbb"), "si falta alguno de los dos datos no se avisa (despliegue viejo o error)");
ok(!hayVersionNueva("aaa", " aaa "), "los espacios no cuentan como diferencia");
ok(avisoVisible({ hayNueva: true }, true) && !avisoVisible({ hayNueva: true }, false) && !avisoVisible({ hayNueva: false }, true), "el aviso solo se ve con versión nueva Y con internet");
ok(buildIdDePrecache('{"version":"v","buildId":"abc","archivos":[]}') === "abc" && buildIdDePrecache("no es json") === "" && buildIdDePrecache('{"version":"v"}') === "", "se lee el buildId de precache.json (y se tolera lo dañado o viejo)");

console.log("\n── Vigilante ──");
function entorno({ publicada = "v1", enLinea = true } = {}) {
  const e = { publicada, enLinea, pedidos: 0, ahora: 1000 };
  const oyentesDoc = {}, oyentesWin = {};
  e.documento = { visibilityState: "visible", addEventListener: (n, f) => { (oyentesDoc[n] = oyentesDoc[n] || new Set()).add(f); }, removeEventListener: (n, f) => oyentesDoc[n] && oyentesDoc[n].delete(f) };
  e.ventana = { addEventListener: (n, f) => { (oyentesWin[n] = oyentesWin[n] || new Set()).add(f); }, removeEventListener: (n, f) => oyentesWin[n] && oyentesWin[n].delete(f) };
  e.disparar = (donde, n) => [...((donde === "doc" ? oyentesDoc : oyentesWin)[n] || [])].forEach((f) => f());
  e.tic = null;
  e.poner = (f) => { e.tic = f; return 1; }; e.quitar = () => { e.tic = null; };
  e.vigilante = (buildId = "v1") => crearVigilanteVersion({ buildId, pedirRemoto: async () => { e.pedidos++; return e.publicada; }, enLinea: () => e.enLinea, ahora: () => e.ahora, ventana: e.ventana, documento: e.documento, poner: e.poner, quitar: e.quitar, minEntreRevisionesMs: 15000 });
  return e;
}
{
  const e = entorno({ publicada: "v1" }); const v = e.vigilante("v1"); const detener = v.iniciar(); await pausa();
  ok(e.pedidos === 1 && !v.estado().hayNueva, "al iniciar revisa una vez y, si es la misma versión, no avisa");
  e.publicada = "v2"; e.ahora += 20000; e.documento.visibilityState = "visible"; e.disparar("doc", "visibilitychange"); await pausa();
  ok(v.estado().hayNueva && v.estado().publicada === "v2", "al volver el foco a la pestaña detecta la versión nueva");
  detener();
}
{
  const e = entorno({ publicada: "v2" }); const v = e.vigilante("v1"); const vistos = []; v.observar((s) => vistos.push(s.hayNueva)); const detener = v.iniciar(); await pausa();
  ok(v.estado().hayNueva && vistos.length === 1, "detecta la versión nueva ya al iniciar y avisa una sola vez");
  e.ahora += 300000; e.tic && e.tic(); await pausa();
  ok(vistos.length === 1, "revisar de nuevo con lo mismo no repite el aviso");
  detener();
}
{
  const e = entorno({ publicada: "v2", enLinea: false }); const v = e.vigilante("v1"); const detener = v.iniciar(); await pausa();
  ok(e.pedidos === 0 && !v.estado().hayNueva, "sin internet no hace ninguna petición");
  e.enLinea = true; e.disparar("win", "online"); await pausa();
  ok(e.pedidos === 1 && v.estado().hayNueva, "al volver el internet revisa de inmediato");
  detener();
}
{
  const e = entorno({ publicada: "v1" }); const v = e.vigilante("v1"); const detener = v.iniciar(); await pausa();
  e.publicada = "v2"; e.ahora += 5000; e.disparar("doc", "visibilitychange"); await pausa();
  ok(v.estado().hayNueva, "al volver a la pestaña se revisa aunque haya pasado poco tiempo");
  const antes = e.pedidos; e.ahora += 1000; e.tic && e.tic(); await pausa();
  ok(e.pedidos === antes, "el sondeo periódico respeta el tiempo mínimo entre revisiones (no satura la red)");
  e.ahora += 20000; e.tic && e.tic(); await pausa();
  ok(e.pedidos === antes + 1, "pasado ese tiempo el sondeo vuelve a revisar");
  detener(); const n = e.pedidos; e.disparar("doc", "visibilitychange"); await pausa();
  ok(e.pedidos === n, "al detener el vigilante ya no revisa");
}
{
  const e = entorno({ publicada: "v1" });
  const v = crearVigilanteVersion({ buildId: "v1", pedirRemoto: async () => { throw new Error("sin red"); }, enLinea: () => true, ahora: () => e.ahora, ventana: e.ventana, documento: e.documento, poner: e.poner, quitar: e.quitar });
  const detener = v.iniciar(); await pausa();
  ok(!v.estado().hayNueva, "si la petición falla, no se rompe ni se avisa"); detener();
}
{
  const e = entorno({ publicada: "v2" }); const v = e.vigilante("v1"); const detener = v.iniciar(); await pausa();
  e.publicada = "v1"; e.ahora += 20000; e.disparar("win", "focus"); await pausa();
  ok(!v.estado().hayNueva, "si la versión publicada vuelve a coincidir (se revirtió), el aviso desaparece"); detener();
}

console.log("\n── Actualización segura ──");
function fakeSW({ waiting = null, installing = null, falla = false, sinRegistro = false } = {}) {
  const oyentes = new Set(); const enviados = [];
  const reg = { waiting, installing, active: { state: "activated" }, update: async () => { if (falla) throw new Error("sin red"); } };
  const sw = { getRegistration: async () => (sinRegistro ? null : reg), addEventListener: (n, f) => { if (n === "controllerchange") oyentes.add(f); }, enviados, cambiarControlador: () => [...oyentes].forEach((f) => f()), reg };
  const mensajero = (w) => { w.postMessage = (m) => { enviados.push(m); setTimeout(() => sw.cambiarControlador(), 5); }; return w; };
  if (waiting) mensajero(waiting); if (installing) mensajero(installing);
  return sw;
}
{
  const sw = fakeSW({ waiting: { state: "installed" } }); let recargas = 0;
  const r = await crearActualizador({ contenedorSW: sw, recargar: () => { recargas++; }, esperaCambioMs: 500 }).actualizar();
  ok(sw.enviados.length === 1 && sw.enviados[0].tipo === "SALTAR_ESPERA" && recargas === 1 && r.via === "service-worker", "con un service worker esperando: le dice que tome el control, espera el cambio y recarga una vez");
}
{
  const sw = fakeSW(); let recargas = 0;
  await crearActualizador({ contenedorSW: sw, recargar: () => { recargas++; } }).actualizar();
  ok(sw.enviados.length === 0 && recargas === 1, "sin service worker nuevo: solo recarga (la app trae lo nuevo de la red)");
}
{
  const sw = fakeSW({ falla: true, waiting: { state: "installed" } }); let recargas = 0;
  await crearActualizador({ contenedorSW: sw, recargar: () => { recargas++; }, esperaCambioMs: 500 }).actualizar();
  ok(recargas === 1, "si no se puede buscar la actualización, igual recarga una vez");
}
{
  let recargas = 0; await crearActualizador({ contenedorSW: null, recargar: () => { recargas++; } }).actualizar();
  ok(recargas === 1, "en un navegador sin service worker recarga y listo");
}
{
  const instalando = { state: "installing", listeners: new Set(), addEventListener(n, f) { this.listeners.add(f); }, removeEventListener(n, f) { this.listeners.delete(f); } };
  const sw = fakeSW({ installing: instalando }); let recargas = 0;
  const prom = crearActualizador({ contenedorSW: sw, recargar: () => { recargas++; }, esperaCambioMs: 500, esperaInstalacionMs: 2000 }).actualizar();
  await pausa(30); ok(recargas === 0, "mientras el service worker nuevo aún se está guardando, espera (no recarga a medias)");
  instalando.state = "installed"; sw.reg.waiting = instalando; [...instalando.listeners].forEach((f) => f());
  await prom; ok(recargas === 1 && sw.enviados.length === 1, "cuando termina de guardarse, toma el control y recarga");
}
{
  const instalando = { state: "installing", addEventListener() {}, removeEventListener() {}, postMessage() {} };
  const sw = fakeSW({ installing: instalando }); let recargas = 0;
  await crearActualizador({ contenedorSW: sw, recargar: () => { recargas++; }, esperaInstalacionMs: 50, esperaCambioMs: 50 }).actualizar();
  ok(recargas === 1, "si el service worker nuevo se demora demasiado, recarga igual (sin quedarse colgado)");
}

console.log("\n── Garantías del código ──");
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
ok(/SALTAR_ESPERA/.test(sw) && /if \(!\(self\.registration && self\.registration\.active\)\) return self\.skipWaiting\(\)/.test(sw), "el service worker nuevo ESPERA (no toma el control solo) salvo en la primera instalación");
ok((sw.match(/skipWaiting\(\)/g) || []).length === 2, "skipWaiting solo se usa en la primera instalación y al pedirlo «Actualizar»");
const aviso = readFileSync(new URL("../src/componentes/AvisoVersion.jsx", import.meta.url), "utf8");
const vers = readFileSync(new URL("../src/versionApp.js", import.meta.url), "utf8");
ok(!/location\.reload|\.reload\(/.test(aviso) && !/location\.reload|\.reload\(/.test(vers), "ni el aviso ni el vigilante recargan la página por su cuenta");
ok(!/--warn|--c-b98a2e|--c-fbefd9|#f[a-f0-9]{5}/i.test(aviso) && /Hay una versión nueva/.test(aviso) && /Actualizar/.test(aviso), "el aviso no usa amarillo y dice «Hay una versión nueva» con el botón «Actualizar»");
ok(/minHeight: 44/.test(aviso), "el botón tiene área de toque de al menos 44 px");
const vite = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
ok(/buildId: BUILD_ID/.test(vite) && /__COMANDAS_BUILD__/.test(vite), "la compilación mete el buildId en el paquete y en precache.json");

console.log(`\n${total - fallas} de ${total} pruebas cumplen lo esperado.`);
process.exit(fallas ? 1 : 0);

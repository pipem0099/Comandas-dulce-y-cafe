// Service worker de Comandas.
//  · Hace que la app sea instalable (ícono en la pantalla de inicio, ventana propia).
//  · MODO SIN CONEXIÓN de la app: guarda la "cáscara" (los archivos del paquete: pantallas, estilos, íconos) para que la app
//    abra aunque se caiga el internet del local. Los DATOS no se guardan aquí: pedidos, cuentas y turnos viajan siempre
//    directo a Firebase (que ya guarda lo pendiente y lo sube solo al volver la conexión). Así nunca se muestra un dato viejo.
//
// Estrategia (solo peticiones GET):
//   · Archivos con hash (/assets/…)  → primero la copia guardada (nunca cambian); si no está, se baja y se guarda.
//   · Abrir la app (navegación)       → primero la red (para recibir versiones nuevas); si tarda más de 3 s o no hay
//                                       internet, se abre la copia guardada.
//   · Íconos y manifiesto             → copia guardada y se actualiza en segundo plano.
//   · Fuentes de Google               → copia guardada y se actualiza en segundo plano.
//   · Todo lo demás (Firebase, etc.)  → no se toca.

const PREFIJO = "comandas-shell-";
const CACHE_FUENTES = "comandas-fuentes-v1";
const ESPERA_RED_MS = 3000;
const HOSTS_FUENTES = ["fonts.googleapis.com", "fonts.gstatic.com"];

const CACHE_META = "comandas-meta";
const CLAVE_NOMBRE = "/__shell";

// El navegador apaga el service worker cuando está inactivo y lo reinicia al llegar una petición: lo que está en memoria se pierde.
// Por eso el nombre de la caché vigente se guarda en una caché aparte (sin necesitar internet para recuperarlo).
let nombreCache = null;
async function cacheActual() {
  if (nombreCache) return nombreCache;
  const meta = await caches.open(CACHE_META);
  const guardado = await meta.match(CLAVE_NOMBRE);
  if (guardado) { nombreCache = await guardado.text(); return nombreCache; }
  const existentes = (await caches.keys()).filter((n) => n.startsWith(PREFIJO));
  if (existentes.length > 0) { nombreCache = existentes[existentes.length - 1]; return nombreCache; }
  throw new Error("sin caché de la app");
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const res = await fetch("/precache.json", { cache: "no-store" });
      if (!res.ok) return;
      const { version, archivos } = await res.json();
      const nuevo = PREFIJO + version;
      const cache = await caches.open(nuevo);
      // Se guarda uno por uno: si un archivo falla, los demás se guardan igual y la app sigue instalándose.
      await Promise.all(archivos.map(async (url) => {
        try {
          const r = await fetch(url, { cache: "reload" });
          if (url === "/" ? r.ok : guardable(r)) await cache.put(url, r);
        } catch (_) { /* sin red en este archivo: se guardará cuando se use */ }
      }));
      // Recién ahora (con el paquete completo guardado) esta versión pasa a ser la vigente.
      nombreCache = nuevo;
      await (await caches.open(CACHE_META)).put(CLAVE_NOMBRE, new Response(nuevo));
    } catch (_) { /* sin precache.json: la app funciona igual, solo sin modo sin conexión */ }
  })().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const actual = await cacheActual();
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.startsWith(PREFIJO) && n !== actual).map((n) => caches.delete(n)));
    } catch (_) { /* si no hay precache.json no se borra nada */ }
    await self.clients.claim();
  })());
});

// Solo se guarda lo que sirve: respuestas correctas y que NO sean una página HTML disfrazada.
// (El hosting devuelve index.html para cualquier ruta que no exista; si se guardara como si fuera un archivo .js, la app quedaría rota.)
const guardable = (res) => {
  if (!res) return false;
  if (res.type === "opaque") return true;
  if (!res.ok) return false;
  const tipo = (res.headers && res.headers.get && res.headers.get("content-type")) || "";
  return !tipo.includes("text/html");
};
async function guardarSiSirve(cache, request, res) {
  if (guardable(res)) await cache.put(request, res.clone());
}

async function primeroCopia(request, nombre) {
  const cache = await caches.open(nombre);
  const guardada = (await cache.match(request)) || (await caches.match(request));
  if (guardada) return guardada;
  const res = await fetch(request);
  guardarSiSirve(cache, request, res);
  return res;
}

async function copiaYActualiza(request, nombre) {
  const cache = await caches.open(nombre);
  const guardada = await cache.match(request);
  const red = fetch(request).then((res) => { if (guardable(res)) cache.put(request, res.clone()); return res; }).catch(() => null);
  if (guardada) return guardada;
  const res = await red;
  return res || Response.error();
}

async function abrirApp(request, nombre) {
  const cache = await caches.open(nombre);
  const conTiempo = new Promise((_, rechazo) => setTimeout(() => rechazo(new Error("red lenta")), ESPERA_RED_MS));
  try {
    const res = await Promise.race([fetch(request), conTiempo]);
    if (res.ok) cache.put("/", res.clone());
    return res;
  } catch (_) {
    const guardada = (await cache.match("/")) || (await cache.match(request));
    if (guardada) return guardada;
    return fetch(request); // sin copia guardada: se intenta la red sin límite de tiempo
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (HOSTS_FUENTES.includes(url.hostname)) {
    event.respondWith(copiaYActualiza(request, CACHE_FUENTES));
    return;
  }
  if (url.origin !== self.location.origin) return; // Firebase y cualquier otro servicio: directo a la red
  if (url.pathname === "/sw.js" || url.pathname === "/precache.json") return;

  if (request.mode === "navigate") {
    event.respondWith(cacheActual().then((n) => abrirApp(request, n)).catch(() => fetch(request)));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheActual().then((n) => primeroCopia(request, n)).catch(() => fetch(request)));
    return;
  }
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
    event.respondWith(cacheActual().then((n) => copiaYActualiza(request, n)).catch(() => fetch(request)));
  }
});

/*
 * Actualización segura de la app (solo cuando la persona pulsa «Actualizar»):
 *   1. pide al navegador que busque el service worker nuevo y espera a que termine de guardar la versión;
 *   2. le dice que tome el control ahora (SALTAR_ESPERA) y espera el cambio;
 *   3. recarga la página.
 * Los cambios pendientes sin internet viven en el almacén local (IndexedDB), que una recarga no toca: nada de esto los borra.
 * Con dependencias inyectables para probarla sin navegador: `npm run version:probar`.
 */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function crearActualizador({ contenedorSW = typeof navigator !== "undefined" ? navigator.serviceWorker : null, recargar = () => window.location.reload(), esperaInstalacionMs = 20000, esperaCambioMs = 5000 } = {}) {
  /** Espera a que un service worker en instalación quede listo (o falle / se acabe el tiempo). */
  function esperarListo(worker) {
    return new Promise((resolver) => {
      if (!worker || worker.state === "installed" || worker.state === "activated") { resolver(worker && worker.state !== "redundant" ? worker : null); return; }
      const fin = (w) => { try { worker.removeEventListener("statechange", alCambiar); } catch (_) { /* ya no existe */ } resolver(w); };
      const alCambiar = () => { if (worker.state === "installed" || worker.state === "activated") fin(worker); else if (worker.state === "redundant") fin(null); };
      worker.addEventListener("statechange", alCambiar);
      esperar(esperaInstalacionMs).then(() => fin(null));
    });
  }

  async function actualizar() {
    if (!contenedorSW) { recargar(); return { via: "sin-service-worker" }; }
    let via = "recarga";
    try {
      const reg = contenedorSW.getRegistration ? await contenedorSW.getRegistration() : null;
      if (reg) {
        try { await reg.update(); } catch (_) { /* sin red para buscar: se recarga igual */ }
        const nuevo = reg.waiting || (reg.installing ? await esperarListo(reg.installing) : null) || reg.waiting;
        if (nuevo && nuevo !== reg.active) {
          const cambio = new Promise((ok) => contenedorSW.addEventListener("controllerchange", ok, { once: true }));
          nuevo.postMessage({ tipo: "SALTAR_ESPERA" });
          await Promise.race([cambio, esperar(esperaCambioMs)]);
          via = "service-worker";
        }
      }
    } catch (_) { /* cualquier fallo: igual se recarga, la red-primero de la app trae la versión nueva */ }
    recargar();
    return { via };
  }
  return { actualizar };
}

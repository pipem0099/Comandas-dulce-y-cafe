/*
 * Aviso de «Hay una versión nueva».
 *
 * Cada compilación lleva un identificador (`buildId`, un hash del contenido de la app) metido en el paquete y copiado a /precache.json.
 * Al abrir la app, al volver a ella y cada cierto rato se compara el del paquete que está corriendo con el de /precache.json (pedido sin caché).
 * Si son distintos y hay internet, se ofrece «Actualizar». NUNCA se recarga solo: quien está tomando un pedido no pierde lo que escribe.
 *
 * Todo es lógica pura con dependencias inyectables (reloj, red, documento): se prueba con `npm run version:probar`.
 */

export const ID_DESARROLLO = "dev";
const limpiar = (v) => (typeof v === "string" ? v.trim() : "");

/** ¿La versión publicada es distinta de la que está corriendo? En desarrollo ("dev") o sin dato nunca avisa. */
export function hayVersionNueva(actual, publicada) {
  const a = limpiar(actual), p = limpiar(publicada);
  if (!a || !p || a === ID_DESARROLLO) return false;
  return a !== p;
}

/** El aviso se muestra solo si hay versión nueva Y hay internet (sin internet no se podría descargar). */
export const avisoVisible = (estado, enLinea) => !!(estado && estado.hayNueva) && !!enLinea;

/** Lee el buildId publicado desde el texto de precache.json. Devuelve "" si no se puede leer. */
export function buildIdDePrecache(texto) {
  try { const d = typeof texto === "string" ? JSON.parse(texto) : texto; return limpiar(d && d.buildId); } catch (_) { return ""; }
}

/**
 * Vigilante de versión. Revisa al iniciar, al volver el foco a la pestaña, al recuperar la conexión y cada `intervaloMs`.
 *   buildId     identificador de ESTE paquete
 *   pedirRemoto () => Promise<string>   buildId publicado (la petición debe ir sin caché)
 *   enLinea     () => boolean
 */
export function crearVigilanteVersion({
  buildId, pedirRemoto, enLinea = () => true, intervaloMs = 5 * 60e3, minEntreRevisionesMs = 15e3,
  ahora = Date.now, ventana = typeof window !== "undefined" ? window : null, documento = typeof document !== "undefined" ? document : null,
  poner = setInterval, quitar = clearInterval,
} = {}) {
  let estado = { hayNueva: false, publicada: "" };
  let ultima = -Infinity, enCurso = null, detenido = false;
  const oyentes = new Set();
  const avisar = () => oyentes.forEach((f) => { try { f(estado); } catch (_) { /* un oyente roto no frena a los demás */ } });

  async function revisar({ forzar = false } = {}) {
    if (detenido || !enLinea()) return estado;          // sin internet no se pide nada (y el aviso se oculta)
    if (enCurso) return enCurso;
    if (!forzar && ahora() - ultima < minEntreRevisionesMs) return estado;
    ultima = ahora();
    enCurso = (async () => {
      try {
        const publicada = limpiar(await pedirRemoto());
        if (!publicada) return estado;                  // sin dato (despliegue viejo o error): se deja como estaba
        const nuevo = { hayNueva: hayVersionNueva(buildId, publicada), publicada };
        if (nuevo.hayNueva !== estado.hayNueva || nuevo.publicada !== estado.publicada) { estado = nuevo; avisar(); }
      } catch (_) { /* sin respuesta: se vuelve a intentar en la próxima revisión */ }
      return estado;
    })().finally(() => { enCurso = null; });
    return enCurso;
  }

  function iniciar() {
    detenido = false;
    revisar({ forzar: true });
    const alVolver = () => { if (!documento || documento.visibilityState !== "hidden") revisar({ forzar: true }); };
    const alConectar = () => revisar({ forzar: true });
    if (documento) documento.addEventListener("visibilitychange", alVolver);
    if (ventana) { ventana.addEventListener("online", alConectar); ventana.addEventListener("focus", alVolver); }
    const reloj = poner(() => revisar(), intervaloMs);
    return function detener() {
      detenido = true; quitar(reloj);
      if (documento) documento.removeEventListener("visibilitychange", alVolver);
      if (ventana) { ventana.removeEventListener("online", alConectar); ventana.removeEventListener("focus", alVolver); }
    };
  }

  return { iniciar, revisar, estado: () => estado, observar: (f) => { oyentes.add(f); return () => oyentes.delete(f); } };
}

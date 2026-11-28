/* Puente mínimo para que los módulos de bajo nivel (impresión, copia sin conexión, sesión) dejen constancia de un fallo que NO deben
   mostrar a la persona ni detener el trabajo, pero que tampoco conviene tragarse en silencio. Sin dependencias, así cualquier módulo
   puede importarlo sin crear ciclos. `errores.js` conecta el destino real («Errores de la app» en Respaldos y datos). */
let destino = null;
export function registrarDestinoDeFallos(f) { destino = typeof f === "function" ? f : null; }
/** Anota un fallo tolerado. Nunca lanza error. `origen` dice dónde pasó (p. ej. "espejo:guardar"). */
export function fallo(origen, error) {
  try { console.warn(`[${origen}]`, error); } catch (_) { /* sin consola */ }
  try { if (destino) destino(error, origen); } catch (_) { /* el registro nunca debe causar otro fallo */ }
}

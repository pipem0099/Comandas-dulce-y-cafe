/*
 * Recuerda en ESTE dispositivo el nombre, color y logo del negocio, para que la pantalla de
 * carga y la de ingreso se vean con la marca desde el primer instante (antes de iniciar sesión,
 * cuando todavía no se puede leer la configuración).
 */
const CLAVE = "comandas_marca_cache";
export function leerMarcaCache() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || "null");
    return v && typeof v === "object" ? v : null;
  } catch (e) { return null; }
}
export function guardarMarcaCache(nombre, marca) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ nombre: nombre || "", marca: marca || null })); } catch (e) {}
}

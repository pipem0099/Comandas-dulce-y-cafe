/*
 * Copia local de lo último que mandó el servidor (menú, mesas, cuentas, pedidos...). Así la app abre con datos aunque no haya internet
 * (se muestra primero la copia y, en cuanto llega el servidor, se reemplaza). Se vacía al cerrar sesión: nada queda guardado en un equipo ajeno.
 */
import { fallo } from "../fallos.js";
const PREFIJO = "esp:";
export function crearEspejo({ almacen, demoraMs = 600, reloj = Date.now } = {}) {
  const esperando = new Map(); // clave → { valor, timer }
  const volcar = async (clave) => {
    const e = esperando.get(clave);
    if (!e) return;
    clearTimeout(e.timer); esperando.delete(clave);
    try { await almacen.guardar(PREFIJO + clave, { ts: reloj(), valor: e.valor }); } catch (err) { fallo("espejo:guardar", err); /* sin espacio o sin permiso: la app sigue funcionando, solo que sin copia para abrir sin internet */ }
  };
  return {
    async leer(clave) { try { return await almacen.leer(PREFIJO + clave); } catch (_) { return undefined; } },
    /** Guarda con una pequeña espera: si llegan varios cambios seguidos, solo se escribe el último. */
    guardar(clave, valor) {
      const previo = esperando.get(clave); if (previo) clearTimeout(previo.timer);
      esperando.set(clave, { valor, timer: setTimeout(() => volcar(clave), demoraMs) });
    },
    /** Escribe ya lo que esté esperando (por ejemplo, justo antes de que se cierre la pestaña). */
    async volcarTodo() { await Promise.all([...esperando.keys()].map(volcar)); },
    async vaciar() { esperando.forEach((e) => clearTimeout(e.timer)); esperando.clear(); await almacen.limpiar(PREFIJO); },
  };
}

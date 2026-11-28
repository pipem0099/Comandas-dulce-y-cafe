import { useEffect, useState } from "react";

/* «Ahora» para las pantallas de análisis. Antes se fijaba una sola vez al abrir: con la pantalla abierta horas (o de un día para otro)
   «hoy», «últimos 7 días» y las comparaciones se quedaban viejos. Ahora se renueva cada 5 minutos (no cada segundo: cada cambio recalcula
   las cuentas) y al volver a la app tras un rato, y se detiene mientras la pestaña está oculta. */
export function useAhora(cadaMs = 5 * 60 * 1000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
    const id = setInterval(() => { if (visible()) setAhora(Date.now()); }, cadaMs);
    // Al volver a la pestaña: si pasó más de un minuto desde el último valor, se actualiza enseguida (no espera al próximo ciclo).
    const alVolver = () => { if (visible()) setAhora((a) => (Date.now() - a > 60 * 1000 ? Date.now() : a)); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(id); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", alVolver); };
  }, [cadaMs]);
  return ahora;
}

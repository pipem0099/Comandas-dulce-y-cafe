import { useEffect, useState } from "react";

/*
 * Tiempos de espera de las comandas (Cocina) — lógica pura + un reloj liviano.
 * Los umbrales (en minutos) son editables en Ajustes → "Tiempos de espera" y viajan en config.tiempos.
 */
export const UMBRALES_DEFECTO = { ambar: 5, rojo: 10 };
export const LIMITES_UMBRAL = { min: 1, max: 60 };

export function getUmbrales(config) {
  const t = (config && config.tiempos) || {};
  const ok = (v) => Number.isFinite(v) && v >= LIMITES_UMBRAL.min && v <= LIMITES_UMBRAL.max;
  let ambar = ok(t.ambar) ? Math.round(t.ambar) : UMBRALES_DEFECTO.ambar;
  let rojo = ok(t.rojo) ? Math.round(t.rojo) : UMBRALES_DEFECTO.rojo;
  if (rojo <= ambar) rojo = Math.min(LIMITES_UMBRAL.max, ambar + 1); // el rojo siempre va después del ámbar
  return { ambar, rojo };
}

/** "ok" | "ambar" | "rojo" según cuánto lleva esperando. */
export function nivelEspera(ts, umbrales = UMBRALES_DEFECTO, ahora = Date.now()) {
  if (!ts) return "ok";
  const mins = (ahora - ts) / 60000;
  if (mins >= umbrales.rojo) return "rojo";
  if (mins >= umbrales.ambar) return "ambar";
  return "ok";
}

export const COLOR_NIVEL = { ok: "var(--c-5b7553-t)", ambar: "var(--c-b98a2e-t)", rojo: "var(--c-c1442d-t)" };

/** "m:ss" (o "h:mm:ss" pasada la hora). */
export function relojEspera(ts, ahora = Date.now()) {
  const secs = Math.max(0, Math.floor((ahora - ts) / 1000));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** "hace 7 min" para textos secundarios. */
export function haceCuanto(ts, ahora = Date.now()) {
  const m = Math.max(0, Math.floor((ahora - ts) / 60000));
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h ${m % 60 ? (m % 60) + " min" : ""}`.trim();
}

/** Re-dibuja el componente cada `ms` mientras esté montado y la pestaña esté visible; devuelve Date.now(). */
export function useAhora(ms = 1000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => { if (!document.hidden) setAhora(Date.now()); };
    const id = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [ms]);
  return ahora;
}

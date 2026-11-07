/*
 * Carga diferida de pantallas: cada rol descarga solo lo que usa (un mesero no baja el Excel, las gráficas ni el inventario).
 * Si una pantalla no se puede bajar (mala señal, o se publicó una versión nueva y el archivo viejo ya no existe),
 * se reintenta una vez y, si sigue fallando, la app se recarga UNA sola vez para tomar la versión nueva.
 */
import React from "react";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ejecuta `importador()`; si falla lo reintenta `reintentos` veces. Si agota los intentos, llama `alFallar(error)` y relanza. */
export async function importarConReintento(importador, { reintentos = 1, esperaMs = 400, alFallar } = {}) {
  let ultimo;
  for (let i = 0; i <= reintentos; i++) {
    try { return await importador(); } catch (e) { ultimo = e; if (i < reintentos) await esperar(esperaMs); }
  }
  if (alFallar) alFallar(ultimo);
  throw ultimo;
}

const CLAVE_RECARGA = "cargaDiferida:recargado";
function recargarUnaVez() {
  try {
    if (typeof window === "undefined" || typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(CLAVE_RECARGA)) return;
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
    window.location.reload();
  } catch { /* sin almacenamiento: se muestra el error normal */ }
}

/** perezoso(() => import("./X.jsx"), "NombreExportado")  →  componente que se baja la primera vez que se muestra. */
export function perezoso(importador, nombre) {
  return React.lazy(() => importarConReintento(importador, { alFallar: recargarUnaVez }).then((m) => ({ default: nombre ? m[nombre] : m.default })));
}

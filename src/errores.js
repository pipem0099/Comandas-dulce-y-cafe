import { saveRecord } from "./firebase.js";
import { VERSION } from "./constantes.js";
import { uid as nuevoId } from "./logica.js";

/*
 * Registro de errores de la propia app: cuando algo falla en la pantalla de alguien, queda anotado
 * en la base de datos (nodo "errores") para que el administrador lo vea (Ajustes → Respaldos y datos)
 * y se lo pueda pasar a quien mantiene la app. Así no hay que depender de que alguien "se acuerde de avisar".
 *
 * Es discreto a propósito: no molesta al usuario, no repite el mismo error y manda pocos por vez.
 */
let contexto = { uid: "", rol: "", vista: "" };
export function contextoErrores(parcial) { contexto = { ...contexto, ...parcial }; }

// Ruido que no es un fallo de la app (red caída, cosas del navegador, permisos) y no sirve de nada anotar
const IGNORAR = [/ResizeObserver loop/i, /^Script error\.?$/i, /Failed to fetch|NetworkError|Load failed|network error|offline/i, /PERMISSION_DENIED|permission denied/i, /Loading chunk|dynamically imported module/i, /AbortError|The operation was aborted/i];
const vistos = new Map();   // mensaje → cuándo se anotó
let enviadosRecientes = []; // marcas de tiempo de los últimos envíos
const MAX_POR_10_MIN = 5;
const SIN_REPETIR_MS = 30 * 60 * 1000;

export function reportarError(error, origen = "app") {
  try {
    const mensaje = String((error && error.message) || error || "Error desconocido").slice(0, 600);
    if (IGNORAR.some((r) => r.test(mensaje))) return;
    if (!contexto.uid) return; // sin sesión no se puede (ni debe) escribir
    const ahora = Date.now();
    const clave = mensaje.slice(0, 140);
    if (vistos.has(clave) && ahora - vistos.get(clave) < SIN_REPETIR_MS) return;
    enviadosRecientes = enviadosRecientes.filter((t) => ahora - t < 10 * 60 * 1000);
    if (enviadosRecientes.length >= MAX_POR_10_MIN) return;
    vistos.set(clave, ahora); enviadosRecientes.push(ahora);
    const registro = {
      ts: ahora,
      mensaje,
      pila: String((error && error.stack) || "").slice(0, 2500),
      vista: `${contexto.vista || "?"} · ${origen}`.slice(0, 80),
      rol: String(contexto.rol || "").slice(0, 80),
      version: String(VERSION).slice(0, 20),
      uid: String(contexto.uid).slice(0, 80),
      agente: String((typeof navigator !== "undefined" && navigator.userAgent) || "").slice(0, 300),
    };
    // Nunca debe causar otro error: si no se puede guardar, se ignora.
    Promise.resolve(saveRecord("errores", nuevoId(), registro)).catch(() => {});
  } catch (e) { /* nada */ }
}

/** Engancha los errores que no atrapó nadie (fallos sueltos y promesas rechazadas). */
export function instalarCapturaDeErrores() {
  if (typeof window === "undefined" || window.__capturaErrores) return;
  window.__capturaErrores = true;
  window.addEventListener("error", (e) => reportarError(e.error || e.message, "ventana"));
  window.addEventListener("unhandledrejection", (e) => reportarError(e.reason, "promesa"));
}

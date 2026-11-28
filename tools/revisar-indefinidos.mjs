// Detecta variables que se usan pero NO existen (el error clásico: `onEditarProducto is not defined` que solo revienta al abrir la pantalla).
// No instala nada: usa @babel/parser y @babel/traverse, que ya vienen con @vitejs/plugin-react (están en package-lock.json).
// Se llama desde tools/revisar-codigo.mjs (npm run revisar / npm run verificar). También se puede correr solo:  node tools/revisar-indefinidos.mjs
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

// Globales del navegador que usa la app y que Node no trae (las de JavaScript y de Node se leen de globalThis).
const NAVEGADOR = `window document navigator location history localStorage sessionStorage indexedDB requestAnimationFrame cancelAnimationFrame
  requestIdleCallback cancelIdleCallback matchMedia getComputedStyle alert confirm prompt print open close scrollTo scrollBy screen innerWidth innerHeight
  getSelection Image Audio Option File FileReader FileList FormData Headers Request Response Worker WebSocket XMLHttpRequest DOMParser DOMException Notification
  MutationObserver ResizeObserver IntersectionObserver PerformanceObserver customElements caches self clients registration skipWaiting importScripts
  HTMLElement HTMLInputElement HTMLButtonElement HTMLCanvasElement HTMLImageElement Element Node NodeList Document Window Range Selection Storage Navigator Location CSS
  Event CustomEvent EventTarget KeyboardEvent MouseEvent PointerEvent TouchEvent Touch FocusEvent InputEvent ClipboardEvent DragEvent WheelEvent AnimationEvent
  TransitionEvent StorageEvent PopStateEvent HashChangeEvent MessageEvent ErrorEvent PromiseRejectionEvent ProgressEvent SVGElement
  speechSynthesis SpeechSynthesisUtterance createImageBitmap OffscreenCanvas BroadcastChannel IDBKeyRange IDBDatabase BarcodeDetector
  CompressionStream DecompressionStream ReadableStream WritableStream TransformStream escape unescape addEventListener removeEventListener dispatchEvent postMessage`.split(/\s+/).filter(Boolean);
// Constantes que Vite inyecta al compilar (`define` en vite.config.js): existen aunque no se declaren en el código.
function constantesDeVite() {
  try {
    const cfg = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
    const bloque = /define:\s*\{([^}]*)\}/.exec(cfg);
    return bloque ? [...bloque[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((m) => m[1]) : [];
  } catch (e) { return []; }   // sin vite.config.js no hay constantes que añadir
}
const CONOCIDAS = new Set([...Object.getOwnPropertyNames(globalThis), ...NAVEGADOR, ...constantesDeVite(), "undefined", "arguments", "require", "module", "exports", "process", "Buffer", "__dirname", "__filename"]);

/** Devuelve [{ archivo, nombre, linea }] con cada identificador usado sin declarar. `archivos` son rutas absolutas. */
export async function buscarIndefinidos(archivos, raiz) {
  let parse, traverse;
  try {
    ({ parse } = await import("@babel/parser"));
    const t = await import("@babel/traverse");
    traverse = typeof t.default === "function" ? t.default : t.default && t.default.default;   // @babel/traverse es CommonJS: según el entorno viene en .default o en .default.default
    if (typeof parse !== "function" || typeof traverse !== "function") throw new Error("API inesperada");
  } catch (e) {
    return { disponible: false, motivo: e.message, hallazgos: [], ilegibles: [] };
  }
  const hallazgos = [], ilegibles = [];
  for (const f of archivos) {
    const rel = relative(raiz, f).replaceAll("\\", "/");
    let ast;
    try { ast = parse(readFileSync(f, "utf8"), { sourceType: "module", plugins: ["jsx"], errorRecovery: false }); }
    catch (e) { ilegibles.push({ archivo: rel, motivo: e.message }); continue; }
    traverse(ast, {
      Program(ruta) {
        // `globals`: todo identificador referenciado en el archivo que no se declaró en ningún ámbito (ni importado, ni parámetro, ni variable).
        const globales = ruta.scope.globals || {};
        for (const nombre of Object.keys(globales)) {
          if (CONOCIDAS.has(nombre)) continue;
          const nodo = globales[nombre];
          hallazgos.push({ archivo: rel, nombre, linea: nodo && nodo.loc ? nodo.loc.start.line : 0 });
        }
        ruta.stop();
      },
    });
  }
  return { disponible: true, hallazgos, ilegibles };
}

// Ejecución directa: revisa todo src/
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const raiz = new URL("..", import.meta.url).pathname, lista = [];
  (function recorrer(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) recorrer(p); else if (/\.(js|jsx|mjs)$/.test(n)) lista.push(p); } })(join(raiz, "src"));
  const r = await buscarIndefinidos(lista, raiz);
  if (!r.disponible) { console.log(`⚠ No se pudo revisar (${r.motivo}). ¿Corriste npm ci?`); process.exit(0); }
  r.hallazgos.forEach((h) => console.log(`✘ ${h.archivo}:${h.linea}  «${h.nombre}» se usa pero no está definido`));
  console.log(`${lista.length} archivos · ${r.hallazgos.length} variable(s) sin definir`);
  process.exit(r.hallazgos.length ? 1 : 0);
}

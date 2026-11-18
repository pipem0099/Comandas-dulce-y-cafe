// Corre UNA prueba de pantalla en un navegador simulado (jsdom) con un Firebase en memoria.   (la llama ejecutar.mjs)
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";

const aqui = dirname(fileURLToPath(import.meta.url));
const archivo = resolve(process.argv[2]);
const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/", pretendToBeVisual: true });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
for (const k of ["HTMLElement", "HTMLInputElement", "Node", "Event", "KeyboardEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage"]) { if (dom.window[k] && !(k in globalThis)) globalThis[k] = dom.window[k]; }
window.Element.prototype.scrollTo = function () {}; window.Element.prototype.scrollIntoView = function () {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
globalThis.matchMedia = window.matchMedia;

const sustituir = { name: "firebase-simulado", setup(b) {
  b.onResolve({ filter: /(^|\/)firebase\.js$/ }, () => ({ path: join(aqui, "firebase-stub.js") }));
  b.onResolve({ filter: /cuentasOps\.js$/ }, () => ({ path: join(aqui, "firebase-stub.js") }));
} };
const salidaDir = resolve(aqui, "../../node_modules/.cache/humo"); mkdirSync(salidaDir, { recursive: true });
const salida = join(salidaDir, `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mjs`);
await build({ entryPoints: [archivo], bundle: true, platform: "node", format: "esm", outfile: salida, plugins: [sustituir], loader: { ".js": "jsx" }, jsx: "automatic", external: ["react", "react-dom", "react-dom/client"], logLevel: "error", banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" } });
await import(pathToFileURL(salida).href);

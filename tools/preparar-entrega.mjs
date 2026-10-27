// Prepara una COPIA LIMPIA del proyecto para entregársela a otro negocio:
//   · quita la configuración de Firebase de tu negocio (el comprador usará la suya, por variables de entorno)
//   · cambia el nombre del negocio y el menú de fábrica por unos neutros
//   · no copia node_modules, dist, .git, .env ni archivos .zip
//
//   npm run preparar-entrega -- --nombre "Café Neira" --salida ../entrega-cafe-neira
//
// Después: súbela a un repositorio PRIVADO del comprador y sigue docs/INSTALACION.md.
import { cpSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const nombre = arg("nombre", "Mi negocio");
const salida = resolve(arg("salida", join(raiz, "..", "entrega-limpia")));
if (salida.startsWith(raiz + sep) || salida === raiz) { console.error("✘ La carpeta de salida no puede estar dentro del proyecto."); process.exit(1); }
if (existsSync(salida)) { console.error(`✘ Ya existe ${salida}. Bórrala o elige otro nombre con --salida.`); process.exit(1); }

const EXCLUIR = new Set(["node_modules", "dist", ".git", ".env", ".env.local", ".DS_Store"]);
cpSync(raiz, salida, { recursive: true, filter: (origen) => { const r = relative(raiz, origen); return !r.split(sep).some((p) => EXCLUIR.has(p)) && !r.endsWith(".zip"); } });

const tocar = (rel, fn) => { const f = join(salida, rel); const s = readFileSync(f, "utf8"); const n = fn(s); if (n === s) console.warn(`⚠ No cambió nada en ${rel} (revisa a mano)`); writeFileSync(f, n); };

// 1) Firebase: sin la configuración de respaldo
tocar("src/firebase.js", (s) => s.replace(/\/\/ <<CONFIG-DE-RESPALDO-INICIO>>[\s\S]*?\/\/ <<CONFIG-DE-RESPALDO-FIN>>/, "const configDeRespaldo = null; // esta instalación usa SOLO las variables de entorno (ver docs/INSTALACION.md)"));
// 2) Nombre y menú de fábrica neutros
tocar("src/constantes.js", (s) => s
  .replace(/businessName: "Dulce & Café"/, `businessName: ${JSON.stringify(nombre)}`)
  .replace(/export const DEFAULT_MENU = \[[\s\S]*?\n\];/, 'export const DEFAULT_MENU = [\n  { id: "demo1", name: "Producto de ejemplo", price: 5000, cost: 0, cat: "General" },\n];'));
tocar("src/componentes/AsistenteInicio.jsx", (s) => s.replace(' && config.businessName !== "Dulce & Café"', ""));
tocar("src/extras.jsx", (s) => s.replace('placeholder="Ej: Dulce & Café"', 'placeholder="Nombre de tu negocio"'));
tocar("public/manifest.json", (s) => s.replace("Dulce & Café — Comandas", `${nombre} — Comandas`).replace("Mesero, Cocina y Caja para Dulce & Café", `Mesero, Cocina y Caja para ${nombre}`));
// 3) Cosas que son tuyas y no deben viajar
for (const rel of ["tools/preparar-entrega.mjs"]) { /* se conserva: sirve al comprador para entregar a su vez */ void rel; }

// 4) Revisión: ¿quedó algo de tu negocio?
const pistas = [/dulce-y-cafe/i, /dabf3/, /AIzaSy[\w-]{20,}/, /Dulce & Caf/i];
const hallazgos = [];
const recorrer = (d) => { for (const e of readdirSync(d)) { const f = join(d, e); const st = statSync(f); if (st.isDirectory()) { recorrer(f); continue; } if (!/\.(js|jsx|mjs|json|html|css|md|toml|yml|txt|example)$/.test(e) || e === "package-lock.json" || e === "preparar-entrega.mjs") continue; const t = readFileSync(f, "utf8"); pistas.forEach((p) => { if (p.test(t)) hallazgos.push(`${relative(salida, f)}  ←  ${p}`); }); } };
recorrer(salida);

console.log(`✔ Copia limpia creada en: ${salida}\n  Nombre del negocio: ${nombre}`);
if (hallazgos.length) { console.log("\n⚠ Todavía aparece algo de tu negocio en estos archivos (puede ser solo documentación; revísalo):"); [...new Set(hallazgos)].forEach((h) => console.log("  · " + h)); }
console.log("\nPendiente a mano:\n  1. Cambia los íconos de la carpeta public/icons (hoy son los de tu negocio).\n  2. Súbela a un repositorio PRIVADO del comprador (nunca al tuyo).\n  3. El comprador sigue docs/INSTALACION.md (su Firebase, sus variables de entorno, sus reglas).");

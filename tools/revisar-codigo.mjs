// Revisión automática de código SIN instalar nada (no hay ESLint en este proyecto): frena los errores que ya nos costaron caro.
// Errores (frenan `npm run verificar`) y avisos (solo informan).   npm run revisar
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const archivos = [];
(function recorrer(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === "node_modules" || n === "dist" || n.startsWith(".")) continue;
    if (statSync(p).isDirectory()) recorrer(p);
    else if (/\.(js|jsx|mjs)$/.test(n)) archivos.push(p);
  }
})(join(raiz, "src")); 
(function recorrer(dir) { try { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) recorrer(p); else if (/\.mjs$/.test(n)) archivos.push(p); } } catch (e) { /* no hay carpeta */ } })(join(raiz, "netlify"));

const REGLAS = [
  { id: "console.log", nivel: "error", re: /console\.log\(/, msg: "console.log olvidado (usa console.error solo para errores reales)" },
  { id: "html-crudo", nivel: "error", re: /dangerouslySetInnerHTML|\beval\(|new Function\(/, msg: "HTML o código dinámico sin control (riesgo XSS)" },
  { id: "cuenta-completa", nivel: "error", re: /\bsaveCuenta\(\{\s*\.\.\./, msg: "Guarda la cuenta ENTERA desde una copia posiblemente vieja y puede borrar un cobro de otro dispositivo: usa parcharCuenta() o actualizarCuenta()", excepto: [/src\/App\.jsx$/] },
  { id: "id-con-random", nivel: "error", re: /Math\.random\(\)\.toString\(36\)/, msg: "Identificador con Math.random (predecible): usa uid() de logica.js", excepto: [/src\/logica\.js$/, /tools\//] },
  { id: "token-en-storage", nivel: "error", re: /(local|session)Storage\.setItem\(\s*["\x27`][^"\x27`]*(token|password|contrase)/i, msg: "No guardes tokens ni claves en localStorage" },
  { id: "catch-vacio", nivel: "aviso", re: /catch\s*(\([^)]*\))?\s*\{\s*\}/, msg: "catch vacío: al menos deja un comentario de por qué se ignora, o registra el error" },
  { id: "eslint-disable", nivel: "aviso", re: /eslint-disable/, msg: "comentario eslint-disable sin ESLint instalado" },
];
const LIMITE_LINEAS = 600;

let errores = 0, avisos = 0;
for (const f of archivos) {
  const rel = relative(raiz, f).replaceAll("\\", "/");
  const texto = readFileSync(f, "utf8"); const lineas = texto.split("\n");
  if (lineas.length > LIMITE_LINEAS) { avisos++; console.log(`⚠ ${rel}: ${lineas.length} líneas (más de ${LIMITE_LINEAS}): conviene partirlo`); }
  lineas.forEach((l, i) => {
    for (const r of REGLAS) {
      if (r.excepto && r.excepto.some((x) => x.test(rel))) continue;
      if (rel.startsWith("tools/") && r.id !== "console.log") continue;
      if (r.re.test(l)) {
        if (r.nivel === "error") { errores++; console.log(`✘ ${rel}:${i + 1}  ${r.msg}`); } else { avisos++; if (avisos <= 12) console.log(`⚠ ${rel}:${i + 1}  ${r.msg}`); }
      }
    }
  });
}
console.log(`\n${archivos.length} archivos revisados · ${errores} error(es) · ${avisos} aviso(s)`);
if (errores > 0) process.exit(1);

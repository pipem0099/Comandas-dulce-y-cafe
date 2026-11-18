// Busca botones de solo icono sin nombre para lectores de pantalla (sin aria-label ni title ni texto).   npm run accesibilidad:revisar
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const archivos = [];
(function recorrer(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) recorrer(p); else if (p.endsWith(".jsx")) archivos.push(p); } })("src");

function finEtiqueta(s, i) { // índice del ">" que cierra la etiqueta de apertura (fuera de llaves y comillas)
  let prof = 0, q = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === q && s[j - 1] !== "\\") q = null; continue; }
    if (prof > 0 && (c === '"' || c === "'" || c === "`")) { q = c; continue; }
    if (prof === 0 && c === '"') { q = c; continue; }
    if (c === "{") prof++; else if (c === "}") prof--; else if (c === ">" && prof === 0 && s[j - 1] !== "=") return j;
  }
  return -1;
}
const sinNombre = [];
for (const archivo of archivos) {
  const s = readFileSync(archivo, "utf8");
  for (const m of s.matchAll(/<button\b/g)) {
    const e = finEtiqueta(s, m.index); if (e < 0) continue;
    const apertura = s.slice(m.index, e + 1);
    if (/aria-label=|aria-labelledby=|\btitle=/.test(apertura)) continue;
    const cierre = s.indexOf("</button>", e); if (cierre < 0) continue;
    const dentro = s.slice(e + 1, cierre);
    const sinIconos = dentro.replace(/<[A-Za-z][^>]*\/>/g, "").replace(/<\/?[A-Za-z][^>]*>/g, "");
    // Si dentro hay una expresión {...} se asume que muestra un texto (ej. {label}); solo se marcan los de verdad mudos: iconos y símbolos como ✕.
    const conLetras = /\{/.test(sinIconos) || /[A-Za-zÁÉÍÓÚáéíóúñÑ]{2,}/.test(sinIconos);
    if (!conLetras) sinNombre.push(`${archivo}:${s.slice(0, m.index).split("\n").length}`);
  }
}
if (sinNombre.length === 0) console.log("✔ Todos los botones tienen nombre para lectores de pantalla.");
else { console.log(`✘ ${sinNombre.length} botón(es) de solo icono sin nombre:`); sinNombre.forEach((x) => console.log("  " + x)); }
process.exit(sinNombre.length ? 1 : 0);

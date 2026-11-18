// Crea dist-e2e-v2: una COPIA de la app de prueba que se comporta como una versión distinta publicada después
// (otro buildId, otros nombres de archivo con hash y otro service worker). Sirve para probar el aviso «Hay una versión nueva».
//   Se ejecuta solo al final de `npm run e2e:construir`.
import { cpSync, readFileSync, writeFileSync, readdirSync, statSync, renameSync, rmSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { createHash } from "node:crypto";

const origen = resolve("dist-e2e"), destino = resolve("dist-e2e-v2");
if (!existsSync(origen)) { console.error("Falta dist-e2e: construye primero la versión de prueba."); process.exit(1); }
rmSync(destino, { recursive: true, force: true }); cpSync(origen, destino, { recursive: true });

const precache = JSON.parse(readFileSync(join(destino, "precache.json"), "utf8"));
const viejo = precache.buildId, nuevo = "e2e-version-2";
const archivos = []; const rec = (d) => readdirSync(d).forEach((n) => { const r = join(d, n); if (statSync(r).isDirectory()) rec(r); else archivos.push(r); }); rec(destino);
const esTexto = (f) => /\.(js|css|html|json)$/.test(f);

// 1) Los archivos del paquete que llevan el buildId viejo cambian de contenido Y de nombre (así la caché no los confunde con los de la versión anterior).
const renombres = [];
for (const f of archivos.filter((x) => relative(destino, x).startsWith("assets") && esTexto(x))) {
  const t = readFileSync(f, "utf8");
  if (!t.includes(viejo)) continue;
  writeFileSync(f, t.split(viejo).join(nuevo));
  const nombreNuevo = f.replace(/(\.[a-z]+)$/, "-v2$1"); renameSync(f, nombreNuevo);
  renombres.push([relative(destino, f).split("\\").join("/"), relative(destino, nombreNuevo).split("\\").join("/")]);
}
if (renombres.length === 0) { console.error(`No se encontró el buildId «${viejo}» dentro del paquete: ¿se está metiendo en la compilación?`); process.exit(1); }
// 2) Quienes los nombran (index.html, otros paquetes, precache.json) apuntan a los nombres nuevos.
for (const f of archivos.filter((x) => existsSync(x) && esTexto(x))) {
  let t = readFileSync(f, "utf8"), cambio = false;
  for (const [a, b] of renombres) { const n = a.split("/").pop(), m = b.split("/").pop(); if (t.includes(n)) { t = t.split(n).join(m); cambio = true; } }
  if (cambio) writeFileSync(f, t);
}
// 3) precache.json de la versión 2 y un service worker distinto (para que el navegador detecte que hay uno nuevo).
const lista = precache.archivos.map((u) => { const r = renombres.find(([a]) => `/${a}` === u); return r ? `/${r[1]}` : u; });
writeFileSync(join(destino, "precache.json"), JSON.stringify({ version: createHash("sha1").update(lista.join("|")).digest("hex").slice(0, 10), buildId: nuevo, archivos: lista }));
writeFileSync(join(destino, "sw.js"), readFileSync(join(destino, "sw.js"), "utf8") + `\n// versión de prueba ${nuevo}\n`);
console.log(`dist-e2e-v2 listo · buildId ${nuevo} · ${renombres.length} archivo(s) renombrado(s)`);

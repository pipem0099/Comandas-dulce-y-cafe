// Corre todas las pruebas de pantalla (tools/humo/*.humo.jsx), cada una en su propio proceso.   npm run humo:probar
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const archivos = readdirSync(aqui).filter((f) => f.endsWith(".humo.jsx")).sort();
let malas = 0, totalOk = 0, totalMal = 0;
for (const f of archivos) {
  const r = spawnSync(process.execPath, [join(aqui, "una.mjs"), join(aqui, f)], { encoding: "utf8" });
  const lineas = (r.stdout || "").split("\n");
  const buenas = lineas.filter((l) => l.startsWith("✔")).length, falladas = lineas.filter((l) => l.startsWith("✘"));
  totalOk += buenas; totalMal += falladas.length;
  console.log(`${r.status === 0 && falladas.length === 0 ? "✔" : "✘"} ${f.replace(".humo.jsx", "")}: ${buenas} pruebas bien${falladas.length ? `, ${falladas.length} mal` : ""}`);
  falladas.forEach((l) => console.log("    " + l));
  if (r.status !== 0) { malas++; if (falladas.length === 0) console.log("    " + String(r.stderr || r.stdout).split("\n").filter((l) => !/^Warning|^    at /.test(l)).slice(-6).join("\n    ")); }
}
console.log(`\n${totalOk} pruebas de pantalla correctas${totalMal ? `, ${totalMal} fallaron` : ""}.`);
if (malas > 0 || totalMal > 0) process.exit(1);

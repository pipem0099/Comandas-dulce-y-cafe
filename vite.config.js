import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Identificador de ESTA compilación: un hash del contenido de la app (código, index.html, archivos públicos).
// Se mete en el paquete (BUILD_ID) y se copia a precache.json; así la app instalada puede saber si hay una versión más nueva publicada.
// Es el mismo si el contenido es el mismo y cambia con cualquier cambio de código.
function calcularBuildId() {
  const h = createHash("sha1");
  const recorrer = (dir) => {
    if (!existsSync(dir)) return;
    for (const nombre of readdirSync(dir).sort()) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else { h.update(ruta); h.update(readFileSync(ruta)); }
    }
  };
  recorrer("src"); recorrer("public");
  if (existsSync("index.html")) h.update(readFileSync("index.html"));
  return h.digest("hex").slice(0, 12);
}
const BUILD_ID = process.env.COMANDAS_BUILD_ID || calcularBuildId();

// Lista de archivos de la app (la "cáscara") que el service worker guarda para abrir sin internet.
// Los archivos del paquete llevan el hash de su contenido en el nombre, así que la lista cambia sola con cada versión nueva.
function manifiestoPrecache() {
  return {
    name: "manifiesto-precache",
    apply: "build",
    generateBundle(_opciones, bundle) {
      const delPaquete = Object.keys(bundle).filter((f) => !f.endsWith(".map") && f !== "index.html").map((f) => `/${f}`);
      const iconos = existsSync("public/icons") ? readdirSync("public/icons").map((f) => `/icons/${f}`) : [];
      const archivos = ["/", ...delPaquete, "/manifest.json", ...iconos];
      const version = createHash("sha1").update(archivos.join("|")).digest("hex").slice(0, 10);
      this.emitFile({ type: "asset", fileName: "precache.json", source: JSON.stringify({ version, buildId: BUILD_ID, archivos }) });
    },
  };
}

export default defineConfig({
  plugins: [react(), manifiestoPrecache()],
  define: { __COMANDAS_BUILD__: JSON.stringify(BUILD_ID) },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Las librerías grandes van en archivos aparte: se descargan en paralelo, se guardan en caché y
        // las que solo usan las pantallas de administración (gráficas) no se bajan hasta que hacen falta.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";
          if (/node_modules\/(@firebase|firebase)\//.test(id)) return "vendor-firebase";
          if (/node_modules\/(recharts|d3-|victory-vendor|recharts-scale|internmap|decimal\.js-light)/.test(id)) return "vendor-graficas";
          return undefined;
        },
      },
    },
  },
});

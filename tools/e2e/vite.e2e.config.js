// Versión de PRUEBA de la app: igual que la de producción, pero con un Firebase simulado que corre en el propio navegador.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import base from "../../vite.config.js";

const fake = (f) => resolve(import.meta.dirname, "fake", f);
export default defineConfig({
  ...base,
  plugins: base.plugins,
  build: { ...base.build, outDir: "dist-e2e", emptyOutDir: true },
  resolve: { alias: { "firebase/app": fake("app.js"), "firebase/auth": fake("auth.js"), "firebase/database": fake("database.js") } },
});

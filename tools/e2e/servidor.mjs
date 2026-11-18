// Servidor estático mínimo para las pruebas: sirve dist-e2e y devuelve index.html para cualquier ruta de la app.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
// `cambiarCarpeta(otra)` simula una DESPLIEGUE NUEVO: de ahí en adelante el servidor entrega los archivos de otra carpeta (otra versión de la app).
export function iniciarServidor(carpetaInicial, puerto = 0) {
  let carpeta = carpetaInicial;
  const srv = http.createServer(async (req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const intentos = [normalize(join(carpeta, ruta)), join(carpeta, "index.html")];
    for (const archivo of intentos) {
      if (!archivo.startsWith(carpeta)) continue;
      try {
        const datos = await readFile(archivo);
        const esIndex = archivo.endsWith("index.html");
        res.writeHead(200, { "content-type": TIPOS[extname(archivo)] || "application/octet-stream", "cache-control": esIndex || ruta === "/sw.js" || ruta === "/precache.json" ? "no-cache" : "public, max-age=31536000, immutable" });
        res.end(datos); return;
      } catch (_) { /* siguiente intento */ }
    }
    res.writeHead(404); res.end("no encontrado");
  });
  return new Promise((ok) => srv.listen(puerto, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${srv.address().port}`, cerrar: () => new Promise((r) => srv.close(r)), cambiarCarpeta: (otra) => { carpeta = otra; } })));
}

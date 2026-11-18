// Netlify Function «facturacion»: emite, anula y reenvía facturas electrónicas con el proveedor que eligió el restaurante,
// y guarda sus credenciales CIFRADAS. Toda la lógica está en tools/facturacion/servicio.mjs (probada sin Netlify).
//
// Variables de entorno en Netlify (docs/FACTURACION_DIAN.md, sección técnica):
//   CLAVE_CIFRADO_FACTURACION   llave maestra AES-256 (64 caracteres hexadecimales).   npm run facturacion:llave
//   FIREBASE_SERVICE_ACCOUNT    JSON de la cuenta de servicio de Firebase (para leer/escribir la rama protegida).
//   VITE_FIREBASE_PROJECT_ID y VITE_FIREBASE_DATABASE_URL (ya existen: son las de la app).
import { randomBytes } from "node:crypto";
import { verificarTokenFirebase, permitirUso } from "../lib/menuFoto.mjs";
import { leerCuentaServicio, crearFuenteDeToken, crearDbAdmin } from "../lib/firebaseAdmin.mjs";
import { procesar } from "../../tools/facturacion/servicio.mjs";
import { cargarLlave } from "../../tools/facturacion/cifrado.mjs";
import { ADAPTADORES } from "../../src/facturacion/adaptadores/index.js";

const env = (k) => (typeof process !== "undefined" && process.env ? process.env[k] : "") || "";
const responder = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

let fuente = null;
const dbReal = (databaseUrl) => {
  if (!fuente) fuente = crearFuenteDeToken(leerCuentaServicio(env("FIREBASE_SERVICE_ACCOUNT")));
  return crearDbAdmin({ databaseUrl, tokenAcceso: fuente });
};

export default async (req) => {
  if (req.method !== "POST") return responder(405, { ok: false, error: "metodo", mensaje: "Método no permitido." });
  const projectId = env("VITE_FIREBASE_PROJECT_ID") || env("FIREBASE_PROJECT_ID");
  const databaseUrl = env("VITE_FIREBASE_DATABASE_URL") || env("FIREBASE_DATABASE_URL");
  if (!projectId || !databaseUrl || !env("FIREBASE_SERVICE_ACCOUNT")) {
    return responder(503, { ok: false, error: "no_configurado", mensaje: "La facturación todavía no está activada en el servidor: falta FIREBASE_SERVICE_ACCOUNT en Netlify. Avísale a quien instaló la app." });
  }
  if (Number(req.headers.get("content-length") || 0) > 20000) return responder(413, { ok: false, error: "grande", mensaje: "La solicitud es demasiado grande." });
  let solicitud;
  try { solicitud = await req.json(); } catch (e) { return responder(400, { ok: false, error: "datos", mensaje: "No se pudo leer la solicitud." }); }
  if (!solicitud || typeof solicitud !== "object") return responder(400, { ok: false, error: "datos", mensaje: "Solicitud no válida." });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  const deps = {
    verificarToken: (t) => verificarTokenFirebase(t, { projectId }),
    db: dbReal(databaseUrl), llave: () => cargarLlave(env("CLAVE_CIFRADO_FACTURACION")),
    adaptadores: ADAPTADORES, fetch: (...a) => fetch(...a), nuevoId: () => randomBytes(4).toString("hex"),
  };
  // Freno sencillo para las acciones de configuración (no para emitir: una caja ocupada factura cientos de veces por hora).
  if (["guardar_credenciales", "probar_conexion"].includes(solicitud.accion)) {
    let uid = ""; try { uid = (await deps.verificarToken(token)).uid; } catch (e) { /* procesar responderá 401 */ }
    if (uid && !permitirUso(`${uid}:fact`, { maximo: 30 })) return responder(429, { ok: false, error: "limite", mensaje: "Demasiados intentos seguidos. Espera un rato e inténtalo de nuevo." });
  }
  const r = await procesar(solicitud, token, deps);
  return responder(r.status, r.cuerpo);
};

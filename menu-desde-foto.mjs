// Función de Netlify: recibe UNA foto de la carta y devuelve el menú ya ordenado por categorías.
// Solo la puede usar un administrador con sesión iniciada. La clave de la IA vive aquí, nunca en el celular.
//
// Variables de entorno necesarias (Netlify → Site configuration → Environment variables):
//   ANTHROPIC_API_KEY            clave de la IA (console.anthropic.com)
//   ANTHROPIC_MODEL              (opcional) modelo a usar; por defecto claude-sonnet-5-5
//   VITE_FIREBASE_PROJECT_ID     las mismas que ya usa la app
//   VITE_FIREBASE_DATABASE_URL
import { verificarTokenFirebase, esAdminActivo, permitirUso, leerCartaConIA, extraerJSON, normalizarMenuIA, tipoImagenValido } from "../lib/menuFoto.mjs";

const env = (k) => (typeof Netlify !== "undefined" && Netlify.env ? Netlify.env.get(k) : process.env[k]);
const responder = (estado, objeto) => new Response(JSON.stringify(objeto), { status: estado, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return responder(405, { error: "metodo", mensaje: "Método no permitido." });

  const apiKey = env("ANTHROPIC_API_KEY");
  const projectId = env("VITE_FIREBASE_PROJECT_ID") || env("FIREBASE_PROJECT_ID");
  const databaseUrl = env("VITE_FIREBASE_DATABASE_URL") || env("FIREBASE_DATABASE_URL");
  if (!apiKey || !projectId || !databaseUrl) {
    return responder(503, { error: "no_configurado", mensaje: "Esta función todavía no está activada en este negocio. Pídele a quien instaló la app que agregue la clave de IA." });
  }

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  let sesion;
  try { sesion = await verificarTokenFirebase(token, { projectId }); }
  catch (e) { return responder(401, { error: "sesion", mensaje: "Tu sesión no es válida. Cierra sesión y vuelve a entrar." }); }
  if (!(await esAdminActivo({ uid: sesion.uid, token, databaseUrl }))) return responder(403, { error: "permiso", mensaje: "Solo un administrador puede crear el menú desde una foto." });
  if (!permitirUso(sesion.uid)) return responder(429, { error: "limite", mensaje: "Ya usaste esta función varias veces en la última hora. Inténtalo más tarde." });

  let cuerpo;
  try { cuerpo = await req.json(); } catch (e) { return responder(400, { error: "datos", mensaje: "No se pudo leer la foto." }); }
  const tipo = cuerpo && cuerpo.tipo; const datos = cuerpo && cuerpo.datos;
  if (!tipoImagenValido(tipo) || typeof datos !== "string" || datos.length < 100) return responder(400, { error: "datos", mensaje: "La foto no es válida. Usa una imagen JPG o PNG." });
  if (datos.length > 5_000_000) return responder(413, { error: "grande", mensaje: "La foto es muy pesada. Intenta con una más pequeña." });

  try {
    const texto = await leerCartaConIA({ apiKey, modelo: env("ANTHROPIC_MODEL") || "claude-sonnet-5-5", tipoImagen: tipo, datosBase64: datos });
    const menu = normalizarMenuIA(extraerJSON(texto));
    if (menu.total === 0) return responder(422, { error: "vacio", mensaje: "No pude encontrar productos en la foto. Prueba con más luz, de frente y sin reflejos." });
    return responder(200, menu);
  } catch (e) {
    console.error("menu-desde-foto:", e && e.estado, e && e.message, e && e.detalle);
    if (e && e.estado === 504) return responder(504, { error: "tiempo", mensaje: "La lectura tardó demasiado. Prueba con una foto de una sola sección de la carta." });
    if (e && (e.estado === 401 || e.estado === 403)) return responder(502, { error: "clave", mensaje: "La clave de la IA no es válida o no tiene saldo. Avísale a quien instaló la app." });
    if (e && e.estado === 429) return responder(429, { error: "limite_ia", mensaje: "La IA está ocupada. Inténtalo de nuevo en un minuto." });
    return responder(502, { error: "ia", mensaje: "No se pudo leer la carta ahora. Inténtalo otra vez." });
  }
};

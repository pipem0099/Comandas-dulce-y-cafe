// Lógica del servidor para "Crear el menú desde una foto".
// Vive aparte de la función para poder probarla sin Netlify (npm run menu-foto:probar).
import { createPublicKey, createVerify } from "node:crypto";
import { leerPrecio, normalizarMenuIA } from "../../src/menuFotoLogica.js";
export { leerPrecio, normalizarMenuIA };

/* ───────── 1) Quién llama: se comprueba el inicio de sesión de Firebase, sin librerías externas ───────── */
const URL_CERTIFICADOS = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let cacheCertificados = { certs: null, hasta: 0 };

export async function certificadosGoogle(fetchFn = fetch, ahora = Date.now()) {
  if (cacheCertificados.certs && ahora < cacheCertificados.hasta) return cacheCertificados.certs;
  const r = await fetchFn(URL_CERTIFICADOS);
  if (!r.ok) throw new Error("No se pudieron leer los certificados de Google");
  const certs = await r.json();
  const m = /max-age=(\d+)/.exec((r.headers && r.headers.get && r.headers.get("cache-control")) || "");
  cacheCertificados = { certs, hasta: ahora + (m ? Number(m[1]) : 3600) * 1000 };
  return certs;
}

const desdeBase64Url = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Verifica un "ID token" de Firebase (firma RS256, proyecto, emisor y vencimiento). Devuelve { uid }. */
export async function verificarTokenFirebase(token, { projectId, ahora = Date.now(), certificados = certificadosGoogle }) {
  const partes = String(token || "").split(".");
  if (partes.length !== 3) throw new Error("Sesión no válida");
  let cabecera, datos;
  try { cabecera = JSON.parse(desdeBase64Url(partes[0]).toString("utf8")); datos = JSON.parse(desdeBase64Url(partes[1]).toString("utf8")); }
  catch (e) { throw new Error("Sesión no válida"); }
  if (cabecera.alg !== "RS256" || !cabecera.kid) throw new Error("Sesión no válida");
  const certs = await certificados();
  const pem = certs[cabecera.kid];
  if (!pem) throw new Error("Sesión no reconocida");
  const firmaOk = createVerify("RSA-SHA256").update(`${partes[0]}.${partes[1]}`).verify(createPublicKey(pem), desdeBase64Url(partes[2]));
  if (!firmaOk) throw new Error("Firma no válida");
  const seg = Math.floor(ahora / 1000);
  if (!projectId || datos.aud !== projectId) throw new Error("Sesión de otro proyecto");
  if (datos.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Emisor no válido");
  if (!(datos.exp > seg)) throw new Error("La sesión venció");
  if (datos.iat && datos.iat > seg + 300) throw new Error("Sesión no válida");
  if (!datos.sub) throw new Error("Sesión no válida");
  return { uid: datos.sub };
}

/** Solo un administrador ACTIVO puede usar la función: se lee su perfil con su propio inicio de sesión (las reglas ya lo permiten). */
export async function esAdminActivo({ uid, token, databaseUrl, fetchFn = fetch }) {
  const base = String(databaseUrl || "").replace(/\/$/, "");
  if (!base) return false;
  const r = await fetchFn(`${base}/perfiles/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`);
  if (!r.ok) return false;
  const p = await r.json();
  return !!p && p.activo === true && !!p.roles && p.roles.admin === true;
}

/* ───────── 2) Límite de uso por persona (un freno sencillo, por instancia) ───────── */
const usos = new Map();
export function permitirUso(uid, { maximo = 12, ventanaMs = 60 * 60 * 1000, ahora = Date.now() } = {}) {
  const recientes = (usos.get(uid) || []).filter((t) => ahora - t < ventanaMs);
  if (recientes.length >= maximo) { usos.set(uid, recientes); return false; }
  recientes.push(ahora); usos.set(uid, recientes);
  return true;
}

/* ───────── 3) La IA lee la carta ───────── */
export const PROMPT_MENU = `Eres un asistente que digitaliza cartas de restaurantes, cafeterías, bares y panaderías de Colombia.
Mira la imagen de la carta y responde SOLO con un JSON válido (sin texto antes ni después, sin \`\`\`), con esta forma exacta:
{"categorias":[{"nombre":"Bebidas calientes","productos":[{"nombre":"Tinto","precio":3000,"descripcion":"","dudoso":false}]}]}

Reglas:
- Una categoría por cada sección de la carta. Si no hay secciones, usa la categoría "Carta".
- "precio" es un número entero en pesos colombianos, sin símbolos ni puntos: "9.000", "9,000" y "$9000" significan 9000.
- Si el precio aparece abreviado ("9", "9k", "9 mil"), son miles: devuelve 9000 y pon "dudoso": true.
- Si un producto tiene varios tamaños o sabores con precios distintos, crea un producto por variante, por ejemplo "Limonada (grande)".
- Si no se ve el precio, usa 0 y "dudoso": true.
- No inventes productos ni precios. Copia los nombres como están escritos y corrige solo errores de ortografía evidentes.
- Ignora teléfonos, direcciones, redes sociales, horarios y textos promocionales.
- "descripcion" es corta (máximo 100 caracteres) y puede ir vacía.
- Máximo 150 productos.`;

export async function leerCartaConIA({ apiKey, modelo, tipoImagen, datosBase64, fetchFn = fetch, timeoutMs = 24000 }) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetchFn("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: control.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: modelo, max_tokens: 6000,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: tipoImagen, data: datosBase64 } },
          { type: "text", text: PROMPT_MENU },
        ] }],
      }),
    });
    if (!r.ok) {
      const detalle = await r.text().catch(() => "");
      const e = new Error(`La IA respondió ${r.status}`); e.estado = r.status; e.detalle = detalle.slice(0, 300); throw e;
    }
    const cuerpo = await r.json();
    return (cuerpo.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  } catch (e) {
    if (e && e.name === "AbortError") { const t = new Error("La IA tardó demasiado"); t.estado = 504; throw t; }
    throw e;
  } finally { clearTimeout(temporizador); }
}

/* ───────── 4) Limpiar lo que devuelve la IA (nunca se confía a ciegas) ───────── */
export function extraerJSON(texto) {
  const t = String(texto || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch (e) { /* intenta recortar al primer { … último } */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* nada */ } }
  return null;
}
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const tipoImagenValido = (t) => TIPOS_OK.includes(t);

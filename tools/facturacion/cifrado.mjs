/*
 * Cifrado de credenciales: AES-256-GCM con la llave maestra de Netlify (CLAVE_CIFRADO_FACTURACION). Solo Node (node:crypto).
 * Se prueba con `npm run fiscal:probar` (probar-cifrado-fiscal.mjs).
 *
 * Formato guardado:  v1.<iv>.<etiqueta>.<texto cifrado>   (base64url, separado por puntos)
 *  · IV de 12 bytes NUEVO al azar en cada cifrado (nunca se reutiliza con la misma llave).
 *  · La etiqueta de autenticación (16 bytes) detecta cualquier alteración del texto cifrado.
 *  · El «contexto» (por ejemplo el proveedor) viaja como datos autenticados (AAD): un secreto cifrado para Factus
 *    no se puede pasar por uno de Alegra aunque alguien copie el valor de un lugar a otro de la base de datos.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const b64u = (buf) => Buffer.from(buf).toString("base64url");

/** Acepta 64 caracteres hexadecimales o 32 bytes en base64. Cualquier otra cosa es un error claro (no se "adivina" ni se rellena). */
export function cargarLlave(valor) {
  const s = String(valor || "").trim();
  if (!s) throw new Error("Falta la variable CLAVE_CIFRADO_FACTURACION en Netlify.");
  let buf = null;
  if (/^[0-9a-fA-F]{64}$/.test(s)) buf = Buffer.from(s, "hex");
  else { try { const b = Buffer.from(s, "base64"); if (b.length === 32 && b.toString("base64").replace(/=+$/, "") === s.replace(/=+$/, "")) buf = b; } catch (e) { buf = null; } }
  if (!buf || buf.length !== 32) throw new Error("CLAVE_CIFRADO_FACTURACION debe ser de 32 bytes: 64 caracteres hexadecimales (genérala con `npm run facturacion:llave`).");
  return buf;
}

export const generarLlave = () => randomBytes(32).toString("hex");

export function cifrar(objeto, llave, contexto = "") {
  const key = Buffer.isBuffer(llave) ? llave : cargarLlave(llave);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(String(contexto), "utf8"));
  const ct = Buffer.concat([c.update(JSON.stringify(objeto), "utf8"), c.final()]);
  return [VERSION, b64u(iv), b64u(c.getAuthTag()), b64u(ct)].join(".");
}

export function descifrar(texto, llave, contexto = "") {
  const key = Buffer.isBuffer(llave) ? llave : cargarLlave(llave);
  const partes = String(texto || "").split(".");
  if (partes.length !== 4 || partes[0] !== VERSION) throw new Error("Credenciales guardadas con un formato desconocido.");
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(partes[1], "base64url"));
    d.setAAD(Buffer.from(String(contexto), "utf8"));
    d.setAuthTag(Buffer.from(partes[2], "base64url"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(partes[3], "base64url")), d.final()]).toString("utf8"));
  } catch (e) {
    // Mensaje único a propósito: no se distingue "llave equivocada" de "dato alterado".
    throw new Error("No se pudieron descifrar las credenciales (llave distinta o dato alterado). Vuelve a guardarlas.");
  }
}

// Acceso de la función del servidor a Firebase Realtime Database con una CUENTA DE SERVICIO (permisos de administrador: salta las reglas).
// Sin librerías: se firma un JWT (RS256) con node:crypto y se cambia por un token de acceso de Google; la base se usa por REST.
// Por qué hace falta: las credenciales de facturación viven en una rama que NINGÚN navegador puede leer ni escribir (database.rules.json);
// solo el servidor, con esta cuenta, las toca. Variable de Netlify:  FIREBASE_SERVICE_ACCOUNT  (el JSON de la cuenta de servicio).
import { createSign } from "node:crypto";

const ALCANCES = "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email";
const b64u = (x) => Buffer.from(x).toString("base64url");

export function leerCuentaServicio(valor) {
  let t = String(valor || "").trim();
  if (!t) throw new Error("Falta la variable FIREBASE_SERVICE_ACCOUNT en Netlify.");
  if (!t.startsWith("{")) { try { t = Buffer.from(t, "base64").toString("utf8"); } catch (e) { /* se valida abajo */ } }
  let o; try { o = JSON.parse(t); } catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido (pega el archivo completo, o su versión en base64)."); }
  if (!o.client_email || !o.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT no parece una cuenta de servicio (faltan client_email o private_key).");
  return { client_email: o.client_email, private_key: o.private_key, token_uri: o.token_uri || "https://oauth2.googleapis.com/token" };
}

export function firmarJwt(cuenta, ahoraMs = Date.now()) {
  const iat = Math.floor(ahoraMs / 1000);
  const cab = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64u(JSON.stringify({ iss: cuenta.client_email, scope: ALCANCES, aud: cuenta.token_uri, iat, exp: iat + 3600 }));
  const firma = createSign("RSA-SHA256").update(`${cab}.${cuerpo}`).sign(cuenta.private_key).toString("base64url");
  return `${cab}.${cuerpo}.${firma}`;
}

export function crearFuenteDeToken(cuenta, { fetchFn = fetch, reloj = Date.now } = {}) {
  let cache = { token: "", hasta: 0 };
  return async () => {
    if (cache.token && reloj() < cache.hasta - 60000) return cache.token;
    const r = await fetchFn(cuenta.token_uri, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: firmarJwt(cuenta, reloj()) }).toString() });
    if (!r.ok) throw new Error(`Google rechazó la cuenta de servicio (HTTP ${r.status}).`);
    const j = await r.json();
    cache = { token: j.access_token, hasta: reloj() + (Number(j.expires_in) || 3600) * 1000 };
    return cache.token;
  };
}

/** Misma interfaz que tools/facturacion/dbMemoria.mjs. */
export function crearDbAdmin({ databaseUrl, tokenAcceso, fetchFn = fetch }) {
  const base = String(databaseUrl || "").replace(/\/$/, "");
  if (!base) throw new Error("Falta la dirección de la base de datos (VITE_FIREBASE_DATABASE_URL).");
  const url = async (ruta, extra = "") => `${base}/${String(ruta).split("/").map(encodeURIComponent).join("/")}.json?access_token=${encodeURIComponent(await tokenAcceso())}${extra}`;
  const falla = async (r, que) => { throw new Error(`Firebase ${que}: HTTP ${r.status}`); };
  return {
    async leer(ruta) { const r = await fetchFn(await url(ruta)); if (!r.ok) await falla(r, "lectura"); return r.json(); },
    async escribir(ruta, valor) { const r = await fetchFn(await url(ruta), { method: "PUT", body: JSON.stringify(valor) }); if (!r.ok) await falla(r, "escritura"); },
    async parchar(ruta, parche) { const r = await fetchFn(await url(ruta), { method: "PATCH", body: JSON.stringify(parche) }); if (!r.ok) await falla(r, "actualización"); },
    // Transacción optimista con ETag: solo se escribe si nadie cambió el dato entre la lectura y la escritura (412 → se reintenta).
    async transaccion(ruta, fn, intentos = 6) {
      for (let i = 0; i < intentos; i++) {
        const g = await fetchFn(await url(ruta), { headers: { "X-Firebase-ETag": "true" } });
        if (!g.ok) await falla(g, "lectura");
        const etag = g.headers.get("etag"); const actual = await g.json();
        const nuevo = fn(actual === undefined ? null : actual);
        if (nuevo === undefined) return { committed: false, valor: actual };
        const p = await fetchFn(await url(ruta), { method: "PUT", headers: { "if-match": etag }, body: JSON.stringify(nuevo) });
        if (p.ok) return { committed: true, valor: nuevo };
        if (p.status !== 412) await falla(p, "transacción");
      }
      throw new Error("Firebase transacción: demasiados choques seguidos.");
    },
    async pedidosDeCuenta(cuentaId) {
      const r = await fetchFn(await url("orders", `&orderBy=${encodeURIComponent('"cuentaId"')}&equalTo=${encodeURIComponent(JSON.stringify(cuentaId))}`));
      if (!r.ok) await falla(r, "lectura de pedidos");
      return Object.values((await r.json()) || {});
    },
  };
}

/*
 * Cliente de la función de facturación (lo que usa el navegador). Sin dependencias de Firebase: recibe cómo obtener el token.
 *   llamar(solicitud) → { status, cuerpo }
 * Lanza `ErrorReintentable` solo cuando NO hubo una respuesta útil (sin red, tiempo agotado, sesión vencida 401 o fallo del servidor 500/502/504):
 * en ese caso la bandeja sin conexión guarda la solicitud y la reintenta sola. Cualquier otra respuesta (200, 4xx, 503 sin configurar)
 * se entrega tal cual: el servidor ya decidió, y repetirla no cambiaría nada. El servidor es idempotente por cuenta, así que un
 * reintento NUNCA crea una segunda factura.
 */
export class ErrorReintentable extends Error { constructor(m) { super(m); this.name = "ErrorReintentable"; } }

export function crearClienteFacturacion({ obtenerToken, fetchFn = (...a) => fetch(...a), url = "/.netlify/functions/facturacion", timeoutMs = 45000 }) {
  return {
    async llamar(solicitud) {
      const token = await obtenerToken();
      if (!token) throw new ErrorReintentable("Sin sesión.");
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
      let r;
      try { r = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(solicitud), signal: ctl ? ctl.signal : undefined }); }
      catch (e) { throw new ErrorReintentable("No hay conexión con el servidor."); }
      finally { if (t) clearTimeout(t); }
      if ([401, 500, 502, 504].includes(r.status)) throw new ErrorReintentable(`Servidor no disponible (${r.status}).`);
      let cuerpo = null;
      try { cuerpo = await r.json(); } catch (e) { cuerpo = null; }
      if (!cuerpo) cuerpo = { ok: false, error: "no_disponible", mensaje: "La función de facturación no está disponible en este servidor." };
      return { status: r.status, cuerpo };
    },
  };
}

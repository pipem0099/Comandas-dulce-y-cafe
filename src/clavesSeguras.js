// Comprueba si una clave aparece en filtraciones conocidas (servicio "Pwned Passwords").
// Por privacidad solo se envían los primeros 5 caracteres del hash de la clave (nunca la clave ni el hash completo).
// Si no hay internet o el servicio falla, NO se bloquea a nadie: devuelve false.
export const MENSAJE_CLAVE_FILTRADA = "Esa clave aparece en filtraciones de datos conocidas. Elige otra que no hayas usado en otros sitios.";

export async function claveFiltrada(clave, { fetchFn = (typeof fetch !== "undefined" ? fetch : null), cripto = globalThis.crypto } = {}) {
  try {
    if (!fetchFn || !cripto || !cripto.subtle) return false;
    const huella = await cripto.subtle.digest("SHA-1", new TextEncoder().encode(String(clave)));
    const hex = Array.from(new Uint8Array(huella), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const r = await fetchFn(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
    if (!r.ok) return false;
    const resto = hex.slice(5);
    return (await r.text()).split("\n").some((linea) => { const [h, n] = linea.trim().split(":"); return h === resto && Number(n) > 0; });
  } catch (e) { return false; }
}

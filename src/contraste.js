/*
 * Contraste de color (WCAG): sirve para que el texto de los botones y chips activos se lea sobre CUALQUIER color de marca.
 * Pura, sin pantalla: se prueba con `npm run diseno:probar`.
 */
const canal = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };

export function luminancia(hex) {
  const h = String(hex).replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Relación de contraste entre dos colores (1 a 21). Para texto normal se recomienda 4,5 o más. */
export function contraste(a, b) {
  const la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const TEXTO_OSCURO = "#08130E";
export const TEXTO_CLARO = "#FFFFFF";

/** Blanco o casi negro, el que mejor se lea sobre `fondo`. Siempre da 4,5 o más (el punto de cruce está en ~4,6). */
export function textoSobre(fondo) {
  return contraste(TEXTO_OSCURO, fondo) >= contraste(TEXTO_CLARO, fondo) ? TEXTO_OSCURO : TEXTO_CLARO;
}

/* ───────── Mezcla de colores y estado activo de chips/pestañas ───────── */
const aHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
const canales = (hex) => { const h = String(hex).replace("#", ""); const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h; return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); };

/** Mezcla `a` con `b`: p = 0 → a, p = 1 → b. */
export function mezclar(a, b, p) {
  const [ra, ga, ba] = canales(a), [rb, gb, bb] = canales(b);
  return `#${aHex(ra + (rb - ra) * p)}${aHex(ga + (gb - ga) * p)}${aHex(ba + (bb - ba) * p)}`;
}

/** Superficies donde se apoyan los chips (tarjeta) en cada modo. */
export const SUPERFICIE = { claro: "#FFFFFF", oscuro: "#1B1D21" };

/**
 * Estado ACTIVO de un chip o pestaña: un tinte suave del color de marca (igual al de la barra inferior) con el texto del mismo
 * matiz, aclarado u oscurecido lo justo para que SIEMPRE tenga contraste de 4,5 o más. Devuelve { bg, fg, linea }.
 *   acento  color de marca;  acentoTexto  su variante clara para fondo oscuro;  modo  "claro" | "oscuro"
 */
export function fichaActiva(acento, acentoTexto, modo) {
  const oscuro = modo === "oscuro";
  const base = oscuro ? SUPERFICIE.oscuro : SUPERFICIE.claro;
  const bg = mezclar(base, acento, oscuro ? 0.34 : 0.15);
  let fg = oscuro ? acentoTexto : acento;
  const hacia = oscuro ? "#FFFFFF" : "#000000";
  for (let p = 0; contraste(fg, bg) < 4.5 && p < 1; p += 0.05) fg = mezclar(oscuro ? acentoTexto : acento, hacia, p);
  if (contraste(fg, bg) < 4.5) fg = textoSobre(bg);
  return { bg, fg, linea: mezclar(base, acento, oscuro ? 0.55 : 0.32) };
}

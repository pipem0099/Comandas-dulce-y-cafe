/*
 * Generador de comandos ESC/POS (el "idioma" de casi todas las impresoras térmicas de tickets).
 * Puro: no toca el navegador ni la impresora, así se prueba con `npm run termica:probar`.
 *
 *   const t = nuevoTicket({ columnas: 48 });          // 48 = papel de 80 mm · 32 = papel de 58 mm
 *   t.centro().negrita().doble().linea("MI NEGOCIO").normal().izquierda();
 *   t.dos("2 Limonada", "$18.000").cortar();
 *   enviar(t.bytes());
 */
export const COLUMNAS = { 58: 32, 80: 48 };

// Tabla de caracteres CP858 (la que trae casi toda impresora para español): lo que no esté aquí se imprime sin tilde.
const CP858 = { "á": 0xA0, "é": 0x82, "í": 0xA1, "ó": 0xA2, "ú": 0xA3, "ñ": 0xA4, "Ñ": 0xA5, "¿": 0xA8, "¡": 0xAD, "Á": 0xB5, "É": 0x90, "Í": 0xD6, "Ó": 0xE0, "Ú": 0xE9, "ü": 0x81, "Ü": 0x9A, "€": 0xD5, "°": 0xF8, "·": 0xFA, "×": 0x78 };
const SIN_TILDE = (c) => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Texto → bytes de la tabla de caracteres elegida. 19 = CP858 (por defecto); con otra tabla se imprime sin tildes para no mostrar símbolos raros. */
export function codificar(texto, tabla = 19) {
  const salida = [];
  for (const ch of String(texto)) {
    const cod = ch.codePointAt(0);
    if (cod >= 0x20 && cod < 0x7F) { salida.push(cod); continue; }
    if (tabla === 19 && CP858[ch] !== undefined) { salida.push(CP858[ch]); continue; }
    const base = SIN_TILDE(ch);
    if (base.length === 1 && base.codePointAt(0) >= 0x20 && base.codePointAt(0) < 0x7F) salida.push(base.codePointAt(0));
    else if (ch === "—" || ch === "–" || ch === "─") salida.push(0x2D);
    else if (ch === "\n") salida.push(0x0A);
    else salida.push(0x3F); // "?"
  }
  return salida;
}

/** Parte un texto largo en renglones del ancho del papel, sin cortar palabras (salvo las más largas que el renglón). */
export function envolver(texto, columnas) {
  const renglones = [];
  for (const parrafo of String(texto).split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let p = palabra;
      while (p.length > columnas) { if (actual) { renglones.push(actual); actual = ""; } renglones.push(p.slice(0, columnas)); p = p.slice(columnas); }
      if (!actual) actual = p;
      else if (actual.length + 1 + p.length <= columnas) actual += ` ${p}`;
      else { renglones.push(actual); actual = p; }
    }
    renglones.push(actual);
  }
  return renglones;
}

/** Izquierda y derecha en el mismo renglón; si no caben, el texto de la izquierda baja a más renglones y el valor queda en el último. */
export function dosColumnas(izq, der, columnas) {
  const d = String(der), i = String(izq);
  if (i.length + d.length + 1 <= columnas) return [i + " ".repeat(columnas - i.length - d.length) + d];
  const partes = envolver(i, Math.max(8, columnas - d.length - 1));
  const ult = partes.pop();
  return [...partes, ult + " ".repeat(Math.max(1, columnas - ult.length - d.length)) + d];
}

export function nuevoTicket({ columnas = 48, tabla = 19 } = {}) {
  const b = [];
  const poner = (...x) => { b.push(...x); return api; };
  const api = {
    columnas,
    inicializar: () => poner(0x1B, 0x40, 0x1B, 0x74, tabla),            // reiniciar + elegir tabla de caracteres
    izquierda: () => poner(0x1B, 0x61, 0),
    centro: () => poner(0x1B, 0x61, 1),
    derecha: () => poner(0x1B, 0x61, 2),
    negrita: (on = true) => poner(0x1B, 0x45, on ? 1 : 0),
    normal: () => poner(0x1D, 0x21, 0x00, 0x1B, 0x45, 0),
    doble: () => poner(0x1D, 0x21, 0x11),                               // doble ancho y alto
    altoDoble: () => poner(0x1D, 0x21, 0x01),
    texto: (t) => { b.push(...codificar(t, tabla)); return api; },
    linea: (t = "") => { envolver(t, columnas).forEach((r) => { b.push(...codificar(r, tabla), 0x0A); }); return api; },
    dos: (izq, der) => { dosColumnas(izq, der, columnas).forEach((r) => { b.push(...codificar(r, tabla), 0x0A); }); return api; },
    separador: (c = "-") => { b.push(...codificar(c.repeat(columnas), tabla), 0x0A); return api; },
    avanzar: (n = 1) => poner(0x1B, 0x64, Math.max(0, Math.min(255, n))),
    cortar: () => poner(0x1D, 0x56, 0x42, 0x00),                        // avanza y corta (parcial)
    // Código QR nativo (GS ( k): modelo 2, módulo de 4–6 puntos, corrección M. Si la impresora no lo trae, el texto del CUFE impreso igual sirve.
    qr: (texto, modulo = 5) => {
      const d = codificar(String(texto), 0); const n = d.length + 3;
      return poner(0x1D, 0x28, 0x6B, 4, 0, 0x31, 0x41, 0x32, 0, 0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x43, Math.max(1, Math.min(8, modulo)),
        0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x45, 0x31, 0x1D, 0x28, 0x6B, n & 255, n >> 8, 0x31, 0x50, 0x30, ...d, 0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x51, 0x30);
    },
    abrirGaveta: () => poner(0x1B, 0x70, 0x00, 0x19, 0xFA),
    bytes: () => Uint8Array.from(b),
  };
  return api.inicializar();
}

/** Parte los bytes en trozos (las impresoras Bluetooth aceptan pocos bytes por envío) y los manda en orden. */
export async function enviarEnTrozos(bytes, escribir, tamano = 100, pausaMs = 0) {
  for (let i = 0; i < bytes.length; i += tamano) {
    await escribir(bytes.slice(i, i + tamano));
    if (pausaMs) await new Promise((r) => setTimeout(r, pausaMs));
  }
}

export const aBase64 = (bytes) => { let s = ""; bytes.forEach((x) => { s += String.fromCharCode(x); }); return typeof btoa === "function" ? btoa(s) : Buffer.from(s, "binary").toString("base64"); };

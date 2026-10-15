/*
 * Tema (claro / oscuro) e identidad de marca (color, tipografía, logo).
 *
 * Todos los colores de la app son variables CSS (--c-…): cada una tiene su
 * valor para modo claro y para modo oscuro. El modo se guarda en ESTE
 * dispositivo (cada pantalla puede tener el suyo: la cocina en oscuro, la
 * caja en claro). La marca (color, tipografía y logo) se guarda en la base
 * de datos y es la misma para todos los dispositivos.
 */

// variable → [modo claro, modo oscuro]
const PALETA = {
  "--c-242019-b": ["#242019", "#2f291f"],
  "--c-242019-o": ["#242019", "#6b6150"],
  "--c-242019-t": ["#242019", "#f3eee3"],
  "--c-2f6690-t": ["#2f6690", "#72a8d3"],
  "--c-3b372e-t": ["#3b372e", "#e4ddcb"],
  "--c-5b7553-t": ["#5b7553", "#8fb487"],
  "--c-5c5648-t": ["#5c5648", "#cfc7b4"],
  "--c-8a3a2b-t": ["#8a3a2b", "#eba595"],
  "--c-8a611a-t": ["#8a611a", "#d9ae63"],
  "--c-8a8272-t": ["#8a8272", "#a59d8a"],
  "--c-9a9382-t": ["#9a9382", "#8c8472"],
  "--c-b98a2e-t": ["#b98a2e", "#d9ae4f"],
  "--c-c1442d-t": ["#c1442d", "#e5735b"],
  "--c-c7bfa0-o": ["#c7bfa0", "#4a4236"],
  "--c-d9cfae-o": ["#d9cfae", "#4a4236"],
  "--c-e4dfce-b": ["#e4dfce", "#373026"],
  "--c-e4dfce-o": ["#e4dfce", "#373026"],
  "--c-e4eee1-b": ["#e4eee1", "#1f2d1d"],
  "--c-e8bbaf-o": ["#e8bbaf", "#5a3028"],
  "--c-ede7d8-b": ["#ede7d8", "#28231b"],
  "--c-ede7d8-o": ["#ede7d8", "#2b261e"],
  "--c-f1ecdd-b": ["#f1ecdd", "#211d16"],
  "--c-f1ecdd-o": ["#f1ecdd", "#211d16"],
  "--c-f2eee2-b": ["#f2eee2", "#211d16"],
  "--c-f7f4ec-b": ["#f7f4ec", "#14110d"],
  "--c-fbe2dc-b": ["#fbe2dc", "#3d211b"],
  "--c-fbefd9-b": ["#fbefd9", "#3a2f1a"],
  "--c-fbf8f0-b": ["#fbf8f0", "#211d16"],
  "--c-fffdf8-b": ["#fffdf8", "#1d1913"]
};

export const ACENTOS = {
  terracota: { nombre: "Terracota", c: "#C1442D", t: "#E5735B" },
  bosque: { nombre: "Verde bosque", c: "#2F6B4F", t: "#6FBF93" },
  marino: { nombre: "Azul marino", c: "#2F5D8C", t: "#7DB0E0" },
  vino: { nombre: "Vino", c: "#8E2A45", t: "#E0809B" },
  dorado: { nombre: "Dorado", c: "#9A6B2F", t: "#DDB06A" },
  grafito: { nombre: "Grafito", c: "#3F4650", t: "#AEB8C4" },
  violeta: { nombre: "Violeta", c: "#6B4FA3", t: "#B8A2E6" },
};

export const FUENTES = {
  clasica: { nombre: "Clásica", muestra: "Oswald + Inter", display: "'Oswald', 'Arial Narrow', sans-serif", body: "'Inter', system-ui, sans-serif", google: "family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600" },
  moderna: { nombre: "Moderna", muestra: "Space Grotesk + Inter", display: "'Space Grotesk', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif", google: "family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600" },
  elegante: { nombre: "Elegante", muestra: "Playfair Display + Lato", display: "'Playfair Display', Georgia, serif", body: "'Lato', system-ui, sans-serif", google: "family=Playfair+Display:wght@600;700&family=Lato:wght@400;700" },
  amable: { nombre: "Amable", muestra: "Fredoka + Nunito", display: "'Fredoka', system-ui, sans-serif", body: "'Nunito', system-ui, sans-serif", google: "family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700" },
};

export const MARCA_POR_DEFECTO = { color: "terracota", fuente: "clasica", logo: null };

/* ---------- CSS de la paleta (se inyecta una sola vez) ---------- */
function cssPaleta() {
  const claro = Object.entries(PALETA).map(([k, v]) => `${k}:${v[0]};`).join("");
  const oscuro = Object.entries(PALETA).map(([k, v]) => `${k}:${v[1]};`).join("");
  return `:root{${claro}--accent:#C1442D;--accent-t:#C1442D;--font-display:${FUENTES.clasica.display};--font-body:${FUENTES.clasica.body};}`
    + `:root[data-theme="dark"]{color-scheme:dark;${oscuro}}`
    // al imprimir (resumen del día, etc.) siempre en claro, aunque la pantalla esté en oscuro
    + `@media print{:root[data-theme="dark"]{color-scheme:light;${claro}}}`;
}
if (typeof document !== "undefined" && !document.getElementById("tema-css")) {
  const st = document.createElement("style");
  st.id = "tema-css";
  st.textContent = cssPaleta();
  document.head.appendChild(st);
}

/* ---------- Modo claro / oscuro (por dispositivo) ---------- */
const CLAVE_TEMA = "comandas_tema";
export function temaGuardado() {
  try { const v = localStorage.getItem(CLAVE_TEMA); return v === "claro" || v === "oscuro" ? v : "auto"; } catch (e) { return "auto"; }
}
function prefiereOscuro() {
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
export function aplicarTema(modo) {
  if (typeof document === "undefined") return;
  const oscuro = modo === "oscuro" || (modo === "auto" && prefiereOscuro());
  document.documentElement.dataset.theme = oscuro ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", oscuro ? "#2f291f" : "#242019");
}
export function guardarTema(modo) {
  try { localStorage.setItem(CLAVE_TEMA, modo); } catch (e) {}
  aplicarTema(modo);
}
// Se aplica apenas carga el archivo, para que no haya un destello blanco al abrir en oscuro.
aplicarTema(temaGuardado());
if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const alCambiar = () => { if (temaGuardado() === "auto") aplicarTema("auto"); };
  if (mq.addEventListener) mq.addEventListener("change", alCambiar);
}

/* ---------- Marca: color de acento, tipografía y logo ---------- */
export function aplicarMarca(marca) {
  if (typeof document === "undefined") return;
  const m = { ...MARCA_POR_DEFECTO, ...(marca || {}) };
  const ac = ACENTOS[m.color] || ACENTOS.terracota;
  const fu = FUENTES[m.fuente] || FUENTES.clasica;
  const root = document.documentElement;
  root.style.setProperty("--accent", ac.c);
  root.style.setProperty("--font-display", fu.display);
  root.style.setProperty("--font-body", fu.body);
  // en oscuro el acento usado como TEXTO se aclara para que se lea bien
  let st = document.getElementById("marca-css");
  if (!st) { st = document.createElement("style"); st.id = "marca-css"; document.head.appendChild(st); }
  st.textContent = `:root{--accent-t:${ac.c};}:root[data-theme="dark"]{--accent-t:${ac.t};}@media print{:root[data-theme="dark"]{--accent-t:${ac.c};}}`;
  // tipografías (Google Fonts) — IBM Plex Mono se usa siempre para etiquetas y horas
  const href = `https://fonts.googleapis.com/css2?${fu.google}&family=IBM+Plex+Mono:wght@400;500;600&display=swap`;
  let link = document.getElementById("fuente-marca");
  if (!link) { link = document.createElement("link"); link.id = "fuente-marca"; link.rel = "stylesheet"; document.head.appendChild(link); }
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
}
aplicarMarca(MARCA_POR_DEFECTO);

/** Reduce una imagen subida (logo) conservando su proporción, para guardarla en base64 en la config. */
export function reducirLogo(file, ladoMax = 480) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("La imagen no es válida"));
      img.onload = () => {
        const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala)), h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Vibración suave al tocar (solo en celulares que la soportan) ---------- */
export function vibrar(ms = 12) {
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}

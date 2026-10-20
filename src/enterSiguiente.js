/*
 * Teclado más cómodo en todos los formularios:
 *  - Enter en un campo salta al siguiente campo (y en el último cierra el teclado).
 *  - El botón de Enter del teclado del celular dice "Siguiente" o "Listo" según corresponda.
 * No aplica a cuadros de varias líneas (ahí Enter sigue haciendo un salto de línea) ni a campos con data-enter="no".
 */
const TIPOS_TEXTO = ["text", "number", "tel", "email", "search", "password", "url", ""];

function campos(scope) {
  return [...scope.querySelectorAll("input, select")].filter(
    (el) => !el.disabled && !el.readOnly && el.offsetParent !== null && (el.tagName === "SELECT" || TIPOS_TEXTO.includes(el.getAttribute("type") || ""))
  );
}
function alcance(el) {
  let p = el.parentElement;
  for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
    if (campos(p).length > 1) return p;
    if (p.classList && (p.classList.contains("hoja-overlay") || p.classList.contains("hoja-v2-scroll"))) return p;
  }
  return null;
}

export function instalarEnterSiguiente() {
  if (typeof document === "undefined") return () => {};
  const onKey = (e) => {
    if (e.key !== "Enter" || e.defaultPrevented || e.isComposing) return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.dataset.enter === "no") return;
    if (!TIPOS_TEXTO.includes(el.getAttribute("type") || "")) return;
    const sc = alcance(el);
    const lista = sc ? campos(sc) : [el];
    const sig = lista[lista.indexOf(el) + 1];
    e.preventDefault();
    if (sig && el.dataset.enter !== "blur") { sig.focus(); try { sig.select && sig.select(); } catch (err) {} }
    else el.blur(); // último campo (o campo de búsqueda): se cierra el teclado
  };
  const onFocus = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !TIPOS_TEXTO.includes(el.getAttribute("type") || "")) return;
    const sc = alcance(el);
    const lista = sc ? campos(sc) : [el];
    el.setAttribute("enterkeyhint", el.dataset.enter !== "blur" && lista.indexOf(el) < lista.length - 1 ? "next" : "done");
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("focusin", onFocus);
  return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("focusin", onFocus); };
}

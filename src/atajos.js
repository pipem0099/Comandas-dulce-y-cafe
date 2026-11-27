import { useEffect } from "react";

/* Atajos de teclado simples para escritorio. La lista se muestra en el menú de perfil → «Atajos de teclado». */
export const ATAJOS = [
  { teclas: ["/"], o: ["Ctrl", "K"], texto: "Ir al buscador de la pantalla" },
  { teclas: ["?"], texto: "Mostrar esta lista de atajos" },
  { teclas: ["Alt", "Shift", "1…9"], texto: "Ir a la pantalla 1, 2, 3… del menú lateral" },
  { teclas: ["N"], texto: "Crear lo nuevo de la pantalla (pedido para llevar, artículo, producto, reserva)" },
  { teclas: ["Enter"], texto: "Confirmar la ventana abierta (o enviar el pedido), si no estás escribiendo" },
  { teclas: ["←", "↑", "→", "↓"], texto: "Moverte entre las mesas (Enter abre la mesa elegida)" },
  { teclas: ["Ctrl", "P"], texto: "Imprimir la cuenta o el reporte que tienes a la vista" },
  { teclas: ["Esc"], texto: "Cerrar la ventana abierta o cancelar" },
  { teclas: ["Alt", "1"], texto: "Caja: Resumen" },
  { teclas: ["Alt", "2"], texto: "Caja: Cobrar mesas" },
  { teclas: ["Alt", "3"], texto: "Caja: Pendientes" },
  { teclas: ["Alt", "4"], texto: "Caja: Historial" },
  { teclas: ["Alt", "5"], texto: "Caja: Inventario" },
];

const esCampo = (el) => !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

// Busca el primer campo de búsqueda visible (los de la app dicen «Buscar…») y lo enfoca.
export function enfocarBuscador() {
  const campos = Array.from(document.querySelectorAll('input[type="search"], input[placeholder^="Buscar"], input[data-buscador]'));
  const visible = campos.find((el) => el.offsetParent !== null && !el.disabled);
  if (visible) { visible.focus(); visible.select && visible.select(); return true; }
  return false;
}

export function useAtajoBuscador() {
  useEffect(() => {
    const onKey = (e) => {
      const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      const barra = e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !esCampo(e.target);
      if (!ctrlK && !barra) return;
      if (enfocarBuscador()) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/* Atajos globales: «?» abre la lista y Alt+Shift+número salta a esa sección del menú lateral.
   `ref.current` = { items, ir, mostrarAtajos } (se actualiza en cada render). */
export function useAtajosGlobales(ref) {
  useEffect(() => {
    const onKey = (e) => {
      const r = ref.current;
      if (!r) return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey && !esCampo(e.target)) { e.preventDefault(); r.mostrarAtajos(); return; }
      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code)) {
        const it = (r.items || [])[Number(e.code.slice(5)) - 1];
        if (it) { e.preventDefault(); r.ir(it.id); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref]);
}

/* ───────── Atajos de la pantalla activa ─────────
   No dependen de cada pantalla: buscan en la página botones marcados con data-atajo="nuevo" | "confirmar" | "imprimir"
   y fichas de mesa marcadas con data-mesa-tile. Solo consultan el DOM en el momento de pulsar (sin estado → sin datos viejos). */
const visible = (el) => !!el && el.getClientRects().length > 0 && !el.disabled && el.getAttribute("aria-disabled") !== "true";
const hojaSuperior = () => { const hs = document.querySelectorAll(".hoja-v2-panel"); return hs.length ? hs[hs.length - 1] : null; };
const buscarAtajo = (tipo, raiz) => Array.from((raiz || document).querySelectorAll(`[data-atajo="${tipo}"]`)).find(visible) || null;
const sinModificadores = (e) => !e.ctrlKey && !e.metaKey && !e.altKey;
const esControl = (el) => !!el && (["BUTTON", "A", "SUMMARY"].includes(el.tagName) || ["button", "checkbox", "tab", "menuitem", "radio", "switch", "link"].includes(el.getAttribute && el.getAttribute("role")));

function moverEntreMesas(tecla, actual) {
  const fichas = Array.from(document.querySelectorAll("[data-mesa-tile]")).filter(visible);
  if (!fichas.length) return false;
  const i = fichas.indexOf(actual);
  if (i < 0) { fichas[0].focus(); fichas[0].scrollIntoView({ block: "nearest" }); return true; }
  const r = actual.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let mejor = null, puntaje = Infinity;
  fichas.forEach((f) => {
    if (f === actual) return;
    const q = f.getBoundingClientRect(); const dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
    const principal = tecla === "ArrowRight" ? dx : tecla === "ArrowLeft" ? -dx : tecla === "ArrowDown" ? dy : -dy;
    const cruzado = tecla === "ArrowRight" || tecla === "ArrowLeft" ? Math.abs(dy) : Math.abs(dx);
    if (principal <= 4) return;
    const p = principal + cruzado * 2;
    if (p < puntaje) { puntaje = p; mejor = f; }
  });
  if (mejor) { mejor.focus(); mejor.scrollIntoView({ block: "nearest" }); }
  return true; // si no hay vecino en esa dirección, la tecla igual se queda aquí (no desplaza la página)
}

export function useAtajosVista() {
  useEffect(() => {
    let ultimoEnter = 0;
    const onKey = (e) => {
      if (e.defaultPrevented || e.isComposing) return;
      const campo = esCampo(e.target);
      const hoja = hojaSuperior();
      // Ctrl/Cmd + P → imprimir lo que está a la vista (si no hay nada marcado, queda el diálogo normal del navegador)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "p") {
        const b = buscarAtajo("imprimir", hoja) || (hoja ? null : buscarAtajo("imprimir"));
        if (b) { e.preventDefault(); b.click(); }
        return;
      }
      if (!sinModificadores(e) || e.shiftKey || campo) return;
      // N → crear lo nuevo de la pantalla
      if (e.key === "n" || e.key === "N") {
        if (hoja) return;
        const b = buscarAtajo("nuevo");
        if (b) { e.preventDefault(); b.click(); }
        return;
      }
      // Enter → confirmar la ventana abierta (o el pedido), sin pisar botones con foco ni campos de texto
      if (e.key === "Enter") {
        if (e.repeat || esControl(e.target)) return;
        const b = buscarAtajo("confirmar", hoja) || (hoja ? null : buscarAtajo("confirmar"));
        const t = Date.now();
        if (b && t - ultimoEnter > 600) { ultimoEnter = t; e.preventDefault(); b.click(); }
        return;
      }
      // Flechas → moverse entre mesas (no si hay ventana o menú abierto)
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (hoja || document.querySelector('[role="menu"], [role="listbox"], [role="dialog"]')) return;
        if (moverEntreMesas(e.key, e.target && e.target.hasAttribute && e.target.hasAttribute("data-mesa-tile") ? e.target : null)) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

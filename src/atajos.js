import { useEffect } from "react";

/* Atajos de teclado simples para escritorio. La lista se muestra en el menú de perfil → «Atajos de teclado». */
export const ATAJOS = [
  { teclas: ["/"], o: ["Ctrl", "K"], texto: "Ir al buscador de la pantalla" },
  { teclas: ["Esc"], texto: "Cerrar la ventana abierta o cancelar" },
  { teclas: ["Alt", "1"], texto: "Caja: Resumen" },
  { teclas: ["Alt", "2"], texto: "Caja: Cobrar mesas" },
  { teclas: ["Alt", "3"], texto: "Caja: Pendientes" },
  { teclas: ["Alt", "4"], texto: "Caja: Historial" },
  { teclas: ["Alt", "5"], texto: "Caja: Reportes" },
  { teclas: ["Alt", "6"], texto: "Caja: Inventario" },
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

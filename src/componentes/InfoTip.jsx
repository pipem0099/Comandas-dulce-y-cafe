import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/*
 * Icono sutil de información (i). Reemplaza los párrafos explicativos fijos de las pantallas operativas:
 * al tocarlo se abre una hoja limpia (tarjeta flotante en celular, ventana centrada en escritorio) con el texto.
 *   <InfoTip titulo="Cómo funciona">Texto o contenido…</InfoTip>
 * Con `render` se puede mostrar una lista o bitácora en vez de texto: render={({ cerrar }) => <…/>}
 */
export function InfoTip({ titulo, children, render, size = 16, label, style }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" className="toque44" aria-label={label || `Más información: ${titulo || ""}`.trim()} aria-haspopup="dialog" onClick={(e) => { e.stopPropagation(); setAbierto(true); }}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, padding: 0, borderRadius: 14, border: "none", background: "transparent", color: "var(--btn2-mute)", cursor: "pointer", flexShrink: 0, ...style }}>
        <Info size={size} strokeWidth={1.8} />
      </button>
      {abierto && createPortal(<PanelInfo titulo={titulo} render={render} onCerrar={() => setAbierto(false)}>{children}</PanelInfo>, document.body)}
    </>
  );
}

/* Panel de información autónomo: no depende de la pila de hojas ni del historial del navegador, así que SIEMPRE abre
   (antes se quedaba debajo de otras hojas o no respondía). Entra y sale con la misma curva suave de iOS. */
function PanelInfo({ titulo, render, onCerrar, children }) {
  const [fase, setFase] = useState("entrando");
  const cerrar = () => { setFase("saliendo"); setTimeout(onCerrar, 220); };
  useEffect(() => {
    const id = requestAnimationFrame(() => setFase("abierta"));
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); setFase("saliendo"); setTimeout(onCerrar, 220); } };
    document.addEventListener("keydown", k);
    return () => { cancelAnimationFrame(id); document.removeEventListener("keydown", k); };
  }, [onCerrar]);
  const on = fase === "abierta";
  return (
    <div role="presentation" style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 10px calc(10px + env(safe-area-inset-bottom))" }}>
      <div onClick={cerrar} style={{ position: "absolute", inset: 0, background: "var(--scrim)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", opacity: on ? 1 : 0, transition: "opacity .3s cubic-bezier(.32,.72,0,1)" }} />
      <div role="dialog" aria-modal="true" aria-label={titulo || "Información"}
        style={{ position: "relative", width: "100%", maxWidth: 440, maxHeight: "80dvh", overflowY: "auto", overscrollBehavior: "contain", boxSizing: "border-box", padding: "20px 18px 18px", display: "flex", flexDirection: "column", gap: 10, background: "var(--sheet)", color: "var(--c-242019-t)", fontFamily: "var(--font-body)", borderRadius: 26, boxShadow: "var(--shadow-float)", transform: on ? "none" : "translateY(40px) scale(.97)", opacity: on ? 1 : 0, transition: "transform .4s cubic-bezier(.32,.72,0,1), opacity .25s ease" }}>
        {titulo && <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700 }}>{titulo}</div>}
        {render ? render({ cerrar }) : <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--c-5c5648-t)" }}>{children}</div>}
        <button type="button" onClick={cerrar} style={{ minHeight: 44, borderRadius: 12, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>Entendido</button>
      </div>
    </div>
  );
}

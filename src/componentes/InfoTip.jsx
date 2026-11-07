import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { Hoja } from "./Hoja.jsx";

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
      {abierto && createPortal(
        <Hoja onCerrar={() => setAbierto(false)} ancho={440} gap={10} label={titulo || "Información"} z={80}>
          {({ cerrar }) => (
            <>
              {titulo && <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--c-242019-t)" }}>{titulo}</div>}
              {render ? render({ cerrar }) : <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--c-5c5648-t)" }}>{children}</div>}
              <button type="button" onClick={cerrar} style={{ minHeight: 44, borderRadius: 12, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>Entendido</button>
            </>
          )}
        </Hoja>,
        document.body
      )}
    </>
  );
}

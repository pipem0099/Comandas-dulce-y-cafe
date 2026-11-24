import { X } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { ATAJOS } from "../atajos.js";

const tecla = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 26, height: 26, padding: "0 8px", borderRadius: 7, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, fontWeight: 700 };

export function HojaAtajos({ onCerrar }) {
  const combo = (ts) => ts.map((t, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{i > 0 && <span style={{ color: "var(--c-5c5648-t)" }}>+</span>}<kbd style={tecla}>{t}</kbd></span>);
  return (
    <Hoja onCerrar={onCerrar} ancho={460} gap={12} label="Atajos de teclado" z={310} centro>
      {({ cerrar }) => (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" }}>Atajos de teclado</div>
              <div style={{ fontSize: 13, color: "var(--c-5c5648-t)", marginTop: 3 }}>Para moverte más rápido desde un computador.</div>
            </div>
            <button className="toque44" onClick={cerrar} aria-label="Cerrar" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", cursor: "pointer", flexShrink: 0 }}><X size={16} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {ATAJOS.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 2px", borderTop: i ? "1px solid var(--c-ede7d8-o)" : "none", fontSize: 14, color: "var(--c-242019-t)" }}>
                <span>{a.texto}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {combo(a.teclas)}{a.o && <><span style={{ color: "var(--c-5c5648-t)", fontSize: 12 }}>o</span>{combo(a.o)}</>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Hoja>
  );
}

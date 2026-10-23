import React, { useState } from "react";
import { Bug, Copy, Check, Trash2, ChevronDown } from "lucide-react";
import { styles } from "../estilos.js";
import { dateTimeLabel } from "../utilidades.js";
import { Chevron } from "./Comunes.jsx";

/** Lista de errores que la app registró sola (últimos 7 días). Solo administradores. */
export function PanelErrores({ errores = [], onLimpiar }) {
  const [abierto, setAbierto] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const lista = errores.slice().sort((a, b) => b.ts - a.ts).slice(0, 40);
  const texto = () => lista.map((e) => `[${dateTimeLabel(e.ts)}] v${e.version || "?"} · ${e.vista || ""} · ${e.rol || ""}\n${e.mensaje}\n${e.pila || ""}\n${e.agente || ""}`).join("\n\n----\n\n");
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto()); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch (e) { window.prompt("Copia el detalle:", texto()); }
  };
  return (
    <div style={{ background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700 }}><Bug size={16} /> Errores de la app</div>
      <div style={styles.closeConfirmText}>
        Cuando algo falla en la pantalla de alguien, la app lo anota aquí sola (últimos 7 días). Si ves varios, pásale este detalle a quien mantiene la app: con eso se arregla sin tener que adivinar qué pasó.
      </div>
      {lista.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "var(--c-5b7553-t)", fontWeight: 600, padding: "4px 0" }}>✓ Sin errores registrados. Todo bien.</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lista.map((e) => (
              <div key={e.id || e.ts} style={{ background: "var(--c-f1ecdd-b)", borderRadius: 12, overflow: "hidden" }}>
                <button style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", color: "var(--c-242019-t)" }} onClick={() => setAbierto(abierto === (e.id || e.ts) ? null : (e.id || e.ts))}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.mensaje}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--c-8a8272-t)" }}>{dateTimeLabel(e.ts)} · {e.vista} · v{e.version}</span>
                  </span>
                  <Chevron abierto={abierto === (e.id || e.ts)} size={15} />
                </button>
                {abierto === (e.id || e.ts) && (
                  <pre style={{ margin: 0, padding: "0 12px 12px", fontSize: 11, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--c-5c5648-t)", fontFamily: "'IBM Plex Mono', monospace" }}>{e.pila || "(sin detalle técnico)"}{"\n"}{e.agente}</pre>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...styles.cancelEditBtn, flex: 1 }} onClick={copiar}>{copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar detalle</>}</button>
            {!confirmando
              ? <button style={{ ...styles.cancelEditBtn, flex: 1 }} onClick={() => setConfirmando(true)}><Trash2 size={15} /> Borrar registro</button>
              : <button style={{ ...styles.cancelEditBtn, flex: 1, background: "var(--danger-solid)", color: "#fff" }} onClick={async () => { await onLimpiar(); setConfirmando(false); }}>Sí, borrar todo</button>}
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { X, Printer } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { imprimir, Hoja as HojaImp, Seccion } from "../impresion.jsx";
import { GUIAS, guiasPara } from "../ayuda.js";

// **negrita** sencilla dentro de cada paso
const conNegritas = (t) => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>));

export function AyudaRoles({ usuario, config, onCerrar }) {
  const lista = guiasPara(usuario);
  const [id, setId] = useState(lista[0].id);
  const guia = lista.find((g) => g.id === id) || lista[0];
  const imprimirGuias = () => imprimir(
    <HojaImp config={config} usuario={usuario} titulo="Cómo se usa la app" subtitulo="Guía corta por rol">
      {GUIAS.map((g, i) => (
        <Seccion key={g.id} titulo={g.titulo} nota={g.resumen} salto={i > 0}>
          <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 7, fontSize: "11pt", lineHeight: 1.45 }}>
            {g.pasos.map((p, k) => <li key={k}>{conNegritas(p)}</li>)}
          </ol>
        </Seccion>
      ))}
    </HojaImp>
  );
  return (
    <Hoja onCerrar={onCerrar} ancho={500} gap={10} label="Cómo se usa la app" z={86} centro>
      {({ cerrar }) => (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" }}>Cómo se usa la app</div>
            <button onClick={cerrar} aria-label="Cerrar" style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-5c5648-t)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><X size={16} /></button>
          </div>
          {lista.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {lista.map((g) => (
                <button key={g.id} onClick={() => setId(g.id)} style={{ minHeight: 36, padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: g.id === id ? "var(--seg-on-bg)" : "var(--c-ede7d8-b)", color: g.id === id ? "var(--seg-on-fg)" : "var(--c-242019-t)" }}>{g.titulo}</button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 13, color: "var(--c-5c5648-t)" }}>{guia.resumen}</div>
          <ol style={{ margin: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: 10, fontSize: 14, lineHeight: 1.5, color: "var(--c-242019-t)", maxHeight: "50dvh", overflowY: "auto" }}>
            {guia.pasos.map((p, i) => <li key={i}>{conNegritas(p)}</li>)}
          </ol>
          <button onClick={imprimirGuias} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, borderRadius: 12, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            <Printer size={16} /> Imprimir o guardar todas las guías (PDF)
          </button>
        </>
      )}
    </Hoja>
  );
}

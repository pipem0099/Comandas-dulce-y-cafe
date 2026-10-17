import React from "react";
import { leerMarcaCache } from "../marcaCache.js";

// Pantalla de carga con la marca del negocio (si este dispositivo ya la conoce).
export function PantallaCarga() {
  const cache = leerMarcaCache();
  const nombre = (cache && cache.nombre) || "Comandas";
  const logo = cache && cache.marca && cache.marca.logo;
  return (
    <div style={p.pagina}>
      <div style={p.centro}>
        {logo
          ? <img src={logo} alt="" style={p.logo} />
          : <div style={p.monograma}>{nombre.trim().charAt(0).toUpperCase()}</div>}
        <div style={p.nombre}>{nombre.toUpperCase()}</div>
        <div style={p.barra}><div style={p.barraInterna} /></div>
      </div>
    </div>
  );
}

const p = {
  pagina: { height: "100dvh", minHeight: "100vh", background: "#1E2227", display: "flex", alignItems: "center", justifyContent: "center" },
  centro: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, animation: "respirar 2.4s ease-in-out infinite" },
  logo: { height: 56, width: "auto", maxWidth: 220, objectFit: "contain" },
  monograma: { width: 64, height: 64, borderRadius: 16, border: "1.5px solid var(--accent)", color: "var(--accent-t)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700 },
  nombre: { fontFamily: "var(--font-display)", color: "#F4F6F8", letterSpacing: 5, fontSize: 15, fontWeight: 600 },
  barra: { width: 90, height: 2, background: "#23282E", borderRadius: 1, overflow: "hidden" },
  barraInterna: { width: "100%", height: "100%", background: "var(--accent)", animation: "barra 1.4s ease-in-out infinite" },
};

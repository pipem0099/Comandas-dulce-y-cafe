import React, { useState } from "react";
import { ChefHat, ClipboardList, Receipt, CalendarClock } from "lucide-react";
import { MenuUsuario } from "./MenuUsuario.jsx";
import { LogoMarca } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { tieneRol } from "../utilidades.js";

/*
 * Navegación de la app, adaptada a cada pantalla:
 *   - Celular:        barra de arriba mínima (logo + tu cuenta) y barra de pestañas ABAJO (alcanza con el pulgar).
 *   - Tablet/escritorio: menú lateral fijo a la izquierda; el contenido ocupa el resto.
 * Los roles de la persona ya no ocupan la barra: se ven dentro de "Mi cuenta".
 */
export function itemsNavegacion(usuarioActual) {
  const admin = tieneRol(usuarioActual, "admin");
  return [
    { id: "mesero", label: "Mesero", icon: ClipboardList, ok: admin || tieneRol(usuarioActual, "mesero") },
    { id: "cocina", label: "Cocina", icon: ChefHat, ok: true },
    { id: "reservas", label: "Reservas", icon: CalendarClock, ok: admin || tieneRol(usuarioActual, "mesero") || tieneRol(usuarioActual, "cajero") },
    { id: "caja", label: "Caja", icon: Receipt, ok: admin || tieneRol(usuarioActual, "cajero") },
  ].filter((i) => i.ok);
}

const Avatar = ({ usuarioActual, size = 30 }) => (
  <span style={{ width: size, height: size, borderRadius: size / 2, background: "var(--accent)", color: "#F4F6F8", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.46, fontWeight: 700, flexShrink: 0 }}>
    {(usuarioActual.nombre || "?").trim().charAt(0).toUpperCase()}
  </span>
);

/* Celular: barra de arriba mínima */
export function TopBar({ config, usuarioActual, onIr, onSalir, online }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  return (
    <div className="no-imprimir" style={{ ...styles.topBar, flexWrap: "nowrap", padding: "10px 16px" }}>
      <div style={styles.brand}>
        <LogoMarca marca={config.marca} />
        <span style={styles.brandText}>{(config.businessName || "LA COMANDA").toUpperCase()}</span>
        <span style={{ ...styles.syncDot, background: online ? "var(--c-5b7553-t)" : "var(--c-c1442d-t)" }} title={online ? "En línea" : "Sin conexión"} />
      </div>
      {usuarioActual && (
        <button style={{ background: "transparent", border: "none", padding: 2, cursor: "pointer" }} onClick={() => setMenuAbierto(true)} aria-label="Mi cuenta" aria-haspopup="dialog">
          <Avatar usuarioActual={usuarioActual} size={34} />
        </button>
      )}
      {menuAbierto && usuarioActual && <MenuUsuario usuarioActual={usuarioActual} config={config} onCerrar={() => setMenuAbierto(false)} onIr={onIr} onSalir={onSalir} />}
    </div>
  );
}

/* Celular: pestañas abajo */
export function BarraInferior({ items, role, setRole }) {
  if (items.length < 2) return null;
  return (
    <div className="no-imprimir" style={{ flexShrink: 0, padding: "6px 14px calc(10px + env(safe-area-inset-bottom))", background: "var(--chrome-solid)" }}>
      <nav style={{ display: "flex", gap: 4, padding: 6, borderRadius: 26, background: "var(--nav-float)", WebkitBackdropFilter: "blur(18px) saturate(140%)", backdropFilter: "blur(18px) saturate(140%)", boxShadow: "var(--shadow-nav)", maxWidth: 520, margin: "0 auto" }}>
        {items.map((it) => {
          const Icon = it.icon; const on = role === it.id;
          return (
            <button key={it.id} onClick={() => setRole(it.id)} aria-current={on ? "page" : undefined}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px", border: "none", borderRadius: 20, background: on ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent", color: on ? "var(--accent-t)" : "var(--c-8a8272-t)", fontSize: 11.5, fontWeight: on ? 700 : 600, cursor: "pointer", transition: "background-color .25s cubic-bezier(.32,.72,0,1), color .25s ease, transform .22s cubic-bezier(.32,.72,0,1)" }}>
              <Icon size={21} strokeWidth={on ? 2.3 : 1.9} /> {it.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* Tablet y escritorio: menú lateral */
export function Lateral({ items, role, setRole, config, usuarioActual, onIr, onSalir, online, ancho }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const compacto = !ancho; // tablet: solo íconos
  return (
    <aside className="no-imprimir" style={{ width: compacto ? 84 : 232, flexShrink: 0, background: "var(--chrome-solid)", display: "flex", flexDirection: "column", gap: 6, padding: compacto ? "16px 10px" : "18px 14px", borderRight: "1px solid var(--chrome-line)", overflowY: "auto" }}>
      <div style={{ ...styles.brand, justifyContent: compacto ? "center" : "flex-start", padding: compacto ? "0 0 14px" : "2px 6px 16px", flexDirection: compacto ? "column" : "row" }}>
        <LogoMarca marca={config.marca} />
        {!compacto && <span style={{ ...styles.brandText, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{(config.businessName || "LA COMANDA").toUpperCase()}</span>}
        <span style={{ ...styles.syncDot, background: online ? "var(--c-5b7553-t)" : "var(--c-c1442d-t)" }} title={online ? "En línea" : "Sin conexión"} />
      </div>

      {items.map((it) => {
        const Icon = it.icon; const on = role === it.id;
        return (
          <button key={it.id} onClick={() => setRole(it.id)} aria-current={on ? "page" : undefined}
            style={{ display: "flex", flexDirection: compacto ? "column" : "row", alignItems: "center", justifyContent: compacto ? "center" : "flex-start", gap: compacto ? 4 : 12, padding: compacto ? "11px 4px" : "12px 14px", border: "none", borderRadius: 12, background: on ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent", color: on ? "var(--accent-t)" : "var(--c-5c5648-t)", boxShadow: on ? "inset 3px 0 0 var(--accent)" : "none", fontSize: compacto ? 11.5 : 14.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
            <Icon size={compacto ? 22 : 19} strokeWidth={on ? 2.3 : 1.9} /> {it.label}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />
      {usuarioActual && (
        <button onClick={() => setMenuAbierto(true)} aria-label="Mi cuenta" aria-haspopup="dialog"
          style={{ display: "flex", alignItems: "center", justifyContent: compacto ? "center" : "flex-start", gap: 10, padding: compacto ? "8px 0" : "10px 10px", border: "none", borderRadius: 12, background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)", cursor: "pointer", textAlign: "left" }}>
          <Avatar usuarioActual={usuarioActual} size={compacto ? 34 : 32} />
          {!compacto && <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usuarioActual.nombre}</span>
            <span style={{ fontSize: 11, color: "var(--c-8a8272-t)" }}>Mi cuenta</span>
          </span>}
        </button>
      )}
      {menuAbierto && usuarioActual && <MenuUsuario usuarioActual={usuarioActual} config={config} onCerrar={() => setMenuAbierto(false)} onIr={onIr} onSalir={onSalir} />}
    </aside>
  );
}

import React, { useState } from "react";
import { ChefHat, ClipboardList, Receipt, ChevronDown } from "lucide-react";
import { MenuUsuario } from "./MenuUsuario.jsx";
import { LogoMarca } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { rolesLabel } from "../utilidades.js";

export function TopBar({ role, setRole, config, usuarioActual, onIr, onSalir, online }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  return (
    <div className="no-imprimir" style={styles.topBar}>
      <div style={styles.brand}>
        <LogoMarca marca={config.marca} />
        <span style={styles.brandText}>{(config.businessName || "LA COMANDA").toUpperCase()}</span>
        <span style={{ ...styles.syncDot, background: online ? "#1F8A62" : "#D64545" }} title={online ? "En línea" : "Sin conexión"} />
      </div>
      {usuarioActual && (
        <button style={styles.meseroChip} onClick={() => setMenuAbierto(true)} aria-label="Mi cuenta" aria-haspopup="dialog">
          <span style={{ width: 20, height: 20, borderRadius: 10, background: "var(--accent)", color: "#F4F6F8", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {(usuarioActual.nombre || "?").trim().charAt(0).toUpperCase()}
          </span>
          {usuarioActual.nombre} · {rolesLabel(usuarioActual)} <ChevronDown size={13} />
        </button>
      )}
      <div style={styles.roleSwitch}>
        <button onClick={() => setRole("mesero")} style={{ ...styles.roleBtn, ...(role === "mesero" ? styles.roleBtnActive : {}) }}>
          <ClipboardList size={15} strokeWidth={2.2} /> Mesero
        </button>
        <button onClick={() => setRole("cocina")} style={{ ...styles.roleBtn, ...(role === "cocina" ? styles.roleBtnActiveDark : {}) }}>
          <ChefHat size={15} strokeWidth={2.2} /> Cocina
        </button>
        <button onClick={() => setRole("caja")} style={{ ...styles.roleBtn, ...(role === "caja" ? styles.roleBtnActive : {}) }}>
          <Receipt size={15} strokeWidth={2.2} /> Caja
        </button>
      </div>
      {menuAbierto && usuarioActual && (
        <MenuUsuario usuarioActual={usuarioActual} config={config} onCerrar={() => setMenuAbierto(false)} onIr={onIr} onSalir={onSalir} />
      )}
    </div>
  );
}

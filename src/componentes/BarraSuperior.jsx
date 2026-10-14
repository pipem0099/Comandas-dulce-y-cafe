import React, { useState } from "react";
import {
  ChefHat, ClipboardList, Receipt, UserCircle2, Sun, Moon, MonitorSmartphone,
} from "lucide-react";
import { guardarTema, temaGuardado, vibrar } from "../theme.js";
import { LogoMarca } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { rolesLabel } from "../utilidades.js";

export const TEMA_META = {
  auto: { icon: MonitorSmartphone, label: "Automático (sigue al teléfono)", next: "claro" },
  claro: { icon: Sun, label: "Modo claro", next: "oscuro" },
  oscuro: { icon: Moon, label: "Modo oscuro", next: "auto" },
};
export function BotonTema() {
  const [modo, setModo] = useState(temaGuardado());
  const meta = TEMA_META[modo];
  const Icon = meta.icon;
  return (
    <button
      style={styles.temaBtn} title={`${meta.label} — toca para cambiar`} aria-label={meta.label}
      onClick={() => { vibrar(); guardarTema(meta.next); setModo(meta.next); }}
    >
      <Icon size={15} />
    </button>
  );
}

export function TopBar({ role, setRole, config, usuarioActual, onCambiarUsuario, online }) {
  return (
    <div className="no-imprimir" style={styles.topBar}>
      <div style={styles.brand}>
        <LogoMarca marca={config.marca} />
        <span style={styles.brandText}>{(config.businessName || "LA COMANDA").toUpperCase()}</span>
        <span style={{ ...styles.syncDot, background: online ? "#5B7553" : "#C1442D" }} title={online ? "En línea" : "Sin conexión"} />
        <BotonTema />
      </div>
      {usuarioActual && (
        <button style={styles.meseroChip} onClick={onCambiarUsuario} title="Cerrar sesión">
          <UserCircle2 size={13} /> {usuarioActual.nombre} · {rolesLabel(usuarioActual)}
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
    </div>
  );
}

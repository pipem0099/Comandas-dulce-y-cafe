import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { METODO_META } from "../constantes.js";
import { styles } from "../estilos.js";

export function LogoMarca({ marca, size = 22 }) {
  if (marca && marca.logo) return <img src={marca.logo} alt="" style={{ height: size, width: "auto", maxWidth: size * 3, objectFit: "contain", flexShrink: 0 }} />;
  return <span style={styles.brandMark}>◆</span>;
}

/** Campo para escribir montos en pesos. A diferencia de un <input type="number">,
 * SÍ entiende el punto como separador de miles (como se escribe en Colombia:
 * "50.000") — solo guarda los dígitos por dentro y siempre muestra el número
 * formateado, así que nunca se puede escribir un monto ambiguo o mal leído. */
export function CampoMonto({ value, onChange, placeholder, style, autoFocus }) {
  const digitos = (value || "").toString().replace(/\D/g, "");
  const mostrado = digitos ? Number(digitos).toLocaleString("es-CO") : "";
  return (
    <input
      autoFocus={autoFocus}
      style={style || styles.editInput}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={mostrado}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
    />
  );
}

/** Banner discreto para activar notificaciones del sistema — se puede
 * descartar, y no vuelve a aparecer en esta sesión si ya se descartó o si
 * el navegador no las soporta. */
export function AvisoActivarNotificaciones() {
  const soportado = typeof window !== "undefined" && "Notification" in window;
  const [permiso, setPermiso] = useState(soportado ? Notification.permission : "unsupported");
  const [descartado, setDescartado] = useState(false);

  if (!soportado || permiso !== "default" || descartado) return null;

  return (
    <div style={styles.avisoNotifBanner}>
      <span>Activa las notificaciones para enterarte aunque cambies de pantalla (no llegan con el celular bloqueado).</span>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button style={styles.avisoNotifBtn} onClick={() => Notification.requestPermission().then(setPermiso)}>Activar</button>
        <button style={styles.avisoNotifCerrar} onClick={() => setDescartado(true)}>✕</button>
      </div>
    </div>
  );
}

export function MetodoPills({ selected, onSelect }) {
  return (
    <div style={styles.metodoPillsRow}>
      {Object.entries(METODO_META).map(([key, meta]) => {
        const Icon = meta.icon;
        const isSel = selected === key;
        return (
          <button key={key} style={{ ...styles.metodoPill, ...(isSel ? { background: meta.color, color: "#F4F6F8", border: `1px solid ${meta.color}` } : {}) }} onClick={() => onSelect(key)}>
            <Icon size={14} /> {meta.label}
          </button>
        );
      })}
    </div>
  );
}

/** Bloque desplegable (un mes, una sección): la cabecera siempre se ve, el contenido se abre al tocar.
 * `abierto` puede ser controlado desde fuera; si no, empieza según `inicialAbierto`. */
export function Acordeon({ titulo, resumen, inicialAbierto = false, children }) {
  const [abierto, setAbierto] = useState(inicialAbierto);
  return (
    <div style={styles.acordeon}>
      <button style={styles.acordeonHead} onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left", minWidth: 0 }}>
          <span style={styles.acordeonTitulo}>{titulo}</span>
          {resumen && <span style={styles.acordeonResumen}>{resumen}</span>}
        </span>
        <ChevronDown size={18} style={{ flexShrink: 0, transition: "transform .32s cubic-bezier(.32,.72,0,1)", transform: abierto ? "rotate(180deg)" : "none" }} />
      </button>
      {abierto && <div className="despliega" style={styles.acordeonBody}>{children}</div>}
    </div>
  );
}

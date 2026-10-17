import React from "react";
import { styles } from "../estilos.js";

// Encabezado común de las pantallas de administración (menú, mesas, equipo, respaldos, ajustes).
export function CabeceraAdmin({ titulo, onClose, eyebrow = "ADMINISTRACIÓN" }) {
  return (
    <div className="ancho" style={styles.subHeader}>
      <button style={styles.backBtn} onClick={onClose}>← Volver</button>
      <div style={styles.mesaTitleWrap}><span style={styles.mesaEyebrow}>{eyebrow}</span><span style={styles.mesaTitle}>{titulo}</span></div>
      <div style={{ width: 70 }} />
    </div>
  );
}

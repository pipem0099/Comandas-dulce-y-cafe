import React from "react";
import { CabeceraAdmin } from "../componentes/CabeceraAdmin.jsx";
import { RespaldoBox } from "./RespaldoBox.jsx";
import { styles } from "../estilos.js";
import { PanelErrores } from "../componentes/PanelErrores.jsx";

// Pantalla propia de respaldos: copia completa, restauración y copias automáticas.
export function Respaldos({ onClose, errores, limpiarErrores, ...datos }) {
  return (
    <>
      <CabeceraAdmin titulo="Respaldos y datos" onClose={onClose} />
      <div className="ancho ancho-admin" style={{ ...styles.menuScroll, paddingBottom: 40 }}>
        <RespaldoBox {...datos} />
        <PanelErrores errores={errores || []} onLimpiar={limpiarErrores} />
      </div>
    </>
  );
}

import React from "react";
import { CabeceraAdmin } from "../componentes/CabeceraAdmin.jsx";
import { RespaldoBox } from "./Turno.jsx";
import { styles } from "../estilos.js";

// Pantalla propia de respaldos: copia completa, restauración y copias automáticas.
export function Respaldos({ onClose, ...datos }) {
  return (
    <>
      <CabeceraAdmin titulo="Respaldos y datos" onClose={onClose} />
      <div className="ancho" style={{ ...styles.menuScroll, paddingBottom: 40 }}>
        <RespaldoBox {...datos} />
      </div>
    </>
  );
}

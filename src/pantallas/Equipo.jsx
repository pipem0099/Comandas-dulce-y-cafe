import React from "react";
import { CabeceraAdmin } from "../componentes/CabeceraAdmin.jsx";
import { GestionUsuarios } from "./Usuarios.jsx";
import { styles } from "../estilos.js";

// Pantalla propia del equipo: cuentas, roles, propiedad y registro de seguridad.
export function Equipo({ config, persistConfig, usuarioActual, onClose }) {
  return (
    <>
      <CabeceraAdmin titulo="Equipo y usuarios" onClose={onClose} />
      <div className="ancho" style={{ ...styles.menuScroll, paddingBottom: 40 }}>
        <GestionUsuarios config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} />
      </div>
    </>
  );
}

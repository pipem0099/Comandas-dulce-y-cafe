import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { styles } from "../estilos.js";
import { BUILD_ID } from "../buildId.js";
import { crearVigilanteVersion, avisoVisible, buildIdDePrecache } from "../versionApp.js";
import { crearActualizador } from "../actualizarApp.js";

/*
 * «Hay una versión nueva» · «Actualizar».
 * Discreto (sin amarillo: el amarillo es solo para alertas) y solo con internet. Nunca recarga la app por su cuenta.
 */
const pedirPublicado = async () => {
  const res = await fetch(`/precache.json?v=${Date.now()}`, { cache: "no-store", headers: { "cache-control": "no-cache" } });
  if (!res.ok) return "";
  return buildIdDePrecache(await res.text());
};

export function AvisoVersion() {
  const vigilante = useMemo(() => crearVigilanteVersion({ buildId: BUILD_ID, pedirRemoto: pedirPublicado, enLinea: () => (typeof navigator === "undefined" ? true : navigator.onLine !== false) }), []);
  const [estado, setEstado] = useState(vigilante.estado());
  const [enLinea, setEnLinea] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  const [actualizando, setActualizando] = useState(false);

  useEffect(() => {
    const quitar = vigilante.observar(setEstado);
    const detener = vigilante.iniciar();
    const a = () => setEnLinea(true), b = () => setEnLinea(false);
    window.addEventListener("online", a); window.addEventListener("offline", b);
    return () => { quitar(); detener(); window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, [vigilante]);

  if (!avisoVisible(estado, enLinea)) return null;
  const actualizar = async () => { setActualizando(true); await crearActualizador().actualizar(); };
  return (
    <div style={{ ...styles.pendientesBanner, background: "var(--btn2-bg)", color: "var(--btn2-fg)", borderBottom: "1px solid var(--btn2-line)" }} role="status" data-aviso-version>
      <RefreshCw size={14} aria-hidden="true" />
      <span style={{ flex: 1 }}>Hay una versión nueva</span>
      <button className="toque44" style={{ ...styles.errorGuardadoCerrar, color: "var(--btn2-fg)", textDecoration: "underline", fontWeight: 700, minHeight: 44, minWidth: 44 }} disabled={actualizando} onClick={actualizar}>
        {actualizando ? "Actualizando…" : "Actualizar"}
      </button>
    </div>
  );
}

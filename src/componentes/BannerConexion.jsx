import React, { useState } from "react";
import { createPortal } from "react-dom";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { styles } from "../estilos.js";
import { Hoja } from "./Hoja.jsx";
import { describirConflicto } from "../sinConexion/textos.js";
import { conflictosSinConexion, descartarConflictoSinConexion, reintentarConflictoSinConexion } from "../firebase.js";

/*
 * Estado de la conexión, siempre visible cuando importa:
 *  · sin internet: se trabaja con los últimos datos guardados y los cambios se enviarán solos;
 *  · volviendo: cuántos cambios se están enviando;
 *  · choques: cambios que no se pudieron aplicar porque otro dispositivo tocó lo mismo (se revisan aquí).
 */
export function BannerConexion({ conexion, esAdmin }) {
  const [abierto, setAbierto] = useState(false);
  const [, refrescar] = useState(0);
  const { conectado, pendientes, conflictos, sincronizando } = conexion;
  if (conectado && pendientes === 0 && conflictos === 0) return null;
  const lista = abierto ? conflictosSinConexion() : [];
  return (
    <>
      {conflictos > 0 ? (
        <div style={{ ...styles.errorGuardadoBanner }} role="alert">
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}><b>{conflictos}</b> {conflictos === 1 ? "cambio hecho sin internet no se pudo aplicar" : "cambios hechos sin internet no se pudieron aplicar"}.</span>
          <button className="toque44" style={{ ...styles.errorGuardadoCerrar, textDecoration: "underline", fontWeight: 700 }} onClick={() => setAbierto(true)}>Revisar</button>
        </div>
      ) : !conectado ? (
        <div style={styles.pendientesBanner} role="status">
          <WifiOff size={14} />
          <span style={{ flex: 1 }}>Sin internet · trabajando con los últimos datos guardados.{pendientes > 0 ? <> <b>{pendientes}</b> {pendientes === 1 ? "cambio se enviará" : "cambios se enviarán"} solos al volver la conexión.</> : " Lo que hagas se guardará y se enviará solo."}</span>
        </div>
      ) : (
        <div style={{ ...styles.pendientesBanner, background: "var(--btn2-bg)", color: "var(--btn2-fg)", borderBottom: "1px solid var(--btn2-line)" }} role="status">
          <RefreshCw size={14} />
          <span style={{ flex: 1 }}>{sincronizando ? "Enviando" : "Por enviar"} <b>{pendientes}</b> {pendientes === 1 ? "cambio" : "cambios"} guardado{pendientes === 1 ? "" : "s"} sin internet…</span>
        </div>
      )}
      {abierto && createPortal(
        <Hoja onCerrar={() => setAbierto(false)} ancho={480} gap={10} label="Cambios que no se pudieron aplicar" z={85}>
          {({ cerrar }) => (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--c-242019-t)" }}>Cambios que no se pudieron aplicar</div>
              <div style={{ fontSize: 13.5, color: "var(--c-5c5648-t)", lineHeight: 1.5 }}>Se hicieron sin internet y otro dispositivo tocó lo mismo. No se perdió nada: aquí puedes decidir qué hacer con cada uno.{!esAdmin && " Pide a un administrador que los revise."}</div>
              {lista.length === 0 && <div style={{ fontSize: 14, color: "var(--c-5c5648-t)" }}>Ya no hay cambios por revisar.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "50vh", overflowY: "auto" }}>
                {lista.map((cf) => {
                  const d = describirConflicto(cf);
                  return (
                    <div key={cf.id} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)" }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--c-242019-t)" }}>{d.titulo}</div>
                      <div style={{ fontSize: 13, color: "var(--c-5c5648-t)", lineHeight: 1.5, marginTop: 4 }}>{d.detalle}</div>
                      {esAdmin && (
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button style={{ ...styles.btnRestringido, minHeight: 40, justifyContent: "center", flex: 1, fontSize: 13 }} onClick={async () => { await reintentarConflictoSinConexion(cf.id); refrescar((n) => n + 1); }}>Reintentar</button>
                          <button style={{ ...styles.btnRestringido, minHeight: 40, justifyContent: "center", flex: 1, fontSize: 13 }} onClick={async () => { await descartarConflictoSinConexion(cf.id); refrescar((n) => n + 1); }}>Descartar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button style={styles.cancelEditBtn} onClick={cerrar}>Cerrar</button>
            </>
          )}
        </Hoja>,
        document.body
      )}
    </>
  );
}

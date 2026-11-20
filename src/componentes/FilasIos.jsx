import React from "react";
import { InfoTip } from "./InfoTip.jsx";

/*
 * Piezas de formulario estilo «Ajustes de iOS», compartidas por las pantallas de configuración.
 *   <Grupo titulo="…" accion={…}>  tarjeta redondeada con filas separadas por líneas finas
 *   <FilaIos etiqueta="…" info={<InfoTip/>}>  etiqueta de UNA línea a la izquierda, control/valor a la derecha
 *   <Interruptor/>  switch iOS (role=switch, área táctil ≥ 44 px)
 * Las ayudas largas NO van debajo de los campos: van dentro de un (i) (InfoTip).
 */
export const K = { ink: "var(--c-242019-t)", sub: "var(--c-5c5648-t)", mute: "var(--btn2-mute)", line: "var(--btn2-line)", bg: "var(--btn2-bg)", verde: "var(--pago-ok)", error: "var(--c-c1442d-t)" };

export function Grupo({ titulo, accion, children, testid, ariaLabel }) {
  return (
    <section data-testid={testid} aria-label={ariaLabel || titulo} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {(titulo || accion) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 28, padding: "0 6px" }}>
          <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: K.mute }}>{titulo}</h2>
          {accion}
        </div>
      )}
      <div style={{ borderRadius: 14, border: `1px solid ${K.line}`, background: "var(--c-fffdf8-b)", overflow: "hidden" }}>{children}</div>
    </section>
  );
}

/* Una fila: etiqueta (una sola línea) · control. `ultima` quita el divisor. */
export function FilaIos({ etiqueta, info, children, ultima, columna, error }) {
  return (
    <div style={{ padding: "0 14px", borderBottom: ultima ? "none" : `0.5px solid ${K.line}` }}>
      <div style={{ display: "flex", flexDirection: columna ? "column" : "row", alignItems: columna ? "stretch" : "center", gap: columna ? 4 : 10, minHeight: 48, padding: columna ? "8px 0" : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flex: "0 1 auto", minWidth: 0, fontSize: 15, color: K.ink }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{etiqueta}</span>{info ? <span style={{ flexShrink: 0, display: "inline-flex" }}>{info}</span> : null}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: columna ? "flex-start" : "flex-end", gap: 8, textAlign: columna ? "left" : "right", color: K.sub, fontSize: 15 }}>{children}</div>
      </div>
      {error ? <div role="alert" style={{ fontSize: 12.5, color: K.error, paddingBottom: 8 }}>{error}</div> : null}
    </div>
  );
}

/* Par simétrico en la misma fila (Municipio + Cód. DANE, Desde + Hasta…): dos columnas iguales con etiqueta arriba. */
export function ParIos({ a, b, ultima }) {
  const col = (x) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 13, color: K.mute, height: 28, minWidth: 0 }}><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{x.etiqueta}</span>{x.info ? <span style={{ flexShrink: 0, display: "inline-flex" }}>{x.info}</span> : null}</div>
      <div style={{ minHeight: 44, display: "flex", alignItems: "center", fontSize: 15, color: K.ink }}>{x.control}</div>
      {x.error ? <div role="alert" style={{ fontSize: 12.5, color: K.error }}>{x.error}</div> : null}
    </div>
  );
  return <div style={{ display: "flex", gap: 12, padding: "8px 14px", borderBottom: ultima ? "none" : `0.5px solid ${K.line}` }}>{col(a)}{col(b)}</div>;
}

export function Interruptor({ valor, onChange, etiqueta, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={!!valor} aria-label={etiqueta} disabled={disabled} onClick={() => onChange(!valor)} className="toque44"
      style={{ position: "relative", width: 51, height: 31, minWidth: 51, minHeight: 44, padding: 0, border: "none", background: "transparent", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
      <span aria-hidden="true" style={{ position: "absolute", left: 0, top: "50%", marginTop: -15.5, width: 51, height: 31, borderRadius: 16, background: valor ? "#30D158" : "rgba(120,120,128,.32)", transition: "background .2s" }} />
      <span aria-hidden="true" style={{ position: "absolute", top: "50%", marginTop: -13.5, left: valor ? 22 : 2, width: 27, height: 27, borderRadius: 14, background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,.3)", transition: "left .2s" }} />
    </button>
  );
}

export const inputIos = { width: "100%", minWidth: 0, height: 44, padding: 0, border: "none", outline: "none", background: "transparent", color: K.ink, fontSize: 15, fontFamily: "inherit", textAlign: "right" };
export const inputIosIzq = { ...inputIos, textAlign: "left" };

export function BotonTexto({ children, onClick, disabled, color, ariaLabel, negrita }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={{ minHeight: 44, minWidth: 44, padding: "0 6px", border: "none", background: "transparent", color: color || K.verde, fontSize: 15, fontWeight: negrita ? 700 : 500, opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap" }}>{children}</button>;
}
export { InfoTip };

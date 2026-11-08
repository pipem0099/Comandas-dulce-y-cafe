import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { Chevron } from "./Comunes.jsx";
import { MESES, pad, aClave, deClave, fechaLegible, semanasDelMes, horaLegible } from "../fechas.js";

/*
 * Campos propios de la app: reemplazan la lista, el calendario y el reloj del sistema (Android/iOS), que sacan a la persona de la
 * app y se ven distintos en cada teléfono. Todos abren una hoja con el mismo estilo que el resto.
 *   <Selector value onChange opciones={[{ valor, etiqueta, detalle? }]} titulo />
 *   <CampoFecha value="2026-11-20" onChange min max opcional />
 *   <CampoHora value="16:30" onChange />
 */

const Z = 90; // por encima de otras hojas (muchos campos viven dentro de una hoja)

const campo = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", minHeight: 44, padding: "0 14px", borderRadius: 12,
  border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 14, fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-body)",
};
const titulo = { fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--c-242019-t)" };
const filaBase = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", minHeight: 52, padding: "0 14px", borderRadius: 12, border: "none", background: "transparent", color: "var(--c-242019-t)", fontSize: 15, fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-body)" };
const filaOn = { background: "var(--chip-on-bg)", color: "var(--chip-on-fg)", fontWeight: 700 };
const botonSec = { minHeight: 44, flex: 1, borderRadius: 12, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" };

/* ───────────────────────── Selector (lista) ───────────────────────── */
export function Selector({ value, onChange, opciones, titulo: tit, style, ariaLabel, compacto = false, placeholder = "Elegir" }) {
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find((o) => String(o.valor) === String(value));
  return (
    <>
      <button type="button" aria-haspopup="listbox" aria-label={ariaLabel || tit} onClick={() => setAbierto(true)}
        style={{ ...campo, ...(compacto ? { minHeight: 40, padding: "0 12px", fontSize: 13 } : {}), ...style }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: actual ? undefined : "var(--btn2-mute)" }}>{actual ? actual.etiqueta : placeholder}</span>
        <Chevron abierto={abierto} size={16} />
      </button>
      {abierto && createPortal(
        <Hoja onCerrar={() => setAbierto(false)} ancho={440} gap={8} label={tit || "Elegir una opción"} z={Z}>
          {({ cerrar }) => (
            <>
              {tit && <div style={titulo}>{tit}</div>}
              <div role="listbox" aria-label={tit} style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "55vh", overflowY: "auto" }}>
                {opciones.map((o) => {
                  const on = String(o.valor) === String(value);
                  return (
                    <button key={String(o.valor)} type="button" role="option" aria-selected={on} style={{ ...filaBase, ...(on ? filaOn : {}) }} onClick={() => { onChange(o.valor); cerrar(); }}>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span>{o.etiqueta}</span>
                        {o.detalle ? <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>{o.detalle}</span> : null}
                      </span>
                      {on && <Check size={18} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Hoja>,
        document.body
      )}
    </>
  );
}

/* ───────────────────────── Fecha ───────────────────────── */
const SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

export function CampoFecha({ value, onChange, min, max, opcional = false, placeholder = "Elegir fecha", ariaLabel, style, titulo: tit = "Elegir fecha" }) {
  const [abierto, setAbierto] = useState(false);
  const base = value ? deClave(value) : new Date();
  const [vista, setVista] = useState({ a: base.getFullYear(), m: base.getMonth() });
  const hoy = aClave(new Date());
  const abrir = () => { const b = value ? deClave(value) : new Date(); setVista({ a: b.getFullYear(), m: b.getMonth() }); setAbierto(true); };
  const mover = (n) => setVista((v) => { const d = new Date(v.a, v.m + n, 1); return { a: d.getFullYear(), m: d.getMonth() }; });
  const fueraDeRango = (k) => (min && k < min) || (max && k > max);
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={ariaLabel || tit} onClick={abrir} style={{ ...campo, ...style }}>
        <span style={{ color: value ? undefined : "var(--btn2-mute)" }}>{value ? fechaLegible(value) : placeholder}</span>
        <CalendarDays size={16} color="var(--btn2-mute)" />
      </button>
      {abierto && createPortal(
        <Hoja onCerrar={() => setAbierto(false)} ancho={400} gap={10} label={tit} z={Z}>
          {({ cerrar }) => (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button type="button" aria-label="Mes anterior" onClick={() => mover(-1)} style={{ ...botonSec, flex: "0 0 44px" }}><ChevronLeft size={18} /></button>
                <div style={{ ...titulo, textTransform: "capitalize" }} aria-live="polite">{MESES[vista.m]} {vista.a}</div>
                <button type="button" aria-label="Mes siguiente" onClick={() => mover(1)} style={{ ...botonSec, flex: "0 0 44px" }}><ChevronRight size={18} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }} role="grid">
                {SEMANA.map((d, i) => <div key={i} style={{ fontSize: 12, fontWeight: 600, color: "var(--btn2-mute)", padding: "4px 0" }}>{d}</div>)}
                {semanasDelMes(vista.a, vista.m).flat().map((dia, i) => {
                  if (!dia) return <div key={i} />;
                  const k = `${vista.a}-${pad(vista.m + 1)}-${pad(dia)}`;
                  const on = k === value, esHoy = k === hoy, no = fueraDeRango(k);
                  return (
                    <button key={i} type="button" role="gridcell" aria-selected={on} aria-label={fechaLegible(k)} disabled={no}
                      onClick={() => { onChange(k); cerrar(); }}
                      style={{ minHeight: 44, borderRadius: 10, border: "none", fontSize: 14.5, fontWeight: on ? 700 : 500, cursor: no ? "not-allowed" : "pointer", opacity: no ? 0.3 : 1, fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums",
                        background: on ? "var(--chip-on-bg)" : "transparent", color: on ? "var(--chip-on-fg)" : "var(--c-242019-t)",
                        boxShadow: on ? "inset 0 0 0 1px var(--chip-on-line)" : esHoy ? "inset 0 0 0 1px var(--btn2-mute)" : "none" }}>{dia}</button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={botonSec} onClick={() => { if (!fueraDeRango(hoy)) { onChange(hoy); cerrar(); } }} disabled={fueraDeRango(hoy)}>Hoy</button>
                {opcional && value && <button type="button" style={botonSec} onClick={() => { onChange(""); cerrar(); }}>Quitar fecha</button>}
                <button type="button" style={botonSec} onClick={cerrar}>Cerrar</button>
              </div>
            </>
          )}
        </Hoja>,
        document.body
      )}
    </>
  );
}

/* ───────────────────────── Hora ───────────────────────── */
/** 16 → "4 p. m.",  0 → "12 a. m." */
const horaCorta = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "a. m." : "p. m."}`;

export function CampoHora({ value, onChange, placeholder = "Elegir hora", ariaLabel, style, titulo: tit = "Elegir hora" }) {
  const [abierto, setAbierto] = useState(false);
  const [h0, m0] = value ? String(value).split(":").map(Number) : [null, 0];
  const [hora, setHora] = useState(h0);
  const abrir = () => { setHora(h0); setAbierto(true); };
  const casilla = (on) => ({ minHeight: 44, borderRadius: 10, border: "none", fontSize: 14, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "var(--font-body)", background: on ? "var(--chip-on-bg)" : "var(--btn2-bg)", color: on ? "var(--chip-on-fg)" : "var(--btn2-fg)", boxShadow: on ? "inset 0 0 0 1px var(--chip-on-line)" : "none" });
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={ariaLabel || tit} onClick={abrir} style={{ ...campo, ...style }}>
        <span style={{ color: value ? undefined : "var(--btn2-mute)" }}>{value ? horaLegible(value) : placeholder}</span>
        <Clock size={16} color="var(--btn2-mute)" />
      </button>
      {abierto && createPortal(
        <Hoja onCerrar={() => setAbierto(false)} ancho={400} gap={10} label={tit} z={Z}>
          {({ cerrar }) => (
            <>
              <div style={titulo}>{tit}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--btn2-mute)" }}>HORA</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {Array.from({ length: 24 }, (_, h) => <button key={h} type="button" aria-pressed={h === hora} style={casilla(h === hora)} onClick={() => setHora(h)}>{horaCorta(h)}</button>)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--btn2-mute)" }}>MINUTOS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                {Array.from({ length: 12 }, (_, i) => i * 5).map((mm) => (
                  <button key={mm} type="button" disabled={hora == null} aria-pressed={hora != null && mm === m0 && h0 === hora} style={{ ...casilla(hora != null && mm === m0 && h0 === hora), opacity: hora == null ? 0.4 : 1 }}
                    onClick={() => { onChange(`${pad(hora)}:${pad(mm)}`); cerrar(); }}>{pad(mm)}</button>
                ))}
              </div>
              <button type="button" style={botonSec} onClick={cerrar}>Cerrar</button>
            </>
          )}
        </Hoja>,
        document.body
      )}
    </>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { Chevron } from "./Comunes.jsx";
import { Rueda, Transicion } from "../movimiento.jsx";
import { vibrar } from "../theme.js";
import { MESES, pad, aClave, deClave, fechaLegible, fechaCorta, semanasDelMes, horaLegible } from "../fechas.js";

/*
 * Campos propios de la app: reemplazan la lista, el calendario y el reloj del sistema (Android/iOS), que sacan a la persona de la
 * app y se ven distintos en cada teléfono. Todos abren una hoja con el mismo estilo que el resto.
 *   <Selector value onChange opciones={[{ valor, etiqueta, detalle? }]} titulo />
 *   <CampoFecha value="2026-11-20" onChange min max opcional marcas leyenda />
 *     marcas = { "2026-11-24": "ok" | "alerta" } pinta esos días (verde / rojo, con punto además del color); leyenda = [{ tono, texto }] la explica debajo.
 *     vistaPrevia = (clave) => contenido | null: en los días marcados, mantener presionado (táctil) o doble clic (mouse) abre una tarjeta flotante con ese contenido.
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
export function Selector({ value, onChange, opciones, titulo: tit, style, ariaLabel, compacto = false, placeholder = "Elegir", buscable = false, bloqueado = false }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const sin = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visibles = buscable && q.trim() ? opciones.filter((o) => sin(o.etiqueta).includes(sin(q.trim()))) : opciones;
  const actual = opciones.find((o) => String(o.valor) === String(value));
  return (
    <>
      <button type="button" aria-haspopup="listbox" aria-label={ariaLabel || tit} disabled={bloqueado} onClick={() => { setQ(""); setAbierto(true); }}
        style={{ ...campo, ...(compacto ? { minHeight: 40, padding: "0 12px", fontSize: 13 } : {}), ...style }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: actual ? undefined : "var(--btn2-mute)" }}>{actual ? actual.etiqueta : placeholder}</span>
        <Chevron abierto={abierto} size={16} />
      </button>
      {abierto && createPortal(
        <Hoja onCerrar={() => setAbierto(false)} ancho={440} gap={8} label={tit || "Elegir una opción"} z={Z}>
          {({ cerrar }) => (
            <>
              {tit && <div style={titulo}>{tit}</div>}
              {buscable && <input type="search" autoComplete="off" autoCorrect="off" aria-label={`Buscar: ${tit || ""}`} placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} style={{ height: 44, borderRadius: 12, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--c-242019-t)", padding: "0 14px", fontSize: 15, fontFamily: "inherit" }} />}
              <div role="listbox" aria-label={tit} style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "55vh", overflowY: "auto" }}>
                {buscable && visibles.length === 0 && <div style={{ padding: "12px 14px", color: "var(--btn2-mute)", fontSize: 14 }}>Sin resultados.</div>}
                {visibles.map((o) => {
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

/* ───────────────────────── Vista previa de un día (tarjeta flotante) ─────────────────────────
   Fondo oscurecido y desenfocado; se cierra al tocar fuera o con Esc (sin cerrar el calendario que hay debajo). */
function VistaPrevia({ onCerrar, etiqueta, children }) {
  const abiertaEn = useRef(Date.now());
  const tarjeta = useRef(null);
  useEffect(() => {
    const previo = document.activeElement;
    if (tarjeta.current) tarjeta.current.focus();
    const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar(); } };
    window.addEventListener("keydown", tecla, true);          // en captura: así el Esc no llega también a la hoja del calendario
    return () => { window.removeEventListener("keydown", tecla, true); if (previo && previo.focus) previo.focus(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // El dedo del long-press suelta justo sobre el fondo: se ignora lo que llegue en los primeros instantes.
  const cerrarFondo = (e) => { if (e.target === e.currentTarget && Date.now() - abiertaEn.current > 350) onCerrar(); };
  return (
    <div className="peek" style={{ zIndex: Z + 5 }} onClick={cerrarFondo} onContextMenu={(e) => e.preventDefault()}>
      <div ref={tarjeta} className="peek-tarjeta" role="dialog" aria-modal="true" aria-label={etiqueta} tabIndex={-1}>
        <button type="button" aria-label="Cerrar vista previa" onClick={onCerrar} style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 16, border: "none", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 18, lineHeight: 1, cursor: "pointer" }}>×</button>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── Fecha ───────────────────────── */
const SEMANA = ["L", "M", "M", "J", "V", "S", "D"];
/* Estado de un día en el calendario (opcional). Nunca solo color: lleva un punto y su texto va en la etiqueta accesible. */
const TONOS_FECHA = { ok: "var(--c-5b7553-t)", alerta: "var(--c-c1442d-t)" };

export function CampoFecha({ value, onChange, min, max, opcional = false, placeholder = "Elegir fecha", ariaLabel, style, titulo: tit = "Elegir fecha", marcas, leyenda, vistaPrevia }) {
  const [abierto, setAbierto] = useState(false);
  const [peek, setPeek] = useState(null);                 // día cuya vista previa está abierta
  const lp = useRef({ timer: null, clic: null, x: 0, y: 0, suprimir: null });
  const base = value ? deClave(value) : new Date();
  const [vista, setVista] = useState({ a: base.getFullYear(), m: base.getMonth() });
  const hoy = aClave(new Date());
  const abrir = () => { const b = value ? deClave(value) : new Date(); setVista({ a: b.getFullYear(), m: b.getMonth() }); setPeek(null); setAbierto(true); };
  const puedeVer = (k) => !!(vistaPrevia && marcas && TONOS_FECHA[marcas[k]]);   // solo los días con color; los neutros no abren nada
  const cancelarLp = () => { clearTimeout(lp.current.timer); lp.current.timer = null; };
  const cerrarPeek = () => { setPeek(null); setTimeout(() => { lp.current.suprimir = null; }, 400); };
  const contenidoPeek = peek && abierto ? vistaPrevia(peek) : null;
  const mover = (n) => setVista((v) => { const d = new Date(v.a, v.m + n, 1); return { a: d.getFullYear(), m: d.getMonth() }; });
  const fueraDeRango = (k) => (min && k < min) || (max && k > max);
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={ariaLabel || tit} onClick={abrir} style={{ ...campo, ...style }}>
        <span style={{ color: value ? undefined : "var(--btn2-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{value ? fechaCorta(value) : placeholder}</span>
        <CalendarDays size={16} color="var(--btn2-mute)" style={{ flexShrink: 0 }} />
      </button>
      {abierto && createPortal(
        <Hoja onCerrar={() => setAbierto(false)} ancho={400} gap={10} label={tit} z={Z}>
          {({ cerrar }) => (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button type="button" aria-label="Mes anterior" onClick={() => mover(-1)} style={{ ...botonSec, flex: "0 0 44px" }}><ChevronLeft size={18} /></button>
                <Transicion modo="deslizar" clave={`${vista.a}-${vista.m}`} indice={vista.a * 12 + vista.m} altura={false} style={{ flex: 1, height: 28 }}>
                  <div style={{ ...titulo, textTransform: "capitalize", textAlign: "center" }} aria-live="polite">{MESES[vista.m]} {vista.a}</div>
                </Transicion>
                <button type="button" aria-label="Mes siguiente" onClick={() => mover(1)} style={{ ...botonSec, flex: "0 0 44px" }}><ChevronRight size={18} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
                {SEMANA.map((d, i) => <div key={i} style={{ fontSize: 12, fontWeight: 600, color: "var(--btn2-mute)", padding: "4px 0" }}>{d}</div>)}
              </div>
              <Transicion modo="deslizar" clave={`${vista.a}-${vista.m}`} indice={vista.a * 12 + vista.m}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }} role="grid">
                {semanasDelMes(vista.a, vista.m).flat().map((dia, i) => {
                  if (!dia) return <div key={i} />;
                  const k = `${vista.a}-${pad(vista.m + 1)}-${pad(dia)}`;
                  const on = k === value, esHoy = k === hoy, no = fueraDeRango(k);
                  const tono = marcas && TONOS_FECHA[marcas[k]] ? marcas[k] : null;
                  const color = tono ? TONOS_FECHA[tono] : null;
                  const textoTono = tono && leyenda ? (leyenda.find((l) => l.tono === tono) || {}).texto : "";
                  const ver = puedeVer(k);
                  const elegir = () => { onChange(k); cerrar(); };
                  const gestos = ver ? {
                    // Táctil: mantener presionado ~450 ms. Al soltar, ese toque NO selecciona la fecha (ver `suprimir` en onClick).
                    onPointerDown: (e) => {
                      if (e.pointerType === "mouse") return;
                      cancelarLp(); lp.current.suprimir = null; lp.current.x = e.clientX; lp.current.y = e.clientY;
                      lp.current.timer = setTimeout(() => { lp.current.timer = null; lp.current.suprimir = k; vibrar(15); setPeek(k); }, 450);
                    },
                    onPointerMove: (e) => { if (lp.current.timer && Math.hypot(e.clientX - lp.current.x, e.clientY - lp.current.y) > 10) cancelarLp(); },
                    onPointerUp: cancelarLp, onPointerLeave: cancelarLp, onPointerCancel: cancelarLp,
                    onContextMenu: (e) => e.preventDefault(),                      // sin el menú nativo del long-press
                    onDoubleClick: (e) => { e.preventDefault(); clearTimeout(lp.current.clic); setPeek(k); },   // escritorio
                    onKeyDown: (e) => { if ((e.key === "Enter" && e.shiftKey) || e.key === "ContextMenu") { e.preventDefault(); setPeek(k); } },
                  } : {};
                  return (
                    <button key={i} type="button" role="gridcell" aria-selected={on} aria-label={`${fechaLegible(k)}${textoTono ? `, ${textoTono}` : ""}`} disabled={no} {...gestos}
                      onClick={(e) => {
                        if (lp.current.suprimir === k) { lp.current.suprimir = null; e.preventDefault(); return; }   // soltó tras el long-press
                        const puntero = e.nativeEvent && e.nativeEvent.pointerType;
                        if (!ver || e.detail === 0 || puntero === "touch" || puntero === "pen") { elegir(); return; }
                        if (e.detail > 1) return;                                   // 2.º clic de un doble clic: lo atiende onDoubleClick
                        clearTimeout(lp.current.clic); lp.current.clic = setTimeout(elegir, 280);   // espera por si viene el doble clic
                      }}
                      style={{ position: "relative", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none", minHeight: 44, borderRadius: 10, border: "none", fontSize: 14.5, fontWeight: on || tono ? 700 : 500, cursor: no ? "not-allowed" : "pointer", opacity: no ? 0.3 : 1, fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums",
                        background: on ? "var(--chip-on-bg)" : color ? `color-mix(in srgb, ${color} 20%, transparent)` : "transparent", color: on ? "var(--chip-on-fg)" : "var(--c-242019-t)",
                        boxShadow: on ? "inset 0 0 0 1px var(--chip-on-line)" : color ? `inset 0 0 0 1.5px ${color}` : esHoy ? "inset 0 0 0 1px var(--btn2-mute)" : "none" }}>
                      {dia}
                      {color && <span aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: 4, width: 5, height: 5, marginLeft: -2.5, borderRadius: "50%", background: color }} />}
                    </button>
                  );
                })}
              </div>
              </Transicion>
              {leyenda && leyenda.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 12.5, color: "var(--btn2-mute)", lineHeight: 1.3 }}>
                  {leyenda.map((l) => (
                    <span key={l.texto} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: TONOS_FECHA[l.tono] ? TONOS_FECHA[l.tono] : "transparent", boxShadow: TONOS_FECHA[l.tono] ? "none" : "inset 0 0 0 1.5px var(--btn2-mute)" }} />{l.texto}
                    </span>
                  ))}
                </div>
              )}
              {vistaPrevia && <div style={{ fontSize: 12, color: "var(--btn2-mute)", lineHeight: 1.3 }}>Mantén presionado (o doble clic) un día de color para ver su detalle.</div>}
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
      {abierto && contenidoPeek && createPortal(<VistaPrevia onCerrar={cerrarPeek} etiqueta={`Detalle de propinas, ${fechaLegible(peek)}`}>{contenidoPeek}</VistaPrevia>, document.body)}
    </>
  );
}

/* ───────────────────────── Hora ───────────────────────── */
const H12 = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: String(i + 1) }));
const AMPM = [{ v: "am", label: "a. m." }, { v: "pm", label: "p. m." }];
const A24 = (h12, pm) => (h12 % 12) + (pm ? 12 : 0);

/* Hora con ruedas que se frenan en cada valor (como el selector de iOS): hora · minutos · a. m./p. m. */
export function CampoHora({ value, onChange, placeholder = "Elegir hora", ariaLabel, style, titulo: tit = "Elegir hora" }) {
  const [abierto, setAbierto] = useState(false);
  const [h0, m0] = value ? String(value).split(":").map(Number) : [null, 0];
  const [h12, setH12] = useState(12);
  const [min, setMin] = useState(0);
  const [pm, setPm] = useState("pm");
  const abrir = () => {
    if (h0 != null) { setH12(h0 % 12 === 0 ? 12 : h0 % 12); setMin(m0 || 0); setPm(h0 >= 12 ? "pm" : "am"); }
    else { setH12(12); setMin(0); setPm("pm"); }
    setAbierto(true);
  };
  // minutos de 5 en 5; si la hora guardada trae otro minuto (p. ej. 20:07) también aparece
  const minutos = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!minutos.includes(min)) minutos.push(min);
  minutos.sort((a, b) => a - b);
  const opcionesMin = minutos.map((m) => ({ v: m, label: pad(m) }));
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={ariaLabel || tit} onClick={abrir} style={{ ...campo, ...style }}>
        <span style={{ color: value ? undefined : "var(--btn2-mute)" }}>{value ? horaLegible(value) : placeholder}</span>
        <Clock size={16} color="var(--btn2-mute)" />
      </button>
      {abierto && createPortal(
        <Hoja onCerrar={() => setAbierto(false)} ancho={400} gap={12} label={tit} z={Z}>
          {({ cerrar }) => (
            <>
              <div style={titulo}>{tit}</div>
              <div className="ruedas">
                <Rueda etiqueta="Hora" opciones={H12} valor={h12} onChange={setH12} />
                <Rueda etiqueta="Minutos" opciones={opcionesMin} valor={min} onChange={setMin} />
                <Rueda etiqueta="a. m. o p. m." opciones={AMPM} valor={pm} onChange={setPm} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={botonSec} onClick={cerrar}>Cancelar</button>
                <button type="button" style={{ ...botonSec, background: "var(--accent)", color: "var(--accent-fg)", border: "none", fontWeight: 700 }}
                  onClick={() => { onChange(`${pad(A24(h12, pm === "pm"))}:${pad(min)}`); cerrar(); }}>Listo</button>
              </div>
            </>
          )}
        </Hoja>,
        document.body
      )}
    </>
  );
}

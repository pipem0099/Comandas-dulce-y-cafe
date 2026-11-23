import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, RefreshCw, WifiOff, X } from "lucide-react";
import { Chevron, Despliegue } from "./Comunes.jsx";

/*
 * "Isla" — pastillas flotantes bajo la barra superior (no empujan el contenido).
 * Se usan con MUCHA moderación, solo para lo que el equipo no debe perderse:
 *   · Conexión: sin internet / enviando cambios / "todo sincronizado" (informativa, se va sola).
 *   · Críticas: alertas de nivel "alta" y cambios sin internet que no se pudieron aplicar.
 * Las acciones rutinarias (cobrar, guardar, enviar a cocina…) siguen usando los avisos breves de siempre.
 * Reglas: una crítica a la vez (el resto espera), se retira sola a los 9 s (queda en la campana), nunca tapa botones de abajo.
 */

/* ── Cola de alertas críticas ── */
const escuchas = new Set();
export function islaCritica({ id, texto, detalle }) {
  const item = { id: id || `c${Date.now()}`, texto, detalle };
  escuchas.forEach((f) => f(item));
}
export const ABRIR_ALERTAS = "abrir-alertas";
const DURACION_CRITICA = 9000;

/* Debajo de la barra superior (celular) o arriba del todo (escritorio) */
function medirTop() {
  try {
    const b = document.querySelector("[data-barra-superior]");
    if (b) { const r = b.getBoundingClientRect(); if (r.height > 0) return Math.round(r.bottom) + 8; }
  } catch (e) { /* sin barra */ }
  return 12;
}

/* Una pastilla: se monta, entra con resorte, y al ocultarse sale animada antes de desmontarse. */
function Pastilla({ visible, datos, onCerrar, onAbrirCerrar }) {
  const [montada, setMontada] = useState(!!visible);
  const [snap, setSnap] = useState(datos);
  const [abierta, setAbierta] = useState(false);
  const y0 = useRef(null);
  useEffect(() => {
    if (visible) { setSnap(datos); setMontada(true); return undefined; }
    setAbierta(false);
    const t = setTimeout(() => setMontada(false), 340);
    return () => clearTimeout(t);
  }, [visible, datos]);
  useEffect(() => { if (onAbrirCerrar) onAbrirCerrar(abierta); }, [abierta]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!montada || !snap) return null;
  const Icono = snap.icono;
  const alternar = () => { if (snap.detalle) setAbierta((v) => !v); };
  return (
    <div className="isla" data-tono={snap.tono} data-salir={visible ? "0" : "1"} role={snap.tono === "peligro" ? "alert" : "status"}
      onTouchStart={(e) => { y0.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => { if (y0.current != null && snap.cerrable && e.changedTouches[0].clientY - y0.current < -28 && onCerrar) onCerrar(); y0.current = null; }}>
      <div className="isla-fila" onClick={alternar} style={{ cursor: snap.detalle ? "pointer" : "default" }}>
        <span className={"isla-ico" + (snap.gira ? " isla-gira" : "")}><Icono size={15} /></span>
        <span className="isla-txt">{snap.texto}</span>
        {snap.boton && <button type="button" className="isla-btn" onClick={(e) => { e.stopPropagation(); snap.boton.fn(); }}>{snap.boton.texto}</button>}
        {snap.detalle && <Chevron abierto={abierta} size={15} />}
        {snap.cerrable && <button type="button" className="isla-x" aria-label="Cerrar aviso" onClick={(e) => { e.stopPropagation(); if (onCerrar) onCerrar(); }}><X size={13} /></button>}
      </div>
      {snap.detalle && <Despliegue abierto={abierta}><div className="isla-detalle">{snap.detalle}</div></Despliegue>}
    </div>
  );
}

export function IslaHost({ conexion, onRevisarConflictos }) {
  const { conectado = true, pendientes = 0, conflictos = 0, sincronizando = false } = conexion || {};

  /* Conexión: el aviso de "sin internet / enviando" solo sale si dura más de unos segundos (un parpadeo al abrir no importa). */
  const hayAlgo = !conectado || pendientes > 0;
  const [dura, setDura] = useState(false);
  const [recien, setRecien] = useState(false);
  const vistoRef = useRef(false);
  useEffect(() => {
    if (!hayAlgo) {
      setDura(false);
      if (vistoRef.current) { vistoRef.current = false; setRecien(true); }
      return undefined;
    }
    if (!conectado && typeof navigator !== "undefined" && navigator.onLine === false) { vistoRef.current = true; setDura(true); return undefined; }
    const t = setTimeout(() => { vistoRef.current = true; setDura(true); }, 3500);
    return () => clearTimeout(t);
  }, [hayAlgo, conectado]);
  useEffect(() => {
    if (!recien) return undefined;
    const t = setTimeout(() => setRecien(false), 2400);
    return () => clearTimeout(t);
  }, [recien]);
  useEffect(() => { if (hayAlgo) setRecien(false); }, [hayAlgo]);

  let datosConexion = null;
  if (conflictos > 0) {
    datosConexion = { tono: "peligro", icono: AlertTriangle, texto: `${conflictos} ${conflictos === 1 ? "cambio hecho sin internet no se pudo aplicar" : "cambios hechos sin internet no se pudieron aplicar"}`, boton: { texto: "Revisar", fn: onRevisarConflictos || (() => {}) } };
  } else if (!conectado) {
    datosConexion = { tono: "aviso", icono: WifiOff, texto: `Sin conexión${pendientes > 0 ? ` · ${pendientes} por enviar` : ""}`, detalle: "Trabajando con los últimos datos guardados. Los cambios se enviarán solos al volver el internet." };
  } else if (pendientes > 0) {
    datosConexion = { tono: "neutro", icono: RefreshCw, gira: true, texto: `${sincronizando ? "Enviando" : "Por enviar"} ${pendientes} ${pendientes === 1 ? "cambio" : "cambios"}…` };
  } else {
    datosConexion = { tono: "ok", icono: Check, texto: "Todo sincronizado" };
  }
  const conexionVisible = conflictos > 0 || (hayAlgo && dura) || recien;

  /* Críticas: una a la vez; se retira sola salvo que la estén leyendo (expandida). */
  const [cola, setCola] = useState([]);
  const [leyendo, setLeyendo] = useState(false);
  useEffect(() => {
    const f = (it) => setCola((c) => (c.some((x) => x.id === it.id) ? c : [...c.slice(-2), it]));
    escuchas.add(f);
    return () => escuchas.delete(f);
  }, []);
  const actual = cola[0] || null;
  const cerrarActual = () => setCola((c) => c.slice(1));
  useEffect(() => {
    if (!actual || leyendo) return undefined;
    const t = setTimeout(cerrarActual, DURACION_CRITICA);
    return () => clearTimeout(t);
  }, [actual && actual.id, leyendo]); // eslint-disable-line react-hooks/exhaustive-deps
  const datosCritica = actual ? { tono: "peligro", icono: AlertTriangle, texto: actual.texto, detalle: actual.detalle, cerrable: true, boton: { texto: "Ver alertas", fn: () => { window.dispatchEvent(new Event(ABRIR_ALERTAS)); cerrarActual(); } } } : null;

  /* Posición bajo la barra superior */
  const [top, setTop] = useState(12);
  const alguna = conexionVisible || !!actual;
  useEffect(() => {
    if (!alguna) return undefined;
    const med = () => setTop(medirTop());
    med();
    window.addEventListener("resize", med);
    return () => window.removeEventListener("resize", med);
  }, [alguna]);

  if (typeof document === "undefined" || !document.body) return null;
  return createPortal(
    <div className="isla-host no-imprimir" style={{ top }} aria-live="polite">
      <Pastilla visible={!!actual} datos={datosCritica} onCerrar={cerrarActual} onAbrirCerrar={setLeyendo} />
      <Pastilla visible={conexionVisible} datos={datosConexion} />
    </div>,
    document.body
  );
}

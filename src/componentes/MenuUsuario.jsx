import React, { useState, useEffect } from "react";
import { X, Sun, Moon, MonitorSmartphone, SlidersHorizontal, Users, KeyRound, Download, LogOut, ChevronRight, Check } from "lucide-react";
import { guardarTema, temaGuardado, vibrar } from "../theme.js";
import { enviarCorreoCambioClave } from "../firebase.js";
import { rolesLabel } from "../utilidades.js";
import { VERSION } from "../constantes.js";

/*
 * Menú de la persona que inició sesión: se abre al tocar su nombre en la barra de arriba.
 * (Antes ese toque cerraba la sesión directamente.)
 */
const K = {
  bg: "var(--c-f7f4ec-b)", surface: "var(--c-fffdf8-b)", soft: "var(--c-ede7d8-b)", border: "var(--c-e4dfce-o)",
  ink: "var(--c-242019-t)", muted: "var(--c-8a8272-t)", sub: "var(--c-5c5648-t)", faint: "#B3A891", cream: "#F7F4EC",
};
const TEMAS = [
  { id: "auto", label: "Automático", icon: MonitorSmartphone },
  { id: "claro", label: "Claro", icon: Sun },
  { id: "oscuro", label: "Oscuro", icon: Moon },
];

export function MenuUsuario({ usuarioActual, config, onCerrar, onAjustes, onEquipo, onSalir }) {
  const [tema, setTema] = useState(temaGuardado());
  const [confirmSalir, setConfirmSalir] = useState(false);
  const [aviso, setAviso] = useState("");
  const [puedeInstalar, setPuedeInstalar] = useState(!!window.__instalarApp);
  const esAdmin = usuarioActual.roles.includes("admin");

  useEffect(() => {
    const alLlegar = () => setPuedeInstalar(!!window.__instalarApp);
    window.addEventListener("instalar-disponible", alLlegar);
    return () => window.removeEventListener("instalar-disponible", alLlegar);
  }, []);

  const elegirTema = (id) => { vibrar(); guardarTema(id); setTema(id); };
  const cambiarClave = async () => {
    setAviso("");
    const r = await enviarCorreoCambioClave(usuarioActual.correo);
    setAviso(r.ok ? `Te enviamos un correo a ${usuarioActual.correo} para crear una clave nueva.` : "No se pudo enviar el correo. Revisa tu conexión.");
  };
  const instalar = async () => {
    const ev = window.__instalarApp;
    if (!ev) return;
    ev.prompt();
    try { await ev.userChoice; } catch (e) {}
    window.__instalarApp = null;
    setPuedeInstalar(false);
  };
  const ir = (fn) => () => { onCerrar(); fn(); };

  const Fila = ({ icon: Icon, titulo, sub, onClick, peligro }) => (
    <button style={{ ...s.fila, color: peligro ? "#C1442D" : K.ink }} onClick={onClick}>
      <span style={{ ...s.filaIcono, color: peligro ? "#C1442D" : K.sub }}><Icon size={17} strokeWidth={1.9} /></span>
      <span style={s.filaTexto}>
        <span style={s.filaTitulo}>{titulo}</span>
        {sub && <span style={s.filaSub}>{sub}</span>}
      </span>
      {!peligro && <ChevronRight size={16} color={K.faint} />}
    </button>
  );

  return (
    <div style={s.overlay} onClick={onCerrar}>
      <div style={s.hoja} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Mi cuenta">
        <div style={s.cabecera}>
          <div style={s.avatar}>{(usuarioActual.nombre || "?").trim().charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.nombre}>{usuarioActual.nombre}</div>
            <div style={s.correo}>{usuarioActual.correo}</div>
            <span style={s.rol}>{rolesLabel(usuarioActual)}</span>
          </div>
          <button style={s.cerrarBtn} onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div style={s.etiqueta}>APARIENCIA</div>
        <div style={s.segmentado}>
          {TEMAS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} style={{ ...s.segBtn, ...(tema === t.id ? s.segBtnOn : {}) }} onClick={() => elegirTema(t.id)}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        <div style={s.etiqueta}>CUENTA</div>
        <div style={s.grupo}>
          {esAdmin && <Fila icon={SlidersHorizontal} titulo="Ajustes del negocio" sub="Marca, estaciones e inventario" onClick={ir(onAjustes)} />}
          {esAdmin && <Fila icon={Users} titulo="Equipo y usuarios" sub="Cuentas, roles y propiedad" onClick={ir(onEquipo)} />}
          <Fila icon={KeyRound} titulo="Cambiar mi clave" sub="Te llega un correo para crear una nueva" onClick={cambiarClave} />
          {puedeInstalar && <Fila icon={Download} titulo="Instalar la app" sub="Ábrela como una app, desde tu pantalla de inicio" onClick={instalar} />}
        </div>
        {aviso && <div style={s.aviso}><Check size={14} /> {aviso}</div>}

        {!confirmSalir ? (
          <div style={s.grupo}><Fila icon={LogOut} titulo="Cerrar sesión" peligro onClick={() => { setConfirmSalir(true); setAviso(""); }} /></div>
        ) : (
          <div style={s.confirmar}>
            <div style={{ fontSize: 14, fontWeight: 600, color: K.ink }}>¿Cerrar la sesión en este equipo?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btnGhost} onClick={() => setConfirmSalir(false)}>Cancelar</button>
              <button style={s.btnSalir} onClick={onSalir}>Cerrar sesión</button>
            </div>
          </div>
        )}

        <div style={s.pie}>{(config.businessName || "Comandas")} · v{VERSION}</div>
      </div>
    </div>
  );
}

const s = {
  overlay: { position: "fixed", inset: 0, zIndex: 70, background: "rgba(10,8,5,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "fadeIn .18s ease" },
  hoja: { width: "100%", maxWidth: 440, maxHeight: "92dvh", overflowY: "auto", background: K.bg, borderRadius: "22px 22px 0 0", padding: "18px 16px calc(16px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 10, animation: "sheetUp .24s cubic-bezier(.2,.8,.2,1)", color: K.ink },
  cabecera: { display: "flex", alignItems: "center", gap: 14, padding: "4px 2px 8px" },
  avatar: { width: 52, height: 52, borderRadius: 26, background: "var(--accent)", color: K.cream, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, flexShrink: 0 },
  nombre: { fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, lineHeight: 1.15, color: K.ink },
  correo: { fontSize: 12.5, color: K.muted, margin: "1px 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rol: { display: "inline-block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "3px 9px", borderRadius: 9, background: K.soft, color: K.sub },
  cerrarBtn: { alignSelf: "flex-start", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: K.surface, color: K.sub, border: `1px solid ${K.border}`, borderRadius: 16, cursor: "pointer", flexShrink: 0 },
  etiqueta: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.3, color: K.faint, fontWeight: 700, margin: "6px 2px 0" },
  segmentado: { display: "flex", background: K.soft, borderRadius: 12, padding: 3, gap: 2 },
  segBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 6px", border: "none", borderRadius: 9, background: "transparent", color: K.sub, fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  segBtnOn: { background: K.surface, color: K.ink, boxShadow: "0 1px 3px rgba(0,0,0,.18)" },
  grupo: { background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" },
  fila: { display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${K.border}`, cursor: "pointer", textAlign: "left", width: "100%" },
  filaIcono: { width: 30, height: 30, borderRadius: 9, background: K.soft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  filaTexto: { display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 },
  filaTitulo: { fontSize: 14.5, fontWeight: 600 },
  filaSub: { fontSize: 11.5, color: K.muted, fontWeight: 400 },
  aviso: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--c-5b7553-t)", fontWeight: 600, padding: "0 4px" },
  confirmar: { background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  btnGhost: { flex: 1, padding: "11px 12px", background: "transparent", color: K.sub, border: `1px solid ${K.border}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  btnSalir: { flex: 1, padding: "11px 12px", background: "#C1442D", color: K.cream, border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
  pie: { textAlign: "center", fontSize: 11, color: K.faint, letterSpacing: 0.5, marginTop: 4 },
};

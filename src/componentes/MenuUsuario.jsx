import React, { useState, useEffect } from "react";
import { X, Sun, Moon, Palette, UserRound, Settings, SlidersHorizontal, Users, KeyRound, Download, LogOut, ChevronRight, Check, UtensilsCrossed, LayoutGrid, DatabaseBackup, BookOpen, Keyboard, BarChart3, Printer, FileCheck2, Wallet } from "lucide-react";
import { AyudaRoles } from "./AyudaRoles.jsx";
import { HojaAtajos } from "./HojaAtajos.jsx";
import { MisPropinas } from "./MisPropinas.jsx";
import { guardarTema, temaGuardado, vibrar } from "../theme.js";
import { enviarCorreoCambioClave } from "../firebase.js";
import { rolesLabel } from "../utilidades.js";
import { VERSION } from "../constantes.js";
import { Hoja } from "./Hoja.jsx";
import { Segmentado } from "./Comunes.jsx";
import { Transicion } from "../movimiento.jsx";
import { ImpresoraTermica } from "./ImpresoraTermica.jsx";

/*
 * Menú de la persona que inició sesión: se abre al tocar su nombre en la barra de arriba.
 * (Antes ese toque cerraba la sesión directamente.)
 */
const K = {
  bg: "var(--c-f7f4ec-b)", surface: "var(--c-fffdf8-b)", soft: "var(--c-ede7d8-b)", border: "var(--c-e4dfce-o)",
  ink: "var(--c-242019-t)", muted: "var(--c-8a8272-t)", sub: "var(--c-5c5648-t)", faint: "var(--c-9a9382-t)", cream: "#F4F6F8",
};
const TEMAS = [
  { id: "claro", label: "Claro", icon: Sun },
  { id: "oscuro", label: "Oscuro", icon: Moon },
];

export function MenuUsuario({ usuarioActual, config, onCerrar, onIr, onSalir }) {
  const [tema, setTema] = useState(temaGuardado());
  const [confirmSalir, setConfirmSalir] = useState(false);
  const [aviso, setAviso] = useState("");
  const esAdminU = usuarioActual.roles.includes("admin");
  const [seccion, setSeccion] = useState(esAdminU ? "admin" : "cuenta"); // pastilla activa
  const [verAyuda, setVerAyuda] = useState(false);
  const [verAtajos, setVerAtajos] = useState(false);
  const [verPropinas, setVerPropinas] = useState(false);
  const tieneTeclado = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const [verImpresora, setVerImpresora] = useState(false);
  const [confirmClave, setConfirmClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [puedeInstalar, setPuedeInstalar] = useState(!!window.__instalarApp);
  const esAdmin = usuarioActual.roles.includes("admin");

  useEffect(() => {
    const alLlegar = () => setPuedeInstalar(!!window.__instalarApp);
    window.addEventListener("instalar-disponible", alLlegar);
    return () => window.removeEventListener("instalar-disponible", alLlegar);
  }, []);

  const elegirTema = (id) => { vibrar(); guardarTema(id); setTema(id); };
  const cambiarClave = async () => {
    setAviso(""); setEnviando(true);
    const r = await enviarCorreoCambioClave(usuarioActual.correo);
    setEnviando(false); setConfirmClave(false);
    setAviso(r.ok ? `Listo: te enviamos un correo a ${usuarioActual.correo} para crear una clave nueva.` : "No se pudo enviar el correo. Revisa tu conexión.");
  };
  const instalar = async () => {
    const ev = window.__instalarApp;
    if (!ev) return;
    ev.prompt();
    try { await ev.userChoice; } catch (e) {}
    window.__instalarApp = null;
    setPuedeInstalar(false);
  };
  const Fila = ({ icon: Icon, titulo, sub, onClick, peligro }) => (
    <button className="fila-tap" style={{ ...s.fila, color: peligro ? "var(--c-c1442d-t)" : K.ink }} onClick={onClick}>
      <span style={{ ...s.filaIcono, color: peligro ? "var(--c-c1442d-t)" : K.sub }}><Icon size={17} strokeWidth={1.9} /></span>
      <span style={s.filaTexto}>
        <span style={s.filaTitulo}>{titulo}</span>
        {sub && <span style={s.filaSub}>{sub}</span>}
      </span>
      {!peligro && <ChevronRight size={16} color={K.faint} />}
    </button>
  );

  if (verAtajos) return <HojaAtajos onCerrar={() => setVerAtajos(false)} />;
  if (verPropinas) return <MisPropinas usuarioActual={usuarioActual} onCerrar={() => setVerPropinas(false)} />;
  if (verAyuda) return <AyudaRoles usuario={usuarioActual} config={config} onCerrar={() => setVerAyuda(false)} />;
  if (verImpresora) return <ImpresoraTermica onCerrar={() => setVerImpresora(false)} />;
  return (
    <Hoja onCerrar={onCerrar} ancho={440} gap={10} label="Mi cuenta" z={300} centro bajoBarra>
      {({ cerrar }) => {
        const ir = (fn) => () => { fn(); cerrar(); };
        return (
      <>
        <div style={s.cabecera}>
          <div style={s.avatar}>{(usuarioActual.nombre || "?").trim().charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.nombre}>{usuarioActual.nombre}</div>
            <div style={s.correo}>{usuarioActual.correo}</div>
            <span style={s.rol}>{rolesLabel(usuarioActual)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignSelf: "flex-start" }}>
            <button className="toque44" style={s.cerrarBtn} onClick={cerrar} aria-label="Cerrar"><X size={16} /></button>
            <button className="toque44" style={s.cerrarBtn} onClick={() => elegirTema(tema === "oscuro" ? "claro" : "oscuro")} aria-label={tema === "oscuro" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} title={tema === "oscuro" ? "Tema claro" : "Tema oscuro"}>
              {tema === "oscuro" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Pastillas: un solo indicador se desliza de una a otra; cada una muestra solo su sección */}
        {esAdmin && <Segmentado className="seg--neutro" ariaLabel="Secciones de la cuenta" radio={9} style={s.segmentado}>
          <button role="tab" aria-selected={seccion === "admin"} style={s.segBtn} onClick={() => setSeccion("admin")}><Settings size={14} /> Administración</button>
          <button role="tab" aria-selected={seccion === "cuenta"} style={s.segBtn} onClick={() => setSeccion("cuenta")}><UserRound size={14} /> Mi cuenta</button>
        </Segmentado>}

        {/* La altura se anima al cambiar de pestaña: la ventana se acomoda despacio, sin saltos ni huecos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        <Transicion clave={seccion} indice={seccion === "admin" ? 0 : 1}>
        {seccion === "admin" && esAdmin && (
          <div style={s.grupo}>
            <Fila icon={UtensilsCrossed} titulo="Menú y precios" sub="Productos, categorías y agotados" onClick={ir(() => onIr("menu"))} />
            <Fila icon={LayoutGrid} titulo="Mesas y plano" sub="Mesas, espacios y su distribución" onClick={ir(() => onIr("mesas"))} />
            <Fila icon={Users} titulo="Equipo y usuarios" sub="Cuentas, roles y propiedad" onClick={ir(() => onIr("equipo"))} />
            <Fila icon={BarChart3} titulo="Análisis y reportes" sub="Reportes por período, comparativos, rentabilidad y pérdidas" onClick={ir(() => onIr("analisis"))} />
            <Fila icon={FileCheck2} titulo="Facturación electrónica" sub="Proveedor DIAN, impuestos y resolución" onClick={ir(() => onIr("facturacion"))} />
            <Fila icon={DatabaseBackup} titulo="Respaldos y datos" sub="Copias de seguridad y restauración" onClick={ir(() => onIr("respaldos"))} />
            <Fila icon={SlidersHorizontal} titulo="Ajustes del negocio" sub="Marca, estaciones e inventario" onClick={ir(() => onIr("ajustes"))} />
          </div>
        )}

        {seccion === "cuenta" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={s.grupo}>
              <Fila icon={Wallet} titulo="Mis propinas" sub="Lo pendiente y lo que ya te entregaron" onClick={() => setVerPropinas(true)} />
              <Fila icon={BookOpen} titulo="Cómo se usa la app" sub="Guía corta según tu rol" onClick={() => setVerAyuda(true)} />
              {tieneTeclado && <Fila icon={Keyboard} titulo="Atajos de teclado" sub="Moverte más rápido desde un computador" onClick={() => setVerAtajos(true)} />}
              <Fila icon={Printer} titulo="Impresora de tickets" sub="Imprime cuentas y pedidos de cocina" onClick={() => setVerImpresora(true)} />
              <Fila icon={KeyRound} titulo="Cambiar mi clave" sub="Te enviamos un enlace a tu correo" onClick={() => { setConfirmClave(true); setAviso(""); setConfirmSalir(false); }} />
              {puedeInstalar && <Fila icon={Download} titulo="Instalar la app" sub="Ábrela desde tu pantalla de inicio" onClick={instalar} />}
              <Fila icon={LogOut} titulo="Cerrar sesión" peligro onClick={() => { setConfirmSalir(true); setAviso(""); setConfirmClave(false); }} />
            </div>
            {confirmClave && (
              <div style={s.confirmar} className="anim-in">
                <div style={{ fontSize: 14, fontWeight: 600, color: K.ink }}>¿Enviar correo para cambiar tu clave?</div>
                <div style={{ fontSize: 12.5, color: K.muted, lineHeight: 1.45 }}>Te llegará un enlace a <b style={{ color: K.sub }}>{usuarioActual.correo}</b>. Desde ahí creas la clave nueva; la actual sigue funcionando hasta que la cambies.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={s.btnGhost} onClick={() => setConfirmClave(false)}>Cancelar</button>
                  <button style={{ ...s.btnSalir, background: "var(--accent)", opacity: enviando ? 0.6 : 1 }} disabled={enviando} onClick={cambiarClave}>{enviando ? "Enviando…" : "Enviar correo"}</button>
                </div>
              </div>
            )}
          </div>
        )}
        </Transicion>

        {aviso && <div style={s.aviso}><Check size={14} /> {aviso}</div>}
        {confirmSalir && (
          <div style={s.confirmar} className="anim-in">
            <div style={{ fontSize: 14, fontWeight: 600, color: K.ink }}>¿Cerrar la sesión en este equipo?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btnGhost} onClick={() => setConfirmSalir(false)}>Cancelar</button>
              <button style={s.btnSalir} onClick={onSalir}>Cerrar sesión</button>
            </div>
          </div>
        )}

        </div>

        <div style={s.pie}>{(config.businessName || "Comandas")} · v{VERSION}</div>
      </>
        );
      }}
    </Hoja>
  );
}

const s = {
  cabecera: { display: "flex", alignItems: "center", gap: 14, padding: "4px 2px 8px" },
  avatar: { width: 52, height: 52, borderRadius: 26, background: "var(--accent)", color: K.cream, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, flexShrink: 0 },
  nombre: { fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, lineHeight: 1.15, color: K.ink },
  correo: { fontSize: 12.5, color: K.muted, margin: "1px 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rol: { display: "inline-block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "3px 9px", borderRadius: 9, background: K.soft, color: K.sub },
  cerrarBtn: { alignSelf: "flex-start", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: K.surface, color: K.sub, border: `1px solid ${K.border}`, borderRadius: 16, cursor: "pointer", flexShrink: 0 },
  etiqueta: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.3, color: K.faint, fontWeight: 700, margin: "6px 2px 0" },
  segmentado: { display: "flex", background: K.soft, borderRadius: 12, padding: 3, gap: 2, flexShrink: 0 },
  segBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 6px", border: "none", borderRadius: 9, background: "transparent", color: K.sub, fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  segBtnOn: { background: "var(--seg-thumb)", color: K.ink, boxShadow: "0 1px 3px rgba(0,0,0,.18)" },
  grupo: { background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" },
  fila: { display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${K.border}`, cursor: "pointer", textAlign: "left", width: "100%" },
  filaIcono: { width: 30, height: 30, borderRadius: 9, background: K.soft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  filaTexto: { display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 },
  filaTitulo: { fontSize: 14.5, fontWeight: 600 },
  filaSub: { fontSize: 11.5, color: K.muted, fontWeight: 400 },
  aviso: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--c-5b7553-t)", fontWeight: 600, padding: "0 4px" },
  confirmar: { background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  btnGhost: { flex: 1, padding: "11px 12px", background: "transparent", color: K.sub, border: `1px solid ${K.border}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  btnSalir: { flex: 1, padding: "11px 12px", background: "var(--danger-solid)", color: K.cream, border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
  temaCard: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: "solid", borderColor: K.border, background: K.surface, color: K.ink, cursor: "pointer" },
  temaCardOn: { borderColor: "var(--accent)" },
  temaMuestra: { width: "100%", height: 56, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${K.border}` },
  pie: { textAlign: "center", fontSize: 11, color: K.faint, letterSpacing: 0.5, marginTop: 4 },
};

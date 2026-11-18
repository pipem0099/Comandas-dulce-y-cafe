import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, CheckCircle2, AlertTriangle } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { InfoTip } from "./InfoTip.jsx";
import { styles } from "../estilos.js";
import { impresora, TIPOS } from "../termica/impresora.js";
import { ticketPrueba } from "../termica/tickets.js";

/* Configuración de la impresora de tickets de ESTE equipo: conectar, papel, prueba e impresión automática de cocina. */
const etiqueta = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.1, fontWeight: 700, color: "var(--btn2-mute)", marginTop: 4 };

export function ImpresoraTermica({ onCerrar }) {
  const [est, setEst] = useState(impresora.estado());
  const [cfg, setCfg] = useState(impresora.config());
  const [mensaje, setMensaje] = useState(null);   // { ok, texto }
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => impresora.observar(() => { setEst(impresora.estado()); setCfg(impresora.config()); }), []);
  const disp = impresora.disponibles();
  const tipos = Object.keys(TIPOS).filter((t) => disp[t]);

  const conectar = async (tipo) => {
    setOcupado(true); setMensaje(null);
    try { const r = await impresora.conectar(tipo); setMensaje({ ok: true, texto: `Conectada: ${r.nombre}. Toca «Probar impresión» para comprobarla.` }); }
    catch (e) { setMensaje({ ok: false, texto: (e && e.message) || "No se pudo conectar." }); }
    setOcupado(false);
  };
  const probar = async () => {
    setOcupado(true); setMensaje(null);
    const r = await impresora.imprimir(ticketPrueba({ columnas: cfg.columnas, tabla: cfg.tabla, nombre: est.nombre }));
    setMensaje(r.ok ? { ok: true, texto: "Enviado a la impresora. Si salió bien, con tildes y sin letras raras, ya está lista." } : { ok: false, texto: r.motivo });
    setOcupado(false);
  };
  const pill = (activo) => ({ ...styles.propinaPill, ...(activo ? styles.pillOn : {}) });

  return createPortal(
    <Hoja onCerrar={onCerrar} ancho={480} gap={12} label="Impresora de tickets" z={85}>
      {({ cerrar }) => (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" }}>Impresora de tickets</div>
            <InfoTip titulo="¿Cómo conecto mi impresora?">
              <b>USB o Bluetooth de bajo consumo:</b> toca el tipo de conexión y elige tu impresora en la lista que muestra el navegador (Chrome o Edge).
              <br /><br /><b>Bluetooth clásico</b> (la mayoría de las impresoras baratas de 58 mm): instala la app gratuita <b>RawBT</b> en el celular, empareja allí la impresora y aquí elige «RawBT (Android)».
              <br /><br /><b>iPhone y iPad:</b> Safari no deja conectar impresoras directamente. Usa la impresión normal (AirPrint) desde el botón Imprimir.
              <br /><br />La impresora se guarda solo en este equipo. Cada tablet o computador tiene la suya.
            </InfoTip>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, background: "var(--btn2-bg)", border: "1px solid var(--btn2-line)" }}>
            <Printer size={20} color="var(--btn2-mute)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--c-242019-t)" }}>{est.configurada ? est.nombre || TIPOS[est.tipo] : "Sin impresora en este equipo"}</div>
              <div style={{ fontSize: 12.5, color: "var(--btn2-mute)" }}>{est.configurada ? `${TIPOS[est.tipo]} · ${est.conectada ? "lista" : "desconectada: toca el tipo para volver a conectar"}` : "Mientras tanto se imprime con el navegador."}</div>
            </div>
          </div>

          <div style={etiqueta}>CONEXIÓN</div>
          {tipos.length === 0 ? <div style={{ fontSize: 13.5, color: "var(--c-5c5648-t)" }}>Este navegador no permite conectar impresoras. Usa Chrome en Android o computador, o la impresión normal.</div> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tipos.map((t) => <button key={t} style={pill(est.tipo === t)} disabled={ocupado} aria-pressed={est.tipo === t} onClick={() => conectar(t)}>{TIPOS[t]}</button>)}
            </div>
          )}

          <div style={etiqueta}>PAPEL</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[[32, "58 mm"], [48, "80 mm"]].map(([c, n]) => <button key={c} style={pill(cfg.columnas === c)} aria-pressed={cfg.columnas === c} onClick={() => impresora.guardarConfig({ columnas: c })}>{n}</button>)}
          </div>

          <div style={etiqueta}>LETRAS</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[[19, "Con tildes"], [0, "Sin tildes"]].map(([t, n]) => <button key={t} style={pill(cfg.tabla === t)} aria-pressed={cfg.tabla === t} onClick={() => impresora.guardarConfig({ tabla: t })}>{n}</button>)}
          </div>
          <div style={{ fontSize: 12, color: "var(--btn2-mute)", marginTop: -4 }}>Si en la prueba salen símbolos raros en lugar de tildes, elige «Sin tildes».</div>

          <button style={{ ...styles.btnRestringido, justifyContent: "center", opacity: est.configurada && !ocupado ? 1 : 0.5 }} disabled={!est.configurada || ocupado} onClick={probar}><Printer size={16} /> Probar impresión</button>

          <div style={etiqueta}>EN LA COCINA</div>
          <button style={{ ...styles.btnRestringido, justifyContent: "space-between", opacity: est.configurada ? 1 : 0.5 }} disabled={!est.configurada} aria-pressed={cfg.autoCocina}
            onClick={() => impresora.guardarConfig({ autoCocina: !cfg.autoCocina, activadoTs: Date.now() })}>
            <span style={{ textAlign: "left" }}>Imprimir los pedidos nuevos automáticamente en este equipo</span>
            <span style={{ fontWeight: 700, color: cfg.autoCocina ? "var(--chip-on-fg)" : "var(--btn2-mute)", background: cfg.autoCocina ? "var(--chip-on-bg)" : "transparent", padding: "2px 10px", borderRadius: 999, flexShrink: 0 }}>{cfg.autoCocina ? "Activado" : "Apagado"}</span>
          </button>
          <div style={{ fontSize: 12, color: "var(--btn2-mute)", marginTop: -4 }}>Úsalo en el equipo de la cocina. Solo salen los pedidos que lleguen después de activarlo, y cada uno una sola vez.</div>

          <div style={etiqueta}>EN EL EQUIPO DEL MESERO</div>
          <button style={{ ...styles.btnRestringido, justifyContent: "space-between", opacity: est.configurada ? 1 : 0.5 }} disabled={!est.configurada} aria-pressed={!!cfg.imprimirAlEnviar}
            onClick={() => impresora.guardarConfig({ imprimirAlEnviar: !cfg.imprimirAlEnviar })}>
            <span style={{ textAlign: "left" }}>Imprimir la comanda al enviar el pedido</span>
            <span style={{ fontWeight: 700, color: cfg.imprimirAlEnviar ? "var(--chip-on-fg)" : "var(--btn2-mute)", background: cfg.imprimirAlEnviar ? "var(--chip-on-bg)" : "transparent", padding: "2px 10px", borderRadius: 999, flexShrink: 0 }}>{cfg.imprimirAlEnviar ? "Activado" : "Apagado"}</span>
          </button>
          <div style={{ fontSize: 12, color: "var(--btn2-mute)", marginTop: -4 }}>Al enviar un pedido (o cambiarlo) sale la comanda de inmediato, también sin internet. Si la impresora falla, el pedido se envía igual y aparece «Reintentar». La pantalla de Cocina no repite lo que ya salió aquí.</div>

          {mensaje && (
            <div role="status" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.45, background: mensaje.ok ? "var(--chip-on-bg)" : "var(--btn2-bg)", color: mensaje.ok ? "var(--chip-on-fg)" : "var(--c-c1442d-t)" }}>
              {mensaje.ok ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
              <span>{mensaje.texto}</span>
            </div>
          )}

          {est.configurada && <button style={{ ...styles.cancelEditBtn, color: "var(--c-c1442d-t)" }} onClick={() => impresora.desconectar()}>Quitar la impresora de este equipo</button>}
          <button style={styles.cancelEditBtn} onClick={cerrar}>Cerrar</button>
        </>
      )}
    </Hoja>,
    document.body
  );
}

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, CheckCircle2, AlertTriangle } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { InfoTip } from "./InfoTip.jsx";
import { Grupo, FilaIos, Interruptor } from "./FilasIos.jsx";
import { styles } from "../estilos.js";
import { impresora, TIPOS } from "../termica/impresora.js";
import { ticketPrueba } from "../termica/tickets.js";

/* Configuración de la impresora de tickets de ESTE equipo: conectar, papel, prueba e impresión automática de cocina. */

export function ImpresoraTermica({ onCerrar }) {
  const [est, setEst] = useState(impresora.estado());
  const [cfg, setCfg] = useState(impresora.config());
  const [mensaje, setMensaje] = useState(null);   // { ok, texto }
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => impresora.observar(() => { setEst(impresora.estado()); setCfg(impresora.config()); }), []);
  const disp = impresora.disponibles();
  const tipos = Object.keys(TIPOS).filter((t) => disp[t]);

  const [tipoSel, setTipoSel] = useState(null);   // el tipo solo se ELIGE; la ventana del navegador se abre al tocar «Buscar impresora»
  const tipoActual = tipoSel || (est.tipo && tipos.includes(est.tipo) ? est.tipo : tipos[0]);
  const AYUDA_TIPO = {
    bluetooth: "Enciende la impresora y activa el Bluetooth del teléfono. Luego toca «Buscar impresora» y elígela en la lista.",
    usb: "Conecta la impresora con el cable USB y enciéndela. Luego toca «Buscar impresora» y elígela en la lista.",
    serial: "Para impresoras con adaptador USB-serie, sobre todo en computador. Toca «Buscar impresora» y elige el puerto.",
    rawbt: "Imprime a través de la app RawBT instalada en este teléfono.",
  };
  const conectar = async (tipo) => {
    setOcupado(true); setMensaje(null);
    if (tipo === "bluetooth" && navigator.bluetooth && navigator.bluetooth.getAvailability) {
      let hay = true;
      try { hay = await navigator.bluetooth.getAvailability(); } catch (e) { hay = true; }
      if (!hay) { setMensaje({ ok: false, texto: "El Bluetooth de este equipo está apagado. Actívalo desde los ajustes rápidos del teléfono y vuelve a intentarlo." }); setOcupado(false); return; }
    }
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
              <b>USB o Bluetooth de bajo consumo:</b> elige el tipo de conexión, toca «Buscar impresora» y elige la tuya en la lista que muestra el navegador (Chrome o Edge).
              <br /><br /><b>Bluetooth clásico</b> (la mayoría de las impresoras baratas de 58 mm): instala la app gratuita <b>RawBT</b> en el celular, empareja allí la impresora y aquí elige «RawBT (Android)».
              <br /><br /><b>iPhone y iPad:</b> Safari no deja conectar impresoras directamente. Usa la impresión normal (AirPrint) desde el botón Imprimir.
              <br /><br />La impresora se guarda solo en este equipo. Cada tablet o computador tiene la suya.
            </InfoTip>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, background: "var(--btn2-bg)", border: "1px solid var(--btn2-line)" }}>
            <Printer size={20} color="var(--btn2-mute)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--c-242019-t)" }}>{est.configurada ? est.nombre || TIPOS[est.tipo] : "Sin impresora en este equipo"}</div>
              <div style={{ fontSize: 12.5, color: "var(--btn2-mute)" }}>{est.configurada ? `${TIPOS[est.tipo]} · ${est.conectada ? "lista" : "desconectada: toca «Volver a conectar»"}` : "Mientras tanto se imprime con el navegador."}</div>
            </div>
          </div>

          <Grupo titulo="Conexión">
            {tipos.length === 0
              ? <FilaIos etiqueta="Sin soporte" ultima info={<InfoTip titulo="Este navegador">Este navegador no permite conectar impresoras. Usa Chrome en Android o computador, o la impresión normal.</InfoTip>}><span /></FilaIos>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 14px 14px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{tipos.map((t) => <button key={t} style={pill(tipoActual === t)} disabled={ocupado} aria-pressed={tipoActual === t} onClick={() => setTipoSel(t)}>{TIPOS[t]}</button>)}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--btn2-mute)" }}>{AYUDA_TIPO[tipoActual]}</div>
                <button type="button" disabled={ocupado} onClick={() => conectar(tipoActual)} style={{ ...styles.modoChoiceBtn, minHeight: 44, justifyContent: "center" }}>{ocupado ? "Buscando…" : est.configurada && est.tipo === tipoActual ? "Volver a conectar" : "Buscar impresora"}</button>
              </div>}
          </Grupo>

          <Grupo titulo="Impresión">
            <FilaIos etiqueta="Papel">
              {[[32, "58 mm"], [48, "80 mm"]].map(([c, n]) => <button key={c} style={pill(cfg.columnas === c)} aria-pressed={cfg.columnas === c} onClick={() => impresora.guardarConfig({ columnas: c })}>{n}</button>)}
            </FilaIos>
            <FilaIos etiqueta="Letras" ultima info={<InfoTip titulo="Letras">Si en la prueba salen símbolos raros en lugar de tildes, elige «Sin tildes».</InfoTip>}>
              {[[19, "Con tildes"], [0, "Sin tildes"]].map(([t, n]) => <button key={t} style={pill(cfg.tabla === t)} aria-pressed={cfg.tabla === t} onClick={() => impresora.guardarConfig({ tabla: t })}>{n}</button>)}
            </FilaIos>
          </Grupo>

          <button style={{ ...styles.btnRestringido, justifyContent: "center", opacity: est.configurada && !ocupado ? 1 : 0.5 }} disabled={!est.configurada || ocupado} onClick={probar}><Printer size={16} /> Probar impresión</button>

          <Grupo titulo="Automático">
            <FilaIos etiqueta="Cocina: pedidos nuevos" info={<InfoTip titulo="Cocina: pedidos nuevos">Úsalo en el equipo de la cocina. Imprime automáticamente los pedidos nuevos en este equipo. Solo salen los que lleguen después de activarlo, y cada uno una sola vez.</InfoTip>}>
              <Interruptor etiqueta="Imprimir pedidos nuevos automáticamente" valor={!!cfg.autoCocina} disabled={!est.configurada} onChange={(v) => impresora.guardarConfig({ autoCocina: v, activadoTs: Date.now() })} />
            </FilaIos>
            <FilaIos etiqueta="Mesero: al enviar" ultima info={<InfoTip titulo="Mesero: al enviar">Al enviar un pedido (o cambiarlo) sale la comanda de inmediato, también sin internet. Si la impresora falla, el pedido se envía igual y aparece «Reintentar».</InfoTip>}>
              <Interruptor etiqueta="Imprimir la comanda al enviar el pedido" valor={!!cfg.imprimirAlEnviar} disabled={!est.configurada} onChange={(v) => impresora.guardarConfig({ imprimirAlEnviar: v })} />
            </FilaIos>
          </Grupo>

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

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Mail, Ban, Send, ChevronDown, Printer } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { InfoTip } from "./InfoTip.jsx";
import { styles } from "../estilos.js";
import { emitirFacturaCuenta, solicitarFacturacion } from "../firebase.js";
import { ErrorReintentable } from "../facturacion/cliente.js";
import { estadoFactura, debeEmitirSola, debeReintentarSola, urlPdf } from "../facturacion/estado.js";
import { impresora } from "../termica/impresora.js";
import { ticketFactura } from "../termica/tickets.js";
import { textoQr } from "../facturacion/qr.js";
import { AlertasFiscales } from "./AlertasFiscales.jsx";
import { alertaTopeUvt } from "../../tools/facturacion/alertas.mjs";
import { generarPdfSimulado, lineasDelPdf } from "../facturacion/pdfSimulado.js";
import { useDocumentoFactura } from "../useFacturacion.js";

/*
 * Factura electrónica de UNA cuenta ya cobrada (se muestra en Caja, en «Por liberar»).
 *  · «Emitir factura» (y emisión automática al cobrar si el administrador la activó).
 *  · Estado: Pendiente de envío · Emitida · Error · Anulada, con número, CUFE y PDF.
 *  · «Reenviar por correo» (caja y administrador) · «Anular factura (Nota Crédito)» SOLO administrador, con motivo obligatorio.
 * La app no calcula ni decide nada fiscal aquí: pide al servidor, que verifica el rol, recalcula los montos y evita duplicados.
 */
const TONOS = { ok: "var(--pago-ok)", info: "var(--btn2-fg)", error: "var(--c-c1442d-t)", neutro: "var(--btn2-mute)", alerta: "var(--btn2-fg)" };
const btn = { minHeight: 44, padding: "0 14px", borderRadius: 12, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-body)" };
const btnPeligro = { ...btn, color: "var(--c-c1442d-t)" };
const titulo = { fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" };
const corto = (s) => (s && s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-8)}` : s || "");
const MSG_SIN_RED = "Necesitas internet para esto. Inténtalo cuando vuelva la conexión.";

export function FacturaCuenta({ cuenta, ajustes, esAdmin, enCola, totalDocumento = 0 }) {
  const habilitada = !!(ajustes && ajustes.activa);
  const doc = useDocumentoFactura(cuenta.id, true);
  const est = estadoFactura({ doc: doc || null, enCola, esAdmin });
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok"|"error", texto, detalle? }
  const [dialogo, setDialogo] = useState(null); // "correo" | "anular"
  const [verDetalle, setVerDetalle] = useState(false);
  const intentoAuto = useRef(false);

  const procesar = async (promesa, textoOk) => {
    setTrabajando(true); setAviso(null); setVerDetalle(false);
    try {
      const r = await promesa;
      if (r.enCola) setAviso({ tipo: "ok", texto: "Quedó pendiente de envío. Se enviará sola cuando vuelva el internet." });
      else if (r.cuerpo && r.cuerpo.ok) setAviso({ tipo: "ok", texto: textoOk(r.cuerpo) });
      else setAviso({ tipo: "error", texto: (r.cuerpo && r.cuerpo.mensaje) || "No se pudo completar.", detalle: r.cuerpo && r.cuerpo.detalle });
      return r;
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof ErrorReintentable ? MSG_SIN_RED : "No se pudo completar. Inténtalo de nuevo." });
      return null;
    } finally { setTrabajando(false); }
  };
  const emitir = (extra = {}) => procesar(emitirFacturaCuenta(cuenta.id, extra), (c) => (c.repetido ? "Esa cuenta ya estaba facturada." : "Factura emitida."));

  // Emisión automática: solo cuentas cobradas hace poco, una vez por cuenta y por pantalla (el servidor además evita duplicados entre equipos).
  useEffect(() => {
    if (doc === undefined || intentoAuto.current) return;
    if (debeEmitirSola({ ajustes, cuenta, doc: doc || null, enCola, ahora: Date.now() })) { intentoAuto.current = true; emitir(); }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Reintento automático en segundo plano: solo errores de red «seguros», con espera creciente y tope (el servidor cuenta los intentos).
  const reintentoAuto = est.clave === "error" && est.reintentoAutomatico;
  useEffect(() => {
    if (!reintentoAuto || !doc || trabajando) return undefined;
    const lanzar = () => { if (debeReintentarSola({ ajustes, doc, enCola, ahora: Date.now() })) emitir({ reintentoAuto: true }); };
    const falta = Math.max(1000, ((doc.ts || 0) + 30000) - Date.now());
    const t = setTimeout(lanzar, Math.min(falta, 600000));
    const iv = setInterval(lanzar, 30000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!habilitada && !doc) return null;
  const imprimirTirilla = async (nota = false) => {
    const c = impresora.config();
    if (impresora.estado().configurada) {
      const r = await impresora.imprimir(ticketFactura(doc, { columnas: c.columnas, tabla: c.tabla, nota }));
      setAviso(r.ok ? { tipo: "ok", texto: "Tirilla enviada a la impresora." } : { tipo: "error", texto: r.motivo || "No se pudo imprimir." });
      return;
    }
    // Sin impresora térmica en este equipo: hoja imprimible del navegador (con el texto del QR para consulta en la DIAN).
    const w = window.open("", "_blank", "noopener");
    if (!w) { setAviso({ tipo: "error", texto: "El navegador bloqueó la ventana de impresión." }); return; }
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    w.document.write(`<pre style="font:12px monospace;white-space:pre-wrap;max-width:300px">${esc(lineasDelPdf(doc).join("\n"))}\n\nCUFE/CUDE:\n${esc(doc.cufe || "")}\n\nConsulta (QR): ${esc(textoQr(doc))}</pre>`);
    w.document.close(); w.focus(); w.print();
  };
  const verPdf = () => { const u = urlPdf(doc, generarPdfSimulado); if (u) window.open(u, "_blank", "noopener"); };

  return (
    <div data-factura-estado={est.clave} style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", paddingTop: 8, borderTop: "1px solid var(--btn2-line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <FileText size={15} color="var(--btn2-mute)" aria-hidden="true" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--btn2-mute)" }}>Factura electrónica</span>
        <span data-testid="factura-etiqueta" style={{ fontSize: 13, fontWeight: 800, color: TONOS[est.tono] }}>{est.etiqueta}</span>
        {doc && doc.proveedor === "simulado" && <span style={{ fontSize: 12, color: "var(--btn2-mute)" }}>· simulada</span>}
      </div>
      {(est.clave === "emitida" || est.clave === "anulada") && doc && (
        <div style={{ fontSize: 13, color: "var(--btn2-fg)", lineHeight: 1.5, wordBreak: "break-all" }}>
          <div>Número: <b data-testid="factura-numero">{doc.prefijo && String(doc.numero).startsWith(doc.prefijo) ? doc.numero : `${doc.prefijo || ""}${doc.numero || ""}`}</b></div>
          {doc.cufe && <div title={doc.cufe}>CUFE: <span data-testid="factura-cufe">{corto(doc.cufe)}</span></div>}
          {est.detalle && <div>{est.detalle}</div>}
          {doc.anulacion && doc.anulacion.motivo && <div>Motivo: {doc.anulacion.motivo}</div>}
        </div>
      )}
      {est.clave !== "emitida" && est.clave !== "anulada" && est.detalle && <div style={{ fontSize: 13, color: est.tono === "error" ? "var(--c-c1442d-t)" : "var(--btn2-mute)" }}>{est.detalle}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {habilitada && est.puedeEmitir && <button style={btn} disabled={trabajando} onClick={() => emitir(est.clave === "error" && est.incierto ? { forzar: true } : {})}><Send size={15} /> {est.clave === "error" ? est.etiquetaReintento : "Emitir factura"}</button>}
        {est.puedeVerPdf && doc && <button style={btn} disabled={trabajando} onClick={() => imprimirTirilla(false)}><Printer size={15} /> Imprimir tirilla</button>}
        {est.clave === "anulada" && doc && doc.anulacion && doc.anulacion.numeroNota && <button style={btn} disabled={trabajando} onClick={() => imprimirTirilla(true)}><Printer size={15} /> Tirilla de la Nota Crédito</button>}
        {est.puedeVerPdf && <button style={btn} onClick={verPdf}><FileText size={15} /> Ver / descargar PDF</button>}
        {est.puedeReenviar && <button style={btn} disabled={trabajando} onClick={() => setDialogo("correo")}><Mail size={15} /> Reenviar por correo</button>}
        {est.puedeAnular && <button style={btnPeligro} disabled={trabajando} onClick={() => setDialogo("anular")}><Ban size={15} /> Anular factura (Nota Crédito)</button>}
      </div>
      {habilitada && !doc && <AlertasFiscales testid="alerta-tope-uvt" alertas={[alertaTopeUvt({ tipoDocumento: ajustes.tipoDocumento, totalDocumento, valorUvt: ajustes.valorUvt })].filter(Boolean)} />}
      {est.clave === "error" && est.reintentoAutomatico && <div data-testid="factura-reintento-auto" style={{ fontSize: 12.5, color: "var(--btn2-mute)" }}>Falló la conexión: la app lo reintenta sola en segundo plano. También puedes pulsar «{est.etiquetaReintento}».</div>}
      {est.clave === "error" && est.reintentosAgotados && <div style={{ fontSize: 12.5, color: "var(--btn2-mute)" }}>Se agotaron los reintentos automáticos. Pulsa «{est.etiquetaReintento}» cuando haya conexión.</div>}
      {est.clave === "procesando" && <div style={{ fontSize: 12.5, color: "var(--btn2-mute)" }}>Si esto tarda más de un par de minutos, vuelve a abrir la cuenta: el sistema revisa antes de enviar de nuevo para no facturar dos veces.</div>}
      <div role="status" aria-live="polite">
        {aviso && (
          <div data-testid="factura-aviso" style={{ fontSize: 13, color: aviso.tipo === "error" ? "var(--c-c1442d-t)" : "var(--pago-ok)", fontWeight: 600, display: "flex", flexDirection: "column", gap: 6 }}>
            <span>{aviso.texto}</span>
            {aviso.detalle && esAdmin && (
              <>
                <button type="button" style={{ ...btn, minHeight: 44, width: "fit-content" }} aria-expanded={verDetalle} onClick={() => setVerDetalle((v) => !v)}><ChevronDown size={15} style={{ transform: verDetalle ? "rotate(180deg)" : "none" }} /> Detalle técnico</button>
                {verDetalle && <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, fontWeight: 400, color: "var(--btn2-fg)", background: "var(--btn2-bg)", padding: 10, borderRadius: 10 }}>{aviso.detalle}</pre>}
              </>
            )}
          </div>
        )}
      </div>
      {dialogo === "correo" && <DialogoCorreo inicial={(doc && doc.ultimoCorreo && doc.ultimoCorreo.a) || (doc && doc.payload && doc.payload.cliente && doc.payload.cliente.correo) || (cuenta.datosFiscales && cuenta.datosFiscales.correo) || ""} onCerrar={() => setDialogo(null)}
        onEnviar={(correo) => procesar(solicitarFacturacion({ accion: "reenviar_correo", cuentaId: cuenta.id, correo }), () => `Factura reenviada a ${correo}.`)} />}
      {dialogo === "anular" && esAdmin && <DialogoAnular numero={doc && `${doc.prefijo || ""}${doc.numero || ""}`} onCerrar={() => setDialogo(null)}
        onAnular={(motivo) => procesar(solicitarFacturacion({ accion: "anular", cuentaId: cuenta.id, motivo }), (c) => `Factura anulada. Nota crédito ${(c.documento && c.documento.anulacion && c.documento.anulacion.numeroNota) || ""}.`)} />}
    </div>
  );
}

function DialogoCorreo({ inicial, onEnviar, onCerrar }) {
  const [correo, setCorreo] = useState(inicial);
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
  return createPortal(
    <Hoja onCerrar={onCerrar} ancho={440} gap={10} label="Reenviar factura por correo" z={85}>
      {({ cerrar }) => (
        <>
          <div style={titulo}>Reenviar por correo</div>
          <input style={styles.editInput} type="email" inputMode="email" maxLength={120} placeholder="Correo del cliente" aria-label="Correo del cliente" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          <button style={{ ...styles.sendBtn, opacity: valido ? 1 : 0.4 }} disabled={!valido} onClick={() => { onEnviar(correo.trim()); cerrar(); }}>Enviar factura</button>
          <button style={styles.cancelEditBtn} onClick={cerrar}>Cancelar</button>
        </>
      )}
    </Hoja>, document.body);
}

function DialogoAnular({ numero, onAnular, onCerrar }) {
  const [motivo, setMotivo] = useState("");
  const listo = motivo.trim().length >= 5;
  return createPortal(
    <Hoja onCerrar={onCerrar} ancho={460} gap={10} label="Anular factura electrónica" z={85}>
      {({ cerrar }) => (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={titulo}>Anular factura</div>
            <InfoTip titulo="¿Qué pasa al anular?">Una factura electrónica ya enviada a la DIAN no se borra: se anula emitiendo una Nota Crédito. Queda guardado con tu nombre y el motivo en la bitácora. No se puede deshacer.</InfoTip>
          </div>
          <div style={{ fontSize: 14, color: "var(--c-5c5648-t)", lineHeight: 1.5 }}>Vas a anular la factura <b>{numero}</b> con una Nota Crédito. Escribe el motivo (obligatorio):</div>
          <input autoFocus style={styles.editInput} maxLength={300} placeholder="Ej: error en los datos del cliente" aria-label="Motivo de la anulación" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {!listo && <div style={{ fontSize: 12.5, color: "var(--btn2-mute)" }}>Escribe al menos 5 letras.</div>}
          <button style={{ ...styles.sendBtn, background: "var(--danger-solid)", boxShadow: "none", opacity: listo ? 1 : 0.4 }} disabled={!listo} onClick={() => { onAnular(motivo.trim()); cerrar(); }}><Ban size={15} /> Anular con Nota Crédito</button>
          <button style={styles.cancelEditBtn} onClick={cerrar}>Volver</button>
        </>
      )}
    </Hoja>, document.body);
}

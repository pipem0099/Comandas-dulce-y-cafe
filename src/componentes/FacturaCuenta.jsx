import { imprimir } from "../impresion.jsx";
import { DatosFactura } from "./DatosFactura.jsx";
import { parcharCuenta } from "../cuentasOps.js";
import { etiquetaDocumento } from "../facturacion/datosFiscales.js";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Mail, Ban, Send, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { Despliegue } from "./Comunes.jsx";
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
import { generarPdfSimulado, lineasDelPdf, numeroCompleto } from "../facturacion/pdfSimulado.js";
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
  const [datos, setDatos] = useState(false);   // hoja «Datos para factura»
  const [abierto, setAbierto] = useState(false);   // opciones de una factura ya emitida: plegadas por defecto, se despliegan y se esconden
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
    // Sin impresora térmica en este equipo: se imprime con el mismo sistema de impresión de la app (el de los cierres de caja),
    // que dibuja la tirilla fuera de la pantalla y abre el diálogo del celular. No usa ventanas emergentes (el celular las bloquea).
    imprimir(
      <pre style={{ font: "12px/1.35 monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0, color: "#000" }}>
        {lineasDelPdf(doc).join("\n")}{"\n\nConsulta del documento (QR):\n"}{textoQr(doc)}
      </pre>, { papel: "recibo" });
  };
  const verPdf = () => { const u = urlPdf(doc, generarPdfSimulado); if (u) window.open(u, "_blank", "noopener"); };

  return (
    <div data-factura-estado={est.clave} style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", paddingTop: 10, borderTop: "1px solid var(--c-e4dfce-o)" }}>
      {(() => {
        const plegable = !!doc && (est.clave === "emitida" || est.clave === "anulada");
        const cab = (
          <>
            <span style={{ fontSize: 14, color: "var(--btn2-fg)" }}>Factura electrónica</span>
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span data-testid="factura-etiqueta" style={{ fontSize: 13.5, fontWeight: 600, color: TONOS[est.tono] }}>{est.etiqueta}</span>
              {doc && doc.proveedor === "simulado" && <span style={{ fontSize: 12, color: "var(--btn2-mute)" }}>· simulada</span>}
            </span>
            {plegable && <ChevronDown size={16} aria-hidden="true" style={{ marginLeft: 4, color: "var(--btn2-mute)", transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
          </>
        );
        const fila = { display: "flex", alignItems: "center", gap: 8, minHeight: 36 };
        return plegable
          ? <button type="button" data-testid="factura-alternar" aria-expanded={abierto} aria-label={abierto ? "Ocultar opciones de la factura" : "Ver opciones de la factura"} onClick={() => setAbierto((v) => !v)} style={{ ...fila, minHeight: 44, width: "100%", padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>{cab}</button>
          : <div style={fila}>{cab}</div>;
      })()}
      <Despliegue abierto={!doc || (est.clave !== "emitida" && est.clave !== "anulada") || abierto}><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(est.clave === "emitida" || est.clave === "anulada") && doc && (
        <div style={{ fontSize: 13, color: "var(--btn2-fg)", lineHeight: 1.5, wordBreak: "break-all" }}>
          <div>Número: <b data-testid="factura-numero">{numeroCompleto(doc)}</b></div>
          {doc.cufe && <div title={doc.cufe}>CUFE: <span data-testid="factura-cufe">{corto(doc.cufe)}</span></div>}
          {est.detalle && <div>{est.detalle}</div>}
          {doc.anulacion && doc.anulacion.motivo && <div>Motivo: {doc.anulacion.motivo}</div>}
        </div>
      )}
      {(() => {
        const emitidaOAnulada = est.clave === "emitida" || est.clave === "anulada";
        const c = emitidaOAnulada ? (doc && doc.payload && doc.payload.cliente) : cuenta.datosFiscales;
        const hay = c && c.numero && !c.consumidorFinal && c.tipoDoc !== "CF";
        const texto = hay ? `${c.nombre || ""} · ${etiquetaDocumento(c) || c.numero}` : "Consumidor final";
        return (
          emitidaOAnulada
            ? <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
                <span style={{ fontSize: 14, color: "var(--btn2-fg)" }}>Cliente</span>
                <span data-testid="factura-cliente" style={{ marginLeft: "auto", minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--btn2-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{texto}</span>
              </div>
            : <button type="button" disabled={trabajando} onClick={() => setDatos(true)} aria-label={hay ? "Cambiar datos del cliente" : "Poner datos del cliente"}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}>
                <span style={{ fontSize: 14, color: "var(--btn2-fg)" }}>Cliente</span>
                <span data-testid="factura-cliente" style={{ marginLeft: "auto", minWidth: 0, fontSize: 13.5, fontWeight: 600, color: hay ? "var(--btn2-fg)" : "var(--btn2-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{texto}</span>
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{hay ? "Cambiar" : "Poner datos"}</span>
                <ChevronRight size={15} aria-hidden="true" color="var(--btn2-mute)" style={{ flexShrink: 0 }} />
              </button>
        );
      })()}
      {est.clave !== "emitida" && est.clave !== "anulada" && est.detalle && <div style={{ fontSize: 13, color: est.tono === "error" ? "var(--c-c1442d-t)" : "var(--btn2-mute)" }}>{est.detalle}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {habilitada && est.puedeEmitir && <button style={{ ...btn, flex: "1 1 100%", justifyContent: "center", background: "var(--accent)", color: "#fff", border: "none" }} disabled={trabajando} onClick={() => emitir(est.clave === "error" && est.incierto ? { forzar: true } : {})}><Send size={15} /> {est.clave === "error" ? est.etiquetaReintento : "Emitir factura"}</button>}
        {est.puedeVerPdf && doc && <button style={btn} disabled={trabajando} onClick={() => imprimirTirilla(false)}><Printer size={15} /> Imprimir tirilla</button>}
        {est.clave === "anulada" && doc && doc.anulacion && doc.anulacion.numeroNota && <button style={btn} disabled={trabajando} onClick={() => imprimirTirilla(true)}><Printer size={15} /> Tirilla de la Nota Crédito</button>}
        {est.puedeVerPdf && <button style={btn} onClick={verPdf}><FileText size={15} /> Ver / descargar PDF</button>}
        {est.puedeReenviar && <button style={btn} disabled={trabajando} onClick={() => setDialogo("correo")}><Mail size={15} /> Reenviar por correo</button>}
        {est.puedeAnular && <button style={btnPeligro} disabled={trabajando} onClick={() => setDialogo("anular")}><Ban size={15} /> Anular factura (Nota Crédito)</button>}
      </div>
      </div></Despliegue>
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
      {datos && <DatosFactura valor={cuenta.datosFiscales} onGuardar={(d) => parcharCuenta(cuenta.id, { datosFiscales: d })} onQuitar={() => parcharCuenta(cuenta.id, { datosFiscales: null })} onCerrar={() => setDatos(false)} />}
      {dialogo === "correo" && <DialogoCorreo simulada={!!(doc && doc.proveedor === "simulado")} inicial={(doc && doc.ultimoCorreo && doc.ultimoCorreo.a) || (doc && doc.payload && doc.payload.cliente && doc.payload.cliente.correo) || (cuenta.datosFiscales && cuenta.datosFiscales.correo) || ""} onCerrar={() => setDialogo(null)}
        onEnviar={(correo) => procesar(solicitarFacturacion({ accion: "reenviar_correo", cuentaId: cuenta.id, correo }), () => ((doc && doc.proveedor === "simulado") ? `Envío simulado a ${correo}: en modo de prueba no sale ningún correo real.` : `Factura reenviada a ${correo}.`))} />}
      {dialogo === "anular" && esAdmin && <DialogoAnular numero={doc && `${doc.prefijo || ""}${doc.numero || ""}`} onCerrar={() => setDialogo(null)}
        onAnular={(motivo) => procesar(solicitarFacturacion({ accion: "anular", cuentaId: cuenta.id, motivo }), (c) => `Factura anulada. Nota crédito ${(c.documento && c.documento.anulacion && c.documento.anulacion.numeroNota) || ""}.`)} />}
    </div>
  );
}

function DialogoCorreo({ inicial, simulada, onEnviar, onCerrar }) {
  const [correo, setCorreo] = useState(inicial);
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
  return createPortal(
    <Hoja onCerrar={onCerrar} ancho={440} gap={10} label="Reenviar factura por correo" z={85}>
      {({ cerrar }) => (
        <>
          <div style={titulo}>Reenviar por correo</div>
          {simulada && <div role="note" style={{ fontSize: 13, lineHeight: 1.45, color: "var(--btn2-fg)", background: "var(--btn2-bg)", border: "1px solid var(--btn2-line)", borderRadius: 12, padding: "10px 12px" }}>Esta factura es de <b>prueba (Simulado)</b>: aquí no se envía ningún correo real. Cuando uses un proveedor real (Factus, Alegra, Siigo o Dataico), el correo sale al cliente.</div>}
          <input style={styles.editInput} type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" maxLength={120} placeholder="Correo del cliente" aria-label="Correo del cliente" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          <button style={{ ...styles.sendBtn, opacity: valido ? 1 : 0.4 }} disabled={!valido} onClick={() => { onEnviar(correo.trim()); cerrar(); }}>{simulada ? "Simular envío" : "Enviar factura"}</button>
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

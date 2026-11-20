import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Hoja } from "./Hoja.jsx";
import { Selector } from "./Campos.jsx";
import { InfoTip } from "./InfoTip.jsx";
import { styles } from "../estilos.js";
import { TIPOS_DOC, NIVELES_TRIBUTARIOS, normalizar, validar, etiquetaDocumento } from "../facturacion/datosFiscales.js";

/* Datos del cliente para factura. Guarda y muestra los datos; NO emite factura electrónica (eso lo hace un proveedor autorizado ante la DIAN). */
export function DatosFactura({ valor, onGuardar, onQuitar, onCerrar }) {
  const [f, setF] = useState(() => ({ tipoDoc: "CC", numero: "", nombre: "", correo: "", direccion: "", ...(valor ? { ...valor, numero: valor.numero ? `${valor.numero}${valor.tipoDoc === "NIT" && valor.dv !== "" ? `-${valor.dv}` : ""}` : "" } : {}) }));
  const [intentado, setIntentado] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const { ok, errores } = validar(f);
  const guardar = (cerrar) => { setIntentado(true); if (!ok) return; onGuardar(normalizar(f)); cerrar(); };
  const cf = f.tipoDoc === "CF";
  const error = (campo) => (intentado && errores[campo] ? <div role="alert" style={{ fontSize: 12.5, color: "var(--c-c1442d-t)", marginTop: -4 }}>{errores[campo]}</div> : null);
  return createPortal(
    <Hoja onCerrar={onCerrar} ancho={460} gap={10} label="Datos para factura" z={85}>
      {({ cerrar }) => (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" }}>Datos para factura</div>
            <InfoTip titulo="¿Esto es la factura electrónica?">
              No. Aquí se guardan los datos del cliente y salen en el comprobante y en el Excel, listos para entregarlos a tu contador o a tu proveedor de facturación electrónica.
              <br /><br />La factura electrónica válida ante la DIAN la emite un proveedor tecnológico autorizado, y se conecta desde el menú «Facturación electrónica» (solo administrador).
            </InfoTip>
          </div>
          <Selector value={f.tipoDoc} onChange={(v) => setF((x) => ({ ...x, tipoDoc: v }))} titulo="Tipo de documento" opciones={TIPOS_DOC.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))} />
          {!cf && (
            <>
              <input autoComplete="off" style={styles.editInput} placeholder={f.tipoDoc === "NIT" ? "NIT (con o sin dígito de verificación)" : "Número de documento"} inputMode={f.tipoDoc === "PAS" ? "text" : "numeric"} value={f.numero} onChange={set("numero")} aria-label="Número de documento" />
              {error("numero")}
              <input autoComplete="off" style={styles.editInput} placeholder="Nombre o razón social" maxLength={120} value={f.nombre} onChange={set("nombre")} aria-label="Nombre o razón social" />
              {error("nombre")}
              {f.tipoDoc === "NIT" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1 }}><Selector value={f.nivelTributario || ""} onChange={(v) => setF((x) => ({ ...x, nivelTributario: v }))} titulo="Responsabilidad tributaria del cliente" placeholder="Responsabilidad tributaria (opcional)" opciones={NIVELES_TRIBUTARIOS} /></div>
                  <InfoTip titulo="¿Qué elijo?">Si la empresa cliente te lo dice o aparece en su RUT: O-48 si es responsable de IVA, O-47 si está en el Régimen Simple, R-99-PN si no es responsable. Si no lo sabes, déjalo vacío.</InfoTip>
                </div>
              )}
            </>
          )}
          <input autoComplete="off" style={styles.editInput} placeholder="Correo (opcional)" type="email" inputMode="email" maxLength={120} value={f.correo} onChange={set("correo")} aria-label="Correo" />
          {error("correo")}
          {!cf && <input autoComplete="off" style={styles.editInput} placeholder="Dirección (opcional)" maxLength={160} value={f.direccion} onChange={set("direccion")} aria-label="Dirección" />}
          {valor && <div style={{ fontSize: 12.5, color: "var(--btn2-mute)" }}>Guardado: {etiquetaDocumento(valor)}</div>}
          <button style={styles.sendBtn} onClick={() => guardar(cerrar)}>Guardar datos</button>
          {valor && onQuitar && <button style={{ ...styles.cancelEditBtn, color: "var(--c-c1442d-t)" }} onClick={() => { onQuitar(); cerrar(); }}>Quitar los datos</button>}
          <button style={styles.cancelEditBtn} onClick={cerrar}>Cancelar</button>
        </>
      )}
    </Hoja>,
    document.body
  );
}

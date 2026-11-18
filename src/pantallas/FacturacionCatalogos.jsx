import React, { useState } from "react";
import { ChevronDown, Plug, Save, FlaskConical, RefreshCw } from "lucide-react";
import { Selector } from "../componentes/Campos.jsx";
import { InfoTip } from "../componentes/InfoTip.jsx";
import { styles } from "../estilos.js";
import { REQUISITOS, METODOS, ETIQUETA_METODO, ETIQUETA_IMPUESTO_MAPEO, validarMapeo } from "../../tools/facturacion/mapeo.mjs";

/*
 * Paso 4 — Conectar con el proveedor, sincronizar catálogos y mapear conceptos. Cero IDs quemados:
 * el administrador elige, con selectores alimentados por los catálogos REALES de su cuenta, qué resolución, impuesto,
 * medio de pago y producto contable usa Comandas. Nada de esto se escribe desde el navegador: lo guarda la función del servidor.
 */
const K = { ink: "var(--c-242019-t)", sub: "var(--c-5c5648-t)", mute: "var(--btn2-mute)", line: "var(--btn2-line)", bg: "var(--btn2-bg)", fg: "var(--btn2-fg)", error: "var(--c-c1442d-t)", ok: "var(--pago-ok)" };
const btn = { minHeight: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${K.line}`, background: K.bg, color: K.fg, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "var(--font-body)" };
const aviso = (tipo) => ({ fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, color: tipo === "error" ? K.error : tipo === "ok" ? K.ok : K.sub });
const etiqueta = { fontSize: 13, fontWeight: 700, color: K.sub };
const opciones = (lista) => (lista || []).map((i) => ({ valor: String(i.id), etiqueta: i.etiqueta || String(i.id), detalle: i.porcentaje != null ? `${i.porcentaje} %` : i.detalle }));
const FilaSel = ({ titulo, valor, onChange, lista, error, info }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={etiqueta}>{titulo}</span>{info}</div>
    <Selector value={valor || ""} onChange={onChange} titulo={titulo} opciones={opciones(lista)} placeholder={lista && lista.length ? "Elegir" : "Sin opciones: sincroniza primero"} />
    {error && <div role="alert" style={{ fontSize: 12.5, color: K.error }}>{error}</div>}
  </div>
);

export function PasoCatalogos({ ajustes, prov, modo, catalogo, mapeo, setMapeo, credOk, sucio, llamar, ocupado, setOcupado }) {
  const [sync, setSync] = useState(null);
  const [verDetalle, setVerDetalle] = useState(false);
  const [msgMapeo, setMsgMapeo] = useState(null);
  const [prueba, setPrueba] = useState(null);
  const [verDetallePrueba, setVerDetallePrueba] = useState(false);
  const req = REQUISITOS[ajustes.proveedor] || REQUISITOS.simulado;
  const cat = catalogo || { resoluciones: [], impuestos: [], mediosPago: [], productos: [], vendedores: [] };
  const v = validarMapeo(mapeo, { proveedor: ajustes.proveedor, ajustes, catalogo: ajustes.proveedor === "simulado" && !catalogo ? null : cat });
  const claveImp = ["inc", "iva", "exento"].includes(ajustes.impuesto) ? ajustes.impuesto : "inc";
  const necesitaImpuesto = req.impuesto && (claveImp !== "exento" || req.exentoMapea);
  const hayAlgoQueMapear = req.resolucion || necesitaImpuesto || req.medios || req.producto || req.vendedor || ajustes.propina === "incluir";
  const puedeSincronizar = credOk && !ocupado;

  const sincronizar = async () => {
    setSync(null); setVerDetalle(false); setOcupado("sync");
    const r = await llamar({ accion: "sincronizar_catalogos", proveedor: ajustes.proveedor, modo });
    setOcupado("");
    setSync(r.cuerpo || { ok: false, mensaje: "Sin respuesta." });
  };
  const guardarMapeo = async () => {
    setMsgMapeo(null); setOcupado("mapeo");
    const r = await llamar({ accion: "guardar_mapeo", modo, mapeo });
    setOcupado("");
    const c = r.cuerpo || {};
    if (!c.ok) setMsgMapeo({ tipo: "error", texto: c.mensaje || "No se pudo guardar el mapeo." });
    else setMsgMapeo(c.completo ? { tipo: "ok", texto: "Mapeo guardado y completo." } : { tipo: "neutro", texto: `Mapeo guardado, pero falta: ${Object.values(c.pendiente || {})[0] || "completar elecciones"}` });
  };
  const probarEmision = async () => {
    setPrueba(null); setVerDetallePrueba(false); setOcupado("emision");
    const r = await llamar({ accion: "prueba_emision" });
    setOcupado("");
    setPrueba(r.cuerpo || { ok: false, mensaje: "Sin respuesta." });
  };
  const setM = (parche) => { setMapeo((x) => ({ ...x, ...parche })); setMsgMapeo(null); };
  const e = v.errores;
  const resumen = catalogo ? `${cat.resoluciones.length} numeración(es) · ${cat.impuestos.length} impuesto(s) · ${cat.mediosPago.length} medio(s) de pago · ${cat.productos.length} producto(s)` : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button style={{ ...btn, opacity: puedeSincronizar ? 1 : 0.5 }} disabled={!puedeSincronizar} onClick={sincronizar}>
        {ajustes.proveedor === "simulado" || !catalogo ? <Plug size={15} /> : <RefreshCw size={15} />} {ocupado === "sync" ? "Conectando…" : "Probar conexión y sincronizar catálogos"}
      </button>
      {!credOk && <div style={{ fontSize: 12.5, color: K.mute }}>Primero guarda las credenciales del ambiente elegido.</div>}
      <div role="status" aria-live="polite">
        {sync && (
          <div data-testid="resultado-sync" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={aviso(sync.ok ? "ok" : "error")}>{sync.ok ? "✔ " : "✘ "}{sync.mensaje}</span>
            {!sync.ok && sync.detalle && (
              <>
                <button type="button" style={{ ...btn, width: "fit-content" }} aria-expanded={verDetalle} onClick={() => setVerDetalle((x) => !x)}><ChevronDown size={15} style={{ transform: verDetalle ? "rotate(180deg)" : "none" }} /> Detalle técnico del proveedor</button>
                {verDetalle && <pre data-testid="detalle-tecnico" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: K.fg, background: K.bg, padding: 10, borderRadius: 10 }}>{sync.detalle}</pre>}
              </>
            )}
          </div>
        )}
      </div>
      {catalogo && <div data-testid="resumen-catalogo" style={{ fontSize: 12.5, color: K.sub }}>Catálogos sincronizados: {resumen}.</div>}

      {hayAlgoQueMapear && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="mapeo">
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ ...etiqueta, fontSize: 14 }}>Relaciona Comandas con tu cuenta</span>
            <InfoTip titulo="¿Para qué es esto?">Cada proveedor usa sus propios códigos internos. Aquí eliges, de las listas reales de tu cuenta, cuál corresponde a cada concepto. La app nunca inventa códigos: si algo cambia en tu cuenta, vuelve a sincronizar.</InfoTip>
          </div>
          {req.resolucion && <FilaSel titulo="Resolución / numeración" valor={mapeo.resolucion} onChange={(x) => setM({ resolucion: x })} lista={cat.resoluciones} error={e.resolucion} />}
          {necesitaImpuesto && <FilaSel titulo={`Impuesto «${ETIQUETA_IMPUESTO_MAPEO[claveImp]}»`} valor={mapeo.impuestos[claveImp]} onChange={(x) => setM({ impuestos: { ...mapeo.impuestos, [claveImp]: x } })} lista={cat.impuestos} error={e[`impuestos.${claveImp}`]} />}
          {req.medios && METODOS.map((k) => <FilaSel key={k} titulo={`Medio de pago: ${ETIQUETA_METODO[k]}`} valor={mapeo.mediosPago[k]} onChange={(x) => setM({ mediosPago: { ...mapeo.mediosPago, [k]: x } })} lista={cat.mediosPago} error={e[`mediosPago.${k}`]} />)}
          {req.producto && <FilaSel titulo="Producto / servicio contable por defecto" valor={mapeo.producto} onChange={(x) => setM({ producto: x })} lista={cat.productos} error={e.producto} />}
          {req.vendedor && <FilaSel titulo="Usuario vendedor" valor={mapeo.vendedor} onChange={(x) => setM({ vendedor: x })} lista={cat.vendedores} error={e.vendedor} />}
          {ajustes.propina === "incluir" && <FilaSel titulo="Ítem de propinas (ingreso para terceros)" valor={mapeo.propina} onChange={(x) => setM({ propina: x })} lista={cat.productos} error={e.propina} />}
          <button style={{ ...styles.sendBtn, opacity: ocupado ? 0.5 : 1 }} disabled={!!ocupado || (!catalogo && ajustes.proveedor !== "simulado")} onClick={guardarMapeo}><Save size={15} /> {ocupado === "mapeo" ? "Guardando…" : "Guardar relaciones"}</button>
          {msgMapeo && <div role="status" data-testid="mensaje-mapeo" style={aviso(msgMapeo.tipo)}>{msgMapeo.texto}</div>}
        </div>
      )}

      <button style={{ ...btn, opacity: ocupado || sucio || modo !== ajustes.modo ? 0.5 : 1 }} disabled={!!ocupado || sucio || ajustes.modo === "produccion"} onClick={probarEmision}>
        <FlaskConical size={15} /> {ocupado === "emision" ? "Emitiendo prueba…" : `Ejecutar prueba de emisión (${ajustes.proveedor === "simulado" ? "Simulada" : "Sandbox"})`}
      </button>
      {sucio && <div style={{ fontSize: 12.5, color: K.mute }}>Guarda la configuración antes de probar la emisión.</div>}
      {ajustes.modo === "produccion" && <div style={{ fontSize: 12.5, color: K.mute }}>La prueba de emisión solo se hace en el ambiente de Pruebas.</div>}
      <div role="status" aria-live="polite">
        {prueba && (
          <div data-testid="resultado-emision" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={aviso(prueba.ok ? "ok" : "error")}>{prueba.ok ? `✔ Prueba correcta: documento ${prueba.prefijo || ""}${prueba.numero || ""}${prueba.cufe ? ` · CUFE ${String(prueba.cufe).slice(0, 12)}…` : ""}` : `✘ ${prueba.mensaje}`}</span>
            {!prueba.ok && prueba.detalle && (
              <>
                <button type="button" style={{ ...btn, width: "fit-content" }} aria-expanded={verDetallePrueba} onClick={() => setVerDetallePrueba((x) => !x)}><ChevronDown size={15} style={{ transform: verDetallePrueba ? "rotate(180deg)" : "none" }} /> Detalle técnico del proveedor</button>
                {verDetallePrueba && <pre data-testid="detalle-tecnico-emision" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: K.fg, background: K.bg, padding: 10, borderRadius: 10 }}>{prueba.detalle}</pre>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

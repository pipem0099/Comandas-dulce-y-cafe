import React, { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Save } from "lucide-react";
import { CabeceraAdmin } from "../componentes/CabeceraAdmin.jsx";
import { Selector, CampoFecha } from "../componentes/Campos.jsx";
import { InfoTip } from "../componentes/InfoTip.jsx";
import { Acordeon } from "../componentes/Comunes.jsx";
import { AlertasFiscales } from "../componentes/AlertasFiscales.jsx";
import { PasoCatalogos } from "./FacturacionCatalogos.jsx";
import { useDocumentosFiscales } from "../useFacturacion.js";
import { styles } from "../estilos.js";
import { saveShared, subscribeShared, solicitarFacturacion } from "../firebase.js";
import { ErrorReintentable } from "../facturacion/cliente.js";
import {
  PROVEEDORES, MODOS, ETIQUETA_MODO, ETIQUETA_TIPO_DOC, ETIQUETA_IMPUESTO, ETIQUETA_PRECIOS, ETIQUETA_PROPINA,
  conDefectos, validarAjustes, estadoResolucion, proveedorPorValor,
} from "../../tools/facturacion/config.mjs";
import { REGIMENES, ETIQUETA_REGIMEN, calcularDv } from "../../tools/facturacion/emisor.mjs";
import { MAPEO_VACIO, conMapeoVacio } from "../../tools/facturacion/mapeo.mjs";
import { alertasResolucion, estadoFolios, ultimoConsecutivo } from "../../tools/facturacion/alertas.mjs";

/*
 * Configuración de la facturación electrónica (DIAN) — SOLO administrador.
 * Todo se configura aquí, sin tocar código ni variables de entorno por cliente:
 *   1) Estado y ambiente · 2) Proveedor y credenciales (cifradas en el servidor, nunca se vuelven a mostrar) · 3) Reglas tributarias · 4) Resolución.
 * Los ajustes no secretos se guardan en `facturacion/ajustes`; las credenciales viajan UNA vez a la función del servidor, que las cifra.
 */
const K = { ink: "var(--c-242019-t)", sub: "var(--c-5c5648-t)", mute: "var(--btn2-mute)", line: "var(--btn2-line)", bg: "var(--btn2-bg)", fg: "var(--btn2-fg)", error: "var(--c-c1442d-t)", ok: "var(--pago-ok)" };
const tarjeta = { display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 16, border: `1px solid ${K.line}`, background: "var(--c-fffdf8-b)" };
const h2 = { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: K.ink, margin: 0 };
const etiqueta = { fontSize: 13, fontWeight: 700, color: K.sub };
const btn = { minHeight: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${K.line}`, background: K.bg, color: K.fg, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "var(--font-body)" };
const aviso = (tipo) => ({ fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, color: tipo === "error" ? K.error : tipo === "ok" ? K.ok : K.sub });
const hoyBogota = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

function Interruptor({ valor, onChange, titulo, detalle }) {
  return (
    <button type="button" role="switch" aria-checked={valor} onClick={() => onChange(!valor)}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "6px 14px", borderRadius: 12, border: `1px solid ${K.line}`, background: valor ? "var(--chip-on-bg)" : K.bg, color: valor ? "var(--chip-on-fg)" : K.fg, textAlign: "left", cursor: "pointer", fontFamily: "var(--font-body)" }}>
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{titulo}</span>
        {detalle && <span style={{ fontSize: 12.5, fontWeight: 400, opacity: 0.85 }}>{detalle}</span>}
      </span>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{valor ? "Sí" : "No"}</span>
    </button>
  );
}

const Fila = ({ titulo, info, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={etiqueta}>{titulo}</span>{info}</div>
    {children}
  </div>
);
const MsgError = ({ texto }) => (texto ? <div role="alert" style={{ fontSize: 12.5, color: K.error }}>{texto}</div> : null);

export function PanelFacturacion({ usuarioActual, onClose }) {
  const [ajustes, setAjustes] = useState(null);       // lo guardado
  const [b, setB] = useState(null);                    // borrador que se edita
  const [hint, setHint] = useState(undefined);         // { proveedor, mascara } o null
  const [cred, setCred] = useState({});                // credenciales escritas (solo en memoria; se borran al guardar)
  const [msg, setMsg] = useState(null);                // resultado de guardar ajustes
  const [credMsg, setCredMsg] = useState(null);        // resultado de guardar credenciales
  const [ocupado, setOcupado] = useState("");
  const [catalogo, setCatalogo] = useState(null);      // catálogos sincronizados del ambiente elegido
  const [mapeo, setMapeo] = useState(conMapeoVacio(MAPEO_VACIO));
  const documentos = useDocumentosFiscales(true);
  const [intentado, setIntentado] = useState(false);

  useEffect(() => subscribeShared("facturacion/ajustes", {}, (a) => { setAjustes(a || {}); setB((prev) => prev || conDefectos(a)); }), []);
  const modo = b ? b.modo : null;
  // Credenciales, catálogos y mapeo son POR AMBIENTE: Pruebas y Producción no se mezclan.
  useEffect(() => { if (!modo) return undefined; setHint(undefined); return subscribeShared(`facturacion/credencial/${modo}`, null, setHint); }, [modo]);
  useEffect(() => { if (!modo) return undefined; setCatalogo(null); return subscribeShared(`facturacion/catalogo/${modo}`, null, setCatalogo); }, [modo]);
  useEffect(() => { if (!modo) return undefined; setMapeo(conMapeoVacio(MAPEO_VACIO)); return subscribeShared(`facturacion/mapeo/${modo}`, null, (m) => setMapeo(conMapeoVacio(m))); }, [modo]);

  const prov = b ? proveedorPorValor(b.proveedor) : null;
  const credGuardada = !!(hint && prov && hint.proveedor === b.proveedor);
  const validacion = useMemo(() => (b ? validarAjustes(b, { credencialConfigurada: credGuardada || (prov && prov.campos.length === 0), hoy: hoyBogota(), propinaMapeada: !!mapeo.propina }) : null), [b, credGuardada, prov, mapeo.propina]);
  const sucio = b && ajustes && JSON.stringify(validarAjustes(b).valor) !== JSON.stringify(validarAjustes(conDefectos(ajustes)).valor);
  if (!b) return (<><CabeceraAdmin titulo="Facturación electrónica" onClose={onClose} /><div className="ancho" style={{ ...styles.menuScroll, color: K.mute }}>Cargando…</div></>);

  const set = (k) => (v) => { setB((x) => ({ ...x, [k]: v })); setMsg(null); };
  const setRes = (k) => (v) => { setB((x) => ({ ...x, resolucion: { ...x.resolucion, [k]: v } })); setMsg(null); };
  const err = (k) => (intentado && validacion && validacion.errores[k]) || "";
  const res = estadoResolucion(b.resolucion, hoyBogota());
  const TEXTO_RES = { vigente: `Vigente${res.dias != null ? ` · vence en ${res.dias} días` : ""}.`, por_vencer: `Por vencer: quedan ${res.dias} días. Solicita la nueva resolución a la DIAN.`, vencida: "Vencida: no se puede facturar en producción.", aun_no_rige: "Todavía no rige.", sin_configurar: "Sin configurar." };

  const setEm = (k) => (v) => { setB((x) => ({ ...x, emisor: { ...x.emisor, [k]: v } })); setMsg(null); };
  const dvCalculado = calcularDv(b.emisor.nit);
  const listaDocs = Object.values(documentos || {});
  const ultimo = ultimoConsecutivo(listaDocs, b.resolucion.prefijo);
  const folios = estadoFolios(b.resolucion, ultimo);
  const alertas = alertasResolucion({ resolucion: b.resolucion, hoy: hoyBogota(), ultimo, estadoRes: res });
  const credOk = !!(prov && (prov.campos.length === 0 || credGuardada));
  const paso = (n, t) => <h2 style={h2}><span aria-hidden="true" style={{ color: K.mute, marginRight: 6 }}>{n}.</span>{t}</h2>;

  const guardar = async () => {
    setIntentado(true); setMsg(null);
    if (!validacion.ok) { setMsg({ tipo: "error", texto: Object.values(validacion.errores)[0] }); return; }
    setOcupado("guardar");
    const ok = await saveShared("facturacion/ajustes", { ...validacion.valor, actualizadoTs: Date.now(), actualizadoPor: String((usuarioActual && usuarioActual.nombre) || "").slice(0, 120) });
    setOcupado("");
    setMsg(ok ? { tipo: "ok", texto: "Configuración guardada." } : { tipo: "error", texto: "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo." });
  };

  const llamar = async (solicitud) => {
    try { return await solicitarFacturacion(solicitud); }
    catch (e) { return { status: 0, cuerpo: { ok: false, mensaje: e instanceof ErrorReintentable ? "Necesitas internet para esto." : "No se pudo completar. Inténtalo de nuevo." } }; }
  };
  const guardarCredenciales = async () => {
    setCredMsg(null); setOcupado("cred");
    const r = await llamar({ accion: "guardar_credenciales", proveedor: b.proveedor, modo: b.modo, credenciales: cred });
    setOcupado("");
    if (r.cuerpo && r.cuerpo.ok) { setCred({}); setCredMsg({ tipo: "ok", texto: "Credenciales guardadas y cifradas para este ambiente. Ahora sincroniza los catálogos." }); }
    else setCredMsg({ tipo: "error", texto: (r.cuerpo && r.cuerpo.mensaje) || "No se pudieron guardar.", errores: r.cuerpo && r.cuerpo.errores });
  };
  return (
    <>
      <CabeceraAdmin titulo="Facturación electrónica" onClose={onClose} />
      <div className="ancho" style={{ ...styles.menuScroll, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 14 }}>
        <AlertasFiscales alertas={alertas} testid="alertas-config" />

        <section style={tarjeta} aria-label="Datos del emisor">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {paso(1, "Datos del restaurante (emisor)")}
            <InfoTip titulo="¿De dónde salen?">Son los datos de tu RUT: razón social, NIT y responsabilidades. Salen impresos en cada factura. El dígito de verificación (DV) se calcula solo.</InfoTip>
          </div>
          <Fila titulo="Razón social"><input style={styles.editInput} aria-label="Razón social" maxLength={200} value={b.emisor.razonSocial} onChange={(e) => setEm("razonSocial")(e.target.value)} /></Fila>
          <MsgError texto={err("emisor.razonSocial")} />
          <Fila titulo="NIT (sin dígito de verificación)"><input style={styles.editInput} aria-label="NIT" inputMode="numeric" maxLength={14} value={b.emisor.nit} onChange={(e) => setEm("nit")(e.target.value.replace(/[^\d.\-]/g, ""))} /></Fila>
          <div data-testid="dv-calculado" style={{ fontSize: 13, color: K.sub }}>{dvCalculado ? `Dígito de verificación (DV): ${dvCalculado}` : "El DV aparece al escribir el NIT."}</div>
          <MsgError texto={err("emisor.nit")} />
          <Fila titulo="Régimen / responsabilidad">
            <Selector value={b.emisor.regimen} onChange={setEm("regimen")} titulo="Régimen" opciones={REGIMENES.map((x) => ({ valor: x, etiqueta: ETIQUETA_REGIMEN[x] }))} />
          </Fila>
          <MsgError texto={err("emisor.regimen")} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}><Fila titulo="Municipio"><input style={styles.editInput} aria-label="Municipio" maxLength={120} value={b.emisor.municipio} onChange={(e) => setEm("municipio")(e.target.value)} /></Fila></div>
            <div style={{ flex: 1 }}><Fila titulo="Código DANE" info={<InfoTip titulo="Código DANE">Son 5 dígitos del municipio (Bogotá 11001, Medellín 05001, Cali 76001). Está en tu RUT.</InfoTip>}><input style={styles.editInput} aria-label="Código DANE" inputMode="numeric" maxLength={5} value={b.emisor.codigoDane} onChange={(e) => setEm("codigoDane")(e.target.value.replace(/\D/g, ""))} /></Fila></div>
          </div>
          <MsgError texto={err("emisor.municipio") || err("emisor.codigoDane")} />
          <Fila titulo="Correo oficial del restaurante"><input style={styles.editInput} aria-label="Correo oficial" type="email" autoCapitalize="off" maxLength={200} value={b.emisor.correo} onChange={(e) => setEm("correo")(e.target.value)} /></Fila>
          <MsgError texto={err("emisor.correo")} />
        </section>

        <section style={tarjeta} aria-label="Estado y ambiente">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {paso(2, "Estado y ambiente")}
            <InfoTip titulo="¿Qué es esto?">Aquí conectas la app con tu proveedor tecnológico autorizado por la DIAN (Factus, Alegra, Siigo o Dataico). Pruebas y Producción tienen credenciales, catálogos y relaciones SEPARADOS: cambiar de ambiente no borra nada del otro. Empieza siempre en «Pruebas / Sandbox».</InfoTip>
          </div>
          <Interruptor valor={b.activa} onChange={set("activa")} titulo="Facturación electrónica activa" detalle="Si está apagada, Caja no muestra botones de factura." />
          <MsgError texto={err("credenciales")} />
          <Fila titulo="Ambiente"><Selector value={b.modo} onChange={set("modo")} titulo="Ambiente" opciones={MODOS.map((m) => ({ valor: m, etiqueta: ETIQUETA_MODO[m] }))} /></Fila>
          <MsgError texto={err("modo")} />
          {b.modo === "produccion" && <div style={aviso("neutro")}>Producción: cada factura tiene validez fiscal real ante la DIAN.</div>}
          <Interruptor valor={b.emisionAutomatica} onChange={set("emisionAutomatica")} titulo="Emitir automáticamente al cobrar" detalle="Si no, el cajero toca «Emitir factura» en cada cuenta." />
        </section>

        <section style={tarjeta} aria-label="Proveedor tecnológico">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {paso(3, `Proveedor y credenciales · ${ETIQUETA_MODO[b.modo]}`)}
            {prov && <InfoTip titulo={`¿Dónde saco las llaves de ${prov.etiqueta}?`}>{prov.guia}</InfoTip>}
          </div>
          <Selector value={b.proveedor} onChange={(v) => { set("proveedor")(v); setCred({}); setCredMsg(null); }} titulo="Proveedor tecnológico" opciones={PROVEEDORES.map((p) => ({ valor: p.valor, etiqueta: p.etiqueta }))} />
          <MsgError texto={err("proveedor")} />
          {prov && <div style={{ fontSize: 13, color: K.sub }}>{prov.detalle}</div>}
          {prov && prov.campos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={16} color={credGuardada ? K.ok : K.mute} aria-hidden="true" />
                <span data-testid="estado-credenciales" style={{ fontSize: 14, fontWeight: 700, color: credGuardada ? K.ok : K.sub }}>{credGuardada ? `Configurado (${hint.mascara})` : "Sin configurar"}</span>
              </div>
              {hint && !credGuardada && hint.proveedor && <div style={{ fontSize: 12.5, color: K.mute }}>Este ambiente tiene guardadas las llaves de otro proveedor ({(proveedorPorValor(hint.proveedor) || {}).etiqueta || hint.proveedor}). Al guardar las de {prov.etiqueta} se reinician los catálogos y relaciones de este ambiente (las facturas ya emitidas no se tocan).</div>}
              {credGuardada && <div style={{ fontSize: 12.5, color: K.mute }}>Por seguridad las llaves guardadas no se muestran. Para rotarlas, escribe todas de nuevo: el historial de facturas y las relaciones de catálogos se conservan.</div>}
              {prov.campos.map((c) => (
                <Fila key={c.clave} titulo={c.etiqueta}>
                  <input style={styles.editInput} aria-label={c.etiqueta} type={c.secreto ? "password" : "text"} autoComplete="off" autoCapitalize="off" spellCheck={false} inputMode={c.tipo === "numero" ? "numeric" : undefined}
                    maxLength={500} value={cred[c.clave] || ""} onChange={(e) => setCred((x) => ({ ...x, [c.clave]: e.target.value }))} placeholder={credGuardada ? "••••••••" : ""} />
                  <MsgError texto={credMsg && credMsg.errores && credMsg.errores[c.clave]} />
                </Fila>
              ))}
              <button style={{ ...styles.sendBtn, opacity: ocupado ? 0.5 : 1 }} disabled={!!ocupado} onClick={guardarCredenciales}><Save size={15} /> {ocupado === "cred" ? "Guardando…" : credGuardada ? "Reemplazar credenciales" : "Guardar credenciales"}</button>
              {credMsg && <div role="status" style={aviso(credMsg.tipo)}>{credMsg.texto}</div>}
            </div>
          )}
        </section>

        <section style={tarjeta} aria-label="Conectar y sincronizar">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {paso(4, "Conectar y relacionar catálogos")}
            <InfoTip titulo="¿Qué hace?">Trae de tu cuenta del proveedor las numeraciones, impuestos, medios de pago y productos, y te deja elegir cuál usar. Después puedes ejecutar una prueba de emisión completa sin tocar cuentas reales.</InfoTip>
          </div>
          <PasoCatalogos ajustes={b} prov={prov} modo={b.modo} catalogo={catalogo} mapeo={mapeo} setMapeo={setMapeo} credOk={credOk} sucio={!!sucio} llamar={llamar} ocupado={ocupado} setOcupado={setOcupado} />
        </section>

        <section style={tarjeta} aria-label="Reglas tributarias">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {paso(5, "Reglas tributarias")}
            <InfoTip titulo="Pregúntale a tu contador">Estas opciones dependen de cómo está inscrito tu restaurante ante la DIAN (RUT). Si dudas: ¿somos responsables de INC o de IVA? ¿los precios de la carta ya incluyen el impuesto? ¿usamos factura de venta o documento equivalente POS?</InfoTip>
          </div>
          <Fila titulo="Tipo de documento"><Selector value={b.tipoDocumento} onChange={set("tipoDocumento")} titulo="Tipo de documento" opciones={Object.entries(ETIQUETA_TIPO_DOC).map(([valor, e]) => ({ valor, etiqueta: e }))} /></Fila>
          <MsgError texto={err("tipoDocumento")} />
          <Fila titulo="Impuesto aplicable"><Selector value={b.impuesto} onChange={set("impuesto")} titulo="Impuesto aplicable" opciones={Object.entries(ETIQUETA_IMPUESTO).map(([valor, e]) => ({ valor, etiqueta: e }))} /></Fila>
          <Fila titulo="Precios de la carta"><Selector value={b.precios} onChange={set("precios")} titulo="Precios de la carta" opciones={Object.entries(ETIQUETA_PRECIOS).map(([valor, e]) => ({ valor, etiqueta: e }))} /></Fila>
          <Fila titulo="Propina voluntaria"><div style={{ fontSize: 14, color: K.ink }}>{b.propina === "incluir" ? "Se incluye como ingreso para terceros (no gravado)." : "Se excluye del documento electrónico (recomendado)."}</div></Fila>
          <Acordeon titulo="Opciones tributarias avanzadas" resumen={b.propina === "incluir" ? "Propina incluida en el documento" : "Valores por defecto"}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Interruptor valor={b.propina === "incluir"} onChange={(v) => set("propina")(v ? "incluir" : "excluir")} titulo="Incluir propina como ingreso para terceros (no gravado)" detalle="Pídele confirmación a tu contador. Exige elegir el ítem de propinas en el paso 4." />
              <MsgError texto={err("propina")} />
              <Fila titulo="Valor de la UVT (COP)" info={<InfoTip titulo="¿Para qué sirve la UVT?">El Documento Equivalente POS tiene un tope de 5 UVT por documento. Con este valor la caja te avisa cuando una cuenta lo supera. Confírmalo cada enero con la DIAN.</InfoTip>}>
                <input style={styles.editInput} aria-label="Valor de la UVT" inputMode="numeric" maxLength={7} value={String(b.valorUvt ?? "")} onChange={(e) => set("valorUvt")(e.target.value === "" ? "" : Number(e.target.value.replace(/\D/g, "")))} />
              </Fila>
              <MsgError texto={err("valorUvt")} />
            </div>
          </Acordeon>
        </section>

        <section style={tarjeta} aria-label="Resolución y numeración">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {paso(6, "Resolución y numeración")}
            <InfoTip titulo="¿De dónde salen estos datos?">Del documento de «Resolución de facturación» que te entregó la DIAN al habilitar la numeración. Tu proveedor también te los muestra en su plataforma. En Pruebas son opcionales; en Producción son obligatorios.</InfoTip>
          </div>
          <Fila titulo="Prefijo"><input style={styles.editInput} aria-label="Prefijo" maxLength={4} autoCapitalize="characters" value={b.resolucion.prefijo} onChange={(e) => setRes("prefijo")(e.target.value.toUpperCase())} /></Fila>
          <MsgError texto={err("resolucion.prefijo")} />
          <Fila titulo="Número de resolución"><input style={styles.editInput} aria-label="Número de resolución" inputMode="numeric" maxLength={20} value={b.resolucion.numero} onChange={(e) => setRes("numero")(e.target.value.replace(/\D/g, ""))} /></Fila>
          <MsgError texto={err("resolucion.numero")} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Fila titulo="Rango desde"><input style={styles.editInput} aria-label="Rango desde" inputMode="numeric" maxLength={12} value={b.resolucion.desde} onChange={(e) => setRes("desde")(e.target.value.replace(/\D/g, ""))} /></Fila></div>
            <div style={{ flex: 1 }}><Fila titulo="Rango hasta"><input style={styles.editInput} aria-label="Rango hasta" inputMode="numeric" maxLength={12} value={b.resolucion.hasta} onChange={(e) => setRes("hasta")(e.target.value.replace(/\D/g, ""))} /></Fila></div>
          </div>
          <MsgError texto={err("resolucion.desde") || err("resolucion.hasta")} />
          <Fila titulo="Vigente desde"><CampoFecha value={b.resolucion.vigenciaDesde} onChange={setRes("vigenciaDesde")} opcional titulo="Vigente desde" placeholder="Elegir fecha" /></Fila>
          <MsgError texto={err("resolucion.vigenciaDesde")} />
          <Fila titulo="Vigente hasta"><CampoFecha value={b.resolucion.vigenciaHasta} onChange={setRes("vigenciaHasta")} opcional titulo="Vigente hasta" placeholder="Elegir fecha" /></Fila>
          <MsgError texto={err("resolucion.vigenciaHasta")} />
          <div data-testid="estado-resolucion" style={aviso("neutro")}>{TEXTO_RES[res.estado]}</div>
          {folios.estado !== "sin_datos" && <div data-testid="estado-folios" style={aviso("neutro")}>Folios: usaste {folios.usados} de {folios.total}; quedan {folios.disponibles} ({folios.porcentajeLibre} % libre).</div>}
        </section>

        <button style={{ ...styles.sendBtn, opacity: ocupado ? 0.5 : 1 }} disabled={!!ocupado} onClick={guardar}><Save size={15} /> {ocupado === "guardar" ? "Guardando…" : "Guardar configuración"}</button>
        {sucio && !msg && <div style={{ fontSize: 12.5, color: K.mute, textAlign: "center" }}>Tienes cambios sin guardar.</div>}
        <div role="status" aria-live="polite" data-testid="mensaje-guardado" style={{ ...aviso(msg && msg.tipo), textAlign: "center" }}>{msg && msg.texto}</div>
      </div>
    </>
  );
}
export default PanelFacturacion;

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ChevronDown, Eye, EyeOff, Save, RefreshCw, Lock } from "lucide-react";
import { CabeceraAdmin } from "../componentes/CabeceraAdmin.jsx";
import { Selector, CampoFecha } from "../componentes/Campos.jsx";
import { Hoja } from "../componentes/Hoja.jsx";
import { AlertasFiscales } from "../componentes/AlertasFiscales.jsx";
import { Grupo, FilaIos, ParIos, Interruptor, BotonTexto, InfoTip, K, inputIos, inputIosIzq } from "../componentes/FilasIos.jsx";
import { PasoCatalogos } from "./FacturacionCatalogos.jsx";
import { useDocumentosFiscales } from "../useFacturacion.js";
import { saveShared, subscribeShared, solicitarFacturacion } from "../firebase.js";
import { ErrorReintentable } from "../facturacion/cliente.js";
import { PROVEEDORES, MODOS, conDefectos, validarAjustes, estadoResolucion, proveedorPorValor, validarResolucion } from "../../tools/facturacion/config.mjs";
import { REGIMENES, calcularDv, validarEmisor } from "../../tools/facturacion/emisor.mjs";
import { MUNICIPIOS_CALDAS, MUNICIPIO_POR_DEFECTO, municipioPorNombre } from "../../tools/facturacion/municipios.mjs";
import { MAPEO_VACIO, conMapeoVacio, validarMapeo } from "../../tools/facturacion/mapeo.mjs";
import { alertasResolucion, estadoFolios, ultimoConsecutivo, ultimoEfectivo } from "../../tools/facturacion/alertas.mjs";

/*
 * Configuración de la facturación electrónica (DIAN) — SOLO administrador. Estilo «Ajustes de iOS» (listas agrupadas).
 *  · Cabecera de estado siempre visible: interruptor «activa», ambiente, folios disponibles y alertas (≤ 25 folios · ≤ 15 días).
 *  · Sin configuración guardada → ASISTENTE de 5 pasos (valida cada paso).  Ya configurada → 5 TARJETAS RESUMEN con «Editar» (hoja con Cancelar / Guardar).
 *  · Mismos datos y rutas de siempre: `facturacion/ajustes` (no secretos) y credenciales cifradas en el servidor.
 *    Campos nuevos (opcionales, compatibles): emisor.direccion, emisor.telefono, resolucion.siguiente, consumidorFinal, convertirPos.
 */
const hoyBogota = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const TITULOS = ["Datos del emisor", "Operación y ambiente", "Proveedor y pruebas", "Reglas tributarias", "Resolución DIAN y numeración"];
const RESP = { "R-99-PN": "R-99-PN · No aplica / Otros", "O-48": "O-48 · Impuesto sobre las ventas IVA", "O-47": "O-47 · Régimen Simple RST" };
const COD = { responsable_iva: "O-48", no_responsable: "R-99-PN", simple: "O-47" };
const OPC_REGIMEN = REGIMENES.map((r) => ({ valor: r, etiqueta: RESP[COD[r]] }));
const CORTO = {
  modo: { pruebas: "Pruebas / Sandbox", produccion: "Producción" },
  tipo: { factura: "Factura Electrónica", pos: "Doc. Equivalente POS" },
  impuesto: { inc: "INC 8%", iva: "IVA 19%", exento: "Excluido (0%)" },
  precios: { incluyen: "Incluyen impuesto", suman: "Sumar impuesto" },
  propina: { excluir: "Excluir (recomendado)", incluir: "Incluir (no gravado)" },
};
const opciones = (m) => Object.entries(m).map(([valor, etiqueta]) => ({ valor, etiqueta }));
const selFila = { border: "none", background: "transparent", minHeight: 44, padding: 0, width: "100%", justifyContent: "flex-end", gap: 6, color: K.sub, fontSize: 15, boxShadow: "none" };
const selPar = { minHeight: 44, width: "100%", padding: "0 10px", borderRadius: 10, border: `1px solid ${K.line}`, background: K.bg, fontSize: 15 };
const inputPar = { ...inputIosIzq, background: K.bg, border: `1px solid ${K.line}`, borderRadius: 10, padding: "0 10px" };
const btn = { minHeight: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${K.line}`, background: K.bg, color: "var(--btn2-fg)", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, lineHeight: 1, whiteSpace: "nowrap" };
const primario = { ...btn, border: "none", background: "var(--chip-on-bg)", color: "var(--chip-on-fg)", flex: 1 };
const ic = { flexShrink: 0 };
const aviso = (t) => ({ fontSize: 13.5, lineHeight: 1.45, fontWeight: 600, color: t === "error" ? K.error : t === "ok" ? K.verde : K.sub });
const soloDigitos = (v, max) => String(v).replace(/\D/g, "").slice(0, max);

/* ───────── campos de cada bloque (los usan el asistente y la hoja de edición) ───────── */
function Bloque1({ d, setEm, err }) {
  const e = d.emisor;
  const dv = calcularDv(e.nit);
  const m = municipioPorNombre(e.municipio);
  const opcMun = MUNICIPIOS_CALDAS.map((x) => ({ valor: x.municipio, etiqueta: x.municipio }));
  if (e.municipio && !m) opcMun.unshift({ valor: e.municipio, etiqueta: e.municipio });
  return (
    <Grupo ariaLabel="Datos del emisor">
      <FilaIos etiqueta="Razón social" error={err("emisor.razonSocial")}><input style={inputIos} aria-label="Razón social" maxLength={200} autoComplete="organization" value={e.razonSocial} onChange={(x) => setEm("razonSocial")(x.target.value)} /></FilaIos>
      <FilaIos etiqueta="NIT" error={err("emisor.nit")} info={<InfoTip titulo="NIT y dígito de verificación">Escribe solo el NIT, sin puntos ni guiones. El dígito de verificación (DV) se calcula solo con el método oficial de la DIAN.</InfoTip>}>
        <input style={{ ...inputIos, flex: 1 }} aria-label="NIT" inputMode="numeric" autoComplete="off" maxLength={15} value={e.nit} onChange={(x) => setEm("nit")(soloDigitos(x.target.value, 15))} />
        <span data-testid="dv-calculado" aria-label={dv ? `Dígito de verificación ${dv}` : "Dígito de verificación pendiente"} style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 999, background: K.bg, border: `1px solid ${K.line}`, fontSize: 13, fontWeight: 700, color: dv ? K.ink : K.mute }}>DV: {dv || "–"}</span>
      </FilaIos>
      <FilaIos etiqueta="Responsabilidad" error={err("emisor.regimen")} info={<InfoTip titulo="Responsabilidad fiscal (casilla 53 del RUT)">Es la responsabilidad que aparece en tu RUT. Si dudas, pregúntale a tu contador: R-99-PN (no aplica), O-48 (responsable de IVA) u O-47 (Régimen Simple).</InfoTip>}>
        <Selector value={e.regimen} onChange={setEm("regimen")} titulo="Responsabilidad fiscal" opciones={OPC_REGIMEN} style={selFila} />
      </FilaIos>
      <ParIos
        a={{ etiqueta: "Municipio", control: <Selector value={e.municipio} onChange={(v) => { const mm = municipioPorNombre(v); setEm("municipio")(v); setEm("codigoDane")(mm ? mm.dane : ""); }} titulo="Municipio (Caldas)" buscable opciones={opcMun} style={selPar} placeholder="Elegir" />, error: err("emisor.municipio") }}
        b={{ etiqueta: "Cód. DANE", info: <InfoTip titulo="Código DANE">Se llena solo al elegir el municipio (catálogo oficial DIVIPOLA de Caldas). No se escribe a mano.</InfoTip>, control: <span data-testid="dane" style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "100%", height: 44, padding: "0 10px", borderRadius: 10, background: K.bg, border: `1px solid ${K.line}`, color: e.codigoDane ? K.ink : K.mute, fontSize: 15 }}><Lock size={13} style={ic} aria-hidden="true" />{e.codigoDane || "–"}</span>, error: err("emisor.codigoDane") }} />
      <FilaIos etiqueta="Dirección" error={err("emisor.direccion")}><input style={inputIos} aria-label="Dirección del establecimiento" autoComplete="street-address" maxLength={200} value={e.direccion || ""} onChange={(x) => setEm("direccion")(x.target.value)} /></FilaIos>
      <FilaIos etiqueta="Teléfono" error={err("emisor.telefono")}><input style={inputIos} aria-label="Teléfono" type="tel" autoComplete="tel" maxLength={20} value={e.telefono || ""} onChange={(x) => setEm("telefono")(x.target.value.replace(/[^\d\s+()-]/g, ""))} /></FilaIos>
      <FilaIos etiqueta="Correo oficial" ultima error={err("emisor.correo")}><input style={inputIos} aria-label="Correo oficial" type="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={200} value={e.correo} onChange={(x) => setEm("correo")(x.target.value)} /></FilaIos>
    </Grupo>
  );
}

function Bloque2({ d, set, err }) {
  return (
    <Grupo ariaLabel="Operación y ambiente">
      <FilaIos etiqueta="Facturación activa" error={err("credenciales")} info={<InfoTip titulo="Facturación activa">Si está apagada, Caja no muestra botones de factura.</InfoTip>}><Interruptor etiqueta="Facturación electrónica activa" valor={d.activa} onChange={set("activa")} /></FilaIos>
      <FilaIos etiqueta="Ambiente" error={err("modo")} info={<InfoTip titulo="Ambiente">Pruebas: no tiene validez ante la DIAN. Producción: cada factura tiene validez fiscal real. Cada ambiente tiene sus propias credenciales, catálogos y relaciones.</InfoTip>}>
        <Selector value={d.modo} onChange={set("modo")} titulo="Ambiente" opciones={MODOS.map((m) => ({ valor: m, etiqueta: CORTO.modo[m] }))} style={selFila} />
      </FilaIos>
      <FilaIos etiqueta="Emisión automática" ultima info={<InfoTip titulo="Emisión automática al cobrar">Si está activa, la factura se emite sola al cobrar la cuenta. Si no, el cajero toca «Emitir factura» en cada cuenta.</InfoTip>}><Interruptor etiqueta="Emitir automáticamente al cobrar" valor={d.emisionAutomatica} onChange={set("emisionAutomatica")} /></FilaIos>
    </Grupo>
  );
}

function Bloque3({ d, set, err, ctx }) {
  const prov = proveedorPorValor(d.proveedor);
  const { hint, cred, setCred, credMsg, guardarCredenciales, ocupado, verSecreto, setVerSecreto, abrirCat, setAbrirCat, catProps } = ctx;
  const credGuardada = !!(hint && prov && hint.proveedor === d.proveedor);
  return (
    <>
      <Grupo ariaLabel="Proveedor tecnológico">
        <FilaIos etiqueta="Proveedor" ultima={!prov || prov.campos.length === 0} error={err("proveedor")} info={prov ? <InfoTip titulo={prov.etiqueta}>{prov.detalle}{prov.campos.length > 0 ? <><br /><br />{prov.guia}</> : null}</InfoTip> : null}>
          <Selector value={d.proveedor} onChange={(v) => { set("proveedor")(v); setCred({}); }} titulo="Proveedor tecnológico" opciones={PROVEEDORES.map((p) => ({ valor: p.valor, etiqueta: p.etiqueta }))} style={selFila} />
        </FilaIos>
        {prov && prov.campos.length > 0 && (
          <>
            <FilaIos etiqueta="Credenciales" info={<InfoTip titulo="Credenciales guardadas">Por seguridad las llaves guardadas no se muestran. Para cambiarlas escribe todas de nuevo: el historial de facturas y las relaciones de catálogos se conservan. Si este ambiente tiene llaves de otro proveedor, al guardar las de {prov.etiqueta} se reinician sus catálogos y relaciones.</InfoTip>}>
              <span data-testid="estado-credenciales" style={{ fontWeight: 600, color: credGuardada ? K.verde : K.sub }}>{credGuardada ? `Configurado (${hint.mascara})` : "Sin configurar"}</span>
            </FilaIos>
            {prov.campos.map((c, i) => (
              <FilaIos key={c.clave} etiqueta={c.etiqueta} error={credMsg && credMsg.errores && credMsg.errores[c.clave]}>
                <input style={{ ...inputIos, flex: 1 }} aria-label={c.etiqueta} type={c.secreto && !verSecreto ? "password" : "text"} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode={c.tipo === "numero" ? "numeric" : undefined}
                  maxLength={500} value={cred[c.clave] || ""} onChange={(x) => setCred((y) => ({ ...y, [c.clave]: x.target.value }))} placeholder={credGuardada ? "••••••••" : ""} />
                {c.secreto && <button type="button" aria-label={verSecreto ? "Ocultar" : "Mostrar"} onClick={() => setVerSecreto((v) => !v)} style={{ minWidth: 44, minHeight: 44, border: "none", background: "transparent", color: K.verde, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{verSecreto ? <EyeOff size={18} style={ic} /> : <Eye size={18} style={ic} />}</button>}
              </FilaIos>
            ))}
            <div style={{ padding: "8px 14px 12px" }}>
              <button type="button" style={{ ...btn, width: "100%", opacity: ocupado ? 0.5 : 1 }} disabled={!!ocupado} onClick={() => guardarCredenciales(d)}><Save size={15} style={ic} /> {ocupado === "cred" ? "Guardando…" : credGuardada ? "Reemplazar credenciales" : "Guardar credenciales"}</button>
              {credMsg && <div role="status" style={{ ...aviso(credMsg.tipo), marginTop: 8 }}>{credMsg.texto}</div>}
            </div>
          </>
        )}
      </Grupo>
      <Grupo ariaLabel="Conexión y pruebas">
        <button type="button" aria-expanded={abrirCat} onClick={() => setAbrirCat((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 48, padding: "0 14px", border: "none", background: "transparent", color: K.ink, fontSize: 15, cursor: "pointer" }}>
          <span>Conexión, catálogos y pruebas</span><ChevronDown size={18} style={{ ...ic, color: K.mute, transform: abrirCat ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
        {abrirCat && <div style={{ padding: "4px 14px 14px", borderTop: `0.5px solid ${K.line}` }}><PasoCatalogos {...catProps} ajustes={d} prov={prov} modo={d.modo} credOk={!!(prov && (prov.campos.length === 0 || credGuardada))} /></div>}
      </Grupo>
    </>
  );
}

function Bloque4({ d, set, err }) {
  return (
    <Grupo ariaLabel="Reglas tributarias">
      <FilaIos etiqueta="Tipo de documento" error={err("tipoDocumento")} info={<InfoTip titulo="Pregúntale a tu contador">Estas opciones dependen de cómo está inscrito tu restaurante ante la DIAN (RUT): factura de venta o documento equivalente POS, INC o IVA, y si los precios de la carta ya incluyen el impuesto.</InfoTip>}>
        <Selector value={d.tipoDocumento} onChange={set("tipoDocumento")} titulo="Tipo de documento" opciones={opciones(CORTO.tipo)} style={selFila} />
      </FilaIos>
      {d.tipoDocumento === "pos" && (
        <FilaIos etiqueta="Convertir sobre 5 UVT" info={<InfoTip titulo="Conversión automática a Factura Electrónica">El Documento Equivalente POS tiene un tope de 5 UVT por documento (Resolución DIAN 000165). Si está activo, las cuentas que lo superen se emiten como Factura Electrónica de Venta.</InfoTip>}>
          <Interruptor etiqueta="Conversión automática a Factura Electrónica (mayor a 5 UVT)" valor={d.convertirPos !== false} onChange={set("convertirPos")} />
        </FilaIos>
      )}
      <FilaIos etiqueta="Impuesto" error={err("impuesto")}><Selector value={d.impuesto} onChange={set("impuesto")} titulo="Impuesto aplicable" opciones={opciones(CORTO.impuesto)} style={selFila} /></FilaIos>
      <FilaIos etiqueta="Precios de la carta" error={err("precios")}><Selector value={d.precios} onChange={set("precios")} titulo="Precios de la carta" opciones={opciones(CORTO.precios)} style={selFila} /></FilaIos>
      <FilaIos etiqueta="Propina voluntaria" error={err("propina")} info={<InfoTip titulo="Propina voluntaria">Excluir (recomendado): la propina no sale en el documento electrónico. Incluir: sale como ingreso para terceros (no gravado); pídele confirmación a tu contador y elige el ítem de propinas en la relación de catálogos.</InfoTip>}>
        <Selector value={d.propina} onChange={set("propina")} titulo="Propina voluntaria" opciones={opciones(CORTO.propina)} style={selFila} />
      </FilaIos>
      <FilaIos etiqueta="Valor UVT (COP)" error={err("valorUvt")} info={<InfoTip titulo="Valor de la UVT">Con este valor la caja avisa cuando una cuenta supera 5 UVT. Confírmalo cada enero con la DIAN.</InfoTip>}>
        <input style={inputIos} aria-label="Valor de la UVT" inputMode="numeric" maxLength={7} value={String(d.valorUvt ?? "")} onChange={(x) => set("valorUvt")(x.target.value === "" ? "" : Number(soloDigitos(x.target.value, 7)))} />
      </FilaIos>
      <FilaIos etiqueta="Venta sin cédula" ultima info={<InfoTip titulo="Consumidor Final">Si está activo y al cobrar no se escribe documento del cliente, la factura sale a «Consumidor Final» (222222222222) con el correo oficial del restaurante. Si está apagado, Caja exige los datos del cliente.</InfoTip>}>
        <Interruptor etiqueta="Permitir venta sin cédula (Consumidor Final)" valor={d.consumidorFinal !== false} onChange={set("consumidorFinal")} />
      </FilaIos>
    </Grupo>
  );
}

function Bloque5({ d, setRes, err, folios, estadoRes, sincronizar, ocupado, docs }) {
  const r = d.resolucion;
  return (
    <Grupo ariaLabel="Resolución y numeración">
      <FilaIos etiqueta="Prefijo" error={err("resolucion.prefijo")} info={<InfoTip titulo="Resolución de facturación">Estos datos salen del documento «Resolución de facturación» que te entregó la DIAN. Tu proveedor también los muestra. En Pruebas son opcionales; en Producción son obligatorios.</InfoTip>}>
        <input style={inputIos} aria-label="Prefijo" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={4} value={r.prefijo} onChange={(x) => setRes("prefijo")(x.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
      </FilaIos>
      <FilaIos etiqueta="Resolución" error={err("resolucion.numero")}><input style={inputIos} aria-label="Número de resolución" inputMode="numeric" maxLength={20} value={r.numero} onChange={(x) => setRes("numero")(soloDigitos(x.target.value, 20))} /></FilaIos>
      <ParIos a={{ etiqueta: "Rango desde", control: <input style={inputPar} aria-label="Rango desde" inputMode="numeric" maxLength={12} value={r.desde} onChange={(x) => setRes("desde")(soloDigitos(x.target.value, 12))} />, error: err("resolucion.desde") }}
        b={{ etiqueta: "Rango hasta", control: <input style={inputPar} aria-label="Rango hasta" inputMode="numeric" maxLength={12} value={r.hasta} onChange={(x) => setRes("hasta")(soloDigitos(x.target.value, 12))} />, error: err("resolucion.hasta") }} />
      <FilaIos etiqueta="Consecutivo actual" error={err("resolucion.siguiente")} info={<InfoTip titulo="Consecutivo actual">Es el siguiente número a emitir. Si lo dejas vacío es igual a «Rango desde». Cámbialo si vienes de otro sistema o si facturaste a mano en el portal de tu proveedor. La app no asigna números: lo hace el proveedor; este valor solo sirve para contar los folios que quedan.</InfoTip>}>
        <input style={inputIos} aria-label="Consecutivo actual" inputMode="numeric" maxLength={12} placeholder={r.desde || ""} value={r.siguiente || ""} onChange={(x) => setRes("siguiente")(soloDigitos(x.target.value, 12))} />
      </FilaIos>
      <FilaIos etiqueta="Sincronizar" info={<InfoTip titulo="Sincronizar consecutivo">Toma el último número emitido desde esta app y deja el siguiente como consecutivo actual. No lee el portal del proveedor: si facturaste allí, escribe tú el número.</InfoTip>}>
        <button type="button" style={{ ...btn, minHeight: 44 }} disabled={!!ocupado} onClick={() => sincronizar(docs)}><RefreshCw size={15} style={ic} /> Sincronizar consecutivo</button>
      </FilaIos>
      <ParIos a={{ etiqueta: "Vigente desde", control: <CampoFecha value={r.vigenciaDesde} onChange={setRes("vigenciaDesde")} opcional titulo="Vigente desde" placeholder="Elegir" style={selPar} />, error: err("resolucion.vigenciaDesde") }}
        b={{ etiqueta: "Vigente hasta", control: <CampoFecha value={r.vigenciaHasta} onChange={setRes("vigenciaHasta")} opcional titulo="Vigente hasta" placeholder="Elegir" style={selPar} />, error: err("resolucion.vigenciaHasta") }} />
      <FilaIos etiqueta="Folios restantes" ultima>
        <span data-testid="estado-folios" style={{ fontWeight: 600, color: K.ink }}>{folios.estado === "sin_datos" ? "–" : `${folios.disponibles.toLocaleString("es-CO")} de ${folios.total.toLocaleString("es-CO")}`}</span>
      </FilaIos>
    </Grupo>
  );
}

/* ───────── resumen de solo lectura ───────── */
const V = (x) => (x === undefined || x === null || String(x).trim() === "" ? "–" : String(x));
function Resumen({ n, a, estadoRes, folios, credTexto, mapeoTexto }) {
  const e = a.emisor, r = a.resolucion;
  const fila = (et, val, ultima, tid) => <FilaIos key={et} etiqueta={et} ultima={ultima}><span data-testid={tid} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{val}</span></FilaIos>;
  const filas = {
    1: [["Razón social", V(e.razonSocial)], ["NIT", e.nit ? `${e.nit}-${calcularDv(e.nit)}` : "–"], ["Responsabilidad", e.regimen ? RESP[COD[e.regimen]] : "–"], ["Municipio", e.municipio ? `${e.municipio}${e.codigoDane ? ` · ${e.codigoDane}` : ""}` : "–"], ["Dirección", V(e.direccion)], ["Teléfono", V(e.telefono)], ["Correo oficial", V(e.correo)]],
    2: [["Facturación activa", a.activa ? "Sí" : "No"], ["Ambiente", CORTO.modo[a.modo]], ["Emisión automática", a.emisionAutomatica ? "Sí" : "No"]],
    3: [["Proveedor", (proveedorPorValor(a.proveedor) || {}).etiqueta || "–"], ["Credenciales", credTexto], ["Catálogos", mapeoTexto]],
    4: [["Tipo de documento", CORTO.tipo[a.tipoDocumento]], ...(a.tipoDocumento === "pos" ? [["Convertir sobre 5 UVT", a.convertirPos !== false ? "Sí" : "No"]] : []), ["Impuesto", CORTO.impuesto[a.impuesto]], ["Precios de la carta", CORTO.precios[a.precios]], ["Propina voluntaria", CORTO.propina[a.propina]], ["Valor UVT", `$${Number(a.valorUvt || 0).toLocaleString("es-CO")}`], ["Venta sin cédula", a.consumidorFinal !== false ? "Sí" : "No"]],
    5: [["Prefijo", V(r.prefijo)], ["Resolución", V(r.numero)], ["Rango", r.desde && r.hasta ? `${r.desde} – ${r.hasta}` : "–"], ["Consecutivo actual", V(r.siguiente || r.desde)], ["Vigencia", r.vigenciaDesde && r.vigenciaHasta ? `${r.vigenciaDesde} → ${r.vigenciaHasta}` : "–"], ["Estado", { sin_configurar: "Sin configurar", vigente: `Vigente${estadoRes.dias != null ? ` · ${estadoRes.dias} días` : ""}`, por_vencer: `Vence en ${estadoRes.dias} días`, vencida: "Vencida", aun_no_rige: "Aún no rige" }[estadoRes.estado]], ["Folios restantes", folios.estado === "sin_datos" ? "–" : `${folios.disponibles.toLocaleString("es-CO")} de ${folios.total.toLocaleString("es-CO")}`]],
  }[n];
  return filas.map(([et, val], i) => fila(et, val, i === filas.length - 1, et === "Estado" ? "estado-resolucion" : undefined));
}

const CAMPOS_BLOQUE = { 1: ["emisor"], 2: ["activa", "modo", "emisionAutomatica"], 3: ["proveedor"], 4: ["tipoDocumento", "convertirPos", "impuesto", "precios", "propina", "valorUvt", "consumidorFinal"], 5: ["resolucion"] };
/* Hoja para editar UN bloque: trabaja sobre una copia y solo guarda con «Guardar». (Va fuera del panel para no reiniciarse en cada cambio.) */
function HojaEditar({ n, b, guardado, onCerrar, ocupado, renderBloque, setters, validar, guardarConConfirmacion }) {
  const [d, setD] = useState(() => ({ ...b, emisor: { ...b.emisor }, resolucion: { ...b.resolucion } }));
  const [intento, setIntento] = useState(false);
  const [errs, setErrs] = useState({});
  const S = setters(setD);
  const errf = (k) => (intento && errs[k]) || "";
  const sucioD = JSON.stringify(validarAjustes(d).valor) !== JSON.stringify(validarAjustes(guardado).valor);
  return createPortal(
    <Hoja onCerrar={onCerrar} ancho={520} gap={12} label={`Editar ${TITULOS[n - 1]}`} z={70}>
      {({ cerrar }) => (
        <>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: K.ink }}>{TITULOS[n - 1]}</div>
          {renderBloque(n, d, S, errf, sucioD)}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" style={{ ...btn, flex: 1 }} disabled={ocupado === "guardar"} onClick={cerrar}>Cancelar</button>
            <button type="button" style={{ ...primario, opacity: ocupado === "guardar" ? 0.5 : 1 }} disabled={ocupado === "guardar"} onClick={() => {
              const nuevo = { ...guardado }; CAMPOS_BLOQUE[n].forEach((k) => { nuevo[k] = d[k]; });
              const v = validar(nuevo); setIntento(true); setErrs(v.errores);
              if (!v.ok) return;
              guardarConConfirmacion(nuevo, (r) => { if (r.ok) onCerrar(); });
            }}><Save size={15} style={ic} /> {ocupado === "guardar" ? "Guardando…" : "Guardar"}</button>
          </div>
          {intento && Object.keys(errs).length > 0 && <div role="alert" style={aviso("error")}>{Object.values(errs)[0]}</div>}
        </>
      )}
    </Hoja>, document.body);
}

export function PanelFacturacion({ usuarioActual, onClose }) {
  const [ajustes, setAjustes] = useState(null);          // lo guardado (null = cargando)
  const [b, setB] = useState(null);                       // borrador / valores vigentes
  const [paso, setPaso] = useState(1);                    // asistente
  const [hint, setHint] = useState(undefined);
  const [cred, setCred] = useState({});
  const [verSecreto, setVerSecreto] = useState(false);
  const [credMsg, setCredMsg] = useState(null);
  const [msg, setMsg] = useState(null);                   // { tipo, texto }
  const [ocupado, setOcupado] = useState("");
  const [catalogo, setCatalogo] = useState(null);
  const [mapeo, setMapeo] = useState(conMapeoVacio(MAPEO_VACIO));
  const [abrirCat, setAbrirCat] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [editar, setEditar] = useState(null);             // número de bloque en edición (hoja)
  const [confirmar, setConfirmar] = useState(null);       // { titulo, texto, accion }
  const documentos = useDocumentosFiscales(true);

  useEffect(() => subscribeShared("facturacion/ajustes", {}, (a) => {
    setAjustes(a || {});
    setB((prev) => prev || (a && a.actualizadoTs ? conDefectos(a) : (() => { const x = conDefectos(a); return { ...x, emisor: { ...x.emisor, municipio: x.emisor.municipio || MUNICIPIO_POR_DEFECTO, codigoDane: x.emisor.codigoDane || (municipioPorNombre(MUNICIPIO_POR_DEFECTO) || {}).dane || "" } }; })()));
  }), []);
  const modo = b ? b.modo : null;
  useEffect(() => { if (!modo) return undefined; setHint(undefined); return subscribeShared(`facturacion/credencial/${modo}`, null, setHint); }, [modo]);
  useEffect(() => { if (!modo) return undefined; setCatalogo(null); return subscribeShared(`facturacion/catalogo/${modo}`, null, setCatalogo); }, [modo]);
  useEffect(() => { if (!modo) return undefined; setMapeo(conMapeoVacio(MAPEO_VACIO)); return subscribeShared(`facturacion/mapeo/${modo}`, null, (m) => setMapeo(conMapeoVacio(m))); }, [modo]);

  const listaDocs = useMemo(() => Object.values(documentos || {}), [documentos]);
  if (!b || !ajustes) return (<><CabeceraAdmin titulo="Facturación electrónica" onClose={onClose} /><div className="ancho" style={{ padding: 16, color: K.mute }}>Cargando…</div></>);

  const guardado = conDefectos(ajustes);
  const configurado = !!ajustes.actualizadoTs;
  const hoy = hoyBogota();
  const credDe = (x) => { const p = proveedorPorValor(x.proveedor); return !!(p && (p.campos.length === 0 || (hint && hint.proveedor === x.proveedor))); };
  const validar = (x) => validarAjustes(x, { credencialConfigurada: credDe(x), hoy, propinaMapeada: !!mapeo.propina });
  const prov = proveedorPorValor(b.proveedor);
  const resB = estadoResolucion(b.resolucion, hoy);
  const ultimoB = ultimoEfectivo(b.resolucion, ultimoConsecutivo(listaDocs, b.resolucion.prefijo));
  const foliosB = estadoFolios(b.resolucion, ultimoB);
  const alertas = alertasResolucion({ resolucion: b.resolucion, hoy, ultimo: ultimoB, estadoRes: resB });
  const catV = catalogo || { resoluciones: [], impuestos: [], mediosPago: [], productos: [], vendedores: [] };
  const mapeoTexto = validarMapeo(mapeo, { proveedor: b.proveedor, ajustes: b, catalogo: b.proveedor === "simulado" && !catalogo ? null : catV }).ok ? "Completos" : "Pendientes";
  const credTexto = prov ? (prov.campos.length === 0 ? "No necesita" : (hint && hint.proveedor === b.proveedor ? `Configurado (${hint.mascara})` : "Sin configurar")) : "–";

  const llamar = async (solicitud) => {
    try { return await solicitarFacturacion(solicitud); }
    catch (e) { return { status: 0, cuerpo: { ok: false, mensaje: e instanceof ErrorReintentable ? "Necesitas internet para esto." : "No se pudo completar. Inténtalo de nuevo." } }; }
  };
  const guardarCredenciales = async (x) => {
    setCredMsg(null); setOcupado("cred");
    const r = await llamar({ accion: "guardar_credenciales", proveedor: x.proveedor, modo: x.modo, credenciales: cred });
    setOcupado("");
    if (r.cuerpo && r.cuerpo.ok) { setCred({}); setVerSecreto(false); setCredMsg({ tipo: "ok", texto: "Credenciales guardadas y cifradas para este ambiente. Ahora toca «Probar conexión»." }); }
    else setCredMsg({ tipo: "error", texto: (r.cuerpo && r.cuerpo.mensaje) || "No se pudieron guardar.", errores: r.cuerpo && r.cuerpo.errores });
  };
  /* ¿Hace falta confirmar? Producción o cambios en la resolución ya guardada. */
  const textoConfirmacion = (nuevo) => {
    const t = [];
    if (nuevo.modo === "produccion" && guardado.modo !== "produccion") t.push("Vas a pasar a Producción: cada factura tendrá validez fiscal real ante la DIAN.");
    const rv = validarResolucion(nuevo.resolucion).valor, rg = validarResolucion(guardado.resolucion).valor;
    if (configurado && rg.numero && JSON.stringify(rv) !== JSON.stringify(rg)) t.push("Vas a modificar la resolución DIAN: revisa que el prefijo, el rango, el consecutivo y la vigencia coincidan con tu documento.");
    return t;
  };
  const persistir = async (nuevo) => {
    const v = validar(nuevo);
    if (!v.ok) return { ok: false, texto: Object.values(v.errores)[0], errores: v.errores };
    setOcupado("guardar");
    const ok = await saveShared("facturacion/ajustes", { ...v.valor, actualizadoTs: Date.now(), actualizadoPor: String((usuarioActual && usuarioActual.nombre) || "").slice(0, 120) });
    setOcupado("");
    if (!ok) return { ok: false, texto: "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo." };
    setB(conDefectos(v.valor));
    return { ok: true };
  };
  /* Guarda `nuevo` (con confirmación si aplica). `fin` se llama con el resultado. */
  const guardarConConfirmacion = (nuevo, fin) => {
    const v = validar(nuevo);
    if (!v.ok) { setMsg({ tipo: "error", texto: Object.values(v.errores)[0] }); fin({ ok: false, texto: Object.values(v.errores)[0], errores: v.errores }); return; }
    const hacer = async () => { const r = await persistir(nuevo); setMsg(r.ok ? { tipo: "ok", texto: "Configuración guardada." } : { tipo: "error", texto: r.texto }); fin(r); };
    const t = textoConfirmacion(nuevo);
    if (t.length) setConfirmar({ titulo: "¿Confirmas el cambio?", texto: t.join(" "), accion: hacer, cancelar: () => fin({ ok: false, cancelado: true }) });
    else hacer();
  };

  const cambiarActiva = (v) => {
    if (!configurado) { setB((x) => ({ ...x, activa: v })); return; }
    setMsg(null);
    guardarConConfirmacion({ ...guardado, activa: v }, () => {});
  };

  const setCampo = (setter) => (k) => (v) => { setter((x) => ({ ...x, [k]: v })); setMsg(null); };
  const catProps = (x, sucio) => ({ catalogo, mapeo, setMapeo, sucio, llamar, ocupado, setOcupado });
  const ctxProv = (x, sucio) => ({ hint, cred, setCred, credMsg, guardarCredenciales, ocupado, verSecreto, setVerSecreto, abrirCat, setAbrirCat, catProps: catProps(x, sucio) });

  /* ───────── cabecera de estado ───────── */
  const cabecera = (
    <section aria-label="Estado de la facturación" style={{ borderRadius: 14, border: `1px solid ${K.line}`, background: "var(--c-fffdf8-b)", overflow: "hidden" }}>
      <FilaIos etiqueta="Facturación electrónica activa"><Interruptor etiqueta="Facturación electrónica activa" valor={b.activa} onChange={cambiarActiva} disabled={ocupado === "guardar"} /></FilaIos>
      <ParIos ultima
        a={{ etiqueta: "Ambiente", control: <span data-testid="ambiente" style={{ padding: "4px 12px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: b.modo === "produccion" ? "var(--chip-on-bg)" : K.bg, color: b.modo === "produccion" ? "var(--chip-on-fg)" : K.ink, border: `1px solid ${K.line}` }}>{b.modo === "produccion" ? "Producción" : "Pruebas"}</span> }}
        b={{ etiqueta: "Folios disponibles", control: <span data-testid="folios-disponibles" style={{ fontSize: 17, fontWeight: 700, color: foliosB.estado === "agotada" || foliosB.estado === "por_agotarse" ? K.error : K.ink }}>{foliosB.estado === "sin_datos" ? "–" : foliosB.disponibles.toLocaleString("es-CO")}</span> }} />
    </section>
  );

  /* ───────── asistente (sin configuración guardada) ───────── */
  const erroresPaso = (n, x) => {
    const e = {};
    if (n === 1) Object.entries(validarEmisor(x.emisor, { exigir: true }).errores).forEach(([k, v]) => { e[`emisor.${k}`] = v; });
    if (n === 3) {
      const p = proveedorPorValor(x.proveedor);
      if (!p) e.proveedor = "Elige un proveedor tecnológico.";
      else if (x.proveedor === "simulado" && x.modo === "produccion") e.proveedor = "El proveedor Simulado solo sirve en Pruebas: no tiene validez ante la DIAN.";
      else if (p.campos.length > 0 && !credDe(x)) e.credenciales = "Guarda las credenciales del proveedor para continuar.";
    }
    if (n === 4) { const v = validar({ ...x, activa: false }).errores; ["tipoDocumento", "impuesto", "precios", "propina", "valorUvt"].forEach((k) => { if (v[k]) e[k] = v[k]; }); }
    if (n === 5) Object.entries(validarResolucion(x.resolucion, { exigir: x.modo === "produccion" && x.proveedor !== "simulado" }).errores).forEach(([k, v]) => { e[`resolucion.${k}`] = v; });
    return e;
  };
  const E = configurado ? {} : erroresPaso(paso, b);
  const err = (k) => (intentado && (E[k] || (k === "credenciales" && E.credenciales))) || "";
  const siguiente = () => {
    setIntentado(true);
    if (Object.keys(erroresPaso(paso, b)).length) return;
    if (paso < 5) { setPaso(paso + 1); setIntentado(false); setMsg(null); return; }
    guardarConConfirmacion(b, () => {});
  };

  const setters = (setter) => ({
    set: setCampo(setter),
    setEm: (k) => (v) => { setter((x) => ({ ...x, emisor: { ...x.emisor, [k]: v } })); setMsg(null); },
    setRes: (k) => (v) => { setter((x) => ({ ...x, resolucion: { ...x.resolucion, [k]: v } })); setMsg(null); },
  });
  const renderBloque = (n, d, S, errf, sucio) => {
    const res = estadoResolucion(d.resolucion, hoy);
    const fol = estadoFolios(d.resolucion, ultimoEfectivo(d.resolucion, ultimoConsecutivo(listaDocs, d.resolucion.prefijo)));
    if (n === 1) return <Bloque1 d={d} setEm={S.setEm} err={errf} />;
    if (n === 2) return <Bloque2 d={d} set={S.set} err={errf} />;
    if (n === 3) return <Bloque3 d={d} set={S.set} err={errf} ctx={ctxProv(d, sucio)} />;
    if (n === 4) return <Bloque4 d={d} set={S.set} err={errf} />;
    return <Bloque5 d={d} setRes={S.setRes} err={errf} folios={fol} estadoRes={res} sincronizar={(docs) => { const desde = Number(d.resolucion.desde), hasta = Number(d.resolucion.hasta); if (!(desde >= 1) || !(hasta >= desde)) return; const sig = Math.min(Math.max(ultimoConsecutivo(docs, d.resolucion.prefijo) + 1, desde), hasta); S.setRes("siguiente")(String(sig)); }} ocupado={ocupado} docs={listaDocs} />;
  };

  const wizard = () => {
    const S = setters(setB);
    return (
      <>
        <div aria-label={`Paso ${paso} de 5`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: K.mute, fontWeight: 600 }}>Paso {paso} de 5</div>
          <div style={{ display: "flex", gap: 4 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= paso ? K.verde : K.line }} />)}</div>
          <h2 style={{ margin: "6px 6px 0", fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: K.mute }}>{TITULOS[paso - 1]}</h2>
        </div>
        {renderBloque(paso, b, S, err, false)}
        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          {paso > 1 && <button type="button" style={{ ...btn, minWidth: 110 }} disabled={ocupado === "guardar"} onClick={() => { setPaso(paso - 1); setIntentado(false); }}><ChevronLeft size={16} style={ic} /> Atrás</button>}
          <button type="button" style={{ ...primario, opacity: ocupado === "guardar" ? 0.5 : 1 }} disabled={ocupado === "guardar"} onClick={siguiente}>
            {paso < 5 ? <>Siguiente <ChevronRight size={16} style={ic} /></> : <><Save size={15} style={ic} /> {ocupado === "guardar" ? "Guardando…" : "Guardar configuración"}</>}
          </button>
        </div>
      </>
    );
  };

  /* ───────── tarjetas resumen + hoja de edición ───────── */
  const tarjetas = (
    <>
      {[1, 2, 3, 4, 5].map((n) => (
        <Grupo key={n} titulo={TITULOS[n - 1]} testid={`tarjeta-${n}`} accion={<BotonTexto ariaLabel={`Editar ${TITULOS[n - 1]}`} onClick={() => { setMsg(null); setCredMsg(null); setCred({}); setEditar(n); }}>Editar</BotonTexto>}>
          <Resumen n={n} a={b} estadoRes={resB} folios={foliosB} credTexto={credTexto} mapeoTexto={mapeoTexto} />
        </Grupo>
      ))}
    </>
  );

  const confirmacion = () => createPortal(
    <Hoja onCerrar={() => { confirmar.cancelar && confirmar.cancelar(); setConfirmar(null); }} ancho={420} gap={12} label={confirmar.titulo} z={90}>
      {({ cerrar }) => (
        <>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: K.ink, textAlign: "center" }}>{confirmar.titulo}</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.5, color: K.sub, textAlign: "center" }}>{confirmar.texto}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" style={{ ...btn, flex: 1 }} onClick={cerrar}>Cancelar</button>
            <button type="button" style={primario} onClick={() => { const a = confirmar.accion; setConfirmar(null); a(); }}>Confirmar</button>
          </div>
        </>
      )}
    </Hoja>, document.body);

  return (
    <>
      <CabeceraAdmin titulo="Facturación electrónica" onClose={onClose} />
      <div className="ancho" style={{ overflowY: "auto", flex: 1, padding: "8px 14px 40px", display: "flex", flexDirection: "column", gap: 16, fontFamily: "var(--font-body)" }}>
        {cabecera}
        <AlertasFiscales alertas={alertas} testid="alertas-config" />
        {configurado ? tarjetas : wizard()}
        <div role="status" aria-live="polite" data-testid="mensaje-guardado" style={{ ...aviso(msg && msg.tipo), textAlign: "center", minHeight: 18 }}>{msg && msg.texto}</div>
      </div>
      {editar && <HojaEditar n={editar} b={b} guardado={guardado} onCerrar={() => setEditar(null)} ocupado={ocupado} renderBloque={renderBloque} setters={setters} validar={validar} guardarConConfirmacion={guardarConConfirmacion} />}
      {confirmar && confirmacion()}
    </>
  );
}
export default PanelFacturacion;

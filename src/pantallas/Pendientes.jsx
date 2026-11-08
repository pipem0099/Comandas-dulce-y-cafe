import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X, Clock, Check, AlertTriangle, Phone, Download, Ban } from "lucide-react";
import { styles } from "../estilos.js";
import { money, uid } from "../logica.js";
import { METODO_META } from "../constantes.js";
import { EmptyState } from "../extras.jsx";
import { Hoja } from "../componentes/Hoja.jsx";
import { CampoMonto, MetodoPills } from "../componentes/Comunes.jsx";
import { CampoFecha } from "../componentes/Campos.jsx";
import { getCollectionRange } from "../firebase.js";
import { cobrarPendiente, condonarPendiente } from "../deudasOps.js";
import { exportarDeudas } from "../exportar.js";
import { buscarDeudas, totalPendiente, antiguedadLabel, diasDesde, clienteEtiqueta } from "../deudas.js";
import { tieneRol, dateTimeLabel } from "../utilidades.js";

/* ---------------- CUENTAS PENDIENTES ----------------
 * Cajero y administrador: buscan por nombre / teléfono / documento / fecha y cobran la deuda (completa o por abonos).
 * Solo el administrador puede condonar, ver las ya resueltas (pagadas y condonadas) y descargar el reporte.
 * La lista en vivo trae únicamente las pendientes; las resueltas se piden bajo demanda al elegir ese filtro. */

const DIAS_RESUELTAS = 90;      // sin fechas elegidas, las resueltas que se consultan son las de los últimos 90 días
const DIAS_ANTIGUA = 7;         // desde cuántos días una deuda se marca como "antigua"

const lista = (x) => (Array.isArray(x) ? x : Object.values(x || {})).filter(Boolean);

export function PendientesView({ deudas, usuarioActual, turnoAbierto, config }) {
  const esAdmin = tieneRol(usuarioActual, "admin");
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [resueltas, setResueltas] = useState(null);   // null = cargando
  const [selId, setSelId] = useState(null);
  const buscadorRef = useRef(null);

  // Las resueltas (pagadas / condonadas) no están en la lista en vivo: se piden al elegir ese filtro (solo administrador).
  useEffect(() => {
    if (!esAdmin || estado === "pendiente") return;
    let cancelado = false;
    setResueltas(null);
    const ini = desde ? new Date(`${desde}T00:00:00`).getTime() : Date.now() - DIAS_RESUELTAS * 86400000;
    const fin = hasta ? new Date(`${hasta}T23:59:59`).getTime() : Date.now() + 86400000;
    getCollectionRange("deudas", "ts", ini, fin).then((r) => { if (!cancelado) setResueltas(r); });
    return () => { cancelado = true; };
  }, [esAdmin, estado, desde, hasta]);

  const fuente = estado === "pendiente" ? deudas : (resueltas || []);
  const filtradas = useMemo(() => buscarDeudas(fuente, { texto, desde, hasta, estado }), [fuente, texto, desde, hasta, estado]);
  const seleccionada = (selId && (deudas.find((d) => d.id === selId) || (resueltas || []).find((d) => d.id === selId))) || null;
  const hayFiltro = texto || desde || hasta;

  const pendientes = deudas.filter((d) => d.estado === "pendiente");
  const masAntigua = pendientes.length > 0 ? Math.min(...pendientes.map((d) => d.ts)) : null;
  const sumaFiltradas = filtradas.reduce((s, d) => s + (estado === "condonada" ? d.saldoCondonado || 0 : estado === "pagada" ? lista(d.cobros).reduce((a, c) => a + (c.monto || 0), 0) : d.saldo || 0), 0);

  return (
    <div className="ancho" style={styles.menuScroll}>
      <div style={cj.resumen}>
        <div style={cj.resCelda}><span style={cj.resEt}>Por cobrar</span><span style={cj.resGrande}>{money(totalPendiente(deudas))}</span></div>
        <div style={cj.resCelda}><span style={cj.resEt}>Pendientes</span><span style={cj.resNum}>{pendientes.length}</span></div>
        <div style={{ ...cj.resCelda, borderRight: "none" }}><span style={cj.resEt}>Más antigua</span><span style={cj.resNum}>{masAntigua ? antiguedadLabel(masAntigua) : "—"}</span></div>
      </div>

      {!turnoAbierto && (
        <div style={{ ...styles.warnBanner, marginBottom: 10 }}><AlertTriangle size={14} /> Abre el turno para poder cobrar. Mientras tanto puedes consultar las deudas.</div>
      )}

      <div className="campo-prefijo" style={cj.buscador}>
        <Search size={16} color="var(--c-8a8272-t)" />
        <input ref={buscadorRef} style={cj.buscadorInput} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nombre, teléfono o documento" aria-label="Buscar cuenta pendiente" />
        {texto && <button className="toque44" style={cj.buscadorX} aria-label="Borrar búsqueda" onClick={() => { setTexto(""); buscadorRef.current && buscadorRef.current.focus(); }}><X size={13} /></button>}
      </div>

      <div style={cj.fechas}>
        <div style={cj.fechaCampo}><span style={cj.resEt}>Desde</span><CampoFecha opcional value={desde} max={hasta || undefined} onChange={setDesde} placeholder="Cualquier fecha" titulo="Desde" /></div>
        <div style={cj.fechaCampo}><span style={cj.resEt}>Hasta</span><CampoFecha opcional value={hasta} min={desde || undefined} onChange={setHasta} placeholder="Cualquier fecha" titulo="Hasta" /></div>
      </div>
      {(desde || hasta) && <button className="toque44" style={{ ...cj.limpiar, marginTop: 6 }} onClick={() => { setDesde(""); setHasta(""); }}>Quitar fechas</button>}

      {esAdmin && (
        <div style={cj.chips} role="tablist" aria-label="Estado de las cuentas">
          {[["pendiente", "Pendientes"], ["pagada", "Pagadas"], ["condonada", "Condonadas"]].map(([k, et]) => (
            <button key={k} role="tab" aria-selected={estado === k} style={{ ...styles.propinaPill, ...(estado === k ? styles.pillOn : {}), minHeight: 40 }} onClick={() => setEstado(k)}>{et}</button>
          ))}
          <button className="toque44" style={{ ...cj.limpiar, marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }} disabled={filtradas.length === 0} onClick={() => exportarDeudas(filtradas, config)}><Download size={14} /> Excel</button>
        </div>
      )}

      {esAdmin && estado !== "pendiente" && filtradas.length > 0 && (
        <div style={cj.sumaFila}>{filtradas.length} {filtradas.length === 1 ? "cuenta" : "cuentas"} · {estado === "condonada" ? "condonado" : "cobrado después"}: <b>{money(sumaFiltradas)}</b>{!desde && !hasta ? ` · últimos ${DIAS_RESUELTAS} días` : ""}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {estado !== "pendiente" && resueltas === null ? (
          <div style={cj.cargando}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <EmptyState icon={Clock} titulo={hayFiltro ? "Sin resultados" : estado === "pendiente" ? "No hay cuentas pendientes" : "Nada por aquí"}
            texto={hayFiltro ? "Prueba con otro nombre, teléfono o rango de fechas." : estado === "pendiente" ? "Cuando un cliente se vaya debiendo, la cuenta aparecerá aquí para cobrarla después." : "No hay cuentas en este estado para el periodo elegido."} />
        ) : filtradas.map((d) => {
          const antigua = d.estado === "pendiente" && diasDesde(d.ts) >= DIAS_ANTIGUA;
          return (
            <button key={d.id} style={{ ...cj.fila, ...(selId === d.id ? cj.filaOn : {}) }} onClick={() => setSelId(d.id)} aria-label={`Abrir cuenta pendiente de ${clienteEtiqueta(d.cliente)}`}>
              <div style={cj.filaTop}>
                <span style={cj.filaNombre}>{clienteEtiqueta(d.cliente)}</span>
                {antigua && <span style={{ ...cj.chip, background: "var(--c-fbefd9-b)", color: "var(--warn-text, #8a5a00)" }}>Antigua</span>}
                {d.estado === "pagada" && <span style={{ ...cj.chip, background: "var(--c-ede7d8-b)", color: "var(--pago-ok)" }}>Pagada</span>}
                {d.estado === "condonada" && <span style={{ ...cj.chip, background: "var(--c-ede7d8-b)", color: "var(--c-5c5648-t)" }}>Condonada</span>}
              </div>
              <div style={cj.filaSub}>
                {d.cliente && d.cliente.telefono ? `${d.cliente.telefono} · ` : ""}{d.lugar || `Mesa ${d.mesa}`} · {antiguedadLabel(d.ts)}
              </div>
              <div style={cj.filaBase}>
                <span style={cj.filaSub}>Total {money(d.total)}{d.pagadoAntes > 0 ? ` · pagó ${money(d.pagadoAntes)}` : ""}</span>
                <span style={cj.filaMonto}>{d.estado === "condonada" ? money(d.saldoCondonado || 0) : money(d.saldo)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {seleccionada && (
        <DetalleDeuda key={seleccionada.id} deuda={seleccionada} esAdmin={esAdmin} turnoAbierto={turnoAbierto} usuarioActual={usuarioActual}
          onCerrar={() => setSelId(null)} />
      )}
    </div>
  );
}

/* Detalle de una deuda: lo consumido, los cobros hechos, y (si sigue pendiente) cobrar o condonar. */
function DetalleDeuda({ deuda, esAdmin, turnoAbierto, usuarioActual, onCerrar }) {
  const pendiente = deuda.estado === "pendiente";
  const [metodo, setMetodo] = useState("efectivo");
  const [monto, setMonto] = useState("");          // vacío = el saldo completo
  const [recibido, setRecibido] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [reintento, setReintento] = useState(null); // cobro que quedó a medias: se reintenta con el MISMO id (no cobra doble)
  const [condonando, setCondonando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const cobros = lista(deuda.cobros);
  const montoNum = Math.round(Number(String(monto).replace(/\D/g, "")) || 0);
  const aCobrar = reintento ? reintento.monto : (montoNum > 0 ? montoNum : deuda.saldo);
  const valido = aCobrar >= 1 && aCobrar <= deuda.saldo;
  const recibidoNum = Math.round(Number(String(recibido).replace(/\D/g, "")) || 0);
  const vuelto = metodo === "efectivo" && recibidoNum > 0 ? recibidoNum - aCobrar : 0;
  const quedaria = deuda.saldo - aCobrar;

  const cobrar = async () => {
    if (!turnoAbierto || !valido || procesando) return;
    setProcesando(true);
    try {
      const pago = reintento || { id: uid(), metodoPago: metodo, monto: aCobrar, procesadoPor: usuarioActual.nombre };
      const r = await cobrarPendiente({ deuda, pago, usuario: usuarioActual });
      if (r.ok) { onCerrar(); return; }
      if (r.parcial) setReintento(pago);
    } finally { setProcesando(false); }
  };

  const condonar = async () => {
    if (!motivo.trim() || procesando) return;
    setProcesando(true);
    try {
      const r = await condonarPendiente({ deuda, motivo, usuario: usuarioActual });
      if (r.ok) onCerrar();
    } finally { setProcesando(false); }
  };

  return createPortal(
    <Hoja onCerrar={onCerrar} ancho={500} gap={12} label={`Cuenta pendiente de ${clienteEtiqueta(deuda.cliente)}`}>
      {({ cerrar }) => (
        <>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" }}>{clienteEtiqueta(deuda.cliente)}</div>
            <div style={{ fontSize: 13, color: "var(--c-5c5648-t)", lineHeight: 1.6, marginTop: 2 }}>
              {deuda.cliente && deuda.cliente.telefono && <a href={`tel:${String(deuda.cliente.telefono).replace(/[^\d+]/g, "")}`} style={{ color: "inherit", display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10 }}><Phone size={12} /> {deuda.cliente.telefono}</a>}
              {deuda.cliente && deuda.cliente.doc && <span style={{ marginRight: 10 }}>ID {deuda.cliente.doc}</span>}
              <div>{deuda.lugar || `Mesa ${deuda.mesa}`} · {dateTimeLabel(deuda.ts)} ({antiguedadLabel(deuda.ts)}){deuda.registradaPor ? ` · la dejó ${deuda.registradaPor}` : ""}</div>
            </div>
          </div>

          <div style={styles.saldoCard}>
            <span style={styles.saldoEt}>{deuda.estado === "condonada" ? "SALDO CONDONADO" : deuda.estado === "pagada" ? "DEUDA SALDADA" : "SALDO PENDIENTE"}</span>
            <span style={styles.saldoMonto}>{money(deuda.estado === "condonada" ? deuda.saldoCondonado || 0 : deuda.saldo)}</span>
            <div style={styles.saldoFila}><span>Total de la cuenta</span><b>{money(deuda.total)}</b></div>
            {deuda.pagadoAntes > 0 && <div style={styles.saldoFila}><span>Pagado ese día</span><b>{money(deuda.pagadoAntes)}</b></div>}
            {cobros.length > 0 && <div style={styles.saldoFila}><span>Cobrado después</span><b style={{ color: "var(--pago-ok)" }}>{money(cobros.reduce((s, c) => s + (c.monto || 0), 0))}</b></div>}
          </div>

          {deuda.nota && <div style={{ fontSize: 13, color: "var(--c-5c5648-t)", fontStyle: "italic" }}>“{deuda.nota}”</div>}

          {lista(deuda.items).length > 0 && (
            <div style={styles.pagosRegistradosBox}>
              <div style={styles.catLabel}>LO QUE CONSUMIERON</div>
              {lista(deuda.items).map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, color: "var(--c-242019-t)" }}>
                  <span>{it.qty}× {it.name}</span><span style={{ color: "var(--c-5c5648-t)" }}>{money(it.qty * it.price)}</span>
                </div>
              ))}
            </div>
          )}

          {cobros.length > 0 && (
            <div style={styles.pagosRegistradosBox}>
              <div style={styles.catLabel}>COBROS DESPUÉS</div>
              {cobros.map((c) => {
                const m = METODO_META[c.metodoPago];
                return (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, color: "var(--c-242019-t)" }}>
                    <span>{dateTimeLabel(c.ts)} · {m ? m.label : c.metodoPago}{c.procesadoPor ? ` · ${c.procesadoPor}` : ""}</span><b>{money(c.monto)}</b>
                  </div>
                );
              })}
            </div>
          )}

          {deuda.estado === "condonada" && deuda.condonacion && (
            <div style={styles.warnBanner}><Ban size={14} /> Condonada por {deuda.condonacion.por} el {dateTimeLabel(deuda.condonacion.ts)}: {deuda.condonacion.motivo}</div>
          )}

          {pendiente && !condonando && (
            <>
              {!turnoAbierto && <div style={styles.warnBanner}><AlertTriangle size={14} /> Abre el turno para poder cobrar esta cuenta.</div>}
              {reintento ? (
                <div style={styles.warnBanner}><AlertTriangle size={14} /> El cobro de {money(reintento.monto)} quedó a medias. Toca «Reintentar»: no se cobra doble.</div>
              ) : (
                <>
                  <div style={styles.catLabel}>COBRAR</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <CampoMonto value={monto} onChange={setMonto} placeholder={`Todo (${money(deuda.saldo)})`} onEnter={cobrar} />
                    <button style={{ ...styles.propinaPill, minHeight: 44, whiteSpace: "nowrap" }} onClick={() => setMonto(String(deuda.saldo))}>Todo</button>
                  </div>
                  <MetodoPills selected={metodo} onSelect={setMetodo} />
                  {metodo === "efectivo" && (
                    <>
                      <CampoMonto value={recibido} onChange={setRecibido} placeholder="Efectivo recibido (opcional)" />
                      {vuelto > 0 && <div style={{ ...styles.diferenciaBox, background: "var(--c-f1ecdd-b)" }}>Devolver: <b>{money(vuelto)}</b></div>}
                      {vuelto < 0 && <div style={styles.diferenciaBox}>Falta recibir: <b>{money(-vuelto)}</b></div>}
                    </>
                  )}
                  {montoNum > deuda.saldo && <div style={styles.diferenciaBox}>El abono no puede ser mayor al saldo ({money(deuda.saldo)}).</div>}
                </>
              )}
              <button style={{ ...styles.sendBtn, opacity: turnoAbierto && valido && !procesando ? 1 : 0.4 }} disabled={!turnoAbierto || !valido || procesando} onClick={cobrar}>
                <Check size={15} /> {procesando ? "Guardando…" : reintento ? `Reintentar cobro de ${money(aCobrar)}` : quedaria === 0 ? `Cobrar ${money(aCobrar)} y saldar` : `Registrar abono de ${money(aCobrar)} (quedan ${money(quedaria)})`}
              </button>
              {esAdmin && !reintento && (
                <button style={{ ...styles.cancelEditBtn, color: "var(--c-5c5648-t)" }} onClick={() => setCondonando(true)}><Ban size={14} /> Condonar esta deuda…</button>
              )}
            </>
          )}

          {pendiente && condonando && (
            <>
              <div style={styles.warnBanner}><AlertTriangle size={14} /> Se perdonan {money(deuda.saldo)} y la deuda queda cerrada. Esto queda registrado con tu nombre.</div>
              <input autoFocus style={styles.editInput} placeholder="Motivo (obligatorio)" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") condonar(); }} />
              <button style={{ ...styles.sendBtn, opacity: motivo.trim() && !procesando ? 1 : 0.4 }} disabled={!motivo.trim() || procesando} onClick={condonar}>{procesando ? "Guardando…" : `Condonar ${money(deuda.saldo)}`}</button>
              <button style={styles.cancelEditBtn} onClick={() => { setCondonando(false); setMotivo(""); }}>Volver</button>
            </>
          )}

          <button style={styles.cancelEditBtn} onClick={cerrar}>Cerrar</button>
        </>
      )}
    </Hoja>,
    document.body
  );
}

const cj = {
  buscador: { display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderRadius: 12, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)" },
  buscadorInput: { flex: 1, minWidth: 0, padding: "12px 0", border: "none", outline: "none", background: "transparent", color: "var(--c-242019-t)", fontSize: 14, fontFamily: "var(--font-body)" },
  buscadorX: { width: 24, height: 24, borderRadius: 12, border: "none", background: "var(--c-f1ecdd-b)", color: "var(--c-5c5648-t)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  resumen: { display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  resCelda: { display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 8, minHeight: 84, padding: "14px 14px 12px", borderRight: "1px solid var(--c-ede7d8-o)", minWidth: 0 },
  resEt: { fontSize: 12, color: "var(--c-8a8272-t)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 },
  resGrande: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--accent-t)", lineHeight: 1.1, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  resNum: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--c-242019-t)", lineHeight: 1.1, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  fechas: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },
  fechaCampo: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  limpiar: { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--c-e4dfce-o)", background: "transparent", color: "var(--c-5c5648-t)", fontSize: 13, cursor: "pointer", minHeight: 42 },
  chips: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 },
  sumaFila: { marginTop: 10, fontSize: 13, color: "var(--c-5c5648-t)" },
  cargando: { padding: 30, textAlign: "center", color: "var(--c-8a8272-t)", fontSize: 13 },
  fila: { display: "flex", flexDirection: "column", gap: 6, padding: "13px 14px", textAlign: "left", background: "var(--c-fffdf8-b)", borderWidth: 1.5, borderStyle: "solid", borderColor: "var(--c-e4dfce-o)", borderRadius: 16, cursor: "pointer", color: "var(--c-242019-t)" },
  filaOn: { borderColor: "var(--accent)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent)" },
  filaTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  filaNombre: { fontSize: 16, fontWeight: 700, color: "var(--c-242019-t)" },
  filaSub: { fontSize: 12, color: "var(--c-8a8272-t)" },
  filaBase: { display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--c-ede7d8-o)", paddingTop: 8, gap: 8 },
  filaMonto: { fontSize: 17, fontWeight: 800, color: "var(--c-242019-t)" },
  chip: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 },
};

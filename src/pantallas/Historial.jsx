import React, { useState, useEffect } from "react";
import { Ban, Download, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { money } from "../logica.js";
import { METODO_META } from "../constantes.js";
import { styles } from "../estilos.js";
import { exportarExcel } from "../exportar.js";
import { imprimir } from "../impresion.jsx";
import { Chevron, Despliegue } from "../componentes/Comunes.jsx";
import { Transicion } from "../movimiento.jsx";
import { mostrarComprobante } from "../comprobante.jsx";
import { HojaDia } from "../hojas.jsx";
import { FacturaCuenta } from "../componentes/FacturaCuenta.jsx";
import { useAjustesFiscales, useFacturasEnCola } from "../useFacturacion.js";
import { buildHistory, dateTimeLabel, dayKey, dayLabel, mesaNombre, monthLabel, tieneRol, timeLabel } from "../utilidades.js";

/* ---------------- Historial ---------------- */

export function HistorialView({ cuentasParaHistorial, ordersParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto, config, mesas, usuarioActual, foco }) {
  const [view, setView] = useState("years");
  const [year, setYear] = useState(null);
  const [month, setMonth] = useState(null);
  const [day, setDay] = useState(null);
  const [expandedCuentaId, setExpandedCuentaId] = useState(null);
  const [verCanceladas, setVerCanceladas] = useState(false);
  const [cuentasAbiertas, setCuentasAbiertas] = useState(true);   // «Cuentas cobradas ese día» viene abierto: así el detalle no deja media pantalla vacía (la impresión siempre muestra todo)
  const [productosAbiertos, setProductosAbiertos] = useState(false);
  const ajustesFiscales = useAjustesFiscales();
  const facturasEnCola = useFacturasEnCola();
  const [facturaId, setFacturaId] = useState(null); // la factura de una cuenta se abre a demanda (evita escuchar cientos de cuentas a la vez)
  const [verTodasCanceladas, setVerTodasCanceladas] = useState(false);
  const [soloDescuento, setSoloDescuento] = useState(false);   // dentro de un día: ver solo las cuentas con descuento
  const focoAplicado = React.useRef(0);
  const esAdmin = tieneRol(usuarioActual, "admin");
  const cuentas = cuentasParaHistorial;
  const orders = ordersParaHistorial;

  // Apenas se entra a Historial, se pide el historial completo (una sola vez,
  // no en vivo) — antes de eso solo se ve lo de los últimos días.
  useEffect(() => { cargarHistorialCompleto(); }, [cargarHistorialCompleto]);

  const { days, months, years } = buildHistory(cuentas, orders);
  // Llegada desde una alerta o desde Reportes: deja el Historial ya filtrado (cancelaciones abiertas, día elegido o solo descuentos)
  const claveFoco = foco && (foco.tipo === "dia" || foco.tipo === "descuentos") ? (foco.dia || dayKey(Date.now())) : null;
  useEffect(() => {
    if (!foco || !foco.n || focoAplicado.current === foco.n || Date.now() - foco.n > 8000) return;
    if (foco.tipo === "cancelaciones") { focoAplicado.current = foco.n; setView("years"); setVerCanceladas(true); setVerTodasCanceladas(false); return; }
    if (claveFoco && days[claveFoco]) {
      focoAplicado.current = foco.n;
      setYear(claveFoco.slice(0, 4)); setMonth(claveFoco.slice(0, 7)); setDay(claveFoco); setView("day");
      setSoloDescuento(foco.tipo === "descuentos"); setCuentasAbiertas(true);
    }
  }); // sin dependencias: reintenta hasta que el día esté cargado (el historial llega por partes)
  const CANCELADAS_RECIENTES_DIAS = 30;
  const cortoCanceladasRecientes = Date.now() - CANCELADAS_RECIENTES_DIAS * 24 * 60 * 60 * 1000;
  const todasCanceladas = cuentas
    .filter((c) => c.estado === "cancelada" && (c.montoCancelado || 0) > 0)
    .sort((a, b) => b.canceladaTs - a.canceladaTs);
  const canceladasRecientes = todasCanceladas.filter((c) => c.canceladaTs >= cortoCanceladasRecientes);
  const canceladasAntiguas = todasCanceladas.filter((c) => c.canceladaTs < cortoCanceladasRecientes);
  const canceladas = verTodasCanceladas ? todasCanceladas : canceladasRecientes;

  const AvisoCargando = (
    <Despliegue abierto={!historialCompleto} siempre>
      <div style={{ overflow: "hidden" }}>
        <div style={styles.cargandoHistBox}>
          <span>Cargando el resto del historial…</span>
        </div>
      </div>
    </Despliegue>
  );

  // El aviso solo aparece cuando hay cancelaciones recientes; las antiguas se ven dentro de cada día.
  const PanelCanceladas = esAdmin && canceladasRecientes.length > 0 && (
    <div className="despliega" style={styles.canceladasBox}>
      <button style={styles.canceladasToggle} onClick={() => setVerCanceladas((v) => !v)}>
        <Ban size={13} color="var(--c-c1442d-t)" />
        <span>
          {canceladas.length} {canceladas.length === 1 ? "cuenta cancelada" : "cuentas canceladas"} sin cobrar
          {!verTodasCanceladas ? ` (últimos ${CANCELADAS_RECIENTES_DIAS} días)` : ""} — {money(canceladas.reduce((s, c) => s + (c.montoCancelado || 0), 0))} en total
        </span>
        <Chevron abierto={verCanceladas} size={15} style={{ marginLeft: "auto" }} />
      </button>
      {verCanceladas && (
        <div style={{ marginTop: 6 }}>
          {canceladas.length === 0 && (
            <div style={styles.canceladaMotivo}>Ninguna cancelación en los últimos {CANCELADAS_RECIENTES_DIAS} días.</div>
          )}
          {canceladas.map((c) => (
            <div key={c.id} style={styles.canceladaRow}>
              <div style={styles.rowBetween}>
                <span style={styles.cierreDate}>{dateTimeLabel(c.canceladaTs)} · {mesaNombre(mesas, c.mesa)}{c.mesero ? ` · abrió ${c.mesero}` : ""}</span>
                <span style={{ ...styles.cierreTotal, color: "var(--c-c1442d-t)" }}>{money(c.montoCancelado)}</span>
              </div>
              <div style={styles.canceladaMotivo}>Canceló <b>{c.canceladaPor}</b>: "{c.motivoCancelacion}"</div>
            </div>
          ))}
          {!verTodasCanceladas && canceladasAntiguas.length > 0 && (
            <button style={styles.inlineAddLink} onClick={() => setVerTodasCanceladas(true)}>
              Ver también {canceladasAntiguas.length} {canceladasAntiguas.length === 1 ? "cancelación anterior" : "cancelaciones anteriores"} →
            </button>
          )}
          {verTodasCanceladas && canceladasAntiguas.length > 0 && (
            <button style={styles.inlineAddLink} onClick={() => setVerTodasCanceladas(false)}>Ver solo las recientes</button>
          )}
        </div>
      )}
    </div>
  );

  if (Object.keys(days).length === 0) {
    return (
      <div className="ancho" style={styles.menuScroll}>
        {AvisoCargando}
        {PanelCanceladas}
        <div style={styles.cajaEmptyText}>Todavía no hay cuentas cobradas. Cuando cobres una mesa, va a aparecer aquí organizada por día, con fecha y hora exactas.</div>
      </div>
    );
  }

  // Años → meses → días → día: cada nivel entra deslizándose desde el lado correcto (como el push/pop de iOS)
  const envolver = (clave, indice, nodo) => (
    <Transicion modo="deslizar" clave={clave} indice={indice} altura={false} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }} estiloDentro={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>{nodo}</Transicion>
  );

  if (view === "years") {
    const list = Object.values(years).sort((a, b) => b.key - a.key);
    return envolver("years", 0, (
      <div className="ancho" style={styles.menuScroll}>
        {AvisoCargando}
        {PanelCanceladas}
        <div style={styles.rowBetween}>
          <div style={styles.catLabel}>AÑOS</div>
          {esAdmin && <button style={styles.exportLink} onClick={() => exportarExcel(cuentas, orders, config, mesas)}><Download size={13} /> Exportar Excel</button>}
        </div>
        {list.length > 1 && (
          <div style={styles.chartBox}>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[...list].sort((a, b) => a.key.localeCompare(b.key))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" />
                <XAxis dataKey="key" tick={{ fontSize: 11, fill: "var(--c-8a8272-t)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--c-8a8272-t)" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="total" fill="var(--c-5b7553-t)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {list.map((y) => (
          <button key={y.key} className="hist-fila" style={styles.histRow} onClick={() => { setYear(y.key); setView("months"); }}>
            <span style={styles.histRowTitle}>{y.key}</span>
            <span style={styles.histRowSub}>{y.monthKeys.length} {y.monthKeys.length === 1 ? "mes" : "meses"} con ventas</span>
            <span style={styles.histRowTotal}>{money(y.total)}</span>
          </button>
        ))}
      </div>
    ));
  }
  if (view === "months") {
    const list = Object.values(months).filter((m) => m.key.startsWith(year)).sort((a, b) => b.key.localeCompare(a.key));
    return envolver("months", 1, (
      <div className="ancho" style={styles.menuScroll}>
        <button style={styles.backBtn} onClick={() => setView("years")}>← Años</button>
        <div style={{ ...styles.catLabel, marginTop: 12 }}>{year}</div>
        {list.map((m) => {
          const [añoMes, mesMes] = m.key.split("-");
          const claveAñoAnterior = `${Number(añoMes) - 1}-${mesMes}`;
          const mesAñoAnterior = months[claveAñoAnterior];
          const delta = mesAñoAnterior && mesAñoAnterior.total > 0 ? Math.round(((m.total - mesAñoAnterior.total) / mesAñoAnterior.total) * 100) : null;
          return (
            <button key={m.key} className="hist-fila" style={styles.histRow} onClick={() => { setMonth(m.key); setView("days"); }}>
              <span style={styles.histRowTitle}>{monthLabel(m.ts)}</span>
              <span style={styles.histRowSub}>
                {m.dayKeys.length} {m.dayKeys.length === 1 ? "día" : "días"} con ventas
                {delta !== null && (
                  <span style={{ color: delta >= 0 ? "var(--c-5b7553-t)" : "var(--c-c1442d-t)", fontWeight: 700 }}> · {delta >= 0 ? "+" : ""}{delta}% vs {claveAñoAnterior}</span>
                )}
              </span>
              <span style={styles.histRowTotal}>{money(m.total)}</span>
            </button>
          );
        })}
      </div>
    ));
  }
  if (view === "days") {
    const list = Object.values(days).filter((d) => d.key.startsWith(month)).sort((a, b) => b.key.localeCompare(a.key));
    return envolver("days", 2, (
      <div className="ancho" style={styles.menuScroll}>
        <button style={styles.backBtn} onClick={() => setView("months")}>← Meses</button>
        <div style={{ ...styles.catLabel, marginTop: 12 }}>{list[0] ? monthLabel(list[0].ts) : ""}</div>
        {list.map((d) => (
          <button key={d.key} className="hist-fila" style={styles.histRow} onClick={() => { setDay(d.key); setSoloDescuento(false); setView("day"); }}>
            <span style={styles.histRowTitle}>{dayLabel(d.ts)}</span>
            <span style={styles.histRowSub}>{d.cuentasCount} {d.cuentasCount === 1 ? "cuenta cobrada" : "cuentas cobradas"}</span>
            <span style={styles.histRowTotal}>{money(d.total)}</span>
          </button>
        ))}
      </div>
    ));
  }

  const d = days[day];
  if (!d) return null;
  const productos = Object.entries(d.productos).sort((a, b) => b[1].subtotal - a[1].subtotal);
  const mesasAtendidas = new Set(d.cuentas.map((c) => c.mesa)).size;
  return envolver("day", 3, (
    <div className="ancho" style={styles.menuScroll}>
      <button className="no-imprimir" style={styles.backBtn} onClick={() => setView("days")}>← Días</button>
      <div style={{ marginTop: 12, marginBottom: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={styles.pageEyebrow}>{dayLabel(d.ts)}</div>
          <div style={{ ...styles.cajaTotalValue, color: "var(--c-242019-t)" }}>{money(d.total)}</div>
          <div style={{ fontSize: 13, color: "var(--c-8a8272-t)", marginTop: 2 }}>{mesasAtendidas} {mesasAtendidas === 1 ? "mesa atendida" : "mesas atendidas"} · {d.cuentas.length} {d.cuentas.length === 1 ? "cuenta" : "cuentas"}</div>
        </div>
        {esAdmin && <button className="no-imprimir" style={styles.exportLink} onClick={() => imprimir(<HojaDia d={d} orders={orders} mesas={mesas} canceladas={todasCanceladas.filter((c) => dayKey(c.canceladaTs) === d.key)} config={config} usuario={usuarioActual} />)}><Printer size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Imprimir</button>}
      </div>

      <div style={styles.metodoBreakdownRowLight}>
        {Object.entries(METODO_META).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <div key={key} style={styles.metodoBreakdownItemLight}>
              <Icon size={13} color={meta.color} /><span style={styles.metodoBreakdownLabelLight}>{meta.label}</span><span style={styles.metodoBreakdownValueLight}>{money(d.porMetodo[key] || 0)}</span>
            </div>
          );
        })}
      </div>

      <button type="button" aria-expanded={cuentasAbiertas} onClick={() => setCuentasAbiertas((v) => !v)} className="no-imprimir"
        style={{ ...styles.catLabel, marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 44, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
        <span>CUENTAS COBRADAS ESE DÍA · {soloDescuento ? `${d.cuentas.filter((c) => c.descuento).length} CON DESCUENTO` : d.cuentas.length}</span>
        <Chevron abierto={cuentasAbiertas} size={16} />
      </button>
      {d.cuentas.some((c) => c.descuento) && (
        <button type="button" className="no-imprimir" aria-pressed={soloDescuento} onClick={() => setSoloDescuento((v) => !v)}
          style={{ ...styles.propinaPill, ...(soloDescuento ? styles.pillOn : {}), minHeight: 36, marginBottom: 8 }}>
          {soloDescuento ? "✓ Solo con descuento" : "Solo con descuento"}
        </button>
      )}
      <Despliegue abierto={cuentasAbiertas}>{d.cuentas.filter((c) => !soloDescuento || c.descuento).slice().sort((a, b) => a.pagadaTs - b.pagadaTs).map((c) => {
        const dividida = c.pagos && c.pagos.length > 1;
        const isExpanded = expandedCuentaId === c.id;
        const meta = !dividida && c.pagos && c.pagos[0] ? METODO_META[c.pagos[0].metodoPago] : null;
        return (
          <div key={c.id}>
            <button style={{ ...styles.cierreRow, width: "100%", background: "transparent", border: "none", cursor: dividida ? "pointer" : "default", textAlign: "left" }} onClick={() => dividida && setExpandedCuentaId(isExpanded ? null : c.id)}>
              <span style={styles.cierreDate}>
                {meta && <meta.icon size={12} color={meta.color} style={{ marginRight: 5, verticalAlign: -2 }} />}
                {mesaNombre(mesas, c.mesa)}{c.mesero ? ` · ${c.mesero}` : ""} · cobrada {timeLabel(c.pagadaTs)}
                {dividida && <span style={styles.dividedTag}> · dividida en {c.pagos.length} pagos <Chevron abierto={isExpanded} size={13} style={{ verticalAlign: -2, display: "inline-block" }} /></span>}
              </span>
              <span style={styles.cierrePedidos}>{c.itemCount} ítems</span>
              <span style={styles.cierreTotal}>{money(c.total)}</span>
            </button>
            <button style={styles.comprobanteLink} onClick={() => { const real = (cuentasParaHistorial || []).find((x) => x.id === c.id); if (real) mostrarComprobante({ tipo: "comprobante", cuenta: real, orders: ordersParaHistorial || [] }); }}>Ver comprobante</button>
            {ajustesFiscales && ajustesFiscales.activa && (facturaId === c.id
              ? <div style={{ padding: "0 4px 10px" }}><FacturaCuenta cuenta={(cuentasParaHistorial || []).find((x) => x.id === c.id) || { id: c.id, estado: "pagada", pagadaTs: c.pagadaTs }} ajustes={ajustesFiscales} esAdmin={tieneRol(usuarioActual, "admin")} enCola={facturasEnCola.has(c.id)} /></div>
              : <button style={styles.comprobanteLink} onClick={() => setFacturaId(c.id)}>Factura electrónica</button>)}
            {dividida && isExpanded && (
              <div style={styles.pagosRegistradosBox}>
                {c.pagos.map((p) => {
                  const pmeta = METODO_META[p.metodoPago]; const PIcon = pmeta.icon;
                  return (
                    <div key={p.id} style={styles.pagoRow}>
                      <span style={styles.pagoIcono}><PIcon size={14} color="var(--pago-ok)" /></span>
                      <div style={styles.pagoRowMid}>
                        <span style={styles.pagoRowEtiqueta}>{p.etiqueta || "Cuenta completa"}</span>
                        {p.tipo === "por_producto" && (p.items || []).length > 0 && <span style={styles.pagoRowItems}>{p.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</span>}
                        <span style={styles.pagoRowTime}>{timeLabel(p.ts)} · {pmeta.label}{p.procesadoPor ? ` · cobró ${p.procesadoPor}` : ""}</span>
                        {p.propinaVuelta > 0 && <span style={styles.pagoRowItems}>Incluye {money(p.propinaVuelta)} de propina (la vuelta)</span>}
                      </div>
                      <span style={styles.pagoRowMonto}>{money(p.monto)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}</Despliegue>

      <button type="button" aria-expanded={productosAbiertos} onClick={() => setProductosAbiertos((v) => !v)} className="no-imprimir"
        style={{ ...styles.catLabel, marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 44, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
        <span>PRODUCTOS VENDIDOS · {productos.length}</span>
        <Chevron abierto={productosAbiertos} size={16} />
      </button>
      <Despliegue abierto={productosAbiertos}>{productos.map(([name, p]) => (
        <div key={name} style={styles.cajaProductRow}><span style={styles.cajaProductQty}>{p.qty}×</span><span style={styles.cajaProductName}>{name}</span><span style={styles.cajaProductSubtotal}>{money(p.subtotal)}</span></div>
      ))}</Despliegue>
    </div>
  ));
}

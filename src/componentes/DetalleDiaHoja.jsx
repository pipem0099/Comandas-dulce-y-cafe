import React, { useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { Chevron, Despliegue } from "./Comunes.jsx";
import { FacturaCuenta } from "./FacturaCuenta.jsx";
import { HojaDia } from "../hojas.jsx";
import { imprimir } from "../impresion.jsx";
import { mostrarComprobante } from "../comprobante.jsx";
import { METODO_META } from "../constantes.js";
import { styles } from "../estilos.js";
import { money } from "../logica.js";
import { useAjustesFiscales, useFacturasEnCola } from "../useFacturacion.js";
import { buildHistory, dayKey, dayLabel, mesaNombre, tieneRol, timeLabel } from "../utilidades.js";

/* Detalle de UN día dentro de «Análisis y reportes» (hoja flotante): total vendido, cobrado por método de pago,
   cuentas cobradas y productos vendidos. Es el mismo detalle que muestra Caja → Historial, pero sin sacar a la persona
   de Análisis. Solo lee: usa las cuentas y pedidos que la pantalla de reportes ya tiene cargados (no pide nada nuevo). */
const cerrarBtn = { width: 36, height: 36, borderRadius: 18, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-5c5648-t)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
const seccionBtn = { ...styles.catLabel, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 44, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" };

export function DetalleDiaHoja({ dia, cuentas, orders, mesas, config, usuarioActual, onCerrar }) {
  const [cuentasAbiertas, setCuentasAbiertas] = useState(true);
  const [productosAbiertos, setProductosAbiertos] = useState(false);
  const [expandedCuentaId, setExpandedCuentaId] = useState(null);
  const [facturaId, setFacturaId] = useState(null);          // la factura de una cuenta se abre a demanda
  const [soloDescuento, setSoloDescuento] = useState(false);
  const ajustesFiscales = useAjustesFiscales();
  const facturasEnCola = useFacturasEnCola();
  const esAdmin = tieneRol(usuarioActual, "admin");

  const d = useMemo(() => {
    const { days } = buildHistory(cuentas || [], orders || []);
    return days[dia] || null;
  }, [cuentas, orders, dia]);
  const canceladasDelDia = useMemo(
    () => (cuentas || []).filter((c) => c.estado === "cancelada" && (c.montoCancelado || 0) > 0 && c.canceladaTs && dayKey(c.canceladaTs) === dia),
    [cuentas, dia]
  );
  const productos = d ? Object.entries(d.productos).sort((a, b) => b[1].subtotal - a[1].subtotal) : [];
  const mesasAtendidas = d ? new Set(d.cuentas.map((c) => c.mesa)).size : 0;
  const cuentaReal = (id) => (cuentas || []).find((x) => x.id === id);

  return (
    <Hoja onCerrar={onCerrar} ancho={600} gap={10} label="Detalle del día" z={70} centro>
      {({ cerrar }) => (
        <>
          {!d ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" }}>Detalle del día</div>
                <button type="button" onClick={cerrar} aria-label="Cerrar" style={cerrarBtn}><X size={18} /></button>
              </div>
              <div style={styles.cajaEmptyText}>No hay cuentas cobradas en este día con los datos cargados.</div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.pageEyebrow}>{dayLabel(d.ts)}</div>
                  <div style={{ ...styles.cajaTotalValue, color: "var(--c-242019-t)" }}>{money(d.total)}</div>
                  <div style={{ fontSize: 13, color: "var(--c-8a8272-t)", marginTop: 2 }}>{mesasAtendidas} {mesasAtendidas === 1 ? "mesa atendida" : "mesas atendidas"} · {d.cuentas.length} {d.cuentas.length === 1 ? "cuenta" : "cuentas"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {esAdmin && <button type="button" style={styles.exportLink} onClick={() => imprimir(<HojaDia d={d} orders={orders} mesas={mesas} canceladas={canceladasDelDia} config={config} usuario={usuarioActual} />)}><Printer size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Imprimir</button>}
                  <button type="button" onClick={cerrar} aria-label="Cerrar" style={cerrarBtn}><X size={18} /></button>
                </div>
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

              <button type="button" aria-expanded={cuentasAbiertas} onClick={() => setCuentasAbiertas((v) => !v)} style={seccionBtn}>
                <span>CUENTAS COBRADAS ESE DÍA · {soloDescuento ? `${d.cuentas.filter((c) => c.descuento).length} CON DESCUENTO` : d.cuentas.length}</span>
                <Chevron abierto={cuentasAbiertas} size={16} />
              </button>
              {d.cuentas.some((c) => c.descuento) && (
                <button type="button" aria-pressed={soloDescuento} onClick={() => setSoloDescuento((v) => !v)}
                  style={{ ...styles.propinaPill, ...(soloDescuento ? styles.pillOn : {}), minHeight: 36, alignSelf: "flex-start" }}>
                  {soloDescuento ? "✓ Solo con descuento" : "Solo con descuento"}
                </button>
              )}
              <Despliegue abierto={cuentasAbiertas}>{d.cuentas.filter((c) => !soloDescuento || c.descuento).slice().sort((a, b) => a.pagadaTs - b.pagadaTs).map((c) => {
                const dividida = c.pagos && c.pagos.length > 1;
                const isExpanded = expandedCuentaId === c.id;
                const meta = !dividida && c.pagos && c.pagos[0] ? METODO_META[c.pagos[0].metodoPago] : null;
                return (
                  <div key={c.id}>
                    <button type="button" style={{ ...styles.cierreRow, width: "100%", background: "transparent", border: "none", cursor: dividida ? "pointer" : "default", textAlign: "left" }} onClick={() => dividida && setExpandedCuentaId(isExpanded ? null : c.id)}>
                      <span style={styles.cierreDate}>
                        {meta && <meta.icon size={12} color={meta.color} style={{ marginRight: 5, verticalAlign: -2 }} />}
                        {mesaNombre(mesas, c.mesa)}{c.mesero ? ` · ${c.mesero}` : ""} · cobrada {timeLabel(c.pagadaTs)}
                        {dividida && <span style={styles.dividedTag}> · dividida en {c.pagos.length} pagos <Chevron abierto={isExpanded} size={13} style={{ verticalAlign: -2, display: "inline-block" }} /></span>}
                      </span>
                      <span style={styles.cierrePedidos}>{c.itemCount} ítems</span>
                      <span style={styles.cierreTotal}>{money(c.total)}</span>
                    </button>
                    <button type="button" style={styles.comprobanteLink} onClick={() => { const real = cuentaReal(c.id); if (real) mostrarComprobante({ tipo: "comprobante", cuenta: real, orders: orders || [] }); }}>Ver comprobante</button>
                    {ajustesFiscales && ajustesFiscales.activa && (facturaId === c.id
                      ? <div style={{ padding: "0 4px 10px" }}><FacturaCuenta cuenta={cuentaReal(c.id) || { id: c.id, estado: "pagada", pagadaTs: c.pagadaTs }} ajustes={ajustesFiscales} esAdmin={esAdmin} enCola={facturasEnCola.has(c.id)} /></div>
                      : <button type="button" style={styles.comprobanteLink} onClick={() => setFacturaId(c.id)}>Factura electrónica</button>)}
                    {dividida && isExpanded && (
                      <div style={styles.pagosRegistradosBox}>
                        {c.pagos.map((p) => {
                          const pmeta = METODO_META[p.metodoPago]; const PIcon = pmeta ? pmeta.icon : null;
                          return (
                            <div key={p.id} style={styles.pagoRow}>
                              <span style={styles.pagoIcono}>{PIcon && <PIcon size={14} color="var(--pago-ok)" />}</span>
                              <div style={styles.pagoRowMid}>
                                <span style={styles.pagoRowEtiqueta}>{p.etiqueta || "Cuenta completa"}</span>
                                {p.tipo === "por_producto" && (p.items || []).length > 0 && <span style={styles.pagoRowItems}>{p.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</span>}
                                <span style={styles.pagoRowTime}>{timeLabel(p.ts)} · {pmeta ? pmeta.label : p.metodoPago}{p.procesadoPor ? ` · cobró ${p.procesadoPor}` : ""}</span>
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

              <button type="button" aria-expanded={productosAbiertos} onClick={() => setProductosAbiertos((v) => !v)} style={seccionBtn}>
                <span>PRODUCTOS VENDIDOS · {productos.length}</span>
                <Chevron abierto={productosAbiertos} size={16} />
              </button>
              <Despliegue abierto={productosAbiertos}>{productos.map(([name, p]) => (
                <div key={name} style={styles.cajaProductRow}><span style={styles.cajaProductQty}>{p.qty}×</span><span style={styles.cajaProductName}>{name}</span><span style={styles.cajaProductSubtotal}>{money(p.subtotal)}</span></div>
              ))}</Despliegue>
            </>
          )}
        </>
      )}
    </Hoja>
  );
}

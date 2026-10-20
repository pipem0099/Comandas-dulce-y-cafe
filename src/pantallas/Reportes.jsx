import React, { useState } from "react";
import { Plus, Minus, Clock, UserCircle2, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { money } from "../logica.js";
import { MontoSigno, FilaTabs } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { cuentaGranTotal, cuentaOrders, dateTimeLabel, hourLabel, tieneRol } from "../utilidades.js";

/* ---------------- Reportes ---------------- */

export function ReportesView({ cuentas, orders, menu, usuarioActual, onIr }) {
  const [rango, setRango] = useState("hoy");
  const esAdmin = tieneRol(usuarioActual, "admin");

  const inicioRango = () => {
    const d = new Date();
    if (rango === "hoy") { d.setHours(0, 0, 0, 0); return d.getTime(); }
    if (rango === "semana") { d.setDate(d.getDate() - 7); return d.getTime(); }
    d.setDate(d.getDate() - 30); return d.getTime();
  };
  const desde = inicioRango();
  const pagadasRango = cuentas.filter((c) => c.estado === "pagada" && c.pagadaTs >= desde);
  const costoPorId = Object.fromEntries(menu.map((m) => [m.id, m.cost || 0]));

  // Tiempo promedio de cocina: de cuando se envió el pedido a cuando se marcó "listo".
  const ordenesConTiempo = orders.filter((o) => o.ts >= desde && o.listoTs && o.estado !== "cancelado");
  const tiempoPromedioMin = ordenesConTiempo.length > 0
    ? Math.round(ordenesConTiempo.reduce((s, o) => s + (o.listoTs - o.ts), 0) / ordenesConTiempo.length / 60000)
    : null;

  const porHora = {};
  pagadasRango.forEach((c) => { const h = new Date(c.pagadaTs).getHours(); porHora[h] = (porHora[h] || 0) + cuentaGranTotal(orders, c); });
  const dataHora = Array.from({ length: 24 }, (_, h) => ({ hora: hourLabel(h), total: porHora[h] || 0 })).filter((d, i) => {
    // solo mostrar el rango de horas de operación con datos, ampliado un poco
    const conDatos = Object.keys(porHora).map(Number);
    if (conDatos.length === 0) return i >= 6 && i <= 22;
    return i >= Math.max(0, Math.min(...conDatos) - 1) && i <= Math.min(23, Math.max(...conDatos) + 1);
  });

  const productoMap = {};
  let ventaProductos = 0, costoProductos = 0, huboCostosCargados = false;
  pagadasRango.forEach((c) => cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado").forEach((o) => o.items.forEach((it) => {
    if (!productoMap[it.name]) productoMap[it.name] = { qty: 0, subtotal: 0 };
    productoMap[it.name].qty += it.qty; productoMap[it.name].subtotal += it.qty * it.price;
    ventaProductos += it.qty * it.price;
    // Los pedidos nuevos ya guardan su propio costo (congelado al momento de
    // la venta). Los pedidos viejos, de antes de este cambio, no lo tienen —
    // para esos usamos el costo actual del menú como mejor estimado posible.
    const costoUnit = (it.cost !== undefined && it.cost !== null) ? it.cost : (costoPorId[it.id] || 0);
    if (costoUnit > 0) huboCostosCargados = true;
    costoProductos += it.qty * costoUnit;
  })));
  const topProductos = Object.entries(productoMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  const margenRango = ventaProductos - costoProductos;
  const margenPct = ventaProductos > 0 ? Math.round((margenRango / ventaProductos) * 100) : 0;

  const totalRango = pagadasRango.reduce((s, c) => s + cuentaGranTotal(orders, c), 0);
  const propinasRango = pagadasRango.reduce((s, c) => s + ((c.propina && c.propina.monto) || 0), 0);
  const descuentosRango = pagadasRango.reduce((s, c) => s + ((c.descuento && c.descuento.monto) || 0), 0);
  const cuentaBrutaRango = totalRango + descuentosRango - propinasRango;
  const canceladasRango = cuentas.filter((c) => c.estado === "cancelada" && (c.montoCancelado || 0) > 0 && c.canceladaTs >= desde);
  const totalCanceladoRango = canceladasRango.reduce((s, c) => s + (c.montoCancelado || 0), 0);

  const meseroMap = {};
  pagadasRango.forEach((c) => {
    const nombre = c.mesero || "Sin asignar";
    if (!meseroMap[nombre]) meseroMap[nombre] = { cuentas: 0, total: 0, propinas: 0 };
    meseroMap[nombre].cuentas += 1;
    meseroMap[nombre].total += cuentaGranTotal(orders, c);
    meseroMap[nombre].propinas += (c.propina && c.propina.monto) || 0;
  });
  const meserosOrdenados = Object.entries(meseroMap).sort((a, b) => b[1].total - a[1].total);
  const [repartirPropinas, setRepartirPropinas] = useState(false);
  const [numPersonasPropina, setNumPersonasPropina] = useState(2);

  return (
    <div className="ancho" style={styles.menuScroll}>
      <FilaTabs className="no-imprimir" style={{ ...styles.cajaTabSwitch, padding: "0 0 12px" }}>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "hoy" ? styles.cajaTabBtnActive : {}) }} aria-current={rango === "hoy" ? "true" : undefined} onClick={() => setRango("hoy")}>Hoy</button>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "semana" ? styles.cajaTabBtnActive : {}) }} aria-current={rango === "semana" ? "true" : undefined} onClick={() => setRango("semana")}>7 días</button>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "mes" ? styles.cajaTabBtnActive : {}) }} aria-current={rango === "mes" ? "true" : undefined} onClick={() => setRango("mes")}>30 días</button>
        {esAdmin && <button style={styles.exportLink} onClick={() => window.print()}><Printer size={15} />Imprimir</button>}
      </FilaTabs>

      <div className="solo-imprimir" style={styles.reportePrintHeader}>
        <div style={styles.reportePrintTitle}>Reporte financiero — {rango === "hoy" ? "Hoy" : rango === "semana" ? "Últimos 7 días" : "Últimos 30 días"}</div>
        <div style={styles.reportePrintSub}>Generado el {dateTimeLabel(Date.now())}</div>
      </div>

      <div style={styles.cajaTotalCard}>
        <span style={styles.cajaTotalLabel}>Total vendido</span>
        <span style={styles.cajaTotalValue}>{money(totalRango)}</span>
        <span style={styles.turnoEsperadoLabel}>{pagadasRango.length} {pagadasRango.length === 1 ? "cuenta" : "cuentas"} · {money(propinasRango)} en propinas</span>
        {esAdmin && huboCostosCargados && (
          <div style={styles.margenRow}>
            <span>Margen estimado: <b>{money(margenRango)}</b> ({margenPct}%)</span>
          </div>
        )}
      </div>
      {esAdmin && !huboCostosCargados && ventaProductos > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 14, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 16 }}>
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45, color: "var(--c-5c5648-t)" }}>Agrégale costo a tus productos para ver aquí el margen de este período.</div>
          {onIr && <button style={{ flexShrink: 0, padding: "9px 14px", borderRadius: 12, border: "1px solid var(--c-d9cfae-o)", background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => onIr("menu")}>Ir a Menú</button>}
        </div>
      )}

      {esAdmin && (
        <>
          <div style={{ ...styles.catLabel, marginTop: 16 }}>RESUMEN FINANCIERO</div>
          <div style={styles.turnoBox}>
            <div style={styles.subtotalRow}><span>Consumo bruto (antes de descuentos)</span><span>{money(cuentaBrutaRango)}</span></div>
            <div style={styles.subtotalRow}><span>Descuentos y cortesías aplicados</span><MontoSigno valor={descuentosRango} signo="−" /></div>
            <div style={styles.subtotalRow}><span>Propinas</span><MontoSigno valor={propinasRango} signo="+" positivo /></div>
            <div style={{ ...styles.subtotalRow, ...styles.subtotalRowFinal }}><span>Total cobrado</span><span>{money(totalRango)}</span></div>
            {huboCostosCargados && (
              <>
                <div style={styles.subtotalRow}><span>Costo de productos vendidos</span><span>−{money(costoProductos)}</span></div>
                <div style={{ ...styles.subtotalRow, ...styles.subtotalRowFinal }}><span>Margen (utilidad bruta)</span><span>{money(margenRango)} ({margenPct}%)</span></div>
              </>
            )}
            <div style={styles.subtotalRow}>
              <span style={{ color: canceladasRango.length > 0 ? "var(--c-c1442d-t)" : undefined }}>Cuentas canceladas sin cobrar ({canceladasRango.length})</span>
              <span style={{ color: canceladasRango.length > 0 ? "var(--c-c1442d-t)" : undefined }}>{money(totalCanceladoRango)}</span>
            </div>
          </div>
        </>
      )}

      <div style={styles.catLabel}>PROPINAS DEL PERÍODO</div>
      <div style={styles.turnoBox}>
        <div style={styles.closeConfirmText}>{money(propinasRango)} en propinas en este rango.</div>
        {!repartirPropinas ? (
          <button style={styles.inlineAddLink} onClick={() => setRepartirPropinas(true)}>Repartir entre el equipo →</button>
        ) : (
          <>
            <div style={styles.partesStepperRow}>
              <span style={styles.closeConfirmText}>Dividir entre:</span>
              <div style={styles.stepper}>
                <button style={styles.stepBtn} onClick={() => setNumPersonasPropina((n) => Math.max(1, n - 1))}><Minus size={14} /></button>
                <span style={styles.stepVal}>{numPersonasPropina}</span>
                <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus }} onClick={() => setNumPersonasPropina((n) => Math.min(20, n + 1))}><Plus size={14} /></button>
              </div>
              <span style={styles.closeConfirmText}>personas</span>
            </div>
            <div style={styles.diferenciaBox}>Cada uno: <b>{money(propinasRango / numPersonasPropina)}</b></div>
          </>
        )}
      </div>

      {tiempoPromedioMin !== null && (
        <div style={styles.tiempoCocinaBox}>
          <Clock size={14} color="var(--c-b98a2e-t)" />
          <span>Tiempo promedio de cocina: <b>{tiempoPromedioMin} min</b> ({ordenesConTiempo.length} pedidos)</span>
        </div>
      )}

      <div style={styles.catLabel}>VENTAS POR HORA</div>
      <div style={styles.chartBox}>
        {dataHora.length === 0 || totalRango === 0 ? (
          <div style={styles.cajaEmptyText}>Sin ventas en este rango todavía.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dataHora}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" />
              <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "var(--c-8a8272-t)" }} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: "var(--c-8a8272-t)" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" fill="var(--c-c1442d-t)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ ...styles.catLabel, marginTop: 20 }}>TOP 5 PRODUCTOS</div>
      {topProductos.length === 0 ? (
        <div style={styles.cajaEmptyText}>Sin datos todavía.</div>
      ) : (
        topProductos.map(([name, p]) => (
          <div key={name} style={styles.cajaProductRow}><span style={styles.cajaProductQty}>{p.qty}×</span><span style={styles.cajaProductName}>{name}</span><span style={styles.cajaProductSubtotal}>{money(p.subtotal)}</span></div>
        ))
      )}

      <div style={{ ...styles.catLabel, marginTop: 20 }}>VENTAS POR MESERO</div>
      {meserosOrdenados.length === 0 ? (
        <div style={styles.cajaEmptyText}>Sin datos todavía.</div>
      ) : (
        meserosOrdenados.map(([nombre, d]) => (
          <div key={nombre} style={styles.meseroStatRow}>
            <div style={styles.meseroStatLeft}>
              <UserCircle2 size={14} color="var(--c-8a8272-t)" />
              <span style={styles.pagoRowEtiqueta}>{nombre}</span>
              <span style={styles.meseroStatSub}>{d.cuentas} {d.cuentas === 1 ? "cuenta" : "cuentas"}{d.propinas > 0 ? ` · ${money(d.propinas)} propina` : ""}</span>
            </div>
            <span style={styles.mesaCuentaTotal}>{money(d.total)}</span>
          </div>
        ))
      )}
    </div>
  );
}

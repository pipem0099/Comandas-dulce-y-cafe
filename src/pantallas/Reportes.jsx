import React, { useState, useEffect } from "react";
import { Plus, Minus, Clock, UserCircle2, Printer } from "lucide-react";
import { imprimir } from "../impresion.jsx";
import { HojaReporte } from "../hojas.jsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { money } from "../logica.js";
import { MontoSigno, FilaTabs, FilaDato } from "../componentes/Comunes.jsx";
import { InfoTip } from "../componentes/InfoTip.jsx";
import { horaCorta, horasDesdeApertura } from "../horas.js";
import { styles } from "../estilos.js";
import { cuentaGranTotal, cuentaOrders, dateTimeLabel, tieneRol } from "../utilidades.js";
import { prepararVentas, rentabilidad, rangosComparables, resumenPeriodo, comparar } from "../analitica.js";

/* ---------------- Reportes ---------------- */

export function ReportesView({ cuentas: cuentasVivas, orders: ordersVivos, menu, insumos = [], usuarioActual, onIr, config, cuentasParaHistorial, ordersParaHistorial, historialCompleto, cargarHistorialCompleto }) {
  const [rango, setRango] = useState("hoy");
  // Lo de "en vivo" solo trae los últimos ~35 días: para el mes pasado se pide el historial completo (una sola vez).
  const necesitaHistorial = rango === "mesPasado";
  useEffect(() => { if (necesitaHistorial && cargarHistorialCompleto) cargarHistorialCompleto(); }, [necesitaHistorial, cargarHistorialCompleto]);
  const cuentas = necesitaHistorial && cuentasParaHistorial ? cuentasParaHistorial : cuentasVivas;
  const orders = necesitaHistorial && ordersParaHistorial ? ordersParaHistorial : ordersVivos;
  const esAdmin = tieneRol(usuarioActual, "admin");

  // Rangos: hoy · últimos 7 días · últimos 30 días · este mes (calendario) · mes pasado (calendario)
  const limitesRango = () => {
    const d = new Date();
    if (rango === "hoy") { d.setHours(0, 0, 0, 0); return [d.getTime(), Infinity]; }
    if (rango === "semana") { d.setDate(d.getDate() - 7); return [d.getTime(), Infinity]; }
    if (rango === "mesActual") return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), Infinity];
    if (rango === "mesPasado") return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), new Date(d.getFullYear(), d.getMonth(), 1).getTime()];
    d.setDate(d.getDate() - 30); return [d.getTime(), Infinity];
  };
  const [desde, hasta] = limitesRango();
  const nombreMes = (fecha) => { const s = fecha.toLocaleDateString("es-CO", { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); };
  const etiquetaRango = rango === "hoy" ? "Hoy" : rango === "semana" ? "Últimos 7 días" : rango === "mes" ? "Últimos 30 días" : rango === "mesActual" ? nombreMes(new Date()) : nombreMes(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const fechaCorta = (ts) => new Date(ts).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const rangoTexto = rango === "hoy" ? fechaCorta(Date.now()) : `Del ${fechaCorta(desde)} al ${fechaCorta(Math.min(hasta - 1, Date.now()))}`;
  const pagadasRango = cuentas.filter((c) => c.estado === "pagada" && c.pagadaTs >= desde && c.pagadaTs < hasta);
  const costoPorId = Object.fromEntries(menu.map((m) => [m.id, m.cost || 0]));

  // Tiempo promedio de cocina: de cuando se envió el pedido a cuando se marcó "listo".
  const ordenesConTiempo = orders.filter((o) => o.ts >= desde && o.ts < hasta && o.listoTs && o.estado !== "cancelado");
  const tiempoPromedioMin = ordenesConTiempo.length > 0
    ? Math.round(ordenesConTiempo.reduce((s, o) => s + (o.listoTs - o.ts), 0) / ordenesConTiempo.length / 60000)
    : null;

  const porHora = {};
  pagadasRango.forEach((c) => { const h = new Date(c.pagadaTs).getHours(); porHora[h] = (porHora[h] || 0) + cuentaGranTotal(orders, c); });
  // Las barras empiezan a la hora en que abre el negocio y usan la hora local (4 p. m.), no 00:00–23:00.
  const dataHora = horasDesdeApertura(Array.from({ length: 24 }, (_, h) => porHora[h] || 0)).map((h) => ({ hora: horaCorta(h), total: porHora[h] || 0 }));

  const productoMap = {};
  let ventaProductos = 0;
  pagadasRango.forEach((c) => cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado").forEach((o) => o.items.forEach((it) => {
    if (!productoMap[it.name]) productoMap[it.name] = { qty: 0, subtotal: 0 };
    productoMap[it.name].qty += it.qty; productoMap[it.name].subtotal += it.qty * it.price;
    ventaProductos += it.qty * it.price;
  })));
  // Margen: el costo sale de la venta, de la receta o del % estimado por categoría (src/analitica.js). Lo que no tiene
  // costo NO se cuenta como costo 0 (inventaba margen) y los descuentos se restan del margen.
  const rentab = rentabilidad(prepararVentas(pagadasRango, orders), menu, { insumos, plantilla: (config && config.plantillaCostos) || {} });
  const huboCostosCargados = rentab.ventaConCosto > 0;
  const costoProductos = rentab.ventaConCosto - rentab.margenTotal;
  const topProductos = Object.entries(productoMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  const margenRango = rentab.margenTotal;
  const margenPct = rentab.margenPct !== null ? Math.round(rentab.margenPct) : 0;
  const aprox = rentab.hayEstimado ? "~" : "";
  const coberturaPct = Math.round(rentab.cobertura * 100);
  // Comparación con el mismo momento del período anterior (solo "hoy" y "7 días": caben en lo que ya está cargado en vivo;
  // para el mes está la pantalla Análisis y control, que carga todo el historial).
  const claveCmp = rango === "hoy" ? "hoy" : rango === "semana" ? "semana" : null;
  let cmpInfo = null;
  if (esAdmin && claveCmp) {
    const todas = prepararVentas(cuentasVivas, ordersVivos); const rc = rangosComparables(claveCmp);
    cmpInfo = { ...comparar(resumenPeriodo(todas, rc.A), resumenPeriodo(todas, rc.B)), etiqueta: rc.etiqueta };
  }

  const totalRango = pagadasRango.reduce((s, c) => s + cuentaGranTotal(orders, c), 0);
  const propinasRango = pagadasRango.reduce((s, c) => s + ((c.propina && c.propina.monto) || 0), 0);
  const descuentosRango = pagadasRango.reduce((s, c) => s + ((c.descuento && c.descuento.monto) || 0), 0);
  const cuentaBrutaRango = totalRango + descuentosRango - propinasRango;
  const canceladasRango = cuentas.filter((c) => c.estado === "cancelada" && (c.montoCancelado || 0) > 0 && c.canceladaTs >= desde && c.canceladaTs < hasta);
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

  const imprimirReporte = () => imprimir(
    <HojaReporte etiqueta={etiquetaRango} rangoTxt={rangoTexto} pagadas={pagadasRango} orders={orders} canceladas={canceladasRango} costoPorId={costoPorId} rentab={rentab}
      tiempoCocina={tiempoPromedioMin !== null ? { min: tiempoPromedioMin, n: ordenesConTiempo.length } : null} config={config} usuario={usuarioActual} />
  );

  return (
    <div className="ancho" style={styles.menuScroll}>
      <FilaTabs className="no-imprimir" style={{ ...styles.cajaTabSwitch, padding: "0 0 12px" }}>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "hoy" ? styles.cajaTabBtnActive : {}) }} aria-current={rango === "hoy" ? "true" : undefined} onClick={() => setRango("hoy")}>Hoy</button>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "semana" ? styles.cajaTabBtnActive : {}) }} aria-current={rango === "semana" ? "true" : undefined} onClick={() => setRango("semana")}>7 días</button>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "mes" ? styles.cajaTabBtnActive : {}) }} aria-current={rango === "mes" ? "true" : undefined} onClick={() => setRango("mes")}>30 días</button>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "mesActual" ? styles.cajaTabBtnActive : {}) }} aria-current={rango === "mesActual" ? "true" : undefined} onClick={() => setRango("mesActual")}>Este mes</button>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "mesPasado" ? styles.cajaTabBtnActive : {}) }} aria-current={rango === "mesPasado" ? "true" : undefined} onClick={() => setRango("mesPasado")}>Mes pasado</button>
        {esAdmin && <button style={styles.exportLink} onClick={imprimirReporte}><Printer size={15} />Imprimir</button>}
      </FilaTabs>

      {necesitaHistorial && !historialCompleto && <div style={styles.cargandoHistBox}><span>Cargando el historial del mes pasado…</span></div>}

      <div style={styles.cajaTotalCard}>
        <span style={styles.cajaTotalLabel}>Total vendido</span>
        <span style={styles.cajaTotalValue}>{money(totalRango)}</span>
        <span style={styles.turnoEsperadoLabel}>{pagadasRango.length} {pagadasRango.length === 1 ? "cuenta" : "cuentas"} · {money(propinasRango)} en propinas (venta sin propinas: {money(totalRango - propinasRango)})</span>
        {cmpInfo && cmpInfo.nivel !== "sin-base" && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: cmpInfo.nivel === "sube" ? "#7BD88F" : cmpInfo.nivel === "baja" ? "#FF8A75" : "#9BA4B0" }}>
            {cmpInfo.nivel === "igual" ? "≈ igual" : `${cmpInfo.pct > 0 ? "▲" : "▼"} ${Math.round(Math.abs(cmpInfo.pct))}%`} {cmpInfo.etiqueta}
          </span>
        )}
        {esAdmin && huboCostosCargados && (
          <div style={styles.margenRow}>
            <span>Margen {rentab.hayEstimado ? "estimado" : "bruto"}: <b>{aprox}{money(margenRango)}</b> ({margenPct}%){coberturaPct < 100 ? ` · costos conocidos en el ${coberturaPct}% de la venta` : ""}</span>
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
                <div style={{ ...styles.subtotalRow, ...styles.subtotalRowFinal }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>Margen
                    <InfoTip titulo="Margen">
                      Es la utilidad bruta: lo que queda de las ventas después de descontar el costo de los productos, ya sin descuentos ni cortesías.
                      <br /><br />En este periodo es <b>{margenPct}%</b> de lo vendido{rentab.hayEstimado ? " (parte del costo es estimado)" : ""}.
                    </InfoTip>
                  </span>
                  <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{aprox}{money(margenRango)}</span>
                </div>
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
          <Clock size={14} color="var(--btn2-mute)" />
          <span>Tiempo promedio de cocina: <b>{tiempoPromedioMin} min</b> ({ordenesConTiempo.length} pedidos)</span>
        </div>
      )}

      <div style={styles.catLabel}>VENTAS POR HORA</div>
      <div style={styles.chartBox}>
        {dataHora.length === 0 || totalRango === 0 ? (
          <div style={styles.cajaEmptyText}>Sin ventas en este rango todavía.</div>
        ) : (
          <div style={{ overflowX: "auto" }} tabIndex={0} aria-label="Gráfico de ventas por hora; desliza para ver todas las horas">
            <div style={{ minWidth: Math.max(300, 68 + dataHora.length * 46) }}>
          <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dataHora} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradVentasHora" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="0" stroke="var(--grid-line)" />
                <XAxis dataKey="hora" axisLine={false} tickLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11, fill: "var(--c-8a8272-t)" }} />
                <YAxis axisLine={false} tickLine={false} width={40} tick={{ fontSize: 11, fill: "var(--c-8a8272-t)" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip cursor={{ fill: "var(--grid-line)" }} formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 10, background: "var(--c-fffdf8-b)", border: "1px solid var(--btn2-line)", color: "var(--c-242019-t)", boxShadow: "var(--shadow-float)" }} />
                <Bar dataKey="total" fill="url(#gradVentasHora)" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...styles.catLabel, marginTop: 20 }}>TOP 5 PRODUCTOS</div>
      {topProductos.length === 0 ? (
        <div style={styles.cajaEmptyText}>Sin datos todavía.</div>
      ) : (
        topProductos.map(([name, p], i) => (
          <FilaDato key={name} nombre={name} detalle={`${p.qty} ${p.qty === 1 ? "vendido" : "vendidos"}`} valor={money(p.subtotal)} ultima={i === topProductos.length - 1} />
        ))
      )}

      <div style={{ ...styles.catLabel, marginTop: 20 }}>VENTAS POR MESERO</div>
      {meserosOrdenados.length === 0 ? (
        <div style={styles.cajaEmptyText}>Sin datos todavía.</div>
      ) : (
        meserosOrdenados.map(([nombre, d], i) => (
          <FilaDato key={nombre} nombre={nombre} detalle={`${d.cuentas} ${d.cuentas === 1 ? "cuenta" : "cuentas"}${d.propinas > 0 ? ` · ${money(d.propinas)} propina` : ""}`} valor={money(d.total)} ultima={i === meserosOrdenados.length - 1} />
        ))
      )}
    </div>
  );
}

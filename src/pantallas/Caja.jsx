import React, { useState } from "react";
import {
  Receipt, AlertTriangle,
} from "lucide-react";
import { estadoStock, money } from "../logica.js";
import { InventarioView, EmptyState } from "../extras.jsx";
import { METODO_META } from "../constantes.js";
import { styles } from "../estilos.js";
import { MesaCuentaCard } from "../pantallas/CuentaMesa.jsx";
import { HistorialView } from "../pantallas/Historial.jsx";
import { ReportesView } from "../pantallas/Reportes.jsx";
import { TurnoView } from "../pantallas/Turno.jsx";
import { cuentaGranTotal, dayKey, mesaOrderIndex, pagosDe, tieneRol } from "../utilidades.js";

/* ---------------- CAJA ---------------- */

export function CajaView({ menu, orders, cuentas, saveCuenta, saveOrdersMap, turnos, turnoAbierto, saveTurno, config, persistConfig, usuarioActual, mesas, persistMesas, insumos, saveInsumo, updateInsumo, deleteInsumo, ajustarInventario, equipo, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto }) {
  const [tab, setTab] = useState(turnoAbierto ? "mesas" : "turno"); // sin caja abierta, lo primero es abrirla
  const [expandedId, setExpandedId] = useState(null);
  const esAdmin = tieneRol(usuarioActual, "admin");
  // El cajero que no es propietario solo ve lo suyo: sin caja abierta no ve nada más que la apertura.
  const bloqueado = !turnoAbierto && !esAdmin;
  const tabActual = bloqueado ? "turno" : tab;

  const abiertas = cuentas.filter((c) => c.estado === "abierta").sort((a, b) => mesaOrderIndex(mesas, a.mesa) - mesaOrderIndex(mesas, b.mesa));
  const hoyKey = dayKey(Date.now());
  const pagadasHoy = cuentas.filter((c) => c.estado === "pagada" && dayKey(c.pagadaTs) === hoyKey);
  const vendidoHoy = pagadasHoy.reduce((s, c) => s + cuentaGranTotal(orders, c), 0);
  const porMetodoHoy = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  pagadasHoy.forEach((c) => pagosDe(c).forEach((p) => { porMetodoHoy[p.metodoPago] = (porMetodoHoy[p.metodoPago] || 0) + p.monto; }));

  return (
    <div style={styles.screen}>
      <div className="no-imprimir ancho" style={styles.mesaGridHeader}>
        <div><div style={styles.pageEyebrow}>CAJA</div><div style={styles.pageTitle}>Caja</div></div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: turnoAbierto ? "rgba(52,199,142,.14)" : "rgba(128,138,150,.16)", border: `1px solid ${turnoAbierto ? "rgba(52,199,142,.4)" : "var(--c-e4dfce-o)"}`, color: turnoAbierto ? "var(--pago-ok)" : "var(--c-8a8272-t)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: turnoAbierto ? "var(--pago-ok)" : "#9BA4B0" }} /> {turnoAbierto ? "Abierta" : "Cerrada"}
        </span>
      </div>

      {!bloqueado && (
        <div className="no-imprimir ancho" style={styles.cajaTabSwitch}>
          <button style={{ ...styles.cajaTabBtn, ...(tabActual === "turno" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("turno")}>Resumen</button>
          <button style={{ ...styles.cajaTabBtn, ...(tabActual === "mesas" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("mesas")}>Cobrar mesas {abiertas.length > 0 ? `(${abiertas.length})` : ""}</button>
          {esAdmin && <button style={{ ...styles.cajaTabBtn, ...(tabActual === "historial" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("historial")}>Historial</button>}
          {esAdmin && <button style={{ ...styles.cajaTabBtn, ...(tabActual === "reportes" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("reportes")}>Reportes</button>}
          {esAdmin && (
            <button style={{ ...styles.cajaTabBtn, ...(tabActual === "inventario" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("inventario")}>
              Inventario{insumos.filter((i) => estadoStock(i) !== "ok").length > 0 ? ` · ${insumos.filter((i) => estadoStock(i) !== "ok").length}` : ""}
            </button>
          )}
        </div>
      )}

      {tabActual === "turno" && (
        <TurnoView equipo={equipo} turnos={turnos} turnoAbierto={turnoAbierto} saveTurno={saveTurno} orders={orders} cuentas={cuentas} config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} menu={menu} mesas={mesas} ordersParaHistorial={ordersParaHistorial} cuentasParaHistorial={cuentasParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} />
      )}

      {tabActual === "mesas" && (
        <div className="ancho" style={styles.menuScroll}>
          {esAdmin && <div style={styles.cajaTotalCard}>
            <span style={styles.cajaTotalLabel}>Vendido hoy ({pagadasHoy.length} {pagadasHoy.length === 1 ? "cuenta" : "cuentas"})</span>
            <span style={styles.cajaTotalValue}>{money(vendidoHoy)}</span>
            <div style={styles.metodoBreakdownRow}>
              {Object.entries(METODO_META).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <div key={key} style={styles.metodoBreakdownItem}>
                    <Icon size={13} color="#9BA4B0" /><span style={styles.metodoBreakdownLabel}>{meta.label}</span><span style={styles.metodoBreakdownValue}>{money(porMetodoHoy[key] || 0)}</span>
                  </div>
                );
              })}
            </div>
          </div>}

          {!turnoAbierto ? (
            <div className="despliega" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "34px 18px", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 20 }}>
              <div style={{ width: 54, height: 54, borderRadius: 27, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(52,199,142,.14)", color: "var(--pago-ok)", border: "1px solid rgba(52,199,142,.35)" }}><AlertTriangle size={24} /></div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" }}>Primero abre la caja</div>
              <div style={{ fontSize: 13.5, color: "var(--c-5c5648-t)", maxWidth: 360, lineHeight: 1.5 }}>Para cobrar cuentas hay que tener un turno abierto. Así todo lo que cobres queda dentro de tu caja.</div>
              <button style={{ ...styles.sendBtn, width: "100%", maxWidth: 320 }} onClick={() => setTab("turno")}>Abrir caja</button>
            </div>
          ) : abiertas.length === 0 ? (
            <EmptyState icon={Receipt} titulo="Sin cuentas abiertas" texto="Cuando un mesero tome un pedido, la cuenta aparece aquí lista para cobrar." />
          ) : (
            abiertas.map((c) => (
              <MesaCuentaCard
                key={c.id} cuenta={c} orders={orders} saveCuenta={saveCuenta} saveOrdersMap={saveOrdersMap}
                turnoAbierto={!!turnoAbierto} usuarioActual={usuarioActual} mesas={mesas} ajustarInventario={ajustarInventario}
                expanded={expandedId === c.id} onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              />
            ))
          )}
          {esAdmin && cuentas.some((c) => c.estado === "pagada") && (
            <div style={styles.goHistLink} onClick={() => setTab("historial")}>Ver historial completo por día, mes y año →</div>
          )}
        </div>
      )}

      {tabActual === "historial" && esAdmin && <HistorialView cuentasParaHistorial={cuentasParaHistorial} ordersParaHistorial={ordersParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} config={config} mesas={mesas} usuarioActual={usuarioActual} />}
      {tabActual === "inventario" && esAdmin && <InventarioView insumos={insumos} saveInsumo={saveInsumo} updateInsumo={updateInsumo} deleteInsumo={deleteInsumo} ajustarInventario={ajustarInventario} config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} />}
      {tabActual === "reportes" && esAdmin && <ReportesView cuentas={cuentas} orders={orders} menu={menu} usuarioActual={usuarioActual} />}
    </div>
  );
}

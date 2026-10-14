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

export function CajaView({ menu, orders, cuentas, saveCuenta, saveOrdersMap, turnos, turnoAbierto, saveTurno, config, persistConfig, usuarioActual, mesas, persistMesas, insumos, saveInsumo, updateInsumo, deleteInsumo, ajustarInventario, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto }) {
  const [tab, setTab] = useState("mesas");
  const [expandedId, setExpandedId] = useState(null);
  const esAdmin = tieneRol(usuarioActual, "admin");

  const abiertas = cuentas.filter((c) => c.estado === "abierta").sort((a, b) => mesaOrderIndex(mesas, a.mesa) - mesaOrderIndex(mesas, b.mesa));
  const hoyKey = dayKey(Date.now());
  const pagadasHoy = cuentas.filter((c) => c.estado === "pagada" && dayKey(c.pagadaTs) === hoyKey);
  const vendidoHoy = pagadasHoy.reduce((s, c) => s + cuentaGranTotal(orders, c), 0);
  const porMetodoHoy = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  pagadasHoy.forEach((c) => pagosDe(c).forEach((p) => { porMetodoHoy[p.metodoPago] = (porMetodoHoy[p.metodoPago] || 0) + p.monto; }));

  return (
    <div style={styles.screen}>
      <div className="no-imprimir ancho" style={styles.mesaGridHeader}>
        <div><div style={styles.pageEyebrow}>CAJA</div><div style={styles.pageTitle}>Control de consumo</div></div>
      </div>

      <div className="no-imprimir ancho" style={styles.cajaTabSwitch}>
        <button style={{ ...styles.cajaTabBtn, ...(tab === "turno" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("turno")}>Turno</button>
        <button style={{ ...styles.cajaTabBtn, ...(tab === "mesas" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("mesas")}>Mesas {abiertas.length > 0 ? `(${abiertas.length})` : ""}</button>
        {esAdmin && <button style={{ ...styles.cajaTabBtn, ...(tab === "historial" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("historial")}>Historial</button>}
        <button style={{ ...styles.cajaTabBtn, ...(tab === "reportes" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("reportes")}>Reportes</button>
        {esAdmin && (
          <button style={{ ...styles.cajaTabBtn, ...(tab === "inventario" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("inventario")}>
            Inventario{insumos.filter((i) => estadoStock(i) !== "ok").length > 0 ? ` (${insumos.filter((i) => estadoStock(i) !== "ok").length}⚠)` : ""}
          </button>
        )}
      </div>

      {tab === "turno" && (
        <TurnoView turnos={turnos} turnoAbierto={turnoAbierto} saveTurno={saveTurno} orders={orders} cuentas={cuentas} config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} menu={menu} mesas={mesas} ordersParaHistorial={ordersParaHistorial} cuentasParaHistorial={cuentasParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} />
      )}

      {tab === "mesas" && (
        <div className="ancho" style={styles.menuScroll}>
          <div style={styles.cajaTotalCard}>
            <span style={styles.cajaTotalLabel}>Vendido hoy ({pagadasHoy.length} {pagadasHoy.length === 1 ? "cuenta" : "cuentas"})</span>
            <span style={styles.cajaTotalValue}>{money(vendidoHoy)}</span>
            <div style={styles.metodoBreakdownRow}>
              {Object.entries(METODO_META).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <div key={key} style={styles.metodoBreakdownItem}>
                    <Icon size={13} color="#B3A891" /><span style={styles.metodoBreakdownLabel}>{meta.label}</span><span style={styles.metodoBreakdownValue}>{money(porMetodoHoy[key] || 0)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {!turnoAbierto && (
            <button style={{ ...styles.warnBanner, width: "100%", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => setTab("turno")}>
              <AlertTriangle size={14} /> Abre el turno para poder registrar cobros — toca aquí
            </button>
          )}

          {abiertas.length === 0 ? (
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

      {tab === "historial" && esAdmin && <HistorialView cuentasParaHistorial={cuentasParaHistorial} ordersParaHistorial={ordersParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} config={config} mesas={mesas} usuarioActual={usuarioActual} />}
      {tab === "inventario" && esAdmin && <InventarioView insumos={insumos} saveInsumo={saveInsumo} updateInsumo={updateInsumo} deleteInsumo={deleteInsumo} ajustarInventario={ajustarInventario} config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} />}
      {tab === "reportes" && <ReportesView cuentas={cuentas} orders={orders} menu={menu} usuarioActual={usuarioActual} />}
    </div>
  );
}

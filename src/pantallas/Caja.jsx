import React, { useState } from "react";
import {
  Receipt, AlertTriangle,
} from "lucide-react";
import { estadoStock, money, esExterna } from "../logica.js";
import { InventarioView, EmptyState } from "../extras.jsx";
import { METODO_META } from "../constantes.js";
import { styles } from "../estilos.js";
import { MesaCuentaCard } from "../pantallas/CuentaMesa.jsx";
import { HistorialView } from "../pantallas/Historial.jsx";
import { FilaTabs } from "../componentes/Comunes.jsx";
import { ReportesView } from "../pantallas/Reportes.jsx";
import { TurnoView } from "../pantallas/Turno.jsx";
import { cuentaGranTotal, cuentaOrders, dayKey, esPorLiberar, estadoVisualMesa, mesaNombre, mesaOrderIndex, pagosDe, pagosTotal, tieneRol, timeLabel } from "../utilidades.js";
import { Acordeon } from "../componentes/Comunes.jsx";
import { useDispositivo } from "../useAncho.js";

/* ---------------- CAJA ---------------- */

export function CajaView({ menu, orders, cuentas, saveCuenta, saveOrdersMap, turnos, turnoAbierto, saveTurno, config, persistConfig, usuarioActual, mesas, persistMesas, insumos, saveInsumo, updateInsumo, deleteInsumo, ajustarInventario, equipo, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto, onIr }) {
  const [tab, setTab] = useState(turnoAbierto ? "mesas" : "turno"); // sin caja abierta, lo primero es abrirla
  const [expandedId, setExpandedId] = useState(null);
  const ancha = useDispositivo() !== "movil";   // tablet / escritorio: lista + detalle lado a lado
  const esAdmin = tieneRol(usuarioActual, "admin");
  // El cajero que no es propietario solo ve lo suyo: sin caja abierta no ve nada más que la apertura.
  const bloqueado = !turnoAbierto && !esAdmin;
  const tabActual = bloqueado ? "turno" : tab;

  const abiertas = cuentas.filter((c) => c.estado === "abierta").sort((a, b) => mesaOrderIndex(mesas, a.mesa) - mesaOrderIndex(mesas, b.mesa));
  const porLiberar = cuentas.filter(esPorLiberar).sort((a, b) => (b.pagadaTs || 0) - (a.pagadaTs || 0));
  const porCobrar = abiertas.reduce((a, c) => a + Math.max(0, cuentaGranTotal(orders, c) - pagosTotal(c)), 0);
  const mesasOcupadas = new Set([...abiertas, ...porLiberar].filter((c) => !esExterna(c)).map((c) => String(c.mesa))).size;
  const liberar = (c) => saveCuenta({ ...c, liberada: true, liberadaTs: Date.now(), liberadaPor: usuarioActual.nombre });
  const seleccionada = abiertas.find((c) => c.id === expandedId) || null;
  const hoyKey = dayKey(Date.now());
  const pagadasHoy = cuentas.filter((c) => c.estado === "pagada" && dayKey(c.pagadaTs) === hoyKey);
  const vendidoHoy = pagadasHoy.reduce((s, c) => s + cuentaGranTotal(orders, c), 0);
  const porMetodoHoy = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  pagadasHoy.forEach((c) => pagosDe(c).forEach((p) => { porMetodoHoy[p.metodoPago] = (porMetodoHoy[p.metodoPago] || 0) + p.monto; }));

  return (
    <div style={styles.screen}>
      <div className="no-imprimir ancho" style={styles.mesaGridHeader}>
        <div><div style={styles.pageEyebrow}>CAJA</div><div style={styles.pageTitle}>Caja</div></div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: turnoAbierto ? "var(--c-e4eee1-b)" : "rgba(128,138,150,.16)", border: `1px solid ${turnoAbierto ? "var(--ok-border)" : "var(--c-e4dfce-o)"}`, color: turnoAbierto ? "var(--pago-ok)" : "var(--c-8a8272-t)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: turnoAbierto ? "var(--pago-ok)" : "#9BA4B0" }} /> {turnoAbierto ? "Abierta" : "Cerrada"}
        </span>
      </div>

      {!bloqueado && (
        <FilaTabs className="no-imprimir ancho" style={styles.cajaTabSwitch}>
          <button style={{ ...styles.cajaTabBtn, ...(tabActual === "turno" ? styles.cajaTabBtnActive : {}) }} aria-current={tabActual === "turno" ? "true" : undefined} onClick={() => setTab("turno")}>Resumen</button>
          <button style={{ ...styles.cajaTabBtn, ...(tabActual === "mesas" ? styles.cajaTabBtnActive : {}) }} aria-current={tabActual === "mesas" ? "true" : undefined} onClick={() => setTab("mesas")}>Cobrar mesas {abiertas.length > 0 ? `(${abiertas.length})` : ""}</button>
          {esAdmin && <button style={{ ...styles.cajaTabBtn, ...(tabActual === "historial" ? styles.cajaTabBtnActive : {}) }} aria-current={tabActual === "historial" ? "true" : undefined} onClick={() => setTab("historial")}>Historial</button>}
          {esAdmin && <button style={{ ...styles.cajaTabBtn, ...(tabActual === "reportes" ? styles.cajaTabBtnActive : {}) }} aria-current={tabActual === "reportes" ? "true" : undefined} onClick={() => setTab("reportes")}>Reportes</button>}
          {esAdmin && (
            <button style={{ ...styles.cajaTabBtn, ...(tabActual === "inventario" ? styles.cajaTabBtnActive : {}) }} aria-current={tabActual === "inventario" ? "true" : undefined} onClick={() => setTab("inventario")}>
              Inventario{insumos.filter((i) => estadoStock(i) !== "ok").length > 0 ? ` · ${insumos.filter((i) => estadoStock(i) !== "ok").length}` : ""}
            </button>
          )}
        </FilaTabs>
      )}

      {tabActual === "turno" && (
        <TurnoView equipo={equipo} turnos={turnos} turnoAbierto={turnoAbierto} saveTurno={saveTurno} orders={orders} cuentas={cuentas} config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} menu={menu} mesas={mesas} ordersParaHistorial={ordersParaHistorial} cuentasParaHistorial={cuentasParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} />
      )}

      {tabActual === "mesas" && (
        <div className="ancho" style={styles.menuScroll}>
          {/* Resumen de lo que hay por cobrar */}
          <div style={cj.resumen}>
            <div style={cj.resCelda}><span style={cj.resEt}>Por cobrar</span><span style={cj.resGrande}>{money(porCobrar)}</span></div>
            <div style={cj.resCelda}><span style={cj.resEt}>Mesas ocupadas</span><span style={cj.resNum}>{mesasOcupadas}</span></div>
            <div style={cj.resCelda}><span style={cj.resEt}>Cuentas abiertas</span><span style={cj.resNum}>{abiertas.length}</span></div>
          </div>

          {esAdmin && (
            <Acordeon titulo={`Vendido hoy · ${money(vendidoHoy)}`} resumen={`${pagadasHoy.length} ${pagadasHoy.length === 1 ? "cuenta" : "cuentas"} · efectivo, tarjeta y transferencia`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0 6px" }}>
                {Object.entries(METODO_META).map(([key, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--c-242019-t)" }}>
                      <Icon size={15} color="var(--c-8a8272-t)" /><span style={{ flex: 1 }}>{meta.label}</span><b>{money(porMetodoHoy[key] || 0)}</b>
                    </div>
                  );
                })}
              </div>
            </Acordeon>
          )}

          {!turnoAbierto ? (
            <div className="despliega" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "34px 18px", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 20 }}>
              <div style={{ width: 54, height: 54, borderRadius: 27, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-e4eee1-b)", color: "var(--pago-ok)", border: "1px solid var(--ok-border)" }}><AlertTriangle size={24} /></div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" }}>Primero abre la caja</div>
              <div style={{ fontSize: 13.5, color: "var(--c-5c5648-t)", maxWidth: 360, lineHeight: 1.5 }}>Para cobrar cuentas hay que tener un turno abierto. Así todo lo que cobres queda dentro de tu caja.</div>
              <button style={{ ...styles.sendBtn, width: "100%", maxWidth: 320 }} onClick={() => setTab("turno")}>Abrir caja</button>
            </div>
          ) : abiertas.length === 0 && porLiberar.length === 0 ? (
            <EmptyState icon={Receipt} titulo="Sin cuentas abiertas" texto="Cuando un mesero tome un pedido, la cuenta aparece aquí lista para cobrar." />
          ) : (
            <div style={ancha ? { display: "grid", gridTemplateColumns: "minmax(300px, 400px) 1fr", gap: 14, alignItems: "start" } : { display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {abiertas.map((c) => {
                  if (!ancha) {
                    return (
                      <MesaCuentaCard
                        key={c.id} cuenta={c} orders={orders} saveCuenta={saveCuenta} saveOrdersMap={saveOrdersMap}
                        turnoAbierto={!!turnoAbierto} usuarioActual={usuarioActual} mesas={mesas} ajustarInventario={ajustarInventario}
                        expanded={expandedId === c.id} onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      />
                    );
                  }
                  const ords = cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado");
                  const visual = estadoVisualMesa(c, ords);
                  const falta = Math.max(0, cuentaGranTotal(orders, c) - pagosTotal(c));
                  return (
                    <button key={c.id} className="anim-in" style={{ ...cj.fila, ...(expandedId === c.id ? cj.filaOn : {}) }} onClick={() => setExpandedId(c.id)}>
                      <div style={cj.filaTop}><span style={cj.filaNombre}>{mesaNombre(mesas, c.mesa)}</span><span style={{ ...cj.chip, background: visual.bg, color: visual.color }}>{visual.tag}</span></div>
                      <div style={cj.filaSub}>{ords.length} {ords.length === 1 ? "ronda" : "rondas"} · desde {timeLabel(c.ts)}</div>
                      <div style={cj.filaBase}><span style={cj.filaSub}>{pagosTotal(c) > 0 ? "Falta por cobrar" : "Por cobrar"}</span><span style={cj.filaMonto}>{money(falta)}</span></div>
                    </button>
                  );
                })}

                {porLiberar.length > 0 && (
                  <>
                    <div style={styles.catLabel}>POR LIBERAR</div>
                    {porLiberar.map((c) => (
                      <div key={c.id} style={cj.filaLiberar}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={cj.filaNombre}>{mesaNombre(mesas, c.mesa)}</div>
                          <div style={cj.filaSub}>Pagada a las {timeLabel(c.pagadaTs)} · {money(cuentaGranTotal(orders, c))}</div>
                        </div>
                        <button style={cj.btnLiberar} onClick={() => liberar(c)}>Liberar mesa</button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {ancha && (
                seleccionada ? (
                  <MesaCuentaCard
                    key={seleccionada.id} cuenta={seleccionada} orders={orders} saveCuenta={saveCuenta} saveOrdersMap={saveOrdersMap}
                    turnoAbierto={!!turnoAbierto} usuarioActual={usuarioActual} mesas={mesas} ajustarInventario={ajustarInventario}
                    modoPanel expanded onToggle={() => setExpandedId(null)}
                  />
                ) : (
                  <div style={cj.elige}>
                    <div style={cj.eligeIcono}><Receipt size={22} /></div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Elige una mesa</div>
                    <div style={{ fontSize: 12.5, color: "var(--c-8a8272-t)", textAlign: "center", maxWidth: 240 }}>Verás sus rondas, lo que falta por cobrar y los botones para cobrarla.</div>
                  </div>
                )
              )}

              {!ancha && porLiberar.length > 0 && null}
            </div>
          )}
        </div>
      )}

      {tabActual === "historial" && esAdmin && <HistorialView cuentasParaHistorial={cuentasParaHistorial} ordersParaHistorial={ordersParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} config={config} mesas={mesas} usuarioActual={usuarioActual} />}
      {tabActual === "inventario" && esAdmin && <InventarioView insumos={insumos} saveInsumo={saveInsumo} updateInsumo={updateInsumo} deleteInsumo={deleteInsumo} ajustarInventario={ajustarInventario} config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} />}
      {tabActual === "reportes" && esAdmin && <ReportesView cuentas={cuentas} orders={orders} menu={menu} usuarioActual={usuarioActual} onIr={onIr} />}
    </div>
  );
}

const cj = {
  resumen: { display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  resCelda: { display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRight: "1px solid var(--c-ede7d8-o)" },
  resEt: { fontSize: 11.5, color: "var(--c-8a8272-t)" },
  resGrande: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--accent-t)" },
  resNum: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--c-242019-t)" },
  fila: { display: "flex", flexDirection: "column", gap: 6, padding: "13px 14px", textAlign: "left", background: "var(--c-fffdf8-b)", border: "1.5px solid var(--c-e4dfce-o)", borderRadius: 16, cursor: "pointer", color: "var(--c-242019-t)" },
  filaOn: { borderColor: "var(--accent)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent)" },
  filaTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  filaNombre: { fontSize: 16, fontWeight: 700, color: "var(--c-242019-t)" },
  filaSub: { fontSize: 12, color: "var(--c-8a8272-t)" },
  filaBase: { display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--c-ede7d8-o)", paddingTop: 8 },
  filaMonto: { fontSize: 17, fontWeight: 800, color: "var(--c-242019-t)" },
  chip: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 },
  filaLiberar: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 16, background: "var(--c-fbefd9-b)", border: "1px solid var(--warn-border)" },
  btnLiberar: { padding: "10px 14px", borderRadius: 12, border: "none", background: "var(--warn-solid)", color: "#1a1204", fontWeight: 700, fontSize: 13.5, cursor: "pointer", flexShrink: 0 },
  elige: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "40px 20px", borderRadius: 16, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", color: "var(--c-242019-t)" },
  eligeIcono: { width: 46, height: 46, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-ede7d8-b)", color: "var(--c-8a8272-t)" },
};

import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, Lock, Download, PlayCircle, DoorClosed, ArrowDownToLine, ArrowUpFromLine, RotateCcw, ChevronDown, ChevronUp, ArrowRightLeft, HandHelping,
} from "lucide-react";
import { uid, money } from "../logica.js";
import { saveShared, getRecord, saveCollectionArray, updateRecord } from "../firebase.js";
import { FormularioMovimiento, ListaMovimientos } from "./MovimientosCaja.jsx";
import { FlujoEntrega, TarjetaRelevoPendiente } from "./RelevoCaja.jsx";
import { ResumenDia } from "./ResumenDia.jsx";
import { responsableDe, statsTramo, tramoVigente, tramosDe } from "../relevoCaja.js";
import { CampoMonto, Acordeon } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { descargarRespaldo } from "../exportar.js";
import { agruparPorMes, arqueosDe, dateTimeLabel, dayKey, duracionLabel, mesaNombre, movimientosDe, propinasEnRango, tieneRol, timeLabel, totalesMovimientos, ventasDelTurno } from "../utilidades.js";

/* ---------------- Turno / arqueo de caja ---------------- */

export function TurnoView({ turnos, turnoAbierto, saveTurno, orders, cuentas, config, persistConfig, usuarioActual, menu, mesas, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto, equipo }) {
  const [base, setBase] = useState("");
  const [contado, setContado] = useState("");
  const [contadoTarjeta, setContadoTarjeta] = useState("");
  const [contadoTransf, setContadoTransf] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  // Cierre "a ciegas": lo esperado solo se muestra DESPUÉS de escribir lo contado. Si no cuadra se puede
  // corregir el conteo sin empezar de cero; cada cálculo queda guardado en el turno como un intento.
  const [calculado, setCalculado] = useState(false);
  const [movForm, setMovForm] = useState(null); // 'entrada' | 'salida' | null
  const [errorMov, setErrorMov] = useState("");
  const [detalleAbierto, setDetalleAbierto] = useState(null);
  const [flujoEntrega, setFlujoEntrega] = useState(null); // 'entregar' | 'asumir' | null

  const mesasAbiertas = cuentas.filter((c) => c.estado === "abierta");
  const esAdmin = tieneRol(usuarioActual, "admin");

  const abrirTurno = async () => {
    const baseNum = parseFloat(base) || 0;
    const ahora = Date.now(), tramoId = uid();
    const turno = {
      id: uid(), aperturaTs: ahora, baseEfectivo: baseNum, estado: "abierto", abiertoPor: usuarioActual.nombre, abiertoPorUid: usuarioActual.uid,
      // La caja queda a cargo de quien abre; si hay relevos, cada persona responde solo por su tramo.
      responsableActual: { uid: usuarioActual.uid, nombre: usuarioActual.nombre, desdeTs: ahora },
      tramos: { [tramoId]: { id: tramoId, uid: usuarioActual.uid, nombre: usuarioActual.nombre, inicioTs: ahora, base: baseNum, estado: "activo" } },
    };
    await saveTurno(turno);
    setBase("");
  };

  // Tarjeta y transferencia se cuadran UNA vez, al cerrar (total del día). El efectivo se cuadra por tramo:
  // esperado = lo que recibió quien tiene la caja + ventas en efectivo + entradas − salidas desde entonces.
  const ventas = ventasDelTurno(cuentas, turnoAbierto);
  const mov = totalesMovimientos(turnoAbierto);
  const movimientos = movimientosDe(turnoAbierto);
  const tramo = turnoAbierto ? tramoVigente(turnoAbierto) : null;
  const stTramo = tramo ? statsTramo(turnoAbierto, cuentas, tramo) : null;
  const baseTurno = tramo ? tramo.base : 0;
  const esperado = stTramo ? stTramo.esperado : 0;
  const tarjetaEsperada = ventas.tarjeta;
  const transferenciaEsperada = ventas.transferencia;
  const responsable = turnoAbierto ? responsableDe(turnoAbierto) : null;
  const esResponsable = !!responsable && (!responsable.uid || responsable.uid === usuarioActual.uid);
  const relevoPendiente = !!(turnoAbierto && turnoAbierto.relevo);
  const contadoNum = parseFloat(contado) || 0;
  const diferencia = contadoNum - esperado;
  const tarjetaNum = parseFloat(contadoTarjeta) || 0;
  const transfNum = parseFloat(contadoTransf) || 0;
  const difTarjeta = tarjetaNum - tarjetaEsperada;
  const difTransf = transfNum - transferenciaEsperada;
  const todoCuadra = diferencia === 0 && difTarjeta === 0 && difTransf === 0;
  const camposCompletos = contado !== "" && contadoTarjeta !== "" && contadoTransf !== "";
  const arqueos = arqueosDe(turnoAbierto).filter((a) => !tramo || !a.tramoId || a.tramoId === tramo.id);
  const reiniciarCierre = () => {
    setContado(""); setContadoTarjeta(""); setContadoTransf(""); setObservaciones("");
    setCalculado(false); setConfirmandoCierre(false);
  };

  const registrarMovimiento = async ({ tipo, categoria, monto, nota }) => {
    const id = uid();
    const ok = await updateRecord("turnos", turnoAbierto.id, { [`movimientos/${id}`]: { id, ts: Date.now(), tipo, categoria, monto, nota, por: usuarioActual.nombre } });
    if (ok) { setMovForm(null); setErrorMov(""); }
    return ok;
  };
  const anularMovimiento = async (m) => {
    const ok = await updateRecord("turnos", turnoAbierto.id, {
      [`movimientos/${m.id}/anulado`]: true, [`movimientos/${m.id}/anuladoPor`]: usuarioActual.nombre, [`movimientos/${m.id}/anuladoTs`]: Date.now(),
    });
    setErrorMov(ok ? "" : "No se pudo anular. Revisa tu conexión.");
  };

  // Cada vez que se calcula, el intento se guarda (aunque después se corrija o se cancele).
  const calcular = async () => {
    const aid = uid();
    await updateRecord("turnos", turnoAbierto.id, {
      [`arqueos/${aid}`]: { id: aid, ts: Date.now(), por: usuarioActual.nombre, tipo: "cierre", tramoId: tramo.id, contado: contadoNum, tarjeta: tarjetaNum, transferencia: transfNum, difEfectivo: diferencia, difTarjeta, difTransferencia: difTransf },
    });
    setCalculado(true);
  };

  // Turno como quedaría si se cerrara ahora: sirve para mostrar el "Resumen del día" antes de confirmar.
  const armarCierre = (ahora) => {
    const tramoFinal = { ...tramo, finTs: ahora, ...stTramo, contado: contadoNum, diferencia, estado: "cerrado", cerradoPor: usuarioActual.nombre };
    const tramos = { ...(turnoAbierto.tramos || {}), [tramo.id]: tramoFinal };
    const difEfectivoDia = Object.values(tramos).reduce((a, t2) => a + (t2.diferencia || 0), 0);
    return {
      ...turnoAbierto, tramos, relevo: null, estado: "cerrado", cierreTs: ahora,
      ventasEfectivo: ventas.efectivo, entradas: mov.entradas, salidas: mov.salidas,
      propinas: propinasEnRango(cuentas, turnoAbierto.aperturaTs, ahora + 1),
      esperado, contado: contadoNum, diferencia: difEfectivoDia,   // diferencia = suma de lo que dejó cada tramo
      tarjetaEsperada, transferenciaEsperada, tarjetaContada: tarjetaNum, transferenciaContada: transfNum,
      difTarjeta, difTransferencia: difTransf,
      intentosCierre: Math.max(1, arqueos.length),
      observaciones: observaciones.trim() || null,
      cerradoPor: usuarioActual.nombre,
    };
  };
  const cerrarTurno = async () => {
    await saveTurno(armarCierre(Date.now()));
    reiniciarCierre();
  };

  const cerrados = turnos.filter((t) => t.estado === "cerrado").sort((a, b) => b.cierreTs - a.cierreTs);

  return (
    <div className="ancho" style={styles.menuScroll}>
      {!turnoAbierto ? (
        <div className="despliega" style={t.puerta}>
          <div style={t.puertaIcono}><Lock size={26} /></div>
          <div style={t.puertaTitulo}>Abre la caja para empezar</div>
          <div style={t.puertaTexto}>Cuenta el efectivo que hay en el cajón. Hasta que abras el turno no se pueden cobrar mesas. Quedará registrado que lo abre <b>{usuarioActual.nombre}</b>.</div>
          <div style={{ width: "100%", maxWidth: 360 }}>
            <CampoMonto placeholder="Efectivo inicial en caja" value={base} onChange={setBase} />
          </div>
          <button style={{ ...styles.sendBtn, width: "100%", maxWidth: 360, minHeight: 50, fontSize: 16 }} onClick={abrirTurno}><PlayCircle size={18} /> Abrir caja</button>
        </div>
      ) : (
        <div style={t.pagina}>
          {/* Estado de la caja */}
          <div style={t.estado}>
            <span style={t.estadoPunto} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Caja abierta <span style={t.estadoChip}>a cargo de {responsable.nombre || "—"}{esResponsable ? " (tú)" : ""}</span></span>
              <span style={t.meta}>Desde {timeLabel(turnoAbierto.aperturaTs)} · apertura {money(turnoAbierto.baseEfectivo || 0)} · lleva {duracionLabel(Date.now() - turnoAbierto.aperturaTs)}</span>
            </span>
          </div>

          <TarjetaRelevoPendiente turno={turnoAbierto} usuarioActual={usuarioActual} esAdmin={esAdmin} />

          {/* Resumen del turno: solo el propietario (el cajero cierra "a ciegas", sin ver lo esperado) */}
          {esAdmin && (
            <div style={t.stats}>
              <div style={{ ...t.stat, ...t.statVerde }}><span style={t.statEt}>EFECTIVO EN CAJA</span><span style={t.statVal}>{money(esperado)}</span><span style={t.statSub}>Lo que deberías contar al cerrar</span></div>
              <div style={t.stat}><span style={t.statEt}>TOTAL VENDIDO</span><span style={t.statVal}>{money(ventas.efectivo + ventas.tarjeta + ventas.transferencia)}</span><span style={t.statSub}>Todos los métodos</span></div>
              <div style={t.stat}><span style={t.statEt}>OTROS MÉTODOS</span><span style={t.statVal}>{money(ventas.tarjeta + ventas.transferencia)}</span><span style={t.statSub}>Tarjeta y transferencia</span></div>
              <div style={t.stat}><span style={t.statEt}>PROPINAS</span><span style={t.statVal}>{money(propinasEnRango(cuentas, turnoAbierto.aperturaTs))}</span><span style={t.statSub}>No cuentan como venta</span></div>
            </div>
          )}

          <div style={t.rejilla}>
            {/* Movimientos de caja */}
            <div style={t.tarjeta}>
              <div style={t.tarjetaTitulo}>Movimientos de caja</div>
              <div style={t.meta}>Anota el dinero que entra o sale del cajón <b>fuera de las ventas</b>.</div>
              {!calculado && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...t.selMov, ...t.selEntrada }} onClick={() => setMovForm("entrada")}><ArrowDownToLine size={22} color="#2f8f68" /> Entrada</button>
                  <button style={{ ...t.selMov, ...t.selSalida }} onClick={() => setMovForm("salida")}><ArrowUpFromLine size={22} color="#d64545" /> Salida</button>
                </div>
              )}
              {movimientos.length > 0 ? (
                <div style={t.movBox}>
                  <div style={t.movHead}>
                    <span style={t.etiqueta}>EN ESTE TURNO</span>
                    <span style={t.meta}>
                      {mov.entradas > 0 && <span style={{ color: "var(--c-5b7553-t)", fontWeight: 700 }}>+{money(mov.entradas)}</span>}
                      {mov.entradas > 0 && mov.salidas > 0 && "  ·  "}
                      {mov.salidas > 0 && <span style={{ color: "var(--c-c1442d-t)", fontWeight: 700 }}>−{money(mov.salidas)}</span>}
                    </span>
                  </div>
                  <ListaMovimientos movimientos={movimientos} onAnular={calculado ? null : anularMovimiento} puedeAnular={(m) => !tramo || m.ts >= tramo.inicioTs} />
                </div>
              ) : <div style={t.vacio}>Todavía no hay movimientos en este turno.</div>}
              {errorMov && <div style={{ fontSize: 12.5, color: "var(--c-c1442d-t)", fontWeight: 600 }}>{errorMov}</div>}
            </div>

            {/* Entrega y cierre */}
            <div style={t.tarjeta}>
              <div style={t.tarjetaTitulo}>Entrega y cierre</div>
          <div style={styles.closeConfirmText}>El total esperado en caja, tarjeta y transferencia se muestra al cerrar el turno, después de que registres lo que contaste.</div>

          {!confirmandoCierre ? (
            <>
              {mesasAbiertas.length > 0 && (
                <div style={styles.warnBanner}>
                  <AlertTriangle size={14} /> {mesasAbiertas.length} {mesasAbiertas.length === 1 ? "mesa tiene" : "mesas tienen"} cuenta abierta sin cobrar todavía.
                </div>
              )}
              {relevoPendiente ? (
                <div style={styles.closeConfirmText}>Mientras haya una entrega pendiente no se puede cerrar el turno: primero hay que recibirla o deshacerla.</div>
              ) : (
                <>
                  {esResponsable && (
                    <button style={t.btnEntregar} onClick={() => setFlujoEntrega("entregar")}><ArrowRightLeft size={15} /> Entregar la caja a otra persona</button>
                  )}
                  {!esResponsable && (
                    <>
                      <div style={styles.closeConfirmText}>La caja está a cargo de <b>{responsable.nombre}</b>. Si ya se fue y no la entregó, puedes asumirla: cuentas el efectivo y desde ese momento eres el responsable.</div>
                      <button style={t.btnEntregar} onClick={() => setFlujoEntrega("asumir")}><HandHelping size={15} /> Asumir la caja de {responsable.nombre}</button>
                    </>
                  )}
                  {(esResponsable || esAdmin) && (
                    <button style={styles.closeCajaBtn} onClick={() => setConfirmandoCierre(true)}><DoorClosed size={18} /> Cerrar turno (arqueo)</button>
                  )}
                </>
              )}
            </>
          ) : (
            <div style={styles.closeConfirmBox}>
              {mesasAbiertas.length > 0 && (
                <div style={styles.closeConfirmText}>
                  <b>Ojo:</b> {mesasAbiertas.length} {mesasAbiertas.length === 1 ? "mesa sigue" : "mesas siguen"} sin cobrar ({mesasAbiertas.map((c) => mesaNombre(mesas, c.mesa)).join(", ")}). Si cierras ahora, ese dinero no queda
                </div>
              )}
              <div style={styles.closeConfirmText}>
                {calculado ? "Resultado del arqueo. Si algo no cuadra, puedes corregir el conteo y volver a calcular." : "Registra lo que contaste. El sistema no te muestra lo esperado hasta que calcules."}
                {arqueos.length > 0 && <span style={t.meta}> · {arqueos.length} {arqueos.length === 1 ? "cálculo" : "cálculos"} en este cierre (todos quedan registrados)</span>}
              </div>
              <div style={styles.closeConfirmText}><b>Efectivo físico en caja</b></div>
              <CampoMonto placeholder="Efectivo contado" value={contado} onChange={(v) => !calculado && setContado(v)} />
              <div style={styles.closeConfirmText}><b>Tarjeta</b> — total del cierre de lote del datáfono</div>
              <CampoMonto placeholder="Total tarjeta (datáfono)" value={contadoTarjeta} onChange={(v) => !calculado && setContadoTarjeta(v)} />
              <div style={styles.closeConfirmText}><b>Transferencia</b> — total recibido según tu banco</div>
              <CampoMonto placeholder="Total transferencias (banco)" value={contadoTransf} onChange={(v) => !calculado && setContadoTransf(v)} />

              {!calculado ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.cancelEditBtn} onClick={reiniciarCierre}>Cancelar</button>
                  <button
                    style={{ ...styles.sendBtn, flex: 1, opacity: camposCompletos ? 1 : 0.4 }}
                    disabled={!camposCompletos}
                    onClick={calcular}
                  >
                    Calcular resultado
                  </button>
                </div>
              ) : (
                <>
                  <ResumenDia turno={armarCierre(Date.now())} cuentas={cuentas} />
                  {!todoCuadra ? (
                    <>
                      <button style={t.btnCorregir} onClick={() => setCalculado(false)}><RotateCcw size={15} /> Corregir conteo y volver a calcular</button>
                      <div style={styles.closeConfirmText}>¿No hay nada que corregir? Para cerrar con la diferencia, <b>cuéntanos por qué (obligatorio):</b></div>
                      <input style={styles.editInput} placeholder="Ej: se dio mal un vuelto, faltó registrar un pago…" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                    </>
                  ) : (
                    <input style={styles.editInput} placeholder="Observaciones (opcional)" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                  )}
                  <button
                    style={{ ...styles.sendBtn, opacity: todoCuadra || observaciones.trim() ? 1 : 0.4 }}
                    disabled={!todoCuadra && !observaciones.trim()}
                    onClick={cerrarTurno}
                  >
                    <Lock size={15} /> Confirmar cierre
                  </button>
                </>
              )}
            </div>
          )}
            </div>
          </div>
        </div>
      )}

      {flujoEntrega && turnoAbierto && <FlujoEntrega modo={flujoEntrega} turno={turnoAbierto} cuentas={cuentas} usuarioActual={usuarioActual} equipo={equipo || []} onCerrar={() => setFlujoEntrega(null)} />}
      {movForm && <FormularioMovimiento tipoInicial={movForm} onCancelar={() => setMovForm(null)} onGuardar={registrarMovimiento} />}

      {esAdmin && cerrados.length > 0 && (
        <>
          <div style={{ ...styles.catLabel, marginTop: 20 }}>TURNOS ANTERIORES</div>
          {agruparPorMes(cerrados, (tr) => tr.cierreTs).map((mes, i) => {
            const conDif = mes.items.filter((tr) => tr.diferencia !== 0).length;
            return (
              <Acordeon
                key={mes.key} titulo={mes.titulo} inicialAbierto={i === 0}
                resumen={`${mes.items.length} ${mes.items.length === 1 ? "turno" : "turnos"} · ${conDif === 0 ? "todos cuadraron" : `${conDif} con diferencia`}`}
              >
                {mes.items.map((tr) => {
                  const abierto = detalleAbierto === tr.id;
                  return (
                    <div key={tr.id} style={styles.turnoRowCol}>
                      <button style={t.cierreCabecera} onClick={() => setDetalleAbierto(abierto ? null : tr.id)} aria-expanded={abierto}>
                        <span style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                          <span style={styles.cierreDate}>{dateTimeLabel(tr.aperturaTs)} → {timeLabel(tr.cierreTs)}</span>
                          <span style={t.meta}>Abrió {tr.abiertoPor || "—"} · cerró {tr.cerradoPor || "—"}{Object.keys(tr.relevos || {}).length > 0 ? ` · ${Object.keys(tr.relevos).length} entrega(s) de caja` : ""}</span>
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ ...styles.turnoDiff, color: tr.diferencia === 0 ? "var(--c-5b7553-t)" : "var(--c-c1442d-t)" }}>
                            {tr.diferencia === 0 ? "Cuadró" : tr.diferencia > 0 ? `+${money(tr.diferencia)}` : money(tr.diferencia)}
                          </span>
                          {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </button>
                      {abierto && (
                        <div style={{ marginTop: 10 }} className="anim-in">
                          <ResumenDia turno={tr} cuentas={cuentasParaHistorial || cuentas} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </Acordeon>
            );
          })}
        </>
      )}

      {esAdmin && <PanelSenalesAlerta cuentas={cuentasParaHistorial} turnos={turnos} />}

    </div>
  );
}

// Estilos propios de esta pantalla (usan las variables de color de la paleta)
const t = {
  puerta: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, padding: "34px 18px", margin: "10px auto 0", maxWidth: 520, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 20 },
  puertaIcono: { width: 60, height: 60, borderRadius: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(52,199,142,.14)", color: "var(--pago-ok)", border: "1px solid rgba(52,199,142,.35)" },
  puertaTitulo: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--c-242019-t)" },
  puertaTexto: { fontSize: 13.5, lineHeight: 1.5, color: "var(--c-5c5648-t)", maxWidth: 380 },
  pagina: { display: "flex", flexDirection: "column", gap: 14, maxWidth: 1100, margin: "0 auto", width: "100%" },
  estado: { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, background: "linear-gradient(135deg, rgba(52,199,142,.14), rgba(52,199,142,.04))", border: "1px solid rgba(52,199,142,.32)", color: "var(--c-242019-t)" },
  estadoPunto: { width: 12, height: 12, borderRadius: 6, background: "var(--pago-ok)", boxShadow: "0 0 0 5px rgba(52,199,142,.2)", flexShrink: 0 },
  estadoChip: { fontSize: 11.5, fontWeight: 600, padding: "2px 9px", borderRadius: 10, background: "rgba(128,138,150,.16)", color: "var(--c-5c5648-t)", marginLeft: 4 },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 },
  stat: { display: "flex", flexDirection: "column", gap: 4, padding: "14px 14px", borderRadius: 16, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)" },
  statVerde: { background: "linear-gradient(135deg, rgba(52,199,142,.16), rgba(52,199,142,.05))", borderColor: "rgba(52,199,142,.35)" },
  statEt: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1, fontWeight: 700, color: "var(--c-8a8272-t)" },
  statVal: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--c-242019-t)" },
  statSub: { fontSize: 11.5, color: "var(--c-8a8272-t)" },
  rejilla: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, alignItems: "start" },
  tarjeta: { display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 18, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)" },
  tarjetaTitulo: { fontSize: 17, fontWeight: 700, color: "var(--c-242019-t)" },
  selMov: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 10px", borderRadius: 16, border: "1.5px solid var(--c-e4dfce-o)", background: "var(--c-f7f4ec-b)", color: "var(--c-242019-t)", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  selEntrada: { borderColor: "rgba(47,143,104,.45)", background: "rgba(47,143,104,.08)" },
  selSalida: { borderColor: "rgba(214,69,69,.45)", background: "rgba(214,69,69,.08)" },
  vacio: { fontSize: 13, color: "var(--c-8a8272-t)", padding: "6px 2px" },

  meta: { fontSize: 11.5, color: "var(--c-8a8272-t)" },
  etiqueta: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.3, color: "#9BA4B0", fontWeight: 700 },
  responsable: { display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--c-f1ecdd-b)", borderRadius: 12, color: "var(--c-242019-t)" },
  avatar: { width: 38, height: 38, borderRadius: 19, background: "var(--accent)", color: "#F4F6F8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, flexShrink: 0 },
  btnMov: { ...styles.modoChoiceBtn, flex: 1, width: "auto", fontSize: 14, fontWeight: 600 },
  movBox: { background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 12, padding: "10px 12px" },
  movHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 },
  libro: { fontWeight: 500, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(128,138,150,.3)" },
  btnEntregar: { ...styles.modoChoiceBtn, border: "1px solid var(--c-d9cfae-o)", fontSize: 14, fontWeight: 700 },
  btnCorregir: { ...styles.addItemBtn, background: "transparent", fontSize: 14, fontWeight: 700, border: "1.5px solid var(--accent)", color: "var(--accent-t)" },
  cierreCabecera: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--c-242019-t)" },
  detalle: { display: "flex", flexDirection: "column", gap: 2, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--c-e4dfce-o)", fontSize: 12.5, color: "var(--c-5c5648-t)" },
};

export function RespaldoBox({ menu, orders, cuentas, config, turnos, mesas, persistConfig, usuarioActual, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto }) {
  const [restaurando, setRestaurando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const onArchivoElegido = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.menu || !data.orders || !data.cuentas || !data.config) throw new Error("Archivo incompleto");
        setArchivo(data);
        setConfirmando(true);
        setError("");
      } catch (err) {
        setError("Ese archivo no parece un respaldo válido.");
      }
    };
    reader.readAsText(file);
  };

  const confirmarRestauracion = async () => {
    if (!archivo) return;
    await saveShared("menu", archivo.menu);
    await saveCollectionArray("orders", archivo.orders);
    await saveCollectionArray("cuentas", archivo.cuentas);
    await saveCollectionArray("turnos", archivo.turnos || []);
    if (archivo.mesas && archivo.mesas.length > 0) await saveShared("mesas", archivo.mesas);
    const nuevoConfig = {
      ...archivo.config,
      auditLog: [{ ts: Date.now(), accion: "Restauró un respaldo desde archivo", actor: usuarioActual.nombre }, ...(archivo.config.auditLog || [])].slice(0, 500),
    };
    await saveShared("config", nuevoConfig);
    window.location.reload();
  };

  const descargarPendiente = useRef(false);
  // Una vez que el historial completo termina de cargar, dispara la descarga.
  useEffect(() => {
    if (descargarPendiente.current && historialCompleto) {
      descargarPendiente.current = false;
      descargarRespaldo({ menu, orders: ordersParaHistorial, cuentas: cuentasParaHistorial, config, turnos, mesas });
    }
  }, [historialCompleto]);
  const onClickDescargar = () => {
    if (historialCompleto) {
      descargarRespaldo({ menu, orders: ordersParaHistorial, cuentas: cuentasParaHistorial, config, turnos, mesas });
    } else {
      descargarPendiente.current = true;
      cargarHistorialCompleto();
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={styles.catLabel}>RESPALDO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>

        <div style={styles.respaldoCard}>
          <div style={styles.respaldoTitulo}>Copia de seguridad completa</div>
          <div style={styles.respaldoTexto}>
            Guarda un archivo en este dispositivo con todo el historial del negocio:
            <ul style={styles.respaldoLista}>
              <li>Menú, productos y precios</li>
              <li>Pedidos y cuentas, con sus pagos, propinas, descuentos y cancelaciones</li>
              <li>Turnos, arqueos y movimientos de caja</li>
              <li>Mesas y su ubicación en el plano</li>
              <li>Ajustes del negocio: nombre, marca y registro de seguridad</li>
            </ul>
            No cambia nada en la app. <b>No incluye</b> el inventario ni las cuentas de usuario del equipo.
          </div>
          <button style={styles.modoChoiceBtn} onClick={onClickDescargar} disabled={cargandoHistorial}>
            <Download size={15} /> {cargandoHistorial ? "Preparando respaldo completo…" : "Descargar copia de seguridad completa"}
          </button>
        </div>

        <div style={styles.respaldoCard}>
          <div style={styles.respaldoTitulo}>Restaurar desde un archivo</div>
          <div style={styles.respaldoTexto}>
            Vuelve la app al estado de un archivo de respaldo. <b>Reemplaza</b> lo que hay ahora de: menú, pedidos, cuentas, turnos, mesas y ajustes.
            Todo lo registrado después de la fecha del archivo se pierde. No toca el inventario ni los usuarios. Recomendado: descarga una copia de lo actual antes de restaurar.
          </div>
          {!restaurando ? (
            <button style={styles.inlineAddLink} onClick={() => setRestaurando(true)}>Restaurar desde un archivo de respaldo</button>
          ) : (
            <div className="despliega" style={styles.turnoBox}>
              <div style={styles.closeConfirmText}><b>Cuidado:</b> esto no se puede deshacer. Elige el archivo .json del respaldo.</div>
              <input ref={fileInputRef} type="file" accept="application/json" onChange={onArchivoElegido} />
              {error && <div style={styles.pinError}>{error}</div>}
              {confirmando && archivo && (
                <div style={styles.closeConfirmBox}>
                  <div style={styles.closeConfirmText}>
                    Este archivo es de "{archivo.config.businessName}", exportado el {dateTimeLabel(archivo.exportadoTs)}. ¿Restaurar y reemplazar todo lo actual?
                  </div>
                  {archivo.automatica && (
                    <div style={styles.pinError}>
                      Es una copia automática de un solo día ({archivo.dia}). Si la restauras, el historial completo se reemplaza por las ventas de ese único día y los turnos quedan vacíos.
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={styles.cancelEditBtn} onClick={() => { setConfirmando(false); setArchivo(null); }}>Cancelar</button>
                    <button style={{ ...styles.sendBtn, flex: 1 }} onClick={confirmarRestauracion}><Lock size={15} /> Sí, restaurar</button>
                  </div>
                </div>
              )}
              <button style={styles.cancelEditBtn} onClick={() => { setRestaurando(false); setArchivo(null); setConfirmando(false); setError(""); }}>Cerrar</button>
            </div>
          )}
        </div>

        <RespaldosAutomaticosBox />
      </div>
    </div>
  );
}

export function RespaldosAutomaticosBox() {
  const [dias, setDias] = useState(null); // null = sin cargar todavía
  const [cargando, setCargando] = useState(false);

  const cargarLista = async () => {
    setCargando(true);
    const hoy = new Date();
    const candidatos = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
      candidatos.push(dayKey(d.getTime()));
    }
    const resultados = await Promise.all(candidatos.map((dk) => getRecord(`respaldos/${dk}`)));
    setDias(resultados.filter(Boolean).sort((a, b) => b.dia.localeCompare(a.dia)));
    setCargando(false);
  };

  const descargarDia = (r) => {
    const data = { version: 2, exportadoTs: Date.now(), automatica: true, dia: r.dia, menu: r.menu, orders: r.orders, cuentas: r.cuentas, config: r.config, turnos: [], mesas: r.mesas };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `respaldo_automatico_${r.dia}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.respaldoCard}>
      <div style={styles.respaldoTitulo}>Copias automáticas</div>
      <div style={styles.respaldoTexto}>
        Cada día, la primera vez que un administrador abre la app, se guarda sola una copia del <b>día anterior</b>: sus cuentas y pedidos, más el menú, las mesas y los ajustes.
        Aquí puedes ver y descargar las de los últimos 14 días, útiles para consultar o recuperar lo de un día puntual.
        Cada una trae <b>un solo día</b> de ventas y no incluye turnos, así que no sirven para restaurar todo el negocio (para eso usa la copia completa).
      </div>
      {dias === null ? (
        <button style={styles.inlineAddLink} onClick={cargarLista} disabled={cargando}>
          {cargando ? "Buscando…" : "Ver copias automáticas de los últimos 14 días"}
        </button>
      ) : dias.length === 0 ? (
        <div style={styles.cajaEmptyText}>Todavía no hay copias automáticas (se generan solas cada día que un admin abre la app — la de hoy se hace mañana).</div>
      ) : (
        <div className="despliega">
          {dias.map((r) => (
            <div key={r.dia} style={styles.turnoRow}>
              <span style={styles.cierreDate}>{r.dia} · {r.cuentas.length} {r.cuentas.length === 1 ? "cuenta" : "cuentas"}</span>
              <button style={styles.inlineLink} onClick={() => descargarDia(r)}><Download size={11} style={{ verticalAlign: -1 }} /> descargar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Junta en un solo lugar las señales que ya existían regadas por la app
 * (cancelaciones, descuentos, descuadres de turno) para que el admin no
 * tenga que ir a buscarlas una por una — no es una acusación, es solo un
 * resumen para que decidas tú si algo amerita una conversación. */
export function PanelSenalesAlerta({ cuentas, turnos }) {
  const [expandido, setExpandido] = useState(false);

  const porPersona = {};
  const tocar = (nombre) => {
    if (!porPersona[nombre]) porPersona[nombre] = { cancelaciones: 0, montoCancelado: 0, descuentos: 0, montoDescontado: 0, turnosConFaltante: 0, montoFaltante: 0 };
    return porPersona[nombre];
  };

  cuentas.filter((c) => c.estado === "cancelada" && (c.montoCancelado || 0) > 0 && c.canceladaPor).forEach((c) => {
    const p = tocar(c.canceladaPor);
    p.cancelaciones += 1;
    p.montoCancelado += c.montoCancelado || 0;
  });
  cuentas.filter((c) => c.descuento && c.descuento.aplicadoPor).forEach((c) => {
    const p = tocar(c.descuento.aplicadoPor);
    p.descuentos += 1;
    p.montoDescontado += c.descuento.monto || 0;
  });
  // El faltante es de quien tenía la caja en ese tramo (no necesariamente de quien cerró el turno)
  turnos.filter((t) => t.estado === "cerrado").forEach((t) => {
    tramosDe(t).filter((tr) => (tr.diferencia || 0) < 0 && tr.nombre).forEach((tr) => {
      const p = tocar(tr.nombre);
      p.turnosConFaltante += 1;
      p.montoFaltante += Math.abs(tr.diferencia);
    });
  });

  const filas = Object.entries(porPersona)
    .map(([nombre, d]) => ({ nombre, ...d, alerta: d.cancelaciones >= 3 || d.turnosConFaltante >= 2 }))
    .sort((a, b) => (b.alerta ? 1 : 0) - (a.alerta ? 1 : 0) || (b.montoCancelado + b.montoFaltante) - (a.montoCancelado + a.montoFaltante));

  const hayAlertas = filas.some((f) => f.alerta);

  if (filas.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <button style={styles.canceladasToggle} onClick={() => setExpandido((v) => !v)}>
        <AlertTriangle size={13} color={hayAlertas ? "var(--c-c1442d-t)" : "var(--c-b98a2e-t)"} />
        <span style={{ color: hayAlertas ? "var(--c-8a3a2b-t)" : "var(--c-5c5648-t)" }}>Señales de alerta (últimos 35 días){hayAlertas ? " — hay algo que revisar" : ""}</span>
        <span>{expandido ? "▲" : "▼"}</span>
      </button>
      {expandido && (
        <div style={{ marginTop: 8 }}>
          {filas.map((f) => (
            <div key={f.nombre} style={{ ...styles.turnoRowCol, ...(f.alerta ? { background: "var(--c-fbe2dc-b)", borderRadius: 8, padding: "8px 10px" } : {}) }}>
              <div style={{ ...styles.turnoRow, border: "none", padding: 0 }}>
                <span style={styles.pagoRowEtiqueta}>{f.nombre}</span>
                {f.alerta && <AlertTriangle size={13} color="var(--c-c1442d-t)" />}
              </div>
              <div style={styles.turnoSubRow}>
                {f.cancelaciones > 0 && <>· {f.cancelaciones} {f.cancelaciones === 1 ? "cancelación" : "cancelaciones"} ({money(f.montoCancelado)}) </>}
                {f.descuentos > 0 && <>· {f.descuentos} {f.descuentos === 1 ? "descuento" : "descuentos"} ({money(f.montoDescontado)}) </>}
                {f.turnosConFaltante > 0 && <>· {f.turnosConFaltante} {f.turnosConFaltante === 1 ? "turno con faltante" : "turnos con faltante"} ({money(f.montoFaltante)})</>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

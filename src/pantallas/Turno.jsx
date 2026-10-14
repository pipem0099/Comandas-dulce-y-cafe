import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, Lock, Download, PlayCircle, StopCircle,
} from "lucide-react";
import { uid, money } from "../logica.js";
import { saveShared, getRecord, saveCollectionArray } from "../firebase.js";
import { CampoMonto } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { descargarRespaldo } from "../exportar.js";
import { GestionUsuarios } from "../pantallas/Usuarios.jsx";
import { dateTimeLabel, dayKey, mesaNombre, pagosDe, tieneRol, timeLabel } from "../utilidades.js";

/* ---------------- Turno / arqueo de caja ---------------- */

export function TurnoView({ turnos, turnoAbierto, saveTurno, orders, cuentas, config, persistConfig, usuarioActual, menu, mesas, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto }) {
  const [base, setBase] = useState("");
  const [contado, setContado] = useState("");
  const [contadoTarjeta, setContadoTarjeta] = useState("");
  const [contadoTransf, setContadoTransf] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  // Cierre "a ciegas": los montos esperados solo se muestran DESPUÉS de que el
  // cajero escribió lo que contó. Si cancela y vuelve a empezar, queda anotado.
  const [calculado, setCalculado] = useState(false);
  const [intentos, setIntentos] = useState(0);

  const mesasAbiertas = cuentas.filter((c) => c.estado === "abierta");
  const esAdmin = tieneRol(usuarioActual, "admin");

  const abrirTurno = async () => {
    const baseNum = parseFloat(base) || 0;
    const turno = { id: uid(), aperturaTs: Date.now(), baseEfectivo: baseNum, estado: "abierto", abiertoPor: usuarioActual.nombre };
    await saveTurno(turno);
    setBase("");
  };

  // Efectivo, tarjeta y transferencia recibidos en este turno (según lo registrado en la app).
  const totalesPorMetodo = () => {
    const totales = { efectivo: turnoAbierto ? turnoAbierto.baseEfectivo : 0, tarjeta: 0, transferencia: 0 };
    if (!turnoAbierto) return totales;
    cuentas.filter((c) => c.estado === "pagada" && c.pagadaTs >= turnoAbierto.aperturaTs).forEach((c) => {
      pagosDe(c).forEach((p) => { if (totales[p.metodoPago] !== undefined) totales[p.metodoPago] += p.monto; });
    });
    return totales;
  };

  const { efectivo: esperado, tarjeta: tarjetaEsperada, transferencia: transferenciaEsperada } = totalesPorMetodo();
  const contadoNum = parseFloat(contado) || 0;
  const diferencia = contadoNum - esperado;
  const tarjetaNum = parseFloat(contadoTarjeta) || 0;
  const transfNum = parseFloat(contadoTransf) || 0;
  const difTarjeta = tarjetaNum - tarjetaEsperada;
  const difTransf = transfNum - transferenciaEsperada;
  const todoCuadra = diferencia === 0 && difTarjeta === 0 && difTransf === 0;
  const camposCompletos = contado !== "" && contadoTarjeta !== "" && contadoTransf !== "";
  const textoDif = (d) => (d === 0 ? "Cuadra exacto ✓" : d > 0 ? `Sobran ${money(d)}` : `Faltan ${money(Math.abs(d))}`);
  const colorDif = (d) => (d === 0 ? "var(--c-e4eee1-b)" : d > 0 ? "var(--c-fbefd9-b)" : "var(--c-fbe2dc-b)");
  const reiniciarCierre = () => {
    setContado(""); setContadoTarjeta(""); setContadoTransf(""); setObservaciones("");
    setCalculado(false); setConfirmandoCierre(false);
  };

  const cerrarTurno = async () => {
    await saveTurno({
      ...turnoAbierto, estado: "cerrado", cierreTs: Date.now(),
      esperado, contado: contadoNum, diferencia,
      tarjetaEsperada, transferenciaEsperada,
      tarjetaContada: tarjetaNum, transferenciaContada: transfNum,
      difTarjeta, difTransferencia: difTransf,
      intentosCierre: intentos + 1,
      observaciones: observaciones.trim() || null,
      cerradoPor: usuarioActual.nombre,
    });
    reiniciarCierre(); setIntentos(0);
  };

  const cerrados = turnos.filter((t) => t.estado === "cerrado").sort((a, b) => b.cierreTs - a.cierreTs);

  return (
    <div className="ancho" style={styles.menuScroll}>
      {!turnoAbierto ? (
        <div style={styles.turnoBox}>
          <div style={styles.pageEyebrow}>TURNO CERRADO</div>
          <div style={styles.closeConfirmText}>Registra cuánto efectivo hay en caja para empezar el turno.</div>
          <CampoMonto placeholder="Base de efectivo inicial" value={base} onChange={setBase} />
          <button style={{ ...styles.addItemBtn, marginTop: 8 }} onClick={abrirTurno}><PlayCircle size={15} /> Abrir turno</button>
        </div>
      ) : (
        <div style={styles.turnoBox}>
          <div style={styles.pageEyebrow}>TURNO ABIERTO</div>
          <div style={styles.closeConfirmText}>Abierto {dateTimeLabel(turnoAbierto.aperturaTs)} · base {money(turnoAbierto.baseEfectivo)}</div>
          <div style={styles.closeConfirmText}>El total esperado en caja, tarjeta y transferencia se muestra al cerrar el turno, después de que registres lo que contaste.</div>

          {!confirmandoCierre ? (
            <>
              {mesasAbiertas.length > 0 && (
                <div style={styles.warnBanner}>
                  <AlertTriangle size={14} /> {mesasAbiertas.length} {mesasAbiertas.length === 1 ? "mesa tiene" : "mesas tienen"} cuenta abierta sin cobrar todavía.
                </div>
              )}
              <button style={styles.closeCajaBtn} onClick={() => setConfirmandoCierre(true)}><StopCircle size={15} /> Cerrar turno (arqueo)</button>
            </>
          ) : (
            <div style={styles.closeConfirmBox}>
              {mesasAbiertas.length > 0 && (
                <div style={styles.closeConfirmText}>
                  <b>Ojo:</b> {mesasAbiertas.length} {mesasAbiertas.length === 1 ? "mesa sigue" : "mesas siguen"} sin cobrar ({mesasAbiertas.map((c) => mesaNombre(mesas, c.mesa)).join(", ")}). Si cierras ahora, ese dinero no quedará contado en este turno.
                </div>
              )}
              <div style={styles.closeConfirmText}>Registra lo que contaste. El sistema no te muestra lo esperado hasta que calcules.</div>
              <div style={styles.closeConfirmText}><b>Efectivo físico en caja</b></div>
              <CampoMonto placeholder="Efectivo contado" value={contado} onChange={(v) => !calculado && setContado(v)} />
              <div style={styles.closeConfirmText}><b>Tarjeta</b> — total del cierre de lote del datáfono</div>
              <CampoMonto placeholder="Total tarjeta (datáfono)" value={contadoTarjeta} onChange={(v) => !calculado && setContadoTarjeta(v)} />
              <div style={styles.closeConfirmText}><b>Transferencia</b> — total recibido según tu banco</div>
              <CampoMonto placeholder="Total transferencias (banco)" value={contadoTransf} onChange={(v) => !calculado && setContadoTransf(v)} />

              {!calculado ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.cancelEditBtn} onClick={() => { if (camposCompletos || contado !== "" || contadoTarjeta !== "" || contadoTransf !== "") setIntentos((n) => n + 1); reiniciarCierre(); }}>Cancelar</button>
                  <button
                    style={{ ...styles.sendBtn, flex: 1, opacity: camposCompletos ? 1 : 0.4 }}
                    disabled={!camposCompletos}
                    onClick={() => setCalculado(true)}
                  >
                    Calcular resultado
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ ...styles.diferenciaBox, background: colorDif(diferencia), textAlign: "left" }}>
                    <b>Efectivo:</b> {textoDif(diferencia)}<br />
                    <span style={{ fontWeight: 500, fontSize: 12 }}>Esperado en caja: {money(esperado)} · contaste {money(contadoNum)}</span>
                  </div>
                  <div style={{ ...styles.diferenciaBox, background: colorDif(difTarjeta), textAlign: "left" }}>
                    <b>Tarjeta:</b> {textoDif(difTarjeta)}<br />
                    <span style={{ fontWeight: 500, fontSize: 12 }}>Esperado: {money(tarjetaEsperada)} · registraste {money(tarjetaNum)}</span>
                  </div>
                  <div style={{ ...styles.diferenciaBox, background: colorDif(difTransf), textAlign: "left" }}>
                    <b>Transferencia:</b> {textoDif(difTransf)}<br />
                    <span style={{ fontWeight: 500, fontSize: 12 }}>Esperado: {money(transferenciaEsperada)} · registraste {money(transfNum)}</span>
                  </div>
                  {!todoCuadra ? (
                    <>
                      <div style={styles.closeConfirmText}><b>Algo no cuadró — cuéntanos por qué (obligatorio):</b></div>
                      <input autoFocus style={styles.editInput} placeholder="Ej: se dio mal un vuelto, faltó registrar un pago…" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
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
      )}

      {cerrados.length > 0 && (
        <>
          <div style={{ ...styles.catLabel, marginTop: 20 }}>TURNOS ANTERIORES</div>
          {cerrados.map((t) => (
            <div key={t.id} style={styles.turnoRowCol}>
              <div style={{ ...styles.turnoRow, border: "none", padding: 0 }}>
                <span style={styles.cierreDate}>{dateTimeLabel(t.aperturaTs)} → {timeLabel(t.cierreTs)}</span>
                <span style={{ ...styles.turnoDiff, color: t.diferencia === 0 ? "var(--c-5b7553-t)" : "var(--c-c1442d-t)" }}>
                  {t.diferencia === 0 ? "Cuadró" : t.diferencia > 0 ? `+${money(t.diferencia)}` : money(t.diferencia)}
                </span>
              </div>
              {(t.tarjetaEsperada > 0 || t.transferenciaEsperada > 0) && (
                <div style={styles.turnoSubRow}>
                  Tarjeta {money(t.tarjetaEsperada || 0)}{typeof t.difTarjeta === "number" && t.difTarjeta !== 0 ? ` (${t.difTarjeta > 0 ? "+" : ""}${money(t.difTarjeta)})` : ""} · Transferencia {money(t.transferenciaEsperada || 0)}{typeof t.difTransferencia === "number" && t.difTransferencia !== 0 ? ` (${t.difTransferencia > 0 ? "+" : ""}${money(t.difTransferencia)})` : ""}
                  {t.intentosCierre > 1 ? ` · cierre iniciado ${t.intentosCierre} veces` : ""}
                </div>
              )}
              {t.observaciones && <div style={styles.turnoObsRow}>"{t.observaciones}"</div>}
            </div>
          ))}
        </>
      )}

      {esAdmin && (
        <RespaldoBox menu={menu} orders={orders} cuentas={cuentas} config={config} turnos={turnos} mesas={mesas} persistConfig={persistConfig} usuarioActual={usuarioActual} ordersParaHistorial={ordersParaHistorial} cuentasParaHistorial={cuentasParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} />
      )}

      {esAdmin && <PanelSenalesAlerta cuentas={cuentasParaHistorial} turnos={turnos} />}

      <div style={{ ...styles.catLabel, marginTop: 24 }}>USUARIOS Y SEGURIDAD</div>
      {esAdmin ? (
        <GestionUsuarios config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} />
      ) : (
        <div style={styles.lockedNote}><Lock size={11} /> Solo un administrador puede gestionar usuarios y ver el registro de seguridad.</div>
      )}
    </div>
  );
}

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
      auditLog: [{ ts: Date.now(), accion: "Restauró un respaldo desde archivo", actor: usuarioActual.nombre }, ...(archivo.config.auditLog || [])].slice(0, 50),
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
    <div style={{ ...styles.catLabel, marginTop: 24 }}>
      RESPALDO
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        <button style={styles.modoChoiceBtn} onClick={onClickDescargar} disabled={cargandoHistorial}>
          <Download size={15} /> {cargandoHistorial ? "Preparando respaldo completo…" : "Descargar copia de seguridad completa"}
        </button>
        {!restaurando ? (
          <button style={styles.inlineAddLink} onClick={() => setRestaurando(true)}>Restaurar desde un archivo de respaldo</button>
        ) : (
          <div style={styles.turnoBox}>
            <div style={styles.closeConfirmText}><b>Cuidado:</b> restaurar reemplaza todos los datos actuales (menú, pedidos, historial) por los del archivo. No se puede deshacer.</div>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={onArchivoElegido} />
            {error && <div style={styles.pinError}>{error}</div>}
            {confirmando && archivo && (
              <div style={styles.closeConfirmBox}>
                <div style={styles.closeConfirmText}>
                  Este archivo es de "{archivo.config.businessName}", exportado el {dateTimeLabel(archivo.exportadoTs)}. ¿Restaurar y reemplazar todo lo actual?
                </div>
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
    const data = { version: 2, exportadoTs: Date.now(), menu: r.menu, orders: r.orders, cuentas: r.cuentas, config: r.config, turnos: [], mesas: r.mesas };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `respaldo_automatico_${r.dia}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ marginTop: 14 }}>
      {dias === null ? (
        <button style={styles.inlineAddLink} onClick={cargarLista} disabled={cargando}>
          {cargando ? "Buscando…" : "Ver copias automáticas de los últimos 14 días"}
        </button>
      ) : dias.length === 0 ? (
        <div style={styles.cajaEmptyText}>Todavía no hay copias automáticas (se generan solas cada día que un admin abre la app — la de hoy se hace mañana).</div>
      ) : (
        <>
          <div style={styles.catLabel}>COPIAS AUTOMÁTICAS RECIENTES</div>
          {dias.map((r) => (
            <div key={r.dia} style={styles.turnoRow}>
              <span style={styles.cierreDate}>{r.dia} · {r.cuentas.length} {r.cuentas.length === 1 ? "cuenta" : "cuentas"}</span>
              <button style={styles.inlineLink} onClick={() => descargarDia(r)}><Download size={11} style={{ verticalAlign: -1 }} /> descargar</button>
            </div>
          ))}
        </>
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
  turnos.filter((t) => t.estado === "cerrado" && t.diferencia < 0 && t.cerradoPor).forEach((t) => {
    const p = tocar(t.cerradoPor);
    p.turnosConFaltante += 1;
    p.montoFaltante += Math.abs(t.diferencia);
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

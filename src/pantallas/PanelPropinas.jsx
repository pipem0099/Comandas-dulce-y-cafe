import React, { useEffect, useMemo, useState } from "react";
import { Wallet, ChevronDown, Undo2 } from "lucide-react";
import { Hoja } from "../componentes/Hoja.jsx";
import { Despliegue } from "../componentes/Comunes.jsx";
import { subscribeShared, subscribeCollection, guardarReparto, anularRepartoPropinas } from "../firebase.js";
import { clasificarPropinas, desglosePorTurno, dividirPropina, armarReparto } from "../propinas.js";
import { money, uid } from "../logica.js";
import { dateTimeLabel, dayLabel } from "../utilidades.js";
import { styles } from "../estilos.js";

/* Reparto de propinas (solo administradores). Lo ya repartido queda con candado y NUNCA se vuelve a sumar;
   al repartir un rango (semana, mes, fechas propias) solo entra lo pendiente de turnos CERRADOS. */
const pill = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 38, padding: "0 14px", borderRadius: 999, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const pillOn = { ...pill, background: "var(--accent)", color: "var(--accent-fg, #fff)", border: "1px solid transparent" };
const campoFecha = { minHeight: 38, padding: "0 10px", borderRadius: 10, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", font: "inherit", fontSize: 14 };
const nota = { fontSize: 13, color: "var(--c-5c5648-t)", lineHeight: 1.45 };
const verde = "var(--c-5b7553-t)", ambar = "var(--c-b98a2e-t)", gris = "var(--c-8a8272-t)", rojo = "var(--c-c1442d-t)";
const diaCorto = (clave) => dayLabel(new Date(`${clave}T12:00:00`).getTime());
const nuevoId = () => `r${uid()}`;

function HojaReparto({ pendientes, total, equipo, etiqueta, desde, hasta, usuarioActual, onListo, onCerrar }) {
  const [modo, setModo] = useState("varios");
  const [elegidos, setElegidos] = useState([]);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const gente = useMemo(() => (equipo || []).filter((p) => p.activo).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")), [equipo]);
  const quienes = gente.filter((p) => elegidos.includes(p.uid));
  const lineas = modo === "uno" ? dividirPropina(total, quienes.slice(0, 1)) : dividirPropina(total, quienes);
  const alternar = (uid) => setElegidos((prev) => (modo === "uno" ? (prev.includes(uid) ? [] : [uid]) : prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  const cambiarModo = (m) => { setModo(m); setElegidos((prev) => (m === "uno" ? prev.slice(0, 1) : prev)); };

  const confirmar = async (cerrar) => {
    if (trabajando || lineas.length === 0) return;
    setTrabajando(true); setError("");
    const repartoId = nuevoId();
    const arm = armarReparto({ pendientes, destinatarios: quienes, modo, repartoId, ahora: Date.now(), usuario: usuarioActual, desde, hasta, periodo: etiqueta });
    const r = arm ? await guardarReparto({ repartoId, ...arm }) : { ok: false, motivo: "vacio" };
    setTrabajando(false);
    if (r.ok) { onListo && onListo(); cerrar(); }
    else setError(r.motivo === "sin-conexion" ? "Sin conexión: el reparto necesita internet para quedar guardado. Inténtalo cuando vuelva." : "No se pudo guardar. Puede que otro administrador ya haya repartido alguna de estas propinas: cierra esta ventana, revisa y vuelve a intentar.");
  };

  return (
    <Hoja onCerrar={onCerrar} ancho={520} gap={12} label="Repartir propinas" z={300} centro>
      {({ cerrar }) => (
        <>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" }}>Repartir {money(total)}</div>
            <div style={nota}>{etiqueta} · {pendientes.length} {pendientes.length === 1 ? "cuenta" : "cuentas"} de turnos ya cerrados. Se entrega en efectivo, sin importar cómo pagó el cliente.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }} role="radiogroup" aria-label="Cómo repartir">
            <button type="button" role="radio" aria-checked={modo === "uno"} style={{ ...(modo === "uno" ? pillOn : pill), flex: 1 }} onClick={() => cambiarModo("uno")}>Una persona</button>
            <button type="button" role="radio" aria-checked={modo === "varios"} style={{ ...(modo === "varios" ? pillOn : pill), flex: 1 }} onClick={() => cambiarModo("varios")}>Varias (partes iguales)</button>
          </div>
          <div style={{ ...nota, fontWeight: 600 }}>{modo === "uno" ? "¿Quién se la lleva?" : "¿Entre quiénes se divide?"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "38vh", overflowY: "auto" }}>
            {gente.length === 0 && <div style={nota}>No hay personas activas en el equipo.</div>}
            {gente.map((p) => {
              const on = elegidos.includes(p.uid); const l = lineas.find((x) => x.uid === p.uid);
              return (
                <button key={p.uid} type="button" role={modo === "uno" ? "radio" : "checkbox"} aria-checked={on} onClick={() => alternar(p.uid)}
                  style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 46, padding: "0 12px", borderRadius: 12, border: on ? "1.5px solid var(--accent)" : "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", font: "inherit", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 20, height: 20, borderRadius: modo === "uno" ? 10 : 6, border: on ? "none" : "1.5px solid var(--btn2-line)", background: on ? "var(--accent)" : "transparent", color: "var(--accent-fg, #fff)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{on ? "✓" : ""}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{p.nombre}</span>
                  {l && <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{money(l.monto)}</span>}
                </button>
              );
            })}
          </div>
          {error && <div role="alert" style={{ fontSize: 13, color: rojo }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ ...pill, flex: 1, minHeight: 46 }} onClick={cerrar} disabled={trabajando}>Cancelar</button>
            <button type="button" data-atajo="confirmar" disabled={lineas.length === 0 || trabajando} onClick={() => confirmar(cerrar)}
              style={{ ...pillOn, flex: 2, minHeight: 46, opacity: lineas.length === 0 || trabajando ? 0.45 : 1 }}>
              {trabajando ? "Guardando…" : lineas.length === 0 ? "Elige a quién" : `Repartir ${money(total)}${lineas.length > 1 ? ` entre ${lineas.length}` : ""}`}
            </button>
          </div>
          <div style={{ ...nota, fontSize: 12.5 }}>Queda guardado con tu nombre y la fecha. Cada persona verá lo suyo en «Mis propinas». Si te equivocas, puedes anular el reparto y esas propinas vuelven a quedar pendientes.</div>
        </>
      )}
    </Hoja>
  );
}

export function PanelPropinas({ cuentasRango, cuentasTodas, turnos, equipo, usuarioActual, desde, hasta, etiquetaRango, historialListo, cargarHistorialCompleto, onResumen }) {
  const [candados, setCandados] = useState({});
  const [repartos, setRepartos] = useState([]);
  const [propio, setPropio] = useState(false);              // fechas propias en vez del período del reporte
  const hoy = new Date(); const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [fDesde, setFDesde] = useState(aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [fHasta, setFHasta] = useState(aISO(hoy));
  const [reparto, setReparto] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const [anular, setAnular] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => subscribeShared("propinasPagadas", {}, setCandados), []);
  useEffect(() => subscribeCollection("repartosPropinas", setRepartos), []);
  useEffect(() => { if (propio && cargarHistorialCompleto) cargarHistorialCompleto(); }, [propio]); // eslint-disable-line react-hooks/exhaustive-deps

  const d0 = propio ? new Date(`${fDesde}T00:00:00`).getTime() : desde;
  const h0 = propio ? new Date(`${fHasta}T00:00:00`).getTime() + 86400000 : hasta;
  const etiqueta = propio ? `Del ${diaCorto(fDesde)} al ${diaCorto(fHasta)}` : etiquetaRango;
  const base = propio ? cuentasTodas : cuentasRango;
  const datos = useMemo(() => clasificarPropinas({ cuentas: base, turnos, candados, desde: d0, hasta: h0 }), [base, turnos, candados, d0, h0]);
  const porTurno = useMemo(() => desglosePorTurno([...datos.pendientes, ...datos.repartidas], turnos), [datos, turnos]);
  const repartoPorId = useMemo(() => Object.fromEntries(repartos.map((r) => [r.id || "", r])), [repartos]);
  const idsEnRango = useMemo(() => Array.from(new Set(datos.repartidas.map((x) => x.repartoId))), [datos]);
  const repartosRango = repartos.filter((r) => idsEnRango.includes(r.id) && !r.anulado).sort((a, b) => b.ts - a.ts);
  const total = datos.totalPendiente + datos.totalRepartido + datos.totalEnCurso;
  useEffect(() => { onResumen && onResumen({ etiqueta, datos, repartos: repartosRango, porTurno }); }); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmarAnular = async () => {
    const r = anular; if (!r) return;
    const res = await anularRepartoPropinas({ repartoId: r.id, reparto: r, quien: usuarioActual.nombre });
    setMensaje(res.ok ? "Reparto anulado: esas propinas volvieron a quedar pendientes." : res.motivo === "sin-conexion" ? "Sin conexión: no se pudo anular." : "No se pudo anular el reparto.");
    setAnular(null);
  };

  return (
    <>
      <div style={styles.catLabel}>PROPINAS · {etiqueta.toUpperCase()}</div>
      <div style={{ ...styles.turnoBox, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" aria-pressed={!propio} style={!propio ? pillOn : pill} onClick={() => setPropio(false)}>Período del reporte</button>
          <button type="button" aria-pressed={propio} style={propio ? pillOn : pill} onClick={() => setPropio(true)}>Fechas propias</button>
          {propio && (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input type="date" aria-label="Desde" value={fDesde} max={fHasta} onChange={(e) => e.target.value && setFDesde(e.target.value)} style={campoFecha} />
              <span style={nota}>a</span>
              <input type="date" aria-label="Hasta" value={fHasta} min={fDesde} onChange={(e) => e.target.value && setFHasta(e.target.value)} style={campoFecha} />
            </span>
          )}
        </div>
        {propio && !historialListo && <div style={nota}>Cargando el historial para tener todas las fechas…</div>}

        {total === 0 ? <div style={nota}>No hubo propinas en este período.</div> : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Linea nombre="Por repartir ahora" detalle={`${datos.pendientes.length} ${datos.pendientes.length === 1 ? "cuenta" : "cuentas"} de turnos cerrados`} valor={money(datos.totalPendiente)} color={datos.totalPendiente > 0 ? ambar : gris} fuerte />
              <Linea nombre="Ya repartido" detalle={repartosRango.length ? `${repartosRango.length} ${repartosRango.length === 1 ? "reparto" : "repartos"}` : "—"} valor={money(datos.totalRepartido)} color={verde} />
              {datos.totalEnCurso > 0 && <Linea nombre="En turno abierto" detalle="todavía no se reparte: espera a que cierre el turno" valor={money(datos.totalEnCurso)} color={gris} />}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {datos.totalPendiente > 0 && <button type="button" style={{ ...pillOn, minHeight: 44 }} onClick={() => setReparto(true)}><Wallet size={16} /> Repartir {money(datos.totalPendiente)}</button>}
              <button type="button" style={pill} onClick={() => setDetalle((v) => !v)} aria-expanded={detalle}>Ver por día y por turno <ChevronDown size={15} style={{ transition: "transform .3s", transform: detalle ? "rotate(180deg)" : "none" }} /></button>
            </div>
          </>
        )}
        {mensaje && <div role="status" style={{ ...nota, fontWeight: 600 }}>{mensaje}</div>}

        <Despliegue abierto={detalle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
            <div>
              <div style={{ ...nota, fontWeight: 700, marginBottom: 4 }}>Por día</div>
              {datos.porDia.map((d) => (
                <div key={d.dia} style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", padding: "6px 0", borderTop: "1px solid var(--c-ede7d8-o)", fontSize: 13.5 }}>
                  <span style={{ fontWeight: 600, minWidth: 130 }}>{diaCorto(d.dia)}</span>
                  {d.repartido > 0 && <span style={{ color: verde }}>Repartido {money(d.repartido)}{d.repartos.length ? ` · ${d.repartos.map((id) => (repartoPorId[id] ? dateTimeLabel(repartoPorId[id].ts) : "")).filter(Boolean).join(", ")}` : ""}</span>}
                  {d.pendiente > 0 && <span style={{ color: ambar, fontWeight: 600 }}>Pendiente {money(d.pendiente)}</span>}
                  {d.enCurso > 0 && <span style={{ color: gris }}>Turno abierto {money(d.enCurso)}</span>}
                </div>
              ))}
            </div>
            <div>
              <div style={{ ...nota, fontWeight: 700, marginBottom: 4 }}>Por turno y mesero <span style={{ fontWeight: 400 }}>(quién abrió las cuentas)</span></div>
              {porTurno.map((t) => (
                <div key={t.turnoId || "en-curso"} style={{ padding: "6px 0", borderTop: "1px solid var(--c-ede7d8-o)" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.turnoId ? `Turno del ${dateTimeLabel(t.ts)}` : "Turno abierto"}</div>
                  {t.meseros.map((m) => (
                    <div key={m.nombre} style={{ display: "flex", gap: 8, fontSize: 13, padding: "2px 0 2px 10px" }}>
                      <span style={{ flex: 1 }}>{m.nombre} <span style={{ color: gris }}>· {m.cuentas} {m.cuentas === 1 ? "cuenta" : "cuentas"}</span></span>
                      {m.repartido > 0 && <span style={{ color: verde }}>Repartido {money(m.repartido)}</span>}
                      {m.pendiente > 0 && <span style={{ color: ambar, fontWeight: 600 }}>Pendiente {money(m.pendiente)}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Despliegue>

        {repartosRango.length > 0 && (
          <div>
            <div style={{ ...nota, fontWeight: 700, marginBottom: 4 }}>Repartos hechos en este período</div>
            {repartosRango.map((r) => (
              <div key={r.id} style={{ padding: "8px 0", borderTop: "1px solid var(--c-ede7d8-o)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.4 }}>
                  <div><b>{money(r.total)}</b> · {dateTimeLabel(r.ts)} · lo entregó {r.nombre || "—"}</div>
                  <div style={{ color: "var(--c-5c5648-t)" }}>{(r.lineas || []).map((l) => `${l.nombre} ${money(l.monto)}`).join(" · ")}</div>
                </div>
                <button type="button" style={{ ...pill, minHeight: 34, fontSize: 12.5, color: rojo }} onClick={() => setAnular(r)}><Undo2 size={14} /> Anular</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {reparto && <HojaReparto pendientes={datos.pendientes} total={datos.totalPendiente} equipo={equipo} etiqueta={etiqueta} desde={d0} hasta={h0} usuarioActual={usuarioActual} onListo={() => setMensaje("Reparto guardado. Cada persona ya puede verlo en «Mis propinas».")} onCerrar={() => setReparto(false)} />}
      {anular && (
        <Hoja onCerrar={() => setAnular(null)} ancho={420} gap={12} label="Anular reparto" z={320} centro>
          {({ cerrar }) => (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700 }}>¿Anular este reparto de {money(anular.total)}?</div>
              <div style={nota}>Esas propinas vuelven a quedar pendientes y a cada persona se le marca como anulado. Úsalo solo si te equivocaste.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={{ ...pill, flex: 1, minHeight: 46 }} onClick={cerrar}>No, dejarlo</button>
                <button type="button" style={{ ...pill, flex: 1, minHeight: 46, background: rojo, color: "#fff", border: "none" }} onClick={() => { cerrar(); confirmarAnular(); }}>Sí, anular</button>
              </div>
            </>
          )}
        </Hoja>
      )}
    </>
  );
}

function Linea({ nombre, detalle, valor, color, fuerte }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "7px 0", borderTop: "1px solid var(--c-ede7d8-o)" }}>
      <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: fuerte ? 700 : 600, fontSize: 14.5 }}>{nombre}</span><span style={{ display: "block", fontSize: 12.5, color: gris }}>{detalle}</span></span>
      <span style={{ fontWeight: 700, fontSize: fuerte ? 18 : 15.5, color, fontVariantNumeric: "tabular-nums" }}>{valor}</span>
    </div>
  );
}

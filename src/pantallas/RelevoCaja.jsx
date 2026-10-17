import React, { useState, useEffect } from "react";
import { X, Check, RotateCcw, ArrowRightLeft, UserRound } from "lucide-react";
import { money, uid } from "../logica.js";
import { CampoMonto } from "../componentes/Comunes.jsx";
import { updateRecord } from "../firebase.js";
import { timeLabel } from "../utilidades.js";
import { responsableDe, tramoVigente, statsTramo, proponerRelevo, aceptarRelevo, deshacerRelevo } from "../relevoCaja.js";
import { playBeep, mostrarNotificacionSistema } from "../avisos.js";
import { vibrar } from "../theme.js";

/* Entregar la caja a otra persona (o asumirla si quien la tenía se fue), y recibirla. */

const K = {
  bg: "var(--c-f7f4ec-b)", surface: "var(--c-fffdf8-b)", soft: "var(--c-ede7d8-b)", border: "var(--c-e4dfce-o)",
  ink: "var(--c-242019-t)", inkBg: "var(--c-242019-b)", sub: "var(--c-5c5648-t)", muted: "var(--c-8a8272-t)", cream: "#F4F6F8",
  rojo: "var(--c-c1442d-t)", verde: "var(--c-5b7553-t)", ambar: "var(--c-8a611a-t)",
};
const x = {
  overlay: { position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,12,15,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "fadeIn .18s ease" },
  hoja: { width: "100%", maxWidth: 520, maxHeight: "92dvh", overflowY: "auto", background: K.bg, borderRadius: "22px 22px 0 0", padding: "18px 16px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12, animation: "sheetUp .24s cubic-bezier(.2,.8,.2,1)", color: K.ink },
  titulo: { fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700 },
  texto: { fontSize: 13, color: K.sub, lineHeight: 1.5 },
  cerrar: { width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: K.surface, color: K.sub, border: `1px solid ${K.border}`, borderRadius: 16, cursor: "pointer", flexShrink: 0 },
  etiqueta: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.3, color: "#9BA4B0", fontWeight: 700 },
  persona: { display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", background: K.surface, border: `1px solid ${K.border}`, borderRadius: 11, cursor: "pointer", fontSize: 14, fontWeight: 600, color: K.ink, width: "100%", textAlign: "left" },
  personaOn: { border: "2px solid var(--accent)", padding: "10px 11px" },
  input: { width: "100%", boxSizing: "border-box", padding: "12px 13px", borderRadius: 10, border: `1px solid ${K.border}`, fontSize: 14, fontFamily: "var(--font-body)", color: K.ink, background: K.surface },
  caja: { borderRadius: 12, padding: "12px 14px", fontSize: 13.5 },
  linea: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "2px 0" },
  boton: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", border: "none", borderRadius: 11, background: "var(--accent)", color: K.cream, fontSize: 14.5, fontWeight: 700, cursor: "pointer", width: "100%" },
  botonGhost: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 14px", borderRadius: 11, background: "transparent", border: `1.5px solid var(--accent)`, color: "var(--accent-t)", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  error: { fontSize: 12.5, color: K.rojo, fontWeight: 600 },
};
const L = ({ k, v, fuerte }) => <div style={{ ...x.linea, fontWeight: fuerte ? 700 : 500 }}><span>{k}</span><span>{v}</span></div>;

export function FlujoEntrega({ modo, turno, cuentas, usuarioActual, equipo, onCerrar }) {
  const asumir = modo === "asumir";
  const responsable = responsableDe(turno);
  const candidatos = (equipo || []).filter((p) => p.activo === true && p.roles && (p.roles.cajero || p.roles.admin) && p.uid !== usuarioActual.uid);
  const [destino, setDestino] = useState(null);
  const [contado, setContado] = useState("");
  const [calculado, setCalculado] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const tramo = tramoVigente(turno);
  const st = statsTramo(turno, cuentas, tramo);
  const contadoNum = Math.round(parseFloat(contado) || 0);
  const diferencia = contadoNum - st.esperado;
  const receptor = asumir ? { uid: usuarioActual.uid, nombre: usuarioActual.nombre } : destino;
  const notaObligatoria = asumir || diferencia !== 0;
  const color = diferencia === 0 ? ["var(--c-e4eee1-b)", K.verde] : diferencia > 0 ? ["var(--c-fbefd9-b)", K.ambar] : ["var(--c-fbe2dc-b)", K.rojo];
  const texto = diferencia === 0 ? "Cuadra exacto ✓" : diferencia > 0 ? `Sobran ${money(diferencia)}` : `Faltan ${money(Math.abs(diferencia))}`;

  const calcular = async () => {
    const aid = uid();
    await updateRecord("turnos", turno.id, { [`arqueos/${aid}`]: { id: aid, ts: Date.now(), por: usuarioActual.nombre, tipo: "relevo", tramoId: tramo.id, contado: contadoNum, difEfectivo: diferencia } });
    setCalculado(true);
  };
  const confirmar = async () => {
    if (notaObligatoria && !nota.trim()) { setError(asumir ? "Cuéntanos por qué asumes la caja (ej. se fue sin entregar)." : "El conteo no cuadró: explica qué pasó."); return; }
    setGuardando(true); setError("");
    const ok = await proponerRelevo({ turno, cuentas, a: receptor, contado: contadoNum, observaciones: nota.trim(), forzado: asumir, porNombre: usuarioActual.nombre });
    setGuardando(false);
    if (!ok) { setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."); return; }
    vibrar(18); onCerrar();
  };

  return (
    <div style={x.overlay} onClick={onCerrar}>
      <div style={x.hoja} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={asumir ? "Asumir la caja" : "Entregar la caja"}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={x.titulo}>{asumir ? `Asumir la caja de ${responsable.nombre}` : "Entregar la caja"}</div>
            <div style={x.texto}>
              {asumir
                ? `Úsalo si ${responsable.nombre} se fue sin entregar. Cuenta el efectivo que hay ahora: si hay diferencia queda a nombre de ${responsable.nombre}, y tú pasas a ser el responsable de la caja.`
                : "Cuenta solo el efectivo. La tarjeta y las transferencias se revisan una sola vez, al cerrar el turno."}
            </div>
          </div>
          <button style={x.cerrar} onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
        </div>

        {!asumir && (
          <>
            <div style={x.etiqueta}>¿A QUIÉN LE ENTREGAS?</div>
            {candidatos.length === 0 && <div style={x.texto}>No hay otra persona de caja registrada. Pídele al administrador que cree la cuenta en Equipo y usuarios.</div>}
            {candidatos.map((p) => (
              <button key={p.uid} style={{ ...x.persona, ...(destino && destino.uid === p.uid ? x.personaOn : {}) }} onClick={() => !calculado && setDestino({ uid: p.uid, nombre: p.nombre })}>
                <UserRound size={17} color="#9BA4B0" /> {p.nombre}
              </button>
            ))}
          </>
        )}

        {(asumir || destino) && (
          <>
            <div style={x.etiqueta}>EFECTIVO QUE HAY EN LA CAJA AHORA</div>
            <CampoMonto placeholder="Efectivo contado" value={contado} onChange={(v) => !calculado && setContado(v)} />
            {!calculado ? (
              <button style={{ ...x.boton, opacity: contado === "" ? 0.4 : 1 }} disabled={contado === ""} onClick={calcular}>Calcular resultado</button>
            ) : (
              <>
                <div style={{ ...x.caja, background: color[0], color: color[1] }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{texto}</div>
                  <div style={{ color: K.ink }}>
                    <L k="Recibió (base de este tramo)" v={money(tramo.base)} />
                    <L k="+ Ventas en efectivo" v={money(st.ventasEfectivo)} />
                    {st.entradas > 0 && <L k="+ Entradas de dinero" v={money(st.entradas)} />}
                    {st.salidas > 0 && <L k="− Salidas de dinero" v={money(st.salidas)} />}
                    <L k="Debía haber" v={money(st.esperado)} fuerte />
                    <L k="Contaste" v={money(contadoNum)} fuerte />
                  </div>
                </div>
                <button style={x.botonGhost} onClick={() => setCalculado(false)}><RotateCcw size={15} /> Corregir conteo y volver a calcular</button>
                <input
                  style={x.input} value={nota} onChange={(e) => { setNota(e.target.value); setError(""); }}
                  placeholder={asumir ? `Por qué asumes la caja (obligatorio)` : diferencia !== 0 ? "Explica la diferencia (obligatorio)" : "Nota (opcional)"}
                />
                {error && <div style={x.error}>{error}</div>}
                <button style={{ ...x.boton, opacity: guardando ? 0.5 : 1 }} disabled={guardando} onClick={confirmar}>
                  <ArrowRightLeft size={16} /> {asumir ? "Confirmar: asumo la caja" : `Confirmar entrega a ${destino.nombre}`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Aviso de entrega pendiente dentro de la pantalla de Turno.
export function TarjetaRelevoPendiente({ turno, usuarioActual, esAdmin }) {
  const r = turno.relevo;
  const [motivando, setMotivando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (!r) return null;
  const soyReceptor = r.aUid === usuarioActual.uid;
  const soyQuienEntrega = r.deUid === usuarioActual.uid;
  const ejecutar = async (fn) => { setOcupado(true); await fn(); setOcupado(false); setMotivando(false); };
  return (
    <div style={{ background: "var(--c-fbefd9-b)", border: "1px solid #C58B1B", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, color: K.ink }}>
      <div style={x.etiqueta}>ENTREGA PENDIENTE</div>
      <div style={{ fontSize: 14, lineHeight: 1.45 }}>
        <b>{r.deNombre}</b> entrega la caja a <b>{r.aNombre}</b> con <b>{money(r.contado)}</b> <span style={{ color: K.muted }}>({timeLabel(r.ts)})</span>.
        {r.diferencia !== 0 && <span style={{ color: K.rojo }}> El conteo de {r.deNombre} {r.diferencia < 0 ? "faltaba" : "sobraba"} {money(Math.abs(r.diferencia))}.</span>}
      </div>
      {motivando ? (
        <>
          <input style={x.input} placeholder="¿Qué no coincide? (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...x.botonGhost, flex: 1 }} onClick={() => setMotivando(false)}>Volver</button>
            <button style={{ ...x.boton, flex: 1, background: "#d64545" }} disabled={ocupado} onClick={() => ejecutar(() => deshacerRelevo({ turno, usuario: usuarioActual, motivo: motivo.trim() || "No coincidía el efectivo" }))}>Deshacer entrega</button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          {soyReceptor && <button style={{ ...x.boton, flex: 1 }} disabled={ocupado} onClick={() => ejecutar(() => aceptarRelevo({ turno, usuario: usuarioActual }))}><Check size={16} /> Recibir {money(r.contado)}</button>}
          {soyReceptor && <button style={{ ...x.botonGhost, flex: 1 }} onClick={() => setMotivando(true)}>No coincide</button>}
          {!soyReceptor && (soyQuienEntrega || esAdmin) && <button style={{ ...x.botonGhost, flex: 1 }} disabled={ocupado} onClick={() => ejecutar(() => deshacerRelevo({ turno, usuario: usuarioActual, cancelar: true, motivo: "Cancelada" }))}>Cancelar entrega</button>}
          {!soyReceptor && !soyQuienEntrega && !esAdmin && <div style={x.texto}>Esperando a que {r.aNombre} reciba la caja.</div>}
        </div>
      )}
    </div>
  );
}

// Banda que ve en cualquier pantalla la persona a quien le entregan la caja.
export function AvisoRelevo({ turno, usuarioActual }) {
  const r = turno && turno.relevo;
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (r && r.aUid === usuarioActual.uid) {
      playBeep();
      mostrarNotificacionSistema("Te entregan la caja", `${r.deNombre} te entrega la caja con ${money(r.contado)}`);
    }
    // eslint-disable-next-line
  }, [r && r.id]);
  if (!r || r.aUid !== usuarioActual.uid) return null;
  return (
    <div className="no-imprimir" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#2E6FD6", color: "#F4F6F8", fontSize: 13.5, fontWeight: 600, flexWrap: "wrap" }}>
      <ArrowRightLeft size={16} />
      <span style={{ flex: 1, minWidth: 180 }}>{r.deNombre} te entrega la caja con {money(r.contado)}</span>
      <button disabled={ocupado} style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#F4F6F8", color: "#14181D", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        onClick={async () => { setOcupado(true); await aceptarRelevo({ turno, usuario: usuarioActual }); setOcupado(false); }}>Recibir</button>
      <button disabled={ocupado} style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.55)", background: "transparent", color: "#F4F6F8", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        onClick={async () => { setOcupado(true); await deshacerRelevo({ turno, usuario: usuarioActual, motivo: "No coincidía el efectivo" }); setOcupado(false); }}>No coincide</button>
    </div>
  );
}

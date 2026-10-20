import React, { useState } from "react";
import { Plus, Phone, Users, X, Check, MessageCircle, Pencil, Minus } from "lucide-react";
import { styles } from "../estilos.js";
import { uid } from "../logica.js";
import { mesaNombre } from "../utilidades.js";
import { Acordeon } from "../componentes/Comunes.jsx";

import { Hoja } from "../componentes/Hoja.jsx";
/* ---------------- RESERVAS ---------------- */
/* reserva: { id, nombre, telefono, personas, fecha "YYYY-MM-DD", hora "HH:MM", ts, mesaId?, nota, estado, creadaPor, creadaTs }
   estados: pendiente → confirmada → llego | no_asistio | cancelada */

const pad = (n) => String(n).padStart(2, "0");
export const fechaStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tsDe = (fecha, hora) => new Date(`${fecha}T${hora || "00:00"}:00`).getTime();
const horaLabel = (r) => new Date(r.ts).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
const ESTADOS = {
  pendiente: { label: "Pendiente", color: "var(--warn-solid)" },
  confirmada: { label: "Confirmada", color: "#3B82F6" },
  llego: { label: "Llegó", color: "var(--ok-solid)" },
  no_asistio: { label: "No llegó", color: "#8A94A0" },
  cancelada: { label: "Cancelada", color: "var(--c-c1442d-t)" },
};
const ACTIVA = (r) => r.estado === "pendiente" || r.estado === "confirmada";
const soloDigitos = (t) => String(t || "").replace(/\D/g, "");
const waLink = (tel) => { const d = soloDigitos(tel); if (!d) return null; return `https://wa.me/${d.length === 10 ? "57" + d : d}`; };

function diasSiguientes(n = 7) {
  const out = [];
  const base = new Date(); base.setHours(12, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    const corto = d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric" }).replace(".", "");
    out.push({ key: fechaStr(d), label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : corto.charAt(0).toUpperCase() + corto.slice(1) });
  }
  return out;
}

export function ReservasView({ reservas, saveReserva, deleteReserva, mesas, usuarioActual }) {
  const [dia, setDia] = useState(fechaStr());
  const [form, setForm] = useState(null); // null | reserva en edición (o nueva)
  const dias = diasSiguientes(7);
  const delDia = reservas.filter((r) => r.fecha === dia).sort((a, b) => a.ts - b.ts);
  const vigentes = delDia.filter((r) => r.estado !== "cancelada" && r.estado !== "no_asistio");
  const cerradas = delDia.filter((r) => r.estado === "cancelada" || r.estado === "no_asistio");
  const personas = vigentes.reduce((a, r) => a + (r.personas || 0), 0);
  const porLlegar = vigentes.filter(ACTIVA).length;
  const cuenta = (key) => reservas.filter((r) => r.fecha === key && ACTIVA(r)).length;

  const cambiarEstado = (r, estado) => saveReserva({ ...r, estado, [`${estado}Ts`]: Date.now(), [`${estado}Por`]: usuarioActual.nombre });
  const nueva = () => setForm({ id: null, nombre: "", telefono: "", personas: 2, fecha: dia, hora: "20:00", mesaId: "", nota: "", estado: "pendiente" });

  const Tarjeta = ({ r }) => {
    const e = ESTADOS[r.estado] || ESTADOS.pendiente;
    const wa = waLink(r.telefono);
    return (
      <div className="anim-in" style={rv.tarjeta}>
        <div style={rv.fila1}>
          <span style={rv.hora}>{horaLabel(r)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={rv.nombre}>{r.nombre}</span>
            <span style={rv.meta}><Users size={12} /> {r.personas} {r.personas === 1 ? "persona" : "personas"}{r.mesaId ? ` · ${mesaNombre(mesas, r.mesaId)}` : " · sin mesa asignada"}</span>
          </span>
          <span style={{ ...rv.estado, color: e.color, borderColor: e.color + "66", background: e.color + "1F" }}>{e.label}</span>
        </div>
        {r.nota && <div style={rv.nota}>"{r.nota}"</div>}
        {r.telefono && (
          <div style={rv.contacto}>
            <a href={`tel:${soloDigitos(r.telefono)}`} style={rv.link}><Phone size={13} /> {r.telefono}</a>
            {wa && <a href={wa} target="_blank" rel="noreferrer" style={rv.link}><MessageCircle size={13} /> WhatsApp</a>}
          </div>
        )}
        <div style={rv.acciones}>
          {r.estado === "pendiente" && <button style={rv.btn} onClick={() => cambiarEstado(r, "confirmada")}>Confirmar</button>}
          {ACTIVA(r) && <button style={{ ...rv.btn, ...rv.btnOk }} onClick={() => cambiarEstado(r, "llego")}><Check size={14} /> Llegó</button>}
          {ACTIVA(r) && <button style={rv.btn} onClick={() => cambiarEstado(r, "no_asistio")}>No llegó</button>}
          {ACTIVA(r) && <button style={rv.btn} onClick={() => cambiarEstado(r, "cancelada")}>Cancelar</button>}
          {!ACTIVA(r) && <button style={rv.btn} onClick={() => cambiarEstado(r, "pendiente")}>Reabrir</button>}
          <button style={{ ...rv.btn, flex: "0 0 auto" }} onClick={() => setForm(r)} aria-label="Editar"><Pencil size={14} /></button>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.screen}>
      <div className="ancho" style={{ ...styles.mesaGridHeader, alignItems: "flex-end" }}>
        <div><div style={styles.pageEyebrow}>AGENDA</div><div style={styles.pageTitle}>Reservas</div></div>
        <button style={{ ...styles.sendBtn, width: "auto", padding: "10px 16px" }} onClick={nueva}><Plus size={16} /> Nueva reserva</button>
      </div>

      <div className="ancho" style={rv.dias}>
        {dias.map((d) => (
          <button key={d.key} style={{ ...rv.dia, ...(dia === d.key ? rv.diaOn : {}) }} onClick={() => setDia(d.key)}>
            {d.label}{cuenta(d.key) > 0 && <span style={rv.contador}>{cuenta(d.key)}</span>}
          </button>
        ))}
        <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} style={rv.fecha} aria-label="Otra fecha" />
      </div>

      <div className="ancho" style={styles.menuScroll}>
        <div style={rv.resumen}>
          <div style={rv.resCelda}><span style={rv.resEt}>Reservas</span><span style={rv.resNum}>{vigentes.length}</span></div>
          <div style={rv.resCelda}><span style={rv.resEt}>Personas</span><span style={rv.resNum}>{personas}</span></div>
          <div style={rv.resCelda}><span style={rv.resEt}>Por llegar</span><span style={{ ...rv.resNum, color: "var(--accent-t)" }}>{porLlegar}</span></div>
        </div>

        {vigentes.length === 0 ? (
          <div style={rv.vacio}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Sin reservas para este día</div>
            <div style={{ fontSize: 13, color: "var(--c-8a8272-t)" }}>Toca "Nueva reserva" para anotar la primera.</div>
          </div>
        ) : (
          <div style={rv.rejilla}>{vigentes.map((r) => <Tarjeta key={r.id} r={r} />)}</div>
        )}

        {cerradas.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Acordeon titulo={`Canceladas y no llegaron (${cerradas.length})`}>
              <div style={{ ...rv.rejilla, padding: "12px 0 6px" }}>{cerradas.map((r) => <Tarjeta key={r.id} r={r} />)}</div>
            </Acordeon>
          </div>
        )}
      </div>

      {form && <FormReserva inicial={form} mesas={mesas} reservas={reservas} usuarioActual={usuarioActual}
        onGuardar={async (r) => { await saveReserva(r); setDia(r.fecha); setForm(null); }}
        onEliminar={form.id ? async () => { await deleteReserva(form.id); setForm(null); } : null}
        onCerrar={() => setForm(null)} />}
    </div>
  );
}

function FormReserva({ inicial, mesas, reservas, usuarioActual, onGuardar, onEliminar, onCerrar }) {
  const [f, setF] = useState({ ...inicial, mesaId: inicial.mesaId || "" });
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const ts = tsDe(f.fecha, f.hora);
  const valido = f.nombre.trim() && f.personas >= 1 && f.fecha && f.hora;
  // Aviso (no bloquea): la misma mesa ya tiene otra reserva cerca de esa hora
  const choque = f.mesaId ? reservas.find((r) => r.id !== f.id && ACTIVA(r) && String(r.mesaId) === String(f.mesaId) && Math.abs(r.ts - ts) < 90 * 60 * 1000) : null;
  const guardar = () => {
    if (!valido) return;
    const base = { ...f, id: f.id || uid(), nombre: f.nombre.trim(), telefono: f.telefono.trim(), nota: (f.nota || "").trim(), ts };
    if (!f.id) { base.creadaTs = Date.now(); base.creadaPor = usuarioActual.nombre; }
    if (!base.mesaId) delete base.mesaId;
    onGuardar(base);
  };
  return (
    <Hoja onCerrar={onCerrar} ancho={460} gap={10} label="Reserva">
{({ cerrar: cerrarHoja }) => (
<>
        <div style={rv.hojaHead}><span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{f.id ? "Editar reserva" : "Nueva reserva"}</span><button style={styles.cerrarPanelBtn} onClick={cerrarHoja} aria-label="Cerrar"><X size={16} /></button></div>
        <input style={styles.editInput} placeholder="Nombre de quien reserva" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} autoFocus={!f.id} />
        <input style={styles.editInput} placeholder="Teléfono (opcional)" inputMode="tel" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><div style={rv.et}>Fecha</div><input type="date" style={{ ...styles.editInput, width: "100%" }} value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></div>
          <div style={{ flex: 1 }}><div style={rv.et}>Hora</div><input type="time" style={{ ...styles.editInput, width: "100%" }} value={f.hora} onChange={(e) => set("hora", e.target.value)} /></div>
        </div>
        <div style={rv.et}>Personas</div>
        <div style={rv.stepper}>
          <button style={rv.stepBtn} onClick={() => set("personas", Math.max(1, f.personas - 1))}><Minus size={16} /></button>
          <span style={{ fontSize: 20, fontWeight: 700, minWidth: 34, textAlign: "center" }}>{f.personas}</span>
          <button style={rv.stepBtn} onClick={() => set("personas", Math.min(40, f.personas + 1))}><Plus size={16} /></button>
        </div>
        <div style={rv.et}>Mesa (opcional)</div>
        <div style={rv.pastillas}>
          <button style={{ ...rv.pastilla, ...(!f.mesaId ? rv.pastillaOn : {}) }} onClick={() => set("mesaId", "")}>Sin asignar</button>
          {mesas.map((m) => <button key={m.id} style={{ ...rv.pastilla, ...(String(f.mesaId) === String(m.id) ? rv.pastillaOn : {}) }} onClick={() => set("mesaId", m.id)}>{m.nombre}</button>)}
        </div>
        {choque && <div style={rv.aviso}>Esa mesa ya está reservada cerca de esa hora por {choque.nombre}.</div>}
        <input style={styles.editInput} placeholder="Nota (cumpleaños, alergias, silla de bebé…)" value={f.nota || ""} onChange={(e) => set("nota", e.target.value)} />
        <button style={{ ...styles.sendBtn, opacity: valido ? 1 : 0.4 }} disabled={!valido} onClick={guardar}><Check size={16} /> {f.id ? "Guardar cambios" : "Guardar reserva"}</button>
        {onEliminar && (confirmarBorrar
          ? <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ flex: 1, fontSize: 13 }}>¿Eliminar esta reserva?</span><button style={styles.confirmYes} onClick={onEliminar}>Sí</button><button style={styles.confirmNo} onClick={() => setConfirmarBorrar(false)}>No</button></div>
          : <button style={rv.eliminar} onClick={() => setConfirmarBorrar(true)}>Eliminar reserva</button>)}
      </>
)}
</Hoja>
  );
}

const rv = {
  dias: { display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 10px", scrollbarWidth: "none", alignItems: "center" },
  dia: { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 999, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },
  diaOn: { background: "var(--neon)", color: "var(--neon-text)", borderColor: "transparent", fontWeight: 800, boxShadow: "var(--neon-glow)" },
  contador: { minWidth: 20, height: 20, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800, background: "var(--c-242019-b)", color: "#fff", padding: "0 5px" },
  fecha: { flexShrink: 0, height: 38, padding: "0 10px", borderRadius: 999, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 13 },
  resumen: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  resCelda: { display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRight: "1px solid var(--c-ede7d8-o)" },
  resEt: { fontSize: 11.5, color: "var(--c-8a8272-t)" },
  resNum: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--c-242019-t)" },
  rejilla: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 10 },
  tarjeta: { display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 16, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)" },
  fila1: { display: "flex", alignItems: "center", gap: 12 },
  hora: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--c-242019-t)", minWidth: 78 },
  nombre: { display: "block", fontSize: 15.5, fontWeight: 700, color: "var(--c-242019-t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--c-8a8272-t)", marginTop: 2 },
  estado: { fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999, border: "1px solid", flexShrink: 0 },
  nota: { fontSize: 12.5, color: "var(--c-5c5648-t)", fontStyle: "italic" },
  contacto: { display: "flex", gap: 14, flexWrap: "wrap" },
  link: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--accent-t)", textDecoration: "none", fontWeight: 600 },
  acciones: { display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--c-ede7d8-o)", paddingTop: 10 },
  btn: { flex: "1 1 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 12px", borderRadius: 11, border: "1px solid var(--c-e4dfce-o)", background: "transparent", color: "var(--c-242019-t)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnOk: { background: "var(--c-e4eee1-b)", borderColor: "var(--ok-border)", color: "var(--pago-ok)" },
  vacio: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "40px 16px", borderRadius: 16, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", color: "var(--c-242019-t)", textAlign: "center" },
  hojaHead: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  et: { fontSize: 11.5, color: "var(--c-8a8272-t)", fontWeight: 600, marginBottom: 4 },
  stepper: { display: "flex", alignItems: "center", gap: 10 },
  stepBtn: { width: 42, height: 42, borderRadius: 12, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-242019-t)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  pastillas: { display: "flex", gap: 8, flexWrap: "wrap" },
  pastilla: { padding: "8px 13px", borderRadius: 999, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  pastillaOn: { background: "var(--neon)", borderColor: "transparent", color: "var(--neon-text)", fontWeight: 800, boxShadow: "var(--neon-glow)" },
  aviso: { fontSize: 12.5, padding: "8px 12px", borderRadius: 10, background: "var(--c-fbefd9-b)", border: "1px solid var(--warn-border)", color: "var(--c-8a611a-t)" },
  eliminar: { padding: 10, background: "transparent", border: "none", color: "var(--c-c1442d-t)", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};

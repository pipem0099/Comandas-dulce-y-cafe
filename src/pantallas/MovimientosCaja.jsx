import React, { useState } from "react";
import { X, ArrowDownToLine, ArrowUpFromLine, Check } from "lucide-react";
import { money } from "../logica.js";
import { CampoMonto } from "../componentes/Comunes.jsx";
import { dateTimeLabel, timeLabel } from "../utilidades.js";
import { vibrar } from "../theme.js";

/* Entradas y salidas de efectivo de un turno: retiros, pago a proveedores, gastos, aportes. */

export const CATEGORIAS_MOV = {
  entrada: ["Base adicional o cambio", "Aporte del dueño", "Otro ingreso"],
  salida: ["Pago a proveedor", "Retiro a caja fuerte", "Retiro del dueño", "Gasto del negocio", "Otra salida"],
};
const PISTA_NOTA = {
  "Pago a proveedor": "Proveedor y qué se compró (ej. Lácteos del Valle — leche)",
  "Retiro a caja fuerte": "Quién lo recibe o a dónde va",
  "Retiro del dueño": "Motivo",
  "Gasto del negocio": "En qué se gastó (ej. gas, hielo, domicilio)",
  "Otra salida": "Explica para qué fue",
};

const K = {
  bg: "var(--c-f7f4ec-b)", surface: "var(--c-fffdf8-b)", soft: "var(--c-ede7d8-b)", border: "var(--c-e4dfce-o)",
  ink: "var(--c-242019-t)", inkBg: "var(--c-242019-b)", muted: "var(--c-8a8272-t)", sub: "var(--c-5c5648-t)", cream: "#F4F6F8",
  verde: "var(--c-5b7553-t)", rojo: "var(--c-c1442d-t)",
};
const x = {
  overlay: { position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,12,15,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "fadeIn .18s ease" },
  hoja: { width: "100%", maxWidth: 520, maxHeight: "92dvh", overflowY: "auto", background: K.bg, borderRadius: "22px 22px 0 0", padding: "18px 16px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12, animation: "sheetUp .38s cubic-bezier(.32,.72,0,1)", color: K.ink },
  titulo: { fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: K.ink },
  cerrar: { width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: K.surface, color: K.sub, border: `1px solid ${K.border}`, borderRadius: 16, cursor: "pointer" },
  seg: { display: "flex", background: K.soft, borderRadius: 12, padding: 3, gap: 2 },
  segBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 6px", border: "none", borderRadius: 9, background: "transparent", color: K.sub, fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  segOn: { background: K.surface, color: K.ink, boxShadow: "0 1px 3px rgba(0,0,0,.18)" },
  etiqueta: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.3, color: "#9BA4B0", fontWeight: 700 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { padding: "8px 12px", borderRadius: 18, border: `1px solid ${K.border}`, background: K.surface, color: K.sub, fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  chipOn: { background: K.inkBg, color: K.cream, border: `1px solid ${K.inkBg}` },
  input: { width: "100%", boxSizing: "border-box", padding: "12px 13px", borderRadius: 10, border: `1px solid ${K.border}`, fontSize: 14, fontFamily: "var(--font-body)", color: K.ink, background: K.surface },
  error: { fontSize: 12.5, color: K.rojo, fontWeight: 600 },
  boton: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", border: "none", borderRadius: 11, color: K.cream, fontSize: 14.5, fontWeight: 700, cursor: "pointer", width: "100%" },
  fila: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: `1px solid ${K.border}` },
  filaTxt: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  cat: { fontSize: 13.5, fontWeight: 600, color: K.ink },
  nota: { fontSize: 12, color: K.sub, lineHeight: 1.35 },
  meta: { fontSize: 11, color: K.muted },
  monto: { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" },
  anular: { background: "transparent", border: "none", padding: 0, color: K.rojo, fontSize: 11.5, fontWeight: 600, cursor: "pointer", textAlign: "right", marginTop: 2 },
};

export function FormularioMovimiento({ tipoInicial, onCancelar, onGuardar }) {
  const [tipo, setTipo] = useState(tipoInicial || "salida");
  const [categoria, setCategoria] = useState(CATEGORIAS_MOV[tipoInicial || "salida"][0]);
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const esSalida = tipo === "salida";
  const cambiarTipo = (t) => { setTipo(t); setCategoria(CATEGORIAS_MOV[t][0]); setError(""); };

  const guardar = async () => {
    const m = Math.round(parseFloat(monto) || 0);
    if (m <= 0) { setError("Escribe el monto."); return; }
    if (esSalida && !nota.trim()) { setError("Toda salida de efectivo lleva una nota: para quién o para qué fue."); return; }
    setGuardando(true); setError("");
    const ok = await onGuardar({ tipo, categoria, monto: m, nota: nota.trim() });
    setGuardando(false);
    if (ok === false) setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
    else vibrar(14);
  };

  return (
    <div className="hoja-overlay" style={x.overlay} onClick={onCancelar}>
      <div style={x.hoja} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Movimiento de caja">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={x.titulo}>Movimiento de efectivo</div>
          <button style={x.cerrar} onClick={onCancelar} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div style={x.seg}>
          <button style={{ ...x.segBtn, ...(tipo === "entrada" ? x.segOn : {}) }} onClick={() => cambiarTipo("entrada")}><ArrowDownToLine size={15} color="#2f8f68" /> Entrada</button>
          <button style={{ ...x.segBtn, ...(tipo === "salida" ? x.segOn : {}) }} onClick={() => cambiarTipo("salida")}><ArrowUpFromLine size={15} color="#d64545" /> Salida</button>
        </div>
        <div style={x.etiqueta}>{esSalida ? "¿QUÉ SALE DE LA CAJA?" : "¿QUÉ ENTRA A LA CAJA?"}</div>
        <div style={x.chips}>
          {CATEGORIAS_MOV[tipo].map((c) => (
            <button key={c} style={{ ...x.chip, ...(categoria === c ? x.chipOn : {}) }} onClick={() => setCategoria(c)}>{c}</button>
          ))}
        </div>
        <CampoMonto placeholder="Monto" value={monto} onChange={(v) => { setMonto(v); setError(""); }} />
        <input
          style={x.input} value={nota} onChange={(e) => { setNota(e.target.value); setError(""); }}
          placeholder={esSalida ? (PISTA_NOTA[categoria] || "Para qué fue") : "Nota (opcional)"}
        />
        {error && <div style={x.error}>{error}</div>}
        <button style={{ ...x.boton, background: esSalida ? "#d64545" : "#1f8a62", opacity: guardando ? 0.5 : 1 }} disabled={guardando} onClick={guardar}>
          <Check size={16} /> {esSalida ? "Registrar salida" : "Registrar entrada"}
        </button>
      </div>
    </div>
  );
}

// Lista de movimientos; con `onAnular` se puede anular uno mal registrado (queda guardado como anulado).
export function ListaMovimientos({ movimientos, onAnular, conFecha, puedeAnular }) {
  const [confirmando, setConfirmando] = useState(null);
  if (movimientos.length === 0) return null;
  return (
    <div>
      {movimientos.map((m) => {
        const entrada = m.tipo === "entrada";
        return (
          <div key={m.id} style={{ ...x.fila, opacity: m.anulado ? 0.45 : 1 }}>
            <div style={x.filaTxt}>
              <span style={{ ...x.cat, textDecoration: m.anulado ? "line-through" : "none" }}>{m.categoria}</span>
              {m.nota && <span style={x.nota}>{m.nota}</span>}
              <span style={x.meta}>{conFecha ? dateTimeLabel(m.ts) : timeLabel(m.ts)} · {m.por}{m.anulado ? ` · anulado por ${m.anuladoPor}` : ""}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ ...x.monto, color: entrada ? K.verde : K.rojo, textDecoration: m.anulado ? "line-through" : "none" }}>{entrada ? "+" : "−"}{money(m.monto)}</span>
              {onAnular && !m.anulado && (!puedeAnular || puedeAnular(m)) && (
                confirmando === m.id
                  ? <span style={{ display: "flex", gap: 10 }}>
                      <button style={{ ...x.anular, color: K.sub }} onClick={() => setConfirmando(null)}>no</button>
                      <button style={x.anular} onClick={() => { setConfirmando(null); onAnular(m); }}>sí, anular</button>
                    </span>
                  : <button style={x.anular} onClick={() => setConfirmando(m.id)}>anular</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

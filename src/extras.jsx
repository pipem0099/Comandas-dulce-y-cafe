import React, { useState, useEffect, useRef } from "react";
import { CabeceraAdmin } from "./componentes/CabeceraAdmin.jsx";
import { Plus, Minus, Trash2, Check, X, Upload, Boxes, AlertTriangle, Pencil, ShoppingBag, Bike, Image as ImageIcon } from "lucide-react";
import { ACENTOS, FUENTES, MARCA_POR_DEFECTO, reducirLogo, vibrar } from "./theme.js";
import { Hoja } from "./componentes/Hoja.jsx";
import {
  uid, money, fmtNum, precioUnitario, getEstaciones, UNIDADES, estadoStock, costoReceta, TIPO_META,
} from "./logica.js";

/* Pantallas nuevas: variantes, configuración de producto, ajustes del negocio
 * (marca y estaciones), inventario y formulario de para llevar / domicilio.
 * Usan las mismas variables de color que el resto de la app (claro/oscuro). */

const K = {
  bg: "var(--c-f7f4ec-b)", surface: "var(--c-fffdf8-b)", soft: "var(--c-ede7d8-b)", border: "var(--c-e4dfce-o)",
  ink: "var(--c-242019-t)", inkBg: "var(--c-242019-b)", inkBorder: "var(--c-242019-o)",
  muted: "var(--c-8a8272-t)", sub: "var(--c-5c5648-t)", faint: "#9BA4B0", cream: "#F4F6F8",
  red: "var(--c-c1442d-t)", green: "var(--c-5b7553-t)", amber: "var(--c-b98a2e-t)", blue: "var(--c-2f6690-t)",
  warnBg: "var(--c-fbefd9-b)", warnTx: "var(--c-8a611a-t)", dangerBg: "var(--c-fbe2dc-b)", okBg: "var(--c-e4eee1-b)",
};

const x = {
  sheetTitle: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: K.ink, lineHeight: 1.15 },
  sheetSub: { fontSize: 12.5, color: K.muted },
  eyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.3, color: K.faint, fontWeight: 700, textTransform: "uppercase" },
  card: { background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  input: { width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${K.border}`, fontSize: 14, fontFamily: "var(--font-body)", color: K.ink, background: K.surface, boxSizing: "border-box" },
  btnPrimary: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 14px", background: "var(--neon)", color: "var(--neon-text)", boxShadow: "var(--neon-glow)", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" },
  btnDark: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 14px", background: K.inkBg, color: K.cream, border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer", width: "100%" },
  btnGhost: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 14px", background: "transparent", color: K.sub, border: `1px solid ${K.border}`, borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  btnSmall: { display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 11px", background: K.surface, color: K.ink, border: `1px solid ${K.border}`, borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  btnIcon: { width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: K.surface, color: K.sub, border: `1px solid ${K.border}`, borderRadius: 8, cursor: "pointer", flexShrink: 0 },
  btnDanger: { width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: K.surface, color: "var(--c-c1442d-t)", border: `1px solid ${K.border}`, borderRadius: 8, cursor: "pointer", flexShrink: 0 },
  row: { display: "flex", alignItems: "center", gap: 8 },
  stepper: { display: "flex", alignItems: "center", gap: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 9, border: `1px solid ${K.border}`, background: K.surface, color: K.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  stepBtnPlus: { background: K.inkBg, color: K.cream, border: `1px solid ${K.inkBorder}` },
  stepVal: { minWidth: 22, textAlign: "center", fontWeight: 700, fontSize: 15, color: K.ink },
  groupTitle: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  groupName: { fontSize: 14, fontWeight: 700, color: K.ink },
  groupHint: { fontSize: 11.5, color: K.muted },
  optRow: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 12px", background: K.surface, border: `1px solid ${K.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left", fontSize: 14, color: K.ink, transition: "border-color .15s, background .15s" },
  optRowSel: { border: "1px solid var(--accent)", background: K.soft },
  optMark: { width: 20, height: 20, border: `2px solid ${K.faint}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: K.cream, background: "transparent", transition: "all .15s" },
  optMarkSel: { background: "var(--accent)", border: "2px solid var(--accent)" },
  optPrice: { marginLeft: "auto", fontSize: 12.5, color: K.muted, fontWeight: 600 },
  segmented: { display: "inline-flex", background: K.soft, borderRadius: 9, padding: 3, gap: 2 },
  segBtn: { padding: "6px 11px", border: "none", borderRadius: 7, background: "transparent", color: K.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  segBtnOn: { background: K.inkBg, color: K.cream },
  chip: { display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 11px", borderRadius: 16, border: `1px dashed ${K.faint}`, background: "transparent", color: K.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  label: { fontSize: 12, fontWeight: 600, color: K.sub },
  hint: { fontSize: 12, color: K.muted, lineHeight: 1.45 },
  select: { padding: "10px 10px", borderRadius: 9, border: `1px solid ${K.border}`, fontSize: 13.5, fontFamily: "var(--font-body)", color: K.ink, background: K.surface },
  // inventario
  invCard: { background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  invStock: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: K.ink },
  bar: { height: 6, borderRadius: 3, background: K.soft, overflow: "hidden" },
  pill: { fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 10, letterSpacing: 0.4 },
  // empty
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", padding: "36px 24px", color: K.muted },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, background: K.soft, display: "flex", alignItems: "center", justifyContent: "center", color: K.faint },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: K.ink },
};

/* ───────── Piezas pequeñas ───────── */

export function EmptyState({ icon: Icon, titulo, texto, children }) {
  return (
    <div style={x.empty} className="anim-in">
      <div style={x.emptyIcon}>{Icon ? <Icon size={24} strokeWidth={1.6} /> : null}</div>
      <div style={x.emptyTitle}>{titulo}</div>
      {texto && <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 300 }}>{texto}</div>}
      {children}
    </div>
  );
}

// Monto en pesos con separador de miles (igual que CampoMonto de la app)
function CampoPesos({ value, onChange, placeholder, style }) {
  const digitos = (value === undefined || value === null ? "" : String(value)).replace(/\D/g, "");
  return (
    <input
      style={style || x.input} type="text" inputMode="numeric" placeholder={placeholder}
      value={digitos ? Number(digitos).toLocaleString("es-CO") : ""}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
    />
  );
}
// Número con decimales (cantidades de insumos: 0,25 kg · 1,5 L)
function CampoNumero({ value, onChange, placeholder, style }) {
  return (
    <input
      style={style || x.input} type="text" inputMode="decimal" placeholder={placeholder}
      value={value === undefined || value === null ? "" : String(value).replace(".", ",")}
      onChange={(e) => {
        let v = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
        const partes = v.split(".");
        if (partes.length > 2) v = partes[0] + "." + partes.slice(1).join("");
        onChange(v);
      }}
    />
  );
}
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

function Interruptor({ checked, onChange, children }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{ ...x.row, background: "transparent", border: "none", padding: "4px 0", cursor: "pointer", textAlign: "left", color: K.ink, fontSize: 13.5 }}>
      <span style={{ width: 40, height: 22, borderRadius: 11, background: checked ? "var(--accent)" : K.soft, border: `1px solid ${checked ? "var(--accent)" : K.border}`, position: "relative", flexShrink: 0, transition: "background .2s" }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 20 : 2, width: 16, height: 16, borderRadius: 8, background: checked ? K.cream : K.faint, transition: "left .2s" }} />
      </span>
      <span>{children}</span>
    </button>
  );
}

/* ───────── 1. Elegir opciones de un producto (al tomar el pedido) ───────── */

export function ModalOpciones({ item, onClose, onAdd }) {
  const grupos = item.grupos || [];
  const [sel, setSel] = useState({});
  const [qty, setQty] = useState(1);
  const [nota, setNota] = useState("");

  const toggle = (g, o) => {
    vibrar(8);
    setSel((prev) => {
      const cur = prev[g.id] || [];
      if (g.tipo === "uno") {
        if (cur[0] === o.id && !g.requerido) return { ...prev, [g.id]: [] };
        return { ...prev, [g.id]: [o.id] };
      }
      if (cur.includes(o.id)) return { ...prev, [g.id]: cur.filter((v) => v !== o.id) };
      if (g.max && cur.length >= g.max) return prev;
      return { ...prev, [g.id]: [...cur, o.id] };
    });
  };

  // Si el producto tiene un grupo obligatorio de "elegir uno" (ej. Sabor), cada opción lleva su propia cantidad:
  // "2 de lulo + 1 de mora" se pide en una sola pantalla.
  const grupoCant = grupos.find((g) => g.tipo === "uno" && g.requerido && (g.opciones || []).length >= 2) || null;
  const [cantOpc, setCantOpc] = useState({}); // id de opción -> cantidad
  const cambiarCant = (oid, d) => { vibrar(8); setCantOpc((p) => { const n = Math.max(0, Math.min(99, (p[oid] || 0) + d)); const c = { ...p }; if (n === 0) delete c[oid]; else c[oid] = n; return c; }); };
  const totalCant = Object.values(cantOpc).reduce((a, b) => a + b, 0);
  const modsDe = (oidPrincipal) => grupos.flatMap((g) => {
    const elegidas = grupoCant && g.id === grupoCant.id ? [oidPrincipal] : (sel[g.id] || []);
    return elegidas.map((oid) => { const o = (g.opciones || []).find((v) => v.id === oid); return o ? { g: g.id, o: o.id, n: o.nombre, p: o.precio || 0 } : null; }).filter(Boolean);
  });
  const faltan = grupos.filter((g) => g.requerido && !(grupoCant && g.id === grupoCant.id) && (sel[g.id] || []).length === 0);
  const totalPrecio = grupoCant ? Object.entries(cantOpc).reduce((a, [oid, q]) => a + precioUnitario(item, modsDe(oid)) * q, 0) : null;
  const mods = grupos.flatMap((g) =>
    (sel[g.id] || []).map((oid) => {
      const o = (g.opciones || []).find((v) => v.id === oid);
      return o ? { g: g.id, o: o.id, n: o.nombre, p: o.precio || 0 } : null;
    }).filter(Boolean)
  );
  const unit = precioUnitario(item, mods);

  return (
    <Hoja onCerrar={onClose} ancho={560} gap={12}>
{({ cerrar: cerrarHoja }) => (
<>
        <div style={x.row}>
          <div style={{ flex: 1 }}>
            <div style={x.sheetTitle}>{item.name}</div>
            <div style={x.sheetSub}>Desde {money(item.price)}</div>
          </div>
          <button style={x.btnIcon} onClick={cerrarHoja} aria-label="Cerrar"><X size={16} /></button>
        </div>

        {grupos.map((g) => (grupoCant && g.id === grupoCant.id) ? (
          <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={x.groupTitle}><span style={x.groupName}>{g.nombre}</span><span style={x.groupHint}>Elige cuántos de cada uno</span></div>
            {(g.opciones || []).map((o) => {
              const q = cantOpc[o.id] || 0;
              return (
                <div key={o.id} style={{ ...x.optRow, ...(q > 0 ? x.optRowSel : {}), justifyContent: "space-between", cursor: "default" }}>
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600 }}>{o.nombre}</span>
                    {o.precio > 0 && <span style={x.optPrice}>+{money(o.precio)}</span>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {q > 0 && <button style={x.stepBtn} onClick={() => cambiarCant(o.id, -1)} aria-label="Menos"><Minus size={15} /></button>}
                    {q > 0 && <span style={x.stepVal}>{q}</span>}
                    <button style={{ ...x.stepBtn, ...x.stepBtnPlus }} onClick={() => cambiarCant(o.id, 1)} aria-label="Más"><Plus size={15} /></button>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={x.groupTitle}>
              <span style={x.groupName}>{g.nombre}</span>
              <span style={x.groupHint}>
                {g.requerido ? "Obligatorio" : "Opcional"}{g.tipo === "varios" ? (g.max ? ` · hasta ${g.max}` : " · varias") : ""}
              </span>
            </div>
            {(g.opciones || []).map((o) => {
              const on = (sel[g.id] || []).includes(o.id);
              return (
                <button key={o.id} style={{ ...x.optRow, ...(on ? x.optRowSel : {}) }} onClick={() => toggle(g, o)}>
                  <span style={{ ...x.optMark, borderRadius: g.tipo === "uno" ? 10 : 6, ...(on ? x.optMarkSel : {}) }}>{on && <Check size={12} strokeWidth={3} />}</span>
                  <span>{o.nombre}</span>
                  {o.precio > 0 && <span style={x.optPrice}>+{money(o.precio)}</span>}
                </button>
              );
            })}
          </div>
        ))}

        <input style={x.input} placeholder="Nota para cocina (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />

        <div style={{ ...x.row, justifyContent: "space-between" }}>
          {grupoCant ? (
            <div style={{ fontSize: 14, fontWeight: 600, color: K.sub }}>{totalCant} {totalCant === 1 ? "unidad" : "unidades"}</div>
          ) : (
            <div style={x.stepper}>
              <button style={x.stepBtn} onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={15} /></button>
              <span style={x.stepVal}>{qty}</span>
              <button style={{ ...x.stepBtn, ...x.stepBtnPlus }} onClick={() => setQty((q) => Math.min(99, q + 1))}><Plus size={15} /></button>
            </div>
          )}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: K.ink }}>{money(grupoCant ? totalPrecio : unit * qty)}</div>
        </div>
        {faltan.length > 0 && <div style={{ fontSize: 12.5, color: K.red, fontWeight: 600 }}>Falta elegir: {faltan.map((g) => g.nombre).join(", ")}</div>}
        {grupoCant && totalCant === 0 && <div style={{ fontSize: 12.5, color: K.muted }}>Toca + en los {grupoCant.nombre.toLowerCase()}s que quieras.</div>}
        <button
          style={{ ...x.btnPrimary, opacity: faltan.length || (grupoCant && totalCant === 0) ? 0.45 : 1 }} disabled={faltan.length > 0 || (!!grupoCant && totalCant === 0)}
          onClick={() => {
            vibrar(14);
            if (grupoCant) Object.entries(cantOpc).forEach(([oid, q]) => onAdd(modsDe(oid), q, nota.trim()));
            else onAdd(mods, qty, nota.trim());
          }}
        >
          <Plus size={16} /> Agregar al pedido
        </button>
      </>
)}
</Hoja>
  );
}

/* ───────── 2. Configurar un producto: opciones, estación y receta ───────── */

const PLANTILLAS = {
  tamano: { nombre: "Tamaño", tipo: "uno", requerido: true, opciones: ["Pequeño", "Mediano", "Grande"] },
  termino: { nombre: "Término", tipo: "uno", requerido: true, opciones: ["Medio", "Tres cuartos", "Bien cocido"] },
  adicionales: { nombre: "Adicionales", tipo: "varios", requerido: false, opciones: ["Queso extra", "Tocineta", "Huevo"] },
  sin: { nombre: "Quitar ingredientes", tipo: "varios", requerido: false, opciones: ["Sin cebolla", "Sin tomate", "Sin salsa"] },
};

export function ProductoConfig({ item, config, insumos, onSave, onClose }) {
  const estaciones = getEstaciones(config);
  const [grupos, setGrupos] = useState(() => JSON.parse(JSON.stringify(item.grupos || [])).map((g) => ({ ...g, opciones: g.opciones || [] })));
  const [receta, setReceta] = useState(() => (item.receta || []).map((r) => ({ ...r, cant: String(r.cant) })));
  const [estacion, setEstacion] = useState(item.estacion || "");

  const upG = (gid, patch) => setGrupos((gs) => gs.map((g) => (g.id === gid ? { ...g, ...patch } : g)));
  const upO = (gid, oid, patch) => setGrupos((gs) => gs.map((g) => (g.id === gid ? { ...g, opciones: g.opciones.map((o) => (o.id === oid ? { ...o, ...patch } : o)) } : g)));
  const addGrupo = (tpl) => {
    const base = tpl || { nombre: "", tipo: "uno", requerido: false, opciones: [] };
    setGrupos((gs) => [...gs, { id: uid(), nombre: base.nombre, tipo: base.tipo, requerido: base.requerido, max: 0, opciones: base.opciones.map((n) => ({ id: uid(), nombre: n, precio: 0 })) }]);
  };

  const guardar = () => {
    const gl = grupos
      .map((g) => ({ ...g, nombre: g.nombre.trim(), opciones: g.opciones.map((o) => ({ ...o, nombre: o.nombre.trim(), precio: num(o.precio) })).filter((o) => o.nombre) }))
      .filter((g) => g.nombre && g.opciones.length > 0)
      .map((g) => ({ ...g, max: g.tipo === "varios" && g.max > 0 ? Number(g.max) : 0 }));
    const rl = receta.map((r) => ({ insumoId: r.insumoId, cant: num(r.cant) })).filter((r) => r.insumoId && r.cant > 0);
    onSave({ grupos: gl, receta: rl, estacion: estacion || null });
  };

  const costoCalc = costoReceta(receta.map((r) => ({ ...r, cant: num(r.cant) })), insumos);

  return (
    <div style={{ ...x.card, marginTop: 6, background: K.bg }} className="anim-in">
      {/* Opciones */}
      <div style={x.eyebrow}>Opciones y variantes</div>
      <div style={x.hint}>Para tamaños, término de la carne, adicionales o ingredientes que se pueden quitar. El mesero las elige al tomar el pedido y el precio se ajusta solo.</div>
      {grupos.map((g) => (
        <div key={g.id} style={{ ...x.card, padding: 12 }}>
          <div style={x.row}>
            <input style={{ ...x.input, flex: 1, fontWeight: 600 }} placeholder="Nombre del grupo (ej: Tamaño)" value={g.nombre} onChange={(e) => upG(g.id, { nombre: e.target.value })} />
            <button style={x.btnDanger} onClick={() => setGrupos((gs) => gs.filter((v) => v.id !== g.id))} aria-label="Quitar grupo"><Trash2 size={14} /></button>
          </div>
          <div style={{ ...x.row, flexWrap: "wrap" }}>
            <div style={x.segmented}>
              <button style={{ ...x.segBtn, ...(g.tipo === "uno" ? x.segBtnOn : {}) }} onClick={() => upG(g.id, { tipo: "uno" })}>Elige una</button>
              <button style={{ ...x.segBtn, ...(g.tipo === "varios" ? x.segBtnOn : {}) }} onClick={() => upG(g.id, { tipo: "varios" })}>Elige varias</button>
            </div>
            <Interruptor checked={!!g.requerido} onChange={(v) => upG(g.id, { requerido: v })}>Obligatorio</Interruptor>
          </div>
          {g.tipo === "varios" && (
            <div style={x.row}>
              <span style={x.label}>Máximo a elegir (0 = sin límite)</span>
              <input style={{ ...x.input, width: 70 }} type="text" inputMode="numeric" value={g.max || ""} placeholder="0" onChange={(e) => upG(g.id, { max: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            </div>
          )}
          {g.opciones.map((o) => (
            <div key={o.id} style={x.row}>
              <input style={{ ...x.input, flex: 1.4 }} placeholder="Opción (ej: Grande)" value={o.nombre} onChange={(e) => upO(g.id, o.id, { nombre: e.target.value })} />
              <CampoPesos style={{ ...x.input, flex: 1 }} placeholder="+ precio" value={o.precio || ""} onChange={(v) => upO(g.id, o.id, { precio: v })} />
              <button style={x.btnDanger} onClick={() => setGrupos((gs) => gs.map((v) => (v.id === g.id ? { ...v, opciones: v.opciones.filter((q) => q.id !== o.id) } : v)))} aria-label="Quitar opción"><X size={14} /></button>
            </div>
          ))}
          <button style={x.btnSmall} onClick={() => setGrupos((gs) => gs.map((v) => (v.id === g.id ? { ...v, opciones: [...v.opciones, { id: uid(), nombre: "", precio: 0 }] } : v)))}><Plus size={13} /> Agregar opción</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={x.btnSmall} onClick={() => addGrupo(null)}><Plus size={13} /> Nuevo grupo</button>
        {Object.entries(PLANTILLAS).map(([k, t]) => (
          <button key={k} style={x.chip} onClick={() => addGrupo(t)}>+ {t.nombre}</button>
        ))}
      </div>

      {/* Estación */}
      {estaciones.length > 1 && (
        <>
          <div style={{ ...x.eyebrow, marginTop: 6 }}>Estación de preparación</div>
          <select style={x.select} value={estacion} onChange={(e) => setEstacion(e.target.value)}>
            <option value="">Según la categoría ({item.cat})</option>
            {estaciones.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </>
      )}

      {/* Receta */}
      <div style={{ ...x.eyebrow, marginTop: 6 }}>Receta (inventario)</div>
      {insumos.length === 0 ? (
        <div style={x.hint}>Primero crea tus insumos en Caja → Inventario. Luego aquí dices cuánto gasta cada unidad de este producto y el stock baja solo con cada pedido.</div>
      ) : (
        <>
          <div style={x.hint}>Lo que gasta UNA unidad de este producto. El stock se descuenta al enviar el pedido y se devuelve si se cancela.</div>
          {receta.map((r, i) => {
            const ins = insumos.find((v) => v.id === r.insumoId);
            return (
              <div key={i} style={x.row}>
                <select style={{ ...x.select, flex: 1.6, minWidth: 0 }} value={r.insumoId || ""} onChange={(e) => setReceta((rs) => rs.map((q, j) => (j === i ? { ...q, insumoId: e.target.value } : q)))}>
                  <option value="">Elegir insumo…</option>
                  {insumos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
                <CampoNumero style={{ ...x.input, flex: 0.8, minWidth: 0 }} placeholder="Cant." value={r.cant} onChange={(v) => setReceta((rs) => rs.map((q, j) => (j === i ? { ...q, cant: v } : q)))} />
                <span style={{ ...x.hint, width: 52 }}>{ins ? ins.unidad : ""}</span>
                <button style={x.btnDanger} onClick={() => setReceta((rs) => rs.filter((_, j) => j !== i))} aria-label="Quitar"><X size={14} /></button>
              </div>
            );
          })}
          <button style={x.btnSmall} onClick={() => setReceta((rs) => [...rs, { insumoId: "", cant: "" }])}><Plus size={13} /> Agregar insumo</button>
          {costoCalc > 0 && <div style={x.hint}>Costo según la receta: <b style={{ color: K.ink }}>{money(costoCalc)}</b> por unidad (guarda y se usa para el margen).</div>}
        </>
      )}

      <div style={{ ...x.row, marginTop: 4 }}>
        <button style={{ ...x.btnGhost, flex: 1 }} onClick={onClose}>Cancelar</button>
        <button style={{ ...x.btnDark, flex: 2 }} onClick={() => { guardar(); }}><Check size={15} /> Guardar</button>
      </div>
    </div>
  );
}

/* ───────── 3. Ajustes del negocio: marca, estaciones, inventario ───────── */

export function AjustesPanel({ config, persistConfig, menu, onClose }) {
  const marca = { ...MARCA_POR_DEFECTO, ...(config.marca || {}) };
  const estaciones = getEstaciones(config);
  const categorias = [...new Set(menu.map((m) => m.cat))];
  const [nuevaEst, setNuevaEst] = useState("");
  const [errorLogo, setErrorLogo] = useState("");
  const fileRef = useRef(null);

  // Carga todas las tipografías para poder previsualizarlas
  useEffect(() => {
    const id = "fuentes-previa";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?${Object.values(FUENTES).map((f) => f.google).join("&")}&display=swap`;
    document.head.appendChild(l);
  }, []);

  const setMarca = (patch) => persistConfig({ ...config, marca: { ...marca, ...patch } });
  const subirLogo = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setErrorLogo("");
    try { setMarca({ logo: await reducirLogo(f) }); } catch (err) { setErrorLogo(err.message || "No se pudo usar esa imagen"); }
  };

  const setEstaciones = (lista, extra = {}) => persistConfig({ ...config, estaciones: lista, ...extra });
  const agregarEstacion = () => {
    const n = nuevaEst.trim();
    if (!n) return;
    setEstaciones([...estaciones, { id: uid(), nombre: n }]);
    setNuevaEst("");
  };
  const renombrar = (id, nombre) => { if (nombre.trim()) setEstaciones(estaciones.map((e) => (e.id === id ? { ...e, nombre: nombre.trim() } : e))); };
  const borrarEstacion = (id) => {
    if (estaciones.length <= 1) return;
    const mapa = { ...(config.estacionPorCategoria || {}) };
    Object.keys(mapa).forEach((c) => { if (mapa[c] === id) delete mapa[c]; });
    setEstaciones(estaciones.filter((e) => e.id !== id), { estacionPorCategoria: mapa });
  };
  const asignarCategoria = (cat, id) => persistConfig({ ...config, estacionPorCategoria: { ...(config.estacionPorCategoria || {}), [cat]: id } });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", color: K.ink }}>
      <CabeceraAdmin titulo="Ajustes del negocio" onClose={onClose} />

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Marca */}
        <div style={x.card}>
          <div style={x.eyebrow}>Marca</div>
          <div style={x.row}>
            <div style={{ minWidth: 64, maxWidth: 150, height: 64, padding: marca.logo ? "0 10px" : 0, borderRadius: 14, background: "#0E1013", border: `1px solid ${K.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {marca.logo ? <img src={marca.logo} alt="Logo" style={{ height: 40, width: "auto", maxWidth: 130, objectFit: "contain" }} /> : <ImageIcon size={24} color="#9BA4B0" strokeWidth={1.5} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={subirLogo} />
              <button style={x.btnSmall} onClick={() => fileRef.current && fileRef.current.click()}><Upload size={13} /> {marca.logo ? "Cambiar logo" : "Subir logo"}</button>
              {marca.logo && <button style={{ ...x.btnSmall, color: "var(--c-c1442d-t)" }} onClick={() => setMarca({ logo: null })}><Trash2 size={13} /> Quitar logo</button>}
            </div>
          </div>
          {errorLogo && <div style={{ fontSize: 12.5, color: K.red, fontWeight: 600 }}>{errorLogo}</div>}
          <div style={x.hint}>El logo se ve en la barra superior, el ingreso y la pantalla de carga, sobre fondo oscuro. Funciona mejor un PNG con fondo transparente y letras claras.</div>

          <div style={{ ...x.label, marginTop: 4 }}>Color de la marca</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(ACENTOS).map(([k, a]) => (
              <button key={k} title={a.nombre} aria-label={a.nombre} onClick={() => setMarca({ color: k })}
                style={{ width: 38, height: 38, borderRadius: 19, background: a.c, border: marca.color === k ? `3px solid ${K.ink}` : `3px solid transparent`, outline: `1px solid ${K.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#F4F6F8" }}>
                {marca.color === k && <Check size={16} strokeWidth={3} />}
              </button>
            ))}
          </div>

          <div style={{ ...x.label, marginTop: 4 }}>Tipografía</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(FUENTES).map(([k, f]) => (
              <button key={k} onClick={() => setMarca({ fuente: k })}
                style={{ ...x.optRow, ...(marca.fuente === k ? x.optRowSel : {}), flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span style={{ fontFamily: f.display, fontSize: 21, fontWeight: 700 }}>{config.businessName || "Tu negocio"}</span>
                <span style={{ fontFamily: f.body, fontSize: 12.5, color: K.muted }}>{f.nombre} · {f.muestra}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Estaciones */}
        <div style={x.card}>
          <div style={x.eyebrow}>Estaciones de preparación</div>
          <div style={x.hint}>Si tienes cocina y barra (u otras), crea una estación para cada una. Cada estación ve en su pantalla solo los productos que le tocan. Con una sola estación todo funciona como siempre.</div>
          {estaciones.map((e) => (
            <div key={e.id} style={x.row}>
              <input style={{ ...x.input, flex: 1 }} defaultValue={e.nombre} onBlur={(ev) => renombrar(e.id, ev.target.value)} />
              {estaciones.length > 1 && <button style={x.btnDanger} onClick={() => borrarEstacion(e.id)} aria-label="Quitar estación"><Trash2 size={14} /></button>}
            </div>
          ))}
          <div style={x.row}>
            <input style={{ ...x.input, flex: 1 }} placeholder="Nueva estación (ej: Barra)" value={nuevaEst} onChange={(e) => setNuevaEst(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarEstacion()} />
            <button style={x.btnSmall} onClick={agregarEstacion}><Plus size={13} /> Agregar</button>
          </div>
          {estaciones.length > 1 && categorias.length > 0 && (
            <>
              <div style={{ ...x.label, marginTop: 4 }}>¿Qué estación prepara cada categoría?</div>
              {categorias.map((c) => (
                <div key={c} style={{ ...x.row, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13.5, flex: 1 }}>{c}</span>
                  <select style={x.select} value={(config.estacionPorCategoria || {})[c] || estaciones[0].id} onChange={(e) => asignarCategoria(c, e.target.value)}>
                    {estaciones.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
              ))}
              <div style={x.hint}>Un producto puntual puede ir a otra estación desde Menú → Configurar.</div>
            </>
          )}
        </div>

        {/* Inventario */}
        <div style={x.card}>
          <div style={x.eyebrow}>Inventario</div>
          <Interruptor checked={!!config.inventarioBloquear} onChange={(v) => persistConfig({ ...config, inventarioBloquear: v })}>
            No dejar vender productos cuando falta un insumo
          </Interruptor>
          <div style={x.hint}>Apagado (recomendado al empezar): el producto sale con una etiqueta “SIN STOCK” pero se puede vender igual, por si el conteo todavía no está al día.</div>
        </div>
      </div>
    </div>
  );
}

/* ───────── 4. Inventario ───────── */

export function InventarioView({ insumos, saveInsumo, updateInsumo, deleteInsumo, ajustarInventario, config, persistConfig, usuarioActual }) {
  const vacio = { nombre: "", unidad: "unidades", stock: "", minimo: "", costo: "" };
  const [form, setForm] = useState(vacio);
  const [abierto, setAbierto] = useState(false);
  const [accion, setAccion] = useState(null); // { id, tipo: 'entrada' | 'conteo' | 'editar', valor, ... }
  const [confirmDel, setConfirmDel] = useState(null);

  const registrar = (txt) => persistConfig({ ...config, auditLog: [{ ts: Date.now(), accion: txt, actor: usuarioActual.nombre }, ...(config.auditLog || [])].slice(0, 500) });

  const orden = { agotado: 0, bajo: 1, ok: 2 };
  const lista = insumos.slice().sort((a, b) => orden[estadoStock(a)] - orden[estadoStock(b)] || a.nombre.localeCompare(b.nombre));
  const nAlertas = insumos.filter((i) => estadoStock(i) !== "ok").length;

  const crear = async () => {
    if (!form.nombre.trim()) return;
    await saveInsumo({ id: uid(), nombre: form.nombre.trim(), unidad: form.unidad, stock: num(form.stock), minimo: num(form.minimo), costo: num(form.costo) });
    registrar(`Inventario: creó "${form.nombre.trim()}" con ${fmtNum(num(form.stock))} ${form.unidad}`);
    setForm(vacio); setAbierto(false);
  };
  const confirmarAccion = async (ins) => {
    if (accion.tipo === "entrada") {
      const c = num(accion.valor);
      if (c <= 0) return;
      await ajustarInventario({ [ins.id]: c });
      registrar(`Inventario: entrada de ${fmtNum(c)} ${ins.unidad} de "${ins.nombre}"`);
    } else if (accion.tipo === "conteo") {
      if (accion.valor === "" || accion.valor === undefined) return;
      const nuevo = num(accion.valor);
      const dif = nuevo - (Number(ins.stock) || 0);
      if (dif !== 0) await ajustarInventario({ [ins.id]: dif });
      registrar(`Inventario: conteo de "${ins.nombre}" → ${fmtNum(nuevo)} ${ins.unidad} (antes ${fmtNum(ins.stock)})`);
    } else if (accion.tipo === "editar") {
      if (!accion.nombre.trim()) return;
      await updateInsumo(ins.id, { nombre: accion.nombre.trim(), unidad: accion.unidad, minimo: num(accion.minimo), costo: num(accion.costo) });
    }
    setAccion(null); vibrar(14);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 28px", display: "flex", flexDirection: "column", gap: 12, color: K.ink }}>
      {nAlertas > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: K.warnBg, color: K.warnTx, fontSize: 13, fontWeight: 600 }}>
          <AlertTriangle size={15} /> {nAlertas} {nAlertas === 1 ? "insumo está" : "insumos están"} agotados o por agotarse
        </div>
      )}

      {!abierto ? (
        <button style={x.btnDark} onClick={() => setAbierto(true)}><Plus size={15} /> Nuevo insumo</button>
      ) : (
        <div style={x.card} className="anim-in">
          <div style={x.eyebrow}>Nuevo insumo</div>
          <input style={x.input} autoFocus placeholder="Nombre (ej: Harina, Leche, Pan de hamburguesa)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <div style={x.row}>
            <select style={{ ...x.select, flex: 1 }} value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <CampoNumero style={{ ...x.input, flex: 1 }} placeholder="Stock actual" value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} />
          </div>
          <div style={x.row}>
            <CampoNumero style={{ ...x.input, flex: 1 }} placeholder="Avisar cuando baje de…" value={form.minimo} onChange={(v) => setForm({ ...form, minimo: v })} />
            <CampoPesos style={{ ...x.input, flex: 1 }} placeholder="Costo por unidad $" value={form.costo} onChange={(v) => setForm({ ...form, costo: v })} />
          </div>
          <div style={x.hint}>El costo por unidad (por kg, por litro, por unidad…) sirve para calcular solo el costo de cada producto según su receta.</div>
          <div style={x.row}>
            <button style={{ ...x.btnGhost, flex: 1 }} onClick={() => { setAbierto(false); setForm(vacio); }}>Cancelar</button>
            <button style={{ ...x.btnDark, flex: 2 }} onClick={crear}><Check size={15} /> Guardar insumo</button>
          </div>
        </div>
      )}

      {lista.length === 0 && !abierto && (
        <EmptyState icon={Boxes} titulo="Aún no hay insumos" texto="Crea tus insumos (harina, leche, pan, café…), luego en Menú → Configurar defines la receta de cada producto y el stock baja solo con cada pedido." />
      )}

      {lista.map((ins) => {
        const est = estadoStock(ins);
        const meta = { agotado: { t: "AGOTADO", bg: "var(--c-fbe2dc-b)", c: "var(--c-8a3a2b-t)", bar: "var(--danger-solid)" }, bajo: { t: "POR AGOTARSE", bg: "var(--c-fbefd9-b)", c: "var(--c-8a611a-t)", bar: "var(--warn-solid)" }, ok: { t: "OK", bg: "var(--c-e4eee1-b)", c: "var(--c-5b7553-t)", bar: "var(--ok-solid)" } }[est];
        const techo = Math.max((Number(ins.minimo) || 0) * 3, Number(ins.stock) || 0, 1);
        const pct = Math.max(0, Math.min(100, ((Number(ins.stock) || 0) / techo) * 100));
        const a = accion && accion.id === ins.id ? accion : null;
        return (
          <div key={ins.id} style={x.invCard} className="anim-in">
            <div style={{ ...x.row, justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{ins.nombre}</div>
                <div style={x.hint}>Mínimo {fmtNum(ins.minimo)} {ins.unidad}{ins.costo ? ` · ${money(ins.costo)} c/u` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={x.invStock}>{fmtNum(ins.stock)} <span style={{ fontSize: 13, fontWeight: 600, color: K.muted, fontFamily: "var(--font-body)" }}>{ins.unidad}</span></div>
                <span style={{ ...x.pill, background: meta.bg, color: meta.c }}>{meta.t}</span>
              </div>
            </div>
            <div style={x.bar}><div style={{ width: `${pct}%`, height: "100%", background: meta.bar, transition: "width .4s ease" }} /></div>

            {!a && confirmDel !== ins.id && (
              <div style={{ ...x.row, flexWrap: "wrap" }}>
                <button style={x.btnSmall} onClick={() => setAccion({ id: ins.id, tipo: "entrada", valor: "" })}><Plus size={13} /> Entrada</button>
                <button style={x.btnSmall} onClick={() => setAccion({ id: ins.id, tipo: "conteo", valor: "" })}><Check size={13} /> Contar</button>
                <button style={x.btnSmall} onClick={() => setAccion({ id: ins.id, tipo: "editar", nombre: ins.nombre, unidad: ins.unidad, minimo: String(ins.minimo || ""), costo: String(ins.costo || "") })}><Pencil size={13} /> Editar</button>
                <button style={{ ...x.btnDanger, marginLeft: "auto" }} onClick={() => setConfirmDel(ins.id)} aria-label="Eliminar"><Trash2 size={14} /></button>
              </div>
            )}
            {confirmDel === ins.id && (
              <div style={{ ...x.row, justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: K.red, fontWeight: 600 }}>¿Eliminar este insumo?</span>
                <div style={x.row}>
                  <button style={x.btnSmall} onClick={() => setConfirmDel(null)}>No</button>
                  <button style={{ ...x.btnSmall, background: "var(--danger-solid)", color: "#F4F6F8", border: "none" }} onClick={async () => { await deleteInsumo(ins.id); registrar(`Inventario: eliminó "${ins.nombre}"`); setConfirmDel(null); }}>Sí, eliminar</button>
                </div>
              </div>
            )}
            {a && (a.tipo === "entrada" || a.tipo === "conteo") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={x.hint}>{a.tipo === "entrada" ? `¿Cuánto llegó? (se suma al stock, en ${ins.unidad})` : `¿Cuánto hay realmente ahora? (reemplaza el stock, en ${ins.unidad})`}</div>
                <div style={x.row}>
                  <CampoNumero style={{ ...x.input, flex: 1 }} placeholder={a.tipo === "entrada" ? "Cantidad que llegó" : "Cantidad contada"} value={a.valor} onChange={(v) => setAccion({ ...a, valor: v })} />
                  <button style={x.btnGhost} onClick={() => setAccion(null)}>Cancelar</button>
                  <button style={{ ...x.btnDark, width: "auto" }} onClick={() => confirmarAccion(ins)}><Check size={14} /> Listo</button>
                </div>
              </div>
            )}
            {a && a.tipo === "editar" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input style={x.input} value={a.nombre} onChange={(e) => setAccion({ ...a, nombre: e.target.value })} />
                <div style={x.row}>
                  <select style={{ ...x.select, flex: 1 }} value={a.unidad} onChange={(e) => setAccion({ ...a, unidad: e.target.value })}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                  <CampoNumero style={{ ...x.input, flex: 1 }} placeholder="Mínimo" value={a.minimo} onChange={(v) => setAccion({ ...a, minimo: v })} />
                  <CampoPesos style={{ ...x.input, flex: 1 }} placeholder="Costo c/u" value={a.costo} onChange={(v) => setAccion({ ...a, costo: v })} />
                </div>
                <div style={x.row}>
                  <button style={{ ...x.btnGhost, flex: 1 }} onClick={() => setAccion(null)}>Cancelar</button>
                  <button style={{ ...x.btnDark, flex: 2 }} onClick={() => confirmarAccion(ins)}><Check size={14} /> Guardar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────── 5. Nuevo pedido para llevar / domicilio ───────── */

export function NuevoPedidoExterno({ tipo, onCancel, onCrear }) {
  const esDom = tipo === "domicilio";
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [envio, setEnvio] = useState("");
  const valido = esDom ? nombre.trim() && direccion.trim() : true;
  const Icono = esDom ? Bike : ShoppingBag;

  return (
    <Hoja onCerrar={onCancel} ancho={560} gap={12}>
{({ cerrar: cerrarHoja }) => (
<>
        <div style={x.row}>
          <div style={{ ...x.emptyIcon, width: 44, height: 44, color: "var(--accent-t)" }}><Icono size={22} strokeWidth={1.8} /></div>
          <div style={{ flex: 1 }}>
            <div style={x.sheetTitle}>{TIPO_META[tipo].label}</div>
            <div style={x.sheetSub}>{esDom ? "Datos para que el domiciliario llegue" : "Pedido sin mesa — el cliente lo recoge"}</div>
          </div>
          <button style={x.btnIcon} onClick={cerrarHoja} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <input style={x.input} autoFocus placeholder={esDom ? "Nombre del cliente" : "Nombre del cliente (opcional)"} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input style={x.input} type="tel" inputMode="tel" placeholder={esDom ? "Teléfono" : "Teléfono (opcional)"} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        {esDom && (
          <>
            <input style={x.input} placeholder="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            <input style={x.input} placeholder="Referencia (torre, apto, color de la casa…)" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            <CampoPesos placeholder="Costo del domicilio (se suma a la cuenta)" value={envio} onChange={setEnvio} />
          </>
        )}
        <button
          style={{ ...x.btnPrimary, opacity: valido ? 1 : 0.45 }} disabled={!valido}
          onClick={() => onCrear({ tipo, cliente: { nombre: nombre.trim(), telefono: telefono.trim(), direccion: direccion.trim(), referencia: referencia.trim() }, costoEnvio: esDom ? num(envio) : 0 })}
        >
          <Check size={16} /> Crear y tomar pedido
        </button>
      </>
)}
</Hoja>
  );
}

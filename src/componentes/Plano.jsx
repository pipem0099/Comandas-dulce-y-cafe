import React, { useRef, useState } from "react";
import { ChefHat, Bath, Trees, Beer, DoorOpen, Receipt, Package, Armchair, Square, GripVertical } from "lucide-react";
import { estadoVisualMesa, mesaMatch } from "../utilidades.js";

/*
 * Plano del negocio: un lienzo donde se dibujan las ZONAS (cocina, baño, terraza…) y las MESAS
 * en su lugar real. Todo se guarda en porcentajes del lienzo, así se ve igual de proporcionado en
 * celular, tablet o computador.
 *   mesa:  { id, nombre, x, y (centro, %), tam: "s"|"m"|"l", forma: "cuadrada"|"redonda"|"larga" }
 *   zona:  { id, tipo, nombre, x, y (esquina sup. izq., %), w, h (%) }
 */
export const ZONA_TIPOS = {
  cocina:  { label: "Cocina",   icon: ChefHat,  color: "#E08A3C" },
  bano:    { label: "Baño",     icon: Bath,     color: "#4F9BD9" },
  terraza: { label: "Terraza",  icon: Trees,    color: "#4FB37A" },
  barra:   { label: "Barra",    icon: Beer,     color: "#B07A3E" },
  entrada: { label: "Entrada",  icon: DoorOpen, color: "#8E7CC3" },
  caja:    { label: "Caja",     icon: Receipt,  color: "#C9973F" },
  bodega:  { label: "Bodega",   icon: Package,  color: "#8A94A0" },
  salon:   { label: "Salón",    icon: Armchair, color: "#D9708C" },
  otro:    { label: "Otro",     icon: Square,   color: "#8A94A0" },
};
export const TAM_MESA = { s: 11, m: 15, l: 21 };       // ancho de la mesa en % del lienzo
export const ALTOS_PLANO = [{ id: 75, label: "Compacto" }, { id: 100, label: "Normal" }, { id: 140, label: "Grande" }, { id: 190, label: "Extra grande" }];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function PlanoSalon({ mesas, zonas = [], alto = 100, cuentas, orders, editable, onTapMesa, seleccion, onSeleccionar, onCambiar }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null);
  const [live, setLive] = useState(null);

  const posDefault = (idx) => ({ x: 14 + (idx % 4) * 24, y: 14 + Math.floor(idx / 4) * 20 });
  const mesaPos = (m, idx) => (typeof m.x === "number" && typeof m.y === "number" ? { x: m.x, y: m.y } : posDefault(idx));

  const empezar = (e, kind, id, modo, orig) => {
    if (!editable) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ kind, id, modo, sx: e.clientX, sy: e.clientY, orig, moved: false });
    onSeleccionar && onSeleccionar({ kind, id });
  };
  const mover = (e) => {
    if (!drag || !ref.current) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    const r = ref.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.sx) / r.width) * 100;
    const dy = ((e.clientY - drag.sy) / r.height) * 100;
    const o = drag.orig;
    let patch;
    if (drag.kind === "mesa") patch = { x: clamp(o.x + dx, 4, 96), y: clamp(o.y + dy, 4, 96) };
    else if (drag.modo === "tam") patch = { w: clamp(o.w + dx, 8, 100 - o.x), h: clamp(o.h + dy, 8, 100 - o.y) };
    else patch = { x: clamp(o.x + dx, 0, 100 - o.w), y: clamp(o.y + dy, 0, 100 - o.h) };
    if (!drag.moved) setDrag({ ...drag, moved: true });
    setLive(patch);
  };
  const soltar = () => {
    if (drag && live && onCambiar) onCambiar(drag.kind, drag.id, live);
    setDrag(null); setLive(null);
  };

  return (
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
      <div
        ref={ref} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
        onPointerDown={() => editable && onSeleccionar && onSeleccionar(null)}
        style={{
          position: "relative", width: "100%", paddingTop: `${alto}%`, overflow: "hidden", boxSizing: "border-box", containerType: "inline-size",
          background: "var(--c-fffdf8-b)", border: editable ? "2px dashed var(--accent)" : "1px solid var(--c-e4dfce-o)", borderRadius: 16,
          ...(editable ? { backgroundImage: "radial-gradient(var(--c-d9cfae-o) 1px, transparent 1px)", backgroundSize: "20px 20px" } : {}),
        }}
      >
        {mesas.length === 0 && zonas.length === 0 && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-8a8272-t)", fontSize: 14 }}>Agrega mesas y zonas para ver tu plano.</div>}

        {/* Zonas: van al fondo */}
        {zonas.map((z) => {
          const t = ZONA_TIPOS[z.tipo] || ZONA_TIPOS.otro; const Icon = t.icon;
          const g = drag && drag.kind === "zona" && drag.id === z.id && live ? { ...z, ...live } : z;
          const sel = seleccion && seleccion.kind === "zona" && seleccion.id === z.id;
          return (
            <div
              key={z.id}
              onPointerDown={(e) => empezar(e, "zona", z.id, "mover", { x: z.x, y: z.y, w: z.w, h: z.h })}
              style={{
                position: "absolute", left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%`, height: `${g.h}%`, boxSizing: "border-box",
                background: `${t.color}1F`, border: `${sel ? 2 : 1.5}px ${sel ? "solid" : "dashed"} ${sel ? t.color : t.color + "88"}`, borderRadius: 12,
                pointerEvents: editable ? "auto" : "none", touchAction: editable ? "none" : "auto", cursor: editable ? "grab" : "default", zIndex: 0, overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 8px", color: t.color, fontWeight: 700, fontSize: "clamp(9px, 2.6cqw, 14px)", lineHeight: 1.1 }}>
                <Icon style={{ width: "clamp(11px, 3cqw, 17px)", height: "clamp(11px, 3cqw, 17px)", flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.nombre}</span>
              </div>
              {editable && sel && (
                <span
                  onPointerDown={(e) => empezar(e, "zona", z.id, "tam", { x: z.x, y: z.y, w: z.w, h: z.h })}
                  style={{ position: "absolute", right: 2, bottom: 2, width: 24, height: 24, borderRadius: 12, background: t.color, border: "2px solid #fff", cursor: "nwse-resize", touchAction: "none" }}
                />
              )}
            </div>
          );
        })}

        {/* Mesas */}
        {mesas.map((m, idx) => {
          const cuenta = (cuentas || []).find((c) => mesaMatch(c.mesa, m.id) && c.estado === "abierta");
          const visual = estadoVisualMesa(cuenta, cuenta ? (orders || []).filter((o) => o.cuentaId === cuenta.id) : []);
          const bg = cuenta ? visual.bg : "var(--c-fffdf8-b)";
          const color = cuenta ? visual.color : "var(--c-242019-t)";
          const pos = drag && drag.kind === "mesa" && drag.id === m.id && live ? live : mesaPos(m, idx);
          const base = TAM_MESA[m.tam] || TAM_MESA.m;
          const forma = m.forma || "cuadrada";
          const w = forma === "larga" ? base * 1.9 : base;
          const sel = seleccion && seleccion.kind === "mesa" && seleccion.id === m.id;
          return (
            <button
              key={m.id}
              onPointerDown={(e) => empezar(e, "mesa", m.id, "mover", mesaPos(m, idx))}
              onClick={() => { if (!editable && onTapMesa) onTapMesa(m.id); }}
              style={{
                position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)",
                width: `${w}%`, aspectRatio: forma === "larga" ? "1.9 / 1" : "1 / 1", boxSizing: "border-box",
                borderRadius: forma === "redonda" ? "50%" : "clamp(8px, 2.4cqw, 16px)", border: `2px solid ${sel ? "var(--accent)" : cuenta ? bg : "var(--c-e4dfce-b)"}`,
                background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 2, lineHeight: 1.15,
                fontWeight: 700, fontSize: "clamp(9px, 2.8cqw, 17px)", boxShadow: sel ? "0 0 0 4px rgba(128,138,150,.25)" : "0 2px 6px rgba(0,0,0,0.10)",
                cursor: editable ? "grab" : "pointer", touchAction: editable ? "none" : "auto", zIndex: drag && drag.id === m.id ? 3 : 2, userSelect: "none", WebkitUserSelect: "none",
              }}
            >
              {editable && <GripVertical size={11} style={{ position: "absolute", top: 3, right: 2, opacity: 0.45 }} />}
              <span style={{ overflow: "hidden", wordBreak: "break-word" }}>{m.nombre}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useRef } from "react";
import {
  Plus, Trash2, Pencil,
} from "lucide-react";
import { uid } from "../logica.js";
import { styles } from "../estilos.js";
import { estadoVisualMesa, mesaMatch } from "../utilidades.js";

/** Plano visual del salón: cada mesa se dibuja en su posición real (x%, y%)
 * en vez de una cuadrícula pareja. En modo "editable" se puede arrastrar
 * cada mesa a su lugar (con el dedo o el mouse); si no, solo se puede tocar
 * para entrar a ella — igual que las tarjetas de la cuadrícula. */
export function PlanoSalon({ mesas, cuentas, orders, editable, onTapMesa, onMoverMesa }) {
  const containerRef = useRef(null);
  const [arrastrando, setArrastrando] = useState(null);
  const [posLive, setPosLive] = useState(null);

  const posDefault = (idx) => {
    const cols = 4;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return { x: 15 + col * 24, y: 20 + row * 26 };
  };
  const posDe = (m, idx) => (typeof m.x === "number" && typeof m.y === "number") ? { x: m.x, y: m.y } : posDefault(idx);

  const onPointerDown = (e, m) => {
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastrando(m.id);
  };
  const onPointerMove = (e) => {
    if (!arrastrando || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(4, Math.min(96, x));
    y = Math.max(6, Math.min(94, y));
    setPosLive({ x, y });
  };
  const onPointerUp = () => {
    if (arrastrando && posLive) onMoverMesa(arrastrando, posLive.x, posLive.y);
    setArrastrando(null);
    setPosLive(null);
  };

  return (
    <div ref={containerRef} style={styles.planoContainer} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
      {mesas.length === 0 && <div style={styles.planoVacio}>Agrega mesas para verlas aquí.</div>}
      {mesas.map((m, idx) => {
        const cuenta = cuentas.find((c) => mesaMatch(c.mesa, m.id) && c.estado === "abierta");
        const visual = estadoVisualMesa(cuenta, cuenta ? orders.filter((o) => o.cuentaId === cuenta.id) : []);
        const bg = cuenta ? visual.bg : "var(--c-fffdf8-b)";
        const color = cuenta ? visual.color : "var(--c-242019-t)";
        const pos = arrastrando === m.id && posLive ? posLive : posDe(m, idx);
        return (
          <button
            key={m.id}
            onPointerDown={(e) => onPointerDown(e, m)}
            onClick={() => { if (!editable) onTapMesa(m.id); }}
            style={{
              ...styles.planoMesaTile,
              left: `${pos.x}%`, top: `${pos.y}%`,
              background: bg, color,
              borderColor: cuenta ? bg : "var(--c-e4dfce-b)",
              cursor: editable ? "grab" : "pointer",
              touchAction: editable ? "none" : "auto",
              zIndex: arrastrando === m.id ? 2 : 1,
            }}
          >
            {m.nombre}
          </button>
        );
      })}
    </div>
  );
}

export function MesasEditor({ mesas, persistMesas, cuentas, orders, config, persistConfig, actor, onClose }) {
  const [nombre, setNombre] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState("");

  const tieneCuentaAbierta = (mesaId) => cuentas.some((c) => mesaMatch(c.mesa, mesaId) && c.estado === "abierta");

  const registrar = (accion) => {
    if (!config || !persistConfig) return;
    const auditLog = config.auditLog || [];
    persistConfig({ ...config, auditLog: [{ ts: Date.now(), accion, actor: actor || "desconocido" }, ...auditLog].slice(0, 50) });
  };

  const agregarMesa = () => {
    if (!nombre.trim()) return;
    const nueva = { id: uid(), nombre: nombre.trim() };
    persistMesas([...mesas, nueva]);
    registrar(`Agregó la mesa/espacio "${nueva.nombre}"`);
    setNombre("");
  };

  const empezarEdicion = (m) => { setEditId(m.id); setEditNombre(m.nombre); setError(""); };
  const guardarEdicion = (m) => {
    if (!editNombre.trim()) return;
    persistMesas(mesas.map((x) => (x.id === m.id ? { ...x, nombre: editNombre.trim() } : x)));
    registrar(`Renombró "${m.nombre}" a "${editNombre.trim()}"`);
    setEditId(null); setEditNombre("");
  };

  const eliminarMesa = (m) => {
    if (tieneCuentaAbierta(m.id)) { setError("Esa mesa tiene una cuenta abierta — ciérrala o cóbrala antes de eliminarla."); setConfirmDeleteId(null); return; }
    persistMesas(mesas.filter((x) => x.id !== m.id));
    registrar(`Eliminó la mesa/espacio "${m.nombre}"`);
    setConfirmDeleteId(null);
  };

  const moverEnPlano = (id, x, y) => {
    persistMesas(mesas.map((m) => (m.id === id ? { ...m, x, y } : m)));
  };

  const mover = (idx, dir) => {
    const next = [...mesas];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    persistMesas(next);
  };

  return (
    <div style={styles.screen}>
      <div className="ancho" style={styles.subHeader}>
        <button style={styles.backBtn} onClick={onClose}>← Mesas</button>
        <div style={styles.mesaTitleWrap}><span style={styles.mesaEyebrow}>AJUSTES</span><span style={styles.mesaTitle}>Mesas y espacios</span></div>
        <div style={{ width: 70 }} />
      </div>
      <div className="ancho" style={styles.menuScroll}>
        <div style={styles.addItemCard}>
          <div style={styles.catLabel}>AGREGAR MESA O ESPACIO</div>
          <div style={styles.closeConfirmText}>Puedes ponerle cualquier nombre: "Mesa 5", "Barra", "Mesa gris", "Terraza"…</div>
          <input style={styles.editInput} placeholder="Nombre del espacio" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarMesa()} />
          <button style={styles.addItemBtn} onClick={agregarMesa}><Plus size={15} /> Agregar</button>
        </div>

        {error && <div style={styles.pinError}>{error}</div>}

        <div style={styles.catLabel}>UBICACIÓN EN EL PLANO</div>
        <div style={styles.closeConfirmText}>Arrastra cada mesa a su lugar real del salón — así se ve en Mesero cuando cambias a vista "Plano".</div>
        <PlanoSalon mesas={mesas} cuentas={cuentas} orders={orders} editable onMoverMesa={moverEnPlano} />

        <div style={{ ...styles.catLabel, marginTop: 18 }}>TUS MESAS Y ESPACIOS</div>
        {mesas.length === 0 && <div style={styles.cajaEmptyText}>Todavía no has agregado ninguna.</div>}
        {mesas.map((m, idx) => (
          <div key={m.id} style={styles.editRow}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button style={styles.mesaReorderBtn} onClick={() => mover(idx, -1)} disabled={idx === 0}>▲</button>
              <button style={styles.mesaReorderBtn} onClick={() => mover(idx, 1)} disabled={idx === mesas.length - 1}>▼</button>
            </div>
            {editId === m.id ? (
              <>
                <input autoFocus style={{ ...styles.editInput, flex: 1 }} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardarEdicion(m)} />
                <button style={styles.confirmYes} onClick={() => guardarEdicion(m)}>Guardar</button>
                <button style={styles.confirmNo} onClick={() => setEditId(null)}>Cancelar</button>
              </>
            ) : (
              <>
                <span style={{ ...styles.menuItemName, flex: 1 }}>{m.nombre}</span>
                {tieneCuentaAbierta(m.id) && <span style={styles.enCursoTag}>cuenta abierta</span>}
                <button style={styles.deleteBtn} onClick={() => empezarEdicion(m)}><Pencil size={14} /></button>
                {confirmDeleteId === m.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button style={styles.confirmYes} onClick={() => eliminarMesa(m)}>Sí</button>
                    <button style={styles.confirmNo} onClick={() => setConfirmDeleteId(null)}>No</button>
                  </div>
                ) : (
                  <button style={styles.deleteBtn} onClick={() => { setConfirmDeleteId(m.id); setError(""); }}><Trash2 size={14} /></button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { PlanoSalon, ZONA_TIPOS, ALTOS_PLANO } from "../componentes/Plano.jsx";
import { CabeceraAdmin } from "../componentes/CabeceraAdmin.jsx";
import {
  Plus, Trash2, Pencil, Lock, Check, X,
} from "lucide-react";
import { uid } from "../logica.js";
import { styles } from "../estilos.js";
import { mesaMatch } from "../utilidades.js";

export { PlanoSalon } from "../componentes/Plano.jsx";

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
    persistConfig({ ...config, auditLog: [{ ts: Date.now(), accion, actor: actor || "desconocido" }, ...auditLog].slice(0, 500) });
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

  // El plano está BLOQUEADO por defecto (un roce al hacer scroll no mueve nada). Al tocar "Editar plano"
  // los cambios quedan en un borrador y solo se guardan con "Guardar plano".
  const zonasBase = (config && config.plano && config.plano.zonas) || [];
  const altoBase = (config && config.plano && config.plano.alto) || 100;
  const [editandoPlano, setEditandoPlano] = useState(false);
  const [bMesas, setBMesas] = useState({});      // cambios a mesas: { id: {x,y,tam,forma} }
  const [bZonas, setBZonas] = useState(null);    // copia de las zonas mientras se edita
  const [bAlto, setBAlto] = useState(null);
  const [sel, setSel] = useState(null);          // { kind: "mesa"|"zona", id }
  const zonasVista = editandoPlano && bZonas ? bZonas : zonasBase;
  const altoVista = editandoPlano && bAlto ? bAlto : altoBase;
  const mesasVista = mesas.map((m) => (bMesas[m.id] ? { ...m, ...bMesas[m.id] } : m));
  const hayCambios = Object.keys(bMesas).length > 0 || (bZonas && JSON.stringify(bZonas) !== JSON.stringify(zonasBase)) || (bAlto && bAlto !== altoBase);

  const empezarPlano = () => { setBZonas(zonasBase.map((z) => ({ ...z }))); setBAlto(altoBase); setBMesas({}); setSel(null); setEditandoPlano(true); };
  const cambiarEnPlano = (kind, id, patch) => {
    if (kind === "mesa") setBMesas((b) => ({ ...b, [id]: { ...(b[id] || {}), ...patch } }));
    else setBZonas((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  };
  const agregarZona = (tipo) => {
    const t = ZONA_TIPOS[tipo];
    const z = { id: uid(), tipo, nombre: t.label, x: 6, y: 6, w: 34, h: 26 };
    setBZonas((zs) => [...(zs || []), z]); setSel({ kind: "zona", id: z.id });
  };
  const quitarZona = (id) => { setBZonas((zs) => zs.filter((z) => z.id !== id)); setSel(null); };
  const guardarPlano = () => {
    if (Object.keys(bMesas).length > 0) persistMesas(mesasVista);
    if ((bZonas && JSON.stringify(bZonas) !== JSON.stringify(zonasBase)) || (bAlto && bAlto !== altoBase)) {
      persistConfig({ ...config, plano: { zonas: bZonas || zonasBase, alto: bAlto || altoBase } });
    }
    if (hayCambios) registrar("Modificó el plano del negocio");
    setBMesas({}); setBZonas(null); setBAlto(null); setSel(null); setEditandoPlano(false);
  };
  const cancelarPlano = () => { setBMesas({}); setBZonas(null); setBAlto(null); setSel(null); setEditandoPlano(false); };
  const mesaSel = sel && sel.kind === "mesa" ? mesasVista.find((m) => m.id === sel.id) : null;
  const zonaSel = sel && sel.kind === "zona" ? zonasVista.find((z) => z.id === sel.id) : null;

  const mover = (idx, dir) => {
    const next = [...mesas];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    persistMesas(next);
  };

  return (
    <div style={styles.screen}>
      <CabeceraAdmin titulo="Mesas y espacios" onClose={onClose} />
      <div className="ancho" style={styles.menuScroll}>
        <div style={styles.addItemCard}>
          <div style={styles.catLabel}>AGREGAR MESA O ESPACIO</div>
          <div style={styles.closeConfirmText}>Puedes ponerle cualquier nombre: "Mesa 5", "Barra", "Mesa gris", "Terraza"…</div>
          <input style={styles.editInput} placeholder="Nombre del espacio" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarMesa()} />
          <button style={styles.addItemBtn} onClick={agregarMesa}><Plus size={15} /> Agregar</button>
        </div>

        {error && <div style={styles.pinError}>{error}</div>}

        <div style={{ ...styles.catLabel, marginTop: 22 }}>PLANO DEL NEGOCIO</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8, marginBottom: 6 }}>
        {!editandoPlano ? (
          <>
            <div style={{ ...styles.closeConfirmText, display: "flex", alignItems: "center", gap: 6 }}><Lock size={13} /> Plano bloqueado: así se ve en Mesero con la vista "Plano".</div>
            <button style={styles.addItemBtn} onClick={empezarPlano}><Pencil size={15} /> Editar plano</button>
          </>
        ) : (
          <>
            <div style={styles.closeConfirmText}>Arrastra mesas y zonas a su lugar. Toca una para ajustarla; en las zonas, arrastra la esquina para cambiar su tamaño.</div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={styles.cancelEditBtn} onClick={cancelarPlano}><X size={14} /> Cancelar</button>
              <button style={{ ...styles.sendBtn, flex: 1 }} onClick={guardarPlano}><Check size={15} /> {hayCambios ? "Guardar plano" : "Listo"}</button>
            </div>
          </>
        )}

        <PlanoSalon mesas={mesasVista} zonas={zonasVista} alto={altoVista} cuentas={cuentas} orders={orders} editable={editandoPlano} seleccion={sel} onSeleccionar={setSel} onCambiar={cambiarEnPlano} />

        {editandoPlano && mesaSel && (
          <div className="despliega" style={pl.panel}>
            <div style={pl.panelTitulo}>{mesaSel.nombre}</div>
            <div style={pl.etiqueta}>Tamaño</div>
            <div style={pl.pastillas}>
              {[["s", "Pequeña"], ["m", "Mediana"], ["l", "Grande"]].map(([k, l]) => <button key={k} style={{ ...pl.pastilla, ...((mesaSel.tam || "m") === k ? pl.on : {}) }} onClick={() => cambiarEnPlano("mesa", mesaSel.id, { tam: k })}>{l}</button>)}
            </div>
            <div style={pl.etiqueta}>Forma</div>
            <div style={pl.pastillas}>
              {[["cuadrada", "Cuadrada"], ["redonda", "Redonda"], ["larga", "Larga"]].map(([k, l]) => <button key={k} style={{ ...pl.pastilla, ...((mesaSel.forma || "cuadrada") === k ? pl.on : {}) }} onClick={() => cambiarEnPlano("mesa", mesaSel.id, { forma: k })}>{l}</button>)}
            </div>
          </div>
        )}
        {editandoPlano && zonaSel && (
          <div className="despliega" style={pl.panel}>
            <div style={pl.etiqueta}>Nombre de la zona</div>
            <input style={styles.editInput} value={zonaSel.nombre} onChange={(e) => cambiarEnPlano("zona", zonaSel.id, { nombre: e.target.value })} />
            <div style={pl.etiqueta}>Tipo</div>
            <div style={pl.pastillas}>
              {Object.entries(ZONA_TIPOS).map(([k, t]) => { const Icon = t.icon; return (
                <button key={k} style={{ ...pl.pastilla, ...(zonaSel.tipo === k ? pl.on : {}) }} onClick={() => cambiarEnPlano("zona", zonaSel.id, { tipo: k, ...(zonaSel.nombre === (ZONA_TIPOS[zonaSel.tipo] || {}).label ? { nombre: t.label } : {}) })}><Icon size={14} color={zonaSel.tipo === k ? "#F4F6F8" : t.color} /> {t.label}</button>
              ); })}
            </div>
            <button style={pl.eliminar} onClick={() => quitarZona(zonaSel.id)}><Trash2 size={15} /> Eliminar zona</button>
          </div>
        )}
        {editandoPlano && (
          <div style={pl.panel}>
            <div style={pl.etiqueta}>Agregar zona</div>
            <div style={pl.pastillas}>
              {Object.entries(ZONA_TIPOS).map(([k, t]) => { const Icon = t.icon; return (
                <button key={k} style={pl.pastilla} onClick={() => agregarZona(k)}><Icon size={14} color={t.color} /> {t.label}</button>
              ); })}
            </div>

            <div style={pl.etiqueta}>Tamaño del plano</div>
            <div style={pl.pastillas}>
              {ALTOS_PLANO.map((a) => <button key={a.id} style={{ ...pl.pastilla, ...(altoVista === a.id ? pl.on : {}) }} onClick={() => setBAlto(a.id)}>{a.label}</button>)}
            </div>

          </div>
        )}
        </div>

        <div style={{ ...styles.catLabel, marginTop: 26 }}>TUS MESAS Y ESPACIOS</div>
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

const pl = {
  etiqueta: { fontSize: 11.5, color: "var(--c-8a8272-t)", fontWeight: 600 },
  pastillas: { display: "flex", gap: 8, flexWrap: "wrap" },
  pastilla: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  on: { background: "var(--accent)", borderColor: "transparent", color: "#F4F6F8" },
  panel: { display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 16, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)" },
  panelTitulo: { fontSize: 15, fontWeight: 700, color: "var(--c-242019-t)" },
  eliminar: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 10, background: "transparent", border: "none", color: "#D64545", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};

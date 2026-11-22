import React, { useState } from "react";
import { PlanoSalon, ZONA_TIPOS, ALTOS_PLANO } from "../componentes/Plano.jsx";
import { CabeceraAdmin } from "../componentes/CabeceraAdmin.jsx";
import {
  Plus, Trash2, Pencil, Lock, Check, X, ChevronUp, ChevronDown,
} from "lucide-react";
import { uid } from "../logica.js";
import { Selector } from "../componentes/Campos.jsx";
import { InfoTip } from "../componentes/InfoTip.jsx";
import { GrupoSecciones, Seccion, Segmentado } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { cuentaCubre } from "../utilidades.js";
import { getPisos, planoDe, conPlano, pisoIdDeMesa, PISO_BASE } from "../pisos.js";

export { PlanoSalon } from "../componentes/Plano.jsx";

export function MesasEditor({ mesas, persistMesas, cuentas, orders, config, persistConfig, actor, onClose }) {
  const [nombre, setNombre] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState("");
  const [abrirPiso, setAbrirPiso] = useState(false);   // «Agregar piso» y «Agregar mesa» van plegados para no llenar la pantalla
  const [abrirMesa, setAbrirMesa] = useState(false);

  // ── Pisos: cada piso tiene sus mesas y su propio plano ──
  const pisos = getPisos(config);
  const varios = pisos.length > 1;
  const [pisoEd, setPisoEd] = useState(pisos[0].id);
  const pisoActual = pisos.some((p) => p.id === pisoEd) ? pisoEd : pisos[0].id;
  const [nuevoPiso, setNuevoPiso] = useState("");
  const [editPisoId, setEditPisoId] = useState(null);
  const [editPisoNombre, setEditPisoNombre] = useState("");
  const [borrarPisoId, setBorrarPisoId] = useState(null);
  const mesasPiso = mesas.filter((m) => pisoIdDeMesa(m, config) === pisoActual);

  const guardarPisos = (siguientes, extraConfig = {}, accion = "Cambió los pisos") => {
    const auditLog = config.auditLog || [];
    persistConfig({ ...config, ...extraConfig, pisos: siguientes, auditLog: [{ ts: Date.now(), accion, actor: actor || "desconocido" }, ...auditLog].slice(0, 500) });
  };
  const agregarPiso = () => {
    const n = nuevoPiso.trim(); if (!n) return;
    const id = "p" + uid().slice(0, 6);
    guardarPisos([...pisos, { id, nombre: n }], {}, `Agregó el piso "${n}"`);
    setNuevoPiso(""); setPisoEd(id); setAbrirPiso(false);
  };
  const renombrarPiso = (p) => {
    const n = editPisoNombre.trim(); if (!n) return;
    guardarPisos(pisos.map((x) => (x.id === p.id ? { ...x, nombre: n } : x)), {}, `Renombró el piso "${p.nombre}" a "${n}"`);
    setEditPisoId(null);
  };
  const borrarPiso = (p) => {
    if (p.id === pisos[0].id) return;
    const delPiso = mesas.filter((m) => pisoIdDeMesa(m, config) === p.id);
    if (delPiso.some((m) => tieneCuentaAbierta(m.id))) { setError("Hay mesas de ese piso con cuenta abierta — ciérralas antes de borrar el piso."); setBorrarPisoId(null); return; }
    // las mesas del piso borrado pasan al piso base y su plano se descarta
    if (delPiso.length) persistMesas(mesas.map((m) => (pisoIdDeMesa(m, config) === p.id ? { ...m, piso: pisos[0].id } : m)));
    const planos = { ...(config.planos || {}) }; delete planos[p.id];
    guardarPisos(pisos.filter((x) => x.id !== p.id), { planos }, `Eliminó el piso "${p.nombre}"`);
    setBorrarPisoId(null); setPisoEd(pisos[0].id);
  };
  const moverMesaDePiso = (m, pisoId) => {
    if (tieneCuentaAbierta(m.id)) { setError("Esa mesa tiene una cuenta abierta — para cambiarla de piso usa «Trasladar» desde Mesero."); return; }
    setError("");
    persistMesas(mesas.map((o) => { if (o.id !== m.id) return o; const { x, y, ...resto } = o; return { ...resto, piso: pisoId }; })); // al cambiar de piso pierde su lugar en el plano anterior
    registrar(`Pasó "${m.nombre}" al piso "${(pisos.find((p) => p.id === pisoId) || {}).nombre}"`);
  };

  const tieneCuentaAbierta = (mesaId) => cuentas.some((c) => cuentaCubre(c, mesaId) && c.estado === "abierta");

  const registrar = (accion) => {
    if (!config || !persistConfig) return;
    const auditLog = config.auditLog || [];
    persistConfig({ ...config, auditLog: [{ ts: Date.now(), accion, actor: actor || "desconocido" }, ...auditLog].slice(0, 500) });
  };

  const agregarMesa = () => {
    if (!nombre.trim()) return;
    const nueva = { id: uid(), nombre: nombre.trim(), ...(varios ? { piso: pisoActual } : {}) };
    persistMesas([...mesas, nueva]);
    registrar(`Agregó la mesa/espacio "${nueva.nombre}"`);
    setNombre(""); setAbrirMesa(false);
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
  const planoPiso = planoDe(config, pisoActual);
  const zonasBase = planoPiso.zonas || [];
  const altoBase = planoPiso.alto || 100;
  const [editandoPlano, setEditandoPlano] = useState(false);
  const [bMesas, setBMesas] = useState({});      // cambios a mesas: { id: {x,y,tam,forma} }
  const [bZonas, setBZonas] = useState(null);    // copia de las zonas mientras se edita
  const [bAlto, setBAlto] = useState(null);
  const [sel, setSel] = useState(null);          // { kind: "mesa"|"zona", id }
  const zonasVista = editandoPlano && bZonas ? bZonas : zonasBase;
  const altoVista = editandoPlano && bAlto ? bAlto : altoBase;
  const mesasVista = mesasPiso.map((m) => (bMesas[m.id] ? { ...m, ...bMesas[m.id] } : m));
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
    if (Object.keys(bMesas).length > 0) persistMesas(mesas.map((m) => (bMesas[m.id] ? { ...m, ...bMesas[m.id] } : m)));
    const cambioConfig = (bZonas && JSON.stringify(bZonas) !== JSON.stringify(zonasBase)) || (bAlto && bAlto !== altoBase);
    if (cambioConfig) {
      // UN solo guardado con el plano y el registro de seguridad juntos: dos guardados seguidos con una
      // copia vieja de la configuración hacían que el segundo borrara las zonas del primero.
      const auditLog = config.auditLog || [];
      persistConfig({
        ...conPlano(config, pisoActual, { zonas: bZonas || zonasBase, alto: bAlto || altoBase }),
        auditLog: [{ ts: Date.now(), accion: "Modificó el plano del negocio", actor: actor || "desconocido" }, ...auditLog].slice(0, 500),
      });
    } else if (hayCambios) registrar("Modificó el plano del negocio");
    setBMesas({}); setBZonas(null); setBAlto(null); setSel(null); setEditandoPlano(false);
  };
  const cancelarPlano = () => { setBMesas({}); setBZonas(null); setBAlto(null); setSel(null); setEditandoPlano(false); };
  const mesaSel = sel && sel.kind === "mesa" ? mesasVista.find((m) => m.id === sel.id) : null;
  const zonaSel = sel && sel.kind === "zona" ? zonasVista.find((z) => z.id === sel.id) : null;

  const mover = (m, dir) => {
    const i = mesasPiso.findIndex((x) => x.id === m.id);
    const vecina = mesasPiso[i + dir];
    if (!vecina) return;
    const next = [...mesas];
    const a = next.findIndex((x) => x.id === m.id), b = next.findIndex((x) => x.id === vecina.id);
    [next[a], next[b]] = [next[b], next[a]];
    persistMesas(next);
  };

  return (
    <div style={styles.screen}>
      <CabeceraAdmin titulo="Mesas y espacios" onClose={onClose} />
      <div className="ancho" style={styles.menuScroll}>
        {varios && (
          <Segmentado ariaLabel="Piso que estás editando" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 0 12px", WebkitOverflowScrolling: "touch" }}>
            {pisos.map((p) => (
              <button key={p.id} role="tab" aria-selected={pisoActual === p.id} disabled={editandoPlano && pisoActual !== p.id} onClick={() => { setPisoEd(p.id); setSel(null); }}
                style={{ ...pl.pastilla, flexShrink: 0, minHeight: 40, ...(pisoActual === p.id ? pl.on : {}), opacity: editandoPlano && pisoActual !== p.id ? 0.4 : 1 }}>{p.nombre}</button>
            ))}
          </Segmentado>
        )}
        <GrupoSecciones>
        <Seccion titulo="Pisos" resumen={varios ? pisos.map((p) => p.nombre).join(" · ") : "Un solo piso"}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -6 }}><InfoTip titulo="Pisos">{varios ? "Cada piso tiene sus propias mesas y su propio plano." : "¿Tu negocio tiene más de un piso? Agrega los demás y cada uno tendrá sus mesas y su plano."}</InfoTip></div>
          {varios && pisos.map((p, i) => (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 44, justifyContent: "center" }}>
              {editPisoId === p.id ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input autoFocus style={{ ...styles.editInput, flex: 1, minWidth: 0 }} aria-label={`Nombre del piso ${p.nombre}`} value={editPisoNombre} onChange={(e) => setEditPisoNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && renombrarPiso(p)} />
                    <button style={styles.confirmYes} onClick={() => renombrarPiso(p)}>Guardar</button>
                    <button style={styles.confirmNo} onClick={() => { setEditPisoId(null); setBorrarPisoId(null); }}>Cancelar</button>
                  </div>
                  {i > 0 && (borrarPisoId === p.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, color: "var(--c-5c5648-t)", flex: 1 }}>¿Eliminar «{p.nombre}»?</span>
                      <button style={styles.confirmYes} onClick={() => borrarPiso(p)}>Sí</button><button style={styles.confirmNo} onClick={() => setBorrarPisoId(null)}>No</button>
                    </div>
                  ) : (
                    <button style={pl.eliminar} onClick={() => { setBorrarPisoId(p.id); setError(""); }}><Trash2 size={15} style={{ flexShrink: 0 }} /> Eliminar piso</button>
                  ))}
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...styles.menuItemName, flex: 1 }}>{p.nombre}{i === 0 ? " · base" : ""}</span>
                  <button aria-label={`Editar ${p.nombre}`} className="toque44" style={styles.deleteBtn} onClick={() => { setEditPisoId(p.id); setEditPisoNombre(p.nombre); setBorrarPisoId(null); }}><Pencil size={14} /></button>
                </div>
              )}
            </div>
          ))}
          {!abrirPiso ? (
            <button style={styles.addItemBtn} aria-expanded="false" onClick={() => setAbrirPiso(true)}><Plus size={15} style={{ flexShrink: 0 }} /> Agregar piso</button>
          ) : (
            <>
              <input autoFocus style={styles.editInput} aria-label="Nombre del piso nuevo" placeholder={varios ? "Nombre del nuevo piso" : "Ej. Piso 2, Terraza alta"} value={nuevoPiso} onChange={(e) => setNuevoPiso(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarPiso()} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...styles.addItemBtn, flex: 1 }} onClick={() => { setAbrirPiso(false); setNuevoPiso(""); }}>Cancelar</button>
                <button style={{ ...styles.addItemBtn, flex: 1 }} onClick={agregarPiso}><Plus size={15} style={{ flexShrink: 0 }} /> Agregar</button>
              </div>
            </>
          )}
        </Seccion>
        <Seccion titulo="Agregar mesa o espacio">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -6 }}><InfoTip titulo="Mesas y espacios">Puedes ponerle cualquier nombre: «Mesa 5», «Barra», «Mesa gris», «Terraza»…</InfoTip></div>
          {!abrirMesa ? (
            <button style={styles.addItemBtn} aria-expanded="false" onClick={() => setAbrirMesa(true)}><Plus size={15} style={{ flexShrink: 0 }} /> Agregar mesa o espacio</button>
          ) : (
            <>
              <input autoFocus style={styles.editInput} aria-label="Nombre del espacio" placeholder="Nombre del espacio" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarMesa()} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...styles.addItemBtn, flex: 1 }} onClick={() => { setAbrirMesa(false); setNombre(""); }}>Cancelar</button>
                <button style={{ ...styles.addItemBtn, flex: 1 }} onClick={agregarMesa}><Plus size={15} style={{ flexShrink: 0 }} /> Agregar</button>
              </div>
            </>
          )}
        </Seccion>
        <Seccion titulo="Plano del negocio" resumen="Distribución de mesas y zonas">
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
            <div style={pl.etiqueta}>Orientación · {Math.round(Number(mesaSel.giro) || 0)}°</div>
            <div style={pl.pastillas}>
              {[[0, "Horizontal"], [90, "Vertical"], [45, "Diagonal ↘"], [135, "Diagonal ↗"]].map(([g, l]) => <button key={g} style={{ ...pl.pastilla, ...((Number(mesaSel.giro) || 0) === g ? pl.on : {}) }} onClick={() => cambiarEnPlano("mesa", mesaSel.id, { giro: g })}>{l}</button>)}
              <button style={pl.pastilla} onClick={() => cambiarEnPlano("mesa", mesaSel.id, { giro: (((Number(mesaSel.giro) || 0) + 90) % 180) })}>↻ Girar 90°</button>
            </div>
            <input type="range" min="0" max="175" step="5" value={(((Number(mesaSel.giro) || 0) % 180) + 180) % 180} onChange={(e) => cambiarEnPlano("mesa", mesaSel.id, { giro: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--accent)" }} aria-label="Girar la mesa libremente" />
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
        </Seccion>
        <Seccion titulo="Tus mesas y espacios" resumen={`${mesasPiso.length} ${mesasPiso.length === 1 ? "espacio" : "espacios"}`}>
        {mesasPiso.length === 0 && <div style={styles.cajaEmptyText}>Todavía no has agregado ninguna.</div>}
        {mesasPiso.map((m, idx) => (
          <div key={m.id} style={styles.editRow}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="toque44" style={styles.mesaReorderBtn} onClick={() => mover(m, -1)} disabled={idx === 0} aria-label="Subir"><ChevronUp size={15} /></button>
              <button className="toque44" style={styles.mesaReorderBtn} onClick={() => mover(m, 1)} disabled={idx === mesasPiso.length - 1} aria-label="Bajar"><ChevronDown size={15} /></button>
            </div>
            {editId === m.id ? (
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input autoFocus style={{ ...styles.editInput, flex: 1, minWidth: 0 }} aria-label={`Nombre de ${m.nombre}`} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardarEdicion(m)} />
                  <button style={styles.confirmYes} onClick={() => guardarEdicion(m)}>Guardar</button>
                  <button style={styles.confirmNo} onClick={() => { setEditId(null); setConfirmDeleteId(null); }}>Cancelar</button>
                </div>
                {confirmDeleteId === m.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5, color: "var(--c-5c5648-t)", flex: 1 }}>¿Eliminar «{m.nombre}»?</span>
                    <button style={styles.confirmYes} onClick={() => eliminarMesa(m)}>Sí</button>
                    <button style={styles.confirmNo} onClick={() => setConfirmDeleteId(null)}>No</button>
                  </div>
                ) : (
                  <button style={pl.eliminar} onClick={() => { setConfirmDeleteId(m.id); setError(""); }}><Trash2 size={15} style={{ flexShrink: 0 }} /> Eliminar</button>
                )}
              </div>
            ) : (
              <>
                <span style={{ ...styles.menuItemName, flex: 1, minWidth: 0 }}>{m.nombre}</span>
                {tieneCuentaAbierta(m.id) && <span style={styles.enCursoTag}>cuenta abierta</span>}
                {varios && (
                  <Selector compacto titulo={`Piso de ${m.nombre}`} ariaLabel={`Piso de ${m.nombre}`} value={pisoIdDeMesa(m, config)} onChange={(v) => moverMesaDePiso(m, v)} opciones={pisos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))} style={{ width: "auto", maxWidth: 140 }} />
                )}
                <button aria-label={`Editar ${m.nombre || "mesa"}`} className="toque44" style={styles.deleteBtn} onClick={() => { empezarEdicion(m); setConfirmDeleteId(null); }}><Pencil size={14} /></button>
              </>
            )}
          </div>
        ))}
        </Seccion>
        </GrupoSecciones>
        {error && <div style={styles.pinError}>{error}</div>}
      </div>
    </div>
  );
}

const pl = {
  etiqueta: { fontSize: 11.5, color: "var(--c-8a8272-t)", fontWeight: 600 },
  pastillas: { display: "flex", gap: 8, flexWrap: "wrap" },
  pastilla: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  on: { background: "var(--chip-on-bg)", color: "var(--chip-on-fg)", borderColor: "transparent", boxShadow: "inset 0 0 0 1px var(--chip-on-line)", fontWeight: 700 },
  panel: { display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 16, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)" },
  panelTitulo: { fontSize: 15, fontWeight: 700, color: "var(--c-242019-t)" },
  eliminar: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 10, background: "transparent", border: "none", color: "var(--c-c1442d-t)", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};

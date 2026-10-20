import React, { useState } from "react";
import { CabeceraAdmin } from "../componentes/CabeceraAdmin.jsx";
import { Plus, Check, Trash2, Settings2, Search, X, ChevronDown } from "lucide-react";
import { tieneOpciones, getEstaciones, costoReceta, uid, money } from "../logica.js";
import { ProductoConfig } from "../extras.jsx";
import { CampoMonto, Acordeon } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";

export function MenuEditor({ menu, persistMenu, config, persistConfig, actor, insumos, onClose }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [cat, setCat] = useState("");
  const [businessName, setBusinessName] = useState(config.businessName || "");
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [editCostValue, setEditCostValue] = useState("");
  const [configId, setConfigId] = useState(null); // producto cuyo panel de opciones / receta está abierto
  const [filtro, setFiltro] = useState("__todas__"); // categoría activa en la lista
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(null);     // producto desplegado
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [catNueva, setCatNueva] = useState(false);  // escribir una categoría que aún no existe

  const registrar = (accion) => {
    const auditLog = config.auditLog || [];
    persistConfig({ ...config, auditLog: [{ ts: Date.now(), accion, actor: actor || "desconocido" }, ...auditLog].slice(0, 500) });
  };

  const addItem = () => {
    if (!name.trim() || !price || !cat.trim()) return;
    const item = { id: uid(), name: name.trim(), price: parseFloat(price) || 0, cost: parseFloat(cost) || 0, cat: cat.trim() };
    persistMenu([...menu, item]);
    registrar(`Agregó "${item.name}" al menú (${money(item.price)})`);
    setName(""); setPrice(""); setCost(""); setCatNueva(false); setNuevoAbierto(false);
    setFiltro(item.cat); // lleva a la categoría donde quedó el producto nuevo
  };
  const removeItem = (id) => {
    const item = menu.find((m) => m.id === id);
    persistMenu(menu.filter((m) => m.id !== id));
    if (item) registrar(`Eliminó "${item.name}" del menú`);
    setConfirmDeleteId(null);
  };
  const toggleAgotado = (id) => {
    const item = menu.find((m) => m.id === id);
    persistMenu(menu.map((m) => (m.id === id ? { ...m, agotado: !m.agotado } : m)));
    if (item) registrar(`Marcó "${item.name}" como ${item.agotado ? "disponible" : "agotado"}`);
  };
  const empezarEdicionItem = (item) => {
    setEditingItemId(item.id);
    setEditPriceValue(item.price ? String(item.price) : "");
    setEditCostValue(item.cost ? String(item.cost) : "");
  };
  const guardarEdicionItem = (item) => {
    const nuevoPrecio = parseFloat(editPriceValue) || 0;
    const nuevoCosto = parseFloat(editCostValue) || 0;
    persistMenu(menu.map((m) => (m.id === item.id ? { ...m, price: nuevoPrecio, cost: nuevoCosto } : m)));
    if (nuevoPrecio !== item.price) registrar(`Cambió el precio de "${item.name}" de ${money(item.price)} a ${money(nuevoPrecio)}`);
    if (nuevoCosto !== (item.cost || 0)) registrar(`Actualizó el costo de "${item.name}" a ${money(nuevoCosto)}`);
    setEditingItemId(null); setEditPriceValue(""); setEditCostValue("");
  };

  const guardarConfigItem = (item, patch) => {
    // si el producto tiene receta con costos de insumos, el costo del producto se calcula solo
    const costoCalc = costoReceta(patch.receta, insumos);
    persistMenu(menu.map((m) => (m.id === item.id ? { ...m, grupos: patch.grupos, receta: patch.receta, estacion: patch.estacion, cost: costoCalc > 0 ? costoCalc : m.cost } : m)));
    registrar(`Configuró "${item.name}" (${patch.grupos.length} grupos de opciones, ${patch.receta.length} insumos en la receta)`);
    setConfigId(null);
  };

  const guardarNombre = async () => {
    if (!businessName.trim()) return;
    await persistConfig({ ...config, businessName: businessName.trim() });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const categorias = [...new Set(menu.map((m) => m.cat))];
  const q = busqueda.trim().toLowerCase();
  const visibles = menu.filter((m) => (filtro === "__todas__" || m.cat === filtro) && (!q || m.name.toLowerCase().includes(q)));
  const catsVisibles = categorias.filter((c) => visibles.some((m) => m.cat === c));
  const desplegar = (item) => {
    if (abierto === item.id) { setAbierto(null); setEditingItemId(null); return; }
    setAbierto(item.id); setConfigId(null); setConfirmDeleteId(null);
    setEditingItemId(item.id); setEditPriceValue(item.price ? String(item.price) : ""); setEditCostValue(item.cost ? String(item.cost) : "");
  };

  return (
    <div style={styles.screen}>
      <CabeceraAdmin titulo="Menú y precios" onClose={onClose} />
      <div className="ancho" style={styles.menuScroll}>

        {/* Barra fija de navegación: buscador + categorías en pastillas */}
        <div style={m.sticky}>
          <div style={m.buscador}>
            <Search size={16} color="var(--c-8a8272-t)" />
            <input data-enter="blur" style={m.buscadorInput} placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            {busqueda && <button style={m.limpiar} onClick={() => setBusqueda("")} aria-label="Borrar búsqueda"><X size={14} /></button>}
          </div>
          <div style={m.fila1}>
            <button style={{ ...m.pastilla, ...(filtro === "__todas__" ? m.pastillaOn : {}) }} onClick={() => setFiltro("__todas__")}>Todas <span style={m.cuenta}>{menu.length}</span></button>
            {categorias.map((c) => (
              <button key={c} style={{ ...m.pastilla, ...(filtro === c ? m.pastillaOn : {}) }} onClick={() => setFiltro(c)}>
                {c} <span style={m.cuenta}>{menu.filter((x) => x.cat === c).length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Agregar producto: cerrado por defecto para no estorbar */}
        {!nuevoAbierto ? (
          <button style={{ ...styles.addItemBtn, marginBottom: 14 }} onClick={() => { setNuevoAbierto(true); setCat(filtro !== "__todas__" ? filtro : ""); }}>
            <Plus size={16} /> Nuevo producto
          </button>
        ) : (
          <div className="despliega" style={{ ...styles.addItemCard, marginBottom: 14 }}>
            <div style={m.formTitulo}><span>Nuevo producto</span><button style={m.limpiar} onClick={() => setNuevoAbierto(false)} aria-label="Cerrar"><X size={15} /></button></div>
            <input style={styles.editInput} placeholder="Nombre del producto" value={name} onChange={(e) => setName(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Precio de venta" value={price} onChange={setPrice} />
              <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Costo (opcional)" value={cost} onChange={setCost} />
            </div>
            <div style={m.etiqueta}>Categoría</div>
            <div style={m.pastillas}>
              {categorias.map((c) => (
                <button key={c} style={{ ...m.pastilla, ...(cat === c && !catNueva ? m.pastillaOn : {}) }} onClick={() => { setCat(c); setCatNueva(false); }}>{c}</button>
              ))}
              <button style={{ ...m.pastilla, borderStyle: "dashed", ...(catNueva ? m.pastillaOn : {}) }} onClick={() => { setCatNueva(true); setCat(""); }}><Plus size={13} /> Nueva</button>
            </div>
            {catNueva && <input style={styles.editInput} placeholder="Nombre de la nueva categoría" value={cat} onChange={(e) => setCat(e.target.value)} autoFocus />}
            <button style={{ ...styles.sendBtn, opacity: name.trim() && price && cat.trim() ? 1 : 0.4 }} disabled={!(name.trim() && price && cat.trim())} onClick={addItem}><Plus size={15} /> Agregar al menú</button>
          </div>
        )}

        {/* Lista */}
        {visibles.length === 0 && <div style={m.vacio}>{q ? `No hay productos que coincidan con "${busqueda}".` : "No hay productos en esta categoría."}</div>}
        {catsVisibles.map((c) => (
          <div key={c} style={{ marginBottom: 18 }}>
            {filtro === "__todas__" && <div style={styles.catLabel}>{c}</div>}
            <div style={m.grupo}>
              {visibles.filter((x) => x.cat === c).map((item, idx, arr) => {
                const margen = item.price - (item.cost || 0);
                const margenPct = item.price > 0 ? Math.round((margen / item.price) * 100) : 0;
                const abiertoAhora = abierto === item.id;
                return (
                  <div key={item.id} style={{ ...m.fila, ...(idx === arr.length - 1 ? { borderBottom: "none" } : {}) }}>
                    <button style={m.filaMain} onClick={() => desplegar(item)} aria-expanded={abiertoAhora}>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, textAlign: "left", flex: 1 }}>
                        <span style={{ ...m.nombre, ...(item.agotado ? { textDecoration: "line-through", opacity: 0.55 } : {}) }}>{item.name}</span>
                        <span style={m.meta}>{item.agotado ? "Agotado" : item.cost ? `Margen ${margenPct}%` : "Sin costo registrado"}{item.receta && item.receta.length > 0 ? " · con receta" : ""}{tieneOpciones(item) ? ` · ${item.grupos.length} ${item.grupos.length > 1 ? "grupos" : "grupo"}` : ""}</span>
                      </span>
                      <span style={m.precio}>{money(item.price)}</span>
                      <ChevronDown size={16} style={{ flexShrink: 0, transition: "transform .3s cubic-bezier(.32,.72,0,1)", transform: abiertoAhora ? "rotate(180deg)" : "none" }} />
                    </button>
                    {abiertoAhora && (
                      <div className="despliega" style={m.detalle}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <div style={{ flex: 1 }}><div style={m.etiqueta}>Precio</div><CampoMonto style={{ ...styles.editInput, width: "100%" }} placeholder="Precio" value={editPriceValue} onChange={setEditPriceValue} /></div>
                          <div style={{ flex: 1 }}><div style={m.etiqueta}>Costo</div><CampoMonto style={{ ...styles.editInput, width: "100%" }} placeholder="Costo" value={editCostValue} onChange={setEditCostValue} /></div>
                        </div>
                        <button style={styles.sendBtn} onClick={() => guardarEdicionItem(item)}><Check size={15} /> Guardar precio y costo</button>
                        <button style={styles.modoChoiceBtn} onClick={() => toggleAgotado(item.id)}>{item.agotado ? "Marcar como disponible" : "Marcar como agotado"}</button>
                        <button style={styles.modoChoiceBtn} onClick={() => setConfigId(configId === item.id ? null : item.id)}>
                          <Settings2 size={16} /> Opciones{getEstaciones(config).length > 1 ? ", estación" : ""} y receta
                        </button>
                        {configId === item.id && (
                          <ProductoConfig item={item} config={config} insumos={insumos || []} onSave={(patch) => guardarConfigItem(item, patch)} onClose={() => setConfigId(null)} />
                        )}
                        {confirmDeleteId === item.id ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ flex: 1, fontSize: 13, color: "var(--c-5c5648-t)" }}>¿Eliminar "{item.name}"?</span>
                            <button style={styles.confirmYes} onClick={() => removeItem(item.id)}>Sí, eliminar</button>
                            <button style={styles.confirmNo} onClick={() => setConfirmDeleteId(null)}>No</button>
                          </div>
                        ) : (
                          <button style={m.eliminar} onClick={() => setConfirmDeleteId(item.id)}><Trash2 size={15} /> Eliminar producto</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <Acordeon titulo="Nombre del negocio" resumen={config.businessName || "Sin nombre"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 0 6px" }}>
            <input style={styles.editInput} placeholder="Nombre del negocio" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <button style={styles.addItemBtn} onClick={guardarNombre}>{savedFlash ? <><Check size={15} /> Guardado</> : "Guardar nombre"}</button>
          </div>
        </Acordeon>
      </div>
    </div>
  );
}

// estilos propios de esta pantalla
const m = {
  sticky: { position: "sticky", top: 0, zIndex: 6, background: "var(--c-f7f4ec-b)", paddingBottom: 10, marginBottom: 4 },
  buscador: { display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 44, borderRadius: 14, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", marginBottom: 10 },
  buscadorInput: { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 15, color: "var(--c-242019-t)" },
  limpiar: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 13, border: "none", background: "rgba(128,138,150,.18)", color: "var(--c-8a8272-t)", cursor: "pointer" },
  pastillas: { display: "flex", gap: 8, flexWrap: "wrap" },
  fila1: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" },
  pastilla: { flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  pastillaOn: { background: "var(--neon)", borderColor: "transparent", color: "var(--neon-text)", fontWeight: 800, boxShadow: "var(--neon-glow)" },
  cuenta: { fontSize: 11.5, opacity: 0.7, fontWeight: 700 },
  formTitulo: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "var(--c-242019-t)" },
  etiqueta: { fontSize: 11.5, color: "var(--c-8a8272-t)", fontWeight: 600, marginBottom: 4 },
  vacio: { padding: "26px 8px", textAlign: "center", color: "var(--c-8a8272-t)", fontSize: 14 },
  grupo: { background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 16, overflow: "hidden" },
  fila: { borderBottom: "1px solid var(--c-ede7d8-o)" },
  filaMain: { width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", background: "transparent", border: "none", cursor: "pointer", color: "var(--c-242019-t)" },
  nombre: { fontSize: 15, fontWeight: 600, color: "var(--c-242019-t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { fontSize: 11.5, color: "var(--c-8a8272-t)" },
  precio: { fontSize: 15, fontWeight: 700, color: "var(--c-242019-t)", flexShrink: 0 },
  detalle: { display: "flex", flexDirection: "column", gap: 10, padding: "4px 14px 14px" },
  eliminar: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", background: "transparent", border: "none", color: "var(--c-c1442d-t)", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};

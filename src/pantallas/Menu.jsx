import React, { useState } from "react";
import {
  Plus, Check, Trash2, Pencil, PauseCircle,
} from "lucide-react";
import { tieneOpciones, getEstaciones, costoReceta, uid, money } from "../logica.js";
import { ProductoConfig } from "../extras.jsx";
import { CampoMonto } from "../componentes/Comunes.jsx";
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

  const registrar = (accion) => {
    const auditLog = config.auditLog || [];
    persistConfig({ ...config, auditLog: [{ ts: Date.now(), accion, actor: actor || "desconocido" }, ...auditLog].slice(0, 50) });
  };

  const addItem = () => {
    if (!name.trim() || !price) return;
    const item = { id: uid(), name: name.trim(), price: parseFloat(price) || 0, cost: parseFloat(cost) || 0, cat: cat.trim() || "Otros" };
    persistMenu([...menu, item]);
    registrar(`Agregó "${item.name}" al menú (${money(item.price)})`);
    setName(""); setPrice(""); setCost(""); setCat("");
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

  return (
    <div style={styles.screen}>
      <div className="ancho" style={styles.subHeader}>
        <button style={styles.backBtn} onClick={onClose}>← Mesas</button>
        <div style={styles.mesaTitleWrap}><span style={styles.mesaEyebrow}>AJUSTES</span><span style={styles.mesaTitle}>Menú</span></div>
        <div style={{ width: 70 }} />
      </div>
      <div className="ancho" style={styles.menuScroll}>
        <div style={styles.addItemCard}>
          <div style={styles.catLabel}>NOMBRE DEL NEGOCIO</div>
          <input style={styles.editInput} placeholder="Nombre del negocio" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <button style={styles.addItemBtn} onClick={guardarNombre}>
            {savedFlash ? <><Check size={15} /> Guardado</> : "Guardar nombre"}
          </button>
        </div>

        <div style={styles.addItemCard}>
          <input style={styles.editInput} placeholder="Nombre del plato" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Precio de venta" value={price} onChange={setPrice} />
            <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Costo (opcional)" value={cost} onChange={setCost} />
          </div>
          <input style={{ ...styles.editInput, flex: 1 }} placeholder="Categoría" value={cat} onChange={(e) => setCat(e.target.value)} />
          <button style={styles.addItemBtn} onClick={addItem}><Plus size={15} /> Agregar al menú</button>
        </div>

        {[...new Set(menu.map((m) => m.cat))].map((c) => (
          <div key={c} style={{ marginBottom: 18 }}>
            <div style={styles.catLabel}>{c}</div>
            {menu.filter((m) => m.cat === c).map((item) => {
              const margen = item.price - (item.cost || 0);
              const margenPct = item.price > 0 ? Math.round((margen / item.price) * 100) : 0;
              return (
                <div key={item.id} style={styles.menuEditItemBlock}>
                  <div style={{ ...styles.editRow, borderBottom: "none" }}>
                    <button
                      style={{ ...styles.agotadoToggle, ...(item.agotado ? styles.agotadoToggleActive : {}) }}
                      onClick={() => toggleAgotado(item.id)}
                      title={item.agotado ? "Marcar disponible" : "Marcar agotado"}
                    >
                      <PauseCircle size={14} />
                    </button>
                    <span style={{ ...styles.menuItemName, ...(item.agotado ? { textDecoration: "line-through", color: "var(--c-9a9382-t)" } : {}) }}>{item.name}</span>
                    {editingItemId !== item.id && (
                      <button style={styles.precioEditableBtn} onClick={() => empezarEdicionItem(item)}>{money(item.price)} <Pencil size={10} /></button>
                    )}
                    {confirmDeleteId === item.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button style={styles.confirmYes} onClick={() => removeItem(item.id)}>Sí</button>
                        <button style={styles.confirmNo} onClick={() => setConfirmDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <button style={styles.deleteBtn} onClick={() => setConfirmDeleteId(item.id)}><Trash2 size={14} /></button>
                    )}
                  </div>
                  {editingItemId === item.id ? (
                    <div style={styles.costoEditRow}>
                      <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Precio de venta" value={editPriceValue} onChange={setEditPriceValue} autoFocus />
                      <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Costo" value={editCostValue} onChange={setEditCostValue} />
                      <button style={styles.confirmYes} onClick={() => guardarEdicionItem(item)}>Guardar</button>
                      <button style={styles.confirmNo} onClick={() => setEditingItemId(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <button style={styles.costoPillBtn} onClick={() => empezarEdicionItem(item)}>
                      {item.cost ? (
                        <>Costo {money(item.cost)} · Margen {money(margen)} ({margenPct}%)</>
                      ) : (
                        <>+ Agregar costo de producción (para ver el margen)</>
                      )}
                    </button>
                  )}
                  <button style={styles.costoPillBtn} onClick={() => setConfigId(configId === item.id ? null : item.id)}>
                    ⚙ Configurar: opciones{getEstaciones(config).length > 1 ? ", estación" : ""} y receta
                    {(tieneOpciones(item) || (item.receta && item.receta.length > 0)) && (
                      <> · {tieneOpciones(item) ? `${item.grupos.length} grupo${item.grupos.length > 1 ? "s" : ""}` : ""}{tieneOpciones(item) && item.receta && item.receta.length > 0 ? " · " : ""}{item.receta && item.receta.length > 0 ? "con receta" : ""}</>
                    )}
                  </button>
                  {configId === item.id && (
                    <ProductoConfig item={item} config={config} insumos={insumos || []} onSave={(patch) => guardarConfigItem(item, patch)} onClose={() => setConfigId(null)} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

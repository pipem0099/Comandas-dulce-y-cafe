import React, { useState, useMemo } from "react";
import {
  Plus, Minus, Check, X, Trash2, Pencil, Search, AlertTriangle, Boxes, History, ShoppingCart, Copy, Share2,
  ChevronDown, ChevronUp, CalendarClock, MapPin, Truck, PackageMinus, Printer,
} from "lucide-react";
import { uid, money, fmtNum, UNIDADES, estadoStock } from "./logica.js";
import { vibrar } from "./theme.js";
import { K, x, CampoNumero, CampoPesos, EmptyState } from "./extras.jsx";
import { imprimir, Hoja, Seccion, Kpis, Tabla, Firmas } from "./impresion.jsx";
import { tieneRol } from "./utilidades.js";

/*
 * Inventario para cualquier tipo de negocio: ingredientes, bebidas, empaques, limpieza, equipos…
 *
 * Cada insumo guarda (todo lo nuevo es opcional, lo ya guardado sigue funcionando):
 *   nombre, unidad, stock, minimo, costo                  → como antes (el stock baja solo con las recetas)
 *   categoria, proveedor, ubicacion, codigo, nota         → para organizar y buscar
 *   ideal   → cuánto quieres tener (la lista de compras sugiere pedir hasta ahí)
 *   vence   → fecha de vencimiento "AAAA-MM-DD" (alerta cuando está cerca)
 *   pres    → { n: "Caja", c: 24 }: cómo lo compras (1 caja = 24 unidades), para dar entrada en cajas
 *   movs    → historial de los últimos movimientos hechos a mano (entradas, salidas, mermas, conteos)
 */

const CATEGORIAS = ["Ingredientes", "Bebidas", "Empaques y desechables", "Limpieza", "Barra y café", "Utensilios y equipos", "Otros"];
const MOTIVOS_SALIDA = ["Merma / vencido", "Derrame o daño", "Consumo interno", "Cortesía", "Otro"];
const DIAS_AVISO_VENCE = 7;
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const t = (v) => (v === undefined || v === null ? "" : String(v).trim());

/* ───────── fechas ───────── */
const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
function diasParaVencer(vence) {
  if (!vence) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(`${vence}T00:00:00`);
  if (Number.isNaN(f.getTime())) return null;
  return Math.round((f - hoy) / 86400000);
}
const fechaCorta = (ts) => new Date(ts).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const venceCorta = (v) => new Date(`${v}T00:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

/* ───────── estado de un insumo ───────── */
function estadoVence(ins) {
  const d = diasParaVencer(ins.vence);
  if (d === null) return null;
  if (d < 0) return { k: "vencido", d };
  if (d <= DIAS_AVISO_VENCE) return { k: "pronto", d };
  return null;
}
const META_STOCK = {
  agotado: { t: "AGOTADO", bg: "var(--c-fbe2dc-b)", c: "var(--c-8a3a2b-t)", bar: "var(--danger-solid)" },
  bajo: { t: "POR AGOTARSE", bg: "var(--c-fbefd9-b)", c: "var(--c-8a611a-t)", bar: "var(--warn-solid)" },
  ok: { t: "OK", bg: "var(--c-e4eee1-b)", c: "var(--c-5b7553-t)", bar: "var(--ok-solid)" },
};
// Cuánto conviene pedir: hasta el "ideal" (o el doble del mínimo si no hay ideal), redondeado hacia arriba.
function cantidadSugerida(ins) {
  const s = Number(ins.stock) || 0;
  const meta = Number(ins.ideal) > 0 ? Number(ins.ideal) : (Number(ins.minimo) || 0) * 2;
  const falta = Math.max(0, meta - s);
  return falta > 0 ? Math.ceil(falta * 100) / 100 : 0;
}
const necesitaCompra = (ins) => estadoStock(ins) !== "ok" || (Number(ins.ideal) > 0 && (Number(ins.stock) || 0) < Number(ins.ideal) * 0.5);

/* ───────── formulario (crear / editar) — componente de nivel superior para no perder el foco al escribir ───────── */
const formVacio = () => ({
  nombre: "", categoria: "", unidadSel: "unidades", unidadOtra: "", stock: "", minimo: "", ideal: "", costo: "",
  proveedor: "", ubicacion: "", codigo: "", vence: "", presN: "", presC: "", nota: "",
});
const formDe = (i) => ({
  nombre: i.nombre || "", categoria: i.categoria || "",
  unidadSel: UNIDADES.includes(i.unidad) ? i.unidad : "__otra", unidadOtra: UNIDADES.includes(i.unidad) ? "" : (i.unidad || ""),
  stock: "", minimo: i.minimo ? String(i.minimo) : "", ideal: i.ideal ? String(i.ideal) : "", costo: i.costo ? String(i.costo) : "",
  proveedor: i.proveedor || "", ubicacion: i.ubicacion || "", codigo: i.codigo || "", vence: i.vence || "",
  presN: i.pres ? i.pres.n || "" : "", presC: i.pres && i.pres.c ? String(i.pres.c) : "", nota: i.nota || "",
});
const unidadDe = (f) => (f.unidadSel === "__otra" ? t(f.unidadOtra) || "unidades" : f.unidadSel);

function FormInsumo({ v, set, categorias, nuevo, ocupado, onCancel, onGuardar, textoGuardar }) {
  const hayDetalles = !!(v.proveedor || v.ubicacion || v.codigo || v.vence || v.presN || v.nota);
  const [masDetalles, setMas] = useState(hayDetalles);
  const u = unidadDe(v);
  return (
    <div style={x.card} className="anim-in">
      <div style={x.eyebrow}>{nuevo ? "Nuevo artículo" : "Editar artículo"}</div>
      <input style={x.input} autoFocus={nuevo} placeholder="Nombre (ej: Harina, Leche, Vasos 9 oz, Detergente)" value={v.nombre} onChange={(e) => set({ ...v, nombre: e.target.value })} />

      <div style={x.row}>
        <input style={{ ...x.input, flex: 1 }} list="inv-categorias" placeholder="Categoría (elige o escribe una)" value={v.categoria} onChange={(e) => set({ ...v, categoria: e.target.value })} />
        <datalist id="inv-categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
      </div>

      <div style={x.row}>
        <select style={{ ...x.select, flex: 1 }} value={v.unidadSel} onChange={(e) => set({ ...v, unidadSel: e.target.value })}>
          {UNIDADES.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value="__otra">otra unidad…</option>
        </select>
        {nuevo && <CampoNumero style={{ ...x.input, flex: 1 }} placeholder="Stock actual" value={v.stock} onChange={(val) => set({ ...v, stock: val })} />}
      </div>
      {v.unidadSel === "__otra" && <input style={x.input} placeholder="¿Cuál unidad? (ej: sobres, galones, bandejas)" value={v.unidadOtra} onChange={(e) => set({ ...v, unidadOtra: e.target.value })} />}

      <div style={x.row}>
        <CampoNumero style={{ ...x.input, flex: 1 }} placeholder="Avisar cuando baje de…" value={v.minimo} onChange={(val) => set({ ...v, minimo: val })} />
        <CampoNumero style={{ ...x.input, flex: 1 }} placeholder="Stock ideal (para pedir)" value={v.ideal} onChange={(val) => set({ ...v, ideal: val })} />
      </div>
      <CampoPesos style={x.input} placeholder={`Costo por ${u} $`} value={v.costo} onChange={(val) => set({ ...v, costo: val })} />
      <div style={x.hint}>El costo sirve para calcular el costo de cada producto según su receta y el valor de tu inventario. El stock ideal es lo que quieres tener: la lista de compras te sugiere pedir hasta ahí.</div>

      <button style={{ ...x.btnGhost, justifyContent: "space-between" }} onClick={() => setMas(!masDetalles)}>
        <span>Más detalles (proveedor, ubicación, vencimiento…)</span>{masDetalles ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {masDetalles && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="anim-in">
          <div style={x.row}>
            <input style={{ ...x.input, flex: 1 }} placeholder="Proveedor" value={v.proveedor} onChange={(e) => set({ ...v, proveedor: e.target.value })} />
            <input style={{ ...x.input, flex: 1 }} placeholder="Ubicación (nevera, bodega…)" value={v.ubicacion} onChange={(e) => set({ ...v, ubicacion: e.target.value })} />
          </div>
          <div style={x.row}>
            <input style={{ ...x.input, flex: 1 }} placeholder="Código o referencia" value={v.codigo} onChange={(e) => set({ ...v, codigo: e.target.value })} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={x.hint}>Vence el</span>
              <input style={x.input} type="date" value={v.vence} onChange={(e) => set({ ...v, vence: e.target.value })} />
            </div>
          </div>
          <div style={x.hint}>¿Lo compras por caja, paquete o bulto? Así das entrada contando cajas.</div>
          <div style={x.row}>
            <input style={{ ...x.input, flex: 1 }} placeholder="Se compra en… (Caja)" value={v.presN} onChange={(e) => set({ ...v, presN: e.target.value })} />
            <CampoNumero style={{ ...x.input, flex: 1 }} placeholder={`${u} por ${t(v.presN).toLowerCase() || "caja"}`} value={v.presC} onChange={(val) => set({ ...v, presC: val })} />
          </div>
          <input style={x.input} placeholder="Nota (opcional)" value={v.nota} onChange={(e) => set({ ...v, nota: e.target.value })} />
        </div>
      )}

      <div style={x.row}>
        <button style={{ ...x.btnGhost, flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button style={{ ...x.btnDark, flex: 2, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={onGuardar}><Check size={15} /> {textoGuardar}</button>
      </div>
    </div>
  );
}

/* ───────── pantalla ───────── */
export function InventarioView({ insumos, saveInsumo, updateInsumo, deleteInsumo, ajustarInventario, config, persistConfig, usuarioActual }) {
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(formVacio());
  const [accion, setAccion] = useState(null); // { id, tipo: 'entrada' | 'salida' | 'conteo' | 'editar' | 'historial', ... }
  const [confirmDel, setConfirmDel] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | alertas | vencen | categoria:<nombre>
  const [orden, setOrden] = useState("urgencia");
  const [verCompras, setVerCompras] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const registrar = (txt) => persistConfig({ ...config, auditLog: [{ ts: Date.now(), accion: txt, actor: usuarioActual.nombre }, ...(config.auditLog || [])].slice(0, 500) });
  const asentar = (ins, mov) => updateInsumo(ins.id, { movs: [{ ts: Date.now(), por: usuarioActual.nombre, ...mov }, ...(ins.movs || [])].slice(0, 40) });

  const categorias = useMemo(() => {
    const usadas = insumos.map((i) => t(i.categoria)).filter(Boolean);
    return Array.from(new Set([...CATEGORIAS, ...usadas]));
  }, [insumos]);
  const categoriasEnUso = useMemo(() => Array.from(new Set(insumos.map((i) => t(i.categoria)).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [insumos]);

  /* Resumen */
  const valorTotal = insumos.reduce((a, i) => a + (Number(i.stock) || 0) * (Number(i.costo) || 0), 0);
  const nAlertas = insumos.filter((i) => estadoStock(i) !== "ok").length;
  const nVencen = insumos.filter((i) => estadoVence(i)).length;
  const porComprar = insumos.filter(necesitaCompra).map((i) => ({ ins: i, cant: cantidadSugerida(i) })).filter((r) => r.cant > 0);

  /* Lista visible: buscar + filtrar + ordenar */
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let l = insumos.filter((i) => {
      if (q && ![i.nombre, i.categoria, i.proveedor, i.ubicacion, i.codigo].some((c) => t(c).toLowerCase().includes(q))) return false;
      if (filtro === "alertas") return estadoStock(i) !== "ok";
      if (filtro === "vencen") return !!estadoVence(i);
      if (filtro.startsWith("categoria:")) return t(i.categoria) === filtro.slice(10);
      return true;
    });
    const urg = { agotado: 0, bajo: 1, ok: 2 };
    const valor = (i) => (Number(i.stock) || 0) * (Number(i.costo) || 0);
    l = l.slice().sort((a, b) => {
      if (orden === "nombre") return a.nombre.localeCompare(b.nombre);
      if (orden === "categoria") return t(a.categoria).localeCompare(t(b.categoria)) || a.nombre.localeCompare(b.nombre);
      if (orden === "valor") return valor(b) - valor(a);
      const va = estadoVence(a) ? -1 : 0, vb = estadoVence(b) ? -1 : 0;
      return urg[estadoStock(a)] - urg[estadoStock(b)] || va - vb || a.nombre.localeCompare(b.nombre);
    });
    return l;
  }, [insumos, busca, filtro, orden]);

  /* Acciones */
  const crear = async () => {
    if (!form.nombre.trim() || ocupado) return;
    setOcupado(true);
    const u = unidadDe(form);
    const stock = num(form.stock);
    const pres = t(form.presN) && num(form.presC) > 0 ? { n: t(form.presN), c: num(form.presC) } : undefined;
    const ins = {
      id: uid(), nombre: form.nombre.trim(), unidad: u, stock, minimo: num(form.minimo), costo: num(form.costo),
      ...(t(form.categoria) ? { categoria: t(form.categoria) } : {}), ...(num(form.ideal) > 0 ? { ideal: num(form.ideal) } : {}),
      ...(t(form.proveedor) ? { proveedor: t(form.proveedor) } : {}), ...(t(form.ubicacion) ? { ubicacion: t(form.ubicacion) } : {}),
      ...(t(form.codigo) ? { codigo: t(form.codigo) } : {}), ...(form.vence ? { vence: form.vence } : {}), ...(t(form.nota) ? { nota: t(form.nota) } : {}),
      ...(pres ? { pres } : {}),
      ...(stock > 0 ? { movs: [{ ts: Date.now(), por: usuarioActual.nombre, tipo: "inicial", cant: stock, saldo: stock }] } : {}),
    };
    await saveInsumo(ins);
    registrar(`Inventario: creó "${ins.nombre}" con ${fmtNum(stock)} ${u}`);
    setForm(formVacio()); setCreando(false); setOcupado(false); vibrar(14);
  };

  const guardarEdicion = async (ins) => {
    if (!accion.f.nombre.trim() || ocupado) return;
    setOcupado(true);
    const f = accion.f; const u = unidadDe(f);
    const pres = t(f.presN) && num(f.presC) > 0 ? { n: t(f.presN), c: num(f.presC) } : null;
    await updateInsumo(ins.id, {
      nombre: f.nombre.trim(), unidad: u, minimo: num(f.minimo), costo: num(f.costo), ideal: num(f.ideal),
      categoria: t(f.categoria), proveedor: t(f.proveedor), ubicacion: t(f.ubicacion), codigo: t(f.codigo), vence: f.vence || "", nota: t(f.nota), pres,
    });
    registrar(`Inventario: editó "${f.nombre.trim()}"`);
    setAccion(null); setOcupado(false); vibrar(14);
  };

  const confirmarMovimiento = async (ins) => {
    const a = accion; const stock = Number(ins.stock) || 0;
    if (a.tipo === "entrada") {
      const factor = a.enPres && ins.pres ? ins.pres.c : 1;
      const c = num(a.valor) * factor;
      if (c <= 0) return;
      await ajustarInventario({ [ins.id]: c });
      const parcial = {};
      if (num(a.costoNuevo) > 0) parcial.costo = num(a.costoNuevo);
      if (a.vence) parcial.vence = a.vence;
      if (Object.keys(parcial).length) await updateInsumo(ins.id, parcial);
      await asentar(ins, { tipo: "entrada", cant: c, saldo: stock + c, ...(t(a.nota) ? { nota: t(a.nota) } : {}) });
      registrar(`Inventario: entrada de ${fmtNum(c)} ${ins.unidad} de "${ins.nombre}"`);
    } else if (a.tipo === "salida") {
      const c = num(a.valor);
      if (c <= 0) return;
      await ajustarInventario({ [ins.id]: -c });
      await asentar(ins, { tipo: "salida", cant: -c, saldo: stock - c, motivo: a.motivo, ...(t(a.nota) ? { nota: t(a.nota) } : {}) });
      registrar(`Inventario: salida de ${fmtNum(c)} ${ins.unidad} de "${ins.nombre}" (${a.motivo})`);
    } else if (a.tipo === "conteo") {
      if (a.valor === "" || a.valor === undefined) return;
      const nuevo = num(a.valor); const dif = nuevo - stock;
      if (dif !== 0) await ajustarInventario({ [ins.id]: dif });
      await asentar(ins, { tipo: "conteo", cant: dif, saldo: nuevo });
      registrar(`Inventario: conteo de "${ins.nombre}" → ${fmtNum(nuevo)} ${ins.unidad} (antes ${fmtNum(stock)})`);
    }
    setAccion(null); vibrar(14);
  };

  /* Lista de compras: texto para copiar o mandar por WhatsApp, agrupado por proveedor */
  const textoCompras = () => {
    const grupos = {};
    porComprar.forEach((r) => { const p = t(r.ins.proveedor) || "Sin proveedor"; (grupos[p] = grupos[p] || []).push(r); });
    const lineas = [`Lista de compras${config.businessName ? " — " + config.businessName : ""} (${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long" })})`];
    Object.keys(grupos).sort().forEach((p) => {
      lineas.push("", p.toUpperCase());
      grupos[p].forEach(({ ins, cant }) => {
        const pr = ins.pres && ins.pres.c > 0 ? ` (≈ ${fmtNum(Math.ceil(cant / ins.pres.c))} ${t(ins.pres.n).toLowerCase() || "caja"})` : "";
        lineas.push(`• ${ins.nombre}: ${fmtNum(cant)} ${ins.unidad}${pr}`);
      });
    });
    return lineas.join("\n");
  };
  const copiarCompras = async () => {
    try { await navigator.clipboard.writeText(textoCompras()); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch (e) { window.prompt("Copia la lista:", textoCompras()); }
  };
  const mandarWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(textoCompras())}`, "_blank", "noopener");

  const filtros = [["todos", "Todos"], ["alertas", `Alertas${nAlertas ? ` (${nAlertas})` : ""}`], ["vencen", `Por vencer${nVencen ? ` (${nVencen})` : ""}`]];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 28px", display: "flex", flexDirection: "column", gap: 12, color: K.ink }}>
      {/* Resumen */}
      {insumos.length > 0 && (
        <div style={s.resumen}>
          <div style={s.resumenItem}><span style={s.resumenNum}>{insumos.length}</span><span style={s.resumenLbl}>Artículos</span></div>
          <div style={s.resumenItem}><span style={s.resumenNum}>{money(valorTotal)}</span><span style={s.resumenLbl}>Valor en stock</span></div>
          <div style={s.resumenItem}><span style={{ ...s.resumenNum, color: nAlertas + nVencen > 0 ? "var(--c-b98a2e-t)" : K.ink }}>{nAlertas + nVencen}</span><span style={s.resumenLbl}>Alertas</span></div>
        </div>
      )}

      {/* Acciones principales */}
      {!creando && (
        <div style={x.row}>
          <button style={{ ...x.btnDark, flex: 1 }} onClick={() => { setCreando(true); setAccion(null); }}><Plus size={15} /> Nuevo artículo</button>
          <button style={{ ...x.btnGhost, position: "relative" }} onClick={() => setVerCompras(!verCompras)} aria-label="Lista de compras">
            <ShoppingCart size={16} /> Compras
            {porComprar.length > 0 && <span style={s.badge}>{porComprar.length}</span>}
          </button>
          {tieneRol(usuarioActual, "admin") && insumos.length > 0 && (
            <button style={x.btnGhost} onClick={() => imprimir(<HojaInventario insumos={insumos} config={config} usuario={usuarioActual} />)} aria-label="Imprimir inventario" title="Imprimir inventario"><Printer size={16} /></button>
          )}
        </div>
      )}

      {/* Lista de compras */}
      {verCompras && !creando && (
        <div style={x.card} className="anim-in">
          <div style={{ ...x.row, justifyContent: "space-between" }}>
            <div style={x.eyebrow}>Lista de compras sugerida</div>
            <button style={x.btnIcon} onClick={() => setVerCompras(false)} aria-label="Cerrar"><X size={15} /></button>
          </div>
          {porComprar.length === 0 ? (
            <div style={x.hint}>Todo está por encima del mínimo. Cuando algo se agote o baje del mínimo aparece aquí con la cantidad sugerida.</div>
          ) : (
            <>
              {porComprar.map(({ ins, cant }) => (
                <div key={ins.id} style={{ ...x.row, justifyContent: "space-between", fontSize: 13.5 }}>
                  <span style={{ fontWeight: 600 }}>{ins.nombre}{ins.proveedor ? <span style={{ ...x.hint, marginLeft: 6 }}>{ins.proveedor}</span> : null}</span>
                  <span style={{ fontWeight: 700 }}>{fmtNum(cant)} {ins.unidad}</span>
                </div>
              ))}
              <div style={x.row}>
                <button style={{ ...x.btnSmall, flex: 1, justifyContent: "center" }} onClick={copiarCompras}>{copiado ? <><Check size={13} /> Copiada</> : <><Copy size={13} /> Copiar</>}</button>
                <button style={{ ...x.btnSmall, flex: 1, justifyContent: "center" }} onClick={mandarWhatsApp}><Share2 size={13} /> WhatsApp</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Crear */}
      {creando && (
        <FormInsumo v={form} set={setForm} categorias={categorias} nuevo ocupado={ocupado} textoGuardar="Guardar artículo"
          onCancel={() => { setCreando(false); setForm(formVacio()); }} onGuardar={crear} />
      )}

      {/* Buscar y filtrar */}
      {insumos.length > 0 && !creando && (
        <>
          <div style={s.buscador}>
            <Search size={16} color="var(--c-8a8272-t)" />
            <input style={s.buscadorInput} placeholder="Buscar por nombre, categoría, proveedor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {busca && <button style={s.buscadorX} onClick={() => setBusca("")} aria-label="Borrar búsqueda"><X size={14} /></button>}
          </div>
          <div style={s.chips}>
            {filtros.map(([id, label]) => <button key={id} style={{ ...s.chip, ...(filtro === id ? s.chipOn : {}) }} onClick={() => setFiltro(id)}>{label}</button>)}
            {categoriasEnUso.map((c) => <button key={c} style={{ ...s.chip, ...(filtro === "categoria:" + c ? s.chipOn : {}) }} onClick={() => setFiltro(filtro === "categoria:" + c ? "todos" : "categoria:" + c)}>{c}</button>)}
          </div>
          <div style={{ ...x.row, justifyContent: "space-between" }}>
            <span style={x.hint}>{lista.length} de {insumos.length}</span>
            <select style={{ ...x.select, padding: "6px 8px", fontSize: 12.5 }} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
              <option value="urgencia">Más urgentes primero</option>
              <option value="nombre">Nombre (A–Z)</option>
              <option value="categoria">Categoría</option>
              <option value="valor">Mayor valor</option>
            </select>
          </div>
        </>
      )}

      {insumos.length === 0 && !creando && (
        <EmptyState icon={Boxes} titulo="Aún no hay artículos" texto="Registra lo que tienes: ingredientes, bebidas, empaques, limpieza, utensilios… Los que uses en recetas descuentan solos con cada pedido; el resto los controlas con entradas, salidas y conteos." />
      )}
      {insumos.length > 0 && lista.length === 0 && !creando && (
        <div style={{ ...x.hint, textAlign: "center", padding: 18 }}>Nada coincide con tu búsqueda o filtro.</div>
      )}

      {/* Tarjetas */}
      {!creando && <div className="rejilla-auto">{lista.map((ins) => {
        const est = estadoStock(ins); const meta = META_STOCK[est];
        const ev = estadoVence(ins);
        const stock = Number(ins.stock) || 0;
        const techo = Math.max(Number(ins.ideal) || 0, (Number(ins.minimo) || 0) * 3, stock, 1);
        const pct = Math.max(0, Math.min(100, (stock / techo) * 100));
        const a = accion && accion.id === ins.id ? accion : null;
        const detalles = [ins.proveedor && [Truck, ins.proveedor], ins.ubicacion && [MapPin, ins.ubicacion]].filter(Boolean);
        return (
          <div key={ins.id} style={x.invCard} className="anim-in">
            <div style={{ ...x.row, justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{ins.nombre}</div>
                {ins.categoria && <span style={s.catTag}>{ins.categoria}</span>}
                <div style={x.hint}>
                  Mínimo {fmtNum(ins.minimo)} {ins.unidad}{ins.ideal ? ` · ideal ${fmtNum(ins.ideal)}` : ""}{ins.costo ? ` · ${money(ins.costo)} c/u` : ""}{ins.costo && stock > 0 ? ` · vale ${money(stock * ins.costo)}` : ""}
                </div>
                {detalles.length > 0 && (
                  <div style={{ ...x.hint, display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                    {detalles.map(([Ico, txt], i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Ico size={11} /> {txt}</span>)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={x.invStock}>{fmtNum(ins.stock)} <span style={{ fontSize: 13, fontWeight: 600, color: K.muted, fontFamily: "var(--font-body)" }}>{ins.unidad}</span></div>
                <span style={{ ...x.pill, background: meta.bg, color: meta.c }}>{meta.t}</span>
              </div>
            </div>
            <div style={x.bar}><div style={{ width: `${pct}%`, height: "100%", background: meta.bar, transition: "width .4s ease" }} /></div>
            {ev && (
              <div style={{ ...s.venceAviso, ...(ev.k === "vencido" ? s.venceRojo : s.venceAmbar) }}>
                <CalendarClock size={13} /> {ev.k === "vencido" ? `Venció el ${venceCorta(ins.vence)}` : ev.d === 0 ? "Vence hoy" : `Vence en ${ev.d} ${ev.d === 1 ? "día" : "días"} (${venceCorta(ins.vence)})`}
              </div>
            )}

            {!a && confirmDel !== ins.id && (
              <div style={{ ...x.row, flexWrap: "wrap" }}>
                <button style={x.btnSmall} onClick={() => setAccion({ id: ins.id, tipo: "entrada", valor: "", enPres: false, costoNuevo: "", vence: "", nota: "" })}><Plus size={13} /> Entrada</button>
                <button style={x.btnSmall} onClick={() => setAccion({ id: ins.id, tipo: "salida", valor: "", motivo: MOTIVOS_SALIDA[0], nota: "" })}><Minus size={13} /> Salida</button>
                <button style={x.btnSmall} onClick={() => setAccion({ id: ins.id, tipo: "conteo", valor: "" })}><Check size={13} /> Contar</button>
                <button style={x.btnSmall} onClick={() => setAccion({ id: ins.id, tipo: "editar", f: formDe(ins) })}><Pencil size={13} /> Editar</button>
                <button style={x.btnIcon} onClick={() => setAccion({ id: ins.id, tipo: "historial" })} aria-label="Historial"><History size={14} /></button>
                <button style={{ ...x.btnDanger, marginLeft: "auto" }} onClick={() => setConfirmDel(ins.id)} aria-label="Eliminar"><Trash2 size={14} /></button>
              </div>
            )}
            {confirmDel === ins.id && (
              <div style={{ ...x.row, justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: K.red, fontWeight: 600 }}>¿Eliminar este artículo?</span>
                <div style={x.row}>
                  <button style={x.btnSmall} onClick={() => setConfirmDel(null)}>No</button>
                  <button style={{ ...x.btnSmall, background: "var(--danger-solid)", color: "#FFFFFF", border: "none" }} onClick={async () => { await deleteInsumo(ins.id); registrar(`Inventario: eliminó "${ins.nombre}"`); setConfirmDel(null); }}>Sí, eliminar</button>
                </div>
              </div>
            )}

            {/* Entrada */}
            {a && a.tipo === "entrada" && (
              <div style={s.panelAccion}>
                <div style={x.hint}>¿Cuánto llegó? Se suma al stock.</div>
                {ins.pres && ins.pres.c > 0 && (
                  <div style={x.segmented}>
                    <button style={{ ...x.segBtn, ...(!a.enPres ? s.segOn : {}) }} onClick={() => setAccion({ ...a, enPres: false })}>En {ins.unidad}</button>
                    <button style={{ ...x.segBtn, ...(a.enPres ? s.segOn : {}) }} onClick={() => setAccion({ ...a, enPres: true })}>En {t(ins.pres.n).toLowerCase() || "cajas"} (×{fmtNum(ins.pres.c)})</button>
                  </div>
                )}
                <CampoNumero style={x.input} placeholder={a.enPres ? `Cantidad de ${t(ins.pres.n).toLowerCase() || "cajas"}` : "Cantidad que llegó"} value={a.valor} onChange={(v) => setAccion({ ...a, valor: v })} />
                {a.enPres && num(a.valor) > 0 && <div style={x.hint}>= {fmtNum(num(a.valor) * ins.pres.c)} {ins.unidad}</div>}
                <div style={x.row}>
                  <CampoPesos style={{ ...x.input, flex: 1 }} placeholder={`Costo nuevo por ${ins.unidad} (opcional)`} value={a.costoNuevo} onChange={(v) => setAccion({ ...a, costoNuevo: v })} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={x.hint}>Vence el (opcional)</span>
                    <input style={x.input} type="date" min={hoyISO()} value={a.vence} onChange={(e) => setAccion({ ...a, vence: e.target.value })} />
                  </div>
                </div>
                <input style={x.input} placeholder="Nota (factura, proveedor…)" value={a.nota} onChange={(e) => setAccion({ ...a, nota: e.target.value })} />
                <div style={x.row}>
                  <button style={{ ...x.btnGhost, flex: 1 }} onClick={() => setAccion(null)}>Cancelar</button>
                  <button style={{ ...x.btnDark, flex: 2 }} onClick={() => confirmarMovimiento(ins)}><Check size={14} /> Registrar entrada</button>
                </div>
              </div>
            )}

            {/* Salida / merma */}
            {a && a.tipo === "salida" && (
              <div style={s.panelAccion}>
                <div style={x.hint}>¿Cuánto sale del stock? (merma, daño, consumo interno…)</div>
                <CampoNumero style={x.input} placeholder={`Cantidad en ${ins.unidad}`} value={a.valor} onChange={(v) => setAccion({ ...a, valor: v })} />
                <div style={s.chips}>
                  {MOTIVOS_SALIDA.map((m) => <button key={m} style={{ ...s.chip, ...(a.motivo === m ? s.chipOn : {}) }} onClick={() => setAccion({ ...a, motivo: m })}>{m}</button>)}
                </div>
                <input style={x.input} placeholder="Nota (opcional)" value={a.nota} onChange={(e) => setAccion({ ...a, nota: e.target.value })} />
                <div style={x.row}>
                  <button style={{ ...x.btnGhost, flex: 1 }} onClick={() => setAccion(null)}>Cancelar</button>
                  <button style={{ ...x.btnDark, flex: 2 }} onClick={() => confirmarMovimiento(ins)}><PackageMinus size={14} /> Registrar salida</button>
                </div>
              </div>
            )}

            {/* Conteo */}
            {a && a.tipo === "conteo" && (
              <div style={s.panelAccion}>
                <div style={x.hint}>¿Cuánto hay realmente ahora? Reemplaza el stock (en {ins.unidad}).</div>
                <div style={x.row}>
                  <CampoNumero style={{ ...x.input, flex: 1 }} placeholder="Cantidad contada" value={a.valor} onChange={(v) => setAccion({ ...a, valor: v })} />
                  <button style={x.btnGhost} onClick={() => setAccion(null)}>Cancelar</button>
                  <button style={{ ...x.btnDark, width: "auto" }} onClick={() => confirmarMovimiento(ins)}><Check size={14} /> Listo</button>
                </div>
              </div>
            )}

            {/* Editar */}
            {a && a.tipo === "editar" && (
              <FormInsumo v={a.f} set={(f) => setAccion({ ...a, f })} categorias={categorias} ocupado={ocupado} textoGuardar="Guardar cambios"
                onCancel={() => setAccion(null)} onGuardar={() => guardarEdicion(ins)} />
            )}

            {/* Historial */}
            {a && a.tipo === "historial" && (
              <div style={s.panelAccion}>
                <div style={{ ...x.row, justifyContent: "space-between" }}>
                  <div style={x.eyebrow}>Historial</div>
                  <button style={x.btnIcon} onClick={() => setAccion(null)} aria-label="Cerrar"><X size={15} /></button>
                </div>
                {(ins.movs || []).length === 0 ? (
                  <div style={x.hint}>Todavía no hay movimientos a mano. Aquí se anotan las entradas, salidas, mermas y conteos. Lo que descuentan los pedidos no se lista (es automático).</div>
                ) : (ins.movs || []).map((m, i) => (
                  <div key={i} style={s.movFila}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{{ inicial: "Stock inicial", entrada: "Entrada", salida: "Salida", conteo: "Conteo" }[m.tipo] || "Movimiento"}{m.motivo ? ` · ${m.motivo}` : ""}</div>
                      <div style={x.hint}>{fechaCorta(m.ts)} · {m.por}{m.nota ? ` · ${m.nota}` : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: m.cant < 0 ? "var(--c-c1442d-t)" : "var(--c-5b7553-t)" }}>{m.cant > 0 ? "+" : ""}{fmtNum(m.cant)}</div>
                      <div style={x.hint}>quedó {fmtNum(m.saldo)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}</div>}
    </div>
  );
}

/* ───────── hoja impresa: inventario valorizado, hoja de conteo y lista de compras ───────── */
function HojaInventario({ insumos, config, usuario }) {
  const valor = (i) => (Number(i.stock) || 0) * (Number(i.costo) || 0);
  const total = insumos.reduce((a, i) => a + valor(i), 0);
  const agotados = insumos.filter((i) => estadoStock(i) === "agotado").length;
  const bajos = insumos.filter((i) => estadoStock(i) === "bajo").length;
  const vencen = insumos.filter((i) => estadoVence(i)).length;
  const compras = insumos.filter(necesitaCompra).map((i) => ({ ins: i, cant: cantidadSugerida(i) })).filter((r) => r.cant > 0);

  const porCategoria = {};
  insumos.forEach((i) => { const c = t(i.categoria) || "Sin categoría"; (porCategoria[c] = porCategoria[c] || []).push(i); });
  const categorias = Object.keys(porCategoria).sort((a, b) => (a === "Sin categoría") - (b === "Sin categoría") || a.localeCompare(b));
  const textoEstado = (i) => {
    const ev = estadoVence(i); const e = estadoStock(i);
    return [e === "agotado" ? "Agotado" : e === "bajo" ? "Por agotarse" : "OK", ev ? (ev.k === "vencido" ? "VENCIDO" : `vence en ${ev.d} d`) : null].filter(Boolean).join(" · ");
  };

  const grupos = {};
  compras.forEach((r) => { const p = t(r.ins.proveedor) || "Sin proveedor"; (grupos[p] = grupos[p] || []).push(r); });
  const proveedores = Object.keys(grupos).sort((a, b) => (a === "Sin proveedor") - (b === "Sin proveedor") || a.localeCompare(b));
  const costoCompra = (r) => r.cant * (Number(r.ins.costo) || 0);
  const totalCompra = compras.reduce((a, r) => a + costoCompra(r), 0);

  return (
    <Hoja config={config} usuario={usuario} titulo="Inventario" subtitulo={`${insumos.length} artículos · valor en stock ${money(total)}`}>
      <Kpis items={[
        { t: "Valor en stock", v: money(total) },
        { t: "Artículos", v: String(insumos.length), s: `${categorias.length} ${categorias.length === 1 ? "categoría" : "categorías"}` },
        { t: "Agotados", v: String(agotados) },
        { t: "Por agotarse", v: String(bajos) },
        { t: "Vencidos o por vencer", v: String(vencen) },
        { t: "Por comprar", v: String(compras.length), s: compras.length ? `≈ ${money(totalCompra)}` : undefined },
      ]} />
      {categorias.map((cat) => {
        const lista = porCategoria[cat].slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
        const sub = lista.reduce((a, i) => a + valor(i), 0);
        return (
          <Seccion key={cat} titulo={`${cat} · ${lista.length}`} nota={`Valor de la categoría: ${money(sub)}. La última columna es para anotar el conteo físico a mano.`}>
            <Tabla
              cols={[
                { t: "Artículo", v: (i) => <span><b>{i.nombre}</b>{i.codigo ? <span style={{ color: "#666" }}> · {i.codigo}</span> : null}{(i.proveedor || i.ubicacion) ? <div style={{ fontSize: "8pt", color: "#666" }}>{[i.proveedor, i.ubicacion].filter(Boolean).join(" · ")}</div> : null}</span> },
                { t: "Stock", d: true, v: (i) => `${fmtNum(i.stock)} ${i.unidad}` },
                { t: "Mín.", d: true, v: (i) => (i.minimo ? fmtNum(i.minimo) : "—") },
                { t: "Costo", d: true, v: (i) => (i.costo ? money(i.costo) : "—") },
                { t: "Valor", d: true, v: (i) => (valor(i) ? money(valor(i)) : "—") },
                { t: "Vence", d: true, v: (i) => (i.vence ? venceCorta(i.vence) : "—") },
                { t: "Estado", v: (i) => textoEstado(i) },
                { t: "Conteo", w: "13%", v: () => <span style={{ display: "block", borderBottom: "1px solid #777", height: "14px" }} /> },
              ]}
              filas={lista} pie={["Subtotal", "", "", "", money(sub), "", "", ""]}
            />
          </Seccion>
        );
      })}

      <Seccion titulo="Lista de compras sugerida" salto nota="Se sugiere pedir hasta el stock ideal (o el doble del mínimo si no hay ideal). El costo es estimado con el último costo registrado.">
        {proveedores.length === 0 ? <div className="imp-vacio">No hay nada por comprar: todo está por encima del mínimo.</div> : proveedores.map((p) => (
          <div key={p} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: "10pt", margin: "4px 0" }}>{p}</div>
            <Tabla
              cols={[
                { t: "Artículo", v: (r) => r.ins.nombre },
                { t: "Hay", d: true, v: (r) => `${fmtNum(r.ins.stock)} ${r.ins.unidad}` },
                { t: "Pedir", d: true, v: (r) => `${fmtNum(r.cant)} ${r.ins.unidad}${r.ins.pres && r.ins.pres.c > 0 ? ` (≈ ${fmtNum(Math.ceil(r.cant / r.ins.pres.c))} ${t(r.ins.pres.n).toLowerCase() || "caja"})` : ""}` },
                { t: "Costo est.", d: true, v: (r) => (costoCompra(r) ? money(costoCompra(r)) : "—") },
              ]}
              filas={grupos[p]} pie={["Subtotal", "", "", money(grupos[p].reduce((a, r) => a + costoCompra(r), 0))]}
            />
          </div>
        ))}
        {proveedores.length > 0 && <div style={{ textAlign: "right", fontWeight: 800, fontSize: "11pt" }}>Total estimado: {money(totalCompra)}</div>}
      </Seccion>
      <Firmas etiquetas={["Contó", "Revisó (administración)"]} nombres={[usuario && usuario.nombre, ""]} />
    </Hoja>
  );
}

const s = {
  resumen: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, overflow: "hidden" },
  resumenItem: { display: "flex", flexDirection: "column", gap: 2, padding: "12px 12px", borderRight: `1px solid ${K.border}`, minWidth: 0 },
  resumenNum: { fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: K.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  resumenLbl: { fontSize: 11.5, color: K.muted },
  badge: { position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, background: "var(--warn-solid)", color: "#FFFFFF", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" },
  buscador: { display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderRadius: 12, border: `1px solid ${K.border}`, background: K.surface },
  buscadorInput: { flex: 1, minWidth: 0, padding: "12px 0", border: "none", outline: "none", background: "transparent", color: K.ink, fontSize: 14, fontFamily: "var(--font-body)" },
  buscadorX: { width: 24, height: 24, borderRadius: 12, border: "none", background: K.soft, color: K.sub, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  chips: { display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2, flexWrap: "wrap" },
  chip: { padding: "6px 12px", borderRadius: 999, border: `1px solid ${K.border}`, background: "transparent", color: K.sub, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  chipOn: { background: "var(--seg-on-bg)", color: "var(--seg-on-fg)", borderColor: "var(--seg-on-bg)" },
  catTag: { display: "inline-block", margin: "3px 0 2px", padding: "2px 8px", borderRadius: 8, background: K.soft, color: K.sub, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3 },
  venceAviso: { display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600 },
  venceRojo: { background: "var(--c-fbe2dc-b)", color: "var(--c-8a3a2b-t)" },
  venceAmbar: { background: "var(--c-fbefd9-b)", color: "var(--c-8a611a-t)" },
  panelAccion: { display: "flex", flexDirection: "column", gap: 8 },
  segOn: { background: "var(--seg-on-bg)", color: "var(--seg-on-fg)" },
  movFila: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${K.border}` },
};

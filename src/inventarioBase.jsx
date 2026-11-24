import { useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { UNIDADES, estadoStock } from "./logica.js";
import { K, x, CampoNumero, CampoPesos } from "./extras.jsx";
import { Selector, CampoFecha } from "./componentes/Campos.jsx";

export const CATEGORIAS = ["Ingredientes", "Bebidas", "Empaques y desechables", "Limpieza", "Barra y café", "Utensilios y equipos", "Otros"];
export const MOTIVOS_SALIDA = ["Merma / vencido", "Derrame o daño", "Consumo interno", "Cortesía", "Otro"];
export const DIAS_AVISO_VENCE = 7;
export const SINGULAR = { unidades: "unidad", porciones: "porción", paquetes: "paquete", cajas: "caja", bolsas: "bolsa", botellas: "botella", latas: "lata", docenas: "docena", rollos: "rollo", frascos: "frasco" };
export const unidadSing = (u) => SINGULAR[u] || u;
/** Campo con su nombre SIEMPRE visible (los textos de ayuda dentro del campo se cortan y desaparecen al escribir). */
export function Campo({ et, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: K.sub }}>{et}</span>
      {children}
    </label>
  );
}
export const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
export const t = (v) => (v === undefined || v === null ? "" : String(v).trim());

/* ───────── fechas ───────── */
export const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export function diasParaVencer(vence) {
  if (!vence) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(`${vence}T00:00:00`);
  if (Number.isNaN(f.getTime())) return null;
  return Math.round((f - hoy) / 86400000);
}
export const fechaCorta = (ts) => new Date(ts).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const venceCorta = (v) => new Date(`${v}T00:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

/* ───────── estado de un insumo ───────── */
export function estadoVence(ins) {
  const d = diasParaVencer(ins.vence);
  if (d === null) return null;
  if (d < 0) return { k: "vencido", d };
  if (d <= DIAS_AVISO_VENCE) return { k: "pronto", d };
  return null;
}
export const META_STOCK = {
  agotado: { t: "AGOTADO", bg: "var(--c-fbe2dc-b)", c: "var(--c-8a3a2b-t)", bar: "var(--danger-solid)" },
  bajo: { t: "POR AGOTARSE", bg: "var(--c-fbefd9-b)", c: "var(--c-8a611a-t)", bar: "var(--warn-solid)" },
  ok: { t: "OK", bg: "var(--c-e4eee1-b)", c: "var(--c-5b7553-t)", bar: "var(--ok-solid)" },
};
// Cuánto conviene pedir: hasta el "ideal" (o el doble del mínimo si no hay ideal), redondeado hacia arriba.
export function cantidadSugerida(ins) {
  const s = Number(ins.stock) || 0;
  const meta = Number(ins.ideal) > 0 ? Number(ins.ideal) : (Number(ins.minimo) || 0) * 2;
  const falta = Math.max(0, meta - s);
  return falta > 0 ? Math.ceil(falta * 100) / 100 : 0;
}
export const necesitaCompra = (ins) => estadoStock(ins) !== "ok" || (Number(ins.ideal) > 0 && (Number(ins.stock) || 0) < Number(ins.ideal) * 0.5);

/* ───────── formulario (crear / editar) — componente de nivel superior para no perder el foco al escribir ───────── */
export const formVacio = () => ({
  nombre: "", categoria: "", unidadSel: "unidades", unidadOtra: "", stock: "", minimo: "", ideal: "", costo: "",
  proveedor: "", ubicacion: "", codigo: "", vence: "", presN: "", presC: "", nota: "",
});
export const formDe = (i) => ({
  nombre: i.nombre || "", categoria: i.categoria || "",
  unidadSel: UNIDADES.includes(i.unidad) ? i.unidad : "__otra", unidadOtra: UNIDADES.includes(i.unidad) ? "" : (i.unidad || ""),
  stock: "", minimo: i.minimo ? String(i.minimo) : "", ideal: i.ideal ? String(i.ideal) : "", costo: i.costo ? String(i.costo) : "",
  proveedor: i.proveedor || "", ubicacion: i.ubicacion || "", codigo: i.codigo || "", vence: i.vence || "",
  presN: i.pres ? i.pres.n || "" : "", presC: i.pres && i.pres.c ? String(i.pres.c) : "", nota: i.nota || "",
});
export const unidadDe = (f) => (f.unidadSel === "__otra" ? t(f.unidadOtra) || "unidades" : f.unidadSel);

export function FormInsumo({ v, set, categorias, nuevo, ocupado, onCancel, onGuardar, textoGuardar }) {
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
        <Campo et="Se mide en">
          <Selector value={v.unidadSel} onChange={(u) => set({ ...v, unidadSel: u })} titulo="Se mide en"
            opciones={[...UNIDADES.map((o) => ({ valor: o, etiqueta: o })), { valor: "__otra", etiqueta: "otra unidad" }]} />
        </Campo>
        {nuevo && (
          <Campo et="Cuánto tienes hoy">
            <CampoNumero style={x.input} placeholder="0" value={v.stock} onChange={(val) => set({ ...v, stock: val })} />
          </Campo>
        )}
      </div>
      {v.unidadSel === "__otra" && <input style={x.input} placeholder="¿Cuál unidad? (ej: sobres, galones, bandejas)" value={v.unidadOtra} onChange={(e) => set({ ...v, unidadOtra: e.target.value })} />}

      <div style={x.row}>
        <Campo et="Mínimo (avisar si baja de)">
          <CampoNumero style={x.input} placeholder="0" value={v.minimo} onChange={(val) => set({ ...v, minimo: val })} />
        </Campo>
        <Campo et="Ideal (comprar hasta)">
          <CampoNumero style={x.input} placeholder="0" value={v.ideal} onChange={(val) => set({ ...v, ideal: val })} />
        </Campo>
      </div>
      <Campo et={`Costo por ${unidadSing(u)} ($)`}>
        <CampoPesos style={x.input} placeholder="0" value={v.costo} onChange={(val) => set({ ...v, costo: val })} />
      </Campo>
      <div style={x.hint}>
        <b>Mínimo:</b> la app te avisa cuando quede igual o menos que esto. <b>Ideal:</b> cuánto quieres tener al llenar la despensa; la lista de compras te sugiere pedir lo que falte para llegar ahí. Ej.: harina, mínimo 2 kg e ideal 10 kg → con 1 kg te sugiere comprar 9.
      </div>

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
              <CampoFecha opcional placeholder="Sin fecha" titulo="Fecha de vencimiento" value={v.vence} onChange={(k) => set({ ...v, vence: k })} />
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

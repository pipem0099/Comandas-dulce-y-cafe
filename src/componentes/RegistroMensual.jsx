import React, { useMemo, useState } from "react";
import { Trash2, ChevronDown, Lock, CheckSquare } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { Despliegue } from "./Comunes.jsx";
import { agruparPorMes, dateTimeLabel } from "../utilidades.js";

/*
 * Registro agrupado POR MES (no acumulado), con borrado opcional:
 *  · borrar uno solo (icono de papelera) · «Seleccionar» para marcar varios · «Borrar mes» para limpiar un mes completo.
 *  · Los registros con `protegido: true` (las constancias de borrados anteriores) nunca se pueden borrar.
 *  · Antes de borrar siempre se pide confirmar; quien llama a `onBorrar` deja constancia de quién lo hizo.
 * registros: [{ id, ts, quien, texto, protegido }]   onBorrar(ids, descripcion) → Promise<boolean>
 */
const pill = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, padding: "0 12px", borderRadius: 999, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const pillPeligro = { ...pill, color: "var(--c-c1442d-t)" };
const nota = { fontSize: 13, color: "var(--c-5c5648-t)", lineHeight: 1.45 };

function Casilla({ marcada, onChange, etiqueta }) {
  return (
    <button type="button" role="checkbox" aria-checked={marcada} aria-label={etiqueta} onClick={onChange}
      style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, border: marcada ? "none" : "1.5px solid var(--btn2-line)", background: marcada ? "var(--accent)" : "transparent", color: "var(--accent-fg, #fff)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 800 }}>
      {marcada ? "✓" : ""}
    </button>
  );
}

export function RegistroMensual({ registros, puedeBorrar, onBorrar, vacio = "Aún no hay registros.", ocupado = false }) {
  const [seleccionando, setSeleccionando] = useState(false);
  const [marcados, setMarcados] = useState(() => new Set());
  const [cerrados, setCerrados] = useState(() => new Set());   // meses plegados (el más reciente arranca abierto)
  const [confirmar, setConfirmar] = useState(null);             // { ids, texto }
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");

  const meses = useMemo(() => agruparPorMes(registros, (r) => r.ts), [registros]);
  const borrables = (items) => items.filter((r) => !r.protegido).map((r) => r.id);
  const alternar = (id) => setMarcados((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarMes = (items) => setMarcados((prev) => {
    const ids = borrables(items); const todos = ids.length > 0 && ids.every((id) => prev.has(id));
    const n = new Set(prev); ids.forEach((id) => (todos ? n.delete(id) : n.add(id))); return n;
  });
  const salirSeleccion = () => { setSeleccionando(false); setMarcados(new Set()); };
  const plegado = (key, i) => (cerrados.has(key) ? true : cerrados.has("abrir:" + key) ? false : i > 0);
  const plegar = (key, i) => setCerrados((prev) => { const n = new Set(prev); const ya = plegado(key, i); n.delete(key); n.delete("abrir:" + key); n.add(ya ? "abrir:" + key : key); return n; });

  const pedir = (ids, texto) => { if (ids.length === 0) return; setError(""); setConfirmar({ ids, texto }); };
  const ejecutar = async (cerrar) => {
    if (!confirmar || trabajando) return;
    setTrabajando(true); setError("");
    const ok = await onBorrar(confirmar.ids, confirmar.texto);
    setTrabajando(false);
    if (ok) { setMarcados((prev) => { const n = new Set(prev); confirmar.ids.forEach((id) => n.delete(id)); return n; }); cerrar(); setTimeout(() => setConfirmar(null), 340); if (marcados.size <= confirmar.ids.length) setSeleccionando(false); }
    else setError("No se pudo borrar. Revisa tu conexión y que seas administrador, e inténtalo de nuevo.");
  };

  if (registros.length === 0) return <div style={{ ...nota, padding: "10px 0" }}>{vacio}</div>;
  const hayBorrables = registros.some((r) => !r.protegido);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {puedeBorrar && hayBorrables && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={pill} onClick={() => (seleccionando ? salirSeleccion() : setSeleccionando(true))} aria-pressed={seleccionando}>
            <CheckSquare size={15} /> {seleccionando ? "Terminar selección" : "Seleccionar"}
          </button>
          {seleccionando && (
            <>
              <span style={{ ...nota, fontWeight: 600 }}>{marcados.size === 0 ? "Marca los registros que quieres borrar" : `${marcados.size} ${marcados.size === 1 ? "marcado" : "marcados"}`}</span>
              {marcados.size > 0 && (
                <button type="button" style={{ ...pillPeligro, marginLeft: "auto" }} onClick={() => pedir(Array.from(marcados), `${marcados.size} ${marcados.size === 1 ? "registro seleccionado" : "registros seleccionados"}`)}>
                  <Trash2 size={15} /> Borrar {marcados.size}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {meses.map((mes, i) => {
        const cerradoAhora = plegado(mes.key, i);
        const ids = borrables(mes.items);
        const todosMes = ids.length > 0 && ids.every((id) => marcados.has(id));
        return (
          <div key={mes.key} style={{ border: "1px solid var(--c-ede7d8-o)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 6px 12px", background: "var(--btn2-bg)" }}>
              {seleccionando && ids.length > 0 && <Casilla marcada={todosMes} onChange={() => alternarMes(mes.items)} etiqueta={`Marcar todo ${mes.titulo}`} />}
              <button type="button" onClick={() => plegar(mes.key, i)} aria-expanded={!cerradoAhora}
                style={{ flex: 1, minWidth: 0, minHeight: 40, display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", color: "var(--btn2-fg)", font: "inherit", padding: 0 }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{mes.titulo}</span>
                  <span style={{ fontSize: 12, color: "var(--btn2-mute)" }}>{mes.items.length} {mes.items.length === 1 ? "movimiento" : "movimientos"}</span>
                </span>
                <ChevronDown size={17} style={{ marginLeft: "auto", flexShrink: 0, transition: "transform .3s", transform: cerradoAhora ? "none" : "rotate(180deg)" }} />
              </button>
              {puedeBorrar && !seleccionando && ids.length > 0 && (
                <button type="button" style={pillPeligro} onClick={() => pedir(ids, `todo ${mes.titulo} (${ids.length} ${ids.length === 1 ? "registro" : "registros"})`)}>
                  <Trash2 size={14} /> Borrar mes
                </button>
              )}
            </div>
            <Despliegue abierto={!cerradoAhora}>
              <div style={{ padding: "0 12px" }}>
                {mes.items.map((r, j) => (
                  <div key={r.id || j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--c-ede7d8-o)" }}>
                    {seleccionando && (r.protegido ? <Lock size={16} style={{ flexShrink: 0, color: "var(--btn2-mute)" }} aria-label="No se puede borrar" /> : <Casilla marcada={marcados.has(r.id)} onChange={() => alternar(r.id)} etiqueta="Marcar registro" />)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "var(--c-242019-t)", lineHeight: 1.4 }}><b style={{ fontWeight: 600 }}>{r.quien}</b>{r.quien ? " · " : ""}{r.texto}</div>
                      <div style={{ fontSize: 12, color: "var(--c-8a8272-t)", marginTop: 1 }}>{dateTimeLabel(r.ts)}{r.protegido ? " · constancia fija" : ""}</div>
                    </div>
                    {puedeBorrar && !seleccionando && (r.protegido
                      ? <Lock size={15} style={{ flexShrink: 0, color: "var(--btn2-mute)" }} aria-label="No se puede borrar" />
                      : <button type="button" className="toque44" aria-label="Borrar este registro" title="Borrar este registro" onClick={() => pedir([r.id], "1 registro")}
                          style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-mute)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={15} /></button>)}
                  </div>
                ))}
              </div>
            </Despliegue>
          </div>
        );
      })}

      {confirmar && (
        <Hoja onCerrar={() => setConfirmar(null)} ancho={420} gap={12} label="Confirmar borrado" z={320} centro>
          {({ cerrar }) => (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" }}>¿Borrar {confirmar.texto}?</div>
              <div style={nota}>Esto no se puede deshacer. Quedará una constancia fija con tu nombre y la fecha, que no se puede borrar.</div>
              {error && <div role="alert" style={{ fontSize: 13, color: "var(--c-c1442d-t)" }}>{error}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={{ ...pill, flex: 1, justifyContent: "center", minHeight: 46 }} onClick={cerrar} disabled={trabajando}>Cancelar</button>
                <button type="button" style={{ ...pill, flex: 1, justifyContent: "center", minHeight: 46, background: "var(--c-c1442d-t)", color: "#fff", border: "none" }} onClick={() => ejecutar(cerrar)} disabled={trabajando || ocupado}>{trabajando ? "Borrando…" : "Sí, borrar"}</button>
              </div>
            </>
          )}
        </Hoja>
      )}
    </div>
  );
}

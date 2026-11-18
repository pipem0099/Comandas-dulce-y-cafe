import React, { useState } from "react";
import { Hoja } from "./Hoja.jsx";
import { styles } from "../estilos.js";
import { DESTINO_INICIAL, destinoCompleto } from "../pisos.js";
export { DESTINO_INICIAL, destinoCompleto, resumenDestino } from "../pisos.js";

/*
 * Destino de un pedido: el mesero elige a qué estación va (cocina, barra, postres…), en qué piso se prepara
 * y en qué piso se entrega. Vale para todo el pedido; si algún producto va a otro lado se cambia solo ese.
 *   valor = { estacion: "auto" | idEstacion, pisoPrep: "mesa" | idPiso, pisoEntrega: "mesa" | idPiso, porLinea: { [clave]: { estacion?, pisoPrep? } } }
 *   "auto"  = la estación sugerida del producto (según su categoría) · "mesa" = el piso donde está la mesa
 */
const Chip = ({ activo, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={activo}
    style={{ minHeight: 44, padding: "0 16px", borderRadius: 999, border: "1px solid var(--c-e4dfce-o)", fontSize: 14.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
      background: activo ? "var(--chip-on-bg)" : "var(--btn2-bg)", color: activo ? "var(--chip-on-fg)" : "var(--btn2-fg)", borderColor: activo ? "transparent" : "var(--btn2-line)" }}>
    {children}
  </button>
);
const Seccion = ({ titulo, ayuda, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <div><div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: "var(--c-8a8272-t)" }}>{titulo}</div>{ayuda && <div style={{ fontSize: 12.5, color: "var(--c-8a8272-t)", marginTop: 2 }}>{ayuda}</div>}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
  </div>
);

export function DestinoPedido({ valor, estaciones, pisos, nombrePisoMesa, lineas, onGuardar, onCerrar }) {
  const [v, setV] = useState({ ...DESTINO_INICIAL, ...valor, porLinea: { ...(valor.porLinea || {}) } });
  const [detalle, setDetalle] = useState(false);
  const hayEst = estaciones.length > 1, hayPisos = pisos.length > 1;
  const listo = destinoCompleto(v, hayEst, hayPisos);
  const setLinea = (clave, parche) => setV((a) => ({ ...a, porLinea: { ...a.porLinea, [clave]: { ...(a.porLinea[clave] || {}), ...parche } } }));
  const quitarLinea = (clave) => setV((a) => { const p = { ...a.porLinea }; delete p[clave]; return { ...a, porLinea: p }; });
  const nPersonalizadas = Object.keys(v.porLinea).length;

  return (
    <Hoja onCerrar={onCerrar} ancho={480} gap={16} label="¿A dónde va este pedido?">
      {({ cerrar }) => (
        <>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" }}>¿A dónde va este pedido?</div>
          {hayEst && (
            <Seccion titulo="ESTACIÓN" ayuda="Quién lo prepara">
              {estaciones.map((e) => <Chip key={e.id} activo={v.estacion === e.id} onClick={() => setV({ ...v, estacion: e.id })}>{e.nombre}</Chip>)}
              <Chip activo={v.estacion === "auto"} onClick={() => setV({ ...v, estacion: "auto" })}>Según el producto</Chip>
            </Seccion>
          )}
          {hayPisos && (
            <>
              <Seccion titulo="SE PREPARA EN" ayuda="Piso donde está quien lo prepara">
                <Chip activo={v.pisoPrep === "mesa"} onClick={() => setV({ ...v, pisoPrep: "mesa" })}>{nombrePisoMesa ? `${nombrePisoMesa} (esta mesa)` : "Piso de la mesa"}</Chip>
                {pisos.map((p) => <Chip key={p.id} activo={v.pisoPrep === p.id} onClick={() => setV({ ...v, pisoPrep: p.id })}>{p.nombre}</Chip>)}
              </Seccion>
              <Seccion titulo="SE ENTREGA EN" ayuda="Piso donde se lo llevan al cliente">
                <Chip activo={v.pisoEntrega === "mesa"} onClick={() => setV({ ...v, pisoEntrega: "mesa" })}>{nombrePisoMesa ? `${nombrePisoMesa} (esta mesa)` : "Piso de la mesa"}</Chip>
                {pisos.map((p) => <Chip key={p.id} activo={v.pisoEntrega === p.id} onClick={() => setV({ ...v, pisoEntrega: p.id })}>{p.nombre}</Chip>)}
              </Seccion>
            </>
          )}

          {lineas.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" onClick={() => setDetalle((d) => !d)} style={{ minHeight: 44, border: "1px dashed var(--c-d9cfae-o)", borderRadius: 14, background: "transparent", color: "var(--c-5c5648-t)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {detalle ? "Ocultar" : "Un producto va a otro lado…"}{nPersonalizadas > 0 ? ` (${nPersonalizadas} distinto${nPersonalizadas > 1 ? "s" : ""})` : ""}
              </button>
              {detalle && lineas.map((l) => {
                const p = v.porLinea[l.key] || {};
                return (
                  <div key={l.key} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 14, border: "1px solid var(--c-e4dfce-o)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--c-242019-t)" }}>
                      <span>{l.qty}× {l.nombre}</span>
                      {(p.estacion || p.pisoPrep) && <button type="button" onClick={() => quitarLinea(l.key)} style={{ border: "none", background: "transparent", color: "var(--c-2f6690-t)", fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 32 }}>Igual que el resto</button>}
                    </div>
                    {hayEst && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{estaciones.map((e) => <Chip key={e.id} activo={p.estacion === e.id} onClick={() => setLinea(l.key, { estacion: e.id })}>{e.nombre}</Chip>)}</div>}
                    {hayPisos && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{pisos.map((x) => <Chip key={x.id} activo={p.pisoPrep === x.id} onClick={() => setLinea(l.key, { pisoPrep: x.id })}>Prepara {x.nombre}</Chip>)}</div>}
                  </div>
                );
              })}
            </div>
          )}

          <button type="button" disabled={!listo} onClick={() => { onGuardar(v); cerrar(); }} style={{ ...styles.sendBtn, opacity: listo ? 1 : 0.4, minHeight: 50 }}>
            {listo ? "Listo" : "Elige a dónde va"}
          </button>
        </>
      )}
    </Hoja>
  );
}

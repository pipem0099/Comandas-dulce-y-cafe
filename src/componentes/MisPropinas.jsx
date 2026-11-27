import React, { useEffect, useMemo, useState } from "react";
import { Hoja } from "./Hoja.jsx";
import { subscribeShared, subscribeCollectionSince } from "../firebase.js";
import { clasificarPropinas } from "../propinas.js";
import { money } from "../logica.js";
import { dateTimeLabel } from "../utilidades.js";

/* «Mis propinas»: cada persona ve SOLO lo suyo. Lo entregado sale de lo que el administrador marcó al repartir (propinasPersona/{uid});
   lo pendiente se calcula con las cuentas que ella abrió, en turnos ya cerrados y que aún no se han repartido. */
const VENTANA = 35 * 86400000;
const nota = { fontSize: 13, color: "var(--c-5c5648-t)", lineHeight: 1.45 };

export function MisPropinas({ usuarioActual, onCerrar }) {
  const [mias, setMias] = useState({});
  const [candados, setCandados] = useState({});
  const [cuentas, setCuentas] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const uid = usuarioActual && usuarioActual.uid;

  useEffect(() => { if (uid) return subscribeShared(`propinasPersona/${uid}`, {}, setMias); }, [uid]);
  useEffect(() => subscribeShared("propinasPagadas", {}, setCandados), []);
  useEffect(() => {
    const desde = Date.now() - VENTANA;
    const a = subscribeCollectionSince("cuentas", "pagadaTs", desde, setCuentas);
    const b = subscribeCollectionSince("turnos", "aperturaTs", desde - 2 * 86400000, setTurnos);
    return () => { a && a(); b && b(); };
  }, []);

  const lista = useMemo(() => Object.entries(mias || {}).map(([id, v]) => ({ ...v, id })).sort((a, b) => b.ts - a.ts), [mias]);
  const validas = lista.filter((x) => !x.anulado);
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const esteMes = validas.filter((x) => x.ts >= inicioMes).reduce((s, x) => s + x.monto, 0);
  const total = validas.reduce((s, x) => s + x.monto, 0);

  const mias2 = useMemo(() => (cuentas || []).filter((c) => (c.mesero || "") === (usuarioActual.nombre || "")), [cuentas, usuarioActual]);
  const dat = useMemo(() => clasificarPropinas({ cuentas: mias2, turnos, candados, desde: Date.now() - VENTANA }), [mias2, turnos, candados]);

  return (
    <Hoja onCerrar={onCerrar} ancho={460} gap={14} label="Mis propinas" z={300} centro>
      {() => (
        <>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" }}>Mis propinas</div>
            <div style={nota}>Solo tú ves esto. Se actualiza cuando el administrador marca un reparto.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ border: "1px solid var(--c-ede7d8-o)", borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-8a8272-t)" }}>ESTE MES TE ENTREGARON</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--c-5b7553-t)", fontVariantNumeric: "tabular-nums" }}>{money(esteMes)}</div>
            </div>
            <div style={{ border: "1px solid var(--c-ede7d8-o)", borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-8a8272-t)" }}>PENDIENTE DE REPARTIR</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--c-b98a2e-t)", fontVariantNumeric: "tabular-nums" }}>{cuentas === null ? "…" : money(dat.totalPendiente + dat.totalEnCurso)}</div>
            </div>
          </div>
          <div style={nota}>
            <b>Pendiente</b> es la propina de las cuentas que abriste en los últimos 35 días y que aún no se reparten{dat.totalEnCurso > 0 ? ` (${money(dat.totalEnCurso)} es de un turno que sigue abierto)` : ""}. El administrador decide cómo se divide: lo que te toca aparece abajo cuando lo marque como entregado.
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-8a8272-t)", marginBottom: 4 }}>LO QUE TE HAN ENTREGADO{total > 0 ? ` · TOTAL ${money(total)}` : ""}</div>
            {lista.length === 0 ? <div style={nota}>Todavía no te han entregado propinas por este medio.</div> : (
              <div style={{ maxHeight: "34vh", overflowY: "auto" }}>
                {lista.map((x) => (
                  <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--c-ede7d8-o)", opacity: x.anulado ? 0.5 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 600 }}>{dateTimeLabel(x.ts)}{x.anulado ? " · anulado" : ""}</div>
                      <div style={{ color: "var(--c-5c5648-t)", fontSize: 12.5 }}>{x.periodo || "Reparto de propinas"}{x.por ? ` · te las entregó ${x.por}` : ""}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", textDecoration: x.anulado ? "line-through" : "none" }}>{money(x.monto)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Hoja>
  );
}

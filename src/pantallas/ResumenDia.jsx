import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { money } from "../logica.js";
import { dateTimeLabel, timeLabel, movimientosDe, arqueosDe, ventasEnRango, propinasEnRango } from "../utilidades.js";
import { tramosDe } from "../relevoCaja.js";
import { ListaMovimientos } from "./MovimientosCaja.jsx";

/*
 * Resumen del día: lo que se ve al cerrar el turno y al abrir un turno anterior.
 * Está pensado para leerse de arriba hacia abajo sin saber de contabilidad:
 *   1) ¿cuadró o no?  2) efectivo: quién tuvo la caja y cómo le fue  3) tarjeta y transferencia
 *   4) entradas y salidas  5) entregas de caja  6) total vendido del día (al final).
 */
const K = {
  surface: "var(--c-fffdf8-b)", soft: "var(--c-f1ecdd-b)", border: "var(--c-e4dfce-o)", ink: "var(--c-242019-t)",
  sub: "var(--c-5c5648-t)", muted: "var(--c-8a8272-t)", verde: "var(--c-5b7553-t)", rojo: "var(--c-c1442d-t)", ambar: "var(--c-8a611a-t)",
  okBg: "var(--c-e4eee1-b)", malBg: "var(--c-fbe2dc-b)",
};
const r = {
  raiz: { display: "flex", flexDirection: "column", gap: 12, color: K.ink },
  estado: { display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.45 },
  card: { background: K.surface, border: `1px solid ${K.border}`, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 },
  titulo: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.3, color: "#9BA4B0", fontWeight: 700 },
  ayuda: { fontSize: 12, color: K.muted, lineHeight: 1.4, marginBottom: 4 },
  cabTramo: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  nombre: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 },
  etiquetaRes: { fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 10, whiteSpace: "nowrap" },
  linea: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "2px 0" },
  fuerte: { fontWeight: 700, borderTop: `1px dashed ${K.border}`, marginTop: 3, paddingTop: 5 },
  meta: { fontSize: 11.5, color: K.muted, lineHeight: 1.4 },
  aviso: { fontSize: 12, color: K.ambar, background: "var(--c-fbefd9-b)", borderRadius: 8, padding: "6px 9px", marginTop: 4, lineHeight: 1.4 },
};
const dif = (d) => (d === 0 ? { t: "Cuadró ✓", bg: K.okBg, c: K.verde } : d > 0 ? { t: `Sobró ${money(d)}`, bg: "var(--c-fbefd9-b)", c: K.ambar } : { t: `Faltó ${money(Math.abs(d))}`, bg: K.malBg, c: K.rojo });
function L({ k, v, fuerte, color }) {
  return <div style={{ ...r.linea, ...(fuerte ? r.fuerte : {}) }}><span style={{ color: fuerte ? K.ink : K.sub }}>{k}</span><span style={{ fontWeight: fuerte ? 700 : 600, color: color || K.ink }}>{v}</span></div>;
}
const ESTADO_RELEVO = { aceptado: "Recibida", forzado: "Asumida sin entrega", rechazado: "No coincidía (se deshizo)", cancelado: "Cancelada", pendiente: "Pendiente" };

export function ResumenDia({ turno, cuentas }) {
  const tramos = tramosDe(turno);
  const fin = turno.cierreTs || Date.now();
  const relevos = turno.relevos ? Object.values(turno.relevos).sort((a, b) => a.ts - b.ts) : [];
  const movs = movimientosDe(turno);
  const arqueos = arqueosDe(turno);
  const porMetodo = ventasEnRango(cuentas || [], turno.aperturaTs, fin + 1);
  const ventas = {
    efectivo: typeof turno.ventasEfectivo === "number" ? turno.ventasEfectivo : porMetodo.efectivo,
    tarjeta: typeof turno.tarjetaEsperada === "number" ? turno.tarjetaEsperada : porMetodo.tarjeta,
    transferencia: typeof turno.transferenciaEsperada === "number" ? turno.transferenciaEsperada : porMetodo.transferencia,
  };
  const totalVendido = ventas.efectivo + ventas.tarjeta + ventas.transferencia;
  const propinas = typeof turno.propinas === "number" ? turno.propinas : propinasEnRango(cuentas || [], turno.aperturaTs, fin + 1);
  const difEfectivo = tramos.reduce((a, t) => a + (t.diferencia || 0), 0);
  const difTarjeta = turno.difTarjeta || 0, difTransf = turno.difTransferencia || 0;
  const todoCuadra = difEfectivo === 0 && difTarjeta === 0 && difTransf === 0 && tramos.every((t) => !t.diferencia);
  const tieneTarjeta = typeof turno.tarjetaContada === "number" || typeof turno.transferenciaContada === "number";

  return (
    <div style={r.raiz}>
      {/* 1) ¿Cuadró o no? */}
      <div style={{ ...r.estado, background: todoCuadra ? K.okBg : K.malBg, color: todoCuadra ? K.verde : K.rojo }}>
        {todoCuadra ? <CheckCircle2 size={20} style={{ flexShrink: 0 }} /> : <AlertTriangle size={20} style={{ flexShrink: 0 }} />}
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{todoCuadra ? "Todo cuadró" : "Hay diferencias"}</div>
          <div style={{ color: K.ink, fontWeight: 500, fontSize: 12.5 }}>
            {todoCuadra
              ? "El efectivo, la tarjeta y las transferencias coinciden con lo esperado."
              : [
                  ...tramos.filter((t) => t.diferencia).map((t) => `Efectivo de ${t.nombre}: ${dif(t.diferencia).t.toLowerCase()}`),
                  difTarjeta ? `Tarjeta: ${dif(difTarjeta).t.toLowerCase()}` : null,
                  difTransf ? `Transferencia: ${dif(difTransf).t.toLowerCase()}` : null,
                ].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      <div style={r.meta}>
        {dateTimeLabel(turno.aperturaTs)}{turno.cierreTs ? ` → ${timeLabel(turno.cierreTs)}` : ""} · Abrió {turno.abiertoPor || "—"}{turno.cerradoPor ? ` · Cerró ${turno.cerradoPor}` : ""}
      </div>

      {/* 2) Cuadre del efectivo */}
      <div style={r.card}>
        <div style={r.titulo}>EFECTIVO · QUIÉN TUVO LA CAJA</div>
        <div style={r.ayuda}>El efectivo se cuenta por responsable: cada persona responde solo por el tramo en que la caja estuvo a su cargo.</div>
        {tramos.map((t, i) => {
          const d = dif(t.diferencia || 0);
          const conteos = arqueos.filter((a) => a.tramoId === t.id).length;
          return (
            <div key={t.id} style={{ ...(i > 0 ? { borderTop: `1px solid ${K.border}`, paddingTop: 10, marginTop: 8 } : {}), display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={r.cabTramo}>
                <span style={r.nombre}>{t.nombre}</span>
                {typeof t.diferencia === "number" && <span style={{ ...r.etiquetaRes, background: d.bg, color: d.c }}>{d.t}</span>}
              </div>
              <div style={r.meta}>
                {timeLabel(t.inicioTs)} → {t.finTs ? timeLabel(t.finTs) : "ahora"}
                {t.forzado ? ` · ${t.cerradoPor} asumió la caja porque no hubo entrega` : t.entregadoA ? ` · entregó a ${t.entregadoA.nombre}` : t.estado === "cerrado" ? " · cerró el turno" : ""}
              </div>
              <L k={i === 0 ? "Empezó con (base)" : "Recibió"} v={money(t.base)} />
              {typeof t.ventasEfectivo === "number" && <L k="+ Ventas en efectivo" v={money(t.ventasEfectivo)} />}
              {t.entradas > 0 && <L k="+ Entradas de dinero" v={money(t.entradas)} />}
              {t.salidas > 0 && <L k="− Salidas de dinero" v={money(t.salidas)} />}
              {typeof t.esperado === "number" && <L k="Debía haber" v={money(t.esperado)} fuerte />}
              {typeof t.contado === "number" && <L k={t.entregadoA ? "Contó y entregó" : "Contó al cerrar"} v={money(t.contado)} fuerte />}
              {conteos > 1 && <div style={r.meta}>Contó {conteos} veces antes de confirmar (todos los conteos quedan guardados).</div>}
              {t.observaciones && <div style={r.aviso}>“{t.observaciones}”</div>}
            </div>
          );
        })}
      </div>

      {/* 3) Cuadre de tarjeta y transferencia (pegado al del efectivo) */}
      {tieneTarjeta && (
        <div style={r.card}>
          <div style={r.titulo}>TARJETA Y TRANSFERENCIA · CUADRE</div>
          <div style={r.ayuda}>Se revisan una sola vez, al cerrar el turno, porque el datáfono y el banco muestran el total del día.</div>
          {[["Tarjeta", turno.tarjetaEsperada, turno.tarjetaContada, difTarjeta], ["Transferencia", turno.transferenciaEsperada, turno.transferenciaContada, difTransf]].map(([n, esp, reg, d]) => (
            <div key={n} style={{ display: "flex", flexDirection: "column", gap: 1, padding: "3px 0" }}>
              <div style={r.cabTramo}><span style={{ fontWeight: 600, fontSize: 13.5 }}>{n}</span><span style={{ ...r.etiquetaRes, background: dif(d).bg, color: dif(d).c }}>{dif(d).t}</span></div>
              <div style={r.meta}>Esperado {money(esp || 0)} · registrado {money(reg || 0)}</div>
            </div>
          ))}
        </div>
      )}

      {/* 4) Entradas y salidas */}
      {movs.length > 0 && (
        <div style={r.card}>
          <div style={r.titulo}>ENTRADAS Y SALIDAS DE DINERO</div>
          <ListaMovimientos movimientos={movs} />
        </div>
      )}

      {/* 5) Entregas de caja */}
      {relevos.length > 0 && (
        <div style={r.card}>
          <div style={r.titulo}>ENTREGAS DE CAJA</div>
          {relevos.map((x) => (
            <div key={x.id} style={{ display: "flex", flexDirection: "column", gap: 1, padding: "5px 0", borderBottom: `1px solid ${K.border}` }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{x.deNombre} → {x.aNombre} · {money(x.contado)}</span>
              <span style={r.meta}>
                {timeLabel(x.ts)} · {ESTADO_RELEVO[x.estado] || x.estado}
                {x.diferencia ? ` · el conteo de ${x.deNombre} ${x.diferencia < 0 ? "faltaba" : "sobraba"} ${money(Math.abs(x.diferencia))}` : x.estado === "aceptado" || x.estado === "forzado" ? " · cuadró" : ""}
                {x.estado === "forzado" && x.por ? ` · la hizo ${x.por}` : ""}
              </span>
              {(x.observaciones || x.motivo) && <span style={r.meta}>“{x.observaciones || x.motivo}”</span>}
            </div>
          ))}
        </div>
      )}

      {/* 6) Total vendido: al final, como cierre del resumen */}
      <div style={r.card}>
        <div style={r.titulo}>LO VENDIDO EN EL DÍA · TOTAL</div>
        <L k="Efectivo" v={money(ventas.efectivo)} />
        <L k="Tarjeta" v={money(ventas.tarjeta)} />
        <L k="Transferencia" v={money(ventas.transferencia)} />
        <L k="Total vendido" v={money(totalVendido)} fuerte />
        {propinas > 0 && <div style={r.meta}>Incluye {money(propinas)} de propinas.</div>}
      </div>
    </div>
  );
}

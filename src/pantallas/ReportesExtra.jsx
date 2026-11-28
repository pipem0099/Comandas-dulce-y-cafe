import React, { useMemo, useState } from "react";
import { money } from "../logica.js";
import { FilaDato, Plegable } from "../componentes/Comunes.jsx";
import { InfoTip } from "../componentes/InfoTip.jsx";
import { DetalleDiaHoja } from "../componentes/DetalleDiaHoja.jsx";
import { dayLabel } from "../utilidades.js";
import { porDiaSemana, porCategoria, porDia, productosJuntos, comparativaPeriodo } from "../analiticaReportes.js";
import { styles } from "../estilos.js";

/* Secciones extra del reporte: comparativa con el período anterior, día de la semana, ventas por día, por categoría
   y productos que se piden juntos. Lo que se toca (un día, una categoría) lleva al detalle correspondiente. */
const sub = { fontSize: 12.5, color: "var(--c-5c5648-t)", lineHeight: 1.45, margin: "2px 0 8px" };
const pct = (p) => (p === null ? "—" : `${p >= 0 ? "+" : ""}${Math.round(p)}%`);
const signo = (n) => (n >= 0 ? "+" : "−");
const colorDe = (n) => (n > 0 ? "var(--c-5b7553-t)" : n < 0 ? "var(--c-c1442d-t)" : "var(--c-8a8272-t)");

/* Sección del reporte que se abre y se cierra: así la pantalla no es una lista interminable. El título dice qué es y el resumen
   (una línea) deja ver lo importante sin abrirla. El texto de ayuda (antes un ⓘ junto al título) va como primera línea del cuerpo. */
export function SeccionR({ titulo, resumen, nota, inicialAbierto = false, children }) {
  return (
    <Plegable titulo={titulo} resumen={resumen} inicialAbierto={inicialAbierto} estilo={{ marginTop: 18, borderTop: "1px solid var(--c-ede7d8-o)", paddingTop: 4 }} estiloTitulo={{ ...styles.catLabel, marginBottom: 0 }}>
      <div>
        {nota && <div style={sub}>{nota}</div>}
        {children}
      </div>
    </Plegable>
  );
}

export function ReportesExtra({ rango, pagadas, orders, menu, cuentasBase, ordersBase, historialListo, onVerDia, onVerCategoria, mesas, config, usuarioActual }) {
  // Sin `onVerDia` (caso normal en Análisis), el día se abre en una hoja encima de esta misma pantalla: no se sale del módulo.
  const [diaAbierto, setDiaAbierto] = useState(null);
  const semana = useMemo(() => porDiaSemana(pagadas, orders), [pagadas, orders]);
  const dias = useMemo(() => porDia(pagadas, orders), [pagadas, orders]);
  const cats = useMemo(() => porCategoria(pagadas, orders, menu), [pagadas, orders, menu]);
  const juntos = useMemo(() => productosJuntos(pagadas, orders), [pagadas, orders]);
  const cmp = useMemo(() => comparativaPeriodo(rango, cuentasBase, ordersBase), [rango, cuentasBase, ordersBase]);

  const maxSemana = Math.max(1, ...semana.filas.map((f) => f.promedio));
  const maxDia = Math.max(1, ...dias.map((d) => d.total));
  const totalCats = cats.reduce((s, c) => s + c.total, 0) || 1;
  const hayVentas = pagadas.length > 0;

  const textoDia = onVerDia ? "Toca un día para abrirlo en el Historial con todas sus cuentas." : "Toca un día para ver su detalle: total, métodos de pago y cuentas cobradas.";
  const compListo = historialListo && cmp && !(cmp.total.anterior === 0 && cmp.cuentas.anterior === 0);
  return (
    <>
      {cmp && (
        <SeccionR inicialAbierto titulo={`COMPARADO CON ${cmp.etiquetaB.toUpperCase()}`} resumen={compListo ? `Ventas ${pct(cmp.total.pct)}` : undefined}>
          {!historialListo ? <div style={styles.cajaEmptyText}>Cargando el historial para comparar…</div> : cmp.total.anterior === 0 && cmp.cuentas.anterior === 0 ? (
            <div style={styles.cajaEmptyText}>No hay ventas en ese período para comparar.</div>
          ) : (
            [["Ventas", cmp.total, money], ["Cuentas cobradas", cmp.cuentas, (v) => String(Math.round(v))], ["Ticket promedio", cmp.ticket, money]].map(([nombre, m, f], i, arr) => (
              <FilaDato key={nombre} nombre={nombre} detalle={`Antes: ${f(m.anterior)} · Ahora: ${f(m.actual)}`} ultima={i === arr.length - 1}
                valor={`${pct(m.pct)} · ${signo(m.dif)}${nombre === "Cuentas cobradas" ? Math.abs(Math.round(m.dif)) : money(Math.abs(m.dif))}`} valorColor={colorDe(m.dif)} />
            ))
          )}
        </SeccionR>
      )}

      {hayVentas && dias.length > 1 && (
        <>
          <SeccionR titulo="VENTAS POR DÍA" nota={textoDia} resumen={`${dias.length} ${dias.length === 1 ? "día" : "días"} · ${money(dias.reduce((a, d) => a + d.total, 0))}`}>
            {dias.slice(0, 31).map((d, i, arr) => (
              <FilaDato key={d.key} nombre={dayLabel(d.ts)} detalle={`${d.cuentas} ${d.cuentas === 1 ? "cuenta" : "cuentas"}`} valor={`${money(d.total)} ›`} ultima={i === arr.length - 1} onClick={onVerDia ? () => onVerDia(d.key) : () => setDiaAbierto(d.key)} />
            ))}
          </SeccionR>
          {diaAbierto && <DetalleDiaHoja dia={diaAbierto} cuentas={cuentasBase || []} orders={ordersBase || orders} mesas={mesas} config={config} usuarioActual={usuarioActual} onCerrar={() => setDiaAbierto(null)} />}
        </>
      )}

      {hayVentas && (
        <SeccionR titulo="VENTAS POR DÍA DE LA SEMANA" nota="La barra es lo que se vende en un día así, en promedio (no el total), para que un mes con cinco sábados no engañe."
          resumen={semana.mejorIndice >= 0 ? `Mejor día: ${semana.filas[semana.mejorIndice].nombre.toLowerCase()}` : undefined}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "6px 0", maxWidth: 640 }}>
            {semana.filas.map((f) => (
              <div key={f.i} style={{ display: "grid", gridTemplateColumns: "92px 1fr auto", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                <span style={{ fontWeight: f.i === semana.mejorIndice ? 700 : 500, color: "var(--c-242019-t)" }}>{f.nombre}</span>
                <span style={{ height: 10, borderRadius: 6, background: "var(--c-ede7d8-o)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${Math.round((f.promedio / maxSemana) * 100)}%`, background: "var(--accent)", opacity: f.i === semana.mejorIndice ? 1 : 0.55, borderRadius: 6 }} />
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, textAlign: "right", minWidth: 96, color: f.total ? "var(--c-242019-t)" : "var(--c-8a8272-t)" }}>{f.total ? money(f.promedio) : "—"}</span>
              </div>
            ))}
          </div>
          {semana.mejorIndice >= 0 && <div style={sub}>Tu mejor día es el <b>{semana.filas[semana.mejorIndice].nombre.toLowerCase()}</b>: {money(semana.filas[semana.mejorIndice].promedio)} en promedio.</div>}
        </SeccionR>
      )}

      {cats.length > 0 && (
        <SeccionR titulo="VENTAS POR CATEGORÍA" nota="Toca una categoría para ir a Menú y precios con ella ya filtrada." resumen={`${cats.length} ${cats.length === 1 ? "categoría" : "categorías"}`}>
          {cats.map((c, i) => (
            <FilaDato key={c.cat} nombre={c.cat} detalle={`${c.qty} ${c.qty === 1 ? "vendido" : "vendidos"} · ${Math.round((c.total / totalCats) * 100)}% de las ventas`} valor={`${money(c.total)}${onVerCategoria && c.cat !== "Sin categoría" ? " ›" : ""}`} ultima={i === cats.length - 1}
              onClick={onVerCategoria && c.cat !== "Sin categoría" ? () => onVerCategoria(c.cat) : undefined} />
          ))}
        </SeccionR>
      )}

      {hayVentas && (
        <SeccionR titulo="PRODUCTOS QUE SE PIDEN JUNTOS" nota="Cuántas cuentas llevaron los dos productos a la vez. Sirve para armar combos o sugerir uno al pedir el otro."
          resumen={juntos.pares.length ? `${juntos.pares.length} ${juntos.pares.length === 1 ? "combinación" : "combinaciones"}` : "Sin combinaciones todavía"}>
          {juntos.pares.length === 0 ? (
            <div style={styles.cajaEmptyText}>Todavía no hay combinaciones que se repitan en este período (se muestran las que aparecen en 2 cuentas o más).</div>
          ) : (
            <>
              {juntos.pares.map((p, i) => (
                <FilaDato key={p.a + p.b} nombre={`${p.a} + ${p.b}`} detalle={`${p.cuentas} cuentas`} valor={`${Math.round(p.pct)}% de las cuentas`} ultima={i === juntos.pares.length - 1} />
              ))}
              <div style={sub}>Idea: ofrece <b>{juntos.pares[0].a}</b> con <b>{juntos.pares[0].b}</b> como combo, o sugiérelo al tomar el pedido.</div>
            </>
          )}
        </SeccionR>
      )}
    </>
  );
}

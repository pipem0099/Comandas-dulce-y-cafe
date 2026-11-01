import React, { useState, useEffect, useMemo } from "react";
import { CabeceraAdmin } from "../componentes/CabeceraAdmin.jsx";
import { FilaTabs } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { money } from "../logica.js";
import { dateTimeLabel } from "../utilidades.js";
import { getCollectionAll } from "../firebase.js";
import {
  DIA, DIAS_SEMANA, prepararVentas, rangosComparables, resumenPeriodo, comparar, descomponerVenta, rentabilidad, productosMuertos,
  metricasEmpleados, planificacionSemanal, comprasSugeridas, sugerirPlantillaCostos, precioSugerido,
} from "../analitica.js";

/* ---------------- Análisis y control (solo administración) ----------------
 * Esta pantalla solo DIBUJA: todos los cálculos viven en src/analitica.js (y tienen pruebas: npm run analitica:probar). */

const C = {
  texto: "var(--c-242019-t)", suave: "var(--c-8a8272-t)", medio: "var(--c-5c5648-t)", rojo: "var(--c-c1442d-t)",
  verde: "var(--pago-ok)", oro: "var(--c-b98a2e-t)", fondo: "var(--c-fffdf8-b)", borde: "var(--c-e4dfce-o)", suaveBg: "var(--c-ede7d8-b)",
};
const caja = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 14, padding: 14, marginBottom: 12 };
const titulo = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.2, color: "#9BA4B0", fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase" };
const nota = { fontSize: 12.5, color: C.medio, lineHeight: 1.5 };
const entrada = { width: 70, padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.borde}`, background: C.fondo, color: C.texto, fontSize: 14, textAlign: "right" };
const boton = { padding: "9px 14px", borderRadius: 12, border: `1px solid ${C.borde}`, background: C.suaveBg, color: C.texto, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const firmado = (v) => `${v >= 0 ? "+" : "−"}${money(Math.abs(v))}`;

function Tabs({ valor, onChange, opciones }) {
  return (
    <FilaTabs style={{ ...styles.cajaTabSwitch, padding: "0 0 12px" }}>
      {opciones.map(([k, t]) => (
        <button key={k} style={{ ...styles.cajaTabBtn, ...(valor === k ? styles.cajaTabBtnActive : {}) }} aria-current={valor === k ? "true" : undefined} onClick={() => onChange(k)}>{t}</button>
      ))}
    </FilaTabs>
  );
}
function Linea({ a, b, color, fuerte }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13, color: C.medio }}>
      <span>{a}</span><span style={{ color: color || C.texto, fontWeight: fuerte ? 800 : 700, textAlign: "right" }}>{b}</span>
    </div>
  );
}
function Barra({ pct, color }) {
  return <div style={{ height: 6, borderRadius: 4, background: C.suaveBg, overflow: "hidden" }}><div style={{ width: `${Math.max(2, Math.min(100, pct))}%`, height: "100%", background: color || C.rojo }} /></div>;
}
function Vacio({ children }) { return <div style={{ ...nota, padding: "10px 2px", color: C.suave }}>{children}</div>; }

/* ───────── 1 y 2 · Resumen: comparación, ticket y personas ───────── */
function Resumen({ ventas, ahora }) {
  const [rango, setRango] = useState("hoy");
  const r = rangosComparables(rango, ahora);
  const A = resumenPeriodo(ventas, r.A), B = resumenPeriodo(ventas, r.B);
  const cmp = comparar(A, B);
  const d = cmp.nivel === "sin-base" ? null : descomponerVenta(A, B);
  const marca = cmp.nivel === "sin-base" ? "Sin base todavía" : cmp.nivel === "igual" ? "≈ igual" : `${cmp.pct > 0 ? "▲" : "▼"} ${Math.round(Math.abs(cmp.pct))}%`;
  const colorMarca = cmp.nivel === "sube" ? "#7BD88F" : cmp.nivel === "baja" ? "#FF8A75" : "#9BA4B0";
  const frase = cmp.pct === null
    ? "Todavía no hay suficientes ventas del período anterior para comparar (se necesitan al menos 5 cuentas)."
    : cmp.nivel === "igual" ? `Vas casi igual ${r.etiqueta}.`
    : `Vendiste ${Math.round(Math.abs(cmp.pct))}% ${cmp.pct < 0 ? "menos" : "más"} ${r.etiqueta.replace("vs. ", "que ")}.`;
  const totalEfecto = d ? Math.abs(d.afluencia) + Math.abs(d.ticket) || 1 : 1;
  return (
    <>
      <Tabs valor={rango} onChange={setRango} opciones={[["hoy", "Hoy"], ["semana", "7 días"], ["mes", "Este mes"]]} />
      <div style={styles.cajaTotalCard}>
        <span style={styles.cajaTotalLabel}>Venta neta (sin propinas)</span>
        <span style={styles.cajaTotalValue}>{money(A.venta)}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: colorMarca }}>{marca}</span>
        <span style={styles.turnoEsperadoLabel}>{A.cuentas} {A.cuentas === 1 ? "cuenta" : "cuentas"} · antes: {money(B.venta)} ({B.cuentas})</span>
      </div>
      <div style={{ ...nota, marginBottom: 12 }}>{frase}</div>

      {d && Math.abs(d.total) > 0 && (
        <div style={caja}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.texto, marginBottom: 8 }}>¿Por qué cambió?</div>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: C.suaveBg, marginBottom: 10 }}>
            <div style={{ width: `${(Math.abs(d.afluencia) / totalEfecto) * 100}%`, background: C.oro }} />
            <div style={{ width: `${(Math.abs(d.ticket) / totalEfecto) * 100}%`, background: C.texto }} />
          </div>
          <Linea a={<><span style={{ color: C.oro }}>●</span> {d.afluencia >= 0 ? "Más clientes (cuentas)" : "Menos clientes (cuentas)"}</>} b={firmado(d.afluencia)} color={d.afluencia >= 0 ? C.verde : C.rojo} />
          <Linea a={<>● {d.ticket >= 0 ? "Más consumo por cuenta" : "Menos consumo por cuenta"}</>} b={firmado(d.ticket)} color={d.ticket >= 0 ? C.verde : C.rojo} />
          <div style={{ ...nota, marginTop: 6 }}>
            {Math.abs(d.afluencia) >= Math.abs(d.ticket)
              ? "El cambio viene sobre todo de cuánta gente llegó."
              : "El cambio viene sobre todo de cuánto consume cada cuenta: mira el menú y las sugerencias de venta."}
          </div>
        </div>
      )}

      <div style={titulo}>Ticket y personas</div>
      <div style={caja}>
        <Linea a="Ticket promedio por cuenta" b={`${money(A.ticket)}  (antes ${money(B.ticket)})`} />
        <Linea a="Cuentas atendidas" b={`${A.cuentas}  (antes ${B.cuentas})`} />
        {A.ticketPersona !== null
          ? <Linea a="Ticket por persona" b={money(A.ticketPersona)} />
          : <Vacio>Anota cuántas personas había en cada mesa (en la cuenta) para ver el ticket por persona.</Vacio>}
        {A.ticketPersona !== null && A.cuentasConPersonas < A.cuentas && (
          <div style={{ ...nota, color: C.suave }}>Calculado con {A.cuentasConPersonas} de {A.cuentas} cuentas que tienen personas anotadas.</div>
        )}
      </div>
      <div style={caja}>
        <Linea a="Descuentos y cortesías" b={money(A.descuento)} color={A.descuento > 0 ? C.rojo : C.suave} />
        <Linea a="Propinas (no son venta)" b={money(A.propinas)} />
      </div>
    </>
  );
}

/* ───────── 3 · Rentabilidad real de productos ───────── */
const CLASES = {
  estrella: ["Estrella", "Se vende mucho y deja mucho", C.verde],
  caballo: ["Se vende mucho, deja poco", "Revisa su precio o su costo", C.oro],
  puzzle: ["Deja mucho, se vende poco", "Promociónalo o ponlo más visible", C.oro],
  perro: ["Vende poco y deja poco", "Candidato a salir del menú", C.rojo],
};
function Productos({ ventas, menu, insumos, plantilla, ahora, onCostos }) {
  const [dias, setDias] = useState(30);
  const [vista, setVista] = useState("mas");
  const rent = useMemo(() => rentabilidad(ventas, menu, { rango: [ahora - dias * DIA, ahora + 1], insumos, plantilla }), [ventas, menu, insumos, plantilla, dias, ahora]);
  const mu = useMemo(() => productosMuertos(ventas, menu, { ahora, dias: Math.max(30, dias) }), [ventas, menu, dias, ahora]);
  const maxM = Math.max(1, ...rent.productos.map((p) => Math.abs(p.margen)));
  const lista = vista === "mas" ? rent.productos.slice(0, 10) : rent.productos.slice().reverse().slice(0, 10);
  return (
    <>
      <Tabs valor={dias} onChange={setDias} opciones={[[7, "7 días"], [30, "30 días"], [90, "90 días"]]} />
      <div style={styles.cajaTotalCard}>
        <span style={styles.cajaTotalLabel}>Ganancia bruta de los productos</span>
        <span style={styles.cajaTotalValue}>{rent.ventaConCosto > 0 ? `${rent.hayEstimado ? "~" : ""}${money(rent.margenTotal)}` : "—"}</span>
        <span style={styles.turnoEsperadoLabel}>
          {rent.margenPct !== null ? `Margen ${Math.round(rent.margenPct)}% · ` : ""}costos conocidos en el {Math.round(rent.cobertura * 100)}% de la venta
        </span>
      </div>
      {rent.cobertura < 0.8 && rent.ventaTotal > 0 && (
        <div style={{ ...caja, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ ...nota, flex: 1 }}>Faltan costos en parte de lo vendido, y el margen real puede ser distinto. Puedes cargarlos o usar porcentajes estimados por categoría.</div>
          <button style={boton} onClick={onCostos}>Costos</button>
        </div>
      )}
      <Tabs valor={vista} onChange={setVista} opciones={[["mas", "Más ganancia"], ["menos", "Menos ganancia"], ["sin", "Sin ventas"]]} />

      {vista !== "sin" && (lista.length === 0 ? <Vacio>Todavía no hay ventas con costo en este período.</Vacio> : lista.map((p) => {
        const c = p.clase ? CLASES[p.clase] : null;
        return (
          <div key={p.id} style={{ ...caja, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.texto }}>{p.name}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: p.margen < 0 ? C.rojo : C.texto }}>{p.estimado ? "~" : ""}{money(p.margen)}</span>
            </div>
            <div style={{ ...nota, margin: "2px 0 6px" }}>
              {p.qty} {p.qty === 1 ? "unidad" : "unidades"} · margen {Math.round(p.margenPct)}%{p.estimado ? " (costo estimado)" : ""}
              {c && <> · <b style={{ color: c[2] }}>{c[0]}</b></>}
            </div>
            <Barra pct={(Math.abs(p.margen) / maxM) * 100} color={p.margen < 0 ? C.rojo : C.oro} />
          </div>
        );
      }))}
      {vista !== "sin" && rent.productos.length >= 4 && (
        <div style={{ ...nota, color: C.suave }}>Se ordena por ganancia en pesos, no por unidades vendidas: el más vendido no siempre es el que más deja.</div>
      )}
      {vista === "sin" && (mu.datosInsuficientes
        ? <Vacio>Todavía no hay 30 días de ventas ({Math.floor(mu.diasDeDatos)} hasta ahora). Cuando los haya, aquí verás qué productos no se venden.</Vacio>
        : <>
          <div style={titulo}>Sin ventas en {Math.max(30, dias)} días ({mu.muertos.length})</div>
          {mu.muertos.length === 0 ? <Vacio>Todo el menú tuvo ventas. 👌</Vacio> : mu.muertos.map((m) => (
            <Linea key={m.id} a={m.name} b={m.cat || ""} />
          ))}
          <div style={titulo}>Casi sin ventas ({mu.moribundos.length})</div>
          {mu.moribundos.length === 0 ? <Vacio>Ninguno.</Vacio> : mu.moribundos.map((m) => (
            <Linea key={m.id} a={m.name} b={`${m.qty} ${m.qty === 1 ? "unidad" : "unidades"}`} />
          ))}
          <div style={{ ...nota, color: C.suave, marginTop: 8 }}>Los productos nuevos (menos de 14 días) y los marcados de temporada no se cuentan.</div>
        </>)}
    </>
  );
}

/* ───────── 4 · Control de pérdidas ───────── */
function Perdidas({ ventas, cuentas, ahora }) {
  const [dias, setDias] = useState(7);
  const [bitacora, setBitacora] = useState(null);
  useEffect(() => {
    let vivo = true;
    getCollectionAll("auditoria").then((l) => { if (vivo) setBitacora((l || []).filter((x) => x && x.ts).sort((a, b) => b.ts - a.ts).slice(0, 30)); }).catch(() => { if (vivo) setBitacora([]); });
    return () => { vivo = false; };
  }, []);
  const m = useMemo(() => metricasEmpleados(cuentas, ventas, [ahora - dias * DIA, ahora + 1]), [cuentas, ventas, dias, ahora]);
  const totCancel = m.empleados.reduce((s, e) => s + e.cancelMonto, 0), totDesc = m.empleados.reduce((s, e) => s + e.descMonto, 0);
  const razon = (e) => {
    const r = [];
    if (e.vsCancel !== null && e.vsCancel >= 2.5) r.push("cancela mucho más que sus compañeros");
    if (e.vsDesc !== null && e.vsDesc >= 2.5) r.push("da más descuentos que sus compañeros");
    if (e.cortesiasTotales >= 3) r.push(`${e.cortesiasTotales} cuentas regaladas completas`);
    return r.join(" · ");
  };
  return (
    <>
      <Tabs valor={dias} onChange={setDias} opciones={[[7, "7 días"], [30, "30 días"], [90, "90 días"]]} />
      <div style={caja}>
        <Linea a="Cancelado sin cobrar" b={money(totCancel)} color={totCancel > 0 ? C.rojo : C.suave} />
        <Linea a="Descuentos y cortesías" b={money(totDesc)} color={totDesc > 0 ? C.rojo : C.suave} />
      </div>

      <div style={titulo}>Por empleado (responsable de la cuenta)</div>
      {m.empleados.length === 0 ? <Vacio>Sin movimiento en este período.</Vacio> : m.empleados.map((e) => (
        <div key={e.nombre} style={{ ...caja, padding: 12, marginBottom: 8, borderColor: e.revisar ? "var(--c-c1442d-t)" : C.borde }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.texto }}>{e.nombre}</span>
            {e.revisar && <span style={{ fontSize: 11.5, fontWeight: 800, color: C.rojo }}>PARA REVISAR</span>}
          </div>
          <div style={{ ...nota, margin: "2px 0 6px" }}>{e.cuentas} cuentas · {money(e.venta)} vendidos</div>
          <Linea a={`Cancelaciones (${e.cancelN})`} b={`${money(e.cancelMonto)} · ${(e.tasaCancel * 100).toFixed(1)}%`} color={e.cancelN > 0 ? C.rojo : C.suave} />
          <Linea a={`Descuentos (${e.descN})`} b={`${money(e.descMonto)} · ${(e.tasaDesc * 100).toFixed(1)}%`} color={e.descN > 0 ? C.rojo : C.suave} />
          {e.revisar && <div style={{ ...nota, color: C.rojo, marginTop: 4 }}>{razon(e)}. Revisa los motivos antes de sacar conclusiones.</div>}
        </div>
      ))}
      {!m.equipoSuficiente && m.empleados.length > 0 && (
        <div style={{ ...nota, color: C.suave }}>Para comparar entre compañeros se necesitan al menos 3 personas con 10 o más cuentas en el período.</div>
      )}

      <div style={titulo}>Línea de tiempo</div>
      {m.eventos.length === 0 ? <Vacio>Sin cancelaciones ni descuentos en este período.</Vacio> : m.eventos.slice(0, 40).map((e, i) => (
        <div key={`${e.ts}-${i}`} style={{ padding: "8px 0", borderBottom: `1px solid ${C.borde}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.texto, fontWeight: 700 }}>
            <span>{e.tipo === "cancelacion" ? "Cancelación" : "Descuento"} · mesa {e.mesa}</span><span style={{ color: C.rojo }}>{money(e.monto)}</span>
          </div>
          <div style={nota}>{dateTimeLabel(e.ts)} · responsable: {e.responsable}{e.autorizo ? ` · autorizó: ${e.autorizo}` : ""}</div>
          {e.motivo && <div style={{ ...nota, color: C.suave }}>Motivo: {e.motivo}</div>}
        </div>
      ))}

      <div style={titulo}>Bitácora de control (no editable)</div>
      <div style={{ ...nota, color: C.suave, marginBottom: 6 }}>Cada cancelación y descuento queda firmado con el usuario real y no se puede modificar ni borrar.</div>
      {bitacora === null ? <Vacio>Cargando…</Vacio> : bitacora.length === 0 ? <Vacio>Aún no hay registros. Empiezan a guardarse desde esta versión.</Vacio> : bitacora.map((b, i) => (
        <div key={`${b.ts}-${i}`} style={{ padding: "6px 0", borderBottom: `1px solid ${C.borde}`, fontSize: 12.5, color: C.medio }}>
          <b style={{ color: C.texto }}>{b.nombre || b.uid}</b> · {String(b.accion).replace("_", " ")} · {money(b.monto)} · {dateTimeLabel(b.ts)}{b.motivo ? ` · “${b.motivo}”` : ""}
        </div>
      ))}
    </>
  );
}

/* ───────── 5 · Planificación de la semana ───────── */
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];
function Semana({ ventas, menu, insumos, config, persistConfig, ahora }) {
  const cpm = Math.max(1, Number(config && config.cuentasPorMeseroHora) || 6);
  const plan = useMemo(() => planificacionSemanal(ventas, { ahora, cuentasPorMeseroHora: cpm }), [ventas, ahora, cpm]);
  const compras = useMemo(() => comprasSugeridas(ventas, menu, insumos, { ahora, diasAdelante: 3 }), [ventas, menu, insumos, ahora]);
  const maxPron = Math.max(1, ...plan.dias.map((d) => d.pronostico));
  const maxHeat = Math.max(1, ...plan.heat.flat());
  const horasActivas = [];
  plan.heat.forEach((fila) => fila.forEach((v, h) => { if (v > 0) horasActivas.push(h); }));
  const h0 = horasActivas.length ? Math.max(0, Math.min(...horasActivas) - 1) : 7, h1 = horasActivas.length ? Math.min(23, Math.max(...horasActivas) + 1) : 20;
  const horas = []; for (let h = h0; h <= h1; h++) horas.push(h);
  const hoy = plan.dias[new Date(ahora).getDay()];
  return (
    <>
      {!plan.suficiente && <div style={caja}><div style={nota}>Todavía hay pocas ventas guardadas (se necesitan al menos 2 semanas) y estos números pueden cambiar mucho. Mejoran con cada semana de uso.</div></div>}
      {hoy && hoy.n > 0 && (
        <div style={styles.cajaTotalCard}>
          <span style={styles.cajaTotalLabel}>Un {hoy.nombre.toLowerCase()} normal</span>
          <span style={styles.cajaTotalValue}>{money(hoy.mediana)}</span>
          <span style={styles.turnoEsperadoLabel}>Suele estar entre {money(hoy.p25)} y {money(hoy.p75)} · {hoy.n} {hoy.n === 1 ? "semana" : "semanas"} de datos</span>
        </div>
      )}
      <div style={titulo}>Venta esperada por día</div>
      {ORDEN_SEMANA.map((w) => {
        const d = plan.dias[w];
        return (
          <div key={w} style={{ padding: "6px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.texto }}>
              <b>{d.nombre}</b><span><b>{d.n > 0 ? money(d.pronostico) : "—"}</b>{d.n > 0 && <span style={{ color: C.suave }}> · {money(d.p25)}–{money(d.p75)}</span>}</span>
            </div>
            <Barra pct={(d.pronostico / maxPron) * 100} />
          </div>
        );
      })}
      {plan.g !== 1 && <div style={{ ...nota, color: C.suave, marginTop: 6 }}>Ajustado {plan.g > 1 ? "al alza" : "a la baja"} ({Math.round((plan.g - 1) * 100)}%) por la tendencia de las últimas 4 semanas.</div>}

      <div style={titulo}>Cuándo se vende (promedio por hora)</div>
      {horasActivas.length === 0 ? <Vacio>Aún no hay ventas para dibujar el mapa.</Vacio> : (
        <div style={{ overflowX: "auto", paddingBottom: 6 }}>
          <div style={{ display: "flex", gap: 3, marginLeft: 38, marginBottom: 3 }}>
            {horas.map((h) => <div key={h} style={{ width: 18, fontSize: 9, color: C.suave, textAlign: "center" }}>{h % 2 === 0 ? h : ""}</div>)}
          </div>
          {ORDEN_SEMANA.map((w) => (
            <div key={w} style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}>
              <div style={{ width: 35, fontSize: 11, color: C.medio, fontWeight: 700 }}>{DIAS_SEMANA[w].slice(0, 3)}</div>
              {horas.map((h) => {
                const v = plan.heat[w][h];
                return <div key={h} title={`${DIAS_SEMANA[w]} ${h}:00 · ${money(v)}`} style={{ width: 18, height: 22, borderRadius: 4, background: v > 0 ? `rgba(193,68,45,${0.12 + 0.88 * (v / maxHeat)})` : C.suaveBg }} />;
              })}
            </div>
          ))}
        </div>
      )}

      <div style={titulo}>Personal sugerido en la hora pico</div>
      <div style={caja}>
        {ORDEN_SEMANA.map((w) => { const d = plan.dias[w]; return (
          <Linea key={w} a={d.nombre} b={d.franja ? `${d.franja.desde}–${d.franja.hasta} h · ${d.personalPico} ${d.personalPico === 1 ? "mesero" : "meseros"}` : "—"} />
        ); })}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 }}>
          <span style={nota}>Cuentas que atiende un mesero por hora</span>
          <input type="number" min="1" max="30" inputMode="numeric" style={entrada} defaultValue={cpm}
            onBlur={(e) => { const v = Math.max(1, Math.min(30, Math.round(Number(e.target.value) || 6))); if (v !== cpm) persistConfig({ ...config, cuentasPorMeseroHora: v }); }} />
        </div>
        <div style={{ ...nota, color: C.suave, marginTop: 4 }}>Es una guía: ajústala a la velocidad real de tu equipo.</div>
      </div>

      <div style={titulo}>Qué comprar para los próximos 3 días</div>
      {!compras.suficiente ? <Vacio>Se necesitan 2 semanas de ventas y recetas con insumos cargados para sugerir compras.</Vacio>
        : compras.filas.length === 0 ? <Vacio>Con lo que tienes en inventario alcanza para lo esperado, o aún no hay recetas con insumos.</Vacio>
        : compras.filas.map((f) => (
          <Linea key={f.id} a={f.nombre} b={`${Math.ceil(f.comprar * 100) / 100} ${f.unidad || ""}${f.costo > 0 ? ` · ${money(f.costo)}` : ""}`} />
        ))}
    </>
  );
}

/* ───────── 6 y 7 · Costos automáticos, margen objetivo y alertas ───────── */
function Costos({ ventas, menu, insumos, config, persistConfig, ahora }) {
  const categorias = useMemo(() => [...new Set((menu || []).map((m) => m.cat).filter(Boolean))], [menu]);
  const guardada = (config && config.plantillaCostos) || {};
  const [borrador, setBorrador] = useState(() => Object.fromEntries(categorias.map((c) => [c, guardada[c] ? String(guardada[c]) : ""])));
  const [guardado, setGuardado] = useState(false);
  const objetivo = Number(config && config.margenObjetivo) || 65;
  const plantilla = useMemo(() => Object.fromEntries(Object.entries(guardada).map(([k, v]) => [k, Number(v) || 0])), [guardada]);
  const rent = useMemo(() => rentabilidad(ventas, menu, { rango: [ahora - 30 * DIA, ahora + 1], insumos, plantilla }), [ventas, menu, insumos, plantilla, ahora]);
  const sensibilidad = (config && config.alertasSensibilidad) || "normal";
  const guardar = async () => {
    const limpio = {};
    Object.entries(borrador).forEach(([k, v]) => { const n = Math.max(0, Math.min(95, Number(v) || 0)); if (n > 0) limpio[k] = n; });
    await persistConfig({ ...config, plantillaCostos: limpio });
    setGuardado(true); setTimeout(() => setGuardado(false), 2000);
  };
  const bajos = rent.productos.filter((p) => p.margenPct !== null && p.margenPct < objetivo).slice(0, 10);
  const precioDe = (id) => { const m = (menu || []).find((x) => x.id === id); return m ? m.price : 0; };
  return (
    <>
      <div style={styles.cajaTotalCard}>
        <span style={styles.cajaTotalLabel}>Costos conocidos (últimos 30 días)</span>
        <span style={styles.cajaTotalValue}>{Math.round(rent.cobertura * 100)}%</span>
        <span style={styles.turnoEsperadoLabel}>{Math.round(rent.coberturaReal * 100)}% con costo real · {Math.round((rent.cobertura - rent.coberturaReal) * 100)}% estimado · {Math.round((1 - rent.cobertura) * 100)}% sin costo</span>
      </div>
      <div style={{ ...nota, marginBottom: 8 }}>El costo de cada producto se toma, en este orden: el que quedó en la venta, el de su receta (inventario), o el porcentaje estimado de su categoría. Si no hay ninguno, el producto no entra al margen: no se inventa.</div>

      <div style={titulo}>Costo estimado por categoría (% del precio)</div>
      <div style={caja}>
        {categorias.length === 0 ? <Vacio>Aún no hay categorías en el menú.</Vacio> : categorias.map((c) => (
          <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 0" }}>
            <span style={{ fontSize: 13.5, color: C.texto }}>{c}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" min="0" max="95" inputMode="decimal" placeholder="—" style={entrada} value={borrador[c] === undefined ? "" : borrador[c]} onChange={(e) => setBorrador({ ...borrador, [c]: e.target.value })} />
              <span style={{ color: C.suave }}>%</span>
            </span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button style={boton} onClick={() => setBorrador(Object.fromEntries(Object.entries(sugerirPlantillaCostos(menu)).map(([k, v]) => [k, String(v)])))}>Usar valores sugeridos</button>
          <button style={{ ...boton, background: "var(--seg-on-bg)", color: "var(--seg-on-fg)" }} onClick={guardar}>{guardado ? "Guardado ✓" : "Guardar"}</button>
        </div>
        <div style={{ ...nota, color: C.suave, marginTop: 8 }}>Los valores sugeridos son referencias generales del sector (bebidas ~25%, postres y panadería ~30%, comidas ~33%). Ajústalos a tus costos reales; lo estimado se marca con “~”.</div>
      </div>

      <div style={titulo}>Margen objetivo</div>
      <div style={caja}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={nota}>Cuánto quieres ganar sobre el precio</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="number" min="10" max="90" inputMode="numeric" style={entrada} defaultValue={objetivo}
              onBlur={(e) => { const v = Math.max(10, Math.min(90, Math.round(Number(e.target.value) || 65))); if (v !== objetivo) persistConfig({ ...config, margenObjetivo: v }); }} />
            <span style={{ color: C.suave }}>%</span>
          </span>
        </div>
        {bajos.length === 0 ? <div style={{ ...nota, marginTop: 8 }}>Ningún producto con costo está por debajo del objetivo.</div> : (
          <>
            <div style={{ ...nota, margin: "10px 0 4px" }}>Por debajo del objetivo ({bajos.length}):</div>
            {bajos.map((p) => {
              const costoUnit = p.qty > 0 ? p.costo / p.qty : 0;
              const sug = precioSugerido(costoUnit, objetivo);
              return <Linea key={p.id} a={`${p.name} · margen ${Math.round(p.margenPct)}%`} b={sug ? `${money(precioDe(p.id))} → ${money(Math.ceil(sug / 100) * 100)}` : "—"} />;
            })}
          </>
        )}
      </div>

      {rent.sinCosto.length > 0 && (
        <>
          <div style={titulo}>Vendidos sin costo ({rent.sinCosto.length})</div>
          <div style={caja}>{rent.sinCosto.slice(0, 12).map((p) => <Linea key={p.id} a={p.name} b={p.cat || ""} />)}
            <div style={{ ...nota, color: C.suave, marginTop: 6 }}>Ponles costo en Menú y precios, arma su receta en inventario, o asigna un % a su categoría arriba.</div></div>
        </>
      )}

      <div style={titulo}>Alertas automáticas</div>
      <div style={caja}>
        <div style={{ ...nota, marginBottom: 8 }}>Avisan cuando algo se sale de lo habitual del negocio (mismo día de la semana y misma hora): ventas bajas, ticket bajo, cancelaciones y descuentos fuera de lo normal.</div>
        <Tabs valor={sensibilidad} onChange={(v) => persistConfig({ ...config, alertasSensibilidad: v })} opciones={[["apagada", "Apagadas"], ["baja", "Pocas"], ["normal", "Normal"], ["alta", "Muchas"]]} />
      </div>
    </>
  );
}

/* ───────── Pantalla ───────── */
export function Analisis({ onClose, menu, insumos, config, persistConfig, cuentasParaHistorial, ordersParaHistorial, cargarHistorialCompleto, historialCompleto, cargandoHistorial }) {
  const [tab, setTab] = useState("resumen");
  const [ahora] = useState(() => Date.now());
  // El historial completo se pide una vez: sin él solo hay ~35 días y no alcanzaría para 8 semanas ni para el mes pasado.
  useEffect(() => { if (cargarHistorialCompleto) cargarHistorialCompleto(); }, [cargarHistorialCompleto]);
  const ventas = useMemo(() => prepararVentas(cuentasParaHistorial || [], ordersParaHistorial || []), [cuentasParaHistorial, ordersParaHistorial]);
  const plantilla = useMemo(() => Object.fromEntries(Object.entries((config && config.plantillaCostos) || {}).map(([k, v]) => [k, Number(v) || 0])), [config]);
  return (
    <>
      <CabeceraAdmin titulo="Análisis y control" onClose={onClose} />
      <div className="ancho" style={{ ...styles.menuScroll, paddingBottom: 40 }}>
        <Tabs valor={tab} onChange={setTab} opciones={[["resumen", "Resumen"], ["productos", "Productos"], ["perdidas", "Pérdidas"], ["semana", "Semana"], ["costos", "Costos"]]} />
        {cargandoHistorial && !historialCompleto && <div style={{ ...nota, color: C.suave, marginBottom: 10 }}>Cargando el historial completo…</div>}
        {tab === "resumen" && <Resumen ventas={ventas} ahora={ahora} />}
        {tab === "productos" && <Productos ventas={ventas} menu={menu || []} insumos={insumos || []} plantilla={plantilla} ahora={ahora} onCostos={() => setTab("costos")} />}
        {tab === "perdidas" && <Perdidas ventas={ventas} cuentas={cuentasParaHistorial || []} ahora={ahora} />}
        {tab === "semana" && <Semana ventas={ventas} menu={menu || []} insumos={insumos || []} config={config} persistConfig={persistConfig} ahora={ahora} />}
        {tab === "costos" && <Costos ventas={ventas} menu={menu || []} insumos={insumos || []} config={config} persistConfig={persistConfig} ahora={ahora} />}
      </div>
    </>
  );
}

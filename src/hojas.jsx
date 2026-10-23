import React from "react";
import { money } from "./logica.js";
import { METODO_META } from "./constantes.js";
import { cuentaGranTotal, cuentaOrders, dateTimeLabel, dayKey, dayLabel, duracionLabel, hourLabel, mesaNombre, pagosDe, timeLabel, ventasEnRango, propinasEnRango } from "./utilidades.js";
import { tramosDe } from "./relevoCaja.js";
import { ResumenDia } from "./pantallas/ResumenDia.jsx";
import { Hoja, Seccion, Kpis, Tabla, Firmas, BarraImp, pctDe } from "./impresion.jsx";

const n0 = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const METODOS = Object.keys(METODO_META);
const etMetodo = (k) => (METODO_META[k] ? METODO_META[k].label : k);
const nombreUsuario = (u) => (u && u.nombre) || "";

/** Líneas de datos "etiqueta: valor" (sin encabezado de tabla). */
function Datos({ filas }) {
  return (
    <table className="imp-tabla">
      <tbody>
        {filas.filter(Boolean).map(([k, v], i) => (
          <tr key={i}><td style={{ width: "34%", fontWeight: 700, color: "#333" }}>{k}</td><td>{v}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

/* ═════════════════════════ 1) Resumen de UN día (Historial) ═════════════════════════ */
export function HojaDia({ d, orders, mesas, canceladas = [], config, usuario }) {
  const cuentas = d.cuentas.slice().sort((a, b) => a.pagadaTs - b.pagadaTs);
  const unidades = cuentas.reduce((s, c) => s + c.itemCount, 0);
  const propinas = cuentas.reduce((s, c) => s + n0(c.propina && c.propina.monto), 0);
  const descuentos = cuentas.reduce((s, c) => s + n0(c.descuento && c.descuento.monto), 0);
  const totalMetodos = METODOS.reduce((s, k) => s + n0(d.porMetodo[k]), 0);
  const conteoPagos = {};
  cuentas.forEach((c) => (c.pagos || []).forEach((p) => { conteoPagos[p.metodoPago] = (conteoPagos[p.metodoPago] || 0) + 1; }));

  const meseros = {};
  cuentas.forEach((c) => {
    const k = c.mesero || "Sin asignar";
    if (!meseros[k]) meseros[k] = { cuentas: 0, total: 0, propinas: 0 };
    meseros[k].cuentas += 1; meseros[k].total += c.total; meseros[k].propinas += n0(c.propina && c.propina.monto);
  });
  const filasMeseros = Object.entries(meseros).sort((a, b) => b[1].total - a[1].total);

  const horas = Object.entries(d.porHora).map(([h, v]) => [Number(h), v]).sort((a, b) => a[0] - b[0]);
  const maxHora = Math.max(0, ...horas.map(([, v]) => v));
  const productos = Object.entries(d.productos).sort((a, b) => b[1].subtotal - a[1].subtotal);
  const totalProductos = productos.reduce((s, [, p]) => s + p.subtotal, 0);

  // lo consumido en cada cuenta, en una línea
  const consumo = (c) => {
    const m = {};
    cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado").forEach((o) => o.items.forEach((it) => { m[it.name] = (m[it.name] || 0) + it.qty; }));
    return Object.entries(m).map(([nom, q]) => `${q}× ${nom}`).join(", ");
  };
  const metodos = (c) => Array.from(new Set((c.pagos || []).map((p) => etMetodo(p.metodoPago)))).join(" + ") || "—";

  return (
    <Hoja config={config} usuario={usuario} titulo="Resumen del día" subtitulo={dayLabel(d.ts)}>
      <Kpis items={[
        { t: "Total cobrado", v: money(d.total) },
        { t: "Cuentas cobradas", v: String(d.cuentasCount), s: d.cuentasCount ? `Promedio por cuenta ${money(d.total / d.cuentasCount)}` : undefined },
        { t: "Productos vendidos", v: String(unidades), s: "unidades" },
        { t: "Propinas", v: money(propinas) },
        { t: "Descuentos y cortesías", v: money(descuentos) },
        { t: "Cuentas canceladas", v: String(canceladas.length), s: canceladas.length ? money(canceladas.reduce((s, c) => s + n0(c.montoCancelado), 0)) + " sin cobrar" : "ninguna" },
      ]} />

      <Seccion titulo="Cobrado por método de pago" nota="Incluye las propinas que se cobraron junto con la cuenta.">
        <Tabla
          cols={[{ t: "Método", v: (f) => etMetodo(f) }, { t: "Pagos", d: true, v: (f) => conteoPagos[f] || 0 }, { t: "Monto", d: true, v: (f) => money(n0(d.porMetodo[f])) }, { t: "% del total", d: true, v: (f) => pctDe(n0(d.porMetodo[f]), totalMetodos) }]}
          filas={METODOS} pie={["Total", Object.values(conteoPagos).reduce((a, b) => a + b, 0), money(totalMetodos), totalMetodos > 0 ? "100%" : "—"]}
        />
      </Seccion>

      <Seccion titulo="Ventas por mesero">
        <Tabla
          cols={[{ t: "Mesero", v: (f) => f[0] }, { t: "Cuentas", d: true, v: (f) => f[1].cuentas }, { t: "Promedio", d: true, v: (f) => money(f[1].total / f[1].cuentas) }, { t: "Propinas", d: true, v: (f) => money(f[1].propinas) }, { t: "Total", d: true, v: (f) => money(f[1].total) }]}
          filas={filasMeseros} pie={["Total", cuentas.length, "", money(propinas), money(d.total)]}
        />
      </Seccion>

      <Seccion titulo="Ventas por hora">
        <Tabla
          cols={[{ t: "Hora", w: "14%", v: (f) => hourLabel(f[0]) }, { t: "", v: (f) => <BarraImp valor={f[1]} max={maxHora} /> }, { t: "Total", d: true, w: "22%", v: (f) => money(f[1]) }, { t: "%", d: true, w: "12%", v: (f) => pctDe(f[1], d.total) }]}
          filas={horas}
        />
      </Seccion>

      <Seccion titulo="Productos vendidos" nota="Ordenados de mayor a menor venta. Los valores son antes de descuentos y propinas.">
        <Tabla
          cols={[{ t: "#", w: "6%", v: (_f, i) => i + 1 }, { t: "Producto", v: (f) => f[0] }, { t: "Cant.", d: true, v: (f) => f[1].qty }, { t: "Venta", d: true, v: (f) => money(f[1].subtotal) }, { t: "% de ventas", d: true, v: (f) => pctDe(f[1].subtotal, totalProductos) }]}
          filas={productos} pie={["", "Total", unidades, money(totalProductos), totalProductos > 0 ? "100%" : "—"]}
        />
      </Seccion>

      <Seccion titulo="Detalle de cuentas cobradas" salto>
        <Tabla
          cols={[
            { t: "Hora", w: "9%", v: (c) => timeLabel(c.pagadaTs) },
            { t: "Mesa", w: "11%", v: (c) => mesaNombre(mesas, c.mesa) },
            { t: "Mesero", w: "12%", v: (c) => c.mesero || "—" },
            { t: "Consumo", v: (c) => consumo(c) || "—" },
            { t: "Pago", w: "13%", v: (c) => metodos(c) },
            { t: "Propina", d: true, w: "10%", v: (c) => (n0(c.propina && c.propina.monto) ? money(c.propina.monto) : "—") },
            { t: "Desc.", d: true, w: "9%", v: (c) => (n0(c.descuento && c.descuento.monto) ? money(c.descuento.monto) : "—") },
            { t: "Total", d: true, w: "12%", v: (c) => money(c.total) },
          ]}
          filas={cuentas.map((c) => ({ ...c, __sub: (c.pagos || []).length > 1 ? `Pago dividido: ${c.pagos.map((p) => `${money(p.monto)} ${etMetodo(p.metodoPago).toLowerCase()}${p.procesadoPor ? ` (${p.procesadoPor})` : ""}`).join(" · ")}` : null }))}
          pie={["", "", "", "", "", money(propinas), money(descuentos), money(d.total)]}
        />
      </Seccion>

      {canceladas.length > 0 && (
        <Seccion titulo="Cuentas canceladas sin cobrar" nota="Para control: quién canceló y por qué.">
          <Tabla
            cols={[{ t: "Hora", w: "10%", v: (c) => timeLabel(c.canceladaTs) }, { t: "Mesa", w: "14%", v: (c) => mesaNombre(mesas, c.mesa) }, { t: "Canceló", w: "16%", v: (c) => c.canceladaPor || "—" }, { t: "Motivo", v: (c) => c.motivoCancelacion || "—" }, { t: "Monto", d: true, w: "14%", v: (c) => money(n0(c.montoCancelado)) }]}
            filas={canceladas} pie={["", "", "", "Total", money(canceladas.reduce((s, c) => s + n0(c.montoCancelado), 0))]}
          />
        </Seccion>
      )}

      <Firmas etiquetas={["Elaboró", "Revisó (administración)"]} nombres={[nombreUsuario(usuario), ""]} />
    </Hoja>
  );
}

/* ═════════════════════════ 2) Reporte de un período (Reportes) ═════════════════════════ */
export function HojaReporte({ etiqueta, rangoTxt, pagadas, orders, canceladas = [], costoPorId = {}, tiempoCocina, config, usuario }) {
  const total = pagadas.reduce((s, c) => s + cuentaGranTotal(orders, c), 0);
  const propinas = pagadas.reduce((s, c) => s + n0(c.propina && c.propina.monto), 0);
  const descuentos = pagadas.reduce((s, c) => s + n0(c.descuento && c.descuento.monto), 0);
  const bruto = total + descuentos - propinas;

  const productos = {};
  let venta = 0, costo = 0, hayCostos = false, unidades = 0;
  pagadas.forEach((c) => cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado").forEach((o) => o.items.forEach((it) => {
    const p = (productos[it.name] = productos[it.name] || { qty: 0, venta: 0, costo: 0 });
    const cu = it.cost !== undefined && it.cost !== null ? it.cost : (costoPorId[it.id] || 0);
    if (cu > 0) hayCostos = true;
    p.qty += it.qty; p.venta += it.qty * it.price; p.costo += it.qty * cu;
    venta += it.qty * it.price; costo += it.qty * cu; unidades += it.qty;
  })));
  const margen = venta - costo;
  const listaProductos = Object.entries(productos).sort((a, b) => b[1].venta - a[1].venta);

  const metodos = {}; const pagosCont = {};
  pagadas.forEach((c) => pagosDe(c).forEach((p) => { metodos[p.metodoPago] = (metodos[p.metodoPago] || 0) + p.monto; pagosCont[p.metodoPago] = (pagosCont[p.metodoPago] || 0) + 1; }));
  const totalMetodos = Object.values(metodos).reduce((a, b) => a + b, 0);

  const dias = {};
  pagadas.forEach((c) => { const k = dayKey(c.pagadaTs); const v = (dias[k] = dias[k] || { ts: c.pagadaTs, cuentas: 0, total: 0, propinas: 0 }); v.cuentas += 1; v.total += cuentaGranTotal(orders, c); v.propinas += n0(c.propina && c.propina.monto); });
  const listaDias = Object.entries(dias).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDia = Math.max(0, ...listaDias.map(([, v]) => v.total));
  const mejorDia = listaDias.slice().sort((a, b) => b[1].total - a[1].total)[0];

  const horas = {};
  pagadas.forEach((c) => { const h = new Date(c.pagadaTs).getHours(); horas[h] = (horas[h] || 0) + cuentaGranTotal(orders, c); });
  const listaHoras = Object.entries(horas).map(([h, v]) => [Number(h), v]).sort((a, b) => a[0] - b[0]);
  const maxHora = Math.max(0, ...listaHoras.map(([, v]) => v));

  const meseros = {};
  pagadas.forEach((c) => { const k = c.mesero || "Sin asignar"; const v = (meseros[k] = meseros[k] || { cuentas: 0, total: 0, propinas: 0 }); v.cuentas += 1; v.total += cuentaGranTotal(orders, c); v.propinas += n0(c.propina && c.propina.monto); });
  const listaMeseros = Object.entries(meseros).sort((a, b) => b[1].total - a[1].total);
  const totalCancelado = canceladas.reduce((s, c) => s + n0(c.montoCancelado), 0);

  return (
    <Hoja config={config} usuario={usuario} titulo={`Reporte de ventas — ${etiqueta}`} subtitulo={rangoTxt}>
      <Kpis items={[
        { t: "Total cobrado", v: money(total) },
        { t: "Cuentas", v: String(pagadas.length), s: pagadas.length ? `Promedio por cuenta ${money(total / pagadas.length)}` : undefined },
        { t: "Productos vendidos", v: String(unidades), s: "unidades" },
        { t: "Propinas", v: money(propinas) },
        { t: hayCostos ? "Margen estimado" : "Descuentos", v: hayCostos ? money(margen) : money(descuentos), s: hayCostos ? `${venta > 0 ? Math.round((margen / venta) * 100) : 0}% de las ventas` : undefined },
        { t: "Mejor día", v: mejorDia ? money(mejorDia[1].total) : "—", s: mejorDia ? dayLabel(mejorDia[1].ts) : undefined },
      ]} />

      <Seccion titulo="Resumen financiero">
        <Datos filas={[
          ["Consumo bruto (antes de descuentos)", money(bruto)],
          ["Descuentos y cortesías", `− ${money(descuentos)}`],
          ["Propinas", `+ ${money(propinas)}`],
          ["Total cobrado", <b key="t">{money(total)}</b>],
          hayCostos && ["Costo de productos vendidos", `− ${money(costo)}`],
          hayCostos && ["Margen (utilidad bruta)", <b key="m">{money(margen)} ({venta > 0 ? Math.round((margen / venta) * 100) : 0}%)</b>],
          ["Cuentas canceladas sin cobrar", `${canceladas.length} · ${money(totalCancelado)}`],
          tiempoCocina && ["Tiempo promedio de cocina", `${tiempoCocina.min} min (${tiempoCocina.n} pedidos)`],
        ]} />
        {!hayCostos && <div className="imp-nota" style={{ marginTop: 4 }}>Aún no hay costos cargados en los productos, por eso no se calcula el margen.</div>}
      </Seccion>

      <Seccion titulo="Cobrado por método de pago">
        <Tabla
          cols={[{ t: "Método", v: (k) => etMetodo(k) }, { t: "Pagos", d: true, v: (k) => pagosCont[k] || 0 }, { t: "Monto", d: true, v: (k) => money(n0(metodos[k])) }, { t: "% del total", d: true, v: (k) => pctDe(n0(metodos[k]), totalMetodos) }]}
          filas={METODOS} pie={["Total", Object.values(pagosCont).reduce((a, b) => a + b, 0), money(totalMetodos), totalMetodos > 0 ? "100%" : "—"]}
        />
      </Seccion>

      {listaDias.length > 1 && (
        <Seccion titulo="Ventas por día">
          <Tabla
            cols={[{ t: "Día", w: "26%", v: (f) => dayLabel(f[1].ts) }, { t: "", v: (f) => <BarraImp valor={f[1].total} max={maxDia} /> }, { t: "Cuentas", d: true, w: "11%", v: (f) => f[1].cuentas }, { t: "Propinas", d: true, w: "14%", v: (f) => money(f[1].propinas) }, { t: "Total", d: true, w: "15%", v: (f) => money(f[1].total) }]}
            filas={listaDias} pie={["Total", "", pagadas.length, money(propinas), money(total)]}
          />
        </Seccion>
      )}

      <Seccion titulo="Ventas por hora">
        <Tabla
          cols={[{ t: "Hora", w: "14%", v: (f) => hourLabel(f[0]) }, { t: "", v: (f) => <BarraImp valor={f[1]} max={maxHora} /> }, { t: "Total", d: true, w: "22%", v: (f) => money(f[1]) }, { t: "%", d: true, w: "12%", v: (f) => pctDe(f[1], total) }]}
          filas={listaHoras}
        />
      </Seccion>

      <Seccion titulo="Ventas por mesero">
        <Tabla
          cols={[{ t: "Mesero", v: (f) => f[0] }, { t: "Cuentas", d: true, v: (f) => f[1].cuentas }, { t: "Promedio", d: true, v: (f) => money(f[1].total / f[1].cuentas) }, { t: "Propinas", d: true, v: (f) => money(f[1].propinas) }, { t: "Total", d: true, v: (f) => money(f[1].total) }]}
          filas={listaMeseros} pie={["Total", pagadas.length, "", money(propinas), money(total)]}
        />
      </Seccion>

      <Seccion titulo="Productos vendidos" nota={hayCostos ? "Costo y margen calculados con el costo de cada producto al momento de la venta." : "Ordenados de mayor a menor venta."} salto>
        <Tabla
          cols={hayCostos
            ? [{ t: "#", w: "5%", v: (_f, i) => i + 1 }, { t: "Producto", v: (f) => f[0] }, { t: "Cant.", d: true, v: (f) => f[1].qty }, { t: "Venta", d: true, v: (f) => money(f[1].venta) }, { t: "Costo", d: true, v: (f) => money(f[1].costo) }, { t: "Margen", d: true, v: (f) => money(f[1].venta - f[1].costo) }, { t: "% ventas", d: true, v: (f) => pctDe(f[1].venta, venta) }]
            : [{ t: "#", w: "6%", v: (_f, i) => i + 1 }, { t: "Producto", v: (f) => f[0] }, { t: "Cant.", d: true, v: (f) => f[1].qty }, { t: "Venta", d: true, v: (f) => money(f[1].venta) }, { t: "% ventas", d: true, v: (f) => pctDe(f[1].venta, venta) }]}
          filas={listaProductos}
          pie={hayCostos ? ["", "Total", unidades, money(venta), money(costo), money(margen), "100%"] : ["", "Total", unidades, money(venta), venta > 0 ? "100%" : "—"]}
        />
      </Seccion>

      {canceladas.length > 0 && (
        <Seccion titulo="Cuentas canceladas sin cobrar" nota="Para control: quién canceló y por qué.">
          <Tabla
            cols={[{ t: "Fecha", w: "20%", v: (c) => dateTimeLabel(c.canceladaTs) }, { t: "Canceló", w: "16%", v: (c) => c.canceladaPor || "—" }, { t: "Motivo", v: (c) => c.motivoCancelacion || "—" }, { t: "Monto", d: true, w: "14%", v: (c) => money(n0(c.montoCancelado)) }]}
            filas={canceladas} pie={["", "", "Total", money(totalCancelado)]}
          />
        </Seccion>
      )}

      <Firmas etiquetas={["Elaboró", "Revisó (administración)"]} nombres={[nombreUsuario(usuario), ""]} />
    </Hoja>
  );
}

/* ═════════════════════════ 3) Cierre de caja de un turno ═════════════════════════ */
function ventasDeTurno(tr, cuentas) {
  const fin = tr.cierreTs || Date.now();
  const pm = ventasEnRango(cuentas || [], tr.aperturaTs, fin + 1);
  return {
    efectivo: typeof tr.ventasEfectivo === "number" ? tr.ventasEfectivo : pm.efectivo,
    tarjeta: typeof tr.tarjetaEsperada === "number" ? tr.tarjetaEsperada : pm.tarjeta,
    transferencia: typeof tr.transferenciaEsperada === "number" ? tr.transferenciaEsperada : pm.transferencia,
    propinas: typeof tr.propinas === "number" ? tr.propinas : propinasEnRango(cuentas || [], tr.aperturaTs, fin + 1),
  };
}

function TurnoDetalle({ turno, cuentas, usuario, conFirmas = true, salto = false }) {
  const v = ventasDeTurno(turno, cuentas);
  const total = v.efectivo + v.tarjeta + v.transferencia;
  const fin = turno.cierreTs || Date.now();
  const tramos = tramosDe(turno);
  const difEf = tramos.reduce((a, t) => a + n0(t.diferencia), 0);
  const difOtros = n0(turno.difTarjeta) + n0(turno.difTransferencia);
  const entregas = turno.relevos ? Object.keys(turno.relevos).length : 0;
  return (
    <div className={salto ? "imp-salto" : ""}>
      <Kpis items={[
        { t: "Total vendido", v: money(total) },
        { t: "Propinas", v: money(v.propinas) },
        { t: "Diferencia total", v: (difEf + difOtros) === 0 ? "Cuadró" : money(difEf + difOtros), s: (difEf + difOtros) === 0 ? "sin diferencias" : (difEf + difOtros) > 0 ? "sobró" : "faltó" },
      ]} />
      <Seccion titulo="Datos del turno">
        <Datos filas={[
          ["Apertura", `${dateTimeLabel(turno.aperturaTs)} · ${turno.abiertoPor || "—"}`],
          ["Cierre", turno.cierreTs ? `${dateTimeLabel(turno.cierreTs)} · ${turno.cerradoPor || "—"}` : "Turno todavía abierto"],
          ["Duración", duracionLabel(fin - turno.aperturaTs)],
          ["Base inicial de efectivo", money(n0(turno.baseEfectivo))],
          ["Entregas de caja entre turnos", String(entregas)],
        ]} />
      </Seccion>
      <div className="imp-resumen-dia">
        <ResumenDia turno={turno} cuentas={cuentas} />
      </div>
      {conFirmas && <Firmas etiquetas={["Cajero(a) que cerró", "Administración"]} nombres={[turno.cerradoPor || nombreUsuario(usuario), ""]} />}
    </div>
  );
}

export function HojaTurno({ turno, cuentas, config, usuario }) {
  return (
    <Hoja config={config} usuario={usuario} titulo="Cierre de caja" subtitulo={`${dayLabel(turno.aperturaTs)} · ${timeLabel(turno.aperturaTs)}${turno.cierreTs ? " → " + timeLabel(turno.cierreTs) : ""}`}>
      <TurnoDetalle turno={turno} cuentas={cuentas} usuario={usuario} />
    </Hoja>
  );
}

/* ═════════════════════════ 4) Cierre del mes: cuadro de turnos + detalle de cada uno ═════════════════════════ */
export function HojaMes({ mes, cuentas, config, usuario }) {
  const turnos = mes.items.slice().sort((a, b) => a.aperturaTs - b.aperturaTs);
  const filas = turnos.map((tr) => {
    const v = ventasDeTurno(tr, cuentas);
    const difEf = tramosDe(tr).reduce((a, t) => a + n0(t.diferencia), 0);
    const difOtros = n0(tr.difTarjeta) + n0(tr.difTransferencia);
    return { tr, ...v, total: v.efectivo + v.tarjeta + v.transferencia, difEf, difOtros };
  });
  const suma = (k) => filas.reduce((s, f) => s + f[k], 0);
  const conDif = filas.filter((f) => f.difEf !== 0 || f.difOtros !== 0).length;
  const difNeta = suma("difEf") + suma("difOtros");
  const dif = (x) => (x === 0 ? "—" : x > 0 ? `+${money(x)}` : `−${money(Math.abs(x))}`);
  return (
    <Hoja config={config} usuario={usuario} titulo={`Cierres de caja — ${mes.titulo}`} subtitulo={`${turnos.length} ${turnos.length === 1 ? "turno" : "turnos"} · ${conDif === 0 ? "todos cuadraron" : `${conDif} con diferencia`}`}>
      <Kpis items={[
        { t: "Total vendido", v: money(suma("total")) },
        { t: "Turnos", v: String(turnos.length), s: `${turnos.length - conDif} cuadraron` },
        { t: "Diferencia neta", v: difNeta === 0 ? "Cuadró" : dif(difNeta), s: difNeta === 0 ? undefined : difNeta > 0 ? "sobró en total" : "faltó en total" },
        { t: "Efectivo", v: money(suma("efectivo")) },
        { t: "Tarjeta", v: money(suma("tarjeta")) },
        { t: "Transferencia", v: money(suma("transferencia")) },
      ]} />
      <Seccion titulo="Turnos del mes">
        <Tabla
          cols={[
            { t: "Fecha", v: (f) => dateTimeLabel(f.tr.aperturaTs) },
            { t: "Abrió / cerró", v: (f) => `${f.tr.abiertoPor || "—"} / ${f.tr.cerradoPor || "—"}` },
            { t: "Efectivo", d: true, v: (f) => money(f.efectivo) },
            { t: "Tarjeta", d: true, v: (f) => money(f.tarjeta) },
            { t: "Transf.", d: true, v: (f) => money(f.transferencia) },
            { t: "Total", d: true, v: (f) => money(f.total) },
            { t: "Dif. efectivo", d: true, v: (f) => dif(f.difEf) },
            { t: "Dif. tarjeta/transf.", d: true, v: (f) => dif(f.difOtros) },
          ]}
          filas={filas}
          pie={["Total del mes", "", money(suma("efectivo")), money(suma("tarjeta")), money(suma("transferencia")), money(suma("total")), dif(suma("difEf")), dif(suma("difOtros"))]}
        />
      </Seccion>
      <Firmas etiquetas={["Elaboró", "Administración"]} nombres={[nombreUsuario(usuario), ""]} />
      {turnos.map((tr) => (
        <div key={tr.id} className="imp-salto">
          <div className="imp-h2" style={{ fontSize: "12pt" }}>Detalle · {dayLabel(tr.aperturaTs)}, {timeLabel(tr.aperturaTs)}{tr.cierreTs ? ` → ${timeLabel(tr.cierreTs)}` : ""}</div>
          <TurnoDetalle turno={tr} cuentas={cuentas} usuario={usuario} conFirmas={false} />
        </div>
      ))}
    </Hoja>
  );
}

// El Excel (xlsx) pesa mucho: se baja solo en el momento de exportar, no al abrir la app.
const cargarXLSX = () => import("xlsx");
import { METODO_META } from "./constantes.js";
import { cuentaOrders, mesaNombre, pagosDe, timeLabel } from "./utilidades.js";

/* La carga/guardado de datos en vivo ahora vive en ./firebase.js (Firebase Realtime Database) */

export function descargarRespaldo({ menu, orders, cuentas, config, turnos, mesas, deudas }) {
  const data = { version: 2, exportadoTs: Date.now(), menu, orders, cuentas, config, turnos, mesas, ...(deudas ? { deudas } : {}) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${(config.businessName || "comandas").replace(/\s+/g, "_")}_respaldo_${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportarExcel(cuentas, orders, config, mesas) {
  const XLSX = await cargarXLSX();
  const pagadas = cuentas.filter((c) => c.estado === "pagada").sort((a, b) => a.pagadaTs - b.pagadaTs);
  const filasPagos = [];
  pagadas.forEach((c) => {
    pagosDe(c).forEach((p) => {
      filasPagos.push({
        Fecha: new Date(c.pagadaTs).toLocaleDateString("es-CO"),
        Hora: timeLabel(p.ts),
        Mesa: mesaNombre(mesas, c.mesa),
        Mesero: c.mesero || "",
        Etiqueta: p.etiqueta || "Cuenta completa",
        Método: METODO_META[p.metodoPago]?.label || p.metodoPago,
        Monto: p.monto,
        "Cobrado por": p.procesadoPor || "",
        Ítems: p.items && p.items.length ? p.items.map((it) => `${it.qty}x ${it.name}`).join(", ") : "",
      });
    });
  });

  const productoMap = {};
  pagadas.forEach((c) => {
    cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado").forEach((o) =>
      o.items.forEach((it) => {
        if (!productoMap[it.name]) productoMap[it.name] = { qty: 0, subtotal: 0 };
        productoMap[it.name].qty += it.qty;
        productoMap[it.name].subtotal += it.qty * it.price;
      })
    );
  });
  const filasProductos = Object.entries(productoMap)
    .sort((a, b) => b[1].subtotal - a[1].subtotal)
    .map(([name, d]) => ({ Producto: name, Cantidad: d.qty, Subtotal: d.subtotal }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasPagos), "Pagos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasProductos), "Productos");
  XLSX.writeFile(wb, `${(config.businessName || "comandas").replace(/\s+/g, "_")}_historial.xlsx`);
}

/** Excel de cuentas pendientes (para el administrador): una fila por deuda, con lo cobrado después y lo condonado. */
export async function exportarDeudas(deudas, config) {
  const XLSX = await cargarXLSX();
  const filas = [...deudas].sort((a, b) => a.ts - b.ts).map((d) => {
    const cobros = Array.isArray(d.cobros) ? d.cobros : Object.values(d.cobros || {});
    return {
      Fecha: new Date(d.ts).toLocaleDateString("es-CO"),
      Cliente: (d.cliente && d.cliente.nombre) || "",
      Teléfono: (d.cliente && d.cliente.telefono) || "",
      Documento: (d.cliente && d.cliente.doc) || "",
      Mesa: d.lugar || d.mesa || "",
      "Total cuenta": d.total,
      "Pagado ese día": d.pagadoAntes || 0,
      "Saldo que quedó": (d.total || 0) - (d.pagadoAntes || 0),
      "Cobrado después": cobros.reduce((s, c) => s + (c.monto || 0), 0),
      Condonado: d.saldoCondonado || 0,
      "Saldo actual": d.saldo || 0,
      Estado: d.estado === "pendiente" ? "Pendiente" : d.estado === "pagada" ? "Pagada" : "Condonada",
      "Registrada por": d.registradaPor || "",
      "Motivo de condonación": (d.condonacion && d.condonacion.motivo) || "",
      Nota: d.nota || "",
    };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), "Cuentas pendientes");
  XLSX.writeFile(wb, `${((config && config.businessName) || "comandas").replace(/\s+/g, "_")}_cuentas_pendientes.xlsx`);
}

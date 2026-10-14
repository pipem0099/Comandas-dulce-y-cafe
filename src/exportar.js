import * as XLSX from "xlsx";
import { METODO_META } from "./constantes.js";
import { cuentaOrders, mesaNombre, pagosDe, timeLabel } from "./utilidades.js";

/* La carga/guardado de datos en vivo ahora vive en ./firebase.js (Firebase Realtime Database) */

export function descargarRespaldo({ menu, orders, cuentas, config, turnos, mesas }) {
  const data = { version: 2, exportadoTs: Date.now(), menu, orders, cuentas, config, turnos, mesas };
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

export function exportarExcel(cuentas, orders, config, mesas) {
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
        Ítems: p.items ? p.items.map((it) => `${it.qty}x ${it.name}`).join(", ") : "",
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

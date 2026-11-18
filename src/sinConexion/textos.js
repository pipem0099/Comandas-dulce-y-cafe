/* Textos en lenguaje de todos los días para los cambios que chocaron al volver el internet (puros: se prueban con `npm run sinconexion:probar`). */
const ETIQUETA = { cuentas: "Cuenta", orders: "Pedido", deudas: "Cuenta pendiente", turnos: "Turno de caja", inventario: "Inventario", reservas: "Reserva", auditoria: "Registro de control", facturacion: "Factura electrónica" };
const MOTIVO = {
  "cuenta-cerrada-en-otro-dispositivo": "Aquí se registró un cobro, pero esa cuenta ya se había cerrado o cambiado desde otro dispositivo. No se aplicó para no cobrar dos veces. Revisa la cuenta y, si hace falta, cóbrala de nuevo.",
  "creado-en-ambos": "El mismo registro se creó en dos dispositivos a la vez. Se conservó el que ya estaba en el servidor.",
  "borrado-en-servidor": "Ese registro se borró desde otro dispositivo mientras aquí se editaba.",
  "sin-permiso": "Esta cuenta no tiene permiso para guardar ese cambio.",
  "facturacion-no-disponible": "La factura de esta cuenta no se pudo enviar: la facturación electrónica no está disponible en el servidor. Avísale al administrador y emítela de nuevo desde Caja.",
};
const dinero = (n) => `$${Math.round(n).toLocaleString("es-CO")}`;

export function rutaDe(op) { return op.ruta || (op.pedido ? `orders/${op.pedido.id}` : ""); }

export function describirConflicto(cf) {
  const ruta = rutaDe(cf);
  const [col, id] = ruta.split("/");
  const titulo = `${ETIQUETA[col] || col || "Cambio"}${id ? ` ${id.length > 14 ? `…${id.slice(-8)}` : id}` : ""}`;
  const motivo = (cf.detalle && cf.detalle.motivo) || "error";
  let detalle = MOTIVO[motivo] || (cf.detalle && cf.detalle.mensaje) || "Este cambio no se pudo guardar.";
  if (cf.tipo === "registro" && cf.nuevo && Array.isArray(cf.nuevo.pagos)) {
    const viejos = new Set(((cf.base && cf.base.pagos) || []).map((p) => p && p.id));
    const monto = cf.nuevo.pagos.filter((p) => p && !viejos.has(p.id)).reduce((s, p) => s + (Number(p.monto) || 0), 0);
    if (monto > 0) detalle += ` Monto cobrado aquí sin sincronizar: ${dinero(monto)}.`;
  }
  return { titulo, detalle };
}

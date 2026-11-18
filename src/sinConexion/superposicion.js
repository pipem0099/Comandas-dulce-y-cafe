/*
 * Superposición: muestra los cambios pendientes ENCIMA de lo último que se sabe del servidor, para que la persona vea su trabajo
 * (el pedido recién tomado, la cuenta recién cobrada) aunque todavía no haya internet. Pura: se prueba con `npm run offline:probar`.
 */
const partes = (ruta) => String(ruta).split("/").filter(Boolean);

/** `coleccion` = "orders", "cuentas"...; `registros` = lista tal como llegó del servidor (o de la copia local). Devuelve la lista con los pendientes aplicados. */
export function aplicarPendientes(ops, coleccion, registros) {
  const mapa = new Map((registros || []).filter(Boolean).map((r) => [String(r.id), r]));
  for (const op of ops) {
    if (op.tipo === "pedidoStock") {
      if (coleccion === "orders" && op.pedido) mapa.set(String(op.pedido.id), op.pedido);
      if (coleccion === "inventario") for (const [insumoId, d] of Object.entries(op.deltas || {})) { const r = mapa.get(String(insumoId)); if (r && d) mapa.set(String(insumoId), { ...r, stock: (Number(r.stock) || 0) + d }); }
      continue;
    }
    const p = partes(op.ruta);
    if (p[0] !== coleccion) continue;
    if (op.tipo === "registro" || op.tipo === "set") {
      if (p.length !== 2) continue;
      mapa.set(p[1], { ...(op.tipo === "registro" ? op.nuevo : op.valor), id: p[1] });
    } else if (op.tipo === "mezclar") {
      if (p.length !== 2) continue;
      mapa.set(p[1], { ...(mapa.get(p[1]) || { id: p[1] }), ...op.parche });
    } else if (op.tipo === "borrar") {
      if (p.length === 2) mapa.delete(p[1]);
    } else if (op.tipo === "incremento") {
      if (p.length === 3) { const r = mapa.get(p[1]); if (r) mapa.set(p[1], { ...r, [p[2]]: (Number(r[p[2]]) || 0) + op.delta }); }
    }
  }
  return [...mapa.values()];
}

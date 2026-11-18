/*
 * Impresión automática de tickets de cocina: en el equipo de la cocina, cada pedido NUEVO sale impreso una sola vez.
 * Se recuerda en el equipo qué pedidos ya salieron (sobrevive a recargar) y solo se imprimen los llegados después de activar la opción.
 */
const CLAVE = "termica:impresos";
const MAX = 400;

export function crearControlImpresos(almacen = typeof localStorage !== "undefined" ? localStorage : null) {
  const leer = () => { try { return new Set(JSON.parse((almacen && almacen.getItem(CLAVE)) || "[]")); } catch (_) { return new Set(); } };
  return {
    ya: (id) => leer().has(id),
    marcar: (id) => { const s = leer(); s.add(id); const lista = [...s].slice(-MAX); try { if (almacen) almacen.setItem(CLAVE, JSON.stringify(lista)); } catch (_) { /* sin espacio */ } },
  };
}

/** Pedidos de cocina que todavía hay que imprimir: nuevos (pendientes), llegados después de activar la opción y no impresos antes. */
export function pedidosPorImprimir(orders, { activadoTs, yaImpreso }) {
  return (orders || []).filter((o) => o && o.estado === "pendiente" && o.ts >= activadoTs && !yaImpreso(o.id)).sort((a, b) => a.ts - b.ts);
}

/*
 * Servicio de impresión de comandas de ESTE equipo (une la lógica pura de comandaMesero.js con la impresora real y Firebase).
 * Las marcas «ya se imprimió» se anotan en el pedido solo cuando la impresora confirmó (con o sin internet: se envían solas al volver).
 */
import { impresora } from "./impresora.js";
import { crearServicioComandas } from "./comandaMesero.js";
import { ticketCocina, ticketAjusteCocina } from "./tickets.js";
import { updateRecord } from "../firebase.js";

const opciones = () => { const c = impresora.config(); return { columnas: c.columnas, tabla: c.tabla }; };

/** Anota en el pedido que esa impresión ya salió (se une a las marcas que ya tenía). */
export const marcarImpresion = (pedido, clave, marca) => updateRecord("orders", pedido.id, { impresiones: { ...(pedido.impresiones || {}), [clave]: marca } });

export const servicioComandas = crearServicioComandas({
  impresora, marcar: marcarImpresion,
  armar: {
    nuevo: (pedido, ctx) => ticketCocina({ pedido: { ...pedido, items: ctx.items || pedido.items }, lugar: ctx.lugar, mesero: ctx.mesero, ronda: ctx.ronda, destino: ctx.destino }, opciones()),
    ajuste: (pedido, ajuste, ctx) => ticketAjusteCocina({ pedido, ajuste: ctx.ajuste || ajuste, lugar: ctx.lugar, mesero: ctx.mesero, ronda: ctx.ronda }, opciones()),
    reimpresion: (pedido, ctx) => ticketCocina({ pedido: { ...pedido, items: ctx.items || pedido.items }, lugar: ctx.lugar, mesero: ctx.mesero, ronda: ctx.ronda, destino: ctx.destino, reimpresion: true }, opciones()),
  },
});

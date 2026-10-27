import { estadoStock, money } from "./logica.js";
import { dayKey } from "./utilidades.js";

/*
 * Alertas para el dueño: cosas que conviene mirar sin tener que ir a buscarlas.
 * nivel: "alta" (atender ya) · "media" (revisar hoy) · "info" (para tener en cuenta)
 * Cada alerta trae `vista` (a qué pantalla ir) y `donde` (el camino dentro de esa pantalla).
 */
const HORAS_TURNO_MEDIA = 12;
const HORAS_TURNO_ALTA = 18;
const DIAS_AVISO_VENCE = 7;

const n0 = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const listaCorta = (nombres, max = 4) => (nombres.length <= max ? nombres.join(", ") : `${nombres.slice(0, max).join(", ")} y ${nombres.length - max} más`);

export function calcularAlertas({ turnoAbierto, cuentas = [], menu = [], insumos = [], errores = [], config = {}, ahora = Date.now() }) {
  const alertas = [];
  const hoy = dayKey(ahora);

  /* 1) Caja abierta demasiado tiempo */
  if (turnoAbierto) {
    const horas = (ahora - turnoAbierto.aperturaTs) / 3600000;
    if (horas >= HORAS_TURNO_MEDIA) {
      alertas.push({
        id: "turno-largo", nivel: horas >= HORAS_TURNO_ALTA ? "alta" : "media",
        titulo: `La caja lleva ${Math.floor(horas)} h abierta`,
        detalle: "Un turno muy largo dificulta el cuadre. Conviene cerrar y abrir uno nuevo con quien siga.",
        vista: "caja", donde: "Caja › Resumen",
      });
    }
  }

  /* 2) Cancelaciones de hoy */
  const canceladas = cuentas.filter((c) => c.estado === "cancelada" && n0(c.montoCancelado) > 0 && c.canceladaTs && dayKey(c.canceladaTs) === hoy);
  if (canceladas.length >= 3) {
    const total = canceladas.reduce((s, c) => s + n0(c.montoCancelado), 0);
    alertas.push({
      id: "cancelaciones", nivel: canceladas.length >= 5 ? "alta" : "media",
      titulo: `${canceladas.length} cuentas canceladas hoy`,
      detalle: `Suman ${money(total)} sin cobrar. Revisa quién las canceló y los motivos.`,
      vista: "caja", donde: "Caja › Historial",
    });
  }

  /* 3) Descuentos y cortesías de hoy */
  const pagadasHoy = cuentas.filter((c) => c.estado === "pagada" && c.pagadaTs && dayKey(c.pagadaTs) === hoy);
  const conDescuento = pagadasHoy.filter((c) => n0(c.descuento && c.descuento.monto) > 0);
  if (conDescuento.length > 0) {
    const totalDesc = conDescuento.reduce((s, c) => s + n0(c.descuento.monto), 0);
    const totalVendido = pagadasHoy.reduce((s, c) => s + n0(c.total), 0) || 1;
    const proporcion = totalDesc / (totalVendido + totalDesc);
    if (conDescuento.length >= 3 || (proporcion >= 0.1 && totalDesc >= 10000)) {
      alertas.push({
        id: "descuentos", nivel: proporcion >= 0.1 && totalDesc >= 10000 ? "alta" : "media",
        titulo: `${conDescuento.length} ${conDescuento.length === 1 ? "cuenta con descuento" : "cuentas con descuento"} hoy`,
        detalle: `${money(totalDesc)} en descuentos y cortesías (${Math.round(proporcion * 100)}% de lo que se habría vendido).`,
        vista: "caja", donde: "Caja › Historial",
      });
    }
  }

  /* 4) Productos del menú marcados como agotados */
  const agotadosMenu = menu.filter((m) => m.agotado).map((m) => m.name);
  if (agotadosMenu.length > 0) {
    alertas.push({
      id: "menu-agotado", nivel: "info",
      titulo: `${agotadosMenu.length} ${agotadosMenu.length === 1 ? "producto agotado" : "productos agotados"} en el menú`,
      detalle: listaCorta(agotadosMenu), vista: "mesero", donde: "Ajustes › Menú y precios",
    });
  }

  /* 5) Inventario: agotados, por agotarse, vencidos y por vencer */
  const hoyMs = new Date(ahora); hoyMs.setHours(0, 0, 0, 0);
  const dias = (v) => (v ? Math.round((new Date(`${v}T00:00:00`) - hoyMs) / 86400000) : null);
  const vencidos = insumos.filter((i) => dias(i.vence) !== null && dias(i.vence) < 0);
  const porVencer = insumos.filter((i) => dias(i.vence) !== null && dias(i.vence) >= 0 && dias(i.vence) <= DIAS_AVISO_VENCE);
  const agotadosInv = insumos.filter((i) => estadoStock(i) === "agotado");
  const bajosInv = insumos.filter((i) => estadoStock(i) === "bajo");
  if (vencidos.length > 0) alertas.push({ id: "inv-vencidos", nivel: "alta", titulo: `${vencidos.length} ${vencidos.length === 1 ? "artículo vencido" : "artículos vencidos"}`, detalle: listaCorta(vencidos.map((i) => i.nombre)), vista: "caja", donde: "Caja › Inventario" });
  if (porVencer.length > 0) alertas.push({ id: "inv-por-vencer", nivel: "media", titulo: `${porVencer.length} por vencer en ${DIAS_AVISO_VENCE} días`, detalle: listaCorta(porVencer.map((i) => i.nombre)), vista: "caja", donde: "Caja › Inventario" });
  if (agotadosInv.length > 0) alertas.push({ id: "inv-agotados", nivel: "media", titulo: `${agotadosInv.length} ${agotadosInv.length === 1 ? "artículo agotado" : "artículos agotados"} en inventario`, detalle: listaCorta(agotadosInv.map((i) => i.nombre)), vista: "caja", donde: "Caja › Inventario › Compras" });
  if (bajosInv.length > 0) alertas.push({ id: "inv-bajos", nivel: "info", titulo: `${bajosInv.length} por agotarse`, detalle: listaCorta(bajosInv.map((i) => i.nombre)), vista: "caja", donde: "Caja › Inventario › Compras" });

  /* 6) Errores que la propia app registró (últimas 24 horas) */
  const recientes = errores.filter((e) => ahora - e.ts < 24 * 3600 * 1000).sort((a, b) => b.ts - a.ts);
  if (recientes.length > 0) {
    alertas.push({
      id: "errores-app", nivel: recientes.length >= 5 ? "alta" : "media",
      titulo: `La app registró ${recientes.length} ${recientes.length === 1 ? "error" : "errores"} en 24 h`,
      detalle: `Último: ${String(recientes[0].mensaje).slice(0, 90)}. Copia el detalle y pásaselo a quien mantiene la app.`,
      vista: "respaldos", donde: "Ajustes › Respaldos y datos › Errores de la app",
    });
  }

  /* 7) Copia de seguridad completa guardada FUERA de la app */
  const DIA = 24 * 3600 * 1000;
  const ultima = Number(config.ultimaCopiaTs) || 0;
  if (ultima && ahora - ultima > 30 * DIA) {
    alertas.push({ id: "copia-vieja", nivel: "media", titulo: `Hace ${Math.floor((ahora - ultima) / DIA)} días no descargas una copia`, detalle: "Descarga una copia completa y guárdala en Drive o en tu correo; así no dependes de que Firebase esté bien.", vista: "respaldos", donde: "Ajustes › Respaldos y datos" });
  } else if (!ultima && cuentas.some((c) => c.estado === "pagada")) {
    alertas.push({ id: "copia-nunca", nivel: "info", titulo: "Aún no has descargado una copia completa", detalle: "Hazlo una vez al mes y guárdala fuera de la app.", vista: "respaldos", donde: "Ajustes › Respaldos y datos" });
  }

  const orden = { alta: 0, media: 1, info: 2 };
  return alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

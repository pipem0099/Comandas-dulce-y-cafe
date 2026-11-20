/*
 * Payload estándar de «Comandas» para un documento electrónico — función PURA.
 * Es el ÚNICO formato que conocen los adaptadores (src/facturacion/adaptadores/*): cada uno lo traduce al de su proveedor.
 */
import { calcularDesgloseFiscal, cuentaParaFiscal } from "./motor.mjs";
import { configParaMotor } from "./config.mjs";
import { referenciaProveedor } from "./idempotencia.mjs";
import { alertaTopeUvt } from "./alertas.mjs";

const pad = (n) => String(n).padStart(2, "0");
/** Fecha y hora de Colombia (UTC-5, sin horario de verano) de una marca de tiempo. */
export function fechaHoraBogota(ts) {
  const d = new Date(Number(ts) - 5 * 3600 * 1000);
  return { fecha: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, hora: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` };
}

const METODOS = { efectivo: "efectivo", tarjeta: "tarjeta", transferencia: "transferencia" };
export const CONSUMIDOR_FINAL = { tipoDoc: "CC", numero: "222222222222", dv: "", nombre: "Consumidor final", correo: "", direccion: "" };

/** Cliente para el documento: sin datos fiscales (o «Consumidor final») → el genérico de la DIAN (222222222222). */
/** `correoRespaldo` = correo oficial del restaurante: lo usa el consumidor final cuando no dio uno. */
export function clienteParaDocumento(datosFiscales, correoRespaldo = "") {
  const d = datosFiscales;
  if (!d || d.tipoDoc === "CF" || !d.numero) return { consumidorFinal: true, ...CONSUMIDOR_FINAL, correo: (d && d.correo) || correoRespaldo || "" };
  return { consumidorFinal: false, tipoDoc: d.tipoDoc, numero: d.numero, dv: d.dv || "", nombre: d.nombre, correo: d.correo || "", direccion: d.direccion || "", ...(["O-47", "O-48", "R-99-PN"].includes(d.nivelTributario) ? { nivelTributario: d.nivelTributario } : {}) };
}

export function construirPayload({ cuenta, pedidos, ajustes, ahora = Date.now() }) {
  const desglose = calcularDesgloseFiscal(cuentaParaFiscal(cuenta, pedidos), configParaMotor(ajustes));
  const pagos = (Array.isArray(cuenta.pagos) ? cuenta.pagos : Object.values(cuenta.pagos || {})).filter(Boolean)
    .map((p) => ({ metodo: METODOS[p.metodoPago] || "otro", monto: Number(p.monto) || 0 }));
  const { fecha, hora } = fechaHoraBogota(cuenta.pagadaTs || ahora);
  // Documento Equivalente POS: si la cuenta pasa de 5 UVT y la conversión automática está activa (por defecto), se emite Factura Electrónica de Venta.
  const convertida = ajustes.tipoDocumento === "pos" && ajustes.convertirPos !== false
    && !!alertaTopeUvt({ tipoDocumento: "pos", totalDocumento: desglose.totalDocumento, valorUvt: ajustes.valorUvt || undefined });
  return {
    referencia: referenciaProveedor(cuenta.id),
    cuentaId: cuenta.id,
    modo: ajustes.modo,
    tipoDocumento: convertida ? "factura" : ajustes.tipoDocumento,
    ...(convertida ? { convertidoDePos: true } : {}),
    fecha, hora, moneda: "COP",
    resolucion: { ...ajustes.resolucion },
    emisor: { ...((ajustes.emisor) || {}) },
    cliente: clienteParaDocumento(cuenta.datosFiscales, ajustes.emisor && ajustes.emisor.correo),
    lineas: desglose.lineas,
    impuesto: desglose.impuesto,
    preciosIncluyenImpuesto: desglose.preciosIncluyenImpuesto,
    totales: {
      subtotalBruto: desglose.subtotalBruto, descuento: desglose.descuento, baseGravable: desglose.baseGravable, baseExenta: desglose.baseExenta,
      valorImpuesto: desglose.valorImpuesto, propina: desglose.propina.monto, propinaEnDocumento: desglose.propina.enDocumento,
      totalDocumento: desglose.totalDocumento, totalCobrado: desglose.totalCobrado,
    },
    pagos,
    observaciones: `Mesa ${cuenta.mesa === undefined ? "" : cuenta.mesa} · Cuenta ${cuenta.id}`.slice(0, 250),
  };
}

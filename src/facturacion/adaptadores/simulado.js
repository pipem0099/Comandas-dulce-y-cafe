/*
 * Adaptador SIMULADO — 100 % funcional, sin credenciales ni internet. Para demos, capacitación y pruebas automáticas (E2E).
 * NO tiene validez ante la DIAN: el documento y su PDF lo dicen claramente.
 *
 *  · Determinista: la misma referencia (id de la cuenta) siempre da el mismo número y CUFE → los reintentos son idempotentes.
 *  · Para probar errores: un correo de cliente que termine en «@falla.test» simula un rechazo del proveedor, y «@red.test»
 *    simula una caída de la red después de enviar (error «incierto»).
 */
import { ErrorProveedor } from "./interfaz.js";

/** Catálogos de prueba realistas (con la forma que devuelven los proveedores reales) para que todo el flujo funcione en demos y E2E. */
export const CATALOGOS_SIMULADOS = {
  resoluciones: [{ id: "sim-res-1", etiqueta: "SETT · res. 18760000001 · 1-5000 · vence 2027-12-31", prefijo: "SETT", numero: "18760000001", desde: "1", hasta: "5000", vigenciaHasta: "2027-12-31" }, { id: "sim-res-2", etiqueta: "FE · res. 18760000099 · 1-200 · vence 2026-12-01", prefijo: "FE", numero: "18760000099", desde: "1", hasta: "200", vigenciaHasta: "2026-12-01" }],
  impuestos: [{ id: "sim-inc", etiqueta: "INC 8 % · Impuesto nacional al consumo", porcentaje: 8, tipo: "INC" }, { id: "sim-iva", etiqueta: "IVA 19 %", porcentaje: 19, tipo: "IVA" }, { id: "sim-exento", etiqueta: "Exento (0 %)", porcentaje: 0, tipo: "EXENTO" }],
  mediosPago: [{ id: "sim-efectivo", etiqueta: "Efectivo" }, { id: "sim-datafono", etiqueta: "Datáfono (tarjeta)" }, { id: "sim-transf", etiqueta: "Transferencia bancaria" }],
  productos: [{ id: "SIM-CONSUMO", etiqueta: "SIM-CONSUMO · Consumo en restaurante" }, { id: "SIM-PROPINA", etiqueta: "SIM-PROPINA · Propina voluntaria (terceros)" }],
  vendedores: [{ id: "sim-vend-1", etiqueta: "Vendedor de prueba" }],
};

const fnv = (texto, semilla) => { let h = semilla >>> 0; for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const hex96 = (texto) => Array.from({ length: 12 }, (_, i) => fnv(texto, 2166136261 + i * 7919).toString(16).padStart(8, "0")).join("");

export const simulado = {
  id: "simulado",
  nombre: "Simulado (Demos y Pruebas)",
  async probarConexionYSincronizar() { return { ok: true, mensaje: "Conexión simulada correcta. Este proveedor no usa credenciales ni tiene validez ante la DIAN. Catálogos de prueba cargados.", catalogos: CATALOGOS_SIMULADOS }; },
  async emitirDocumento({ payload }) {
    const correo = String((payload.cliente && payload.cliente.correo) || "").toLowerCase();
    if (correo.endsWith("@falla.test")) throw new ErrorProveedor({ mensaje: "Simulado: el proveedor rechazó el documento.", estado: 422, incierto: false, detalle: "HTTP 422 POST /simulado/facturas → {\"error\":\"cliente rechazado por la regla de prueba @falla.test\"}" });
    if (correo.endsWith("@red.test")) throw new ErrorProveedor({ mensaje: "No se pudo conectar con el proveedor.", incierto: true, codigo: "red", detalle: "Simulado: se cortó la conexión después de enviar el documento." });
    const prefijo = (payload.resolucion && payload.resolucion.prefijo) || "SIM";
    const consecutivo = 1 + (fnv(payload.referencia, 2166136261) % 99999);
    return {
      numero: `${prefijo}${consecutivo}`, prefijo, cufe: hex96(`${payload.referencia}|${payload.totales.totalDocumento}`),
      pdfUrl: null, pdfSimulado: true, qrUrl: null, idProveedor: `sim-${payload.referencia}`, estadoProveedor: "SIMULADO_ACEPTADO", correoEnviado: !!(payload.cliente && payload.cliente.correo),
    };
  },
  async anularDocumento({ documento, motivo }) {
    if (!documento || !documento.numero) throw new ErrorProveedor({ mensaje: "Simulado: no hay documento que anular.", estado: 404 });
    return { numeroNota: `NC${documento.numero}`, cufeNota: hex96(`NC|${documento.cufe}|${motivo}`), idProveedor: `sim-nc-${documento.idProveedor}` };
  },
  async reenviarCorreo({ correo }) {
    if (!correo) throw new ErrorProveedor({ mensaje: "Falta el correo.", estado: 400 });
    if (String(correo).toLowerCase().endsWith("@falla.test")) throw new ErrorProveedor({ mensaje: "Simulado: el correo fue rechazado.", estado: 422, detalle: "Simulado: rebote del correo" });
    return { ok: true };
  },
};

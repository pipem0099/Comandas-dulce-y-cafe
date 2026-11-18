/*
 * Contrato común de los adaptadores de facturación electrónica + utilidades HTTP.
 *
 * Cada adaptador exporta un objeto con estas cuatro funciones (todas reciben { credenciales, modo, fetch, mapeo, emisor } además de lo suyo):
 *   probarConexionYSincronizar({ credenciales, modo })              → { ok: true, mensaje, catalogos: { resoluciones, impuestos, mediosPago, productos, vendedores } }
 *      (cada elemento: { id, etiqueta, ... }; el administrador los mapea con selectores y quedan en `mapeo`: CERO ids quemados)
 *   emitirDocumento({ payload, credenciales, modo })                → { numero, prefijo, cufe, pdfUrl, qrUrl, idProveedor, estadoProveedor, correoEnviado }
 *   anularDocumento({ documento, motivo, credenciales, modo })      → { numeroNota, cufeNota, idProveedor }    (Nota Crédito)
 *   reenviarCorreo({ documento, correo, credenciales, modo })       → { ok: true }
 * Si algo falla lanzan `ErrorProveedor` (con `detalle` técnico SIN secretos y `incierto` = «puede que el proveedor sí lo haya hecho»).
 * El `payload` es el estándar de Comandas (tools/facturacion/payload.mjs).
 *
 * Estas funciones corren SOLO en el servidor (Netlify Function): reciben `fetch` por parámetro para poder probarlas sin red.
 */

import { validarMapeo } from "../../../tools/facturacion/mapeo.mjs";

export class ErrorProveedor extends Error {
  constructor({ mensaje, estado = 0, detalle = "", incierto = false, codigo = "proveedor" }) {
    super(mensaje);
    this.name = "ErrorProveedor";
    this.estado = estado; this.detalle = detalle; this.incierto = incierto; this.codigo = codigo;
  }
}

/** Quita secretos de un texto antes de guardarlo o mostrarlo: los valores exactos de las credenciales, tokens y contraseñas en JSON/cabeceras. */
export function redactar(texto, secretos = []) {
  let t = String(texto ?? "");
  for (const s of secretos) { const v = String(s || ""); if (v.length >= 4) t = t.split(v).join("••••"); }
  t = t.replace(/("(?:access_token|refresh_token|token|password|contrasena|contraseña|client_secret|access_key|auth[-_]?token|secret)"\s*:\s*")[^"]*(")/gi, "$1••••$2");
  t = t.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, "$1 ••••");
  return t;
}

export const valoresSecretos = (cred) => Object.values(cred || {}).map(String);

/** Mensaje legible que suelen traer los errores de los proveedores. */
export function mensajeDeCuerpo(c) {
  if (!c) return "";
  if (typeof c === "string") return c.slice(0, 300);
  const cand = c.message || c.mensaje || c.error_description || (typeof c.error === "string" ? c.error : "") || (c.error && c.error.message) || c.detail || "";
  if (cand) return String(cand).slice(0, 300);
  if (c.errors && typeof c.errors === "object") return JSON.stringify(c.errors).slice(0, 300);
  if (Array.isArray(c.errors)) return c.errors.map((e) => e.message || e).join("; ").slice(0, 300);
  return "";
}

/**
 * Llamada HTTP con límite de tiempo. Lanza ErrorProveedor si no hay red, si vence el tiempo o si responde distinto de 2xx.
 *  · sin red / tiempo agotado / 5xx → `incierto: true` (el proveedor pudo haber procesado la solicitud), salvo en llamadas `seguro` (GET/autenticación)
 *  · 4xx → `incierto: false` (el proveedor la rechazó)
 */
export async function solicitar(fetchFn, url, { metodo = "GET", cabeceras = {}, json, formulario, timeoutMs = 25000, secretos = [], seguro = metodo === "GET" } = {}) {
  // `seguro` = la llamada NO crea nada en el proveedor (consultas y autenticación): si falla por red o 5xx se puede repetir sin riesgo de duplicar.
  const h = { Accept: "application/json", ...cabeceras };
  let cuerpo;
  if (json !== undefined) { h["Content-Type"] = "application/json"; cuerpo = JSON.stringify(json); }
  else if (formulario) { h["Content-Type"] = "application/x-www-form-urlencoded"; cuerpo = new URLSearchParams(formulario).toString(); }
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  let r;
  try { r = await fetchFn(url, { method: metodo, headers: h, body: cuerpo, signal: ctl ? ctl.signal : undefined }); }
  catch (e) {
    throw new ErrorProveedor({ mensaje: e && e.name === "AbortError" ? "El proveedor tardó demasiado en responder." : "No se pudo conectar con el proveedor.", incierto: !seguro, codigo: "red", detalle: redactar(String((e && e.message) || e), secretos) });
  } finally { if (t) clearTimeout(t); }
  const texto = await r.text().catch(() => "");
  let datos = null; try { datos = texto ? JSON.parse(texto) : null; } catch (e) { datos = null; }
  if (!r.ok) {
    throw new ErrorProveedor({
      mensaje: mensajeDeCuerpo(datos) || `El proveedor respondió con error ${r.status}.`, estado: r.status, incierto: !seguro && r.status >= 500,
      codigo: r.status === 401 || r.status === 403 ? "credenciales" : "proveedor", detalle: redactar(`HTTP ${r.status} ${metodo} ${new URL(url).pathname} → ${texto.slice(0, 1500)}`, secretos),
    });
  }
  return { estado: r.status, datos, texto };
}

export const sinPos = (nombre) => new ErrorProveedor({ mensaje: `Con ${nombre} la app todavía solo emite Factura Electrónica de Venta.`, codigo: "no_soportado", detalle: "Documento Equivalente POS no está mapeado para este proveedor." });

/** Códigos DIAN de tipo de documento. */
export const DIAN_TIPO_DOC = { CC: "13", NIT: "31", CE: "22", PAS: "41" };
export const base64 = (s) => (typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(s))));
const partirNombre = (n) => { const p = String(n || "").trim().split(/\s+/); return p.length < 2 ? { nombres: p[0] || "Consumidor", apellidos: "final" } : { nombres: p.slice(0, Math.ceil(p.length / 2)).join(" "), apellidos: p.slice(Math.ceil(p.length / 2)).join(" ") }; };
export { partirNombre };
export const esPersonaJuridica = (c) => c.tipoDoc === "NIT";
export const aTexto2 = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);

/** Verifica que un objeto cumple el contrato (lo usan las pruebas). */
export const FUNCIONES_ADAPTADOR = ["emitirDocumento", "anularDocumento", "reenviarCorreo", "probarConexionYSincronizar"];

/** Falta configurar algo (catálogos sin mapear, emisor, resolución…): lo corrige el administrador, no se reintenta. */
export const errorConfiguracion = (mensaje, detalle = "") => new ErrorProveedor({ mensaje, codigo: "configuracion", estado: 0, incierto: false, detalle: detalle || mensaje });

/** Exige que el administrador haya mapeado lo que este documento necesita (impuesto, medios de pago, producto, propina…). */
export function exigirMapeo(ctx, proveedor) {
  const p = ctx.payload || {};
  const impuesto = String((p.impuesto && p.impuesto.tipo) || "INC").toLowerCase();
  const r = validarMapeo(ctx.mapeo, { proveedor, ajustes: { impuesto, propina: p.totales && p.totales.propinaEnDocumento ? "incluir" : "excluir" } });
  if (!r.ok) throw errorConfiguracion(`Falta mapear catálogos del proveedor: ${Object.values(r.errores)[0]} (Facturación electrónica → «Probar conexión y sincronizar catálogos»).`, `Faltan: ${r.faltantes.join(", ")}`);
  return r.valor;
}

/** Texto de la forma de la lista de catálogos que devuelve `probarConexionYSincronizar` (ver tools/facturacion/mapeo.mjs). */
export const catalogoVacio = () => ({ resoluciones: [], impuestos: [], mediosPago: [], productos: [], vendedores: [] });
export const cumpleContrato = (a) => !!a && typeof a.id === "string" && FUNCIONES_ADAPTADOR.every((f) => typeof a[f] === "function");

/* ───────────── Filas de documento EXACTAS (sin diferencias de redondeo) ─────────────
 * El motor (tools/facturacion/motor.mjs) calcula cada línea en centavos enteros. Los proveedores, en cambio, reciben «precio unitario ×
 * cantidad», y un precio como 55407.74 ÷ 3 = 18469.2467 no cuadra al centavo. Estas funciones reparten cada línea en una o más filas
 * (mismo producto) con precios de 2 decimales cuya suma es EXACTAMENTE la línea. Todo en centavos enteros.
 */
const aCent = (x) => Math.round(Number(x) * 100);
const aPeso = (c) => c / 100;
const divRed = (n, d) => Math.floor((2 * n + d) / (2 * d));
/** Impuesto que calcula un proveedor sobre una base (centavos) con tasa en puntos básicos (800 = 8 %). */
export const impuestoDeBase = (baseC, tasaBp) => divRed(baseC * tasaBp, 10000);

/**
 * Reparte `n` unidades con valor total `totalC` en filas [{ cantidad, unitC }] cuya suma es exactamente `totalC`.
 * Con `tasaBp` + `impuestoObjetivoC` busca además que la SUMA del impuesto fila a fila (base × tasa, redondeado) iguale al del motor.
 * Si no existe forma exacta (p. ej. $8.300 × 1 con INC 8 % incluido: no hay base cuyo impuesto redondeado dé justo $8.300) devuelve la
 * mejor división de la base y marca `residuo: true`: el proveedor recalculará el impuesto con 1 centavo de diferencia que NO se puede evitar.
 */
export function filasDeLinea(totalC, n, { tasaBp = 0, impuestoObjetivoC = null } = {}) {
  const cant = Math.max(1, Math.round(Number(n) || 1));
  const taxDe = (rows) => rows.reduce((a, r) => a + impuestoDeBase(r.cantidad * r.unitC, tasaBp), 0);
  const coincide = (rows) => impuestoObjetivoC === null || taxDe(rows) === impuestoObjetivoC;
  const pf = Math.floor(totalC / cant), r = totalC - pf * cant;
  let primera = null;
  for (let c = r; c <= cant; c++) {
    const d = c - r;
    if (c + d > cant) break;
    const filas = [{ cantidad: cant - c - d, unitC: pf }, { cantidad: c, unitC: pf + 1 }, { cantidad: d, unitC: pf - 1 }].filter((x) => x.cantidad > 0 && x.unitC >= 0);
    if (!primera) primera = filas;
    if (coincide(filas)) return { filas, residuo: false };
  }
  // Una sola fila de cantidad 1 con el valor de toda la línea: solo cuando la cantidad real no se puede repartir en filas con precio de 2 decimales
  // y aun así el impuesto cuadra. El adaptador lo avisa en la descripción («… (×3)»).
  if (impuestoObjetivoC !== null && cant > 1) { const una = [{ cantidad: 1, unitC: totalC, agrupa: cant }]; if (coincide(una)) return { filas: una, residuo: false }; }
  return { filas: primera || [{ cantidad: cant, unitC: pf }], residuo: impuestoObjetivoC !== null };
}

/**
 * Filas para proveedores cuyo precio va SIN impuesto (Alegra, Siigo, Dataico): precio de la base, descuento declarado en % y propina.
 * Cada fila: { codigo, descripcion, cantidad, precio, descuentoPct, sinImpuesto, residuo }.
 * Una cortesía (línea con descuento del 100 %) NUNCA viaja con precio 0 sin descuento: lleva su precio de lista y descuentoPct = 100.
 */
export function filasSinImpuesto(p) {
  const bp = Math.round(p.impuesto.porcentaje * 100);
  const out = [];
  for (const l of p.lineas) {
    const base = aCent(l.base), imp = aCent(l.impuesto), bruto = aCent(l.brutoAntesDescuento);
    const cortesia = aCent(l.total) === 0 && bruto > 0;
    if (cortesia) {
      const lista = p.preciosIncluyenImpuesto && bp > 0 ? divRed(bruto * 10000, 10000 + bp) : bruto;
      filasDeLinea(lista, l.cantidad).filas.forEach((f) => out.push({ codigo: l.codigo, descripcion: l.descripcion, cantidad: f.cantidad, precio: aPeso(f.unitC), descuentoPct: 100, sinImpuesto: false, residuo: false }));
      continue;
    }
    const { filas, residuo } = filasDeLinea(base, l.cantidad, { tasaBp: bp, impuestoObjetivoC: imp });
    filas.forEach((f) => out.push({ codigo: l.codigo, descripcion: f.agrupa ? `${l.descripcion} (×${f.agrupa})` : l.descripcion, cantidad: f.cantidad, precio: aPeso(f.unitC), descuentoPct: 0, sinImpuesto: false, residuo }));
  }
  const pr = p.totales && p.totales.propinaEnDocumento ? aCent(p.totales.propina) : 0;
  if (pr > 0) out.push({ codigo: "PROPINA", descripcion: "Propina voluntaria (ingreso para terceros)", cantidad: 1, precio: aPeso(pr), descuentoPct: 0, sinImpuesto: true, residuo: false });
  return out.map((f, i) => ({ ...f, indice: i + 1 }));
}

/** Filas para proveedores cuyo precio va CON impuesto incluido (Factus). Misma forma que `filasSinImpuesto`. */
export function filasConImpuesto(p) {
  const bp = Math.round(p.impuesto.porcentaje * 100);
  const out = [];
  for (const l of p.lineas) {
    const total = aCent(l.total), bruto = aCent(l.brutoAntesDescuento);
    if (total === 0 && bruto > 0) {
      const lista = p.preciosIncluyenImpuesto ? bruto : bruto + impuestoDeBase(bruto, bp);
      filasDeLinea(lista, l.cantidad).filas.forEach((f) => out.push({ codigo: l.codigo, descripcion: l.descripcion, cantidad: f.cantidad, precio: aPeso(f.unitC), descuentoPct: 100, sinImpuesto: false }));
      continue;
    }
    filasDeLinea(total, l.cantidad).filas.forEach((f) => out.push({ codigo: l.codigo, descripcion: l.descripcion, cantidad: f.cantidad, precio: aPeso(f.unitC), descuentoPct: 0, sinImpuesto: false }));
  }
  const pr = p.totales && p.totales.propinaEnDocumento ? aCent(p.totales.propina) : 0;
  if (pr > 0) out.push({ codigo: "PROPINA", descripcion: "Propina voluntaria (ingreso para terceros)", cantidad: 1, precio: aPeso(pr), descuentoPct: 0, sinImpuesto: true });
  return out.map((f, i) => ({ ...f, indice: i + 1 }));
}

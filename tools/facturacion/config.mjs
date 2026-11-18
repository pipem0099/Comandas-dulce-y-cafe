/*
 * Configuración fiscal del restaurante — validación PURA (se prueba con `npm run fiscal:probar`).
 * La usan la pantalla del administrador, la función del servidor y las pruebas: una sola fuente de verdad.
 *
 * Dos cosas distintas:
 *  · AJUSTES (no secretos): estado, ambiente, proveedor, reglas tributarias, resolución. Viven en `facturacion/ajustes`.
 *  · CREDENCIALES (secretas): llaves del proveedor. Solo viajan hacia la función del servidor, que las cifra. Nunca se devuelven.
 */
import { validarEmisor, EMISOR_VACIO } from "./emisor.mjs";
import { UVT_POR_DEFECTO } from "./alertas.mjs";
import { TIPOS_DOCUMENTO, IMPUESTOS, PRECIOS, PROPINAS } from "./motor.mjs";

export const MODOS = ["pruebas", "produccion"];
export const ETIQUETA_MODO = { pruebas: "Pruebas / Sandbox", produccion: "Producción" };
export const ETIQUETA_TIPO_DOC = { factura: "Factura Electrónica de Venta", pos: "Documento Equivalente Electrónico POS" };
export const ETIQUETA_IMPUESTO = { inc: "Impuesto Nacional al Consumo (INC 8%)", iva: "IVA (19%)", exento: "Exento / No responsable (0%)" };
export const ETIQUETA_PRECIOS = { incluyen: "Ya incluyen el impuesto", suman: "Sumar impuesto al subtotal" };
export const ETIQUETA_PROPINA = { excluir: "Excluir del documento electrónico", incluir: "Incluir como ingreso para terceros (no gravado)" };

/** Campos de credenciales de cada proveedor. `secreto: true` se muestra como contraseña; `principal` es el que da los últimos 4 dígitos. */
export const PROVEEDORES = [
  { valor: "simulado", guia: "Sin llaves: la app genera números y CUFE de mentira para demos y capacitación. No tiene validez ante la DIAN.", etiqueta: "Simulado (Demos y Pruebas)", soportaPos: true, detalle: "No usa credenciales. Solo para demos y pruebas: NO tiene validez ante la DIAN.", campos: [] },
  { valor: "factus", guia: "En Factus: entra a tu cuenta → «Desarrolladores» / «API» y copia el Client ID y el Client Secret. El Usuario y la Contraseña son los mismos con los que entras a Factus (en Sandbox, los de tu cuenta de pruebas).", etiqueta: "Factus", soportaPos: false, detalle: "API REST con OAuth2 (usuario y contraseña de la cuenta).", campos: [
    { clave: "clientId", etiqueta: "Client ID", secreto: false },
    { clave: "clientSecret", etiqueta: "Client Secret", secreto: true, principal: true },
    { clave: "usuario", etiqueta: "Usuario", secreto: false, tipo: "correo" },
    { clave: "contrasena", etiqueta: "Contraseña", secreto: true },
  ] },
  { valor: "alegra", guia: "En Alegra: Configuración → «Integraciones / API». Copia tu Token API. El correo es el de tu usuario de Alegra.", etiqueta: "Alegra", soportaPos: false, detalle: "Autenticación básica con correo y token de la API.", campos: [
    { clave: "correo", etiqueta: "Correo electrónico", secreto: false, tipo: "correo" },
    { clave: "tokenApi", etiqueta: "Token API", secreto: true, principal: true },
  ] },
  { valor: "siigo", guia: "En Siigo Nube: Configuración → «Integraciones / API». Usuario API = correo del usuario de API; Access Key = la llave que Siigo muestra una sola vez. El ID de Tipo de Comprobante lo da tu contador (comprobante de factura electrónica FV).", etiqueta: "Siigo", soportaPos: true, detalle: "Usuario de API y Access Key (Siigo Nube).", campos: [
    { clave: "usuarioApi", etiqueta: "Usuario API", secreto: false, tipo: "correo" },
    { clave: "accessKey", etiqueta: "Access Key", secreto: true, principal: true },
    { clave: "idTipoComprobante", etiqueta: "ID Tipo Comprobante", secreto: false, tipo: "numero" },
  ] },
  { valor: "dataico", guia: "En Dataico: tu cuenta → «Integraciones». Copia el Auth Token y el Account ID (identificador de la cuenta).", etiqueta: "Dataico", soportaPos: false, detalle: "Token de autenticación y cuenta.", campos: [
    { clave: "authToken", etiqueta: "Auth Token", secreto: true, principal: true },
    { clave: "accountId", etiqueta: "Account ID", secreto: false },
  ] },
];
export const proveedorPorValor = (v) => PROVEEDORES.find((p) => p.valor === v) || null;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const correoOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const fechaValida = (s) => FECHA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export const AJUSTES_POR_DEFECTO = Object.freeze({
  activa: false, modo: "pruebas", proveedor: "simulado", emisionAutomatica: false,
  tipoDocumento: "pos", impuesto: "inc", precios: "incluyen", propina: "excluir", valorUvt: UVT_POR_DEFECTO,
  emisor: EMISOR_VACIO,
  resolucion: { prefijo: "", numero: "", desde: "", hasta: "", vigenciaDesde: "", vigenciaHasta: "" },
});

/** Completa lo que falte con valores de fábrica (para pintar la pantalla aunque nunca se haya configurado). */
export function conDefectos(a) {
  const x = a && typeof a === "object" ? a : {};
  return { ...AJUSTES_POR_DEFECTO, ...x, resolucion: { ...AJUSTES_POR_DEFECTO.resolucion, ...(x.resolucion || {}) }, emisor: { ...EMISOR_VACIO, ...(x.emisor || {}) } };
}

export function validarResolucion(r, { exigir = false } = {}) {
  const e = {};
  const x = r || {};
  const prefijo = String(x.prefijo || "").trim().toUpperCase();
  const numero = String(x.numero || "").trim();
  const desde = String(x.desde ?? "").trim(), hasta = String(x.hasta ?? "").trim();
  const vd = String(x.vigenciaDesde || "").trim(), vh = String(x.vigenciaHasta || "").trim();
  const algo = [prefijo, numero, desde, hasta, vd, vh].some(Boolean);
  if (exigir || algo) {
    if (!/^[A-Z0-9]{0,4}$/.test(prefijo)) e.prefijo = "El prefijo tiene hasta 4 letras o números, sin espacios.";
    if (!/^\d{4,20}$/.test(numero)) e.numero = "El número de resolución son solo dígitos (los que aparecen en el documento de la DIAN).";
    if (!/^\d{1,12}$/.test(desde) || Number(desde) < 1) e.desde = "Escribe el número inicial del rango (1 o más).";
    if (!/^\d{1,12}$/.test(hasta)) e.hasta = "Escribe el número final del rango.";
    else if (!e.desde && Number(hasta) < Number(desde)) e.hasta = "El número final debe ser mayor o igual al inicial.";
    if (!fechaValida(vd)) e.vigenciaDesde = "Elige la fecha desde la cual rige la resolución.";
    if (!fechaValida(vh)) e.vigenciaHasta = "Elige la fecha hasta la cual rige la resolución.";
    else if (!e.vigenciaDesde && vh < vd) e.vigenciaHasta = "La vigencia final no puede ser anterior a la inicial.";
  }
  return { ok: Object.keys(e).length === 0, errores: e, valor: { prefijo, numero, desde, hasta, vigenciaDesde: vd, vigenciaHasta: vh } };
}

/** Estado de la resolución a una fecha dada (`hoy` = "AAAA-MM-DD"): sin_configurar · vigente · por_vencer (≤ 30 días) · vencida · aun_no_rige. */
export function estadoResolucion(r, hoy) {
  const v = validarResolucion(r);
  if (!r || !v.valor.numero || !v.ok) return { estado: "sin_configurar", dias: null };
  const { vigenciaDesde: vd, vigenciaHasta: vh } = v.valor;
  if (hoy < vd) return { estado: "aun_no_rige", dias: null };
  const dias = Math.round((Date.parse(`${vh}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86400000);
  if (dias < 0) return { estado: "vencida", dias };
  return { estado: dias <= 30 ? "por_vencer" : "vigente", dias };
}

/**
 * Valida y normaliza los ajustes. `{ credencialConfigurada, hoy }` permite exigir, para ACTIVAR, que el proveedor real ya tenga llaves
 * y, en producción, una resolución vigente.
 */
export function validarAjustes(a, { credencialConfigurada = false, hoy = "", propinaMapeada = true } = {}) {
  const e = {};
  const x = conDefectos(a);
  if (!MODOS.includes(x.modo)) e.modo = "Elige Pruebas o Producción.";
  if (!proveedorPorValor(x.proveedor)) e.proveedor = "Elige un proveedor tecnológico.";
  if (!TIPOS_DOCUMENTO.includes(x.tipoDocumento)) e.tipoDocumento = "Elige el tipo de documento.";
  if (!IMPUESTOS.includes(x.impuesto)) e.impuesto = "Elige el impuesto aplicable.";
  if (!PRECIOS.includes(x.precios)) e.precios = "Indica si los precios de la carta ya incluyen el impuesto.";
  if (!PROPINAS.includes(x.propina)) e.propina = "Elige qué hacer con la propina voluntaria.";
  const enProduccion = x.modo === "produccion";
  const uvt = Number(x.valorUvt);
  if (!Number.isInteger(uvt) || uvt < 10000 || uvt > 500000) e.valorUvt = "El valor del UVT es un número entero en pesos (ej. 52374). Confírmalo en la DIAN.";
  const emi = validarEmisor(x.emisor, { exigir: x.activa && x.proveedor !== "simulado" });
  Object.entries(emi.errores).forEach(([k, v]) => { e[`emisor.${k}`] = v; });
  if (x.activa && x.proveedor !== "simulado" && x.propina === "incluir" && !propinaMapeada) e.propina = "Para incluir la propina debes elegir antes el ítem contable de propinas (paso de catálogos).";
  const res = validarResolucion(x.resolucion, { exigir: x.activa && enProduccion && x.proveedor !== "simulado" });
  Object.entries(res.errores).forEach(([k, v]) => { e[`resolucion.${k}`] = v; });
  const prov = proveedorPorValor(x.proveedor);
  if (prov && x.tipoDocumento === "pos" && !prov.soportaPos) e.tipoDocumento = `Con ${prov.etiqueta} la app todavía solo emite Factura Electrónica de Venta. Para el Documento Equivalente POS usa Siigo (con el ID de su comprobante POS) o confirma antes con tu proveedor.`;
  if (x.proveedor === "simulado" && enProduccion) e.proveedor = "El proveedor Simulado solo sirve en modo Pruebas: no tiene validez ante la DIAN.";
  if (x.activa && x.proveedor !== "simulado" && !credencialConfigurada) e.credenciales = "Antes de activar, guarda las credenciales del proveedor.";
  if (x.activa && enProduccion && x.proveedor !== "simulado" && hoy && !e["resolucion.vigenciaHasta"] && res.valor.vigenciaHasta && res.valor.vigenciaHasta < hoy) e["resolucion.vigenciaHasta"] = "La resolución ya venció: no se puede facturar en producción.";
  return {
    ok: Object.keys(e).length === 0, errores: e,
    valor: { activa: x.activa === true, modo: x.modo, proveedor: x.proveedor, emisionAutomatica: x.emisionAutomatica === true, tipoDocumento: x.tipoDocumento, impuesto: x.impuesto, precios: x.precios, propina: x.propina, valorUvt: uvt, emisor: emi.valor, resolucion: res.valor },
  };
}

/** Ajustes → configuración que entiende el motor tributario. */
export const configParaMotor = (a) => { const x = conDefectos(a); return { tipoDocumento: x.tipoDocumento, impuesto: x.impuesto, precios: x.precios, propina: x.propina }; };

/** Valida las credenciales de un proveedor (todas obligatorias). Devuelve el objeto limpio solo con los campos del proveedor. */
export function validarCredenciales(proveedor, cred) {
  const p = proveedorPorValor(proveedor);
  if (!p) return { ok: false, errores: { proveedor: "Proveedor desconocido." }, valor: {} };
  const e = {}, valor = {};
  for (const c of p.campos) {
    const v = String((cred && cred[c.clave]) ?? "").trim();
    if (!v) { e[c.clave] = `Falta ${c.etiqueta}.`; continue; }
    if (v.length > 500) { e[c.clave] = `${c.etiqueta} es demasiado largo.`; continue; }
    if (/[\r\n]/.test(v)) { e[c.clave] = `${c.etiqueta} no debe tener saltos de línea.`; continue; }
    if (c.tipo === "correo" && !correoOk(v)) e[c.clave] = `${c.etiqueta} no parece un correo válido.`;
    if (c.tipo === "numero" && !/^\d{1,12}$/.test(v)) e[c.clave] = `${c.etiqueta} son solo dígitos.`;
    valor[c.clave] = v;
  }
  return { ok: Object.keys(e).length === 0, errores: e, valor };
}

/** «••••1234»: solo los últimos 4 del campo principal, y solo si es lo bastante largo para que no revele casi todo. */
export function enmascarar(proveedor, cred) {
  const p = proveedorPorValor(proveedor);
  const principal = p && p.campos.find((c) => c.principal);
  const v = principal && cred ? String(cred[principal.clave] || "") : "";
  return v.length >= 12 ? `••••${v.slice(-4)}` : "••••";
}

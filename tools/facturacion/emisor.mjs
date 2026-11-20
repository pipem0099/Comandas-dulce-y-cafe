/*
 * Datos tributarios del ESTABLECIMIENTO (el emisor de la factura) — función PURA (npm run fiscal:probar).
 * NIT con dígito de verificación (módulo 11 de la DIAN), régimen, municipio (código DANE) y correo oficial.
 */
import { digitoVerificacion } from "../../src/facturacion/datosFiscales.js";
import { errorMunicipioDane } from "./municipios.mjs";

export const REGIMENES = ["responsable_iva", "no_responsable", "simple"];
export const ETIQUETA_REGIMEN = { responsable_iva: "Responsable de IVA", no_responsable: "No responsable de IVA", simple: "Régimen Simple de Tributación" };
/** Código de responsabilidad DIAN equivalente (el que piden los proveedores). */
export const CODIGO_RESPONSABILIDAD = { responsable_iva: "O-48", no_responsable: "R-99-PN", simple: "O-47" };

export const EMISOR_VACIO = Object.freeze({ razonSocial: "", nit: "", dv: "", regimen: "", municipio: "", codigoDane: "", direccion: "", telefono: "", correo: "" });
const correoOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/** Calcula el DV de un NIT escrito de cualquier forma («900.123.456», «900123456-7»). Devuelve "" si no se puede. */
export function calcularDv(nit) {
  const solo = String(nit || "").split("-")[0].replace(/\D/g, "");
  const dv = digitoVerificacion(solo);
  return dv === null ? "" : String(dv);
}

/**
 * Valida y normaliza al emisor. El NIT puede traer su DV («900123456-7»): si no coincide con el calculado es un error; si no lo trae se calcula.
 * `exigir:false` deja pasar un emisor totalmente vacío (aún no configurado).
 */
export function validarEmisor(e, { exigir = true } = {}) {
  const x = e && typeof e === "object" ? e : {};
  const errores = {};
  const razonSocial = String(x.razonSocial || "").replace(/\s+/g, " ").trim();
  const crudoNit = String(x.nit || "").trim();
  const partes = crudoNit.split("-");
  const nit = partes[0].replace(/\D/g, "");
  const dvEscrito = partes.length > 1 ? partes[1].replace(/\D/g, "") : String(x.dv || "").replace(/\D/g, "");
  const regimen = String(x.regimen || "");
  const municipio = String(x.municipio || "").replace(/\s+/g, " ").trim();
  const codigoDane = String(x.codigoDane || "").replace(/\D/g, "");
  const direccion = String(x.direccion || "").replace(/\s+/g, " ").trim();
  const telefono = String(x.telefono || "").trim();
  const correo = String(x.correo || "").trim().toLowerCase();
  const algo = [razonSocial, nit, regimen, municipio, codigoDane, direccion, telefono, correo].some(Boolean);
  const dvCalculado = calcularDv(nit);
  if (exigir || algo) {
    if (razonSocial.length < 3 || razonSocial.length > 200) errores.razonSocial = "Escribe la razón social o el nombre comercial (3 a 200 letras).";
    if (!/^\d{6,15}$/.test(nit)) errores.nit = "El NIT son entre 6 y 15 dígitos, sin el dígito de verificación.";
    else if (dvEscrito !== "" && dvEscrito !== dvCalculado) errores.nit = `El dígito de verificación no coincide: para ese NIT es ${dvCalculado}.`;
    if (!REGIMENES.includes(regimen)) errores.regimen = "Elige el régimen del establecimiento (pregúntale a tu contador).";
    if (municipio.length < 2) errores.municipio = "Escribe el municipio o ciudad.";
    if (!/^\d{5}$/.test(codigoDane)) errores.codigoDane = "El código DANE del municipio son 5 dígitos (ej. Bogotá 11001, Medellín 05001).";
    else { const em = errorMunicipioDane(municipio, codigoDane); if (em) errores.codigoDane = em; }
    if (direccion.length > 200) errores.direccion = "La dirección es demasiado larga (máximo 200 letras).";
    if (telefono && !/^[\d\s+()-]{7,20}$/.test(telefono)) errores.telefono = "El teléfono solo lleva números (7 a 20), por ejemplo 3001234567.";
    if (!correoOk(correo)) errores.correo = "Escribe el correo oficial de facturación del restaurante.";
  }
  return { ok: Object.keys(errores).length === 0, errores, completo: Object.keys(errores).length === 0 && algo, valor: { razonSocial, nit, dv: dvCalculado, regimen, municipio, codigoDane, direccion, telefono, correo } };
}

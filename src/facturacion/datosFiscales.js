/*
 * Datos del cliente para factura (base para la facturación electrónica). Puras: se prueban con `npm run facturacion:probar`.
 *
 * IMPORTANTE: guardar y mostrar estos datos NO emite una factura electrónica válida ante la DIAN. Para eso se necesita un proveedor
 * tecnológico autorizado (con sus credenciales y resolución). Estos datos quedan listos para entregarlos a ese proveedor o a tu contador.
 */
/** Responsabilidad tributaria del CLIENTE (solo importa cuando es empresa con NIT). Códigos oficiales de la DIAN. */
export const NIVELES_TRIBUTARIOS = [
  { valor: "R-99-PN", etiqueta: "No responsable de IVA (R-99-PN)" },
  { valor: "O-48", etiqueta: "Responsable de IVA (O-48)" },
  { valor: "O-47", etiqueta: "Régimen Simple de Tributación (O-47)" },
];
export const TIPOS_DOC = [
  { valor: "CC", etiqueta: "Cédula de ciudadanía" },
  { valor: "NIT", etiqueta: "NIT" },
  { valor: "CE", etiqueta: "Cédula de extranjería" },
  { valor: "PAS", etiqueta: "Pasaporte" },
  { valor: "CF", etiqueta: "Consumidor final (sin datos)" },
];

const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Dígito de verificación de un NIT colombiano (el que va después del guion). */
export function digitoVerificacion(nit) {
  const digitos = String(nit).replace(/\D/g, "").split("").reverse();
  if (digitos.length === 0 || digitos.length > PESOS.length) return null;
  const suma = digitos.reduce((s, d, i) => s + Number(d) * PESOS[i], 0);
  const r = suma % 11;
  return r > 1 ? 11 - r : r;
}

const soloDigitos = (s) => String(s || "").replace(/\D/g, "");
const miles = (digitos) => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Limpia lo escrito por la persona. En NIT acepta «900123456-1» o «900123456» (calcula el dígito si falta). */
export function normalizar(d) {
  const tipoDoc = (d && d.tipoDoc) || "CC";
  const nombre = String((d && d.nombre) || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const correo = String((d && d.correo) || "").trim().toLowerCase().slice(0, 120);
  const direccion = String((d && d.direccion) || "").trim().slice(0, 160);
  const nivel = NIVELES_TRIBUTARIOS.some((x) => x.valor === (d && d.nivelTributario)) && tipoDoc === "NIT" ? { nivelTributario: d.nivelTributario } : {};
  if (tipoDoc === "CF") return { tipoDoc, numero: "", dv: "", nombre, correo, direccion };
  const crudo = String((d && d.numero) || "").trim();
  if (tipoDoc === "NIT") {
    const partes = crudo.split(/[-–]/);
    const numero = soloDigitos(partes[0]);
    const dvEscrito = partes.length > 1 ? soloDigitos(partes[1]) : "";
    const calc = digitoVerificacion(numero);
    return { tipoDoc, numero, dv: dvEscrito !== "" ? dvEscrito : (calc === null ? "" : String(calc)), nombre, correo, direccion, ...nivel };
  }
  if (tipoDoc === "PAS") return { tipoDoc, numero: crudo.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), dv: "", nombre, correo, direccion };
  return { tipoDoc, numero: soloDigitos(crudo), dv: "", nombre, correo, direccion };
}

/** { ok, errores: { campo: "texto en palabras" } } */
export function validar(d) {
  const n = normalizar(d), errores = {};
  if (n.tipoDoc !== "CF") {
    if (n.nombre.length < 2) errores.nombre = "Escribe el nombre o la razón social.";
    if (n.tipoDoc === "NIT") {
      if (n.numero.length < 5 || n.numero.length > 10) errores.numero = "El NIT debe tener entre 5 y 10 dígitos, sin el dígito de verificación.";
      else if (String(digitoVerificacion(n.numero)) !== n.dv) errores.numero = `El dígito de verificación no coincide: para ese NIT debería ser ${digitoVerificacion(n.numero)}.`;
    } else if (n.tipoDoc === "PAS") {
      if (n.numero.length < 5 || n.numero.length > 20) errores.numero = "El pasaporte debe tener entre 5 y 20 letras o números.";
    } else if (n.numero.length < 5 || n.numero.length > 12) errores.numero = "El documento debe tener entre 5 y 12 dígitos.";
  }
  if (n.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(n.correo)) errores.correo = "El correo no parece válido.";
  return { ok: Object.keys(errores).length === 0, errores };
}

/** «NIT 900.123.456-1» · «CC 1.020.304.050» · «Consumidor final» */
export function etiquetaDocumento(d) {
  if (!d) return "";
  const n = normalizar(d);
  if (n.tipoDoc === "CF") return "Consumidor final";
  if (!n.numero) return "";
  const num = n.tipoDoc === "PAS" ? n.numero : miles(n.numero);
  return `${n.tipoDoc} ${num}${n.tipoDoc === "NIT" && n.dv !== "" ? `-${n.dv}` : ""}`;
}

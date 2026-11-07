/*
 * Propina en "Por producto": cómo se reparte entre las personas que pagan por separado.
 * Funciones PURAS (sin pantalla ni base de datos): se prueban con `npm run deudas:probar`.
 *
 *  · Proporcional: cada persona deja la propina sobre lo que consumió (propina total × sus productos ÷ subtotal).
 *  · Equitativa:   la propina total de la mesa se divide en partes iguales entre N pagadores.
 *
 * En los dos modos la ÚLTIMA persona absorbe el redondeo, así la suma de las propinas cobradas es EXACTAMENTE
 * la propina de la cuenta (en pesos enteros) y la cuenta cierra sin saldos de uno o dos pesos.
 */

export const MODOS_PROPINA = ["proporcional", "equitativa"];
export const MODO_PROPINA_META = {
  proporcional: { label: "Proporcional", ayuda: "Cada persona deja propina sobre lo que consumió" },
  equitativa: { label: "Equitativa", ayuda: "La propina de la mesa se divide en partes iguales" },
};
export const PAGADORES_MIN = 2;
export const PAGADORES_MAX = 20;

export const modoPropinaValido = (m) => MODOS_PROPINA.includes(m);
export const limitarPagadores = (n) => Math.max(PAGADORES_MIN, Math.min(PAGADORES_MAX, Math.round(Number(n)) || PAGADORES_MIN));

const suma = (lista, campo) => lista.reduce((s, p) => s + (Number(p && p[campo]) || 0), 0);

/**
 * Estado de la propina de una cuenta que se paga por producto.
 *  · planificada: la propina que se eligió para la mesa, SIN la vuelta que algún cliente dejó de propina en efectivo
 *    (esa ya viene incluida en el pago de quien la dejó y sube `cuenta.propina.monto`, ver cobros.js).
 *  · cobrada:     lo que ya se cobró de propina repartida entre personas.
 *  · falta:       lo que todavía se debe repartir.
 */
export function resumenPropina(cuenta, pagos) {
  const lista = Array.isArray(pagos) ? pagos : [];
  const total = Math.max(0, Number(cuenta && cuenta.propina && cuenta.propina.monto) || 0);
  const planificada = Math.max(0, total - suma(lista, "propinaVuelta"));
  const cobrada = suma(lista, "propinaMonto");
  return { planificada, cobrada, falta: Math.max(0, planificada - cobrada) };
}

/** Cuántas personas distintas ya pagaron por producto (un pago con varios métodos cuenta como UNA persona). */
export function personasPorProducto(pagos) {
  const lista = Array.isArray(pagos) ? pagos : [];
  return new Set(lista.filter((p) => p && p.tipo === "por_producto").map((p) => p.grupo || p.id)).size;
}

/**
 * Propina que le toca a UNA persona (en pesos enteros).
 *  modo            "proporcional" | "equitativa"
 *  propinaTotal    propina planificada de la mesa
 *  subtotal        suma de todos los productos de la cuenta
 *  montoItems      lo que consumió esta persona
 *  propinaYaCobrada  propina ya repartida a personas anteriores
 *  personasPagadas   cuántas personas ya pagaron
 *  nPagadores        entre cuántas se divide (solo equitativa)
 *  esUltimo          true si esta persona se lleva todo lo que queda por pagar
 */
export function propinaPersona({ modo, propinaTotal, subtotal, montoItems, propinaYaCobrada = 0, personasPagadas = 0, nPagadores = PAGADORES_MIN, esUltimo = false }) {
  const total = Math.max(0, Math.round(Number(propinaTotal) || 0));
  const falta = Math.max(0, total - Math.max(0, Math.round(Number(propinaYaCobrada) || 0)));
  if (falta === 0) return 0;
  const n = limitarPagadores(nPagadores);
  const ultima = esUltimo || (modo === "equitativa" && personasPagadas + 1 >= n);
  if (ultima) return falta; // absorbe el redondeo
  let base;
  if (modo === "equitativa") base = total / n;
  else base = subtotal > 0 ? (total * Math.max(0, Number(montoItems) || 0)) / subtotal : 0;
  return Math.min(falta, Math.max(0, Math.round(base)));
}

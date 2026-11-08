/*
 * Fechas y horas en lenguaje de todos los días (puras, se prueban con `npm run diseno:probar`).
 *   fechaLegible("2026-11-20")  → "vie 20 nov 2026"
 *   semanasDelMes(2026, 10)      → filas de 7 casillas (lunes a domingo) para dibujar el calendario
 *   horaLegible("16:30")         → "4:30 p. m."
 */
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const pad = (n) => String(n).padStart(2, "0");
export const aClave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const deClave = (k) => { const [y, m, d] = String(k).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };

export function fechaLegible(k) {
  if (!k) return "";
  const d = deClave(k);
  return `${DIAS_CORTO[d.getDay()]} ${d.getDate()} ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
}

/** Semanas (lunes a domingo) de un mes: filas con 7 casillas; las vacías son null. `mes` va de 0 (enero) a 11. */
export function semanasDelMes(anio, mes) {
  const primero = new Date(anio, mes, 1);
  const desfase = (primero.getDay() + 6) % 7; // lunes = 0
  const dias = new Date(anio, mes + 1, 0).getDate();
  const casillas = [...Array(desfase).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  while (casillas.length % 7 !== 0) casillas.push(null);
  return Array.from({ length: casillas.length / 7 }, (_, i) => casillas.slice(i * 7, i * 7 + 7));
}

export function horaLegible(v) {
  if (!v) return "";
  const [h, m] = String(v).split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m || 0)} ${h < 12 ? "a. m." : "p. m."}`;
}

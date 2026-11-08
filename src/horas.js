/*
 * Horas en lenguaje de todos los días. Funciones PURAS (se prueban con `npm run diseno:probar`).
 *   horaCorta(16)            → "4 p. m."
 *   horaReloj(16)            → "4:00 p. m."
 *   rangoHoras(16, 17)       → "4:00 – 5:00 p. m."
 *   rangoHoras(23, 1)        → "11:00 p. m. – 1:00 a. m."
 *   horasDesdeApertura(tot)  → horas en el orden del día del negocio: empieza cuando abre (no a las 0:00)
 */
const per = (h) => (((h % 24) + 24) % 24 < 12 ? "a. m." : "p. m.");
const doce = (h) => { const x = ((h % 24) + 24) % 24; return x % 12 === 0 ? 12 : x % 12; };

export const horaCorta = (h) => `${doce(h)} ${per(h)}`;
export const horaReloj = (h) => `${doce(h)}:00 ${per(h)}`;

/** De `desde` a `hasta` (la hora final es el cierre de la franja; si es menor o igual, pasa a la madrugada siguiente). */
export function rangoHoras(desde, hasta) {
  const fin = hasta <= desde ? hasta + 24 : hasta;
  return per(desde) === per(fin) ? `${doce(desde)}:00 – ${horaReloj(fin)}` : `${horaReloj(desde)} – ${horaReloj(fin)}`;
}

/**
 * `totales` = 24 números (venta de cada hora, sumando toda la semana). Devuelve las horas en orden de operación:
 * empieza en la hora en que el negocio abre (la que sigue a la pausa más larga sin ventas) y termina en la última hora con ventas,
 * con una hora de margen a cada lado. Sin ventas devuelve un horario típico (7 a 20).
 */
export function horasDesdeApertura(totales) {
  const t = Array.from({ length: 24 }, (_, h) => Number(totales && totales[h]) || 0);
  const activas = t.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0);
  if (activas.length === 0) return Array.from({ length: 14 }, (_, i) => 7 + i);
  if (activas.length === 24) return Array.from({ length: 24 }, (_, h) => h);
  // pausa más larga (circular) sin ventas: el negocio abre al terminar esa pausa
  let mejor = { largo: 0, fin: 0 };
  for (let ini = 0; ini < 24; ini++) {
    if (t[ini] > 0 || t[(ini + 23) % 24] === 0) continue; // solo empezar al inicio de una pausa
    let largo = 0;
    while (largo < 24 && t[(ini + largo) % 24] === 0) largo++;
    if (largo > mejor.largo) mejor = { largo, fin: (ini + largo) % 24 };
  }
  const abre = mejor.fin;
  const horasDesdeAbre = (h) => (h - abre + 24) % 24;
  const ultima = Math.max(...activas.map(horasDesdeAbre));
  const cantidad = Math.min(24, ultima + 1);
  const conMargen = Math.min(24, cantidad + 1);
  const inicio = cantidad < 24 && mejor.largo > 1 ? (abre + 23) % 24 : abre;
  const total = inicio === abre ? conMargen : Math.min(24, cantidad + 2);
  return Array.from({ length: total }, (_, i) => (inicio + i) % 24);
}

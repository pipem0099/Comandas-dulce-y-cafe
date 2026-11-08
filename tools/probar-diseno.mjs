// Pruebas de diseño (sin internet): contraste de los textos sobre cada color de marca y de los grises en modo claro y oscuro.
// npm run diseno:probar
import { contraste, textoSobre, TEXTO_OSCURO, TEXTO_CLARO, fichaActiva, SUPERFICIE } from "../src/contraste.js";
import { PALETA, ACENTOS } from "../src/theme.js";
import { calcularAlertas } from "../src/alertas.js";
import { horaCorta, horaReloj, rangoHoras, horasDesdeApertura } from "../src/horas.js";
import { fechaLegible, semanasDelMes, horaLegible, aClave, deClave } from "../src/fechas.js";

let total = 0, fallas = 0;
const ok = (c, t) => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const MIN = 4.5;

console.log("── Texto sobre el color de marca (botones y chips activos) ──");
const lista = Array.isArray(ACENTOS) ? ACENTOS : Object.values(ACENTOS);
ok(lista.length >= 5, `hay ${lista.length} colores de marca para revisar`);
for (const a of lista) {
  const color = a.c || a.color;
  const t = textoSobre(color);
  const r = contraste(t, color);
  ok(r >= MIN, `${a.nombre || a.id || color}: texto ${t === TEXTO_OSCURO ? "oscuro" : "blanco"} sobre ${color} → contraste ${r.toFixed(2)}`);
}
ok(textoSobre("#0e9f6e") === TEXTO_OSCURO, "el verde esmeralda de la marca lleva texto oscuro");
ok(textoSobre("#8E2A45") === TEXTO_CLARO, "un color oscuro (vino) lleva texto blanco");

console.log("\n── Chip / pestaña ACTIVA (tinte suave del color de marca) ──");
for (const a of lista) {
  for (const modo of ["claro", "oscuro"]) {
    const f = fichaActiva(a.c, a.t, modo);
    const legible = contraste(f.fg, f.bg), visible = contraste(f.bg, SUPERFICIE[modo]);
    ok(legible >= MIN && visible >= 1.15, `${a.nombre} (${modo}): texto ${legible.toFixed(2)} · el fondo se distingue de la tarjeta ${visible.toFixed(2)}`);
  }
}

console.log("\n── Botones secundarios sobre la tarjeta (no deben verse hundidos) ──");
ok(contraste(PALETA["--btn2-bg"][1], SUPERFICIE.oscuro) >= 1.15 && PALETA["--btn2-bg"][1] > SUPERFICIE.oscuro, `oscuro: el botón es más claro que la tarjeta (${contraste(PALETA["--btn2-bg"][1], SUPERFICIE.oscuro).toFixed(2)})`);
ok(contraste(PALETA["--btn2-bg"][1], PALETA["--c-f1ecdd-b"][1]) >= 1.08, `oscuro: también se distingue dentro de los paneles internos (${contraste(PALETA["--btn2-bg"][1], PALETA["--c-f1ecdd-b"][1]).toFixed(2)})`);

console.log("\n── Grises de la interfaz ──");
const [bgClaro, bgOscuro] = [PALETA["--chip-bg"][0], PALETA["--chip-bg"][1]];
ok(contraste(PALETA["--chip-fg"][0], bgClaro) >= MIN, `chip inactivo (claro): ${contraste(PALETA["--chip-fg"][0], bgClaro).toFixed(2)}`);
ok(contraste(PALETA["--chip-fg"][1], bgOscuro) >= MIN, `chip inactivo (oscuro): ${contraste(PALETA["--chip-fg"][1], bgOscuro).toFixed(2)}`);
ok(contraste(PALETA["--btn2-mute"][0], PALETA["--btn2-bg"][0]) >= MIN, "texto atenuado sobre botón secundario (claro)");
ok(contraste(PALETA["--btn2-mute"][1], PALETA["--btn2-bg"][1]) >= MIN, "texto atenuado sobre botón secundario (oscuro)");
// El detalle atenuado usa opacidad: se mezcla el texto con el fondo.
const mezcla = (fg, bg, a) => { const f = [1, 3, 5].map((i) => parseInt(fg.slice(i, i + 2), 16)), b = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16)); return "#" + f.map((x, i) => Math.round(a * x + (1 - a) * b[i]).toString(16).padStart(2, "0")).join(""); };
const opClaro = parseFloat(PALETA["--detalle-op"][0]), opOscuro = parseFloat(PALETA["--detalle-op"][1]);
ok(contraste(mezcla("#1C1C1E", "#FFFFFF", opClaro), "#FFFFFF") >= MIN, `detalle atenuado (claro, opacidad ${opClaro}): ${contraste(mezcla("#1C1C1E", "#FFFFFF", opClaro), "#FFFFFF").toFixed(2)}`);
ok(contraste(mezcla("#ECEDEF", "#1B1D21", opOscuro), "#1B1D21") >= MIN, `detalle atenuado (oscuro, opacidad ${opOscuro}): ${contraste(mezcla("#ECEDEF", "#1B1D21", opOscuro), "#1B1D21").toFixed(2)}`);

console.log("\n── Alerta de cuentas pendientes viejas ──");
const AHORA = new Date(2026, 10, 20, 12).getTime(), DIA = 86400000;
const d = (id, dias, saldo, estado = "pendiente") => ({ id, cuentaId: id, ts: AHORA - dias * DIA, saldo, estado, cliente: { nombre: id } });
const sin = calcularAlertas({ deudas: [d("a", 2, 10000), d("b", 6, 5000)], ahora: AHORA });
ok(!sin.some((a) => a.id === "deudas-viejas"), "deudas de menos de 7 días NO disparan la alerta");
const con = calcularAlertas({ deudas: [d("a", 2, 10000), d("b", 8, 50000), d("c", 10, 20000), d("z", 40, 99999, "pagada")], ahora: AHORA }).find((a) => a.id === "deudas-viejas");
ok(!!con && con.nivel === "media" && /2 cuentas pendientes/.test(con.titulo), "dos deudas de 7+ días → alerta 'media' (las pagadas no cuentan)");
ok(con && /\$70\.000/.test(con.detalle.replace(/\s/g, "")) && con.vista === "caja" && con.tab === "pendientes", "suma lo que falta ($70.000) y lleva a Caja → Pendientes");
const alta = calcularAlertas({ deudas: [d("v", 31, 1000)], ahora: AHORA }).find((a) => a.id === "deudas-viejas");
ok(alta && alta.nivel === "alta", "una deuda de más de 30 días sube a alerta 'alta'");

console.log("\n── Horas en lenguaje de todos los días ──");
ok(horaCorta(0) === "12 a. m." && horaCorta(12) === "12 p. m." && horaCorta(16) === "4 p. m." && horaCorta(9) === "9 a. m.", "horaCorta: 0→12 a. m., 12→12 p. m., 16→4 p. m.");
ok(horaReloj(16) === "4:00 p. m." && horaReloj(0) === "12:00 a. m.", "horaReloj: 4:00 p. m.");
ok(rangoHoras(16, 17) === "4:00 – 5:00 p. m.", "rango en el mismo periodo: «4:00 – 5:00 p. m.» (en lugar de «16–17 h»)");
ok(rangoHoras(0, 1) === "12:00 – 1:00 a. m.", "rango de madrugada: «12:00 – 1:00 a. m.» (en lugar de «0–1 h»)");
ok(rangoHoras(11, 13) === "11:00 a. m. – 1:00 p. m.", "rango que cruza el mediodía: «11:00 a. m. – 1:00 p. m.»");
ok(rangoHoras(23, 1) === "11:00 p. m. – 1:00 a. m.", "rango que cruza la medianoche: «11:00 p. m. – 1:00 a. m.»");
const tot = (horas) => Array.from({ length: 24 }, (_, h) => (horas.includes(h) ? 100 : 0));
const dia = horasDesdeApertura(tot([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
ok(dia[0] === 9 && dia[dia.length - 1] === 21 && !dia.includes(3), `negocio de día (10 a 8 p. m.): la tabla empieza a las ${horaCorta(dia[0])} y termina a las ${horaCorta(dia[dia.length - 1])}`);
const noche = horasDesdeApertura(tot([17, 18, 19, 20, 21, 22, 23, 0, 1, 2]));
ok(noche[0] === 16 && noche[noche.length - 1] === 3 && noche.indexOf(23) < noche.indexOf(0), `negocio nocturno (5 p. m. a 3 a. m.): empieza a las ${horaCorta(noche[0])}, pasa la medianoche sin cortarse y termina a las ${horaCorta(noche[noche.length - 1])}`);
ok(horasDesdeApertura(tot([])).length === 14 && horasDesdeApertura(tot([])).includes(12), "sin ventas muestra un horario típico");
ok(horasDesdeApertura(Array(24).fill(5)).length === 24, "si se vende las 24 horas muestra todas");

console.log("\n── Calendario y hora propios ──");
ok(fechaLegible("2026-11-20") === "vie 20 nov 2026" && fechaLegible("") === "", "fechaLegible: «vie 20 nov 2026»");
ok(horaLegible("16:30") === "4:30 p. m." && horaLegible("00:05") === "12:05 a. m." && horaLegible("12:00") === "12:00 p. m.", "horaLegible: «4:30 p. m.», «12:05 a. m.»");
const nov = semanasDelMes(2026, 10);   // noviembre de 2026 empieza en domingo
ok(nov.every((f) => f.length === 7) && nov[0].indexOf(1) === 6 && nov.flat().filter(Boolean).length === 30, "noviembre 2026: filas de 7, el día 1 cae en domingo (última casilla de la fila) y hay 30 días");
const feb = semanasDelMes(2028, 1);    // 2028 es bisiesto y febrero empieza en martes
ok(feb[0].indexOf(1) === 1 && feb.flat().filter(Boolean).length === 29, "febrero 2028 (bisiesto): 29 días, empieza en martes");
ok(aClave(deClave("2026-03-09")) === "2026-03-09", "convertir fecha ↔ texto no cambia el día");

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

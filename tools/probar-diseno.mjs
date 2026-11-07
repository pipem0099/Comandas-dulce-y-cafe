// Pruebas de diseño (sin internet): contraste de los textos sobre cada color de marca y de los grises en modo claro y oscuro.
// npm run diseno:probar
import { contraste, textoSobre, TEXTO_OSCURO, TEXTO_CLARO } from "../src/contraste.js";
import { PALETA, ACENTOS } from "../src/theme.js";
import { calcularAlertas } from "../src/alertas.js";

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

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { Selector, CampoFecha, CampoHora } from "../../src/componentes/Campos.jsx";
import { fechaCorta } from "../../src/fechas.js";
import { PendientesView } from "../../src/pantallas/Pendientes.jsx";
import { MesaCuentaCard } from "../../src/pantallas/CuentaMesa.jsx";
import { Analisis } from "../../src/pantallas/Analisis.jsx";
import { store } from "./firebase-stub.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let fallas = 0; const ok = (c, t) => { if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const esperar = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const cont = document.createElement("div"); document.body.appendChild(cont); const root = createRoot(cont);
const pintar = (el) => act(async () => { root.render(el); });
const txt = () => document.body.textContent;
const btn = (t) => [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const click = (el) => act(async () => { el.click(); });

/* Selector */
let elegido = null;
await pintar(<Selector value="urgencia" onChange={(v) => { elegido = v; }} titulo="Ordenar por" ariaLabel="Ordenar" opciones={[{ valor: "urgencia", etiqueta: "Más urgentes primero" }, { valor: "nombre", etiqueta: "Nombre (A–Z)" }]} />);
ok(txt().includes("Más urgentes primero") && !document.querySelector("select"), "Selector: muestra la opción actual y no usa el <select> del sistema");
await click(document.querySelector("button[aria-label='Ordenar']"));
ok(!!document.querySelector("[role=listbox]") && txt().includes("Nombre (A–Z)"), "Selector: abre una hoja propia con las opciones");
ok(document.querySelector("[role=option][aria-selected=true]").textContent.includes("Más urgentes"), "Selector: marca la opción elegida");
await click([...document.querySelectorAll("[role=option]")].find((o) => o.textContent.includes("Nombre")));
await esperar(450);
ok(elegido === "nombre" && !document.querySelector("[role=listbox]"), "Selector: al elegir cambia el valor y cierra la hoja");

/* Fecha */
let fecha = "2026-11-20";
await pintar(<CampoFecha value={fecha} min="2026-11-10" opcional onChange={(k) => { fecha = k; }} titulo="Fecha de vencimiento" />);
ok(txt().includes(fechaCorta("2026-11-20")), "Fecha: muestra la fecha corta («vie 20 nov»; el año solo si no es el actual)");
await click(document.querySelector("button[aria-haspopup=dialog]"));
ok(txt().includes("noviembre 2026") && !!btn("Quitar fecha"), "Fecha: abre el calendario del mes de la fecha y deja quitarla");
const dia = (n) => document.querySelector(`[role=gridcell][aria-label$='${n} nov 2026']`);
ok(dia(5).disabled === true && dia(15).disabled === false, "Fecha: los días anteriores al mínimo están bloqueados");
await click(dia(15)); await esperar(450);
ok(fecha === "2026-11-15", "Fecha: tocar un día lo elige («2026-11-15»)");
await pintar(<CampoFecha value="2026-11-20" opcional onChange={(k) => { fecha = k; }} />);
await click(document.querySelector("button[aria-haspopup=dialog]"));
await click(btn("Quitar fecha")); await esperar(450);
ok(fecha === "", "Fecha: «Quitar fecha» deja el campo vacío");

/* Fecha con días marcados (Propinas: verde = todo repartido, rojo = por repartir) */
await pintar(<CampoFecha value="2026-11-20" onChange={() => {}} marcas={{ "2026-11-23": "ok", "2026-11-24": "alerta" }} leyenda={[{ tono: "ok", texto: "Todo repartido" }, { tono: "alerta", texto: "Por repartir" }, { tono: "neutro", texto: "Sin propinas" }]} />);
await click(document.querySelector("button[aria-haspopup=dialog]"));
const diaM = (n) => document.querySelector(`[role=gridcell][aria-label*='${n} nov 2026']`);
ok(diaM(23).getAttribute("aria-label").includes("Todo repartido") && diaM(24).getAttribute("aria-label").includes("Por repartir"), "Fecha con marcas: los días verde y rojo dicen su estado (no solo color)");
ok(!diaM(25).getAttribute("aria-label").includes(","), "Fecha con marcas: un día sin propinas queda neutro");
ok(txt().includes("Sin propinas") && txt().includes("Por repartir"), "Fecha con marcas: muestra la leyenda");
await click(btn("Cerrar")); await esperar(450);

/* Hora */
let hora = "";
await pintar(<CampoHora value="" onChange={(h) => { hora = h; }} titulo="Hora de la reserva" />);
await click(document.querySelector("button[aria-haspopup=dialog]"));
/* La hora se elige con tres ruedas (hora · minutos · a. m./p. m.) y se confirma con «Listo». Una rueda se mueve con el desplazamiento; la prueba lo imita. */
const girar = (etiqueta, i) => act(async () => { const el = document.querySelector(`[role=listbox][aria-label="${etiqueta}"]`); el.scrollTop = i * 44; el.dispatchEvent(new Event("scroll")); await new Promise((r) => setTimeout(r, 220)); });
ok(!!document.querySelector("[role=listbox][aria-label=Hora]") && !!document.querySelector("[role=listbox][aria-label=Minutos]") && !!document.querySelector("[role=listbox][aria-label='a. m. o p. m.']"), "Hora: se abre con tres ruedas (hora, minutos y a. m./p. m.)");
await girar("Hora", 3);          // 4
await girar("Minutos", 6);       // 30
ok(hora === "", "Hora: mientras se gira no cambia nada hasta pulsar «Listo»");
await click(btn("Listo")); await esperar(450);
ok(hora === "16:30", "Hora: 4 + 30 + p. m. → «16:30»");

/* Pendientes */
const AHORA = Date.now();
const deudas = [{ id: "d1", cuentaId: "c1", mesa: "1", lugar: "Mesa 1", ts: AHORA, total: 18000, pagadoAntes: 0, saldo: 18000, estado: "pendiente", cliente: { nombre: "Carlos", telefono: "3127275832", busqueda: "carlos 3127275832" }, cobros: [] }];
await pintar(<PendientesView deudas={deudas} usuarioActual={{ uid: "a", nombre: "Jefe", roles: ["admin"] }} turnoAbierto config={{}} />);
ok(!document.querySelector("input[type=date]"), "Pendientes: ya no usa el calendario del sistema");
ok(!!document.querySelector(".campo-prefijo input[aria-label='Buscar cuenta pendiente']"), "Pendientes: el buscador usa el borde de foco del contenedor (sin recuadro incompleto)");
ok(txt().includes("Más antigua") && txt().includes("Pendientes") && !txt().includes("Cuentas pendientes"), "Pendientes: las tres etiquetas del resumen caben en una línea");
const chipPend = [...document.querySelectorAll("button[role=tab]")].find((b) => b.textContent === "Pendientes");
ok(/chip-on-bg/.test(chipPend.getAttribute("style")) && /chip-on-fg/.test(chipPend.getAttribute("style")), "Pendientes: el chip activo define fondo y texto (ya no queda invisible)");

/* Propina: botón «Cambiar propina» */
const orders = [{ id: "o1", cuentaId: "c1", mesa: "5", estado: "servido", ts: 1, items: [{ id: "a", name: "Plato", qty: 1, price: 100000, listos: 1, servidos: 1 }] }];
store.cuentas.c1 = { id: "c1", mesa: "5", ts: 1, estado: "abierta", personas: 2, pagos: [], propina: { pct: 10, monto: 10000 } };
const cajero = { uid: "u1", nombre: "Luis", roles: ["cajero"] };
const tarjeta = () => <MesaCuentaCard key={JSON.stringify(store.cuentas.c1.propina)} cuenta={store.cuentas.c1} orders={orders} saveCuenta={async () => {}} saveOrdersMap={async () => {}} turnoAbierto usuarioActual={cajero} mesas={[{ id: "5", nombre: "Mesa 5" }]} ajustarInventario={() => {}} expanded onToggle={() => {}} modoPanel />;
await pintar(tarjeta());
ok(!txt().includes("cambiar") || !!btn("Propina y descuento"), "Propina: el enlace «cambiar» ya no existe");
await click(btn("Propina y descuento"));
ok(!!btn("Cambiar propina") && txt().includes("10%"), "Propina: con propina puesta aparece el botón «Cambiar propina» (10%)");
await click(btn("Cambiar propina"));
await click([...document.querySelectorAll("button")].find((b) => b.textContent === "15%"));
await esperar(50);
ok(store.cuentas.c1.propina.pct === 15 && store.cuentas.c1.propina.monto === 15000, "Propina: tocar 15% la cambia al instante ($15.000)");

/* Análisis: margen objetivo + horas */
let cfg = null;
const dia0 = new Date(); dia0.setHours(0, 0, 0, 0);
const cuentasA = [], ordersA = [];
for (let w = 0; w < 9; w++) for (const hh of [17, 18, 19, 20, 21, 22, 23, 0, 1]) {
  const ts = dia0.getTime() - (w * 7 + 1) * 86400000 + hh * 3600000;
  const id = `a${w}-${hh}`;
  cuentasA.push({ id, mesa: "1", ts, estado: "pagada", pagadaTs: ts, pagos: [{ id: `p${id}`, ts, metodoPago: "efectivo", monto: 40000 }], personas: 2 });
  ordersA.push({ id: `o${id}`, cuentaId: id, mesa: "1", estado: "servido", ts, items: [{ id: "x", name: "Plato", qty: 1, price: 40000, cost: 30000 }] });
}
const propsA = { onClose: () => {}, menu: [{ id: "x", name: "Plato", cat: "Comidas", price: 40000, cost: 30000 }], persistMenu: () => {}, insumos: [], config: { margenObjetivo: 65, margenActivo: true }, persistConfig: (c) => { cfg = c; }, cuentasAnalisis: cuentasA, ordersAnalisis: ordersA, cargarHistorialReciente: () => {}, historialListo: true, errorHistorial: false, cargandoHistorial: false };
await pintar(<Analisis {...propsA} />); await esperar(30);
await click([...document.querySelectorAll("button")].find((b) => b.textContent === "Costos")); await esperar(30);
ok(txt().includes("Margen objetivo") && !!btn("70%") && !!document.querySelector("button[aria-label='Subir el objetivo 5 puntos']"), "Margen objetivo: opciones rápidas (40–80%) y botones − / + para ajustar");
await click(btn("70%"));
ok(cfg && cfg.margenObjetivo === 70, "Margen objetivo: tocar 70% lo guarda al instante");
await click(document.querySelector("button[aria-label='Bajar el objetivo 5 puntos']"));
ok(cfg.margenObjetivo === 60, "Margen objetivo: «−» baja 5 puntos (65 → 60)");
ok(txt().includes("Tu margen en los últimos 30 días") && txt().includes("Productos por debajo del objetivo") && !!btn("Subir el precio a"), "Margen objetivo: muestra tu margen, los productos bajos y permite subir el precio");
await click([...document.querySelectorAll("button")].find((b) => b.textContent === "Semana")); await esperar(30);
ok(txt().includes("5 p. m.") || (txt().includes("5") && txt().includes("p. m.")), "Mapa de ventas: las horas se muestran como «5 / p. m.»");
ok(!/\d+–\d+ h/.test(txt()), "Personal sugerido: ya no aparece el formato «0–1 h»");
ok(/\d:00 (a|p)\. m\./.test(txt()) || /\d:00 – \d:00/.test(txt()), "Personal sugerido: rango con hora de reloj («5:00 – 6:00 p. m.»)");

console.log(fallas ? `\n✘ ${fallas} fallas` : "\nTodo bien en el humo de la ronda 2");
process.exit(fallas ? 1 : 0);

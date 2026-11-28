import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { LimiteErrores } from "../../src/componentes/LimiteErrores.jsx";
import { FilaDato } from "../../src/componentes/Comunes.jsx";
import { SeccionR } from "../../src/pantallas/ReportesExtra.jsx";

/* Pantallas de Análisis y reportes: secciones plegables, ancho de las filas y red de seguridad por pestaña. */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let fallas = 0; const ok = (c, t) => { if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const esperar = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const cont = document.createElement("div"); document.body.appendChild(cont); const root = createRoot(cont);
const pintar = (el) => act(async () => { root.render(el); });
const txt = () => document.body.textContent;
const click = (el) => act(async () => { el.click(); });

/* SeccionR: cerrada al entrar, con resumen visible; se abre y se cierra con un toque */
await pintar(<SeccionR titulo="VENTAS POR DÍA" resumen="7 días · $321.500" nota="Toca un día para ver su detalle."><div>contenido de prueba</div></SeccionR>);
const cabeza = () => document.querySelector("button[aria-expanded]");
ok(cabeza().getAttribute("aria-expanded") === "false", "Sección: entra cerrada");
ok(txt().includes("VENTAS POR DÍA") && txt().includes("7 días · $321.500"), "Sección: cerrada muestra el título y el resumen");
await click(cabeza()); await esperar(30);
ok(cabeza().getAttribute("aria-expanded") === "true" && txt().includes("contenido de prueba") && txt().includes("Toca un día para ver su detalle."), "Sección: al tocarla se abre y muestra la ayuda y el contenido");
await click(cabeza()); await esperar(30);
ok(cabeza().getAttribute("aria-expanded") === "false", "Sección: otro toque la cierra");
await pintar(<SeccionR key="otra" inicialAbierto titulo="TOP 5 PRODUCTOS"><div>x</div></SeccionR>);
ok(cabeza().getAttribute("aria-expanded") === "true", "Sección: con inicialAbierto entra abierta");

/* Fila de datos: ancho máximo para que el valor quede cerca del nombre en pantallas anchas */
await pintar(<FilaDato nombre="Café" detalle="3 vendidos" valor="$12.000" />);
ok(cont.firstChild.style.maxWidth === "640px", "Fila de datos: ancho máximo 640 px");

/* Error Boundary compacto: si una pestaña falla, solo ella muestra el aviso */
function Bomba() { throw new Error("boom de prueba"); }
const silenciar = console.error; console.error = () => {};
await pintar(<div><div id="cabecera">Cabecera</div><LimiteErrores compacto origen="analisis:costos" texto="esta pestaña"><Bomba /></LimiteErrores></div>);
console.error = silenciar;
ok(txt().includes("No se pudo mostrar esta pestaña") && txt().includes("Cabecera") && !txt().includes("Algo salió mal en esta pantalla"), "Pestaña rota: aviso solo en la pestaña (lo demás sigue visible)");
ok(!!document.querySelector("[role=alert]") && [...document.querySelectorAll("button")].some((b) => b.textContent === "Intentar de nuevo"), "Pestaña rota: el aviso es accesible y ofrece «Intentar de nuevo»");
let sano = false;
function Hijo() { if (!sano) throw new Error("boom"); return <div>Costos recuperado</div>; }
console.error = () => {};
await pintar(<LimiteErrores compacto key="a"><Hijo /></LimiteErrores>);
sano = true;
await click([...document.querySelectorAll("button")].find((b) => b.textContent === "Intentar de nuevo"));
console.error = silenciar;
ok(txt().includes("Costos recuperado"), "Pestaña rota: «Intentar de nuevo» la recupera cuando el problema ya no está");

console.log(fallas ? `\n✘ ${fallas} fallas` : "\nTodo bien en el humo de Análisis");
process.exit(fallas ? 1 : 0);

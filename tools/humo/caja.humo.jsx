import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { CajaView } from "../../src/pantallas/Caja.jsx";
import { store } from "./firebase-stub.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let fallas = 0; const ok = (c, t) => { if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const esperar = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const admin = { uid: "u2", nombre: "Jefe", roles: ["admin"] };
const AHORA = Date.now(), DIA = 86400000;
const deudas = [
  { id: "d1", cuentaId: "c1", mesa: "5", lugar: "Mesa 5", ts: AHORA - 9 * DIA, total: 50000, pagadoAntes: 10000, saldo: 40000, estado: "pendiente", cliente: { nombre: "Carlos", telefono: "3001234567", busqueda: "carlos 3001234567" }, cobros: [] },
];
const turno = { id: "t1", aperturaTs: AHORA - 3600000, estado: "abierto", fondo: 0, cajero: "Jefe" };
const props = { deudas, menu: [], orders: [], cuentas: [], saveCuenta: async () => {}, saveOrdersMap: async () => {}, turnos: [turno], turnoAbierto: turno, saveTurno: async () => {}, config: {}, persistConfig: () => {}, usuarioActual: admin, mesas: [], persistMesas: () => {}, equipo: [], insumos: [], saveInsumo: () => {}, updateInsumo: () => {}, deleteInsumo: () => {}, ajustarInventario: () => {}, ordersParaHistorial: [], cuentasParaHistorial: [], onIr: () => {}, historialCompleto: false, cargandoHistorial: false, cargarHistorialCompleto: () => {} };
const cont = document.createElement("div"); document.body.appendChild(cont); const root = createRoot(cont);
const pintar = (p) => act(async () => { root.render(<React.Suspense fallback={<div>cargando-app</div>}><CajaView {...props} {...p} /></React.Suspense>); });
const btn = (t) => [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const click = (el) => act(async () => { el.click(); });

await pintar({}); await esperar(50);
ok(!!btn("Pendientes"), "Caja: aparece la pestaña Pendientes");
ok(btn("Pendientes").textContent.includes("●"), "Caja: la pestaña marca en rojo (●) cuando hay una deuda de 7+ días");
await click(btn("Pendientes")); await esperar(20);
ok(document.body.textContent.includes("Carlos") && document.body.textContent.includes("40.000"), "Pendientes: muestra la deuda");
await click(btn("Inventario")); await esperar(300);
ok(!document.body.textContent.includes("cargando-app"), "Inventario: la pestaña (carga diferida) termina de cargar");
await pintar({ abrirTab: { tab: "pendientes", n: 1 } }); await esperar(20);
ok(document.body.textContent.includes("Carlos"), "Alerta: abrirTab lleva directo a Pendientes");

console.log(fallas ? `\n✘ ${fallas} fallas` : "\nTodo bien en el humo de Caja");
process.exit(fallas ? 1 : 0);

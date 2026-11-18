import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { PendientesView } from "../../src/pantallas/Pendientes.jsx";
import { registrarPendiente } from "../../src/deudasOps.js";
import { store } from "./firebase-stub.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let fallas = 0; const ok = (c, t) => { if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const esperar = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const cajero = { uid: "u1", nombre: "Luis", roles: ["cajero"] };
const admin = { uid: "u2", nombre: "Jefe", roles: ["admin"] };

const orders = [{ id: "o1", cuentaId: "c1", estado: "listo", ts: 1, items: [{ id: "a", name: "Plato", qty: 1, price: 100000 }] }];
store.cuentas.c1 = { id: "c1", mesa: "5", ts: 1, estado: "abierta", pagos: [{ id: "p1", ts: Date.now() - 1000, metodoPago: "efectivo", monto: 60000 }] };

let r;
await act(async () => { r = await registrarPendiente({ cuenta: store.cuentas.c1, orders, cliente: { nombre: "Carlos Pérez", telefono: "3001234567" }, nota: "vuelve el viernes", usuario: cajero, lugar: "Mesa 5", items: [{ name: "Plato", qty: 1, price: 100000 }] }); });
ok(r.ok && store.cuentas.c1.estado === "pendiente" && store.deudas["d-c1"].saldo === 40000, "registrarPendiente: cuenta pendiente + deuda de 40.000");
ok(store.auditoria[0] && store.auditoria[0].accion === "dejar_pendiente", "queda en la bitácora");

const cont = document.createElement("div"); document.body.appendChild(cont);
const root = createRoot(cont);
const pintar = (usuario, turno = true) => act(async () => { root.render(<PendientesView deudas={Object.values(store.deudas).filter((d) => d.estado === "pendiente")} usuarioActual={usuario} turnoAbierto={turno} config={{}} />); });

await pintar(cajero);
ok(cont.textContent.includes("Carlos Pérez") && cont.textContent.includes("$40.000") || cont.textContent.includes("40.000"), "la lista muestra al cliente y el saldo");
ok(!cont.textContent.includes("Condonadas"), "el cajero NO ve los filtros de administrador (Pagadas/Condonadas)");

// buscador
const input = cont.querySelector("input[aria-label='Buscar cuenta pendiente']");
const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new window.Event("input", { bubbles: true })); };
await act(async () => setVal(input, "zzz"));
ok(cont.textContent.includes("Sin resultados"), "buscador: sin coincidencias muestra 'Sin resultados'");
await act(async () => setVal(input, "perez"));
ok(cont.textContent.includes("Carlos Pérez"), "buscador: 'perez' encuentra 'Pérez' (sin tildes)");

// abrir detalle
await act(async () => cont.querySelector("button[aria-label^='Abrir cuenta pendiente']").click());
const hoja = () => document.body.textContent;
ok(hoja().includes("SALDO PENDIENTE") && hoja().includes("Plato") && hoja().includes("vuelve el viernes"), "el detalle muestra saldo, consumo y nota");
ok(!hoja().includes("Condonar esta deuda"), "el cajero NO ve el botón de condonar");

// abonar 15.000
const inputs = () => [...document.body.querySelectorAll("input")];
const campoMonto = inputs().find((i) => i.placeholder.startsWith("Todo ("));
await act(async () => setVal(campoMonto, "15000"));
const btnAbono = [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes("Registrar abono"));
ok(!!btnAbono && btnAbono.textContent.includes("quedan"), "botón de abono muestra cuánto quedaría");
await act(async () => btnAbono.click()); await esperar(400);
ok(store.deudas["d-c1"].saldo === 25000 && store.deudas["d-c1"].cobros.length === 1, "abono de 15.000 → quedan 25.000 en la deuda");
ok(store.cuentas.c1.pagos.length === 2 && store.cuentas.c1.pagos[1].monto === 15000 && store.cuentas.c1.estado === "pendiente", "el abono entró a la cuenta (caja) y sigue pendiente");

// admin: condonar
await pintar(admin);
ok(cont.textContent.includes("Condonadas") && cont.textContent.includes("Pagadas"), "el administrador ve los filtros Pendientes/Pagadas/Condonadas");
await act(async () => cont.querySelector("button[aria-label^='Abrir cuenta pendiente']").click());
await act(async () => [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes("Condonar esta deuda")).click());
const btnCond = () => [...document.body.querySelectorAll("button")].find((b) => b.textContent.startsWith("Condonar $") || b.textContent.startsWith("Condonar "));
ok(btnCond().disabled === true, "condonar está bloqueado sin motivo");
await act(async () => setVal(inputs().find((i) => i.placeholder.startsWith("Motivo")), "Cortesía de la casa"));
await act(async () => btnCond().click()); await esperar(400);
ok(store.deudas["d-c1"].estado === "condonada" && store.deudas["d-c1"].saldoCondonado === 25000 && store.cuentas.c1.estado === "condonada", "condonada: deuda y cuenta quedan condonadas (25.000)");
ok(store.auditoria.map((a) => a.accion).join() === "dejar_pendiente,cobrar_pendiente,condonar_deuda", "bitácora: dejar → cobrar → condonar");

// pestaña Condonadas del admin
await act(async () => [...cont.querySelectorAll("button[role=tab]")].find((b) => b.textContent === "Condonadas").click()); await esperar(100);
ok(cont.textContent.includes("Carlos Pérez") && cont.textContent.includes("condonado"), "pestaña Condonadas lista la deuda perdonada");

console.log(fallas ? `\n✘ ${fallas} fallas` : "\nTodo bien en el humo de Pendientes");
process.exit(fallas ? 1 : 0);

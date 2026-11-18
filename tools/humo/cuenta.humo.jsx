import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MesaCuentaCard } from "../../src/pantallas/CuentaMesa.jsx";
import { store } from "./firebase-stub.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let fallas = 0; const ok = (c, t) => { if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const esperar = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const cajero = { uid: "u1", nombre: "Luis", roles: ["cajero"] };
const mesas = [{ id: "5", nombre: "Mesa 5" }, { id: "6", nombre: "Mesa 6" }];
const mkOrders = (cid) => [{ id: `o-${cid}`, cuentaId: cid, mesa: cid === "c1" ? "5" : "6", estado: "servido", ts: 1, items: [
  { id: "a", name: "Plato A", qty: 1, price: 40000, listos: 1, servidos: 1 }, { id: "b", name: "Plato B", qty: 1, price: 35000, listos: 1, servidos: 1 }, { id: "c", name: "Plato C", qty: 1, price: 25000, listos: 1, servidos: 1 }] }];
const orders = [...mkOrders("c1"), ...mkOrders("c2")];
store.cuentas.c1 = { id: "c1", mesa: "5", ts: 1, estado: "abierta", personas: 3, propina: { pct: 10, monto: 10000 }, pagos: [] };
store.cuentas.c2 = { id: "c2", mesa: "6", ts: 1, estado: "abierta", personas: 2, pagos: [] };

const cont = document.createElement("div"); document.body.appendChild(cont); const root = createRoot(cont);
const pintar = (id) => act(async () => { root.render(<MesaCuentaCard key={id} cuenta={store.cuentas[id]} orders={orders} saveCuenta={async () => {}} saveOrdersMap={async () => {}} turnoAbierto usuarioActual={cajero} mesas={mesas} ajustarInventario={() => {}} expanded onToggle={() => {}} modoPanel />); });
const txt = () => document.body.textContent;
const btn = (t) => [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const click = (el) => act(async () => { el.click(); });
const filaProd = (n) => [...document.body.querySelectorAll("div")].find((d) => d.children.length === 2 && d.textContent.startsWith(n) && d.querySelector("button"));
const mas = (nombre) => { const f = filaProd(nombre); const bs = f.querySelectorAll("button"); return bs[bs.length - 1]; };

/* ---- Por producto con propina equitativa ---- */
await pintar("c1");
await click(btn("Por producto"));
ok(txt().includes("Propina de la mesa: $10.000") && txt().includes("Proporcional") && txt().includes("Equitativa"), "Por producto: aparece el selector de propina (Proporcional / Equitativa)");
await click(btn("Equitativa"));
ok(txt().includes("Dividir la propina entre") && txt().includes("÷ 3"), "Equitativa: se divide entre 3 (las personas de la mesa)");

const pagarPersona = async (nombre) => {
  await click(mas(nombre));
  const efectivo = [...document.body.querySelectorAll("button")].find((b) => /Efectivo/.test(b.textContent) && !/Registrar/.test(b.textContent));
  if (efectivo) await click(efectivo);
  const reg = btn("Registrar pago");
  await click(reg); await esperar(200);
};
await click(mas("Plato A"));
ok(txt().includes("propina $3.333") && txt().includes("$43.333"), "persona 1: Productos $40.000 + propina $3.333 = $43.333");
await click(mas("Plato A")); // sin efecto en pantalla; reinicia no aplica
// (Plato A tiene qty 1: el segundo + no pasa de 1)
const efectivo = [...document.body.querySelectorAll("button")].find((b) => /Efectivo/.test(b.textContent) && !/Registrar/.test(b.textContent));
if (efectivo) await click(efectivo);
await click(btn("Registrar pago")); await esperar(200);
const c = store.cuentas.c1;
ok(c.pagos.length === 1 && c.pagos[0].monto === 43333 && c.pagos[0].propinaMonto === 3333, "pago 1 guardado: $43.333 con $3.333 de propina");
ok(c.propinaModo === "equitativa" && c.propinaPagadores === 3, "el modo y el N quedaron guardados con el primer pago");
await pintar("c1");
ok(txt().includes("El reparto queda fijo") && txt().includes("Incluye $3.333 de propina"), "después del primer pago el reparto queda bloqueado y el pago muestra la propina");
await pagarPersona("Plato B");
ok(store.cuentas.c1.pagos[1].propinaMonto === 3333, "persona 2 paga $3.333 de propina");
await pintar("c1");
await pagarPersona("Plato C");
const f = store.cuentas.c1;
ok(f.estado === "pagada" && f.pagos[2].propinaMonto === 3334 && f.pagos.reduce((s, p) => s + p.monto, 0) === 110000, "persona 3 absorbe el redondeo ($3.334) y la cuenta cierra en $110.000 exactos");

/* ---- Dejar saldo pendiente ---- */
await pintar("c2");
ok(!!btn("Dejar como saldo pendiente"), "aparece 'Dejar como saldo pendiente' con saldo por cobrar");
await click(btn("Dejar como saldo pendiente"));
ok(txt().includes("Dejar saldo pendiente") && btn("Confirmar y liberar mesa").disabled === true, "la hoja pide identificar al cliente (confirmar bloqueado)");
const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new window.Event("input", { bubbles: true })); };
await act(async () => setVal([...document.body.querySelectorAll("input")].find((i) => i.placeholder === "Nombre del cliente"), "Marta Ruiz"));
ok(btn("Confirmar y liberar mesa").disabled === false, "con un nombre ya se puede confirmar");
await click(btn("Confirmar y liberar mesa")); await esperar(300);
ok(store.cuentas.c2.estado === "pendiente" && store.cuentas.c2.liberada === true && store.deudas["d-c2"] && store.deudas["d-c2"].saldo === 100000 && store.deudas["d-c2"].cliente.nombre === "Marta Ruiz", "la cuenta pasa a pendiente (mesa libre) y se crea la deuda de $100.000");

console.log(fallas ? `\n✘ ${fallas} fallas` : "\nTodo bien en el humo de CuentaMesa");
process.exit(fallas ? 1 : 0);

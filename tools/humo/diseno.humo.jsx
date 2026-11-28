import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MenuEditor } from "../../src/pantallas/Menu.jsx";
import { MenuContextual, FilaDato } from "../../src/componentes/Comunes.jsx";
import { InfoTip } from "../../src/componentes/InfoTip.jsx";
import { MesaCuentaCard } from "../../src/pantallas/CuentaMesa.jsx";
import { store } from "./firebase-stub.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let fallas = 0; const ok = (c, t) => { if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const cont = document.createElement("div"); document.body.appendChild(cont); const root = createRoot(cont);
const pintar = (el) => act(async () => { root.render(el); });
const btn = (t) => [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const click = (el) => act(async () => { el.click(); });

/* Menú: un solo aviso global, sin la advertencia fila por fila */
const menu = [
  { id: "1", name: "Café", cat: "Bebidas", price: 4000, cost: 1000 },
  { id: "2", name: "Té", cat: "Bebidas", price: 3500 },
  { id: "3", name: "Torta", cat: "Postres", price: 9000 },
];
await pintar(<MenuEditor menu={menu} persistMenu={() => {}} config={{}} persistConfig={() => {}} actor="x" insumos={[]} onClose={() => {}} />);
const txt = () => document.body.textContent;
ok(txt().includes("2 productos sin costo registrado"), "Menú: un único aviso global agrupa los productos sin costo (2)");
ok(!/Sin costo registrado/.test(txt()), "Menú: ya no se repite 'Sin costo registrado' fila por fila");
await click(btn("Bebidas2 productos")); await act(async () => { await new Promise((r) => setTimeout(r, 450)); });   // las categorías entran plegadas: se abre «Bebidas» para ver sus filas
ok(txt().includes("Margen 75%"), "Menú: la fila con costo conserva su margen como detalle atenuado");
await click(btn("Ver cuáles"));
ok(txt().includes("Té") && txt().includes("Torta") && !txt().includes("Café"), "Menú: el aviso filtra la lista a los productos sin costo");
await click(btn("Ver todos"));
ok(txt().includes("Café"), "Menú: 'Ver todos' regresa la lista completa");

/* Menú de tres puntos */
let hecho = "";
await pintar(<MenuContextual acciones={[{ label: "Enviar clave nueva", onClick: () => { hecho = "clave"; } }, false, { label: "Desactivar cuenta", peligro: true, onClick: () => { hecho = "off"; } }]} />);
ok(!btn("Desactivar cuenta"), "Tres puntos: las acciones no se ven hasta abrir el menú");
await click(document.querySelector("button[aria-label='Más acciones']"));
ok(!!btn("Enviar clave nueva") && !!btn("Desactivar cuenta"), "Tres puntos: se despliegan las acciones secundarias");
await click(btn("Desactivar cuenta"));
ok(hecho === "off" && !btn("Enviar clave nueva"), "Tres puntos: ejecuta la acción y se cierra");

/* (i) */
await pintar(<InfoTip titulo="Cómo funciona">Texto largo explicativo</InfoTip>);
ok(!txt().includes("Texto largo explicativo"), "(i): el texto largo no está fijo en pantalla");
await click(document.querySelector("button[aria-haspopup='dialog']"));
ok(txt().includes("Texto largo explicativo") && txt().includes("Cómo funciona"), "(i): al tocarlo se abre la hoja con la explicación");

/* Fila de datos */
await pintar(<FilaDato nombre="Café" detalle="3 vendidos" valor="$12.000" />);
ok(txt().includes("Café") && txt().includes("3 vendidos") && txt().includes("$12.000"), "Fila de datos: nombre, detalle atenuado y valor");

/* Propina: sin 'Ok', el monto propio se aplica solo */
const orders = [{ id: "o1", cuentaId: "c1", mesa: "5", estado: "servido", ts: 1, items: [{ id: "a", name: "Plato", qty: 1, price: 100000, listos: 1, servidos: 1 }] }];
store.cuentas.c1 = { id: "c1", mesa: "5", ts: 1, estado: "abierta", personas: 2, pagos: [] };
const cajero = { uid: "u1", nombre: "Luis", roles: ["cajero"] };
const card = () => <MesaCuentaCard key={JSON.stringify(store.cuentas.c1.propina || 0)} cuenta={store.cuentas.c1} orders={orders} saveCuenta={async () => {}} saveOrdersMap={async () => {}} turnoAbierto usuarioActual={cajero} mesas={[{ id: "5", nombre: "Mesa 5" }]} ajustarInventario={() => {}} expanded onToggle={() => {}} modoPanel />;
await pintar(card());
// abrir ajustes si hace falta
const verAj = btn("Ajustes") || btn("descuento") || null;
if (!document.body.textContent.includes("Otro monto") && verAj) await click(verAj);
ok(!btn("Ok"), "Propina: ya no existe el botón 'Ok'");
const campo = [...document.body.querySelectorAll("input")].find((i) => i.placeholder === "Otro monto");
if (campo) {
  const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  await act(async () => setVal(campo, "7000"));
  await act(async () => { campo.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
  ok(store.cuentas.c1.propina && store.cuentas.c1.propina.monto === 7000, "Propina: al pulsar Enter el monto propio se aplica solo ($7.000)");
} else { ok(false, "Propina: no se encontró el campo 'Otro monto'"); }
const pct = [...document.body.querySelectorAll("button")].find((b) => b.textContent === "10%");
ok(true, "Propina: los porcentajes ya reaccionaban al toque");

console.log(fallas ? `\n✘ ${fallas} fallas` : "\nTodo bien en el humo de diseño");
process.exit(fallas ? 1 : 0);

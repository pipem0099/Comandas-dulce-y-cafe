import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ImpresoraTermica } from "../../src/componentes/ImpresoraTermica.jsx";
import { DatosFactura } from "../../src/componentes/DatosFactura.jsx";
import { BannerConexion } from "../../src/componentes/BannerConexion.jsx";
import { impresora } from "../../src/termica/impresora.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let fallas = 0; const ok = (c, t) => { if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const esperar = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const cont = document.createElement("div"); document.body.appendChild(cont); const root = createRoot(cont);
const pintar = (el) => act(async () => { root.render(el); });
const txt = () => document.body.textContent;
const btn = (t) => [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const click = (el) => act(async () => { el.click(); });
const escribir = (el, v) => act(async () => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new window.Event("input", { bubbles: true })); });

/* ── Impresora ── */
const escritos = [];
const caracteristica = { properties: { writeWithoutResponse: true }, writeValueWithoutResponse: async (b) => { escritos.push(b.length); } };
Object.defineProperty(navigator, "bluetooth", { configurable: true, value: { requestDevice: async () => ({ name: "Impresora-Test", gatt: { connect: async () => ({ getPrimaryServices: async () => [{ getCharacteristics: async () => [caracteristica] }] }), disconnect() {} } }) } });
await pintar(<ImpresoraTermica onCerrar={() => {}} />);
ok(txt().includes("Sin impresora en este equipo") && !!btn("Bluetooth"), "Impresora: sin configurar, ofrece las conexiones que permite el navegador");
ok(btn("Probar impresión").disabled === true, "Impresora: «Probar impresión» espera a que haya impresora");
await click(btn("Bluetooth")); await esperar(50);
ok(txt().includes("Impresora-Test") && txt().includes("Conectada"), "Impresora: al conectar muestra el nombre y confirma");
await click(btn("Probar impresión")); await esperar(80);
ok(escritos.length > 0 && txt().includes("Enviado a la impresora"), "Impresora: la prueba envía datos y lo avisa");
await click(btn("58 mm"));
ok(impresora.config().columnas === 32, "Impresora: elegir papel de 58 mm guarda 32 columnas");
await click(btn("Sin tildes"));
ok(impresora.config().tabla === 0, "Impresora: «Sin tildes» cambia la tabla de caracteres");
await click(btn("Imprimir los pedidos nuevos"));
ok(impresora.config().autoCocina === true && impresora.config().activadoTs > 0 && txt().includes("Activado"), "Impresora: activa la impresión automática de cocina y recuerda desde cuándo");
await click(btn("Quitar la impresora"));
ok(impresora.config().tipo === "" && txt().includes("Sin impresora"), "Impresora: quitarla la borra de este equipo");

/* ── Datos para factura ── */
let guardado = null;
await pintar(<DatosFactura valor={null} onGuardar={(d) => { guardado = d; }} onCerrar={() => {}} />);
ok(txt().includes("Datos para factura") && !!document.querySelector("input[aria-label='Número de documento']"), "Factura: pide tipo y número de documento");
await click(btn("Guardar datos"));
ok(txt().includes("Escribe el nombre") && guardado === null, "Factura: sin datos no guarda y explica qué falta");
await click(document.querySelector("button[aria-haspopup=listbox]"));
await click([...document.querySelectorAll("[role=option]")].find((o) => o.textContent === "NIT")); await esperar(450);
await escribir(document.querySelector("input[aria-label='Número de documento']"), "800197268-9");
await escribir(document.querySelector("input[aria-label='Nombre o razón social']"), "Mi Empresa SAS");
await click(btn("Guardar datos"));
ok(guardado === null && txt().includes("debería ser 4"), "Factura: un dígito de verificación equivocado se detecta y dice el correcto");
await escribir(document.querySelector("input[aria-label='Número de documento']"), "800197268");
await click(btn("Guardar datos")); await esperar(450);
ok(guardado && guardado.tipoDoc === "NIT" && guardado.numero === "800197268" && guardado.dv === "4" && guardado.nombre === "Mi Empresa SAS", "Factura: guarda el NIT con su dígito calculado (800197268-4)");

/* ── Banner de conexión ── */
await pintar(<BannerConexion conexion={{ conectado: true, pendientes: 0, conflictos: 0, sincronizando: false }} esAdmin />);
ok(txt() === "" || !/Sin internet/.test(txt()), "Banner: con internet y nada pendiente no se ve");
await pintar(<BannerConexion conexion={{ conectado: false, pendientes: 2, conflictos: 0, sincronizando: false }} esAdmin />);
ok(/Sin internet/.test(txt()) && /2 cambios se enviarán/.test(txt()), "Banner: sin internet muestra cuántos cambios se enviarán solos");
await pintar(<BannerConexion conexion={{ conectado: true, pendientes: 3, conflictos: 0, sincronizando: true }} esAdmin />);
ok(/Enviando 3 cambios/.test(txt()), "Banner: al volver el internet muestra que está enviando");
await pintar(<BannerConexion conexion={{ conectado: true, pendientes: 0, conflictos: 1, sincronizando: false }} esAdmin />);
ok(/1 cambio hecho sin internet no se pudo aplicar/.test(txt()) && !!btn("Revisar"), "Banner: un choque se avisa aparte, con botón para revisarlo");
await click(btn("Revisar"));
ok(txt().includes("Cambios que no se pudieron aplicar"), "Banner: «Revisar» abre la hoja con los cambios que chocaron");

console.log(fallas ? `\n✘ ${fallas} fallas` : "\nTodo bien");
process.exit(fallas ? 1 : 0);

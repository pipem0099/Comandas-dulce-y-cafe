// Pruebas en NAVEGADOR REAL (Chromium) con un Firebase simulado que guarda entre recargas y permite cortar la conexión.
//   npm run e2e         (construye la versión de prueba y corre todo)
// Si no tienes Chromium: npx playwright-core install chromium   (o define CHROME_PATH con la ruta de tu Chrome/Chromium).
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { iniciarServidor } from "./servidor.mjs";
import { semilla } from "./semilla.mjs";

const RUTA_LOCAL = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const ejecutable = process.env.CHROME_PATH || (existsSync(RUTA_LOCAL) ? RUTA_LOCAL : undefined);
const FOTOS = process.env.E2E_FOTOS || "";
if (FOTOS) mkdirSync(FOTOS, { recursive: true });

let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };

const srv = await iniciarServidor(resolve("dist-e2e"));
const nav = await chromium.launch({ executablePath: ejecutable, args: ["--no-sandbox"] });
const VISTAS = { celular: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, computador: { width: 1366, height: 768 } };

async function contexto(vista = "celular", { sw = false } = {}) {
  const ctx = await nav.newContext({ viewport: VISTAS[vista], serviceWorkers: sw ? "allow" : "block", locale: "es-CO" });
  const s = semilla();
  await ctx.addInitScript((s) => { if (!localStorage.getItem("__fakeDB__")) { localStorage.setItem("__fakeDB__", JSON.stringify(s.db)); localStorage.setItem("__fakeSesion__", JSON.stringify(s.sesion)); } }, s);
  return ctx;
}
async function abrir(ctx) {
  const p = await ctx.newPage();
  p.errores = [];
  p.on("pageerror", (e) => p.errores.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_FAILED|Failed to load resource/.test(m.text())) p.errores.push(m.text()); });
  await p.goto(srv.url);
  await p.getByText("Mesa 1", { exact: true }).waitFor({ timeout: 8000 });
  return p;
}
const db = (p) => p.evaluate(() => window.__fakeRed.db());
const foto = async (p, nombre) => { if (FOTOS) await p.screenshot({ path: `${FOTOS}/${nombre}.png` }); };
const esperarBanner = (p, texto, ms = 6000) => p.getByText(texto).first().waitFor({ timeout: ms }).then(() => true, () => false);

/* ─────────── 1. Arranque ─────────── */
console.log("── Arranque ──");
{
  const ctx = await contexto(); const p = await abrir(ctx);
  ok(await p.getByRole("button", { name: "Mi cuenta" }).isVisible(), "la app abre con la sesión iniciada y muestra las mesas");
  ok(p.errores.length === 0, "sin errores de JavaScript al arrancar", p.errores.join(" | "));
  await ctx.close();
}

/* ─────────── 2. Tomar un pedido (con internet) ─────────── */
console.log("\n── Pedido con internet ──");
{
  const ctx = await contexto(); const p = await abrir(ctx);
  await p.getByText("Mesa 1", { exact: true }).click();
  await p.getByRole("button", { name: "Agregar uno de Limonada de Coco" }).click();
  await p.getByRole("button", { name: "Agregar uno de Limonada de Coco" }).click();
  await p.getByRole("button", { name: /Enviar pedido/ }).click();
  await p.waitForTimeout(800);
  const d = await db(p);
  const ordenes = Object.values(d.orders || {});
  ok(ordenes.length === 1 && ordenes[0].items[0].qty === 2 && ordenes[0].items[0].name === "Limonada de Coco", "el pedido (2 limonadas) llega al servidor");
  ok(Object.values(d.cuentas || {}).length === 1, "se crea la cuenta de la mesa");
  ok(p.errores.length === 0, "sin errores al enviar el pedido", p.errores.join(" | "));
  await ctx.close();
}

/* ─────────── 3. Trabajo sin internet: pedir, recargar, reconectar ─────────── */
console.log("\n── Trabajo sin internet ──");
{
  const ctx = await contexto("celular", { sw: true }); const p = await abrir(ctx);
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await p.waitForTimeout(2500); // el service worker guarda la app y la copia local guarda los datos
  await ctx.setOffline(true); await p.evaluate(() => window.__fakeRed.cortar());
  ok(await esperarBanner(p, "Sin internet"), "al cortarse el internet aparece el aviso «Sin internet»");
  await p.getByText("Mesa 2", { exact: true }).click();
  await p.getByRole("button", { name: "Agregar uno de Americano" }).click();
  await p.getByRole("button", { name: "Agregar uno de Americano" }).click();
  await p.getByRole("button", { name: /Enviar pedido/ }).click();
  await p.waitForTimeout(700);
  ok(await esperarBanner(p, "se enviará"), "el aviso cuenta los cambios guardados que se enviarán solos");
  let d = await db(p);
  ok(!d.orders || Object.values(d.orders).length === 0, "mientras no hay internet el pedido NO está en el servidor");
  await foto(p, "sin-internet-pedido");
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.getByText("Mesa 2", { exact: true }).waitFor({ timeout: 10000 }).catch(() => {});
  ok(await p.getByText("Mesa 2", { exact: true }).isVisible(), "RECARGANDO la app sin internet, abre con los últimos datos guardados");
  ok(await esperarBanner(p, "Sin internet"), "y sigue avisando que no hay internet");
  ok(await esperarBanner(p, "se enviará"), "el pedido tomado sin internet sobrevive a la recarga (sigue pendiente)");
  const libre = await p.locator("text=LIBRE").count();
  ok(libre <= 3, `la Mesa 2 ya no aparece libre (el pedido pendiente se ve encima): ${libre} mesas libres de 4`);
  await foto(p, "sin-internet-recargado");
  await ctx.setOffline(false); await p.evaluate(() => window.__fakeRed.restaurar());
  await p.waitForFunction(() => !document.body.innerText.includes("Sin internet") && !/se enviar/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  d = await db(p);
  const ords = Object.values(d.orders || {});
  ok(ords.length === 1 && ords[0].items[0].name === "Americano" && ords[0].items[0].qty === 2, "al volver el internet el pedido llega solo al servidor (2 americanos)");
  ok(Object.values(d.cuentas || {}).length === 1, "y la cuenta de la mesa también");
  ok(!/Sin internet|se enviar/.test(await p.innerText("body")), "el aviso desaparece cuando todo se envió");
  ok(p.errores.length === 0, "sin errores de JavaScript durante todo el proceso", p.errores.join(" | "));
  await ctx.close();
}

/* ─────────── 4. Calendario propio ─────────── */
console.log("\n── Calendario propio (no el del sistema) ──");
{
  const ctx = await contexto(); const p = await abrir(ctx);
  await p.getByRole("button", { name: "Caja", exact: true }).click();
  await p.getByRole("button", { name: "Pendientes" }).click();
  ok((await p.locator("input[type=date]").count()) === 0, "Pendientes ya no usa el campo de fecha del sistema");
  await p.getByRole("button", { name: "Desde" }).click();
  ok(await p.getByRole("grid").isVisible(), "se abre el calendario de la app");
  await p.getByRole("button", { name: "Hoy", exact: true }).click();
  await p.waitForTimeout(500);
  ok(/\b\d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) \d{4}/.test(await p.innerText("body")), "al elegir «Hoy» el campo muestra la fecha en palabras");
  await ctx.close();
}

/* ─────────── 5. Revisiones visuales en celular, tablet y computador ─────────── */
console.log("\n── Revisión visual (contraste, desbordes) ──");
const revisar = () => {
  const lienzo = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const aRGBA = (c) => { lienzo.clearRect(0, 0, 1, 1); lienzo.fillStyle = "#000"; lienzo.fillStyle = c; lienzo.fillRect(0, 0, 1, 1); const [r, g, b, a] = lienzo.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255]; };
  const mezcla = (f, fondo) => [0, 1, 2].map((i) => f[i] * f[3] + fondo[i] * (1 - f[3]));
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contraste = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const fondoEfectivo = (el) => { const capas = []; for (let e = el; e; e = e.parentElement) { const bg = aRGBA(getComputedStyle(e).backgroundColor); if (bg[3] > 0) { capas.push(bg); if (bg[3] >= 1) break; } } let base = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) base = mezcla(capas[i], base); return base; };
  const malos = [];
  document.querySelectorAll("button, [role=tab], [role=option]").forEach((el) => {
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.5 || el.disabled) return;
    const texto = (el.innerText || "").trim(); if (!texto) return;
    const col = aRGBA(cs.color); const fondo = fondoEfectivo(el);
    const c = contraste(mezcla(col, fondo), fondo);
    if (c < 3) malos.push(`«${texto.slice(0, 30)}» contraste ${c.toFixed(2)}`);
  });
  const ancho = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return { malos, desborde: ancho };
};
for (const [nombre] of Object.entries(VISTAS)) {
  const ctx = await contexto(nombre); const p = await abrir(ctx);
  const pantallas = [
    ["Mesas", async () => {}],
    ["Mesa abierta", async () => { await p.getByText("Mesa 1", { exact: true }).click(); await p.waitForTimeout(400); }],
    ["Caja · Resumen", async () => { await p.getByRole("button", { name: "Caja", exact: true }).click(); await p.waitForTimeout(500); }],
    ["Caja · Pendientes", async () => { await p.getByRole("button", { name: "Pendientes" }).click(); await p.waitForTimeout(400); }],
    ["Caja · Reportes", async () => { await p.getByRole("button", { name: "Reportes" }).click(); await p.waitForTimeout(900); }],
    ["Caja · Inventario", async () => { await p.getByRole("button", { name: "Inventario" }).click(); await p.waitForTimeout(500); }],
    ["Menú y precios", async () => { await p.getByRole("button", { name: "Mi cuenta" }).click(); await p.getByText("Menú y precios").click(); await p.waitForTimeout(700); }],
    ["Impresora de tickets", async () => { await p.getByRole("button", { name: "Mi cuenta" }).click(); await p.locator("button:has-text('Mi cuenta')").last().click(); await p.getByText("Impresora de tickets").click(); await p.getByText("Sin impresora en este equipo").waitFor({ timeout: 4000 }); }],
  ];
  for (const [titulo, ir] of pantallas) {
    try { await ir(); } catch (e) { ok(false, `${nombre} · ${titulo}: no se pudo abrir`, String(e).slice(0, 160)); continue; }
    const r = await p.evaluate(revisar);
    await foto(p, `${nombre}-${titulo.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`);
    ok(r.malos.length === 0, `${nombre} · ${titulo}: ningún botón con texto ilegible`, r.malos.slice(0, 4).join("; "));
    ok(r.desborde <= 1, `${nombre} · ${titulo}: la pantalla no se sale de lado (${r.desborde}px)`);
  }
  ok(p.errores.length === 0, `${nombre}: sin errores de JavaScript en todo el recorrido`, p.errores.slice(0, 3).join(" | "));
  await ctx.close();
}

/* ─────────── 6. Aviso «Hay una versión nueva» ─────────── */
console.log("\n── Versión nueva ──");
const CARPETA_V1 = resolve("dist-e2e"), CARPETA_V2 = resolve("dist-e2e-v2");
const avisoVersion = (p) => p.locator("[data-aviso-version]");
const pedirRevision = (p) => p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
const idDelPaquete = (p) => p.evaluate(() => (document.querySelector("script[type=module]") || {}).src || "");
if (!existsSync(CARPETA_V2)) { ok(false, "falta dist-e2e-v2 (corre npm run e2e:construir)"); }
else {
  {
    srv.cambiarCarpeta(CARPETA_V1);
    const ctx = await contexto("celular", { sw: true }); const p = await abrir(ctx);
    await p.evaluate(async () => { await navigator.serviceWorker.ready; });
    await p.waitForTimeout(2500);
    ok((await avisoVersion(p).count()) === 0, "con la versión al día no aparece ningún aviso");
    srv.cambiarCarpeta(CARPETA_V2);                      // se publica una versión nueva
    await pedirRevision(p);
    await avisoVersion(p).waitFor({ timeout: 6000 }).catch(() => {});
    ok(await avisoVersion(p).isVisible(), "al volver a la pestaña con una versión nueva publicada aparece el aviso");
    const texto = await avisoVersion(p).innerText();
    ok(/Hay una versión nueva/.test(texto) && /Actualizar/.test(texto), "el aviso dice «Hay una versión nueva» con el botón «Actualizar»");
    const caja = await avisoVersion(p).getByRole("button", { name: "Actualizar" }).boundingBox();
    ok(caja && caja.height >= 44 && caja.width >= 44, `el botón «Actualizar» mide al menos 44×44 (${caja ? Math.round(caja.width) + "×" + Math.round(caja.height) : "?"})`);
    const fondo = await avisoVersion(p).evaluate((e) => getComputedStyle(e).backgroundColor);
    const [r, g, b] = (fondo.match(/\d+(\.\d+)?/g) || []).map(Number);
    ok(!(r > 200 && g > 150 && b < 120), `el aviso no es amarillo (fondo ${fondo})`);
    await foto(p, "version-nueva-aviso");
    await ctx.setOffline(true);
    await p.waitForTimeout(400);
    ok((await avisoVersion(p).count()) === 0, "sin internet el aviso se oculta");
    await ctx.setOffline(false);
    await avisoVersion(p).waitFor({ timeout: 6000 }).catch(() => {});
    ok(await avisoVersion(p).isVisible(), "al volver el internet el aviso reaparece");
    ok(p.errores.length === 0, "sin errores de JavaScript durante el aviso", p.errores.join(" | "));
    await ctx.close();
  }
  {
    // Actualizar sin perder lo que se hizo sin internet
    srv.cambiarCarpeta(CARPETA_V1);
    const ctx = await contexto("celular", { sw: true }); const p = await abrir(ctx);
    await p.evaluate(async () => { await navigator.serviceWorker.ready; });
    await p.waitForTimeout(2500);
    const antes = await idDelPaquete(p);
    await p.evaluate(() => window.__fakeRed.cortar());                  // el servidor no responde; el equipo sí tiene internet
    await esperarBanner(p, "Sin internet");
    await p.getByText("Mesa 3", { exact: true }).click();
    await p.getByRole("button", { name: "Agregar uno de Americano" }).click();
    await p.getByRole("button", { name: /Enviar pedido/ }).click();
    ok(await esperarBanner(p, "se enviará"), "se toma un pedido con el servidor caído y queda pendiente");
    await p.evaluate(() => { window.__sinRecargar = true; });
    srv.cambiarCarpeta(CARPETA_V2);
    await pedirRevision(p);
    await avisoVersion(p).waitFor({ timeout: 6000 }).catch(() => {});
    ok(await avisoVersion(p).isVisible(), "con pedidos pendientes también se avisa de la versión nueva");
    await p.waitForTimeout(1500);
    ok(await p.evaluate(() => window.__sinRecargar === true), "la app NO se recarga sola: el pedido en pantalla sigue ahí hasta que se pulse «Actualizar»");
    await avisoVersion(p).getByRole("button", { name: "Actualizar" }).click();
    await p.waitForFunction(() => window.__sinRecargar === undefined, null, { timeout: 25000 }).catch(() => {});
    ok(await p.evaluate(() => window.__sinRecargar === undefined), "al pulsar «Actualizar» la app se recarga");
    await p.getByText("Mesa 3", { exact: true }).waitFor({ timeout: 10000 }).catch(() => {});
    const despues = await idDelPaquete(p);
    ok(antes !== despues && /-v2\./.test(despues), `y arranca con la versión nueva (${antes.split("/").pop()} → ${despues.split("/").pop()})`);
    ok((await avisoVersion(p).count()) === 0, "ya con la versión nueva el aviso desaparece");
    const verV1 = JSON.parse(readFileSync(join(CARPETA_V1, "precache.json"), "utf8")).version, verV2 = JSON.parse(readFileSync(join(CARPETA_V2, "precache.json"), "utf8")).version;
    await p.waitForFunction(async (v1) => !(await caches.keys()).includes("comandas-shell-" + v1), verV1, { timeout: 8000 }).catch(() => {});
    const llaves = await p.evaluate(() => caches.keys());
    ok(llaves.includes("comandas-shell-" + verV2) && !llaves.includes("comandas-shell-" + verV1), "el service worker nuevo quedó activo (guardó la versión 2 y borró la copia de la versión 1)");
    ok(await esperarBanner(p, "se enviará"), "el pedido hecho sin internet sobrevivió a la actualización (sigue pendiente)");
    await p.evaluate(() => window.__fakeRed.restaurar());
    await p.waitForFunction(() => !/se enviar/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    const d = await db(p); const ords = Object.values(d.orders || {});
    ok(ords.length === 1 && ords[0].items[0].name === "Americano", "al volver el servidor el pedido llega completo (1 americano), sin duplicarse ni perderse");
    ok(p.errores.length === 0, "sin errores de JavaScript durante la actualización", p.errores.join(" | "));
    await ctx.close();
    srv.cambiarCarpeta(CARPETA_V1);
  }
}

/* ─────────── 7. Comanda impresa desde el equipo del mesero (impresora simulada, sin internet) ─────────── */
console.log("\n── Impresión de la comanda en el equipo del mesero ──");
{
  // Impresora USB simulada: captura los bytes ESC/POS que la app le manda. NO es una impresora física.
  async function contextoConImpresora(vista, { imprimirAlEnviar = true, autoCocina = false } = {}) {
    const ctx = await contexto(vista);
    await ctx.addInitScript((cfg) => {
      const sim = (window.__impresoraSim = { bytes: [], falla: false });
      const dispositivo = {
        productName: "Impresora simulada", configuration: { interfaces: [{ interfaceNumber: 0, alternates: [{ interfaceClass: 7, endpoints: [{ direction: "out", endpointNumber: 1 }] }] }] },
        open: async () => {}, selectConfiguration: async () => {}, claimInterface: async () => {}, close: async () => {},
        transferOut: async (n, datos) => { if (sim.falla) throw new Error("la impresora no tiene papel"); const u = datos instanceof Uint8Array ? datos : new Uint8Array(datos.buffer ? datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength) : datos); sim.bytes.push(...u); return { status: "ok", bytesWritten: u.length }; },
      };
      Object.defineProperty(navigator, "usb", { value: { getDevices: async () => [dispositivo], requestDevice: async () => dispositivo }, configurable: true });
      if (!localStorage.getItem("termica:config")) localStorage.setItem("termica:config", JSON.stringify({ tipo: "usb", nombre: "Impresora simulada", columnas: 48, tabla: 19, autoCocina: cfg.autoCocina, activadoTs: 0, imprimirAlEnviar: cfg.imprimirAlEnviar }));
    }, { imprimirAlEnviar, autoCocina });
    return ctx;
  }
  const LARGOS = { 0x1B: { 0x40: 2, 0x74: 3, 0x61: 3, 0x45: 3, 0x64: 3, 0x70: 5, 0x21: 3, 0x4D: 3 }, 0x1D: { 0x21: 3, 0x56: 4 } };
  // separa lo que salió por la impresora en tickets (cada corte «GS V» cierra uno) y lo pasa a texto
  function aTickets(bytes) {
    const tickets = []; let actual = [];
    for (let i = 0; i < bytes.length;) {
      const x = bytes[i];
      if (LARGOS[x] && LARGOS[x][bytes[i + 1]]) { const fin = x === 0x1D && bytes[i + 1] === 0x56; i += LARGOS[x][bytes[i + 1]]; if (fin) { tickets.push(actual.join("")); actual = []; } continue; }
      actual.push(x === 0x0A ? "\n" : x >= 0x20 && x < 0x7F ? String.fromCharCode(x) : "?"); i++;
    }
    if (actual.join("").trim()) tickets.push(actual.join(""));
    return tickets;
  }
  const ticketsDe = async (p) => aTickets(await p.evaluate(() => window.__impresoraSim.bytes));
  const esperarTickets = async (p, n, ms = 6000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if ((await ticketsDe(p)).length >= n) return true; await p.waitForTimeout(150); } return false; };
  const ordenes = async (p) => Object.values((await db(p)).orders || {});
  const enviar = async (p, mesa, productos) => {
    if (!(await p.getByRole("button", { name: `Agregar uno de ${productos[0]}` }).isVisible().catch(() => false))) await p.getByText(mesa, { exact: true }).click();
    for (const nombre of productos) await agregarProducto(p, nombre);
    await p.getByRole("button", { name: /Enviar pedido/ }).click();
  };
  // el menú se muestra por categorías: si el producto no está a la vista se prueban las pestañas
  const agregarProducto = async (p, nombre) => {
    for (const cat of [null, "Bebidas", "Comidas", "Postres"]) {
      if (cat) await p.getByRole("button", { name: new RegExp(`^${cat}`) }).first().click().catch(() => {});
      const b = p.getByRole("button", { name: `Agregar uno de ${nombre}` });
      if (await b.isVisible().catch(() => false)) { await b.click(); return; }
    }
    throw new Error(`No se encontró «${nombre}» en el menú`);
  };

  { // 1) sin internet: sale la comanda y la marca se anota al volver
    const ctx = await contextoConImpresora("celular"); const p = await abrir(ctx);
    await p.evaluate(() => window.__fakeRed.cortar()); await ctx.setOffline(true);
    await esperarBanner(p, "Sin internet");
    await enviar(p, "Mesa 3", ["Americano"]);
    ok(await esperarTickets(p, 1), "SIN INTERNET: al enviar el pedido sale la comanda por la impresora");
    const t = await ticketsDe(p);
    ok(t.length === 1 && /COCINA/.test(t[0]) && /Mesa 3/.test(t[0]) && /1 x Americano/.test(t[0]), `y trae la cocina, la mesa y el producto (${JSON.stringify((t[0] || "").replace(/\n+/g, " | ").slice(0, 90))})`);
    ok(await esperarBanner(p, "se enviará"), "el pedido queda pendiente de enviar mientras no haya internet");
    ok((await ordenes(p)).length === 0, "y todavía no llegó al servidor");
    await ctx.setOffline(false); await p.evaluate(() => window.__fakeRed.restaurar());
    await p.waitForFunction(() => !/se enviar/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    await p.waitForFunction(() => { const o = Object.values(window.__fakeRed.db().orders || {})[0]; return !!(o && o.impresiones); }, null, { timeout: 8000 }).catch(() => {});
    const o = (await ordenes(p))[0];
    ok(o && o.impresiones && o.impresiones.n && o.impresiones.n.equipo === "Mesero" && typeof o.impresiones.n.por === "string" && typeof o.impresiones.n.ts === "number", "al volver el internet, el pedido llega con la marca «ya impreso» (anotada después de imprimir)", JSON.stringify(o).slice(0, 400));
    ok((await ticketsDe(p)).length === 1, "y no sale una segunda comanda al sincronizar");
    ok(p.errores.length === 0, "sin errores de JavaScript", p.errores.join(" | "));
    await ctx.close();
  }
  { // 2) la impresora falla: el pedido se envía igual, aviso con «Reintentar», y la marca solo cuando imprime
    const ctx = await contextoConImpresora("celular"); const p = await abrir(ctx);
    await p.evaluate(() => { window.__impresoraSim.falla = true; });
    await enviar(p, "Mesa 4", ["Americano"]);
    await p.getByText("No se pudo imprimir la comanda").first().waitFor({ timeout: 6000 }).catch(() => {});
    ok(await p.getByText("No se pudo imprimir la comanda").first().isVisible(), "si la impresora falla aparece una alerta clara");
    const reintentar = p.getByRole("button", { name: "Reintentar" });
    ok(await reintentar.isVisible(), "con el botón «Reintentar»");
    let o = (await ordenes(p))[0];
    ok(o && o.mesa === "4" && o.items[0].name === "Americano", "el pedido SÍ se envió igual (llegó al servidor)");
    ok(o && !o.impresiones, "y NO queda marcado como impreso (porque no se imprimió)");
    await p.evaluate(() => { window.__impresoraSim.falla = false; });
    await reintentar.click();
    ok(await esperarTickets(p, 1), "al reintentar con la impresora lista, sale la comanda");
    await p.waitForTimeout(800);
    o = (await ordenes(p))[0];
    ok(o && o.impresiones && o.impresiones.n, "y SOLO entonces el pedido queda marcado como impreso");
    ok(p.errores.length === 0, "sin errores de JavaScript", p.errores.join(" | "));
    await ctx.close();
  }
  { // 3) rondas, ajustes y reimpresión
    const ctx = await contextoConImpresora("celular"); const p = await abrir(ctx);
    await enviar(p, "Mesa 2", ["Americano", "Americano", "Sándwich"]);
    ok(await esperarTickets(p, 1), "ronda 1: sale la comanda completa");
    let t = await ticketsDe(p);
    ok(/2 x Americano/.test(t[0]) && /1 x S.ndwich/.test(t[0]) && !/Ronda/.test(t[0]), "la primera ronda no lleva número de ronda");
    await p.waitForTimeout(600);
    await enviar(p, "Mesa 2", ["Torta de chocolate"]);
    ok(await esperarTickets(p, 2), "ronda 2: sale una comanda nueva");
    t = await ticketsDe(p);
    ok(/Ronda 2/.test(t[1]) && /1 x Torta/.test(t[1]) && !/Americano/.test(t[1]), "la ronda 2 lleva «Ronda 2» y SOLO los productos nuevos");
    // modificar el primer pedido: quitar un americano y agregar una limonada
    await p.waitForTimeout(600);
    const orden1 = (await ordenes(p)).find((o) => o.items.some((i) => i.name === "Americano"));
    ok(!!orden1, "el primer pedido está en el servidor");
    await p.getByText(/en cocina/).first().click();                         // el detalle de los pedidos de la mesa está plegado
    await p.getByTitle("Modificar").first().click();
    await p.getByRole("button", { name: /^Bebidas/ }).first().click();
    await p.getByRole("button", { name: "Quitar uno de Americano" }).click();
    await agregarProducto(p, "Limonada de Coco");
    await p.getByRole("button", { name: /Guardar cambios/ }).click();
    ok(await esperarTickets(p, 3), "al modificar un pedido ya enviado sale un ticket de ajuste");
    t = await ticketsDe(p);
    ok(/AJUSTE/.test(t[2]) && /\+ 1 x Limonada/.test(t[2]) && /- 1 x Americano/.test(t[2]) && /CANCELADO/.test(t[2]), `el ajuste dice qué se agregó (+) y qué se canceló (-) (${JSON.stringify(t[2].replace(/\n+/g, " | ").slice(0, 120))})`);
    ok(!/Sándwich|S.ndwich/.test(t[2]), "y no repite lo que no cambió");
    await p.waitForTimeout(800);
    const guardada = (await ordenes(p)).find((o) => o.ultimoAjuste);
    ok(guardada && guardada.impresiones && guardada.impresiones["aj-" + guardada.ultimoAjuste.ts], "el ajuste queda marcado como impreso");
    // reimprimir
    await p.getByRole("button", { name: "Reimprimir comanda" }).first().click();
    ok(await esperarTickets(p, 4), "«Reimprimir comanda» saca el ticket otra vez");
    t = await ticketsDe(p);
    ok(/REIMPRESI/.test(t[3]) && /Mesa 2/.test(t[3]), "y se marca como reimpresión");
    ok(p.errores.length === 0, "sin errores de JavaScript", p.errores.join(" | "));
    await ctx.close();
  }
  { // 4) sin duplicar con la pantalla de Cocina (el mismo equipo hace de mesero y de cocina)
    const ctx = await contextoConImpresora("celular", { autoCocina: true }); const p = await abrir(ctx);
    await enviar(p, "Mesa 1", ["Americano"]);
    ok(await esperarTickets(p, 1), "el equipo del mesero imprime la comanda al enviar");
    await p.waitForTimeout(800);
    await p.getByRole("button", { name: "Cocina", exact: true }).click();
    await p.waitForTimeout(9000);   // más que la espera de Cocina antes de imprimir (6 s)
    ok((await ticketsDe(p)).length === 1, "la pantalla de Cocina NO imprime otra vez un pedido que el mesero ya imprimió");
    // ahora el mesero SIN la opción: Cocina debe imprimirlo ella
    await p.evaluate(() => { const c = JSON.parse(localStorage.getItem("termica:config")); c.imprimirAlEnviar = false; localStorage.setItem("termica:config", JSON.stringify(c)); });
    await p.getByRole("button", { name: "Mesero", exact: true }).click();
    if (await p.getByRole("button", { name: /Mesas/ }).first().isVisible().catch(() => false)) await p.getByRole("button", { name: /Mesas/ }).first().click().catch(() => {});
    await enviar(p, "Mesa 4", ["Sándwich"]);
    ok((await ticketsDe(p)).length === 1, "con la opción apagada el mesero no imprime al enviar");
    await p.getByRole("button", { name: "Cocina", exact: true }).click();
    ok(await esperarTickets(p, 2, 14000), "y entonces Cocina sí imprime el pedido (pasada su espera)");
    await p.waitForTimeout(800);
    const o4 = (await ordenes(p)).find((o) => o.mesa === "4");
    ok(o4 && o4.impresiones && o4.impresiones.n && /^Cocina/.test(o4.impresiones.n.equipo), "y lo marca como impreso por Cocina");
    await p.waitForTimeout(8000);
    ok((await ticketsDe(p)).length === 2, "sin repetirlo");
    ok(p.errores.length === 0, "sin errores de JavaScript", p.errores.join(" | "));
    await ctx.close();
  }
}

await nav.close(); await srv.cerrar();
console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

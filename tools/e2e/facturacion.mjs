// Pruebas en NAVEGADOR REAL de la facturación electrónica (DIAN) con el proveedor SIMULADO.
//   npm run e2e        (corre después de las pruebas generales; necesita `dist-e2e` ya construido)
// El navegador usa el Firebase simulado; las llamadas a /.netlify/functions/facturacion se atienden aquí, en Node, con el MISMO
// código del servidor (tools/facturacion/servicio.mjs): rol, cálculo de montos, idempotencia, cifrado y bitácora son los reales.
// NO prueba proveedores reales (Factus, Alegra, Siigo, Dataico): para eso hacen falta credenciales de sandbox (ver docs/FACTURACION_DIAN.md).
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { iniciarServidor } from "./servidor.mjs";
import { semilla } from "./semilla.mjs";
import { procesar } from "../facturacion/servicio.mjs";
import { crearDbMemoria } from "../facturacion/dbMemoria.mjs";
import { generarLlave, cargarLlave } from "../facturacion/cifrado.mjs";
import { ADAPTADORES } from "../../src/facturacion/adaptadores/index.js";

const RUTA_LOCAL = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const ejecutable = process.env.CHROME_PATH || (existsSync(RUTA_LOCAL) ? RUTA_LOCAL : undefined);
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };

const srv = await iniciarServidor(resolve("dist-e2e"));
const nav = await chromium.launch({ executablePath: ejecutable, args: ["--no-sandbox"] });
const LLAVE = cargarLlave(generarLlave());

/** Base inicial: el negocio de la semilla + un cajero + una cuenta de la Mesa 1 ya cobrada (por liberar) + facturación activa con el simulado. */
function datos(extra = {}) {
  const s = semilla(), ahora = Date.now();
  const caja = { uid: "u-caja", nombre: "Caro Cajera", correo: "caja@e2e.test", roles: { cajero: true }, activo: true };
  s.db.perfiles["u-caja"] = caja; s.db.equipo["u-caja"] = caja;
  s.db.cuentas = { c1: { id: "c1", mesa: 1, estado: "pagada", liberada: false, turnoId: "t1", pagadaTs: ahora - 60000, creadaTs: ahora - 600000, propina: { monto: 0 }, pagos: [{ monto: 18000, metodoPago: "efectivo", ts: ahora - 60000 }] } };
  s.db.orders = { o1: { id: "o1", cuentaId: "c1", mesa: 1, estado: "listo", ts: ahora - 500000, items: [{ id: "m1", name: "Limonada de Coco", qty: 2, price: 9000 }] } };
  s.db.facturacion = { ajustes: { activa: true, modo: "pruebas", proveedor: "simulado", tipoDocumento: "pos", impuesto: "inc", precios: "incluyen", propina: "excluir", emisionAutomatica: false, resolucion: {} } };
  Object.assign(s.db, extra);
  return s;
}

/** Contexto de navegador + puente a la función de facturación. `quien` = uid de la sesión. */
async function contexto(quien, extra) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", locale: "es-CO" });
  const s = datos(extra);
  s.sesion = quien === "u-caja" ? { uid: "u-caja", email: "caja@e2e.test" } : s.sesion;
  await ctx.addInitScript((s) => { if (!localStorage.getItem("__fakeDB__")) { localStorage.setItem("__fakeDB__", JSON.stringify(s.db)); localStorage.setItem("__fakeSesion__", JSON.stringify(s.sesion)); } }, s);
  const secretos = { v: null }; // lo cifrado vive solo en el «servidor» (aquí), nunca en la base que ve el navegador
  const llamadas = [];
  await ctx.route("**/.netlify/functions/facturacion", async (route) => {
    const p = ctx.pages()[0];
    const sinRed = await p.evaluate(() => localStorage.getItem("__offline") === "1");
    if (sinRed) return route.abort("internetdisconnected");
    const volcado = await p.evaluate(() => ({ db: window.__fakeRed.db(), sesion: JSON.parse(localStorage.getItem("__fakeSesion__") || "null") }));
    const base = { ...volcado.db }; if (secretos.v) base.facturacionSecretos = secretos.v;
    const dbm = crearDbMemoria(base);
    const solicitud = JSON.parse(route.request().postData() || "{}");
    llamadas.push(solicitud);
    let n = 0;
    const r = await procesar(solicitud, `tok-${volcado.sesion.uid}`, { db: dbm, verificarToken: async (t) => ({ uid: t.slice(4) }), llave: () => LLAVE, adaptadores: ADAPTADORES, nuevoId: () => String(++n), fetch: async () => { throw new Error("sin red en la prueba"); } });
    const v = dbm.volcar(); secretos.v = v.facturacionSecretos || null;
    await p.evaluate((ramas) => window.__fakeRed.fusionar(ramas), { facturacion: v.facturacion, auditoria: v.auditoria });
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.cuerpo) });
  });
  ctx.llamadas = llamadas;
  return ctx;
}
async function abrir(ctx, { aCaja = false } = {}) {
  const p = await ctx.newPage();
  p.errores = [];
  p.on("pageerror", (e) => p.errores.push(String(e)));
  await p.goto(srv.url);
  if (aCaja) { await p.getByRole("button", { name: "Caja", exact: true }).first().waitFor({ timeout: 8000 }); await p.getByRole("button", { name: "Caja", exact: true }).first().click(); }
  return p;
}
const db = (p) => p.evaluate(() => window.__fakeRed.db());
const etiqueta = (p) => p.getByTestId("factura-etiqueta");
const esperarEtiqueta = (p, texto, ms = 8000) => etiqueta(p).filter({ hasText: texto }).waitFor({ timeout: ms }).then(() => true, () => false);

/* ─────────── 1. El administrador configura la facturación ─────────── */
console.log("── Administrador configura ──");
{
  const ctx = await contexto("u-admin", { facturacion: null });
  const p = await abrir(ctx);
  await p.getByRole("button", { name: "Mi cuenta" }).first().click();
  await p.getByText("Facturación electrónica", { exact: true }).click();
  await p.getByText("Paso 1 de 5").waitFor({ timeout: 8000 });
  ok(await p.getByText("Paso 1 de 5").isVisible(), "el administrador abre «Facturación electrónica» desde su menú y ve el asistente (Paso 1 de 5)");
  // Paso 1: emisor con DV automático y municipio de Caldas con DANE automático
  await p.getByLabel("Razón social").fill("Dulce y Café SAS");
  await p.getByLabel("NIT", { exact: true }).fill("900123456");
  ok(/DV: 8/.test(await p.getByTestId("dv-calculado").innerText()), "el dígito de verificación del NIT se calcula solo (900123456 → 8)");
  ok((await p.getByTestId("dane").innerText()).trim() === "17001", "Manizales por defecto: el Cód. DANE se llena solo (17001) y es de solo lectura");
  await p.getByRole("button", { name: "Municipio (Caldas)" }).click();
  await p.getByRole("searchbox").fill("neira");
  await p.getByRole("option", { name: "Neira" }).click();
  ok((await p.getByTestId("dane").innerText()).trim() === "17486", "al elegir Neira el Cód. DANE cambia solo a 17486");
  await p.getByRole("button", { name: "Responsabilidad fiscal" }).click();
  await p.getByRole("option", { name: /O-48/ }).click();
  await p.getByLabel("Dirección del establecimiento").fill("Cra 10 # 5-20");
  await p.getByLabel("Teléfono").fill("3001234567");
  await p.getByLabel("Correo oficial").fill("facturas@dulceycafe.co");
  await p.getByRole("button", { name: "Siguiente" }).click();
  // Paso 2: ambiente (Producción y de vuelta a Pruebas) · Paso 3: proveedor y credenciales (cifradas en el servidor)
  await p.getByRole("button", { name: "Siguiente" }).click();
  await p.getByRole("button", { name: "Proveedor tecnológico" }).click();
  await p.getByRole("option", { name: /Alegra/ }).click();
  ok(await p.getByTestId("estado-credenciales").innerText() === "Sin configurar", "al elegir Alegra aparece «Sin configurar»");
  await p.getByLabel("Correo electrónico").fill("contador@restaurante.co");
  await p.getByLabel("Token API").fill("token-secreto-muy-largo-9876");
  await p.getByRole("button", { name: "Guardar credenciales" }).click();
  await p.getByText(/Configurado \(••••9876\)/).waitFor({ timeout: 8000 }).catch(() => {});
  ok(await p.getByTestId("estado-credenciales").innerText() === "Configurado (••••9876)", "tras guardar muestra solo «Configurado (••••9876)»");
  ok(await p.getByLabel("Token API").inputValue() === "", "el campo secreto queda vacío: la app nunca vuelve a mostrar la llave");
  const volcado = JSON.stringify(await db(p));
  ok(!volcado.includes("token-secreto-muy-largo-9876") && !volcado.includes("contador@restaurante.co"), "el secreto NO está en ninguna rama que lea el navegador");
  ok(!/facturacionSecretos/.test(volcado), "la rama cifrada no es visible desde el navegador");
  // Volver a simulado, «Probar conexión» y avanzar
  await p.getByRole("button", { name: "Proveedor tecnológico" }).click();
  await p.getByRole("option", { name: /Simulado/ }).click();
  await p.getByRole("button", { name: /Conexión, catálogos y pruebas/ }).click();
  await p.getByRole("button", { name: "Probar conexión" }).click();
  await p.getByTestId("resultado-sync").waitFor({ timeout: 8000 });
  ok(/✔/.test(await p.getByTestId("resultado-sync").innerText()), "«Probar conexión» con el simulado responde bien");
  ok((await db(p)).facturacion.catalogo && (await db(p)).facturacion.catalogo.pruebas, "los catálogos sincronizados quedan guardados por ambiente (pruebas)");
  await p.getByRole("button", { name: "Siguiente" }).click();
  // Paso 4: reglas · Paso 5: resolución con consecutivo
  await p.getByRole("button", { name: "Impuesto", exact: true }).click();
  await p.getByRole("option", { name: /IVA/ }).click();
  await p.getByRole("button", { name: "Siguiente" }).click();
  await p.getByLabel("Prefijo").fill("sett");
  await p.getByLabel("Número de resolución").fill("18760000001");
  await p.getByLabel("Rango desde").fill("100");
  await p.getByLabel("Rango hasta").fill("500");
  await p.getByLabel("Consecutivo actual").fill("900");
  await p.getByRole("button", { name: "Guardar configuración" }).click();
  ok(/entre 100 y 500/.test(await p.getByText(/entre 100 y 500/).first().innerText()), "un consecutivo fuera del rango NO deja avanzar");
  for (const et of ["Prefijo", "Número de resolución", "Rango desde", "Rango hasta", "Consecutivo actual"]) await p.getByLabel(et).fill("");   // en Pruebas la resolución es opcional
  await p.getByRole("button", { name: "Guardar configuración" }).click();
  await p.getByText("Configuración guardada.").waitFor({ timeout: 8000 }).catch(() => {});
  const aj = (await db(p)).facturacion.ajustes;
  ok(aj && aj.proveedor === "simulado" && aj.impuesto === "iva" && aj.modo === "pruebas", "los ajustes (simulado, IVA, pruebas) quedan guardados");
  ok(aj.emisor && aj.emisor.nit === "900123456" && aj.emisor.dv === "8" && aj.emisor.regimen === "responsable_iva" && aj.emisor.codigoDane === "17486" && aj.emisor.municipio === "Neira" && aj.emisor.telefono === "3001234567", "el emisor queda guardado con su DV, municipio y DANE");
  // Ya configurada: 5 tarjetas resumen; «Editar» abre la hoja con Cancelar / Guardar
  await p.getByTestId("tarjeta-3").waitFor({ timeout: 8000 });
  ok(await p.getByRole("button", { name: /Editar/ }).count() === 5, "ya configurada: 5 tarjetas resumen, cada una con su botón «Editar»");
  await p.getByRole("button", { name: "Editar Proveedor y pruebas" }).click();
  await p.getByRole("button", { name: /Conexión, catálogos y pruebas/ }).click();
  await p.getByRole("button", { name: "Simular factura" }).click();
  await p.getByTestId("resultado-emision").waitFor({ timeout: 8000 });
  ok(Object.keys((await db(p)).facturacion.documentos || {}).every((k) => !k.startsWith("PRUEBA")), "la prueba de emisión no crea documentos de cuentas reales");
  ok(Object.values((await db(p)).auditoria || {}).some((a) => a.accion === "guardar_credenciales_fiscales"), "guardar credenciales queda en la bitácora");
  ok(Object.values((await db(p)).auditoria || {}).some((a) => a.accion === "prueba_emision_fiscal"), "la prueba de emisión queda en la bitácora");
  ok(p.errores.length === 0, "sin errores de JavaScript en el panel", p.errores.join(" | "));
  await ctx.close();
}

/* ─────────── 2. Emisión correcta con el simulado ─────────── */
console.log("\n── Emisión con el simulado ──");
{
  const ctx = await contexto("u-caja"); const p = await abrir(ctx);
  await p.getByText("Mesa 1", { exact: true }).first().waitFor({ timeout: 8000 });
  ok(await esperarEtiqueta(p, "Sin facturar") || await p.getByRole("button", { name: /Emitir factura/ }).isVisible(), "la cuenta cobrada muestra «Emitir factura»");
  await p.getByRole("button", { name: /Emitir factura/ }).click();
  ok(await esperarEtiqueta(p, "Emitida"), "el estado pasa a «Emitida»");
  ok((await p.getByTestId("factura-numero").innerText()).length > 0 && (await p.getByTestId("factura-cufe").innerText()).length > 0, "se muestran número y CUFE");
  ok(await p.getByRole("button", { name: /Ver \/ descargar PDF/ }).isVisible(), "aparece «Ver / descargar PDF»");
  const docs = Object.values((await db(p)).facturacion.documentos || {});
  ok(docs.length === 1 && docs[0].estado === "emitida" && docs[0].proveedor === "simulado", "hay un único documento emitido por el simulado");
  ok(ctx.llamadas.filter((x) => x.accion === "emitir").length === 1, "se hizo una sola llamada de emisión");
  ok(docs[0].payload && docs[0].payload.cliente && docs[0].payload.cliente.numero === "222222222222" && docs[0].payload.cliente.tipoDoc === "CC", "una cuenta sin datos del cliente se emite a Consumidor Final (222222222222, CC)");
  await ctx.close();
}

/* ─────────── 3. Sin internet: queda pendiente y se envía sola al volver, sin duplicar ─────────── */
console.log("\n── Emisión sin internet ──");
{
  const ctx = await contexto("u-caja"); const p = await abrir(ctx);
  await p.getByText("Mesa 1", { exact: true }).first().waitFor({ timeout: 8000 });
  await p.evaluate(() => window.__fakeRed.cortar());
  await p.getByRole("button", { name: /Emitir factura/ }).click();
  ok(await esperarEtiqueta(p, "Pendiente de envío"), "sin internet el estado es «Pendiente de envío»");
  ok(Object.values((await db(p)).facturacion.documentos || {}).length === 0, "todavía no existe documento en el servidor");
  await p.evaluate(() => window.__fakeRed.restaurar());
  ok(await esperarEtiqueta(p, "Emitida", 15000), "al volver el internet se emite sola");
  const docs = Object.values((await db(p)).facturacion.documentos || {});
  ok(docs.length === 1, "queda un único documento (sin duplicados)");
  await p.waitForTimeout(1500);
  ok(ctx.llamadas.filter((x) => x.accion === "emitir").length === 1, "el servidor recibió exactamente una emisión");
  await ctx.close();
}

/* ─────────── 4. El cajero no puede anular; el administrador sí ─────────── */
console.log("\n── Anulación ──");
{
  const ctx = await contexto("u-caja"); const p = await abrir(ctx);
  await p.getByText("Mesa 1", { exact: true }).first().waitFor({ timeout: 8000 });
  await p.getByRole("button", { name: /Emitir factura/ }).click();
  await esperarEtiqueta(p, "Emitida");
  ok(await p.getByRole("button", { name: /Anular factura/ }).count() === 0, "el cajero NO ve el botón «Anular factura»");
  const r = await p.evaluate(async () => { const r = await fetch("/.netlify/functions/facturacion", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer x" }, body: JSON.stringify({ accion: "anular", cuentaId: "c1", motivo: "intento del cajero" }) }); return { status: r.status }; });
  ok(r.status === 403, "aunque el cajero lo intente a mano, el servidor responde 403");
  ok((await db(p)).facturacion.documentos && Object.values((await db(p)).facturacion.documentos)[0].estado === "emitida", "la factura sigue emitida");
  await ctx.close();
}
{
  const ctx = await contexto("u-admin"); const p = await abrir(ctx, { aCaja: true });
  await p.getByText("Mesa 1", { exact: true }).first().waitFor({ timeout: 8000 });
  await p.getByRole("button", { name: /Emitir factura/ }).click();
  await esperarEtiqueta(p, "Emitida");
  await p.getByRole("button", { name: /Anular factura/ }).click();
  const confirmar = p.getByRole("button", { name: "Anular con Nota Crédito" });
  ok(await confirmar.isDisabled(), "sin motivo, el botón de anular está deshabilitado");
  await p.getByLabel("Motivo de la anulación").fill("Error en los datos del cliente");
  await confirmar.click();
  ok(await esperarEtiqueta(p, "Anulada"), "el administrador anula y el estado pasa a «Anulada»");
  const d = await db(p);
  const doc = Object.values(d.facturacion.documentos)[0];
  ok(doc.estado === "anulada" && doc.anulacion && doc.anulacion.motivo === "Error en los datos del cliente" && !!doc.anulacion.numeroNota, "queda la Nota Crédito y el motivo");
  ok(doc.anulacion.monto > 0 && Array.isArray(doc.anulacion.pagos) && doc.anulacion.pagos.some((x) => x.metodo === "efectivo"), "la Nota Crédito guarda monto y métodos de pago para revertir la caja");
  ok(Object.values(d.auditoria || {}).some((a) => a.accion === "anular_factura" && a.motivo === "Error en los datos del cliente"), "la anulación queda en la bitácora con el motivo");
  await ctx.close();
}

await nav.close(); await srv.cerrar();
console.log(`\n${total - fallas}/${total} pruebas correctas${fallas ? ` · ${fallas} fallaron` : ""}.`);
process.exit(fallas ? 1 : 0);

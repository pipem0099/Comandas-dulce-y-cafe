import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Minus, Send, ChefHat, ClipboardList, Check, Flame, Settings2, Trash2, Clock,
  Receipt, Pencil, Ban, AlertTriangle, Lock, Wallet, Users, Banknote, CreditCard, Smartphone,
  KeyRound, UserCircle2, PauseCircle, ArrowRightLeft, Download,
  Gift, Volume2, MessageSquarePlus, PlayCircle, StopCircle, Eye, EyeOff, Sun, Moon, MonitorSmartphone, ShoppingBag, Bike, Boxes, SlidersHorizontal, Phone, MapPin,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import { MARCA_POR_DEFECTO, aplicarMarca, guardarTema, temaGuardado, vibrar } from "./theme.js";
import {
  claveLinea, precioUnitario, modsTexto, itemNombre, tieneOpciones, getEstaciones, estacionDe, estacionDeLinea,
  consumoDeItems, difConsumo, negar, estadoStock, faltaStock, costoReceta, TIPO_META, esExterna, etiquetaExterna,
} from "./logica.js";
import { ModalOpciones, ProductoConfig, AjustesPanel, InventarioView, NuevoPedidoExterno, EmptyState } from "./extras.jsx";
import { subscribeShared, saveShared, subscribeCollection, subscribeCollectionSince, getCollectionAll, getCollectionRange, getRecord, saveRecord, saveRecords, saveCollectionArray, deleteRecord, updateRecord, ajustarStock, observarSesion, vincularDispositivo, desvincularDispositivo } from "./firebase.js";

// El día a día (Mesero, Cocina, Caja, Turno, Reportes de hoy/7/30 días) solo
// mantiene en vivo esta cantidad de días recientes — así la app nunca se
// vuelve más lenta con los años, sin importar cuánto historial se acumule.
// Historial y Exportar/Respaldar sí piden todo, pero solo cuando se usan.
const VENTANA_DIAS = 35;
const VENTANA_MS = VENTANA_DIAS * 24 * 60 * 60 * 1000;

const DEFAULT_MESAS = [
  { id: "1", nombre: "Mesa 1" },
  { id: "2", nombre: "Mesa 2" },
  { id: "3", nombre: "Mesa 3" },
  { id: "4", nombre: "Mesa 4" },
];

const DEFAULT_MENU = [
  { id: "m1", name: "Limonada Natural", price: 7000, cat: "Limonadas y Jugos" },
  { id: "m2", name: "Limonada de Coco", price: 9000, cat: "Limonadas y Jugos" },
  { id: "m3", name: "Limonada de Cereza", price: 9000, cat: "Limonadas y Jugos" },
  { id: "m4", name: "Jugos en Agua", price: 9000, cat: "Limonadas y Jugos" },
  { id: "m5", name: "Jugos en Leche", price: 10000, cat: "Limonadas y Jugos" },
  { id: "m6", name: "Tinto", price: 1500, cat: "Bebidas Calientes" },
  { id: "m7", name: "Americano", price: 3000, cat: "Bebidas Calientes" },
  { id: "m8", name: "Espresso Sencillo", price: 4000, cat: "Bebidas Calientes" },
  { id: "m9", name: "Espresso Doble", price: 6000, cat: "Bebidas Calientes" },
  { id: "m10", name: "Café con Leche", price: 4000, cat: "Bebidas Calientes" },
  { id: "m11", name: "Capuchino", price: 6000, cat: "Bebidas Calientes" },
  { id: "m12", name: "Capuchino Brownie", price: 7000, cat: "Bebidas Calientes" },
  { id: "m13", name: "Capuchino Caramelo", price: 7000, cat: "Bebidas Calientes" },
  { id: "m14", name: "Mocaccino", price: 7000, cat: "Bebidas Calientes" },
  { id: "m15", name: "Latte Machiato", price: 7000, cat: "Bebidas Calientes" },
  { id: "m16", name: "Colada de Café", price: 7000, cat: "Bebidas Calientes" },
  { id: "m17", name: "Colada Tradicional", price: 6000, cat: "Bebidas Calientes" },
  { id: "m18", name: "Affogato ⭐", price: 9000, cat: "Bebidas Calientes" },
  { id: "m19", name: "Migote (con licor)", price: 14000, cat: "Bebidas Calientes" },
  { id: "m20", name: "Milo", price: 5000, cat: "Bebidas Calientes" },
  { id: "m21", name: "Milo con Masmelo", price: 6000, cat: "Bebidas Calientes" },
  { id: "m22", name: "Chocolate con Masmelo", price: 6000, cat: "Bebidas Calientes" },
  { id: "m23", name: "Aromática frutas deshidratadas", price: 6000, cat: "Bebidas Calientes" },
  { id: "m24", name: "Aromática bolsa", price: 3000, cat: "Bebidas Calientes" },
  { id: "m25", name: "Carajillo (aguardiente, ron o brandy)", price: 8000, cat: "Bebidas Calientes" },
  { id: "m26", name: "Capuchino con Licor (whisky, amaretto o ron)", price: 10000, cat: "Bebidas Calientes" },
  { id: "m27", name: "Malteada pequeña", price: 10000, cat: "Bebidas Frías" },
  { id: "m28", name: "Malteada grande", price: 16000, cat: "Bebidas Frías" },
  { id: "m29", name: "Granizado (café, milo, mango biche, maracuyá)", price: 12000, cat: "Bebidas Frías" },
  { id: "m30", name: "Nevado fantasía de café", price: 13000, cat: "Bebidas Frías" },
  { id: "m31", name: "Nevado de arequipe (whisky o piña colada)", price: 14000, cat: "Bebidas Frías" },
  { id: "m32", name: "Milo frío", price: 9000, cat: "Bebidas Frías" },
  { id: "m33", name: "Capuchino frío", price: 11000, cat: "Bebidas Frías" },
  { id: "m34", name: "Soda michelada saborizada", price: 13000, cat: "Bebidas Frías" },
  { id: "m35", name: "Tamarindo michelado", price: 7000, cat: "Bebidas Frías" },
  { id: "m36", name: "Tamarindo envenenado", price: 12000, cat: "Bebidas Frías" },
  { id: "m37", name: "Gaseosa Tamarindo", price: 5000, cat: "Bebidas Frías" },
  { id: "m38", name: "Coca-Cola", price: 5000, cat: "Bebidas Frías" },
  { id: "m39", name: "Jugos Hit", price: 4000, cat: "Bebidas Frías" },
  { id: "m40", name: "Agua", price: 2000, cat: "Bebidas Frías" },
  { id: "m41", name: "Pony Malta", price: 4000, cat: "Bebidas Frías" },
  { id: "m42", name: "Gatorade", price: 5000, cat: "Bebidas Frías" },
  { id: "m43", name: "Bretaña", price: 4000, cat: "Bebidas Frías" },
  { id: "m44", name: "Águila Light", price: 5000, cat: "Cervezas" },
  { id: "m45", name: "Corona", price: 7000, cat: "Cervezas" },
  { id: "m46", name: "Coronita", price: 5000, cat: "Cervezas" },
  { id: "m47", name: "Poker", price: 5000, cat: "Cervezas" },
  { id: "m48", name: "Pilsen", price: 5000, cat: "Cervezas" },
  { id: "m49", name: "Club Colombia roja/dorada (consultar precio)", price: 0, cat: "Cervezas" },
  { id: "m50", name: "Cerveza Saborizada", price: 14000, cat: "Cervezas" },
  { id: "m51", name: "Cerveza Mango Biche", price: 15000, cat: "Cervezas" },
  { id: "m52", name: "Michelada Pilsen · Águila · Poker", price: 6000, cat: "Micheladas" },
  { id: "m53", name: "Michelada Corona · Club Colombia", price: 8000, cat: "Micheladas" },
  { id: "m54", name: "Michelada Bretaña", price: 6000, cat: "Micheladas" },
  { id: "m55", name: "Copa de Helado", price: 11000, cat: "Helados y Postres" },
  { id: "m56", name: "Cono de Helado", price: 4000, cat: "Helados y Postres" },
  { id: "m57", name: "Brownie con Helado", price: 10000, cat: "Helados y Postres" },
  { id: "m58", name: "Fresas con Crema", price: 16000, cat: "Helados y Postres" },
  { id: "m59", name: "Ensalada de Frutas", price: 15000, cat: "Helados y Postres" },
  { id: "m60", name: "Copa de Queso", price: 14000, cat: "Helados y Postres" },
  { id: "m61", name: "Payaso Plim Plim", price: 11000, cat: "Menú Infantil" },
  { id: "m62", name: "Pulpo", price: 11000, cat: "Menú Infantil" },
  { id: "m63", name: "Osito Vetta", price: 12000, cat: "Menú Infantil" },
  { id: "m64", name: "Granizado para Niños", price: 10000, cat: "Menú Infantil" },
];

const STATE_META = {
  pendiente: { label: "En cocina", color: "var(--c-c1442d-t)" },
  preparando: { label: "Preparando", color: "var(--c-b98a2e-t)" },
  listo: { label: "Listo para servir", color: "var(--c-2f6690-t)" },
  servido: { label: "Servido", color: "var(--c-5b7553-t)" },
  cancelado: { label: "Cancelado", color: "var(--c-9a9382-t)" },
};

const METODO_META = {
  efectivo: { label: "Efectivo", icon: Banknote, color: "var(--c-5b7553-t)" },
  tarjeta: { label: "Tarjeta", icon: CreditCard, color: "var(--c-2f6690-t)" },
  transferencia: { label: "Transferencia", icon: Smartphone, color: "var(--c-8a611a-t)" },
};

const PROPINA_OPCIONES = [0, 10, 15, 20];

const ROL_LABELS = { admin: "Admin", cajero: "Cajero", mesero: "Mesero" };
function rolLabel(rol) {
  return ROL_LABELS[rol] || rol;
}
// Un usuario puede tener uno o varios roles a la vez (ej. Mesero + Cajero).
// Esto sigue leyendo el formato viejo (un solo "rol") para no perder nada de
// lo que ya está guardado — pero todo lo nuevo se guarda como "roles": [...].
function rolesDe(usuario) {
  if (!usuario) return [];
  if (Array.isArray(usuario.roles) && usuario.roles.length > 0) return usuario.roles;
  if (usuario.rol) return [usuario.rol];
  return [];
}
function tieneRol(usuario, rol) {
  return rolesDe(usuario).includes(rol);
}
function rolesLabel(usuario) {
  const roles = rolesDe(usuario);
  return roles.length > 0 ? roles.map(rolLabel).join(" + ") : "Sin rol";
}

/* ---------------- mesas (nombres personalizables) ---------------- */

function mesaMatch(a, b) {
  return String(a) === String(b);
}
// Pedidos para llevar / domicilio: no tienen mesa, su "nombre" sale de la cuenta.
// App lo llena en cada render con las cuentas conocidas.
const NOMBRES_EXTERNOS = {};
function mesaNombre(mesas, mesaId) {
  if (NOMBRES_EXTERNOS[mesaId]) return NOMBRES_EXTERNOS[mesaId];
  const m = (mesas || []).find((x) => mesaMatch(x.id, mesaId));
  return m ? m.nombre : `Mesa ${mesaId}`;
}
function mesaOrderIndex(mesas, mesaId) {
  const idx = (mesas || []).findIndex((x) => mesaMatch(x.id, mesaId));
  return idx === -1 ? 9999 : idx;
}

// Estado visual de una mesa para la cuadrícula y el plano: distingue entre
// "hay algo pendiente en cocina" (rojo), "ya está listo pero nadie lo ha
// llevado a la mesa" (azul), "cuenta abierta, todo servido" (verde) y libre.
function estadoVisualMesa(cuenta, ordersDeLaCuenta) {
  if (!cuenta) return { tag: "Libre", bg: "var(--c-ede7d8-b)", color: "var(--c-8a8272-t)" };
  const enCocina = ordersDeLaCuenta.some((o) => o.estado === "pendiente" || o.estado === "preparando");
  if (enCocina) return { tag: "En cocina", bg: "#C1442D", color: "#F7F4EC" };
  const listoSinServir = ordersDeLaCuenta.some((o) => o.estado !== "cancelado" && porServir(o) > 0);
  if (listoSinServir) return { tag: "Listo para servir", bg: "#2F6690", color: "#F7F4EC" };
  return { tag: "Cuenta abierta", bg: "#5B7553", color: "#F7F4EC" };
}

/* ---------------- helpers ---------------- */

// Progreso por producto: cada línea de un pedido guarda cuántas unidades ya
// salieron de cocina (`listos`) y cuántas ya se llevaron a la mesa
// (`servidos`). Los pedidos viejos no tienen esos campos, así que se deducen
// del estado general del pedido.
function itemListos(o, it) {
  if (typeof it.listos === "number") return Math.min(it.listos, it.qty);
  return o.estado === "listo" || o.estado === "servido" ? it.qty : 0;
}
function itemServidos(o, it) {
  if (typeof it.servidos === "number") return Math.min(it.servidos, it.qty);
  return o.estado === "servido" ? it.qty : 0;
}
// Aplica nuevos items a un pedido y recalcula el estado general
// (pendiente → preparando → listo → servido) según el progreso por producto.
function conProgreso(o, items) {
  const fijos = items.map((it) => {
    const l = itemListos({ ...o, items }, it);
    const sv = Math.min(itemServidos({ ...o, items }, it), l);
    return { ...it, listos: l, servidos: sv };
  });
  const todosServidos = fijos.every((it) => it.servidos >= it.qty);
  const todosListos = fijos.every((it) => it.listos >= it.qty);
  const algunoListo = fijos.some((it) => it.listos > 0);
  const estado = todosServidos ? "servido" : todosListos ? "listo" : (algunoListo || o.estado === "preparando") ? "preparando" : "pendiente";
  return { ...o, items: fijos, estado, listoTs: todosListos ? (o.listoTs || Date.now()) : null };
}
// Unidades que ya salieron de cocina pero todavía no se han llevado a la mesa.
function porServir(o) {
  return o.items.reduce((a, it) => a + Math.max(0, itemListos(o, it) - itemServidos(o, it)), 0);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function money(n) {
  return `$${Math.round(n || 0).toLocaleString("es-CO")}`;
}
function orderTotal(order) {
  return order.items.reduce((sum, it) => sum + it.price * it.qty, 0);
}
function cuentaOrders(orders, cuentaId) {
  return orders.filter((o) => o.cuentaId === cuentaId);
}
function cuentaSubtotal(orders, cuentaId) {
  return cuentaOrders(orders, cuentaId)
    .filter((o) => o.estado !== "cancelado")
    .reduce((sum, o) => sum + orderTotal(o), 0);
}
function cuentaItemCount(orders, cuentaId) {
  return cuentaOrders(orders, cuentaId)
    .filter((o) => o.estado !== "cancelado")
    .reduce((sum, o) => sum + o.items.reduce((a, i) => a + i.qty, 0), 0);
}
// Total a cobrar de una cuenta = subtotal - descuento + propina
function cuentaGranTotal(orders, cuenta) {
  const subtotal = cuentaSubtotal(orders, cuenta.id);
  const descuento = (cuenta.descuento && cuenta.descuento.monto) || 0;
  const propina = (cuenta.propina && cuenta.propina.monto) || 0;
  const envio = Number(cuenta.costoEnvio) || 0;
  return Math.max(0, subtotal - descuento + propina + envio);
}
function itemsAgregados(orders, cuentaId) {
  const map = {};
  cuentaOrders(orders, cuentaId)
    .filter((o) => o.estado !== "cancelado")
    .forEach((o) =>
      o.items.forEach((it) => {
        const key = `${it.id}@${it.price}`;
        if (!map[key]) map[key] = { key, id: it.id, name: itemNombre(it), price: it.price, qty: 0 };
        map[key].qty += it.qty;
      })
    );
  return Object.values(map);
}
function pagosDe(cuenta) {
  return cuenta.pagos || [];
}
function pagosTotal(cuenta) {
  return pagosDe(cuenta).reduce((s, p) => s + p.monto, 0);
}
function qtyAsignadaPorProducto(cuenta) {
  const map = {};
  pagosDe(cuenta)
    .filter((p) => p.tipo === "por_producto")
    .forEach((p) => (p.items || []).forEach((it) => (map[it.key] = (map[it.key] || 0) + it.qty)));
  return map;
}

function elapsedLabel(ts) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function urgencyColor(ts) {
  const mins = (Date.now() - ts) / 60000;
  if (mins >= 10) return "var(--c-c1442d-t)";
  if (mins >= 5) return "var(--c-b98a2e-t)";
  return "var(--c-5b7553-t)";
}
function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}
function dateTimeLabel(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${date} · ${timeLabel(ts)}`;
}
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function yearKey(ts) {
  return `${new Date(ts).getFullYear()}`;
}
function dayLabel(ts) {
  const d = new Date(ts);
  const s = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function monthLabel(ts) {
  const d = new Date(ts);
  const s = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function hourLabel(h) {
  return `${String(h).padStart(2, "0")}:00`;
}

function buildHistory(cuentas, orders) {
  const pagadas = cuentas.filter((c) => c.estado === "pagada");
  const days = {};
  pagadas.forEach((c) => {
    const ordsC = cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado");
    const total = cuentaGranTotal(orders, c);
    const itemCount = ordsC.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
    const pagos = pagosDe(c);
    const dk = dayKey(c.pagadaTs);
    if (!days[dk]) {
      days[dk] = {
        key: dk, ts: c.pagadaTs, total: 0, cuentasCount: 0, productos: {}, cuentas: [],
        porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0 }, porHora: {},
      };
    }
    const day = days[dk];
    day.total += total;
    day.cuentasCount += 1;
    if (c.pagadaTs < day.ts) day.ts = c.pagadaTs;
    pagos.forEach((p) => { day.porMetodo[p.metodoPago] = (day.porMetodo[p.metodoPago] || 0) + p.monto; });
    const hora = new Date(c.pagadaTs).getHours();
    day.porHora[hora] = (day.porHora[hora] || 0) + total;
    day.cuentas.push({ id: c.id, mesa: c.mesa, ts: c.ts, pagadaTs: c.pagadaTs, total, itemCount, pagos, mesero: c.mesero, propina: c.propina, descuento: c.descuento });
    ordsC.forEach((o) =>
      o.items.forEach((it) => {
        if (!day.productos[it.name]) day.productos[it.name] = { qty: 0, subtotal: 0 };
        day.productos[it.name].qty += it.qty;
        day.productos[it.name].subtotal += it.qty * it.price;
      })
    );
  });

  const months = {};
  Object.values(days).forEach((day) => {
    const mk = monthKey(day.ts);
    if (!months[mk]) months[mk] = { key: mk, ts: day.ts, total: 0, dayKeys: [] };
    months[mk].total += day.total;
    months[mk].dayKeys.push(day.key);
    if (day.ts < months[mk].ts) months[mk].ts = day.ts;
  });
  const years = {};
  Object.values(months).forEach((m) => {
    const yk = yearKey(m.ts);
    if (!years[yk]) years[yk] = { key: yk, total: 0, monthKeys: [] };
    years[yk].total += m.total;
    years[yk].monthKeys.push(m.key);
  });
  return { days, months, years };
}

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [880, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.16 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.16);
      osc.stop(ctx.currentTime + i * 0.16 + 0.24);
    });
    setTimeout(() => ctx.close(), 900);
  } catch (e) {
    // silencioso si el navegador bloquea audio
  }
}

// Notificación del sistema (como cualquier notificación de WhatsApp) — solo
// funciona mientras el navegador siga abierto (aunque sea en segundo plano
// o en otra pestaña). Con la pantalla del celular totalmente bloqueada NO
// llega — eso necesitaría un servidor de notificaciones push aparte.
function mostrarNotificacionSistema(titulo, cuerpo) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return; // ya lo está viendo, no hace falta duplicar
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(titulo, { body: cuerpo, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
      }).catch(() => {});
    }
  } catch (e) {
    // silencioso si el navegador no soporta notificaciones
  }
}


/* La carga/guardado de datos en vivo ahora vive en ./firebase.js (Firebase Realtime Database) */

function descargarRespaldo({ menu, orders, cuentas, config, turnos, mesas }) {
  const data = { version: 2, exportadoTs: Date.now(), menu, orders, cuentas, config, turnos, mesas };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${(config.businessName || "comandas").replace(/\s+/g, "_")}_respaldo_${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportarExcel(cuentas, orders, config, mesas) {
  const pagadas = cuentas.filter((c) => c.estado === "pagada").sort((a, b) => a.pagadaTs - b.pagadaTs);
  const filasPagos = [];
  pagadas.forEach((c) => {
    pagosDe(c).forEach((p) => {
      filasPagos.push({
        Fecha: new Date(c.pagadaTs).toLocaleDateString("es-CO"),
        Hora: timeLabel(p.ts),
        Mesa: mesaNombre(mesas, c.mesa),
        Mesero: c.mesero || "",
        Etiqueta: p.etiqueta || "Cuenta completa",
        Método: METODO_META[p.metodoPago]?.label || p.metodoPago,
        Monto: p.monto,
        "Cobrado por": p.procesadoPor || "",
        Ítems: p.items ? p.items.map((it) => `${it.qty}x ${it.name}`).join(", ") : "",
      });
    });
  });

  const productoMap = {};
  pagadas.forEach((c) => {
    cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado").forEach((o) =>
      o.items.forEach((it) => {
        if (!productoMap[it.name]) productoMap[it.name] = { qty: 0, subtotal: 0 };
        productoMap[it.name].qty += it.qty;
        productoMap[it.name].subtotal += it.qty * it.price;
      })
    );
  });
  const filasProductos = Object.entries(productoMap)
    .sort((a, b) => b[1].subtotal - a[1].subtotal)
    .map(([name, d]) => ({ Producto: name, Cantidad: d.qty, Subtotal: d.subtotal }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasPagos), "Pagos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasProductos), "Productos");
  XLSX.writeFile(wb, `${(config.businessName || "comandas").replace(/\s+/g, "_")}_historial.xlsx`);
}

/* ---------------- App ---------------- */

const DEFAULT_CONFIG = { businessName: "Dulce & Café", usuarios: [], auditLog: [], marca: MARCA_POR_DEFECTO };

export default function App() {
  const [role, setRole] = useState("mesero");
  const [menu, setMenu] = useState(DEFAULT_MENU);
  const [orders, setOrders] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [turnos, setTurnos] = useState([]);
  const [mesas, setMesas] = useState(DEFAULT_MESAS);
  const [insumos, setInsumos] = useState([]);
  const [sesion, setSesion] = useState(undefined); // undefined = comprobando · null = dispositivo sin vincular
  const [loaded, setLoaded] = useState(false);
  const [, forceTick] = useState(0);
  const [usuarioActual, setUsuarioActual] = useState(null); // { nombre, rol } — aplica a toda la app, no solo a un rol
  // Si algo falla al guardar en Firebase (por ejemplo, se cortó el internet a
  // mitad de camino), esto deja de ser un error silencioso en la consola —
  // se muestra un aviso visible para que quien esté usando la app se entere
  // en el momento, en vez de descubrirlo días después con datos faltantes.
  const [errorGuardado, setErrorGuardado] = useState(null);
  const avisarErrorGuardado = useCallback((msg) => setErrorGuardado(msg), []);
  // (el login de caja usa el mismo usuarioActual de arriba — ya no hay un estado separado)
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  // Los navegadores bloquean audio automático hasta que hay una interacción real
  // del usuario. Con el primer toque en cualquier parte de la app "despertamos"
  // el audio para que la campanita de cocina sí pueda sonar más adelante.
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.01);
        setTimeout(() => ctx.close(), 200);
      } catch (e) {}
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("click", unlock);
    };
    window.addEventListener("touchstart", unlock, { once: true });
    window.addEventListener("click", unlock, { once: true });
    return () => { window.removeEventListener("touchstart", unlock); window.removeEventListener("click", unlock); };
  }, []);

  // Estado de conexión real del navegador (sirve como indicador de "en vivo").
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // Suscripción en vivo a Firebase: cualquier cambio hecho desde otro dispositivo
  // (otro mesero, cocina o caja) se refleja aquí automáticamente, sin recargar.
  // Pedidos y cuentas solo se suscriben a los últimos VENTANA_DIAS (ver arriba)
  // — eso es lo único que hace falta para operar el día a día, y por eso
  // nunca pesa más aunque pasen los años. La ventana se refresca cada hora
  // para que siga corriendo con el tiempo en sesiones muy largas. Turnos,
  // menú, mesas y config son siempre chicos y se cargan completos.
  const [ventanaEpoch, setVentanaEpoch] = useState(0);
  useEffect(() => {
    const refrescar = setInterval(() => setVentanaEpoch((e) => e + 1), 60 * 60 * 1000);
    return () => clearInterval(refrescar);
  }, []);

  useEffect(() => { const unsub = observarSesion(setSesion); return () => unsub && unsub(); }, []);

  useEffect(() => {
    if (!sesion) return;
    const pending = new Set(["menu", "orders", "cuentas", "config", "turnos", "mesas", "inventario"]);
    const markLoaded = (key) => { pending.delete(key); if (pending.size === 0) setLoaded(true); };
    const desde = Date.now() - VENTANA_MS;

    const unsubs = [
      subscribeShared("menu", DEFAULT_MENU, (v) => { setMenu(v); markLoaded("menu"); }),
      subscribeCollectionSince("orders", "ts", desde, (v) => { setOrders(v); markLoaded("orders"); }),
      subscribeCollectionSince("cuentas", "ts", desde, (v) => { setCuentas(v); markLoaded("cuentas"); }),
      subscribeShared("config", DEFAULT_CONFIG, (v) => { setConfig({ ...DEFAULT_CONFIG, ...v }); markLoaded("config"); }),
      subscribeCollection("turnos", (v) => { setTurnos(v); markLoaded("turnos"); }),
      subscribeCollection("inventario", (v) => { setInsumos(v); markLoaded("inventario"); }),
      subscribeShared("mesas", DEFAULT_MESAS, (v) => { setMesas(v && v.length > 0 ? v : DEFAULT_MESAS); markLoaded("mesas"); }),
    ];
    const clock = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => { unsubs.forEach((unsub) => unsub && unsub()); clearInterval(clock); };
  }, [ventanaEpoch, sesion]);

  // Historial completo bajo demanda: null hasta que alguien entra a Historial
  // o pide exportar/respaldar. Se pide UNA VEZ (no en vivo) y se combina con
  // lo que ya está cargado en vivo (que siempre tiene lo más reciente).
  const [historialCompleto, setHistorialCompleto] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const cargarHistorialCompleto = useCallback(async () => {
    if (historialCompleto || cargandoHistorial) return;
    setCargandoHistorial(true);
    const [todosOrders, todasCuentas] = await Promise.all([getCollectionAll("orders"), getCollectionAll("cuentas")]);
    setHistorialCompleto({ orders: todosOrders, cuentas: todasCuentas });
    setCargandoHistorial(false);
  }, [historialCompleto, cargandoHistorial]);
  // Combina el historial completo (si ya se pidió) con la ventana en vivo,
  // dejando que la ventana en vivo "gane" por ser más reciente.
  const mergeConVentana = (base, ventana) => {
    const byId = Object.fromEntries(base.map((r) => [r.id, r]));
    ventana.forEach((r) => { byId[r.id] = r; });
    return Object.values(byId);
  };
  const ordersParaHistorial = historialCompleto ? mergeConVentana(historialCompleto.orders, orders) : orders;
  const cuentasParaHistorial = historialCompleto ? mergeConVentana(historialCompleto.cuentas, cuentas) : cuentas;

  // Respaldo automático diario: cada vez que un administrador abre la app,
  // revisa si ya existe una copia del día de AYER (el de hoy todavía no ha
  // terminado). Si falta, la crea sola — solo trae los pedidos y cuentas de
  // ESE día puntual (no todo el historial), así el respaldo automático nunca
  // se vuelve más pesado sin importar cuántos años lleve funcionando esto.
  useEffect(() => {
    if (!usuarioActual || !tieneRol(usuarioActual, "admin") || !loaded) return;
    let cancelado = false;
    (async () => {
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dk = dayKey(ayer.getTime());
      const yaExiste = await getRecord(`respaldos/${dk}/hecho`);
      if (cancelado || yaExiste) return;
      const inicioDia = new Date(ayer); inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date(ayer); finDia.setHours(23, 59, 59, 999);
      const [cuentasDia, ordersDia] = await Promise.all([
        getCollectionRange("cuentas", "ts", inicioDia.getTime(), finDia.getTime()),
        getCollectionRange("orders", "ts", inicioDia.getTime(), finDia.getTime()),
      ]);
      if (cancelado) return;
      await saveShared(`respaldos/${dk}`, {
        hecho: true, generadoTs: Date.now(), dia: dk,
        cuentas: cuentasDia, orders: ordersDia, menu, mesas, config,
      });
    })();
    return () => { cancelado = true; };
  }, [usuarioActual, loaded]);

  const MSG_SIN_CONEXION = "No se pudo guardar — revisa tu conexión a internet e inténtalo de nuevo.";
  const persistMenu = useCallback(async (next) => { setMenu(next); const ok = await saveShared("menu", next); if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION); }, [avisarErrorGuardado]);
  const persistConfig = useCallback(async (next) => { setConfig(next); const ok = await saveShared("config", next); if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION); }, [avisarErrorGuardado]);
  const persistMesas = useCallback(async (next) => { setMesas(next); const ok = await saveShared("mesas", next); if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION); }, [avisarErrorGuardado]);

  // Guardan UN registro a la vez (pedido / cuenta / turno), no la lista completa.
  const saveOrder = useCallback(async (order) => {
    setOrders((prev) => { const i = prev.findIndex((o) => o.id === order.id); if (i === -1) return [...prev, order]; const next = [...prev]; next[i] = order; return next; });
    const ok = await saveRecord("orders", order.id, order);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const saveOrdersMap = useCallback(async (recordsById) => {
    setOrders((prev) => { const byId = Object.fromEntries(prev.map((o) => [o.id, o])); Object.entries(recordsById).forEach(([id, val]) => { byId[id] = val; }); return Object.values(byId); });
    const ok = await saveRecords("orders", recordsById);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const saveCuenta = useCallback(async (cuenta) => {
    setCuentas((prev) => { const i = prev.findIndex((c) => c.id === cuenta.id); if (i === -1) return [...prev, cuenta]; const next = [...prev]; next[i] = cuenta; return next; });
    const ok = await saveRecord("cuentas", cuenta.id, cuenta);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const saveTurno = useCallback(async (turno) => {
    setTurnos((prev) => { const i = prev.findIndex((t) => t.id === turno.id); if (i === -1) return [...prev, turno]; const next = [...prev]; next[i] = turno; return next; });
    const ok = await saveRecord("turnos", turno.id, turno);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);

  const saveInsumo = useCallback(async (ins) => {
    setInsumos((prev) => [...prev.filter((i) => i.id !== ins.id), ins]);
    const ok = await saveRecord("inventario", ins.id, ins);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const updateInsumo = useCallback(async (id, parcial) => {
    setInsumos((prev) => prev.map((i) => (i.id === id ? { ...i, ...parcial } : i)));
    const ok = await updateRecord("inventario", id, parcial);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const deleteInsumo = useCallback(async (id) => {
    setInsumos((prev) => prev.filter((i) => i.id !== id));
    const ok = await deleteRecord("inventario", id);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  // Suma o resta stock: { insumoId: +cantidad | -cantidad }. Usa increment en Firebase,
  // así dos pedidos simultáneos descuentan bien sin pisarse.
  const ajustarInventario = useCallback(async (mapa) => {
    const entradas = Object.entries(mapa || {}).filter(([, d]) => d);
    if (entradas.length === 0) return;
    setInsumos((prev) => prev.map((i) => (mapa[i.id] ? { ...i, stock: (Number(i.stock) || 0) + mapa[i.id] } : i)));
    const res = await Promise.all(entradas.map(([id, d]) => ajustarStock(id, d)));
    if (res.some((r) => !r)) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);

  const turnoAbierto = turnos.find((t) => t.estado === "abierto") || null;

  // Color, tipografía y logo del negocio (Ajustes → Marca): se aplican en todos los dispositivos.
  useEffect(() => { aplicarMarca(config.marca); }, [config.marca]);

  // nombres de los pedidos para llevar / domicilio (se usan en cocina, caja e historial)
  cuentasParaHistorial.forEach((c) => { if (esExterna(c)) NOMBRES_EXTERNOS[c.mesa] = etiquetaExterna(c); });

  if (sesion === undefined) {
    return <div style={styles.loadingScreen}><div style={styles.loadingStamp}>CARGANDO COMANDAS…</div></div>;
  }
  if (!sesion) return <VincularDispositivo />;

  if (!loaded) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingStamp}>CARGANDO COMANDAS…</div>
      </div>
    );
  }

  // Al iniciar sesión, cada quien cae directo en su sección — un mesero no
  // tiene por qué terminar viendo la pantalla de Caja, ni al revés. Un admin
  // (o alguien con los dos roles) se queda donde ya estaba, porque tiene
  // acceso a ambas.
  const onLogin = (usuario) => {
    setUsuarioActual(usuario);
    const esMesero = tieneRol(usuario, "mesero");
    const esCajero = tieneRol(usuario, "cajero") || tieneRol(usuario, "admin");
    if (esMesero && !esCajero) setRole("mesero");
    else if (esCajero && !esMesero) setRole("caja");
  };

  return (
    <div style={styles.app}>
      <TopBar role={role} setRole={setRole} config={config} usuarioActual={usuarioActual} onCambiarUsuario={() => setUsuarioActual(null)} online={online} />
      {errorGuardado && (
        <div style={styles.errorGuardadoBanner}>
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>{errorGuardado}</span>
          <button style={styles.errorGuardadoCerrar} onClick={() => setErrorGuardado(null)}>✕</button>
        </div>
      )}
      {role === "mesero" && (
        !usuarioActual ? (
          <UsuarioLogin config={config} persistConfig={persistConfig} onEntrar={onLogin} />
        ) : !tieneRol(usuarioActual, "mesero") && !tieneRol(usuarioActual, "admin") ? (
          <AccesoDenegado mensaje="Tu usuario no tiene el rol de Mesero — esto es Mesero." accion="Ir a Caja" onAccion={() => setRole("caja")} onCambiarUsuario={() => setUsuarioActual(null)} />
        ) : (
          <MeseroView
            menu={menu} orders={orders} cuentas={cuentas} usuarioActual={usuarioActual} config={config}
            mesas={mesas} persistMesas={persistMesas}
            saveOrder={saveOrder} saveOrdersMap={saveOrdersMap} saveCuenta={saveCuenta}
            persistMenu={persistMenu} persistConfig={persistConfig}
            insumos={insumos} ajustarInventario={ajustarInventario}
          />
        )
      )}
      {role === "cocina" && <CocinaView orders={orders} saveOrder={saveOrder} mesas={mesas} config={config} />}
      {role === "caja" && (
        !usuarioActual ? (
          <UsuarioLogin config={config} persistConfig={persistConfig} onEntrar={onLogin} />
        ) : !tieneRol(usuarioActual, "cajero") && !tieneRol(usuarioActual, "admin") ? (
          <AccesoDenegado mensaje="Tu usuario no tiene el rol de Cajero — esto es Caja." accion="Ir a Mesero" onAccion={() => setRole("mesero")} onCambiarUsuario={() => setUsuarioActual(null)} />
        ) : (
          <CajaView
            menu={menu} orders={orders} cuentas={cuentas} saveCuenta={saveCuenta} saveOrdersMap={saveOrdersMap}
            turnos={turnos} turnoAbierto={turnoAbierto} saveTurno={saveTurno}
            config={config} persistConfig={persistConfig} usuarioActual={usuarioActual}
            mesas={mesas} persistMesas={persistMesas}
            insumos={insumos} saveInsumo={saveInsumo} updateInsumo={updateInsumo} deleteInsumo={deleteInsumo} ajustarInventario={ajustarInventario}
            ordersParaHistorial={ordersParaHistorial} cuentasParaHistorial={cuentasParaHistorial}
            historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto}
          />
        )
      )}
    </div>
  );
}

function VincularDispositivo() {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const entrar = async () => {
    if (!clave || enviando) return;
    setEnviando(true); setError("");
    const r = await vincularDispositivo(clave);
    setEnviando(false);
    if (r.ok) return; // onAuthStateChanged hace el resto
    setClave("");
    setError(
      r.code === "auth/too-many-requests" ? "Demasiados intentos — espera unos minutos."
      : r.code === "auth/network-request-failed" ? "Sin conexión — revisa tu internet."
      : r.code === "auth/operation-not-allowed" ? "Falta activar el acceso con correo y contraseña en Firebase."
      : "Clave incorrecta."
    );
  };
  return (
    <div style={{ ...styles.app, alignItems: "center", justifyContent: "center" }}>
      <div style={styles.loginWrap}>
        <div style={styles.pageEyebrow}>NUEVO DISPOSITIVO</div>
        <div style={styles.pageTitle}>Vincula este equipo</div>
        <div style={styles.cajaEmptyText}>Escribe la clave del negocio. Solo se pide una vez en cada celular, tablet o computador; después queda vinculado.</div>
        <input
          style={styles.editInput} type="password" placeholder="Clave del negocio" autoFocus
          value={clave} onChange={(e) => { setClave(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
        />
        {error && <div style={styles.pinError}>{error}</div>}
        <button style={{ ...styles.addItemBtn, marginTop: 6, opacity: !clave || enviando ? 0.5 : 1 }} disabled={!clave || enviando} onClick={entrar}>
          <KeyRound size={15} /> {enviando ? "Verificando…" : "Vincular"}
        </button>
      </div>
    </div>
  );
}

function AccesoDenegado({ mensaje, accion, onAccion, onCambiarUsuario }) {
  return (
    <div style={styles.screen}>
      <div style={styles.loginWrap}>
        <div style={styles.pageEyebrow}>SIN ACCESO</div>
        <div style={styles.cajaEmptyText}>{mensaje}</div>
        <button style={styles.addItemBtn} onClick={onAccion}><ArrowRightLeft size={15} /> {accion}</button>
        <button style={styles.inlineAddLink} onClick={onCambiarUsuario}>No soy yo — cambiar de usuario</button>
      </div>
    </div>
  );
}

function LogoMarca({ marca, size = 22 }) {
  if (marca && marca.logo) return <img src={marca.logo} alt="" style={{ width: size, height: size, borderRadius: 6, objectFit: "contain", flexShrink: 0 }} />;
  return <span style={styles.brandMark}>◆</span>;
}

const TEMA_META = {
  auto: { icon: MonitorSmartphone, label: "Automático (sigue al teléfono)", next: "claro" },
  claro: { icon: Sun, label: "Modo claro", next: "oscuro" },
  oscuro: { icon: Moon, label: "Modo oscuro", next: "auto" },
};
function BotonTema() {
  const [modo, setModo] = useState(temaGuardado());
  const meta = TEMA_META[modo];
  const Icon = meta.icon;
  return (
    <button
      style={styles.temaBtn} title={`${meta.label} — toca para cambiar`} aria-label={meta.label}
      onClick={() => { vibrar(); guardarTema(meta.next); setModo(meta.next); }}
    >
      <Icon size={15} />
    </button>
  );
}

function TopBar({ role, setRole, config, usuarioActual, onCambiarUsuario, online }) {
  return (
    <div className="no-imprimir" style={styles.topBar}>
      <div style={styles.brand}>
        <LogoMarca marca={config.marca} />
        <span style={styles.brandText}>{(config.businessName || "LA COMANDA").toUpperCase()}</span>
        <span style={{ ...styles.syncDot, background: online ? "#5B7553" : "#C1442D" }} title={online ? "En línea" : "Sin conexión"} />
        <BotonTema />
      </div>
      {usuarioActual && (
        <button style={styles.meseroChip} onClick={onCambiarUsuario}>
          <UserCircle2 size={13} /> {usuarioActual.nombre} · {rolesLabel(usuarioActual)}
        </button>
      )}
      <div style={styles.roleSwitch}>
        <button onClick={() => setRole("mesero")} style={{ ...styles.roleBtn, ...(role === "mesero" ? styles.roleBtnActive : {}) }}>
          <ClipboardList size={15} strokeWidth={2.2} /> Mesero
        </button>
        <button onClick={() => setRole("cocina")} style={{ ...styles.roleBtn, ...(role === "cocina" ? styles.roleBtnActiveDark : {}) }}>
          <ChefHat size={15} strokeWidth={2.2} /> Cocina
        </button>
        <button onClick={() => setRole("caja")} style={{ ...styles.roleBtn, ...(role === "caja" ? styles.roleBtnActive : {}) }}>
          <Receipt size={15} strokeWidth={2.2} /> Caja
        </button>
      </div>
    </div>
  );
}

/* ---------------- Login único de la app (aplica a Mesero y Caja) ---------------- */

function UsuarioLogin({ config, persistConfig, onEntrar }) {
  const usuarios = config.usuarios || [];
  const hayUsuarios = usuarios.length > 0;

  const [seleccionado, setSeleccionado] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(0);
  const [, forceTickLogin] = useState(0);

  // Cuenta regresiva visible mientras está bloqueado.
  useEffect(() => {
    if (!bloqueadoHasta) return;
    const t = setInterval(() => forceTickLogin((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [bloqueadoHasta]);

  // solo se usan cuando NO hay usuarios todavía (creación del administrador)
  const [nombreAdmin, setNombreAdmin] = useState("");
  const [pinAdmin, setPinAdmin] = useState("");
  const [pinAdmin2, setPinAdmin2] = useState("");

  if (!hayUsuarios) {
    const crear = async () => {
      if (!nombreAdmin.trim()) { setError("Escribe tu nombre."); return; }
      if (pinAdmin.length < 4) { setError("El PIN debe tener al menos 4 dígitos."); return; }
      if (pinAdmin !== pinAdmin2) { setError("Los PIN no coinciden."); return; }
      const admin = { id: uid(), nombre: nombreAdmin.trim(), pin: pinAdmin, roles: ["admin"] };
      const registro = { ts: Date.now(), accion: "Cuenta administradora creada", actor: nombreAdmin.trim() };
      await persistConfig({ ...config, usuarios: [admin], auditLog: [registro] });
      onEntrar({ nombre: admin.nombre, roles: ["admin"] });
    };

    return (
      <div style={styles.screen}>
        <div style={styles.loginWrap}>
          <div style={styles.pageEyebrow}>CONFIGURAR LA APP</div>
          <div style={styles.pageTitle}>Crea el administrador</div>
          <div style={styles.cajaEmptyText}>Esta primera cuenta queda como Administrador — tiene acceso a Mesero y a Caja con un solo login, puede crear todos los demás usuarios (cajeros y meseros), ver sus PIN, aplicar descuentos y todo lo demás.</div>
          <input style={styles.editInput} placeholder="Tu nombre" value={nombreAdmin} onChange={(e) => setNombreAdmin(e.target.value)} />
          <input style={{ ...styles.editInput, marginTop: 8 }} type="password" inputMode="numeric" placeholder="Nuevo PIN" value={pinAdmin} onChange={(e) => setPinAdmin(e.target.value.replace(/\D/g, ""))} />
          <input style={{ ...styles.editInput, marginTop: 8 }} type="password" inputMode="numeric" placeholder="Repite el PIN" value={pinAdmin2} onChange={(e) => setPinAdmin2(e.target.value.replace(/\D/g, ""))} />
          {error && <div style={styles.pinError}>{error}</div>}
          <button style={{ ...styles.addItemBtn, marginTop: 10 }} onClick={crear}><KeyRound size={15} /> Crear y entrar</button>
        </div>
      </div>
    );
  }

  // hay usuarios: elegir quién eres, luego pedir su PIN
  if (!seleccionado) {
    return (
      <div style={styles.screen}>
        <div style={styles.loginWrap}>
          <div style={styles.loginBrand}><LogoMarca marca={config.marca} size={56} /><span style={styles.loginBrandName}>{config.businessName}</span></div>
          <div style={styles.pageEyebrow}>IDENTIFÍCATE</div>
          <div style={styles.pageTitle}>¿Quién eres?</div>
          <div style={styles.loginList}>
            {usuarios.map((u) => (
              <button key={u.id} style={styles.loginBtn} onClick={() => { setSeleccionado(u); setError(""); }}>
                <UserCircle2 size={18} /> {u.nombre}
                <span style={styles.rolBadge}>{rolesLabel(u)}</span>
              </button>
            ))}
          </div>
          <button style={{ ...styles.inlineAddLink, marginTop: 16 }} onClick={async () => { await desvincularDispositivo(); window.location.reload(); }}>Desvincular este dispositivo</button>
        </div>
      </div>
    );
  }

  const segundosRestantes = Math.max(0, Math.ceil((bloqueadoHasta - Date.now()) / 1000));
  const bloqueado = segundosRestantes > 0;

  const intentar = () => {
    if (bloqueado) return;
    if (pin === seleccionado.pin) {
      setIntentosFallidos(0);
      onEntrar({ nombre: seleccionado.nombre, roles: rolesDe(seleccionado) });
    } else {
      const siguiente = intentosFallidos + 1;
      setIntentosFallidos(siguiente);
      setPin("");
      if (siguiente >= 5) {
        setBloqueadoHasta(Date.now() + 30000);
        setError("Demasiados intentos — espera 30 segundos.");
        setIntentosFallidos(0);
      } else {
        setError(`PIN incorrecto (intento ${siguiente} de 5).`);
      }
    }
  };

  return (
    <div style={styles.screen}>
      <div style={styles.loginWrap}>
        <button style={styles.backBtn} onClick={() => { setSeleccionado(null); setPin(""); setError(""); setIntentosFallidos(0); setBloqueadoHasta(0); }}>← Elegir otro usuario</button>
        <div style={{ ...styles.pageEyebrow, marginTop: 10 }}>HOLA, {seleccionado.nombre.toUpperCase()}</div>
        <div style={styles.pageTitle}>Tu PIN</div>
        <input
          style={styles.editInput} type="password" inputMode="numeric" placeholder="PIN" disabled={bloqueado}
          value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && intentar()}
        />
        {error && <div style={styles.pinError}>{error}</div>}
        <button style={{ ...styles.addItemBtn, marginTop: 10, opacity: bloqueado ? 0.5 : 1 }} disabled={bloqueado} onClick={intentar}>
          <KeyRound size={15} /> {bloqueado ? `Espera ${segundosRestantes}s` : "Entrar"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- MESERO ---------------- */

function MeseroView({ menu, orders, cuentas, usuarioActual, config, mesas, persistMesas, saveOrder, saveOrdersMap, saveCuenta, persistMenu, persistConfig, insumos, ajustarInventario }) {
  // Editar el menú, precios y mesas queda reservado al administrador — un
  // mesero normal no debería poder cambiar precios ni borrar productos.
  const meseroActual = usuarioActual.nombre;
  const esAdminMesero = tieneRol(usuarioActual, "admin");

  // Aviso sonoro para el mesero: cuando cocina marca "listo" un pedido de
  // alguna de SUS mesas todavía abiertas, suena y aparece un mensaje — así
  // no tiene que estar entrando a cada mesa a chequear si ya puede servir.
  const idsListosVistosRef = useRef(null);
  const [avisoListo, setAvisoListo] = useState(null);
  useEffect(() => {
    const misCuentaIds = new Set(cuentas.filter((c) => c.mesero === meseroActual && c.estado === "abierta").map((c) => c.id));
    const listosAhora = [];
    orders.forEach((o) => {
      if (o.estado === "cancelado" || !misCuentaIds.has(o.cuentaId)) return;
      o.items.forEach((it, idx) => {
        const n = itemListos(o, it) - itemServidos(o, it);
        // una "marca" por cada unidad lista sin servir, para detectar cuando sale una nueva
        for (let k = 1; k <= n; k++) listosAhora.push({ ...o, id: `${o.id}#${idx}#${itemServidos(o, it) + k}` });
      });
    });
    const idsActuales = new Set(listosAhora.map((o) => o.id));
    if (idsListosVistosRef.current === null) {
      idsListosVistosRef.current = idsActuales; // primera carga: no suena por lo que ya estaba listo antes
      return;
    }
    const nuevos = listosAhora.filter((o) => !idsListosVistosRef.current.has(o.id));
    idsListosVistosRef.current = idsActuales;
    if (nuevos.length > 0) {
      playBeep();
      const nombreMesa = mesaNombre(mesas, nuevos[0].mesa);
      const mensaje = nuevos.length === 1 ? `${nombreMesa}: pedido listo para servir` : `${nuevos.length} pedidos listos para servir`;
      setAvisoListo(mensaje);
      mostrarNotificacionSistema("Comandas", mensaje);
      setTimeout(() => setAvisoListo(null), 4500);
    }
  }, [orders, cuentas, meseroActual, mesas]);

  const [selectedMesa, setSelectedMesa] = useState(null);
  const [draft, setDraft] = useState({}); // { itemId: { qty, nota } }
  const [verPedidos, setVerPedidos] = useState(false); // lista de pedidos de la mesa: compacta por defecto
  const [note, setNote] = useState("");
  const [showMenuEditor, setShowMenuEditor] = useState(false);
  const [showMesasEditor, setShowMesasEditor] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [justSent, setJustSent] = useState(false);
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState("");
  const [notingItemId, setNotingItemId] = useState(null);
  const [mesaAction, setMesaAction] = useState(null); // 'trasladar' | 'unir'
  const [vistaMesas, setVistaMesas] = useState("grid"); // 'grid' | 'plano'
  const [modalItem, setModalItem] = useState(null);       // producto con opciones que se está personalizando
  const [showAjustes, setShowAjustes] = useState(false);
  const [nuevoExterno, setNuevoExterno] = useState(null); // 'llevar' | 'domicilio'

  const cuentaAbiertaDe = (mesaId) => cuentas.find((c) => mesaMatch(c.mesa, mesaId) && c.estado === "abierta");

  const totalItems = Object.values(draft).reduce((a, b) => a + b.qty, 0);

  const resetDraft = () => { setDraft({}); setNote(""); setEditingOrderId(null); setNotingItemId(null); };
  const enterMesa = (n) => { resetDraft(); setActiveCat(null); setSearch(""); setConfirmCancelId(null); setMesaAction(null); setSelectedMesa(n); };
  const exitMesa = () => { resetDraft(); setActiveCat(null); setSearch(""); setMesaAction(null); setSelectedMesa(null); };

  const agregarConOpciones = (item, mods, qty, nota) => {
    const key = claveLinea(item.id, mods);
    setDraft((prev) => {
      const cur = prev[key];
      return { ...prev, [key]: { baseId: item.id, mods, qty: (cur ? cur.qty : 0) + qty, nota: nota || (cur ? cur.nota : "") } };
    });
    setModalItem(null);
  };
  const addQty = (id, d) => {
    if (d > 0) vibrar(8);
    setDraft((prev) => {
      const cur = prev[id] || { qty: 0, nota: "" };
      const nextQty = Math.max(0, cur.qty + d);
      const next = { ...prev };
      if (nextQty === 0) delete next[id];
      else next[id] = { ...cur, qty: nextQty };
      return next;
    });
  };
  const setItemNota = (id, text) => {
    setDraft((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], nota: text } } : prev));
  };

  const startEdit = (order) => {
    const d = {};
    order.items.forEach((it) => (d[it.id] = { qty: it.qty, nota: it.nota || "", baseId: it.baseId, mods: it.mods || [] }));
    setDraft(d);
    setNote(order.nota || "");
    setEditingOrderId(order.id);
  };

  const repetirUltimoPedido = (cuenta) => {
    const propios = cuentaOrders(orders, cuenta.id).sort((a, b) => b.ts - a.ts);
    if (propios.length === 0) return;
    const d = {};
    propios[0].items.forEach((it) => (d[it.id] = { qty: it.qty, nota: it.nota || "", baseId: it.baseId, mods: it.mods || [] }));
    setDraft(d); setNote(""); setEditingOrderId(null);
  };

  const cancelarPedido = async (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      // lo que ese pedido había descontado del inventario vuelve a su lugar
      if (order.consumo && Object.keys(order.consumo).length > 0) await ajustarInventario(order.consumo);
      await saveOrder({ ...order, estado: "cancelado", consumo: {} });
    }
    setConfirmCancelId(null);
    if (editingOrderId === orderId) resetDraft();
  };

  // Sirve UNA unidad de un producto (solo si cocina ya la marcó lista).
  const servirItem = async (orderId, idx) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const it = order.items[idx];
    if (!it || itemServidos(order, it) >= itemListos(order, it)) return;
    vibrar(15);
    const items = order.items.map((x, i) => (i === idx ? { ...x, listos: itemListos(order, x), servidos: itemServidos(order, x) + 1 } : x));
    await saveOrder(conProgreso(order, items));
  };
  // Sirve de una vez todo lo que ya está listo en ese pedido.
  const servirTodoListo = async (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const items = order.items.map((x) => ({ ...x, listos: itemListos(order, x), servidos: itemListos(order, x) }));
    await saveOrder(conProgreso(order, items));
  };

  const enviandoRef = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const enviarPedido = async (mesaNum) => {
    if (totalItems === 0) return;
    if (enviandoRef.current) return; // ya se está enviando — ignora el segundo toque para no duplicar el pedido
    enviandoRef.current = true;
    setEnviando(true);
    try {
      // Si alguien borró un producto del menú desde otro dispositivo justo mientras
      // este mesero lo tenía en el carrito, lo ignoramos en vez de romper el envío.
      const items = Object.entries(draft)
        .map(([key, e]) => {
          const baseId = e.baseId || key;
          const m = menu.find((x) => x.id === baseId);
          if (!m) return null;
          const mods = e.mods || [];
          // Se guarda el costo y el precio de ESTE momento junto al pedido (el precio ya incluye
          // lo que suman las opciones) — así una venta vieja no cambia si luego editas el menú.
          return { id: key, baseId, name: m.name, price: precioUnitario(m, mods), cost: m.cost || 0, qty: e.qty, nota: (e.nota || "").trim(), mods, estacion: estacionDe(m, config) };
        })
        .filter(Boolean);
      if (items.length === 0) { resetDraft(); return; }

      if (editingOrderId) {
        const original = orders.find((o) => o.id === editingOrderId);
        if (original) {
          const conservados = items.map((it) => {
            const prev = original.items.find((x) => x.id === it.id);
            if (!prev) return it;
            const l = Math.min(itemListos(original, prev), it.qty);
            return { ...it, listos: l, servidos: Math.min(itemServidos(original, prev), l) };
          });
          const consumoNuevo = consumoDeItems(conservados, menu);
          const dif = difConsumo(consumoNuevo, original.consumo || {});
          if (Object.keys(dif).length > 0) await ajustarInventario(negar(dif));
          await saveOrder(conProgreso({ ...original, nota: note.trim(), editado: true, consumo: consumoNuevo }, conservados));
        }
      } else {
        let cuenta = cuentaAbiertaDe(mesaNum);
        // un pedido para llevar / domicilio ya cobrado no se puede seguir llenando
        if (!cuenta && String(mesaNum).startsWith("ext-")) { exitMesa(); return; }
        if (!cuenta) {
          cuenta = { id: uid(), mesa: mesaNum, ts: Date.now(), estado: "abierta", mesero: meseroActual };
          await saveCuenta(cuenta);
        }
        const consumo = consumoDeItems(items, menu);
        const order = { id: uid(), mesa: mesaNum, cuentaId: cuenta.id, items, nota: note.trim(), estado: "pendiente", ts: Date.now(), tipo: cuenta.tipo || "mesa", consumo };
        if (Object.keys(consumo).length > 0) await ajustarInventario(negar(consumo));
        await saveOrder(order);
        vibrar(30);
        setJustSent(true);
        setTimeout(() => setJustSent(false), 2200);
      }
      resetDraft();
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const crearExterno = async ({ tipo, cliente, costoEnvio }) => {
    const mesaId = `ext-${uid()}`;
    const hoy = dayKey(Date.now());
    const n = cuentas.filter((c) => c.tipo === tipo && dayKey(c.ts) === hoy).length + 1;
    const cuenta = { id: uid(), mesa: mesaId, tipo, cliente: { ...cliente, nombre: cliente.nombre || `#${n}` }, costoEnvio, ts: Date.now(), estado: "abierta", mesero: meseroActual };
    NOMBRES_EXTERNOS[mesaId] = etiquetaExterna(cuenta);
    await saveCuenta(cuenta);
    setNuevoExterno(null);
    enterMesa(mesaId);
  };

  const mesasLibres = (excluir) => mesas.filter((m) => !mesaMatch(m.id, excluir) && !cuentaAbiertaDe(m.id));
  const mesasOcupadas = (excluir) => mesas.filter((m) => !mesaMatch(m.id, excluir) && cuentaAbiertaDe(m.id));

  const trasladarA = async (cuenta, nuevaMesa) => {
    const afectadas = cuentaOrders(orders, cuenta.id);
    const patch = {};
    afectadas.forEach((o) => { patch[o.id] = { ...o, mesa: nuevaMesa }; });
    if (Object.keys(patch).length > 0) await saveOrdersMap(patch);
    await saveCuenta({ ...cuenta, mesa: nuevaMesa });
    setMesaAction(null);
    setSelectedMesa(nuevaMesa);
  };

  const unirCon = async (cuentaOrigen, cuentaDestino) => {
    const afectadas = cuentaOrders(orders, cuentaOrigen.id);
    const patch = {};
    afectadas.forEach((o) => { patch[o.id] = { ...o, cuentaId: cuentaDestino.id, mesa: cuentaDestino.mesa }; });
    if (Object.keys(patch).length > 0) await saveOrdersMap(patch);
    await saveCuenta({ ...cuentaOrigen, estado: "fusionada", fusionadaEnId: cuentaDestino.id });
    setMesaAction(null);
    setSelectedMesa(cuentaDestino.mesa);
  };

  if (showMenuEditor && esAdminMesero) {
    return <MenuEditor menu={menu} persistMenu={persistMenu} config={config} persistConfig={persistConfig} actor={meseroActual} insumos={insumos} onClose={() => setShowMenuEditor(false)} />;
  }

  if (showAjustes && esAdminMesero) {
    return <div style={styles.screen}><AjustesPanel config={config} persistConfig={persistConfig} menu={menu} onClose={() => setShowAjustes(false)} /></div>;
  }

  if (showMesasEditor && esAdminMesero) {
    return <MesasEditor mesas={mesas} persistMesas={persistMesas} cuentas={cuentas} orders={orders} config={config} persistConfig={persistConfig} actor={meseroActual} onClose={() => setShowMesasEditor(false)} />;
  }

  if (selectedMesa) {
    const categories = [...new Set(menu.map((m) => m.cat))];
    const cuenta = cuentaAbiertaDe(selectedMesa);
    const pending = cuenta ? cuentaOrders(orders, cuenta.id).filter((o) => o.estado !== "cancelado") : [];

    return (
      <div style={styles.screen}>
        {avisoListo && <div style={styles.avisoListoBanner}><Volume2 size={14} /> {avisoListo}</div>}
        {modalItem && <ModalOpciones item={modalItem} onClose={() => setModalItem(null)} onAdd={(mods, qty, nota) => agregarConOpciones(modalItem, mods, qty, nota)} />}
        <div className="ancho" style={styles.subHeader}>
          <button style={styles.backBtn} onClick={exitMesa}>← Mesas</button>
          <div style={styles.mesaTitleWrap}>
            <span style={styles.mesaEyebrow}>{TIPO_META[(cuenta && cuenta.tipo) || "mesa"].corto}</span>
            <span style={styles.mesaTitle}>{cuenta && esExterna(cuenta) && cuenta.cliente && cuenta.cliente.nombre ? cuenta.cliente.nombre : mesaNombre(mesas, selectedMesa)}</span>
            {cuenta && <span style={styles.cuentaOpenSub}>Cuenta abierta · {timeLabel(cuenta.ts)}</span>}
          </div>
          {cuenta && !esExterna(cuenta) ? (
            <button style={styles.mesaActionBtn} onClick={() => setMesaAction(mesaAction ? null : "menu")} title="Trasladar o unir esta mesa">
              <ArrowRightLeft size={15} />
            </button>
          ) : (
            <div style={{ width: 34 }} />
          )}
        </div>

        {cuenta && esExterna(cuenta) && (
          <div className="ancho" style={styles.extInfo}>
            {cuenta.cliente && cuenta.cliente.telefono && <span style={styles.extInfoItem}><Phone size={12} /> {cuenta.cliente.telefono}</span>}
            {cuenta.cliente && cuenta.cliente.direccion && <span style={styles.extInfoItem}><MapPin size={12} /> {cuenta.cliente.direccion}{cuenta.cliente.referencia ? ` · ${cuenta.cliente.referencia}` : ""}</span>}
            {cuenta.costoEnvio > 0 && <span style={styles.extInfoItem}><Bike size={12} /> Domicilio {money(cuenta.costoEnvio)}</span>}
            {!(cuenta.cliente && (cuenta.cliente.telefono || cuenta.cliente.direccion)) && !(cuenta.costoEnvio > 0) && <span style={styles.extInfoItem}>Se cobra en Caja al entregar</span>}
          </div>
        )}

        {mesaAction === "menu" && (
          <div style={styles.mesaActionPanel}>
            <button style={styles.modoChoiceBtn} onClick={() => setMesaAction("trasladar")}>
              <ArrowRightLeft size={15} /> Trasladar esta mesa a otra
            </button>
            <button style={styles.modoChoiceBtn} onClick={() => setMesaAction("unir")}>
              <Users size={15} /> Unir con otra mesa
            </button>
          </div>
        )}
        {mesaAction === "trasladar" && (
          <div style={styles.mesaActionPanel}>
            <div style={styles.closeConfirmText}>Elige la mesa libre destino:</div>
            <div style={styles.mesaPickerRow}>
              {mesasLibres(selectedMesa).length === 0 && <span style={styles.cajaEmptyText}>No hay mesas libres.</span>}
              {mesasLibres(selectedMesa).map((m) => (
                <button key={m.id} style={styles.mesaPickerBtn} onClick={() => trasladarA(cuenta, m.id)}>{m.nombre}</button>
              ))}
            </div>
            <button style={styles.cancelEditBtn} onClick={() => setMesaAction("menu")}>Volver</button>
          </div>
        )}
        {mesaAction === "unir" && (
          <div style={styles.mesaActionPanel}>
            <div style={styles.closeConfirmText}>Se unirá esta cuenta a la mesa que elijas (quedará todo en una sola cuenta):</div>
            <div style={styles.mesaPickerRow}>
              {mesasOcupadas(selectedMesa).length === 0 && <span style={styles.cajaEmptyText}>No hay otras mesas ocupadas.</span>}
              {mesasOcupadas(selectedMesa).map((m) => (
                <button key={m.id} style={styles.mesaPickerBtn} onClick={() => unirCon(cuenta, cuentaAbiertaDe(m.id))}>{m.nombre}</button>
              ))}
            </div>
            <button style={styles.cancelEditBtn} onClick={() => setMesaAction("menu")}>Volver</button>
          </div>
        )}

        {pending.length > 0 && (() => {
          const activos = pending.filter((o) => o.estado !== "servido");
          const enCocinaU = activos.reduce((a, o) => a + o.items.reduce((x, it) => x + (it.qty - itemListos(o, it)), 0), 0);
          const listosU = activos.reduce((a, o) => a + porServir(o), 0);
          const totalCuenta = cuentaSubtotal(orders, cuenta.id);
          return (
            <div className="ancho" style={styles.pedidosWrap}>
              <button style={styles.pedidosResumen} onClick={() => setVerPedidos((v) => !v)}>
                <span style={styles.pedidosResumenTxt}>
                  {enCocinaU > 0 && <span style={{ color: "var(--c-c1442d-t)", fontWeight: 700 }}>● {enCocinaU} en cocina</span>}
                  {listosU > 0 && <span style={{ color: "var(--c-2f6690-t)", fontWeight: 700 }}>● {listosU} para servir</span>}
                  {enCocinaU === 0 && listosU === 0 && <span style={{ color: "var(--c-5b7553-t)", fontWeight: 700 }}>✓ Todo servido</span>}
                </span>
                <span style={styles.pedidosResumenTotal}>{money(totalCuenta)} {verPedidos ? "▴" : "▾"}</span>
              </button>
              {verPedidos && (
                <div style={styles.pedidosLista}>
                  {pending.map((o) => {
                    const puedeModificar = o.estado === "pendiente" || o.estado === "preparando";
                    if (o.estado === "servido") {
                      return (
                        <div key={o.id} style={styles.pedidoServidoRow}>
                          <span style={{ color: "var(--c-5b7553-t)" }}>✓</span> {o.items.reduce((a, i) => a + i.qty, 0)} ítems servidos · {money(orderTotal(o))}
                          <span style={styles.miniTicketTime}>{timeLabel(o.ts)}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={o.id} className="anim-in" style={styles.pedidoCard}>
                        <div style={styles.pedidoCardHead}>
                          <span style={styles.pedidoCardInfo}>
                            <span style={{ ...styles.stateDot, background: STATE_META[o.estado].color }} />
                            {timeLabel(o.ts)} · {money(orderTotal(o))}
                            {o.editado && <span style={styles.editedTag}>editado</span>}
                          </span>
                          {puedeModificar && (
                            <div style={styles.miniTicketActions}>
                              {confirmCancelId === o.id ? (
                                <>
                                  <span style={styles.confirmText}>¿Cancelar?</span>
                                  <button style={styles.confirmYes} onClick={() => cancelarPedido(o.id)}>Sí</button>
                                  <button style={styles.confirmNo} onClick={() => setConfirmCancelId(null)}>No</button>
                                </>
                              ) : (
                                <>
                                  <button style={styles.iconBtn} onClick={() => startEdit(o)} title="Modificar"><Pencil size={13} /></button>
                                  <button style={{ ...styles.iconBtn, color: "var(--c-c1442d-t)" }} onClick={() => setConfirmCancelId(o.id)} title="Cancelar"><Ban size={13} /></button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        {o.items.map((it, idx) => {
                          const l = itemListos(o, it), sv = itemServidos(o, it);
                          const disponibles = l - sv;
                          return (
                            <div key={idx} style={styles.itemEstadoRow}>
                              <span style={styles.itemEstadoName}>
                                {it.qty}× {itemNombre(it)}
                                <span style={{ ...styles.itemEstadoTag, color: sv >= it.qty ? "var(--c-5b7553-t)" : disponibles > 0 ? "var(--c-2f6690-t)" : "var(--c-8a8272-t)" }}>
                                  {sv >= it.qty ? "servido" : disponibles > 0 ? `${disponibles} listo${disponibles > 1 ? "s" : ""} para servir` : "en cocina"}
                                  {it.qty > 1 && ` · ${sv}/${it.qty} servidos`}
                                </span>
                              </span>
                              {disponibles > 0 && (
                                <button style={styles.marcarServidoBtn} onClick={() => servirItem(o.id, idx)}><Check size={12} /> Servir{it.qty > 1 ? " 1" : ""}</button>
                              )}
                            </div>
                          );
                        })}
                        {porServir(o) > 1 && (
                          <button style={{ ...styles.marcarServidoBtn, alignSelf: "flex-start" }} onClick={() => servirTodoListo(o.id)}><Check size={12} /> Servir todo lo listo ({porServir(o)})</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {editingOrderId && (
          <div style={styles.editingBanner}><AlertTriangle size={14} /> Modificando pedido ya enviado — los cambios se reflejan en cocina.</div>
        )}
        {justSent && (
          <div style={styles.sentBanner}><Check size={14} /> Pedido enviado a cocina</div>
        )}
        {!editingOrderId && totalItems === 0 && cuenta && cuentaOrders(orders, cuenta.id).length > 0 && (
          <button style={styles.repeatBtn} onClick={() => repetirUltimoPedido(cuenta)}>↻ Repetir último pedido de esta cuenta</button>
        )}

        <div style={styles.catPillsWrap}>
          <input style={styles.searchInput} placeholder="🔍 Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {!search.trim() && (
            <div style={styles.catPills}>
              {categories.map((cat) => {
                const qtyInCat = menu.filter((m) => m.cat === cat).reduce((s, m) => s + (draft[m.id]?.qty || 0), 0);
                const isActive = (activeCat || categories[0]) === cat;
                return (
                  <button key={cat} style={{ ...styles.catPill, ...(isActive ? styles.catPillActive : {}) }} onClick={() => setActiveCat(cat)}>
                    {cat}
                    {qtyInCat > 0 && <span style={styles.catPillBadge}>{qtyInCat}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="ancho" style={styles.menuScroll}>
          {(search.trim()
            ? menu.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))
            : menu.filter((m) => m.cat === (activeCat || categories[0]))
          ).map((item) => {
            const conOpc = tieneOpciones(item);
            const d = draft[item.id];
            const lineas = conOpc ? Object.entries(draft).filter(([k, v]) => (v.baseId || k) === item.id) : [];
            const qtyTot = conOpc ? lineas.reduce((a, [, v]) => a + v.qty, 0) : (d?.qty || 0);
            const agotadoManual = !!item.agotado;
            const sinStock = !agotadoManual && faltaStock(item, insumos);
            const agotado = agotadoManual || (sinStock && !!config.inventarioBloquear);
            return (
              <div key={item.id} style={{ ...styles.menuRow, opacity: agotado ? 0.5 : 1 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={styles.menuItemName}>{item.name} {agotadoManual && <span style={styles.agotadoTag}>AGOTADO</span>}{sinStock && <span style={styles.agotadoTag}>SIN STOCK</span>}</div>
                  {search.trim() && <div style={styles.menuItemCat}>{item.cat}</div>}
                  <div style={styles.menuItemPrice}>{conOpc ? "desde " : ""}{money(item.price)}</div>
                  {!conOpc && d && d.qty > 0 && (
                    notingItemId === item.id ? (
                      <input
                        autoFocus style={styles.itemNoteInput} placeholder="Nota para este producto…"
                        value={d.nota} onChange={(e) => setItemNota(item.id, e.target.value)}
                        onBlur={() => setNotingItemId(null)}
                      />
                    ) : (
                      <button style={styles.itemNoteBtn} onClick={() => setNotingItemId(item.id)}>
                        <MessageSquarePlus size={11} /> {d.nota ? d.nota : "agregar nota"}
                      </button>
                    )
                  )}
                  {lineas.map(([k, v]) => (
                    <div key={k} style={styles.lineaOpc} className="anim-in">
                      <span style={styles.lineaOpcTxt}>{v.qty}× {v.mods && v.mods.length ? modsTexto(v.mods) : "Normal"}{v.nota ? ` · ${v.nota}` : ""}</span>
                      <button style={styles.lineaOpcBtn} onClick={() => addQty(k, -1)}><Minus size={11} /></button>
                      <button style={styles.lineaOpcBtn} onClick={() => addQty(k, 1)}><Plus size={11} /></button>
                    </div>
                  ))}
                </div>
                {conOpc ? (
                  <div style={styles.stepper}>
                    {qtyTot > 0 && <span style={styles.stepVal}>{qtyTot}</span>}
                    <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus, width: qtyTot > 0 ? 28 : 64 }} disabled={agotado} onClick={() => setModalItem(item)}>
                      {qtyTot > 0 ? <Plus size={14} /> : <span style={{ fontSize: 12, fontWeight: 700 }}>Elegir</span>}
                    </button>
                  </div>
                ) : (
                  <div style={styles.stepper}>
                    <button style={styles.stepBtn} disabled={agotado} onClick={() => addQty(item.id, -1)}><Minus size={14} /></button>
                    <span style={styles.stepVal}>{d?.qty || 0}</span>
                    <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus }} disabled={agotado} onClick={() => addQty(item.id, 1)}><Plus size={14} /></button>
                  </div>
                )}
              </div>
            );
          })}
          {search.trim() && menu.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
            <div style={styles.noResults}>Sin resultados para "{search}"</div>
          )}
        </div>

        <div className="ancho" style={styles.orderBar}>
          <input placeholder="Nota general para cocina (opcional)" value={note} onChange={(e) => setNote(e.target.value)} style={styles.noteInput} />
          <div style={{ display: "flex", gap: 8 }}>
            {editingOrderId && <button style={styles.cancelEditBtn} onClick={resetDraft}>Descartar</button>}
            <button style={{ ...styles.sendBtn, flex: 1, opacity: totalItems === 0 || enviando ? 0.4 : 1 }} disabled={totalItems === 0 || enviando} onClick={() => enviarPedido(selectedMesa)}>
              {editingOrderId ? <Check size={16} /> : <Send size={16} />}
              {enviando ? "Enviando…" : editingOrderId ? `Guardar cambios (${totalItems})` : `Enviar pedido ${totalItems > 0 ? `(${totalItems})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.screen}>
      {avisoListo && <div style={styles.avisoListoBanner}><Volume2 size={14} /> {avisoListo}</div>}
      <AvisoActivarNotificaciones />
      <div className="ancho" style={styles.mesaGridHeader}>
        <div>
          <div style={styles.pageEyebrow}>SALÓN</div>
          <div style={styles.pageTitle}>Mesas</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {esAdminMesero ? (
            <>
              <button style={styles.editMenuBtn} onClick={() => setShowMesasEditor(true)}><Settings2 size={15} /> Mesas</button>
              <button style={styles.editMenuBtn} onClick={() => setShowMenuEditor(true)}><Settings2 size={15} /> Menú</button>
              <button style={styles.editMenuBtn} onClick={() => setShowAjustes(true)}><SlidersHorizontal size={15} /> Ajustes</button>
            </>
          ) : (
            <span style={styles.lockedNote}><Lock size={11} /> Menú y mesas los administra el admin</span>
          )}
        </div>
      </div>
      <div className="ancho" style={styles.vistaMesasSwitch}>
        <button style={{ ...styles.vistaMesasBtn, ...(vistaMesas === "grid" ? styles.vistaMesasBtnActive : {}) }} onClick={() => setVistaMesas("grid")}>Cuadrícula</button>
        <button style={{ ...styles.vistaMesasBtn, ...(vistaMesas === "plano" ? styles.vistaMesasBtnActive : {}) }} onClick={() => setVistaMesas("plano")}>Plano</button>
      </div>
      <div style={styles.mesasScroll}>
      {vistaMesas === "plano" ? (
        <div style={{ padding: "0 16px 16px" }}>
          <PlanoSalon mesas={mesas} cuentas={cuentas} orders={orders} editable={false} onTapMesa={enterMesa} />
        </div>
      ) : (
        <div className="ancho" style={styles.mesaGrid}>
          {mesas.length === 0 && (
            <div style={styles.cajaEmptyText}>No hay mesas creadas todavía. Toca "Mesas" para agregar la primera.</div>
          )}
          {mesas.map((m) => {
            const cuenta = cuentaAbiertaDe(m.id);
            const visual = estadoVisualMesa(cuenta, cuenta ? cuentaOrders(orders, cuenta.id) : []);
            return (
              <button key={m.id} className="anim-in" style={styles.mesaCard} onClick={() => enterMesa(m.id)}>
                <span style={styles.mesaCardNum}>{m.nombre}</span>
                <span style={{ ...styles.mesaCardTag, background: visual.bg, color: visual.color }}>{visual.tag}</span>
                {cuenta && <span style={styles.mesaCardSince}>desde {timeLabel(cuenta.ts)}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="ancho" style={styles.externosWrap}>
        <div style={styles.catLabel}>PARA LLEVAR Y DOMICILIOS</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.externoBtn} onClick={() => setNuevoExterno("llevar")}><ShoppingBag size={16} /> Para llevar</button>
          <button style={styles.externoBtn} onClick={() => setNuevoExterno("domicilio")}><Bike size={16} /> Domicilio</button>
        </div>
        {cuentas.filter((c) => esExterna(c) && c.estado === "abierta").sort((a, b) => a.ts - b.ts).map((c) => {
          const visual = estadoVisualMesa(c, cuentaOrders(orders, c.id));
          return (
            <button key={c.id} style={styles.externoCard} className="anim-in" onClick={() => enterMesa(c.mesa)}>
              <span style={styles.externoIcon}>{c.tipo === "domicilio" ? <Bike size={18} /> : <ShoppingBag size={18} />}</span>
              <span style={styles.externoInfo}>
                <span style={styles.externoNombre}>{mesaNombre(mesas, c.mesa)}</span>
                <span style={styles.externoSub}>{c.cliente && c.cliente.direccion ? c.cliente.direccion : `desde ${timeLabel(c.ts)}`}</span>
              </span>
              <span style={{ ...styles.mesaCardTag, background: visual.bg, color: visual.color }}>{visual.tag}</span>
            </button>
          );
        })}
      </div>
      </div>
      {nuevoExterno && <NuevoPedidoExterno tipo={nuevoExterno} onCancel={() => setNuevoExterno(null)} onCrear={crearExterno} />}
    </div>
  );
}

function MenuEditor({ menu, persistMenu, config, persistConfig, actor, insumos, onClose }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [cat, setCat] = useState("");
  const [businessName, setBusinessName] = useState(config.businessName || "");
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [editCostValue, setEditCostValue] = useState("");
  const [configId, setConfigId] = useState(null); // producto cuyo panel de opciones / receta está abierto

  const registrar = (accion) => {
    const auditLog = config.auditLog || [];
    persistConfig({ ...config, auditLog: [{ ts: Date.now(), accion, actor: actor || "desconocido" }, ...auditLog].slice(0, 50) });
  };

  const addItem = () => {
    if (!name.trim() || !price) return;
    const item = { id: uid(), name: name.trim(), price: parseFloat(price) || 0, cost: parseFloat(cost) || 0, cat: cat.trim() || "Otros" };
    persistMenu([...menu, item]);
    registrar(`Agregó "${item.name}" al menú (${money(item.price)})`);
    setName(""); setPrice(""); setCost(""); setCat("");
  };
  const removeItem = (id) => {
    const item = menu.find((m) => m.id === id);
    persistMenu(menu.filter((m) => m.id !== id));
    if (item) registrar(`Eliminó "${item.name}" del menú`);
    setConfirmDeleteId(null);
  };
  const toggleAgotado = (id) => {
    const item = menu.find((m) => m.id === id);
    persistMenu(menu.map((m) => (m.id === id ? { ...m, agotado: !m.agotado } : m)));
    if (item) registrar(`Marcó "${item.name}" como ${item.agotado ? "disponible" : "agotado"}`);
  };
  const empezarEdicionItem = (item) => {
    setEditingItemId(item.id);
    setEditPriceValue(item.price ? String(item.price) : "");
    setEditCostValue(item.cost ? String(item.cost) : "");
  };
  const guardarEdicionItem = (item) => {
    const nuevoPrecio = parseFloat(editPriceValue) || 0;
    const nuevoCosto = parseFloat(editCostValue) || 0;
    persistMenu(menu.map((m) => (m.id === item.id ? { ...m, price: nuevoPrecio, cost: nuevoCosto } : m)));
    if (nuevoPrecio !== item.price) registrar(`Cambió el precio de "${item.name}" de ${money(item.price)} a ${money(nuevoPrecio)}`);
    if (nuevoCosto !== (item.cost || 0)) registrar(`Actualizó el costo de "${item.name}" a ${money(nuevoCosto)}`);
    setEditingItemId(null); setEditPriceValue(""); setEditCostValue("");
  };

  const guardarConfigItem = (item, patch) => {
    // si el producto tiene receta con costos de insumos, el costo del producto se calcula solo
    const costoCalc = costoReceta(patch.receta, insumos);
    persistMenu(menu.map((m) => (m.id === item.id ? { ...m, grupos: patch.grupos, receta: patch.receta, estacion: patch.estacion, cost: costoCalc > 0 ? costoCalc : m.cost } : m)));
    registrar(`Configuró "${item.name}" (${patch.grupos.length} grupos de opciones, ${patch.receta.length} insumos en la receta)`);
    setConfigId(null);
  };

  const guardarNombre = async () => {
    if (!businessName.trim()) return;
    await persistConfig({ ...config, businessName: businessName.trim() });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  return (
    <div style={styles.screen}>
      <div className="ancho" style={styles.subHeader}>
        <button style={styles.backBtn} onClick={onClose}>← Mesas</button>
        <div style={styles.mesaTitleWrap}><span style={styles.mesaEyebrow}>AJUSTES</span><span style={styles.mesaTitle}>Menú</span></div>
        <div style={{ width: 70 }} />
      </div>
      <div className="ancho" style={styles.menuScroll}>
        <div style={styles.addItemCard}>
          <div style={styles.catLabel}>NOMBRE DEL NEGOCIO</div>
          <input style={styles.editInput} placeholder="Nombre del negocio" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <button style={styles.addItemBtn} onClick={guardarNombre}>
            {savedFlash ? <><Check size={15} /> Guardado</> : "Guardar nombre"}
          </button>
        </div>

        <div style={styles.addItemCard}>
          <input style={styles.editInput} placeholder="Nombre del plato" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Precio de venta" value={price} onChange={setPrice} />
            <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Costo (opcional)" value={cost} onChange={setCost} />
          </div>
          <input style={{ ...styles.editInput, flex: 1 }} placeholder="Categoría" value={cat} onChange={(e) => setCat(e.target.value)} />
          <button style={styles.addItemBtn} onClick={addItem}><Plus size={15} /> Agregar al menú</button>
        </div>

        {[...new Set(menu.map((m) => m.cat))].map((c) => (
          <div key={c} style={{ marginBottom: 18 }}>
            <div style={styles.catLabel}>{c}</div>
            {menu.filter((m) => m.cat === c).map((item) => {
              const margen = item.price - (item.cost || 0);
              const margenPct = item.price > 0 ? Math.round((margen / item.price) * 100) : 0;
              return (
                <div key={item.id} style={styles.menuEditItemBlock}>
                  <div style={{ ...styles.editRow, borderBottom: "none" }}>
                    <button
                      style={{ ...styles.agotadoToggle, ...(item.agotado ? styles.agotadoToggleActive : {}) }}
                      onClick={() => toggleAgotado(item.id)}
                      title={item.agotado ? "Marcar disponible" : "Marcar agotado"}
                    >
                      <PauseCircle size={14} />
                    </button>
                    <span style={{ ...styles.menuItemName, ...(item.agotado ? { textDecoration: "line-through", color: "var(--c-9a9382-t)" } : {}) }}>{item.name}</span>
                    {editingItemId !== item.id && (
                      <button style={styles.precioEditableBtn} onClick={() => empezarEdicionItem(item)}>{money(item.price)} <Pencil size={10} /></button>
                    )}
                    {confirmDeleteId === item.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button style={styles.confirmYes} onClick={() => removeItem(item.id)}>Sí</button>
                        <button style={styles.confirmNo} onClick={() => setConfirmDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <button style={styles.deleteBtn} onClick={() => setConfirmDeleteId(item.id)}><Trash2 size={14} /></button>
                    )}
                  </div>
                  {editingItemId === item.id ? (
                    <div style={styles.costoEditRow}>
                      <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Precio de venta" value={editPriceValue} onChange={setEditPriceValue} autoFocus />
                      <CampoMonto style={{ ...styles.editInput, flex: 1 }} placeholder="Costo" value={editCostValue} onChange={setEditCostValue} />
                      <button style={styles.confirmYes} onClick={() => guardarEdicionItem(item)}>Guardar</button>
                      <button style={styles.confirmNo} onClick={() => setEditingItemId(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <button style={styles.costoPillBtn} onClick={() => empezarEdicionItem(item)}>
                      {item.cost ? (
                        <>Costo {money(item.cost)} · Margen {money(margen)} ({margenPct}%)</>
                      ) : (
                        <>+ Agregar costo de producción (para ver el margen)</>
                      )}
                    </button>
                  )}
                  <button style={styles.costoPillBtn} onClick={() => setConfigId(configId === item.id ? null : item.id)}>
                    ⚙ Configurar: opciones{getEstaciones(config).length > 1 ? ", estación" : ""} y receta
                    {(tieneOpciones(item) || (item.receta && item.receta.length > 0)) && (
                      <> · {tieneOpciones(item) ? `${item.grupos.length} grupo${item.grupos.length > 1 ? "s" : ""}` : ""}{tieneOpciones(item) && item.receta && item.receta.length > 0 ? " · " : ""}{item.receta && item.receta.length > 0 ? "con receta" : ""}</>
                    )}
                  </button>
                  {configId === item.id && (
                    <ProductoConfig item={item} config={config} insumos={insumos || []} onSave={(patch) => guardarConfigItem(item, patch)} onClose={() => setConfigId(null)} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Plano visual del salón: cada mesa se dibuja en su posición real (x%, y%)
 * en vez de una cuadrícula pareja. En modo "editable" se puede arrastrar
 * cada mesa a su lugar (con el dedo o el mouse); si no, solo se puede tocar
 * para entrar a ella — igual que las tarjetas de la cuadrícula. */
function PlanoSalon({ mesas, cuentas, orders, editable, onTapMesa, onMoverMesa }) {
  const containerRef = useRef(null);
  const [arrastrando, setArrastrando] = useState(null);
  const [posLive, setPosLive] = useState(null);

  const posDefault = (idx) => {
    const cols = 4;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return { x: 15 + col * 24, y: 20 + row * 26 };
  };
  const posDe = (m, idx) => (typeof m.x === "number" && typeof m.y === "number") ? { x: m.x, y: m.y } : posDefault(idx);

  const onPointerDown = (e, m) => {
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastrando(m.id);
  };
  const onPointerMove = (e) => {
    if (!arrastrando || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(4, Math.min(96, x));
    y = Math.max(6, Math.min(94, y));
    setPosLive({ x, y });
  };
  const onPointerUp = () => {
    if (arrastrando && posLive) onMoverMesa(arrastrando, posLive.x, posLive.y);
    setArrastrando(null);
    setPosLive(null);
  };

  return (
    <div ref={containerRef} style={styles.planoContainer} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
      {mesas.length === 0 && <div style={styles.planoVacio}>Agrega mesas para verlas aquí.</div>}
      {mesas.map((m, idx) => {
        const cuenta = cuentas.find((c) => mesaMatch(c.mesa, m.id) && c.estado === "abierta");
        const visual = estadoVisualMesa(cuenta, cuenta ? orders.filter((o) => o.cuentaId === cuenta.id) : []);
        const bg = cuenta ? visual.bg : "var(--c-fffdf8-b)";
        const color = cuenta ? visual.color : "var(--c-242019-t)";
        const pos = arrastrando === m.id && posLive ? posLive : posDe(m, idx);
        return (
          <button
            key={m.id}
            onPointerDown={(e) => onPointerDown(e, m)}
            onClick={() => { if (!editable) onTapMesa(m.id); }}
            style={{
              ...styles.planoMesaTile,
              left: `${pos.x}%`, top: `${pos.y}%`,
              background: bg, color,
              borderColor: cuenta ? bg : "var(--c-e4dfce-b)",
              cursor: editable ? "grab" : "pointer",
              touchAction: editable ? "none" : "auto",
              zIndex: arrastrando === m.id ? 2 : 1,
            }}
          >
            {m.nombre}
          </button>
        );
      })}
    </div>
  );
}

function MesasEditor({ mesas, persistMesas, cuentas, orders, config, persistConfig, actor, onClose }) {
  const [nombre, setNombre] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState("");

  const tieneCuentaAbierta = (mesaId) => cuentas.some((c) => mesaMatch(c.mesa, mesaId) && c.estado === "abierta");

  const registrar = (accion) => {
    if (!config || !persistConfig) return;
    const auditLog = config.auditLog || [];
    persistConfig({ ...config, auditLog: [{ ts: Date.now(), accion, actor: actor || "desconocido" }, ...auditLog].slice(0, 50) });
  };

  const agregarMesa = () => {
    if (!nombre.trim()) return;
    const nueva = { id: uid(), nombre: nombre.trim() };
    persistMesas([...mesas, nueva]);
    registrar(`Agregó la mesa/espacio "${nueva.nombre}"`);
    setNombre("");
  };

  const empezarEdicion = (m) => { setEditId(m.id); setEditNombre(m.nombre); setError(""); };
  const guardarEdicion = (m) => {
    if (!editNombre.trim()) return;
    persistMesas(mesas.map((x) => (x.id === m.id ? { ...x, nombre: editNombre.trim() } : x)));
    registrar(`Renombró "${m.nombre}" a "${editNombre.trim()}"`);
    setEditId(null); setEditNombre("");
  };

  const eliminarMesa = (m) => {
    if (tieneCuentaAbierta(m.id)) { setError("Esa mesa tiene una cuenta abierta — ciérrala o cóbrala antes de eliminarla."); setConfirmDeleteId(null); return; }
    persistMesas(mesas.filter((x) => x.id !== m.id));
    registrar(`Eliminó la mesa/espacio "${m.nombre}"`);
    setConfirmDeleteId(null);
  };

  const moverEnPlano = (id, x, y) => {
    persistMesas(mesas.map((m) => (m.id === id ? { ...m, x, y } : m)));
  };

  const mover = (idx, dir) => {
    const next = [...mesas];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    persistMesas(next);
  };

  return (
    <div style={styles.screen}>
      <div className="ancho" style={styles.subHeader}>
        <button style={styles.backBtn} onClick={onClose}>← Mesas</button>
        <div style={styles.mesaTitleWrap}><span style={styles.mesaEyebrow}>AJUSTES</span><span style={styles.mesaTitle}>Mesas y espacios</span></div>
        <div style={{ width: 70 }} />
      </div>
      <div className="ancho" style={styles.menuScroll}>
        <div style={styles.addItemCard}>
          <div style={styles.catLabel}>AGREGAR MESA O ESPACIO</div>
          <div style={styles.closeConfirmText}>Puedes ponerle cualquier nombre: "Mesa 5", "Barra", "Mesa gris", "Terraza"…</div>
          <input style={styles.editInput} placeholder="Nombre del espacio" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarMesa()} />
          <button style={styles.addItemBtn} onClick={agregarMesa}><Plus size={15} /> Agregar</button>
        </div>

        {error && <div style={styles.pinError}>{error}</div>}

        <div style={styles.catLabel}>UBICACIÓN EN EL PLANO</div>
        <div style={styles.closeConfirmText}>Arrastra cada mesa a su lugar real del salón — así se ve en Mesero cuando cambias a vista "Plano".</div>
        <PlanoSalon mesas={mesas} cuentas={cuentas} orders={orders} editable onMoverMesa={moverEnPlano} />

        <div style={{ ...styles.catLabel, marginTop: 18 }}>TUS MESAS Y ESPACIOS</div>
        {mesas.length === 0 && <div style={styles.cajaEmptyText}>Todavía no has agregado ninguna.</div>}
        {mesas.map((m, idx) => (
          <div key={m.id} style={styles.editRow}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button style={styles.mesaReorderBtn} onClick={() => mover(idx, -1)} disabled={idx === 0}>▲</button>
              <button style={styles.mesaReorderBtn} onClick={() => mover(idx, 1)} disabled={idx === mesas.length - 1}>▼</button>
            </div>
            {editId === m.id ? (
              <>
                <input autoFocus style={{ ...styles.editInput, flex: 1 }} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardarEdicion(m)} />
                <button style={styles.confirmYes} onClick={() => guardarEdicion(m)}>Guardar</button>
                <button style={styles.confirmNo} onClick={() => setEditId(null)}>Cancelar</button>
              </>
            ) : (
              <>
                <span style={{ ...styles.menuItemName, flex: 1 }}>{m.nombre}</span>
                {tieneCuentaAbierta(m.id) && <span style={styles.enCursoTag}>cuenta abierta</span>}
                <button style={styles.deleteBtn} onClick={() => empezarEdicion(m)}><Pencil size={14} /></button>
                {confirmDeleteId === m.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button style={styles.confirmYes} onClick={() => eliminarMesa(m)}>Sí</button>
                    <button style={styles.confirmNo} onClick={() => setConfirmDeleteId(null)}>No</button>
                  </div>
                ) : (
                  <button style={styles.deleteBtn} onClick={() => { setConfirmDeleteId(m.id); setError(""); }}><Trash2 size={14} /></button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- COCINA ---------------- */

const ESCALAS_KDS = [1, 1.25, 1.5, 1.8];
function CocinaView({ orders, saveOrder, mesas, config }) {
  // Estaciones (Cocina, Barra…): cada pantalla puede quedarse fija en la suya.
  // La estación y el tamaño de letra se guardan en ESTE dispositivo.
  const estaciones = getEstaciones(config);
  const multi = estaciones.length > 1;
  const [estSel, setEstSel] = useState(() => { try { return localStorage.getItem("comandas_estacion") || "todas"; } catch (e) { return "todas"; } });
  const est = multi && estaciones.some((e) => e.id === estSel) ? estSel : "todas";
  const elegirEstacion = (id) => { setEstSel(id); try { localStorage.setItem("comandas_estacion", id); } catch (e) {} };
  const [escala, setEscala] = useState(() => { try { const v = Number(localStorage.getItem("comandas_kds_escala")); return ESCALAS_KDS.includes(v) ? v : 1; } catch (e) { return 1; } });
  const ciclarEscala = () => {
    const next = ESCALAS_KDS[(ESCALAS_KDS.indexOf(escala) + 1) % ESCALAS_KDS.length];
    setEscala(next);
    try { localStorage.setItem("comandas_kds_escala", String(next)); } catch (e) {}
  };
  const enEstacion = (it) => est === "todas" || estacionDeLinea(it, config) === est;
  const nombreEstacion = (it) => (estaciones.find((e) => e.id === estacionDeLinea(it, config)) || estaciones[0]).nombre;

  const activos = orders.filter((o) => o.estado !== "listo" && o.estado !== "servido" && o.estado !== "cancelado");
  const active = activos.filter((o) => o.items.some((it) => enEstacion(it) && itemListos(o, it) < it.qty)).sort((a, b) => a.ts - b.ts);
  const recienListos = orders
    .filter((o) => o.estado === "listo" && o.listoTs && Date.now() - o.listoTs < 10 * 60 * 1000 && o.items.some(enEstacion))
    .sort((a, b) => b.listoTs - a.listoTs);
  const prevCountRef = useRef(active.length);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (active.length > prevCountRef.current) {
      playBeep();
      setFlash(true);
      mostrarNotificacionSistema("Comandas — Cocina", "Llegó un pedido nuevo");
      setTimeout(() => setFlash(false), 900);
    }
    prevCountRef.current = active.length;
  }, [active.length]);

  const advance = async (id) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    if (o.estado === "pendiente") { await saveOrder({ ...o, estado: "preparando" }); return; }
    // "Marcar todo listo": lo que falte por salir (de ESTA estación) se marca listo de una vez
    const items = o.items.map((it) => ({ ...it, listos: enEstacion(it) ? it.qty : itemListos(o, it), servidos: itemServidos(o, it) }));
    await saveOrder(conProgreso(o, items));
  };
  const retroceder = async (id) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const items = o.items.map((it) => ({ ...it, listos: itemServidos(o, it), servidos: itemServidos(o, it) }));
    await saveOrder({ ...conProgreso(o, items), estado: "pendiente", listoTs: null });
  };
  const deshacerListo = async (id) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    // vuelve a "preparando": lo que aún no se ha servido deja de contar como listo
    const items = o.items.map((it) => ({ ...it, listos: itemServidos(o, it), servidos: itemServidos(o, it) }));
    await saveOrder({ ...conProgreso({ ...o, estado: "preparando" }, items), estado: "preparando", listoTs: null });
  };
  // Marca UNA unidad de un producto como lista (sale de cocina hacia el mesero).
  const itemListo = async (id, idx) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const it = o.items[idx];
    if (!it || itemListos(o, it) >= it.qty) return;
    vibrar(20);
    const items = o.items.map((x, i) => (i === idx ? { ...x, listos: itemListos(o, x) + 1, servidos: itemServidos(o, x) } : x));
    await saveOrder(conProgreso(o, items));
  };
  const itemDeshacer = async (id, idx) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const it = o.items[idx];
    if (!it || itemListos(o, it) <= itemServidos(o, it)) return; // lo ya servido no se puede devolver
    const items = o.items.map((x, i) => (i === idx ? { ...x, listos: itemListos(o, x) - 1, servidos: itemServidos(o, x) } : x));
    await saveOrder({ ...conProgreso({ ...o, estado: "preparando" }, items), estado: "preparando", listoTs: null });
  };

  return (
    <div style={{ ...styles.screenDark, ...(flash ? styles.screenFlash : {}) }}>
      <AvisoActivarNotificaciones />
      <div style={styles.kdsHeader}>
        <div>
          <div style={styles.kdsEyebrow}>{(est === "todas" ? "COCINA" : (estaciones.find((e) => e.id === est) || estaciones[0]).nombre.toUpperCase())} — PANTALLA EN VIVO <Volume2 size={11} style={{ verticalAlign: -2, marginLeft: 4 }} /></div>
          <div style={styles.kdsTitle}>Comandas activas</div>
        </div>
        <div style={styles.kdsCount}>{active.length}</div>
      </div>

      <div style={styles.kdsTools}>
        {multi && (
          <div style={styles.kdsChips}>
            {["todas", ...estaciones.map((e) => e.id)].map((id) => (
              <button key={id} style={{ ...styles.kdsChip, ...(est === id ? styles.kdsChipOn : {}) }} onClick={() => elegirEstacion(id)}>
                {id === "todas" ? "Todas" : estaciones.find((e) => e.id === id).nombre}
              </button>
            ))}
          </div>
        )}
        <button style={styles.kdsZoomBtn} onClick={ciclarEscala} title="Tamaño de letra">
          <span style={{ fontSize: 11, fontWeight: 700 }}>A</span><span style={{ fontSize: 16, fontWeight: 700 }}>A</span> {Math.round(escala * 100)}%
        </button>
      </div>

      {recienListos.length > 0 && (
        <div style={styles.recienListosRow}>
          {recienListos.map((o) => (
            <button key={o.id} style={styles.recienListoChip} onClick={() => deshacerListo(o.id)}>
              ↺ {mesaNombre(mesas, o.mesa)} — deshacer "listo"
            </button>
          ))}
        </div>
      )}

      {active.length === 0 ? (
        <div style={styles.emptyKitchen} className="anim-in">
          <Flame size={30} strokeWidth={1.4} color="#5C6670" />
          <div style={styles.emptyKitchenText}>Todo al día</div>
          <div style={styles.emptyKitchenSub}>Cuando un mesero envíe un pedido aparece aquí y suena la campana.</div>
        </div>
      ) : (
        <div style={{ ...styles.railGrid, zoom: escala }}>
          {active.map((o) => (
            <div key={o.id} className="anim-in" style={{ ...styles.ticket, borderLeftColor: urgencyColor(o.ts) }}>
              <div style={styles.ticketHead}>
                <span style={styles.ticketMesa}>
                  {mesaNombre(mesas, o.mesa).toUpperCase()}
                  {o.editado && <span style={styles.editedBadge}>MODIFICADO</span>}
                </span>
                <span style={{ ...styles.ticketTime, color: urgencyColor(o.ts), fontWeight: 700 }}><Clock size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{elapsedLabel(o.ts)}</span>
              </div>
              <div style={styles.ticketExactTime}>
                {o.tipo === "llevar" && <span style={styles.ticketTipo}>PARA LLEVAR</span>}
                {o.tipo === "domicilio" && <span style={{ ...styles.ticketTipo, background: "#2F6690" }}>DOMICILIO</span>}
                Pedido a las {timeLabel(o.ts)}
              </div>
              <div style={styles.ticketDivider} />
              {o.items.map((it, idx) => ({ it, idx })).filter(({ it }) => enEstacion(it)).map(({ it, idx }) => {
                const l = itemListos(o, it);
                const completo = l >= it.qty;
                return (
                  <div key={idx} style={{ opacity: completo ? 0.5 : 1, transition: "opacity .25s" }}>
                    <div style={styles.ticketLine}>
                      <span style={styles.ticketQty}>{it.qty}×</span>
                      <span style={{ ...styles.ticketItemName, textDecoration: completo ? "line-through" : "none" }}>
                        {it.name}
                        {multi && est === "todas" && <span style={styles.ticketEstTag}>{nombreEstacion(it)}</span>}
                      </span>
                      <span style={styles.itemKdsActions}>
                        {it.qty > 1 && <span style={styles.itemKdsCount}>{l}/{it.qty}</span>}
                        {l > itemServidos(o, it) && (
                          <button style={styles.itemKdsUndo} onClick={() => itemDeshacer(o.id, idx)} title="Deshacer">−</button>
                        )}
                        {!completo && (
                          <button style={styles.itemKdsBtn} onClick={() => itemListo(o.id, idx)}><Check size={12} /> Listo</button>
                        )}
                      </span>
                    </div>
                    {it.mods && it.mods.length > 0 && <div style={styles.ticketItemMods}>{it.mods.map((m) => m.n).join(" · ")}</div>}
                    {it.nota && <div style={styles.ticketItemNote}>↳ {it.nota}</div>}
                  </div>
                );
              })}
              {o.nota && <div style={styles.ticketNote}>"{o.nota}"</div>}
              <div style={styles.ticketDivider} />
              <div style={{ display: "flex", gap: 6 }}>
                {o.estado === "preparando" && est === "todas" && (
                  <button style={styles.ticketBackBtn} onClick={() => retroceder(o.id)} title="Volver a pendiente">◀</button>
                )}
                <button style={{ ...styles.ticketBtn, flex: 1, background: o.estado === "pendiente" ? "#B98A2E" : "#5B7553" }} onClick={() => advance(o.id)}>
                  {o.estado === "pendiente" ? <><Flame size={14} /> Empezar preparación</> : <><Check size={14} /> Marcar todo listo</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- CAJA ---------------- */

function CajaView({ menu, orders, cuentas, saveCuenta, saveOrdersMap, turnos, turnoAbierto, saveTurno, config, persistConfig, usuarioActual, mesas, persistMesas, insumos, saveInsumo, updateInsumo, deleteInsumo, ajustarInventario, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto }) {
  const [tab, setTab] = useState("mesas");
  const [expandedId, setExpandedId] = useState(null);
  const esAdmin = tieneRol(usuarioActual, "admin");

  const abiertas = cuentas.filter((c) => c.estado === "abierta").sort((a, b) => mesaOrderIndex(mesas, a.mesa) - mesaOrderIndex(mesas, b.mesa));
  const hoyKey = dayKey(Date.now());
  const pagadasHoy = cuentas.filter((c) => c.estado === "pagada" && dayKey(c.pagadaTs) === hoyKey);
  const vendidoHoy = pagadasHoy.reduce((s, c) => s + cuentaGranTotal(orders, c), 0);
  const porMetodoHoy = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  pagadasHoy.forEach((c) => pagosDe(c).forEach((p) => { porMetodoHoy[p.metodoPago] = (porMetodoHoy[p.metodoPago] || 0) + p.monto; }));

  return (
    <div style={styles.screen}>
      <div className="no-imprimir ancho" style={styles.mesaGridHeader}>
        <div><div style={styles.pageEyebrow}>CAJA</div><div style={styles.pageTitle}>Control de consumo</div></div>
      </div>

      <div className="no-imprimir ancho" style={styles.cajaTabSwitch}>
        <button style={{ ...styles.cajaTabBtn, ...(tab === "turno" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("turno")}>Turno</button>
        <button style={{ ...styles.cajaTabBtn, ...(tab === "mesas" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("mesas")}>Mesas {abiertas.length > 0 ? `(${abiertas.length})` : ""}</button>
        {esAdmin && <button style={{ ...styles.cajaTabBtn, ...(tab === "historial" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("historial")}>Historial</button>}
        <button style={{ ...styles.cajaTabBtn, ...(tab === "reportes" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("reportes")}>Reportes</button>
        {esAdmin && (
          <button style={{ ...styles.cajaTabBtn, ...(tab === "inventario" ? styles.cajaTabBtnActive : {}) }} onClick={() => setTab("inventario")}>
            Inventario{insumos.filter((i) => estadoStock(i) !== "ok").length > 0 ? ` (${insumos.filter((i) => estadoStock(i) !== "ok").length}⚠)` : ""}
          </button>
        )}
      </div>

      {tab === "turno" && (
        <TurnoView turnos={turnos} turnoAbierto={turnoAbierto} saveTurno={saveTurno} orders={orders} cuentas={cuentas} config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} menu={menu} mesas={mesas} ordersParaHistorial={ordersParaHistorial} cuentasParaHistorial={cuentasParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} />
      )}

      {tab === "mesas" && (
        <div className="ancho" style={styles.menuScroll}>
          <div style={styles.cajaTotalCard}>
            <span style={styles.cajaTotalLabel}>Vendido hoy ({pagadasHoy.length} {pagadasHoy.length === 1 ? "cuenta" : "cuentas"})</span>
            <span style={styles.cajaTotalValue}>{money(vendidoHoy)}</span>
            <div style={styles.metodoBreakdownRow}>
              {Object.entries(METODO_META).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <div key={key} style={styles.metodoBreakdownItem}>
                    <Icon size={13} color="#B3A891" /><span style={styles.metodoBreakdownLabel}>{meta.label}</span><span style={styles.metodoBreakdownValue}>{money(porMetodoHoy[key] || 0)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {!turnoAbierto && (
            <button style={{ ...styles.warnBanner, width: "100%", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => setTab("turno")}>
              <AlertTriangle size={14} /> Abre el turno para poder registrar cobros — toca aquí
            </button>
          )}

          {abiertas.length === 0 ? (
            <EmptyState icon={Receipt} titulo="Sin cuentas abiertas" texto="Cuando un mesero tome un pedido, la cuenta aparece aquí lista para cobrar." />
          ) : (
            abiertas.map((c) => (
              <MesaCuentaCard
                key={c.id} cuenta={c} orders={orders} saveCuenta={saveCuenta} saveOrdersMap={saveOrdersMap}
                turnoAbierto={!!turnoAbierto} usuarioActual={usuarioActual} mesas={mesas} ajustarInventario={ajustarInventario}
                expanded={expandedId === c.id} onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              />
            ))
          )}
          {esAdmin && cuentas.some((c) => c.estado === "pagada") && (
            <div style={styles.goHistLink} onClick={() => setTab("historial")}>Ver historial completo por día, mes y año →</div>
          )}
        </div>
      )}

      {tab === "historial" && esAdmin && <HistorialView cuentasParaHistorial={cuentasParaHistorial} ordersParaHistorial={ordersParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} config={config} mesas={mesas} usuarioActual={usuarioActual} />}
      {tab === "inventario" && esAdmin && <InventarioView insumos={insumos} saveInsumo={saveInsumo} updateInsumo={updateInsumo} deleteInsumo={deleteInsumo} ajustarInventario={ajustarInventario} config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} />}
      {tab === "reportes" && <ReportesView cuentas={cuentas} orders={orders} menu={menu} usuarioActual={usuarioActual} />}
    </div>
  );
}

/* ---------------- Turno / arqueo de caja ---------------- */

function TurnoView({ turnos, turnoAbierto, saveTurno, orders, cuentas, config, persistConfig, usuarioActual, menu, mesas, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto }) {
  const [base, setBase] = useState("");
  const [contado, setContado] = useState("");
  const [contadoTarjeta, setContadoTarjeta] = useState("");
  const [contadoTransf, setContadoTransf] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  // Cierre "a ciegas": los montos esperados solo se muestran DESPUÉS de que el
  // cajero escribió lo que contó. Si cancela y vuelve a empezar, queda anotado.
  const [calculado, setCalculado] = useState(false);
  const [intentos, setIntentos] = useState(0);

  const mesasAbiertas = cuentas.filter((c) => c.estado === "abierta");
  const esAdmin = tieneRol(usuarioActual, "admin");

  const abrirTurno = async () => {
    const baseNum = parseFloat(base) || 0;
    const turno = { id: uid(), aperturaTs: Date.now(), baseEfectivo: baseNum, estado: "abierto", abiertoPor: usuarioActual.nombre };
    await saveTurno(turno);
    setBase("");
  };

  // Efectivo, tarjeta y transferencia recibidos en este turno (según lo registrado en la app).
  const totalesPorMetodo = () => {
    const totales = { efectivo: turnoAbierto ? turnoAbierto.baseEfectivo : 0, tarjeta: 0, transferencia: 0 };
    if (!turnoAbierto) return totales;
    cuentas.filter((c) => c.estado === "pagada" && c.pagadaTs >= turnoAbierto.aperturaTs).forEach((c) => {
      pagosDe(c).forEach((p) => { if (totales[p.metodoPago] !== undefined) totales[p.metodoPago] += p.monto; });
    });
    return totales;
  };

  const { efectivo: esperado, tarjeta: tarjetaEsperada, transferencia: transferenciaEsperada } = totalesPorMetodo();
  const contadoNum = parseFloat(contado) || 0;
  const diferencia = contadoNum - esperado;
  const tarjetaNum = parseFloat(contadoTarjeta) || 0;
  const transfNum = parseFloat(contadoTransf) || 0;
  const difTarjeta = tarjetaNum - tarjetaEsperada;
  const difTransf = transfNum - transferenciaEsperada;
  const todoCuadra = diferencia === 0 && difTarjeta === 0 && difTransf === 0;
  const camposCompletos = contado !== "" && contadoTarjeta !== "" && contadoTransf !== "";
  const textoDif = (d) => (d === 0 ? "Cuadra exacto ✓" : d > 0 ? `Sobran ${money(d)}` : `Faltan ${money(Math.abs(d))}`);
  const colorDif = (d) => (d === 0 ? "var(--c-e4eee1-b)" : d > 0 ? "var(--c-fbefd9-b)" : "var(--c-fbe2dc-b)");
  const reiniciarCierre = () => {
    setContado(""); setContadoTarjeta(""); setContadoTransf(""); setObservaciones("");
    setCalculado(false); setConfirmandoCierre(false);
  };

  const cerrarTurno = async () => {
    await saveTurno({
      ...turnoAbierto, estado: "cerrado", cierreTs: Date.now(),
      esperado, contado: contadoNum, diferencia,
      tarjetaEsperada, transferenciaEsperada,
      tarjetaContada: tarjetaNum, transferenciaContada: transfNum,
      difTarjeta, difTransferencia: difTransf,
      intentosCierre: intentos + 1,
      observaciones: observaciones.trim() || null,
      cerradoPor: usuarioActual.nombre,
    });
    reiniciarCierre(); setIntentos(0);
  };

  const cerrados = turnos.filter((t) => t.estado === "cerrado").sort((a, b) => b.cierreTs - a.cierreTs);

  return (
    <div className="ancho" style={styles.menuScroll}>
      {!turnoAbierto ? (
        <div style={styles.turnoBox}>
          <div style={styles.pageEyebrow}>TURNO CERRADO</div>
          <div style={styles.closeConfirmText}>Registra cuánto efectivo hay en caja para empezar el turno.</div>
          <CampoMonto placeholder="Base de efectivo inicial" value={base} onChange={setBase} />
          <button style={{ ...styles.addItemBtn, marginTop: 8 }} onClick={abrirTurno}><PlayCircle size={15} /> Abrir turno</button>
        </div>
      ) : (
        <div style={styles.turnoBox}>
          <div style={styles.pageEyebrow}>TURNO ABIERTO</div>
          <div style={styles.closeConfirmText}>Abierto {dateTimeLabel(turnoAbierto.aperturaTs)} · base {money(turnoAbierto.baseEfectivo)}</div>
          <div style={styles.closeConfirmText}>El total esperado en caja, tarjeta y transferencia se muestra al cerrar el turno, después de que registres lo que contaste.</div>

          {!confirmandoCierre ? (
            <>
              {mesasAbiertas.length > 0 && (
                <div style={styles.warnBanner}>
                  <AlertTriangle size={14} /> {mesasAbiertas.length} {mesasAbiertas.length === 1 ? "mesa tiene" : "mesas tienen"} cuenta abierta sin cobrar todavía.
                </div>
              )}
              <button style={styles.closeCajaBtn} onClick={() => setConfirmandoCierre(true)}><StopCircle size={15} /> Cerrar turno (arqueo)</button>
            </>
          ) : (
            <div style={styles.closeConfirmBox}>
              {mesasAbiertas.length > 0 && (
                <div style={styles.closeConfirmText}>
                  <b>Ojo:</b> {mesasAbiertas.length} {mesasAbiertas.length === 1 ? "mesa sigue" : "mesas siguen"} sin cobrar ({mesasAbiertas.map((c) => mesaNombre(mesas, c.mesa)).join(", ")}). Si cierras ahora, ese dinero no quedará contado en este turno.
                </div>
              )}
              <div style={styles.closeConfirmText}>Registra lo que contaste. El sistema no te muestra lo esperado hasta que calcules.</div>
              <div style={styles.closeConfirmText}><b>Efectivo físico en caja</b></div>
              <CampoMonto placeholder="Efectivo contado" value={contado} onChange={(v) => !calculado && setContado(v)} />
              <div style={styles.closeConfirmText}><b>Tarjeta</b> — total del cierre de lote del datáfono</div>
              <CampoMonto placeholder="Total tarjeta (datáfono)" value={contadoTarjeta} onChange={(v) => !calculado && setContadoTarjeta(v)} />
              <div style={styles.closeConfirmText}><b>Transferencia</b> — total recibido según tu banco</div>
              <CampoMonto placeholder="Total transferencias (banco)" value={contadoTransf} onChange={(v) => !calculado && setContadoTransf(v)} />

              {!calculado ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.cancelEditBtn} onClick={() => { if (camposCompletos || contado !== "" || contadoTarjeta !== "" || contadoTransf !== "") setIntentos((n) => n + 1); reiniciarCierre(); }}>Cancelar</button>
                  <button
                    style={{ ...styles.sendBtn, flex: 1, opacity: camposCompletos ? 1 : 0.4 }}
                    disabled={!camposCompletos}
                    onClick={() => setCalculado(true)}
                  >
                    Calcular resultado
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ ...styles.diferenciaBox, background: colorDif(diferencia), textAlign: "left" }}>
                    <b>Efectivo:</b> {textoDif(diferencia)}<br />
                    <span style={{ fontWeight: 500, fontSize: 12 }}>Esperado en caja: {money(esperado)} · contaste {money(contadoNum)}</span>
                  </div>
                  <div style={{ ...styles.diferenciaBox, background: colorDif(difTarjeta), textAlign: "left" }}>
                    <b>Tarjeta:</b> {textoDif(difTarjeta)}<br />
                    <span style={{ fontWeight: 500, fontSize: 12 }}>Esperado: {money(tarjetaEsperada)} · registraste {money(tarjetaNum)}</span>
                  </div>
                  <div style={{ ...styles.diferenciaBox, background: colorDif(difTransf), textAlign: "left" }}>
                    <b>Transferencia:</b> {textoDif(difTransf)}<br />
                    <span style={{ fontWeight: 500, fontSize: 12 }}>Esperado: {money(transferenciaEsperada)} · registraste {money(transfNum)}</span>
                  </div>
                  {!todoCuadra ? (
                    <>
                      <div style={styles.closeConfirmText}><b>Algo no cuadró — cuéntanos por qué (obligatorio):</b></div>
                      <input autoFocus style={styles.editInput} placeholder="Ej: se dio mal un vuelto, faltó registrar un pago…" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                    </>
                  ) : (
                    <input style={styles.editInput} placeholder="Observaciones (opcional)" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                  )}
                  <button
                    style={{ ...styles.sendBtn, opacity: todoCuadra || observaciones.trim() ? 1 : 0.4 }}
                    disabled={!todoCuadra && !observaciones.trim()}
                    onClick={cerrarTurno}
                  >
                    <Lock size={15} /> Confirmar cierre
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {cerrados.length > 0 && (
        <>
          <div style={{ ...styles.catLabel, marginTop: 20 }}>TURNOS ANTERIORES</div>
          {cerrados.map((t) => (
            <div key={t.id} style={styles.turnoRowCol}>
              <div style={{ ...styles.turnoRow, border: "none", padding: 0 }}>
                <span style={styles.cierreDate}>{dateTimeLabel(t.aperturaTs)} → {timeLabel(t.cierreTs)}</span>
                <span style={{ ...styles.turnoDiff, color: t.diferencia === 0 ? "var(--c-5b7553-t)" : "var(--c-c1442d-t)" }}>
                  {t.diferencia === 0 ? "Cuadró" : t.diferencia > 0 ? `+${money(t.diferencia)}` : money(t.diferencia)}
                </span>
              </div>
              {(t.tarjetaEsperada > 0 || t.transferenciaEsperada > 0) && (
                <div style={styles.turnoSubRow}>
                  Tarjeta {money(t.tarjetaEsperada || 0)}{typeof t.difTarjeta === "number" && t.difTarjeta !== 0 ? ` (${t.difTarjeta > 0 ? "+" : ""}${money(t.difTarjeta)})` : ""} · Transferencia {money(t.transferenciaEsperada || 0)}{typeof t.difTransferencia === "number" && t.difTransferencia !== 0 ? ` (${t.difTransferencia > 0 ? "+" : ""}${money(t.difTransferencia)})` : ""}
                  {t.intentosCierre > 1 ? ` · cierre iniciado ${t.intentosCierre} veces` : ""}
                </div>
              )}
              {t.observaciones && <div style={styles.turnoObsRow}>"{t.observaciones}"</div>}
            </div>
          ))}
        </>
      )}

      {esAdmin && (
        <RespaldoBox menu={menu} orders={orders} cuentas={cuentas} config={config} turnos={turnos} mesas={mesas} persistConfig={persistConfig} usuarioActual={usuarioActual} ordersParaHistorial={ordersParaHistorial} cuentasParaHistorial={cuentasParaHistorial} historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto} />
      )}

      {esAdmin && <PanelSenalesAlerta cuentas={cuentasParaHistorial} turnos={turnos} />}

      <div style={{ ...styles.catLabel, marginTop: 24 }}>USUARIOS Y SEGURIDAD</div>
      {esAdmin ? (
        <GestionUsuarios config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} />
      ) : (
        <div style={styles.lockedNote}><Lock size={11} /> Solo un administrador puede gestionar usuarios y ver el registro de seguridad.</div>
      )}
    </div>
  );
}

function RespaldoBox({ menu, orders, cuentas, config, turnos, mesas, persistConfig, usuarioActual, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto }) {
  const [restaurando, setRestaurando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const onArchivoElegido = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.menu || !data.orders || !data.cuentas || !data.config) throw new Error("Archivo incompleto");
        setArchivo(data);
        setConfirmando(true);
        setError("");
      } catch (err) {
        setError("Ese archivo no parece un respaldo válido.");
      }
    };
    reader.readAsText(file);
  };

  const confirmarRestauracion = async () => {
    if (!archivo) return;
    await saveShared("menu", archivo.menu);
    await saveCollectionArray("orders", archivo.orders);
    await saveCollectionArray("cuentas", archivo.cuentas);
    await saveCollectionArray("turnos", archivo.turnos || []);
    if (archivo.mesas && archivo.mesas.length > 0) await saveShared("mesas", archivo.mesas);
    const nuevoConfig = {
      ...archivo.config,
      auditLog: [{ ts: Date.now(), accion: "Restauró un respaldo desde archivo", actor: usuarioActual.nombre }, ...(archivo.config.auditLog || [])].slice(0, 50),
    };
    await saveShared("config", nuevoConfig);
    window.location.reload();
  };

  const descargarPendiente = useRef(false);
  // Una vez que el historial completo termina de cargar, dispara la descarga.
  useEffect(() => {
    if (descargarPendiente.current && historialCompleto) {
      descargarPendiente.current = false;
      descargarRespaldo({ menu, orders: ordersParaHistorial, cuentas: cuentasParaHistorial, config, turnos, mesas });
    }
  }, [historialCompleto]);
  const onClickDescargar = () => {
    if (historialCompleto) {
      descargarRespaldo({ menu, orders: ordersParaHistorial, cuentas: cuentasParaHistorial, config, turnos, mesas });
    } else {
      descargarPendiente.current = true;
      cargarHistorialCompleto();
    }
  };

  return (
    <div style={{ ...styles.catLabel, marginTop: 24 }}>
      RESPALDO
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        <button style={styles.modoChoiceBtn} onClick={onClickDescargar} disabled={cargandoHistorial}>
          <Download size={15} /> {cargandoHistorial ? "Preparando respaldo completo…" : "Descargar copia de seguridad completa"}
        </button>
        {!restaurando ? (
          <button style={styles.inlineAddLink} onClick={() => setRestaurando(true)}>Restaurar desde un archivo de respaldo</button>
        ) : (
          <div style={styles.turnoBox}>
            <div style={styles.closeConfirmText}><b>Cuidado:</b> restaurar reemplaza todos los datos actuales (menú, pedidos, historial) por los del archivo. No se puede deshacer.</div>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={onArchivoElegido} />
            {error && <div style={styles.pinError}>{error}</div>}
            {confirmando && archivo && (
              <div style={styles.closeConfirmBox}>
                <div style={styles.closeConfirmText}>
                  Este archivo es de "{archivo.config.businessName}", exportado el {dateTimeLabel(archivo.exportadoTs)}. ¿Restaurar y reemplazar todo lo actual?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.cancelEditBtn} onClick={() => { setConfirmando(false); setArchivo(null); }}>Cancelar</button>
                  <button style={{ ...styles.sendBtn, flex: 1 }} onClick={confirmarRestauracion}><Lock size={15} /> Sí, restaurar</button>
                </div>
              </div>
            )}
            <button style={styles.cancelEditBtn} onClick={() => { setRestaurando(false); setArchivo(null); setConfirmando(false); setError(""); }}>Cerrar</button>
          </div>
        )}
      </div>
      <RespaldosAutomaticosBox />
    </div>
  );
}

function RespaldosAutomaticosBox() {
  const [dias, setDias] = useState(null); // null = sin cargar todavía
  const [cargando, setCargando] = useState(false);

  const cargarLista = async () => {
    setCargando(true);
    const hoy = new Date();
    const candidatos = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
      candidatos.push(dayKey(d.getTime()));
    }
    const resultados = await Promise.all(candidatos.map((dk) => getRecord(`respaldos/${dk}`)));
    setDias(resultados.filter(Boolean).sort((a, b) => b.dia.localeCompare(a.dia)));
    setCargando(false);
  };

  const descargarDia = (r) => {
    const data = { version: 2, exportadoTs: Date.now(), menu: r.menu, orders: r.orders, cuentas: r.cuentas, config: r.config, turnos: [], mesas: r.mesas };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `respaldo_automatico_${r.dia}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ marginTop: 14 }}>
      {dias === null ? (
        <button style={styles.inlineAddLink} onClick={cargarLista} disabled={cargando}>
          {cargando ? "Buscando…" : "Ver copias automáticas de los últimos 14 días"}
        </button>
      ) : dias.length === 0 ? (
        <div style={styles.cajaEmptyText}>Todavía no hay copias automáticas (se generan solas cada día que un admin abre la app — la de hoy se hace mañana).</div>
      ) : (
        <>
          <div style={styles.catLabel}>COPIAS AUTOMÁTICAS RECIENTES</div>
          {dias.map((r) => (
            <div key={r.dia} style={styles.turnoRow}>
              <span style={styles.cierreDate}>{r.dia} · {r.cuentas.length} {r.cuentas.length === 1 ? "cuenta" : "cuentas"}</span>
              <button style={styles.inlineLink} onClick={() => descargarDia(r)}><Download size={11} style={{ verticalAlign: -1 }} /> descargar</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** Junta en un solo lugar las señales que ya existían regadas por la app
 * (cancelaciones, descuentos, descuadres de turno) para que el admin no
 * tenga que ir a buscarlas una por una — no es una acusación, es solo un
 * resumen para que decidas tú si algo amerita una conversación. */
function PanelSenalesAlerta({ cuentas, turnos }) {
  const [expandido, setExpandido] = useState(false);

  const porPersona = {};
  const tocar = (nombre) => {
    if (!porPersona[nombre]) porPersona[nombre] = { cancelaciones: 0, montoCancelado: 0, descuentos: 0, montoDescontado: 0, turnosConFaltante: 0, montoFaltante: 0 };
    return porPersona[nombre];
  };

  cuentas.filter((c) => c.estado === "cancelada" && (c.montoCancelado || 0) > 0 && c.canceladaPor).forEach((c) => {
    const p = tocar(c.canceladaPor);
    p.cancelaciones += 1;
    p.montoCancelado += c.montoCancelado || 0;
  });
  cuentas.filter((c) => c.descuento && c.descuento.aplicadoPor).forEach((c) => {
    const p = tocar(c.descuento.aplicadoPor);
    p.descuentos += 1;
    p.montoDescontado += c.descuento.monto || 0;
  });
  turnos.filter((t) => t.estado === "cerrado" && t.diferencia < 0 && t.cerradoPor).forEach((t) => {
    const p = tocar(t.cerradoPor);
    p.turnosConFaltante += 1;
    p.montoFaltante += Math.abs(t.diferencia);
  });

  const filas = Object.entries(porPersona)
    .map(([nombre, d]) => ({ nombre, ...d, alerta: d.cancelaciones >= 3 || d.turnosConFaltante >= 2 }))
    .sort((a, b) => (b.alerta ? 1 : 0) - (a.alerta ? 1 : 0) || (b.montoCancelado + b.montoFaltante) - (a.montoCancelado + a.montoFaltante));

  const hayAlertas = filas.some((f) => f.alerta);

  if (filas.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <button style={styles.canceladasToggle} onClick={() => setExpandido((v) => !v)}>
        <AlertTriangle size={13} color={hayAlertas ? "var(--c-c1442d-t)" : "var(--c-b98a2e-t)"} />
        <span style={{ color: hayAlertas ? "var(--c-8a3a2b-t)" : "var(--c-5c5648-t)" }}>Señales de alerta (últimos 35 días){hayAlertas ? " — hay algo que revisar" : ""}</span>
        <span>{expandido ? "▲" : "▼"}</span>
      </button>
      {expandido && (
        <div style={{ marginTop: 8 }}>
          {filas.map((f) => (
            <div key={f.nombre} style={{ ...styles.turnoRowCol, ...(f.alerta ? { background: "var(--c-fbe2dc-b)", borderRadius: 8, padding: "8px 10px" } : {}) }}>
              <div style={{ ...styles.turnoRow, border: "none", padding: 0 }}>
                <span style={styles.pagoRowEtiqueta}>{f.nombre}</span>
                {f.alerta && <AlertTriangle size={13} color="var(--c-c1442d-t)" />}
              </div>
              <div style={styles.turnoSubRow}>
                {f.cancelaciones > 0 && <>· {f.cancelaciones} {f.cancelaciones === 1 ? "cancelación" : "cancelaciones"} ({money(f.montoCancelado)}) </>}
                {f.descuentos > 0 && <>· {f.descuentos} {f.descuentos === 1 ? "descuento" : "descuentos"} ({money(f.montoDescontado)}) </>}
                {f.turnosConFaltante > 0 && <>· {f.turnosConFaltante} {f.turnosConFaltante === 1 ? "turno con faltante" : "turnos con faltante"} ({money(f.montoFaltante)})</>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GestionUsuarios({ config, persistConfig, usuarioActual }) {
  const usuarios = config.usuarios || [];
  const auditLog = config.auditLog || [];
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [rolesNuevo, setRolesNuevo] = useState(["mesero"]);
  const [error, setError] = useState("");
  const [resetId, setResetId] = useState(null);
  const [resetPin, setResetPin] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [pinesVisibles, setPinesVisibles] = useState({});

  const registrar = (accion) => ({ ts: Date.now(), accion, actor: usuarioActual.nombre });

  const toggleRolNuevo = (r) => {
    setRolesNuevo((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const agregarUsuario = async () => {
    setError("");
    if (!nombre.trim()) { setError("Escribe un nombre."); return; }
    if (usuarios.some((u) => u.nombre.toLowerCase() === nombre.trim().toLowerCase())) { setError("Ya existe un usuario con ese nombre."); return; }
    if (pin.length < 4) { setError("El PIN debe tener al menos 4 dígitos."); return; }
    if (rolesNuevo.length === 0) { setError("Elige al menos un rol."); return; }
    const nuevo = { id: uid(), nombre: nombre.trim(), pin, roles: rolesNuevo };
    await persistConfig({
      ...config,
      usuarios: [...usuarios, nuevo],
      auditLog: [registrar(`Creó el usuario "${nuevo.nombre}" (${rolesNuevo.map(rolLabel).join(" + ")})`), ...auditLog].slice(0, 50),
    });
    setNombre(""); setPin(""); setRolesNuevo(["mesero"]);
  };

  // Cada usuario puede tener varios roles a la vez (ej. Mesero + Cajero).
  // Tocar una etiqueta la prende/apaga, en vez de reemplazar todo el rol.
  const toggleRolUsuario = async (u, r) => {
    setError("");
    const rolesActuales = rolesDe(u);
    const tieneEseRol = rolesActuales.includes(r);
    if (tieneEseRol) {
      if (rolesActuales.length === 1) { setError("El usuario debe tener al menos un rol."); return; }
      if (r === "admin") {
        const admins = usuarios.filter((x) => rolesDe(x).includes("admin"));
        if (admins.length <= 1) { setError("Debe quedar al menos un administrador."); return; }
      }
    }
    const nuevosRoles = tieneEseRol ? rolesActuales.filter((x) => x !== r) : [...rolesActuales, r];
    const next = usuarios.map((x) => (x.id === u.id ? { id: x.id, nombre: x.nombre, pin: x.pin, roles: nuevosRoles } : x));
    const accion = tieneEseRol ? `Le quitó el rol ${rolLabel(r)} a "${u.nombre}"` : `Le agregó el rol ${rolLabel(r)} a "${u.nombre}"`;
    await persistConfig({ ...config, usuarios: next, auditLog: [registrar(accion), ...auditLog].slice(0, 50) });
  };

  const resetearPin = async (u) => {
    if (resetPin.length < 4) { setError("El nuevo PIN debe tener al menos 4 dígitos."); return; }
    const next = usuarios.map((x) => (x.id === u.id ? { ...x, pin: resetPin } : x));
    await persistConfig({ ...config, usuarios: next, auditLog: [registrar(`Restableció el PIN de "${u.nombre}"`), ...auditLog].slice(0, 50) });
    setResetId(null); setResetPin(""); setError("");
  };

  const eliminarUsuario = async (u) => {
    const admins = usuarios.filter((x) => rolesDe(x).includes("admin"));
    if (tieneRol(u, "admin") && admins.length <= 1) { setError("Debe quedar al menos un administrador."); return; }
    const next = usuarios.filter((x) => x.id !== u.id);
    await persistConfig({ ...config, usuarios: next, auditLog: [registrar(`Eliminó al usuario "${u.nombre}"`), ...auditLog].slice(0, 50) });
    setConfirmDeleteId(null);
  };

  const togglePinVisible = async (u) => {
    const yaVisible = !!pinesVisibles[u.id];
    setPinesVisibles((prev) => ({ ...prev, [u.id]: !yaVisible }));
    if (!yaVisible) {
      // Deja constancia de que alguien vio el PIN de este usuario
      await persistConfig({ ...config, auditLog: [registrar(`Vio el PIN de "${u.nombre}"`), ...auditLog].slice(0, 50) });
    }
  };

  return (
    <div>
      <div style={styles.catLabel}>EQUIPO</div>
      {usuarios.map((u) => (
        <div key={u.id} style={styles.usuarioRow}>
          <div style={styles.usuarioRowLeft}>
            <UserCircle2 size={16} color="var(--c-8a8272-t)" />
            <span style={styles.pagoRowEtiqueta}>{u.nombre}</span>
            <span style={styles.rolBadge}>{rolesLabel(u)}</span>
          </div>

          <div style={styles.pinVisorRow}>
            <button style={styles.pinVisorBtn} onClick={() => togglePinVisible(u)}>
              {pinesVisibles[u.id] ? <EyeOff size={12} /> : <Eye size={12} />}
              {pinesVisibles[u.id] ? <span style={styles.pinVisorValue}>{u.pin}</span> : "mostrar PIN"}
            </button>
          </div>

          <div style={styles.usuarioRowActions}>
            <div style={styles.rolPillsRowSmall}>
              <button style={{ ...styles.rolPillSmall, ...(tieneRol(u, "mesero") ? styles.rolPillActive : {}) }} onClick={() => toggleRolUsuario(u, "mesero")}>Mesero</button>
              <button style={{ ...styles.rolPillSmall, ...(tieneRol(u, "cajero") ? styles.rolPillActive : {}) }} onClick={() => toggleRolUsuario(u, "cajero")}>Cajero</button>
              <button style={{ ...styles.rolPillSmall, ...(tieneRol(u, "admin") ? styles.rolPillActive : {}) }} onClick={() => toggleRolUsuario(u, "admin")}>Admin</button>
            </div>
            <button style={styles.inlineLink} onClick={() => { setResetId(resetId === u.id ? null : u.id); setResetPin(""); setError(""); }}>PIN nuevo</button>
            {u.nombre !== usuarioActual.nombre && (
              confirmDeleteId === u.id ? (
                <>
                  <button style={styles.confirmYes} onClick={() => eliminarUsuario(u)}>Sí</button>
                  <button style={styles.confirmNo} onClick={() => setConfirmDeleteId(null)}>No</button>
                </>
              ) : (
                <button style={{ ...styles.inlineLink, color: "var(--c-c1442d-t)" }} onClick={() => setConfirmDeleteId(u.id)}>eliminar</button>
              )
            )}
          </div>
          {resetId === u.id && (
            <div style={styles.resetPinRow}>
              <input style={styles.editInput} type="password" inputMode="numeric" placeholder="Nuevo PIN para este usuario" value={resetPin} onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ""))} />
              <button style={styles.addItemBtn} onClick={() => resetearPin(u)}><KeyRound size={14} /> Guardar</button>
            </div>
          )}
        </div>
      ))}
      {usuarios.length === 0 && <div style={styles.cajaEmptyText}>Todavía no has creado ningún usuario.</div>}

      <div style={{ ...styles.catLabel, marginTop: 16 }}>AGREGAR USUARIO</div>
      <div style={styles.turnoBox}>
        <div style={styles.closeConfirmText}>Solo tú, como administrador, puedes crear usuarios — y son los únicos que podrán entrar a la app. Puedes marcar más de un rol para la misma persona (ej. Mesero + Cajero).</div>
        <input style={styles.editInput} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input style={styles.editInput} type="password" inputMode="numeric" placeholder="PIN (mínimo 4 dígitos)" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <div style={styles.rolPillsRow}>
          <button style={{ ...styles.rolPill, ...(rolesNuevo.includes("mesero") ? styles.rolPillActive : {}) }} onClick={() => toggleRolNuevo("mesero")}>Mesero</button>
          <button style={{ ...styles.rolPill, ...(rolesNuevo.includes("cajero") ? styles.rolPillActive : {}) }} onClick={() => toggleRolNuevo("cajero")}>Cajero</button>
          <button style={{ ...styles.rolPill, ...(rolesNuevo.includes("admin") ? styles.rolPillActive : {}) }} onClick={() => toggleRolNuevo("admin")}>Admin</button>
        </div>
        {error && <div style={styles.pinError}>{error}</div>}
        <button style={styles.addItemBtn} onClick={agregarUsuario}><Plus size={15} /> Agregar usuario</button>
      </div>

      {auditLog.length > 0 && (
        <>
          <div style={{ ...styles.catLabel, marginTop: 16 }}>REGISTRO DE SEGURIDAD</div>
          {auditLog.map((r, i) => (
            <div key={i} style={styles.turnoRow}>
              <span style={styles.cierreDate}>{dateTimeLabel(r.ts)}</span>
              <span style={styles.auditText}>{r.actor}: {r.accion}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** Campo para escribir montos en pesos. A diferencia de un <input type="number">,
 * SÍ entiende el punto como separador de miles (como se escribe en Colombia:
 * "50.000") — solo guarda los dígitos por dentro y siempre muestra el número
 * formateado, así que nunca se puede escribir un monto ambiguo o mal leído. */
function CampoMonto({ value, onChange, placeholder, style, autoFocus }) {
  const digitos = (value || "").toString().replace(/\D/g, "");
  const mostrado = digitos ? Number(digitos).toLocaleString("es-CO") : "";
  return (
    <input
      autoFocus={autoFocus}
      style={style || styles.editInput}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={mostrado}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
    />
  );
}

/** Banner discreto para activar notificaciones del sistema — se puede
 * descartar, y no vuelve a aparecer en esta sesión si ya se descartó o si
 * el navegador no las soporta. */
function AvisoActivarNotificaciones() {
  const soportado = typeof window !== "undefined" && "Notification" in window;
  const [permiso, setPermiso] = useState(soportado ? Notification.permission : "unsupported");
  const [descartado, setDescartado] = useState(false);

  if (!soportado || permiso !== "default" || descartado) return null;

  return (
    <div style={styles.avisoNotifBanner}>
      <span>Activa las notificaciones para enterarte aunque cambies de pantalla (no llegan con el celular bloqueado).</span>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button style={styles.avisoNotifBtn} onClick={() => Notification.requestPermission().then(setPermiso)}>Activar</button>
        <button style={styles.avisoNotifCerrar} onClick={() => setDescartado(true)}>✕</button>
      </div>
    </div>
  );
}

function MetodoPills({ selected, onSelect }) {
  return (
    <div style={styles.metodoPillsRow}>
      {Object.entries(METODO_META).map(([key, meta]) => {
        const Icon = meta.icon;
        const isSel = selected === key;
        return (
          <button key={key} style={{ ...styles.metodoPill, ...(isSel ? { background: meta.color, color: "#F7F4EC", border: `1px solid ${meta.color}` } : {}) }} onClick={() => onSelect(key)}>
            <Icon size={14} /> {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function MesaCuentaCard({ cuenta, orders, saveCuenta, saveOrdersMap, turnoAbierto, usuarioActual, mesas, ajustarInventario, expanded, onToggle }) {
  const subtotal = cuentaSubtotal(orders, cuenta.id);
  const total = cuentaGranTotal(orders, cuenta);
  const items = cuentaItemCount(orders, cuenta.id);
  const ords = cuentaOrders(orders, cuenta.id).filter((o) => o.estado !== "cancelado");
  const pagos = pagosDe(cuenta);
  const cobrado = pagosTotal(cuenta);
  const restante = Math.max(0, total - cobrado);
  const enCurso = pagos.length > 0 && restante > 0;

  const [modoLocal, setModoLocal] = useState(null);
  const [metodoSel, setMetodoSel] = useState(null);
  const [efectivoRecibido, setEfectivoRecibido] = useState("");
  const [numPartes, setNumPartes] = useState(2);
  const [cart, setCart] = useState({});
  const [etiqueta, setEtiqueta] = useState("");
  const [propinaCustom, setPropinaCustom] = useState("");
  const [mostrarDescuento, setMostrarDescuento] = useState(false);
  const [descMonto, setDescMonto] = useState("");
  const [descMotivo, setDescMotivo] = useState("");
  const [confirmCancelarCuenta, setConfirmCancelarCuenta] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  useEffect(() => { if (!expanded) { setModoLocal(null); setMetodoSel(null); setEfectivoRecibido(""); setCart({}); setEtiqueta(""); setMostrarDescuento(false); } }, [expanded]);
  const seleccionarMetodo = (m) => { setMetodoSel(m); setEfectivoRecibido(""); };

  // Calculadora de vueltos: solo aplica cuando el método elegido es efectivo.
  const renderVueltos = (monto) => {
    if (metodoSel !== "efectivo") return null;
    const recibido = parseFloat(efectivoRecibido) || 0;
    const vueltos = recibido - monto;
    return (
      <div style={styles.vueltosBox}>
        <CampoMonto placeholder={`¿Con cuánto paga? (a cobrar ${money(monto)})`} value={efectivoRecibido} onChange={setEfectivoRecibido} />
        {efectivoRecibido !== "" && (
          <div style={{ ...styles.diferenciaBox, background: vueltos >= 0 ? "var(--c-e4eee1-b)" : "var(--c-fbe2dc-b)" }}>
            {vueltos >= 0 ? `Total a devolver: ${money(vueltos)}` : `Faltan ${money(Math.abs(vueltos))}`}
          </div>
        )}
      </div>
    );
  };

  const effectiveModo = cuenta.splitMode || modoLocal;

  async function patchCuenta(patch) {
    await saveCuenta({ ...cuenta, ...patch });
  }

  const cobrandoRef = useRef(false);
  const [cobrando, setCobrando] = useState(false);
  async function guardarPago(pago) {
    if (cobrandoRef.current) return; // ya se está registrando un pago — ignora el segundo toque para no cobrar doble
    cobrandoRef.current = true;
    setCobrando(true);
    try {
      const nuevosPagos = [...pagosDe(cuenta), pago];
      const totalPagado = nuevosPagos.reduce((s, p) => s + p.monto, 0);
      const completo = totalPagado >= total - 1;
      if (completo) {
        // La mesa ya se pagó por completo — si quedó algo sin marcar "listo" o
        // "servido" en Cocina/Mesero, lo cerramos ahora como servido (si ya se
        // pagó es porque ya se consumió). Si no, se queda como un pedido
        // fantasma activo para siempre, aunque ya esté cobrado.
        const sinCerrar = cuentaOrders(orders, cuenta.id).filter((o) => o.estado === "pendiente" || o.estado === "preparando" || o.estado === "listo");
        if (sinCerrar.length > 0) {
          const patch = {};
          sinCerrar.forEach((o) => { patch[o.id] = conProgreso(o, o.items.map((it) => ({ ...it, listos: it.qty, servidos: it.qty }))); });
          await saveOrdersMap(patch);
        }
      }
      await saveCuenta({ ...cuenta, pagos: nuevosPagos, splitMode: effectiveModo || cuenta.splitMode || null, estado: completo ? "pagada" : "abierta", pagadaTs: completo ? Date.now() : cuenta.pagadaTs });
      setMetodoSel(null); setEfectivoRecibido(""); setCart({}); setEtiqueta("");
    } finally {
      cobrandoRef.current = false;
      setCobrando(false);
    }
  }

  const esAdmin = tieneRol(usuarioActual, "admin");

  const setPropina = async (pct) => {
    const monto = pct === "custom" ? Math.round(parseFloat(propinaCustom) || 0) : Math.round((subtotal * pct) / 100);
    await patchCuenta({ propina: { pct: pct === "custom" ? null : pct, monto } });
  };
  const aplicarDescuento = async () => {
    if (!esAdmin) return;
    const monto = Math.round(parseFloat(descMonto) || 0);
    if (monto <= 0) return;
    await patchCuenta({ descuento: { monto, motivo: descMotivo.trim() || "Sin motivo especificado", aplicadoPor: usuarioActual.nombre } });
    setMostrarDescuento(false); setDescMonto(""); setDescMotivo("");
  };
  const quitarDescuento = async () => { if (esAdmin) patchCuenta({ descuento: null }); };
  const quitarPropina = async () => { if (pagos.length === 0) patchCuenta({ propina: null }); };

  // Al cancelar la cuenta, también hay que cancelar sus pedidos activos —
  // si no, se quedan "pendientes" para siempre y Cocina los sigue mostrando
  // como si nada, aunque la mesa ya no exista en Caja (pedido fantasma).
  const cancelarPedidosDeCuenta = async () => {
    const activos = cuentaOrders(orders, cuenta.id).filter((o) => o.estado !== "cancelado");
    if (activos.length === 0) return;
    const patch = {};
    const devolver = {};
    activos.forEach((o) => {
      patch[o.id] = { ...o, estado: "cancelado", consumo: {} };
      // Lo que todavía no se preparó vuelve al inventario; lo que ya salió de cocina ya se gastó.
      if (o.estado === "pendiente" || o.estado === "preparando") Object.entries(o.consumo || {}).forEach(([k, v]) => { devolver[k] = (devolver[k] || 0) + v; });
    });
    await saveOrdersMap(patch);
    if (Object.keys(devolver).length > 0) await ajustarInventario(devolver);
  };

  const cancelarCuenta = async () => {
    if (total > 0) {
      if (!esAdmin) return;
      if (!motivoCancelacion.trim()) return; // el motivo es obligatorio cuando hay dinero de por medio
      await cancelarPedidosDeCuenta();
      await patchCuenta({
        estado: "cancelada", canceladaTs: Date.now(), canceladaPor: usuarioActual.nombre,
        motivoCancelacion: motivoCancelacion.trim(), montoCancelado: total,
      });
    } else {
      await cancelarPedidosDeCuenta();
      await patchCuenta({ estado: "cancelada", canceladaTs: Date.now(), canceladaPor: usuarioActual.nombre, montoCancelado: 0 });
    }
    setConfirmCancelarCuenta(false); setMotivoCancelacion("");
  };

  const confirmarUnico = () => { if (!metodoSel) return; guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: total, tipo: "unico", etiqueta: null, items: itemsAgregados(orders, cuenta.id), procesadoPor: usuarioActual.nombre }); };

  const parteMonto = numPartes > 0 ? Math.round(total / numPartes) : 0;
  const partesRegistradas = pagos.filter((p) => p.tipo === "equitativo").length;
  const parteActual = partesRegistradas + 1;
  const esUltimaParte = parteActual >= numPartes;
  const montoParteActual = esUltimaParte ? total - parteMonto * (numPartes - 1) : parteMonto;
  const confirmarParte = () => { if (!metodoSel) return; guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: montoParteActual, tipo: "equitativo", etiqueta: `Parte ${parteActual} de ${numPartes}`, procesadoPor: usuarioActual.nombre }); };

  const agregados = itemsAgregados(orders, cuenta.id);
  const asignada = qtyAsignadaPorProducto(cuenta);
  const pendientes = agregados.map((it) => ({ ...it, qtyPend: it.qty - (asignada[it.key] || 0) })).filter((it) => it.qtyPend > 0);
  const cartMonto = Object.entries(cart).reduce((s, [key, qty]) => { const it = agregados.find((a) => a.key === key); return s + (it ? it.price * qty : 0); }, 0);
  const numPersonaSugerido = pagos.filter((p) => p.tipo === "por_producto").length + 1;

  const addToCart = (key, d) => {
    setCart((prev) => {
      const it = agregados.find((a) => a.key === key);
      if (!it) return prev;
      const pend = it.qty - (asignada[key] || 0);
      const cur = prev[key] || 0;
      const next = Math.max(0, Math.min(pend, cur + d));
      const copy = { ...prev, [key]: next };
      if (next === 0) delete copy[key];
      return copy;
    });
  };
  const confirmarProducto = () => {
    if (!metodoSel || Object.keys(cart).length === 0) return;
    const itemsSel = Object.entries(cart)
      .map(([key, qty]) => { const it = agregados.find((a) => a.key === key); return it ? { key, name: it.name, price: it.price, qty } : null; })
      .filter(Boolean);
    if (itemsSel.length === 0) return;
    const montoReal = itemsSel.reduce((s, it) => s + it.price * it.qty, 0);
    guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: montoReal, tipo: "por_producto", etiqueta: etiqueta.trim() || `Persona ${numPersonaSugerido}`, items: itemsSel, procesadoPor: usuarioActual.nombre });
  };
  const cobrarResto = () => {
    if (!metodoSel || restante <= 0) return;
    const itemsSel = pendientes.map((it) => ({ key: it.key, name: it.name, price: it.price, qty: it.qtyPend }));
    guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: restante, tipo: "por_producto", etiqueta: etiqueta.trim() || `Persona ${numPersonaSugerido} (resto)`, items: itemsSel, procesadoPor: usuarioActual.nombre });
  };

  return (
    <div className="anim-in" style={styles.mesaCuentaCard}>
      <button style={styles.mesaCuentaHead} onClick={onToggle}>
        <div style={styles.mesaCuentaLeft}>
          <span style={styles.mesaCuentaNum}>{mesaNombre(mesas, cuenta.mesa)}{esExterna(cuenta) && <span style={styles.extTag}>{TIPO_META[cuenta.tipo].corto}</span>}</span>
          <span style={styles.mesaCuentaSince}>Abierta desde {dateTimeLabel(cuenta.ts)}{cuenta.mesero ? ` · ${cuenta.mesero}` : ""}</span>
          {enCurso && <span style={styles.enCursoTag}>Cobro en curso · {money(cobrado)} de {money(total)}</span>}
        </div>
        <div style={styles.mesaCuentaRight}><span style={styles.mesaCuentaItems}>{items} ítems</span><span style={styles.mesaCuentaTotal}>{money(total)}</span></div>
      </button>

      {expanded && (
        <div style={styles.mesaCuentaBody}>
          {esExterna(cuenta) && cuenta.cliente && (cuenta.cliente.telefono || cuenta.cliente.direccion) && (
            <div style={styles.extInfoCaja}>
              {cuenta.cliente.telefono && <span style={styles.extInfoItem}><Phone size={12} /> {cuenta.cliente.telefono}</span>}
              {cuenta.cliente.direccion && <span style={styles.extInfoItem}><MapPin size={12} /> {cuenta.cliente.direccion}{cuenta.cliente.referencia ? ` · ${cuenta.cliente.referencia}` : ""}</span>}
            </div>
          )}
          {ords.slice().sort((a, b) => a.ts - b.ts).map((o) => (
            <div key={o.id} style={styles.mesaCuentaOrderRow}>
              <span style={styles.mesaCuentaOrderTime}>{timeLabel(o.ts)}</span>
              <span style={styles.mesaCuentaOrderItems}>{o.items.map((it) => `${it.qty}× ${itemNombre(it)}${it.nota ? ` (${it.nota})` : ""}`).join(", ")}</span>
              <span style={styles.mesaCuentaOrderTotal}>{money(orderTotal(o))}</span>
            </div>
          ))}

          <div style={styles.subtotalRow}>
            <span>Subtotal</span><span>{money(subtotal)}</span>
          </div>
          {cuenta.costoEnvio > 0 && (
            <div style={styles.subtotalRow}><span>Domicilio</span><span>+{money(cuenta.costoEnvio)}</span></div>
          )}
          {cuenta.descuento ? (
            <div style={styles.subtotalRow}>
              <span>
                Descuento ({cuenta.descuento.motivo}{cuenta.descuento.aplicadoPor ? ` · ${cuenta.descuento.aplicadoPor}` : ""})
                {esAdmin && <button style={styles.inlineLink} onClick={quitarDescuento}>quitar</button>}
              </span>
              <span style={{ color: "var(--c-c1442d-t)" }}>−{money(cuenta.descuento.monto)}</span>
            </div>
          ) : pagos.length === 0 ? (
            !esAdmin ? (
              <div style={styles.lockedNote}><Lock size={11} /> Solo un administrador puede aplicar descuentos o cortesías.</div>
            ) : mostrarDescuento ? (
              <div style={styles.descuentoBox}>
                <CampoMonto placeholder="Monto del descuento" value={descMonto} onChange={setDescMonto} />
                <input style={{ ...styles.editInput, marginTop: 6 }} placeholder="Motivo (ej: cortesía, cliente frecuente)" value={descMotivo} onChange={(e) => setDescMotivo(e.target.value)} />
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button style={styles.cancelEditBtn} onClick={() => setMostrarDescuento(false)}>Cancelar</button>
                  <button style={{ ...styles.sendBtn, flex: 1 }} onClick={aplicarDescuento}><Gift size={14} /> Aplicar</button>
                </div>
              </div>
            ) : (
              <button style={styles.inlineAddLink} onClick={() => setMostrarDescuento(true)}><Gift size={12} /> Aplicar descuento o cortesía</button>
            )
          ) : null}

          {cuenta.propina ? (
            <div style={styles.subtotalRow}>
              <span>
                Propina {cuenta.propina.pct != null ? `(${cuenta.propina.pct}%)` : ""}
                {pagos.length === 0 && <button style={styles.inlineLink} onClick={quitarPropina}>cambiar</button>}
              </span>
              <span>{money(cuenta.propina.monto)}</span>
            </div>
          ) : pagos.length === 0 && !mostrarDescuento ? (
            <div style={styles.propinaBox}>
              <span style={styles.closeConfirmText}>Propina:</span>
              <div style={styles.propinaPillsRow}>
                {PROPINA_OPCIONES.map((p) => (
                  <button key={p} style={styles.propinaPill} onClick={() => setPropina(p)}>{p}%</button>
                ))}
                <CampoMonto style={styles.propinaCustomInput} placeholder="$" value={propinaCustom} onChange={setPropinaCustom} />
                <button style={styles.propinaCustomBtn} onClick={() => setPropina("custom")} disabled={!propinaCustom}>Ok</button>
              </div>
            </div>
          ) : null}

          <div style={{ ...styles.subtotalRow, ...styles.subtotalRowFinal }}><span>Total a cobrar</span><span>{money(total)}</span></div>

          {total === 0 && pagos.length === 0 && (
            <div style={styles.cerrarVaciaBox}>
              <span style={styles.closeConfirmText}>Esta mesa no tiene nada que cobrar (sin pedidos, o se le quitó todo).</span>
              {confirmCancelarCuenta ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={styles.confirmText}>¿Cerrar la mesa sin cobro?</span>
                  <button style={styles.confirmYes} onClick={cancelarCuenta}>Sí</button>
                  <button style={styles.confirmNo} onClick={() => setConfirmCancelarCuenta(false)}>No</button>
                </div>
              ) : (
                <button style={styles.inlineAddLink} onClick={() => setConfirmCancelarCuenta(true)}><Ban size={12} /> Cerrar mesa (sin consumo)</button>
              )}
            </div>
          )}

          {pagos.length > 0 && (
            <div style={styles.pagosRegistradosBox}>
              <div style={styles.pagosRegistradosLabel}>PAGOS REGISTRADOS</div>
              {pagos.map((p) => {
                const meta = METODO_META[p.metodoPago]; const Icon = meta.icon;
                return (
                  <div key={p.id} style={styles.pagoRow}>
                    <Icon size={13} color={meta.color} />
                    <div style={styles.pagoRowMid}>
                      <span style={styles.pagoRowEtiqueta}>{p.etiqueta || "Cuenta completa"}</span>
                      {p.tipo === "por_producto" && <span style={styles.pagoRowItems}>{p.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</span>}
                      <span style={styles.pagoRowTime}>{timeLabel(p.ts)} · {meta.label}{p.procesadoPor ? ` · cobró ${p.procesadoPor}` : ""}</span>
                    </div>
                    <span style={styles.pagoRowMonto}>{money(p.monto)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {!turnoAbierto && restante > 0 && (
            <div style={styles.warnBanner}><AlertTriangle size={14} /> Abre el turno para poder cobrar esta mesa.</div>
          )}

          {restante > 0 && turnoAbierto && (
            <div style={styles.cobroBox}>
              {!effectiveModo ? (
                <>
                  <div style={styles.closeConfirmText}>¿Cómo quieren pagar?</div>
                  <div style={styles.modoChoiceRow}>
                    <button style={styles.modoChoiceBtn} onClick={() => setModoLocal("unico")}><Wallet size={16} /> Pago único</button>
                    <button style={styles.modoChoiceBtn} onClick={() => setModoLocal("igual")}><Users size={16} /> Partes iguales</button>
                    <button style={styles.modoChoiceBtn} onClick={() => setModoLocal("producto")}><Receipt size={16} /> Por producto</button>
                  </div>
                </>
              ) : effectiveModo === "unico" ? (
                <>
                  <div style={styles.closeConfirmText}>Cobrar {money(total)}. Elige el método de pago:</div>
                  <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
                  {renderVueltos(total)}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={styles.cancelEditBtn} onClick={() => setModoLocal(null)}>Volver</button>
                    <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel ? 1 : 0.4 }} disabled={!metodoSel} onClick={confirmarUnico}><Lock size={15} /> Confirmar cobro</button>
                  </div>
                </>
              ) : effectiveModo === "igual" ? (
                <>
                  {partesRegistradas === 0 ? (
                    <div style={styles.partesStepperRow}>
                      <span style={styles.closeConfirmText}>Dividir entre:</span>
                      <div style={styles.stepper}>
                        <button style={styles.stepBtn} onClick={() => setNumPartes((n) => Math.max(2, n - 1))}><Minus size={14} /></button>
                        <span style={styles.stepVal}>{numPartes}</span>
                        <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus }} onClick={() => setNumPartes((n) => Math.min(12, n + 1))}><Plus size={14} /></button>
                      </div>
                      <span style={styles.closeConfirmText}>personas</span>
                    </div>
                  ) : (
                    <div style={styles.closeConfirmText}>Dividido en {numPartes} partes de {money(parteMonto)} cada una.</div>
                  )}
                  <div style={styles.closeConfirmText}>Parte {parteActual} de {numPartes} — {money(montoParteActual)}. Método de pago:</div>
                  <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
                  {renderVueltos(montoParteActual)}
                  <div style={{ display: "flex", gap: 8 }}>
                    {partesRegistradas === 0 && <button style={styles.cancelEditBtn} onClick={() => setModoLocal(null)}>Volver</button>}
                    <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel ? 1 : 0.4 }} disabled={!metodoSel} onClick={confirmarParte}><Check size={15} /> Registrar parte {parteActual}</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.closeConfirmText}>Toca los productos de esta persona:</div>
                  {pendientes.map((it) => (
                    <div key={it.key} style={styles.productoSplitRow}>
                      <div><div style={styles.menuItemName}>{it.name}</div><div style={styles.menuItemPrice}>{money(it.price)} · quedan {it.qtyPend}</div></div>
                      <div style={styles.stepper}>
                        <button style={styles.stepBtn} onClick={() => addToCart(it.key, -1)}><Minus size={14} /></button>
                        <span style={styles.stepVal}>{cart[it.key] || 0}</span>
                        <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus }} onClick={() => addToCart(it.key, 1)}><Plus size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <input style={styles.editInput} placeholder={`Nombre de la persona (opcional, ej. "Persona ${numPersonaSugerido}")`} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
                  <div style={styles.closeConfirmText}>Subtotal de esta persona: <b>{money(cartMonto)}</b></div>
                  <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
                  {renderVueltos(cartMonto)}
                  <div style={{ display: "flex", gap: 8 }}>
                    {pagos.length === 0 && <button style={styles.cancelEditBtn} onClick={() => setModoLocal(null)}>Volver</button>}
                    <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel && cartMonto > 0 ? 1 : 0.4 }} disabled={!metodoSel || cartMonto === 0} onClick={confirmarProducto}><Check size={15} /> Registrar pago — {money(cartMonto)}</button>
                  </div>
                  {Object.keys(cart).length === 0 && (
                    <button style={{ ...styles.repeatBtn, margin: 0, opacity: metodoSel ? 1 : 0.5 }} disabled={!metodoSel} onClick={cobrarResto}>Cobrar todo lo que queda — {money(restante)}</button>
                  )}
                </>
              )}
            </div>
          )}

          {esAdmin && total > 0 && (
            <div style={styles.cancelarCuentaBox}>
              {confirmCancelarCuenta ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={styles.closeConfirmText}>
                    Vas a cancelar {money(total)} de esta mesa <b>sin registrar ningún cobro</b>. Esto queda guardado con tu nombre en el historial. Escribe el motivo (obligatorio):
                  </span>
                  <input
                    autoFocus style={styles.editInput} placeholder="Ej: cliente se fue sin pagar, error al abrir la mesa…"
                    value={motivoCancelacion} onChange={(e) => setMotivoCancelacion(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={styles.cancelEditBtn} onClick={() => { setConfirmCancelarCuenta(false); setMotivoCancelacion(""); }}>Volver</button>
                    <button
                      style={{ ...styles.sendBtn, flex: 1, background: "#C1442D", opacity: motivoCancelacion.trim() ? 1 : 0.4 }}
                      disabled={!motivoCancelacion.trim()} onClick={cancelarCuenta}
                    >
                      <Ban size={14} /> Confirmar cancelación
                    </button>
                  </div>
                </div>
              ) : (
                <button style={{ ...styles.inlineLink, color: "var(--c-c1442d-t)" }} onClick={() => setConfirmCancelarCuenta(true)}>Cancelar esta cuenta sin cobrar</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Historial ---------------- */

function HistorialView({ cuentasParaHistorial, ordersParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto, config, mesas, usuarioActual }) {
  const [view, setView] = useState("years");
  const [year, setYear] = useState(null);
  const [month, setMonth] = useState(null);
  const [day, setDay] = useState(null);
  const [expandedCuentaId, setExpandedCuentaId] = useState(null);
  const [verCanceladas, setVerCanceladas] = useState(false);
  const [verTodasCanceladas, setVerTodasCanceladas] = useState(false);
  const esAdmin = tieneRol(usuarioActual, "admin");
  const cuentas = cuentasParaHistorial;
  const orders = ordersParaHistorial;

  // Apenas se entra a Historial, se pide el historial completo (una sola vez,
  // no en vivo) — antes de eso solo se ve lo de los últimos días.
  useEffect(() => { cargarHistorialCompleto(); }, [cargarHistorialCompleto]);

  const { days, months, years } = buildHistory(cuentas, orders);
  const CANCELADAS_RECIENTES_DIAS = 30;
  const cortoCanceladasRecientes = Date.now() - CANCELADAS_RECIENTES_DIAS * 24 * 60 * 60 * 1000;
  const todasCanceladas = cuentas
    .filter((c) => c.estado === "cancelada" && (c.montoCancelado || 0) > 0)
    .sort((a, b) => b.canceladaTs - a.canceladaTs);
  const canceladasRecientes = todasCanceladas.filter((c) => c.canceladaTs >= cortoCanceladasRecientes);
  const canceladasAntiguas = todasCanceladas.filter((c) => c.canceladaTs < cortoCanceladasRecientes);
  const canceladas = verTodasCanceladas ? todasCanceladas : canceladasRecientes;

  const AvisoCargando = !historialCompleto && (
    <div style={styles.cargandoHistBox}>
      <span>{cargandoHistorial ? "Cargando historial completo…" : "Mostrando solo los últimos días — cargando el resto…"}</span>
    </div>
  );

  const PanelCanceladas = esAdmin && todasCanceladas.length > 0 && (
    <div style={styles.canceladasBox}>
      <button style={styles.canceladasToggle} onClick={() => setVerCanceladas((v) => !v)}>
        <Ban size={13} color="var(--c-c1442d-t)" />
        <span>
          {canceladas.length} {canceladas.length === 1 ? "cuenta cancelada" : "cuentas canceladas"} sin cobrar
          {!verTodasCanceladas ? ` (últimos ${CANCELADAS_RECIENTES_DIAS} días)` : ""} — {money(canceladas.reduce((s, c) => s + (c.montoCancelado || 0), 0))} en total
        </span>
        <span>{verCanceladas ? "▲" : "▼"}</span>
      </button>
      {verCanceladas && (
        <div style={{ marginTop: 6 }}>
          {canceladas.length === 0 && (
            <div style={styles.canceladaMotivo}>Ninguna cancelación en los últimos {CANCELADAS_RECIENTES_DIAS} días.</div>
          )}
          {canceladas.map((c) => (
            <div key={c.id} style={styles.canceladaRow}>
              <div style={styles.rowBetween}>
                <span style={styles.cierreDate}>{dateTimeLabel(c.canceladaTs)} · {mesaNombre(mesas, c.mesa)}{c.mesero ? ` · abrió ${c.mesero}` : ""}</span>
                <span style={{ ...styles.cierreTotal, color: "var(--c-c1442d-t)" }}>{money(c.montoCancelado)}</span>
              </div>
              <div style={styles.canceladaMotivo}>Canceló <b>{c.canceladaPor}</b>: "{c.motivoCancelacion}"</div>
            </div>
          ))}
          {!verTodasCanceladas && canceladasAntiguas.length > 0 && (
            <button style={styles.inlineAddLink} onClick={() => setVerTodasCanceladas(true)}>
              Ver también {canceladasAntiguas.length} {canceladasAntiguas.length === 1 ? "cancelación anterior" : "cancelaciones anteriores"} →
            </button>
          )}
          {verTodasCanceladas && canceladasAntiguas.length > 0 && (
            <button style={styles.inlineAddLink} onClick={() => setVerTodasCanceladas(false)}>Ver solo las recientes</button>
          )}
        </div>
      )}
    </div>
  );

  if (Object.keys(days).length === 0) {
    return (
      <div className="ancho" style={styles.menuScroll}>
        {AvisoCargando}
        {PanelCanceladas}
        <div style={styles.cajaEmptyText}>Todavía no hay cuentas cobradas. Cuando cobres una mesa, va a aparecer aquí organizada por día, con fecha y hora exactas.</div>
      </div>
    );
  }

  if (view === "years") {
    const list = Object.values(years).sort((a, b) => b.key - a.key);
    return (
      <div className="ancho" style={styles.menuScroll}>
        {AvisoCargando}
        {PanelCanceladas}
        <div style={styles.rowBetween}>
          <div style={styles.catLabel}>AÑOS</div>
          {esAdmin && <button style={styles.exportLink} onClick={() => exportarExcel(cuentas, orders, config, mesas)}><Download size={13} /> Exportar Excel</button>}
        </div>
        {list.length > 1 && (
          <div style={styles.chartBox}>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[...list].sort((a, b) => a.key.localeCompare(b.key))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4DFCE" />
                <XAxis dataKey="key" tick={{ fontSize: 11, fill: "var(--c-8a8272-t)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--c-8a8272-t)" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="total" fill="var(--c-5b7553-t)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {list.map((y) => (
          <button key={y.key} style={styles.histRow} onClick={() => { setYear(y.key); setView("months"); }}>
            <span style={styles.histRowTitle}>{y.key}</span>
            <span style={styles.histRowSub}>{y.monthKeys.length} {y.monthKeys.length === 1 ? "mes" : "meses"} con ventas</span>
            <span style={styles.histRowTotal}>{money(y.total)}</span>
          </button>
        ))}
      </div>
    );
  }
  if (view === "months") {
    const list = Object.values(months).filter((m) => m.key.startsWith(year)).sort((a, b) => b.key.localeCompare(a.key));
    return (
      <div className="ancho" style={styles.menuScroll}>
        <button style={styles.backBtn} onClick={() => setView("years")}>← Años</button>
        <div style={{ ...styles.catLabel, marginTop: 12 }}>{year}</div>
        {list.map((m) => {
          const [añoMes, mesMes] = m.key.split("-");
          const claveAñoAnterior = `${Number(añoMes) - 1}-${mesMes}`;
          const mesAñoAnterior = months[claveAñoAnterior];
          const delta = mesAñoAnterior && mesAñoAnterior.total > 0 ? Math.round(((m.total - mesAñoAnterior.total) / mesAñoAnterior.total) * 100) : null;
          return (
            <button key={m.key} style={styles.histRow} onClick={() => { setMonth(m.key); setView("days"); }}>
              <span style={styles.histRowTitle}>{monthLabel(m.ts)}</span>
              <span style={styles.histRowSub}>
                {m.dayKeys.length} {m.dayKeys.length === 1 ? "día" : "días"} con ventas
                {delta !== null && (
                  <span style={{ color: delta >= 0 ? "var(--c-5b7553-t)" : "var(--c-c1442d-t)", fontWeight: 700 }}> · {delta >= 0 ? "+" : ""}{delta}% vs {claveAñoAnterior}</span>
                )}
              </span>
              <span style={styles.histRowTotal}>{money(m.total)}</span>
            </button>
          );
        })}
      </div>
    );
  }
  if (view === "days") {
    const list = Object.values(days).filter((d) => d.key.startsWith(month)).sort((a, b) => b.key.localeCompare(a.key));
    return (
      <div className="ancho" style={styles.menuScroll}>
        <button style={styles.backBtn} onClick={() => setView("months")}>← Meses</button>
        <div style={{ ...styles.catLabel, marginTop: 12 }}>{list[0] ? monthLabel(list[0].ts) : ""}</div>
        {list.map((d) => (
          <button key={d.key} style={styles.histRow} onClick={() => { setDay(d.key); setView("day"); }}>
            <span style={styles.histRowTitle}>{dayLabel(d.ts)}</span>
            <span style={styles.histRowSub}>{d.cuentasCount} {d.cuentasCount === 1 ? "cuenta cobrada" : "cuentas cobradas"}</span>
            <span style={styles.histRowTotal}>{money(d.total)}</span>
          </button>
        ))}
      </div>
    );
  }

  const d = days[day];
  if (!d) return null;
  const productos = Object.entries(d.productos).sort((a, b) => b[1].subtotal - a[1].subtotal);
  return (
    <div className="ancho" style={styles.menuScroll}>
      <button className="no-imprimir" style={styles.backBtn} onClick={() => setView("days")}>← Días</button>
      <div style={{ marginTop: 12, marginBottom: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={styles.pageEyebrow}>{dayLabel(d.ts)}</div>
          <div style={{ ...styles.cajaTotalValue, color: "var(--c-242019-t)" }}>{money(d.total)}</div>
        </div>
        <button className="no-imprimir" style={styles.exportLink} onClick={() => window.print()}>🖨️ Imprimir</button>
      </div>

      <div style={styles.metodoBreakdownRowLight}>
        {Object.entries(METODO_META).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <div key={key} style={styles.metodoBreakdownItemLight}>
              <Icon size={13} color={meta.color} /><span style={styles.metodoBreakdownLabelLight}>{meta.label}</span><span style={styles.metodoBreakdownValueLight}>{money(d.porMetodo[key] || 0)}</span>
            </div>
          );
        })}
      </div>

      <div style={{ ...styles.catLabel, marginTop: 18 }}>CUENTAS COBRADAS ESE DÍA</div>
      {d.cuentas.slice().sort((a, b) => a.pagadaTs - b.pagadaTs).map((c) => {
        const dividida = c.pagos && c.pagos.length > 1;
        const isExpanded = expandedCuentaId === c.id;
        const meta = !dividida && c.pagos && c.pagos[0] ? METODO_META[c.pagos[0].metodoPago] : null;
        return (
          <div key={c.id}>
            <button style={{ ...styles.cierreRow, width: "100%", background: "transparent", border: "none", cursor: dividida ? "pointer" : "default", textAlign: "left" }} onClick={() => dividida && setExpandedCuentaId(isExpanded ? null : c.id)}>
              <span style={styles.cierreDate}>
                {meta && <meta.icon size={12} color={meta.color} style={{ marginRight: 5, verticalAlign: -2 }} />}
                {mesaNombre(mesas, c.mesa)}{c.mesero ? ` · ${c.mesero}` : ""} · cobrada {timeLabel(c.pagadaTs)}
                {dividida && <span style={styles.dividedTag}> · dividida en {c.pagos.length} pagos {isExpanded ? "▲" : "▼"}</span>}
              </span>
              <span style={styles.cierrePedidos}>{c.itemCount} ítems</span>
              <span style={styles.cierreTotal}>{money(c.total)}</span>
            </button>
            {dividida && isExpanded && (
              <div style={styles.pagosRegistradosBox}>
                {c.pagos.map((p) => {
                  const pmeta = METODO_META[p.metodoPago]; const PIcon = pmeta.icon;
                  return (
                    <div key={p.id} style={styles.pagoRow}>
                      <PIcon size={13} color={pmeta.color} />
                      <div style={styles.pagoRowMid}>
                        <span style={styles.pagoRowEtiqueta}>{p.etiqueta || "Cuenta completa"}</span>
                        {p.tipo === "por_producto" && <span style={styles.pagoRowItems}>{p.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</span>}
                        <span style={styles.pagoRowTime}>{timeLabel(p.ts)} · {pmeta.label}{p.procesadoPor ? ` · cobró ${p.procesadoPor}` : ""}</span>
                      </div>
                      <span style={styles.pagoRowMonto}>{money(p.monto)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ ...styles.catLabel, marginTop: 18 }}>PRODUCTOS VENDIDOS</div>
      {productos.map(([name, p]) => (
        <div key={name} style={styles.cajaProductRow}><span style={styles.cajaProductQty}>{p.qty}×</span><span style={styles.cajaProductName}>{name}</span><span style={styles.cajaProductSubtotal}>{money(p.subtotal)}</span></div>
      ))}
    </div>
  );
}

/* ---------------- Reportes ---------------- */

function ReportesView({ cuentas, orders, menu, usuarioActual }) {
  const [rango, setRango] = useState("hoy");
  const esAdmin = tieneRol(usuarioActual, "admin");

  const inicioRango = () => {
    const d = new Date();
    if (rango === "hoy") { d.setHours(0, 0, 0, 0); return d.getTime(); }
    if (rango === "semana") { d.setDate(d.getDate() - 7); return d.getTime(); }
    d.setDate(d.getDate() - 30); return d.getTime();
  };
  const desde = inicioRango();
  const pagadasRango = cuentas.filter((c) => c.estado === "pagada" && c.pagadaTs >= desde);
  const costoPorId = Object.fromEntries(menu.map((m) => [m.id, m.cost || 0]));

  // Tiempo promedio de cocina: de cuando se envió el pedido a cuando se marcó "listo".
  const ordenesConTiempo = orders.filter((o) => o.ts >= desde && o.listoTs && o.estado !== "cancelado");
  const tiempoPromedioMin = ordenesConTiempo.length > 0
    ? Math.round(ordenesConTiempo.reduce((s, o) => s + (o.listoTs - o.ts), 0) / ordenesConTiempo.length / 60000)
    : null;

  const porHora = {};
  pagadasRango.forEach((c) => { const h = new Date(c.pagadaTs).getHours(); porHora[h] = (porHora[h] || 0) + cuentaGranTotal(orders, c); });
  const dataHora = Array.from({ length: 24 }, (_, h) => ({ hora: hourLabel(h), total: porHora[h] || 0 })).filter((d, i) => {
    // solo mostrar el rango de horas de operación con datos, ampliado un poco
    const conDatos = Object.keys(porHora).map(Number);
    if (conDatos.length === 0) return i >= 6 && i <= 22;
    return i >= Math.max(0, Math.min(...conDatos) - 1) && i <= Math.min(23, Math.max(...conDatos) + 1);
  });

  const productoMap = {};
  let ventaProductos = 0, costoProductos = 0, huboCostosCargados = false;
  pagadasRango.forEach((c) => cuentaOrders(orders, c.id).filter((o) => o.estado !== "cancelado").forEach((o) => o.items.forEach((it) => {
    if (!productoMap[it.name]) productoMap[it.name] = { qty: 0, subtotal: 0 };
    productoMap[it.name].qty += it.qty; productoMap[it.name].subtotal += it.qty * it.price;
    ventaProductos += it.qty * it.price;
    // Los pedidos nuevos ya guardan su propio costo (congelado al momento de
    // la venta). Los pedidos viejos, de antes de este cambio, no lo tienen —
    // para esos usamos el costo actual del menú como mejor estimado posible.
    const costoUnit = (it.cost !== undefined && it.cost !== null) ? it.cost : (costoPorId[it.id] || 0);
    if (costoUnit > 0) huboCostosCargados = true;
    costoProductos += it.qty * costoUnit;
  })));
  const topProductos = Object.entries(productoMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  const margenRango = ventaProductos - costoProductos;
  const margenPct = ventaProductos > 0 ? Math.round((margenRango / ventaProductos) * 100) : 0;

  const totalRango = pagadasRango.reduce((s, c) => s + cuentaGranTotal(orders, c), 0);
  const propinasRango = pagadasRango.reduce((s, c) => s + ((c.propina && c.propina.monto) || 0), 0);
  const descuentosRango = pagadasRango.reduce((s, c) => s + ((c.descuento && c.descuento.monto) || 0), 0);
  const cuentaBrutaRango = totalRango + descuentosRango - propinasRango;
  const canceladasRango = cuentas.filter((c) => c.estado === "cancelada" && (c.montoCancelado || 0) > 0 && c.canceladaTs >= desde);
  const totalCanceladoRango = canceladasRango.reduce((s, c) => s + (c.montoCancelado || 0), 0);

  const meseroMap = {};
  pagadasRango.forEach((c) => {
    const nombre = c.mesero || "Sin asignar";
    if (!meseroMap[nombre]) meseroMap[nombre] = { cuentas: 0, total: 0, propinas: 0 };
    meseroMap[nombre].cuentas += 1;
    meseroMap[nombre].total += cuentaGranTotal(orders, c);
    meseroMap[nombre].propinas += (c.propina && c.propina.monto) || 0;
  });
  const meserosOrdenados = Object.entries(meseroMap).sort((a, b) => b[1].total - a[1].total);
  const [repartirPropinas, setRepartirPropinas] = useState(false);
  const [numPersonasPropina, setNumPersonasPropina] = useState(2);

  return (
    <div className="ancho" style={styles.menuScroll}>
      <div className="no-imprimir ancho" style={styles.cajaTabSwitch}>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "hoy" ? styles.cajaTabBtnActive : {}) }} onClick={() => setRango("hoy")}>Hoy</button>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "semana" ? styles.cajaTabBtnActive : {}) }} onClick={() => setRango("semana")}>7 días</button>
        <button style={{ ...styles.cajaTabBtn, ...(rango === "mes" ? styles.cajaTabBtnActive : {}) }} onClick={() => setRango("mes")}>30 días</button>
        {esAdmin && <button style={styles.exportLink} onClick={() => window.print()}>🖨️ Imprimir</button>}
      </div>

      <div className="solo-imprimir" style={styles.reportePrintHeader}>
        <div style={styles.reportePrintTitle}>Reporte financiero — {rango === "hoy" ? "Hoy" : rango === "semana" ? "Últimos 7 días" : "Últimos 30 días"}</div>
        <div style={styles.reportePrintSub}>Generado el {dateTimeLabel(Date.now())}</div>
      </div>

      <div style={styles.cajaTotalCard}>
        <span style={styles.cajaTotalLabel}>Total vendido</span>
        <span style={styles.cajaTotalValue}>{money(totalRango)}</span>
        <span style={styles.turnoEsperadoLabel}>{pagadasRango.length} cuentas · {money(propinasRango)} en propinas</span>
        {esAdmin && huboCostosCargados && (
          <div style={styles.margenRow}>
            <span>Margen estimado: <b>{money(margenRango)}</b> ({margenPct}%)</span>
          </div>
        )}
      </div>
      {esAdmin && !huboCostosCargados && ventaProductos > 0 && (
        <div style={styles.cajaEmptyText}>Agrégale costo a tus productos en Menú para ver aquí el margen de este período.</div>
      )}

      {esAdmin && (
        <>
          <div style={{ ...styles.catLabel, marginTop: 16 }}>RESUMEN FINANCIERO</div>
          <div style={styles.turnoBox}>
            <div style={styles.subtotalRow}><span>Consumo bruto (antes de descuentos)</span><span>{money(cuentaBrutaRango)}</span></div>
            <div style={styles.subtotalRow}><span>Descuentos y cortesías aplicados</span><span style={{ color: "var(--c-c1442d-t)" }}>−{money(descuentosRango)}</span></div>
            <div style={styles.subtotalRow}><span>Propinas</span><span>+{money(propinasRango)}</span></div>
            <div style={{ ...styles.subtotalRow, ...styles.subtotalRowFinal }}><span>Total cobrado</span><span>{money(totalRango)}</span></div>
            {huboCostosCargados && (
              <>
                <div style={styles.subtotalRow}><span>Costo de productos vendidos</span><span>−{money(costoProductos)}</span></div>
                <div style={{ ...styles.subtotalRow, ...styles.subtotalRowFinal }}><span>Margen (utilidad bruta)</span><span>{money(margenRango)} ({margenPct}%)</span></div>
              </>
            )}
            <div style={styles.subtotalRow}>
              <span style={{ color: canceladasRango.length > 0 ? "var(--c-c1442d-t)" : undefined }}>Cuentas canceladas sin cobrar ({canceladasRango.length})</span>
              <span style={{ color: canceladasRango.length > 0 ? "var(--c-c1442d-t)" : undefined }}>{money(totalCanceladoRango)}</span>
            </div>
          </div>
        </>
      )}

      <div style={styles.catLabel}>PROPINAS DEL PERÍODO</div>
      <div style={styles.turnoBox}>
        <div style={styles.closeConfirmText}>{money(propinasRango)} en propinas en este rango.</div>
        {!repartirPropinas ? (
          <button style={styles.inlineAddLink} onClick={() => setRepartirPropinas(true)}>Repartir entre el equipo →</button>
        ) : (
          <>
            <div style={styles.partesStepperRow}>
              <span style={styles.closeConfirmText}>Dividir entre:</span>
              <div style={styles.stepper}>
                <button style={styles.stepBtn} onClick={() => setNumPersonasPropina((n) => Math.max(1, n - 1))}><Minus size={14} /></button>
                <span style={styles.stepVal}>{numPersonasPropina}</span>
                <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus }} onClick={() => setNumPersonasPropina((n) => Math.min(20, n + 1))}><Plus size={14} /></button>
              </div>
              <span style={styles.closeConfirmText}>personas</span>
            </div>
            <div style={styles.diferenciaBox}>Cada uno: <b>{money(propinasRango / numPersonasPropina)}</b></div>
          </>
        )}
      </div>

      {tiempoPromedioMin !== null && (
        <div style={styles.tiempoCocinaBox}>
          <Clock size={14} color="var(--c-b98a2e-t)" />
          <span>Tiempo promedio de cocina: <b>{tiempoPromedioMin} min</b> ({ordenesConTiempo.length} pedidos)</span>
        </div>
      )}

      <div style={styles.catLabel}>VENTAS POR HORA</div>
      <div style={styles.chartBox}>
        {dataHora.length === 0 || totalRango === 0 ? (
          <div style={styles.cajaEmptyText}>Sin ventas en este rango todavía.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dataHora}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4DFCE" />
              <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "var(--c-8a8272-t)" }} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: "var(--c-8a8272-t)" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" fill="var(--c-c1442d-t)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ ...styles.catLabel, marginTop: 20 }}>TOP 5 PRODUCTOS</div>
      {topProductos.length === 0 ? (
        <div style={styles.cajaEmptyText}>Sin datos todavía.</div>
      ) : (
        topProductos.map(([name, p]) => (
          <div key={name} style={styles.cajaProductRow}><span style={styles.cajaProductQty}>{p.qty}×</span><span style={styles.cajaProductName}>{name}</span><span style={styles.cajaProductSubtotal}>{money(p.subtotal)}</span></div>
        ))
      )}

      <div style={{ ...styles.catLabel, marginTop: 20 }}>VENTAS POR MESERO</div>
      {meserosOrdenados.length === 0 ? (
        <div style={styles.cajaEmptyText}>Sin datos todavía.</div>
      ) : (
        meserosOrdenados.map(([nombre, d]) => (
          <div key={nombre} style={styles.meseroStatRow}>
            <div style={styles.meseroStatLeft}>
              <UserCircle2 size={14} color="var(--c-8a8272-t)" />
              <span style={styles.pagoRowEtiqueta}>{nombre}</span>
              <span style={styles.meseroStatSub}>{d.cuentas} {d.cuentas === 1 ? "cuenta" : "cuentas"}{d.propinas > 0 ? ` · ${money(d.propinas)} propina` : ""}</span>
            </div>
            <span style={styles.mesaCuentaTotal}>{money(d.total)}</span>
          </div>
        ))
      )}
    </div>
  );
}

/* ---------------- estilos ---------------- */

const styles = {
  app: { fontFamily: "var(--font-body)", height: "100dvh", minHeight: "100vh", background: "var(--c-f7f4ec-b)", display: "flex", flexDirection: "column", overflow: "hidden", width: "100%" },
  loadingScreen: { height: "100dvh", minHeight: "100vh", background: "#1E2124", display: "flex", alignItems: "center", justifyContent: "center" },
  loadingStamp: { fontFamily: "'IBM Plex Mono', monospace", color: "#8A9B87", letterSpacing: 2, fontSize: 13 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--c-242019-b)", flexShrink: 0, gap: 8, flexWrap: "wrap" },
  brand: { display: "flex", alignItems: "center", gap: 8 },
  temaBtn: { width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#33291f", color: "#D9CFAE", border: "none", borderRadius: 14, cursor: "pointer", marginLeft: 2, flexShrink: 0 },
  loginBrand: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 },
  loginBrandName: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)", letterSpacing: 0.5 },
  extInfo: { display: "flex", flexWrap: "wrap", gap: "4px 14px", padding: "8px 16px", background: "var(--c-f1ecdd-b)", borderBottom: "1px solid var(--c-e4dfce-o)", fontSize: 12.5, color: "var(--c-5c5648-t)" },
  extInfoCaja: { display: "flex", flexDirection: "column", gap: 3, padding: "8px 10px", background: "var(--c-f1ecdd-b)", borderRadius: 8, fontSize: 12.5, color: "var(--c-5c5648-t)" },
  extInfoItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  extTag: { marginLeft: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, padding: "2px 7px", borderRadius: 8, background: "var(--c-fbefd9-b)", color: "var(--c-8a611a-t)", verticalAlign: 2 },
  mesasScroll: { flex: 1, overflowY: "auto", paddingBottom: 24 },
  externosWrap: { padding: "6px 16px 8px", display: "flex", flexDirection: "column", gap: 8 },
  externoBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 10px", background: "var(--c-fffdf8-b)", color: "var(--c-242019-t)", border: "1px dashed var(--c-d9cfae-o)", borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
  externoCard: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%" },
  externoIcon: { width: 38, height: 38, borderRadius: 19, background: "var(--c-ede7d8-b)", color: "var(--accent-t)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  externoInfo: { display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 },
  externoNombre: { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--c-242019-t)" },
  externoSub: { fontSize: 11.5, color: "#B3A891", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  lineaOpc: { display: "flex", alignItems: "center", gap: 6, marginTop: 5, padding: "4px 4px 4px 8px", background: "var(--c-ede7d8-b)", borderRadius: 8 },
  lineaOpcTxt: { flex: 1, fontSize: 12, color: "var(--c-5c5648-t)", lineHeight: 1.3 },
  lineaOpcBtn: { width: 24, height: 24, borderRadius: 6, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-242019-t)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  kdsTools: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 20px 12px", flexWrap: "wrap" },
  kdsChips: { display: "flex", gap: 6, flexWrap: "wrap" },
  kdsChip: { padding: "7px 14px", borderRadius: 18, border: "1px solid #3A3F44", background: "transparent", color: "#B8C2CC", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  kdsChipOn: { background: "#5C6670", color: "#F7F4EC", border: "1px solid #5C6670" },
  kdsZoomBtn: { display: "inline-flex", alignItems: "baseline", gap: 3, padding: "6px 12px", borderRadius: 18, border: "1px solid #3A3F44", background: "transparent", color: "#B8C2CC", fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: "auto" },
  railGrid: { flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12, padding: "0 20px 24px", alignContent: "start", alignItems: "start" },
  emptyKitchenSub: { fontSize: 12.5, color: "#7A8087", maxWidth: 260, textAlign: "center", lineHeight: 1.5 },
  ticketTipo: { display: "inline-block", marginRight: 8, padding: "1px 7px", borderRadius: 6, background: "#B98A2E", color: "#F7F4EC", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8 },
  ticketEstTag: { marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#8A9B87", letterSpacing: 0.5, textTransform: "uppercase" },
  ticketItemMods: { fontSize: 12.5, fontWeight: 600, color: "#E6D9B0", marginLeft: 30, marginTop: 1, lineHeight: 1.35 },
  brandMark: { color: "var(--accent)", fontSize: 14 },
  brandText: { fontFamily: "var(--font-display)", color: "#F7F4EC", letterSpacing: 2, fontSize: 15, fontWeight: 600 },
  syncDot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block", marginLeft: 2 },
  meseroChip: { display: "flex", alignItems: "center", gap: 5, background: "#33291f", color: "#D9CFAE", border: "none", borderRadius: 20, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  rolBadge: { marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--c-8a611a-t)", background: "var(--c-fbefd9-b)", padding: "2px 8px", borderRadius: 10, fontWeight: 700 },
  roleSwitch: { display: "flex", background: "#33291f", borderRadius: 10, padding: 3, gap: 2 },
  roleBtn: { display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-body)", border: "none", borderRadius: 8, background: "transparent", color: "#B3A891", cursor: "pointer" },
  roleBtnActive: { background: "var(--c-f7f4ec-b)", color: "var(--c-242019-t)" },
  roleBtnActiveDark: { background: "#5C6670", color: "#F7F4EC" },

  screen: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  screenDark: { flex: 1, display: "flex", flexDirection: "column", background: "#1E2124", overflow: "hidden", transition: "background 0.2s" },
  screenFlash: { background: "#2b1f1c" },

  loginWrap: { padding: 24, display: "flex", flexDirection: "column", gap: 10, maxWidth: 420, margin: "0 auto", width: "100%" },
  loginList: { display: "flex", flexDirection: "column", gap: 8 },
  loginBtn: { display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "var(--c-242019-t)", cursor: "pointer" },
  loginNewRow: { display: "flex", gap: 8, marginTop: 6 },

  pageEyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: "var(--accent-t)", fontWeight: 600, textTransform: "uppercase" },
  pageTitle: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--c-242019-t)", marginTop: 2, marginBottom: 4 },
  cajaEmptyText: { fontSize: 13, color: "var(--c-8a8272-t)", lineHeight: 1.5, padding: "8px 0" },
  editInput: { width: "100%", padding: "11px 12px", borderRadius: 9, border: "1px solid var(--c-e4dfce-o)", fontSize: 14, fontFamily: "var(--font-body)", color: "var(--c-242019-t)", background: "var(--c-fffdf8-b)", boxSizing: "border-box" },
  addItemBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 14px", background: "var(--c-242019-b)", color: "#F7F4EC", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer", width: "100%" },
  backBtn: { alignSelf: "flex-start", background: "transparent", border: "none", color: "var(--c-8a8272-t)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 0" },
  pinError: { fontSize: 12.5, color: "var(--c-c1442d-t)", fontWeight: 600 },

  subHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--c-e4dfce-o)", flexShrink: 0, gap: 8 },
  mesaTitleWrap: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1 },
  mesaEyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.5, color: "#B3A891", fontWeight: 600 },
  mesaTitle: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" },
  cuentaOpenSub: { fontSize: 11, color: "var(--c-5b7553-t)", fontWeight: 600, marginTop: 2 },
  mesaActionBtn: { width: 34, height: 34, borderRadius: 9, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-242019-t)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  mesaActionPanel: { padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8, background: "var(--c-f1ecdd-b)", borderBottom: "1px solid var(--c-e4dfce-o)" },
  modoChoiceBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 10px", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 9, fontSize: 13, fontWeight: 600, color: "var(--c-242019-t)", cursor: "pointer" },
  closeConfirmText: { fontSize: 12.5, color: "var(--c-5c5648-t)", lineHeight: 1.5 },
  mesaPickerRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  mesaPickerBtn: { padding: "9px 14px", background: "var(--c-242019-b)", color: "#F7F4EC", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  cancelEditBtn: { padding: "11px 14px", background: "transparent", color: "var(--c-8a8272-t)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer" },

  ticketStripCol: { padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6, background: "var(--c-f1ecdd-b)", borderBottom: "1px solid var(--c-e4dfce-o)" },
  miniTicketRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  miniTicket: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--c-5c5648-t)", flex: 1, flexWrap: "wrap" },
  stateDot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block" },
  miniTicketTime: { marginLeft: "auto", color: "#B3A891", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5 },
  editedTag: { fontSize: 9.5, fontWeight: 700, color: "var(--c-8a611a-t)", background: "var(--c-fbefd9-b)", padding: "1px 6px", borderRadius: 8, textTransform: "uppercase" },
  miniTicketActions: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 },
  pedidosWrap: { padding: "8px 16px", background: "var(--c-f1ecdd-b)", borderBottom: "1px solid var(--c-e4dfce-o)" },
  pedidosResumen: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", background: "var(--c-fbf8f0-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 9, fontSize: 12.5, cursor: "pointer", color: "var(--c-3b372e-t)" },
  pedidosResumenTxt: { display: "flex", gap: 10, flexWrap: "wrap" },
  pedidosResumenTotal: { fontWeight: 700, whiteSpace: "nowrap" },
  pedidosLista: { display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxHeight: "38vh", overflowY: "auto" },
  pedidoCard: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", background: "var(--c-fbf8f0-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 9 },
  pedidoCardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pedidoCardInfo: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--c-5c5648-t)", flexWrap: "wrap" },
  pedidoServidoRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--c-8a8272-t)", padding: "2px 4px" },
  itemsEstadoCol: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", background: "var(--c-f2eee2-b)", borderRadius: 8, marginTop: 4 },
  itemEstadoRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemEstadoName: { fontSize: 12.5, color: "var(--c-3b372e-t)", display: "flex", flexDirection: "column", gap: 1 },
  itemEstadoTag: { fontSize: 10.5, fontWeight: 700 },
  itemKdsActions: { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" },
  itemKdsCount: { fontSize: 12, fontWeight: 700, color: "#B8C2CC" },
  itemKdsBtn: { display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", background: "#5B7553", color: "#F7F4EC", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  itemKdsUndo: { width: 26, height: 26, background: "transparent", color: "#B8C2CC", border: "1px solid #5C6670", borderRadius: 7, fontSize: 14, cursor: "pointer" },
  marcarServidoBtn: { display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#2F6690", color: "#F7F4EC", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" },
  confirmText: { fontSize: 11.5, color: "var(--c-5c5648-t)", marginRight: 2 },
  confirmYes: { padding: "5px 10px", background: "#5B7553", color: "#F7F4EC", border: "none", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer" },
  confirmNo: { padding: "5px 10px", background: "transparent", color: "var(--c-8a8272-t)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer" },
  iconBtn: { width: 26, height: 26, borderRadius: 7, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  miniTicketTotal: { fontSize: 12, color: "var(--c-5c5648-t)", paddingTop: 2 },
  editingBanner: { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "var(--c-fbefd9-b)", color: "var(--c-8a611a-t)", fontSize: 12, fontWeight: 600 },
  sentBanner: { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "var(--c-e4eee1-b)", color: "var(--c-5b7553-t)", fontSize: 12, fontWeight: 600 },
  repeatBtn: { margin: "10px 16px 0", padding: "10px", background: "var(--c-fffdf8-b)", border: "1px dashed var(--c-c7bfa0-o)", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: "var(--c-8a611a-t)", cursor: "pointer" },

  catPillsWrap: { padding: "10px 16px 6px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 },
  searchInput: { padding: "10px 12px", borderRadius: 9, border: "1px solid var(--c-e4dfce-o)", fontSize: 13.5, background: "var(--c-fffdf8-b)", color: "var(--c-242019-t)" },
  catPills: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 },
  catPill: { display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 20, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 },
  catPillActive: { background: "var(--c-242019-b)", color: "#F7F4EC", border: "1px solid var(--c-242019-o)" },
  catPillBadge: { background: "#C1442D", color: "#F7F4EC", fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "1px 6px" },

  menuScroll: { flex: 1, overflowY: "auto", padding: "8px 16px 16px" },
  menuRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--c-ede7d8-o)" },
  menuItemName: { fontSize: 14, fontWeight: 600, color: "var(--c-242019-t)" },
  agotadoTag: { fontSize: 9.5, fontWeight: 700, color: "var(--c-c1442d-t)", background: "var(--c-fbe2dc-b)", padding: "1px 6px", borderRadius: 8, marginLeft: 4 },
  menuItemCat: { fontSize: 11, color: "#B3A891", marginTop: 1 },
  menuItemPrice: { fontSize: 12.5, color: "var(--c-8a8272-t)", marginTop: 2 },
  itemNoteInput: { marginTop: 4, padding: "6px 8px", fontSize: 11.5, borderRadius: 7, border: "1px solid var(--c-e4dfce-o)", width: "90%" },
  itemNoteBtn: { display: "flex", alignItems: "center", gap: 4, marginTop: 4, background: "transparent", border: "none", color: "var(--c-b98a2e-t)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 },
  stepper: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  stepBtn: { width: 28, height: 28, borderRadius: 8, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-242019-t)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  stepBtnPlus: { background: "var(--c-242019-b)", color: "#F7F4EC", border: "1px solid var(--c-242019-o)" },
  stepVal: { fontSize: 14, fontWeight: 700, color: "var(--c-242019-t)", minWidth: 16, textAlign: "center" },
  noResults: { textAlign: "center", color: "#B3A891", fontSize: 13, padding: "20px 0" },

  orderBar: { display: "flex", flexDirection: "column", gap: 8, padding: "10px 16px 14px", borderTop: "1px solid var(--c-e4dfce-o)", flexShrink: 0, background: "var(--c-f7f4ec-b)" },
  noteInput: { padding: "10px 12px", borderRadius: 9, border: "1px solid var(--c-e4dfce-o)", fontSize: 13, background: "var(--c-fffdf8-b)" },
  sendBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 14px", background: "var(--accent)", color: "#F7F4EC", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" },

  mesaGridHeader: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "16px 16px 8px" },
  vistaMesasSwitch: { display: "flex", gap: 6, padding: "0 16px 10px" },
  vistaMesasBtn: { padding: "6px 12px", borderRadius: 20, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-8a8272-t)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  vistaMesasBtnActive: { background: "var(--c-242019-b)", color: "#F7F4EC", border: "1px solid var(--c-242019-o)" },
  planoContainer: { position: "relative", width: "100%", paddingTop: "70%", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 14 },
  planoMesaTile: { position: "absolute", transform: "translate(-50%, -50%)", width: 74, height: 74, borderRadius: 14, border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, textAlign: "center", padding: 4, lineHeight: 1.2, boxShadow: "0 2px 6px rgba(0,0,0,0.08)", userSelect: "none", WebkitUserSelect: "none" },
  planoVacio: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#B3A891", fontSize: 12.5 },
  editMenuBtn: { display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: "var(--c-242019-t)", cursor: "pointer" },
  mesaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, padding: "8px 16px 16px" },
  mesaCard: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "18px 16px", background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 14, cursor: "pointer", minHeight: 100 },
  mesaCardNum: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--c-242019-t)", lineHeight: 1.15, wordBreak: "break-word" },
  mesaReorderBtn: { width: 22, height: 20, fontSize: 9, lineHeight: 1, border: "1px solid var(--c-e4dfce-o)", borderRadius: 5, background: "var(--c-fffdf8-b)", color: "var(--c-8a8272-t)", cursor: "pointer" },
  mesaCardTag: { fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  mesaCardSince: { fontSize: 10.5, color: "#B3A891" },

  addItemCard: { display: "flex", flexDirection: "column", gap: 8, padding: 14, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 12, marginBottom: 16 },
  catLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.2, color: "#B3A891", fontWeight: 700, marginBottom: 8, textTransform: "uppercase" },
  editRow: { display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: "1px solid var(--c-ede7d8-o)" },
  menuEditItemBlock: { borderBottom: "1px solid var(--c-ede7d8-o)" },
  costoPillBtn: { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "var(--c-b98a2e-t)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "0 0 8px 32px" },
  precioEditableBtn: { display: "flex", alignItems: "center", gap: 3, background: "var(--c-f1ecdd-b)", border: "none", borderRadius: 7, padding: "3px 8px", fontSize: 12.5, fontWeight: 700, color: "var(--c-242019-t)", cursor: "pointer" },
  costoEditRow: { display: "flex", alignItems: "center", gap: 6, padding: "0 0 10px 32px" },
  agotadoToggle: { width: 26, height: 26, borderRadius: 7, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "#B3A891", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  agotadoToggleActive: { background: "var(--c-fbe2dc-b)", color: "var(--c-c1442d-t)", border: "1px solid #C1442D" },
  deleteBtn: { width: 26, height: 26, borderRadius: 7, border: "none", background: "transparent", color: "var(--c-c1442d-t)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },

  kdsHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", flexShrink: 0 },
  kdsEyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 1.5, color: "#8A9B87", fontWeight: 600 },
  kdsTitle: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "#F7F4EC", marginTop: 2 },
  kdsCount: { fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--c-c1442d-t)" },
  emptyKitchen: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 },
  emptyKitchenText: { color: "#5C6670", fontSize: 13, fontWeight: 600 },
  rail: { flex: 1, overflowX: "auto", display: "flex", gap: 12, padding: "0 20px 20px", alignItems: "flex-start" },
  ticket: { background: "#282C30", borderRadius: 12, borderLeft: "4px solid #C1442D", padding: 14, minWidth: 0, maxWidth: "none", flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 },
  ticketHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ticketMesa: { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "#F7F4EC", display: "flex", alignItems: "center", gap: 6 },
  editedBadge: { fontSize: 9, fontWeight: 700, color: "var(--c-242019-t)", background: "#B98A2E", padding: "1px 6px", borderRadius: 6 },
  ticketTime: { fontSize: 12, display: "flex", alignItems: "center" },
  ticketExactTime: { fontSize: 10.5, color: "#7A8087" },
  ticketDivider: { height: 1, background: "#3A3F44", margin: "6px 0" },
  ticketLine: { display: "flex", gap: 8, padding: "3px 0" },
  ticketQty: { color: "var(--c-c1442d-t)", fontWeight: 700, fontSize: 13, minWidth: 24 },
  ticketItemName: { color: "#F7F4EC", fontSize: 13 },
  ticketItemNote: { color: "var(--c-b98a2e-t)", fontSize: 11.5, paddingLeft: 32, fontStyle: "italic" },
  ticketNote: { color: "#D9CFAE", fontSize: 12, fontStyle: "italic", marginTop: 4 },
  ticketBtn: { marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", border: "none", borderRadius: 8, color: "#F7F4EC", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
  ticketBackBtn: { marginTop: 6, width: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "#3A3F44", border: "none", borderRadius: 8, color: "#D9CFAE", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  recienListosRow: { display: "flex", gap: 8, overflowX: "auto", padding: "0 20px 12px", flexShrink: 0 },
  recienListoChip: { display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "#2F6690", color: "#F7F4EC", border: "none", borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },

  cajaTabSwitch: { display: "flex", gap: 6, padding: "0 16px 12px", flexShrink: 0, overflowX: "auto" },
  cajaTabBtn: { padding: "8px 13px", borderRadius: 20, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-8a8272-t)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  cajaTabBtnActive: { background: "var(--c-242019-b)", color: "#F7F4EC", border: "1px solid var(--c-242019-o)" },
  cajaTotalCard: { padding: 16, background: "var(--c-242019-b)", borderRadius: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 4 },
  cajaTotalLabel: { fontSize: 11.5, color: "#B3A891", fontWeight: 600 },
  cajaTotalValue: { fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "#F7F4EC" },
  cajaTotalValue2: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--c-242019-t)", display: "flex", flexDirection: "column", gap: 2, margin: "8px 0" },
  metodoBreakdownRow: { display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" },
  metodoBreakdownItem: { display: "flex", alignItems: "center", gap: 5 },
  metodoBreakdownLabel: { fontSize: 11, color: "#B3A891" },
  metodoBreakdownValue: { fontSize: 12, color: "#F7F4EC", fontWeight: 700 },
  warnBanner: { display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", background: "var(--c-fbefd9-b)", color: "var(--c-8a611a-t)", borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 12 },
  errorGuardadoBanner: { display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#C1442D", color: "#F7F4EC", fontSize: 12.5, fontWeight: 600, flexShrink: 0 },
  avisoListoBanner: { display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#5B7553", color: "#F7F4EC", fontSize: 12.5, fontWeight: 700, flexShrink: 0 },
  avisoNotifBanner: { display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "var(--c-242019-b)", color: "#D9CFAE", fontSize: 11.5, flexShrink: 0 },
  avisoNotifBtn: { padding: "6px 12px", background: "#B98A2E", color: "var(--c-242019-t)", border: "none", borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  avisoNotifCerrar: { background: "transparent", border: "none", color: "#D9CFAE", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 4px" },
  errorGuardadoCerrar: { background: "transparent", border: "none", color: "#F7F4EC", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 4px" },
  goHistLink: { textAlign: "center", padding: "12px 0", color: "var(--c-b98a2e-t)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },

  turnoBox: { display: "flex", flexDirection: "column", gap: 8, padding: 16, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 14, marginBottom: 14 },
  turnoEsperadoLabel: { fontSize: 11, fontWeight: 500, color: "var(--c-8a8272-t)", textTransform: "none" },
  margenRow: { fontSize: 11.5, color: "#8A9B87", marginTop: 4 },
  tiempoCocinaBox: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "var(--c-5c5648-t)" },
  reportePrintHeader: { marginBottom: 14 },
  reportePrintTitle: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--c-242019-t)" },
  reportePrintSub: { fontSize: 11, color: "var(--c-8a8272-t)", marginTop: 2 },
  closeCajaBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: "#C1442D", color: "#F7F4EC", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
  closeConfirmBox: { display: "flex", flexDirection: "column", gap: 8 },
  diferenciaBox: { padding: "8px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: "var(--c-5c5648-t)" },
  vueltosBox: { display: "flex", flexDirection: "column", gap: 6 },
  turnoRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--c-ede7d8-o)", gap: 8 },
  turnoRowCol: { borderBottom: "1px solid var(--c-ede7d8-o)", padding: "8px 0" },
  turnoSubRow: { fontSize: 11, color: "var(--c-8a8272-t)", marginTop: 2 },
  turnoObsRow: { fontSize: 11.5, color: "var(--c-8a611a-t)", fontStyle: "italic", marginTop: 3 },
  metodoResumenRow: { display: "flex", gap: 16, margin: "10px 0 2px", flexWrap: "wrap" },
  metodoResumenItem: { display: "flex", alignItems: "center", gap: 5 },
  metodoResumenLabel: { fontSize: 11.5, color: "var(--c-8a8272-t)" },
  metodoResumenValue: { fontSize: 12.5, color: "var(--c-242019-t)", fontWeight: 700 },
  cierreDate: { fontSize: 11.5, color: "var(--c-8a8272-t)" },
  turnoDiff: { fontSize: 12, fontWeight: 700 },
  lockedNote: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#B3A891", padding: "6px 0" },

  usuarioRow: { display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderBottom: "1px solid var(--c-ede7d8-o)" },
  usuarioRowLeft: { display: "flex", alignItems: "center", gap: 6 },
  usuarioRowActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  inlineLink: { background: "transparent", border: "none", color: "var(--c-b98a2e-t)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 },
  inlineAddLink: { background: "transparent", border: "none", color: "var(--c-b98a2e-t)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "6px 0", textAlign: "left", display: "flex", alignItems: "center", gap: 5 },
  resetPinRow: { display: "flex", gap: 8, marginTop: 4 },
  rolPillsRow: { display: "flex", gap: 6 },
  rolPillsRowSmall: { display: "flex", gap: 4 },
  rolPill: { flex: 1, padding: "9px 0", textAlign: "center", borderRadius: 8, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  rolPillSmall: { padding: "4px 8px", borderRadius: 7, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-8a8272-t)", fontSize: 10.5, fontWeight: 600, cursor: "pointer" },
  rolPillActive: { background: "var(--c-242019-b)", color: "#F7F4EC", border: "1px solid var(--c-242019-o)" },
  auditText: { fontSize: 11.5, color: "var(--c-5c5648-t)" },

  pinVisorRow: { display: "flex", padding: "2px 0" },
  pinVisorBtn: { display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "var(--c-8a8272-t)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 },
  pinVisorValue: { fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1.5, color: "var(--c-242019-t)", fontWeight: 700 },

  metodoPillsRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  metodoPill: { display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 9, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },

  mesaCuentaCard: { background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  mesaCuentaHead: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" },
  mesaCuentaLeft: { display: "flex", flexDirection: "column", gap: 3 },
  mesaCuentaNum: { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--c-242019-t)" },
  mesaCuentaSince: { fontSize: 11, color: "#B3A891" },
  enCursoTag: { fontSize: 10.5, fontWeight: 700, color: "var(--c-8a611a-t)", background: "var(--c-fbefd9-b)", padding: "2px 7px", borderRadius: 8, alignSelf: "flex-start", marginTop: 2 },
  mesaCuentaRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 },
  mesaCuentaItems: { fontSize: 11, color: "#B3A891" },
  mesaCuentaTotal: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--c-242019-t)" },
  mesaCuentaBody: { padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--c-ede7d8-o)" },
  mesaCuentaOrderRow: { display: "flex", gap: 8, fontSize: 11.5, color: "var(--c-5c5648-t)", padding: "6px 0", borderBottom: "1px solid var(--c-f1ecdd-o)" },
  mesaCuentaOrderTime: { color: "#B3A891", flexShrink: 0 },
  mesaCuentaOrderItems: { flex: 1 },
  mesaCuentaOrderTotal: { fontWeight: 700, color: "var(--c-242019-t)", flexShrink: 0 },

  subtotalRow: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "var(--c-5c5648-t)", padding: "4px 0" },
  subtotalRowFinal: { fontSize: 15, fontWeight: 700, color: "var(--c-242019-t)", borderTop: "1px solid var(--c-ede7d8-o)", marginTop: 4, paddingTop: 8 },
  descuentoBox: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" },
  propinaBox: { display: "flex", flexDirection: "column", gap: 6, padding: "6px 0" },
  propinaPillsRow: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  propinaPill: { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-5c5648-t)", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  propinaCustomInput: { width: 70, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--c-e4dfce-o)", fontSize: 12 },
  propinaCustomBtn: { padding: "7px 10px", borderRadius: 8, border: "none", background: "var(--c-242019-b)", color: "#F7F4EC", fontSize: 12, fontWeight: 600, cursor: "pointer" },

  pagosRegistradosBox: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderTop: "1px solid var(--c-ede7d8-o)", marginTop: 4 },
  pagosRegistradosLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1, color: "#B3A891", fontWeight: 700 },
  pagoRow: { display: "flex", alignItems: "center", gap: 8 },
  pagoRowMid: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
  pagoRowEtiqueta: { fontSize: 12.5, fontWeight: 600, color: "var(--c-242019-t)" },
  pagoRowItems: { fontSize: 10.5, color: "var(--c-8a8272-t)" },
  pagoRowTime: { fontSize: 10.5, color: "#B3A891" },
  pagoRowMonto: { fontSize: 12.5, fontWeight: 700, color: "var(--c-242019-t)", flexShrink: 0 },

  cobroBox: { display: "flex", flexDirection: "column", gap: 10, padding: "10px 0 0", borderTop: "1px solid var(--c-ede7d8-o)", marginTop: 6 },
  cerrarVaciaBox: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" },
  cancelarCuentaBox: { padding: "10px 0 0", borderTop: "1px solid var(--c-ede7d8-o)", marginTop: 6 },
  canceladasBox: { background: "var(--c-fbe2dc-b)", border: "1px solid var(--c-e8bbaf-o)", borderRadius: 10, padding: 10, marginBottom: 14 },
  cargandoHistBox: { display: "flex", alignItems: "center", gap: 6, background: "var(--c-f1ecdd-b)", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11.5, color: "var(--c-8a8272-t)" },
  canceladasToggle: { width: "100%", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "var(--c-8a3a2b-t)", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "left" },
  canceladaRow: { padding: "7px 0", borderTop: "1px solid var(--c-e8bbaf-o)" },
  canceladaMotivo: { fontSize: 11.5, color: "var(--c-8a3a2b-t)", marginTop: 2 },
  modoChoiceRow: { display: "flex", flexDirection: "column", gap: 8 },
  partesStepperRow: { display: "flex", alignItems: "center", gap: 8 },
  productoSplitRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--c-f1ecdd-o)" },

  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  exportLink: { display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "var(--c-b98a2e-t)", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  histRow: { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "13px 0", borderBottom: "1px solid var(--c-ede7d8-o)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" },
  histRowTitle: { fontSize: 14, fontWeight: 700, color: "var(--c-242019-t)", flex: 1 },
  histRowSub: { fontSize: 11.5, color: "#B3A891" },
  histRowTotal: { fontSize: 14, fontWeight: 700, color: "var(--c-242019-t)" },

  metodoBreakdownRowLight: { display: "flex", gap: 16, flexWrap: "wrap" },
  metodoBreakdownItemLight: { display: "flex", alignItems: "center", gap: 5 },
  metodoBreakdownLabelLight: { fontSize: 11.5, color: "var(--c-8a8272-t)" },
  metodoBreakdownValueLight: { fontSize: 12.5, color: "var(--c-242019-t)", fontWeight: 700 },

  cierreRow: { display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: "1px solid var(--c-ede7d8-o)" },
  cierrePedidos: { fontSize: 11, color: "#B3A891", flexShrink: 0 },
  cierreTotal: { fontSize: 12.5, fontWeight: 700, color: "var(--c-242019-t)", flexShrink: 0 },
  dividedTag: { color: "var(--c-b98a2e-t)", fontWeight: 600 },

  cajaProductRow: { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--c-f1ecdd-o)" },
  cajaProductQty: { color: "var(--c-c1442d-t)", fontWeight: 700, fontSize: 12.5, minWidth: 28 },
  cajaProductName: { flex: 1, fontSize: 12.5, color: "var(--c-242019-t)" },
  cajaProductSubtotal: { fontSize: 12.5, fontWeight: 700, color: "var(--c-242019-t)" },
  chartBox: { background: "var(--c-fffdf8-b)", border: "1px solid var(--c-e4dfce-o)", borderRadius: 12, padding: "10px 6px", marginBottom: 4 },

  meseroStatRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 0", borderBottom: "1px solid var(--c-ede7d8-o)" },
  meseroStatLeft: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  meseroStatSub: { fontSize: 11, color: "#B3A891" },
};

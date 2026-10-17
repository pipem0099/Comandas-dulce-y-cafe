import {
  Banknote, CreditCard, Smartphone,
} from "lucide-react";
import { MARCA_POR_DEFECTO } from "./theme.js";

// El día a día (Mesero, Cocina, Caja, Turno, Reportes de hoy/7/30 días) solo
// mantiene en vivo esta cantidad de días recientes — así la app nunca se
// vuelve más lenta con los años, sin importar cuánto historial se acumule.
// Historial y Exportar/Respaldar sí piden todo, pero solo cuando se usan.
export const VENTANA_DIAS = 35;
export const VENTANA_MS = VENTANA_DIAS * 24 * 60 * 60 * 1000;

export const DEFAULT_MESAS = [
  { id: "1", nombre: "Mesa 1" },
  { id: "2", nombre: "Mesa 2" },
  { id: "3", nombre: "Mesa 3" },
  { id: "4", nombre: "Mesa 4" },
];

export const DEFAULT_MENU = [
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
  { id: "m18", name: "Affogato", price: 9000, cat: "Bebidas Calientes" },
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

export const STATE_META = {
  pendiente: { label: "En cocina", color: "var(--c-c1442d-t)" },
  preparando: { label: "Preparando", color: "var(--c-b98a2e-t)" },
  listo: { label: "Listo para servir", color: "var(--c-2f6690-t)" },
  servido: { label: "Servido", color: "var(--c-5b7553-t)" },
  cancelado: { label: "Cancelado", color: "var(--c-9a9382-t)" },
};

export const METODO_META = {
  efectivo: { label: "Efectivo", icon: Banknote, color: "var(--c-5b7553-t)" },
  tarjeta: { label: "Tarjeta", icon: CreditCard, color: "var(--c-2f6690-t)" },
  transferencia: { label: "Transferencia", icon: Smartphone, color: "var(--c-8a611a-t)" },
};

export const PROPINA_OPCIONES = [0, 10, 15, 20];

export const ROL_LABELS = { admin: "Admin", cajero: "Cajero", mesero: "Mesero", cocina: "Cocina" };
export const ROLES_ORDEN = ["mesero", "cajero", "cocina", "admin"];

/* ---------------- App ---------------- */

export const DEFAULT_CONFIG = { businessName: "Dulce & Café", usuarios: [], auditLog: [], marca: MARCA_POR_DEFECTO };

// Versión visible en el menú de usuario
export const VERSION = "2.0";

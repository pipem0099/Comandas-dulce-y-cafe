/*
 * Plantillas de menú para arrancar rápido según el tipo de negocio.
 * Los precios son EJEMPLOS (pesos colombianos): el dueño los ajusta después en Menú y precios.
 */
export const PLANTILLAS = [
  { id: "cafeteria", nombre: "Cafetería", icono: "☕", descripcion: "Cafés, jugos, pastelería y desayunos", categorias: [
    { nombre: "Bebidas calientes", productos: [["Tinto", 2500], ["Café con leche", 4000], ["Capuchino", 6000], ["Chocolate", 5000], ["Aromática", 2500]] },
    { nombre: "Bebidas frías", productos: [["Limonada natural", 5000], ["Jugo en agua", 6000], ["Jugo en leche", 7000], ["Gaseosa", 3500], ["Agua", 2500]] },
    { nombre: "Pastelería", productos: [["Croissant", 4500], ["Pastel de pollo", 4000], ["Brownie", 5000], ["Torta (porción)", 6500]] },
    { nombre: "Desayunos", productos: [["Huevos al gusto", 9000], ["Calentado", 12000], ["Arepa con queso", 5000]] },
  ] },
  { id: "restaurante", nombre: "Restaurante", icono: "🍽️", descripcion: "Entradas, platos fuertes, sopas y postres", categorias: [
    { nombre: "Entradas", productos: [["Patacones con hogao", 8000], ["Empanadas (x3)", 6000], ["Arepa con queso", 5000]] },
    { nombre: "Platos fuertes", productos: [["Bandeja paisa", 28000], ["Pechuga a la plancha", 22000], ["Churrasco", 30000], ["Trucha", 26000], ["Almuerzo del día", 14000]] },
    { nombre: "Sopas", productos: [["Sancocho", 16000], ["Ajiaco", 18000]] },
    { nombre: "Bebidas", productos: [["Limonada", 5000], ["Jugo natural", 6000], ["Gaseosa", 3500], ["Cerveza", 5500]] },
    { nombre: "Postres", productos: [["Tres leches", 7000], ["Helado", 5000]] },
  ] },
  { id: "bar", nombre: "Bar o tienda de licores", icono: "🍹", descripcion: "Cervezas, licores, cocteles y para picar", categorias: [
    { nombre: "Cervezas", productos: [["Cerveza nacional", 4500], ["Cerveza importada", 8000], ["Michelada", 9000]] },
    { nombre: "Licores", productos: [["Aguardiente (trago)", 5000], ["Aguardiente (botella)", 70000], ["Ron (trago)", 7000], ["Whisky (trago)", 12000]] },
    { nombre: "Cocteles", productos: [["Mojito", 16000], ["Margarita", 16000], ["Piña colada", 17000]] },
    { nombre: "Sin alcohol", productos: [["Gaseosa", 3500], ["Agua", 2500], ["Jugo", 6000]] },
    { nombre: "Para picar", productos: [["Nachos", 14000], ["Alitas (x6)", 18000], ["Papas fritas", 8000]] },
  ] },
  { id: "panaderia", nombre: "Panadería o pastelería", icono: "🥐", descripcion: "Panes, tortas y bebidas calientes", categorias: [
    { nombre: "Panes", productos: [["Pan francés", 500], ["Pan de bono", 1500], ["Almojábana", 2000], ["Croissant", 4500]] },
    { nombre: "Pastelería", productos: [["Torta (porción)", 6500], ["Pastel de pollo", 4000], ["Milhoja", 5000], ["Brownie", 5000]] },
    { nombre: "Bebidas", productos: [["Tinto", 2500], ["Café con leche", 4000], ["Chocolate", 5000], ["Jugo", 5000]] },
  ] },
  { id: "heladeria", nombre: "Heladería o postres", icono: "🍨", descripcion: "Helados, waffles, malteadas y fresas con crema", categorias: [
    { nombre: "Helados", productos: [["Helado 1 bola", 4000], ["Helado 2 bolas", 7000], ["Cono", 5000], ["Copa", 12000]] },
    { nombre: "Postres", productos: [["Brownie con helado", 12000], ["Waffle", 14000], ["Fresas con crema", 10000]] },
    { nombre: "Bebidas", productos: [["Malteada", 11000], ["Limonada", 5000], ["Gaseosa", 3500]] },
  ] },
  { id: "propio", nombre: "Lo cargo yo", icono: "✏️", descripcion: "Empiezo con un solo producto de ejemplo", categorias: [
    { nombre: "General", productos: [["Producto de ejemplo", 5000]] },
  ] },
];

export const plantillaPorId = (id) => PLANTILLAS.find((p) => p.id === id) || null;

/** Productos de una plantilla en el formato del menú. Si el menú ya tiene un producto con ese nombre, no se repite. */
export function menuDePlantilla(plantilla, menuActual, nuevoId) {
  const existentes = new Set((menuActual || []).map((m) => String(m.name).trim().toLowerCase()));
  const nuevos = [];
  plantilla.categorias.forEach((c) => c.productos.forEach(([nombre, precio]) => {
    if (existentes.has(nombre.toLowerCase())) return;
    nuevos.push({ id: nuevoId(), name: nombre, price: precio, cost: 0, cat: c.nombre });
  }));
  return nuevos;
}

/** Mesas "Mesa 1…N" y, si se pide, la barra. */
export function mesasIniciales(cantidad, conBarra) {
  const mesas = Array.from({ length: Math.max(0, Math.min(60, cantidad)) }, (_, i) => ({ id: String(i + 1), nombre: `Mesa ${i + 1}` }));
  if (conBarra) mesas.push({ id: "barra", nombre: "Barra" });
  return mesas.length ? mesas : [{ id: "1", nombre: "Mesa 1" }];
}

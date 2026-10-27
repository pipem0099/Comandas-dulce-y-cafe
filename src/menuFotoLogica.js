/*
 * Lógica pura (sin pantalla, sin red) para crear el menú desde una foto o desde texto pegado.
 * La usan la app (celular) y la función del servidor, y se prueba con: npm run menu-foto:probar
 */

const limpiar = (v, max) => String(v === undefined || v === null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);

/** Sin tildes, sin mayúsculas y sin signos: para comparar nombres ("Té Chai" ≈ "te chai"). */
export const normalizarNombre = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Entiende precios escritos a la colombiana: "6.500", "12,000", "$ 4.500", "9k", "9 mil", 4500. */
export function leerPrecio(v) {
  if (typeof v === "number") return { valor: v, abreviado: false };
  let s = String(v === undefined || v === null ? "" : v).trim().toLowerCase().replace(/\$|cop|pesos|\s+/g, "");
  let abreviado = false;
  if (/mil$/.test(s)) { abreviado = true; s = s.slice(0, -3); }
  else if (/k$/.test(s)) { abreviado = true; s = s.slice(0, -1); }
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");       // 6.500 · 12,000 · 1.250.000
  else if (/^\d+[.,]\d{1,2}$/.test(s)) s = s.replace(",", ".");          // 4500,50
  else s = s.replace(/[^\d.]/g, "");
  const n = Number(s);
  return { valor: Number.isFinite(n) ? (abreviado ? n * 1000 : n) : NaN, abreviado };
}

/** Deja el resultado de la IA (o del texto) limpio y con límites: nunca se confía a ciegas en lo que llega. */
export function normalizarMenuIA(crudo, { maxProductos = 150 } = {}) {
  const lista = crudo && Array.isArray(crudo.categorias) ? crudo.categorias : [];
  const categorias = []; let total = 0;
  for (const c of lista) {
    const nombre = limpiar(c && c.nombre, 60) || "Carta";
    const productos = [];
    for (const p of (c && Array.isArray(c.productos) ? c.productos : [])) {
      if (total >= maxProductos) break;
      const n = limpiar(p && p.nombre, 80);
      if (!n) continue;
      const leido = leerPrecio(p.precio);
      let valor = leido.valor; let dudoso = !!p.dudoso || leido.abreviado;
      if (!Number.isFinite(valor) || valor <= 0 || valor > 5000000) { valor = 0; dudoso = true; }
      else if (valor < 100) { valor *= 1000; dudoso = true; } // un "9" o un "6.5" casi seguro son miles
      productos.push({ nombre: n, precio: Math.round(valor), descripcion: limpiar(p.descripcion, 100), dudoso });
      total += 1;
    }
    if (productos.length) categorias.push({ nombre, productos });
  }
  return { categorias, total };
}

/** Une las categorías de varias fotos (la misma categoría en dos páginas queda en una sola). */
export function unirCategorias(lista) {
  const mapa = new Map();
  for (const c of lista) {
    const k = normalizarNombre(c.nombre) || "carta";
    if (!mapa.has(k)) mapa.set(k, { nombre: c.nombre, productos: [] });
    mapa.get(k).productos.push(...c.productos);
  }
  return { categorias: [...mapa.values()], total: [...mapa.values()].reduce((n, c) => n + c.productos.length, 0) };
}

const PRECIO_FINAL = /(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{3,7}|\d{1,2}(?:[.,]\d)?\s*(?:k|mil))\s*$/i;
const aTitulo = (t) => (t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t) ? t.charAt(0) + t.slice(1).toLowerCase() : t);

/**
 * Interpreta texto pegado o escrito: una línea por producto con su precio al final, y las líneas sin precio
 * como títulos de categoría.   Ej.:   BEBIDAS CALIENTES / Tinto ........ 3.000 / Latte - $6.500
 */
export function parsearMenuTexto(texto) {
  const categorias = []; let actual = null; let ultimo = null;
  const lineas = String(texto || "").split(/\r?\n/).map((l) => l.replace(/\t+/g, "  ").trim()).filter(Boolean);
  const nueva = (nombre) => { actual = { nombre, productos: [] }; categorias.push(actual); return actual; };
  for (const linea of lineas) {
    const m = PRECIO_FINAL.exec(linea);
    if (m) {
      const nombre = linea.slice(0, m.index).replace(/[\s.\-–—:·_|…]+$/g, "").replace(/^\s*(?:[•*·\-–—]\s*|\d{1,2}[.)]\s+)/, "").trim();
      if (!nombre) continue;
      (actual || nueva("Carta")).productos.push({ nombre, precio: m[1], descripcion: "", dudoso: false });
      ultimo = actual.productos[actual.productos.length - 1];
    } else {
      const t = linea.replace(/[:：\-–—*#=_]+$/g, "").replace(/^[#*=\-–—_\s]+/, "").trim();
      if (!t) continue;
      if (ultimo && /^[a-záéíóúñ(]/.test(t)) { ultimo.descripcion = limpiar(`${ultimo.descripcion} ${t}`, 100); continue; } // "con leche y canela" → descripción
      if (t.length >= 2 && t.length <= 40) { nueva(aTitulo(t)); ultimo = null; }
    }
  }
  return normalizarMenuIA({ categorias });
}

/**
 * Convierte el resultado en filas editables y las compara con el menú que ya existe:
 *  · las categorías se alinean con las que ya tiene el negocio (sin importar tildes o mayúsculas)
 *  · un producto que ya existe se marca "existe" y, por defecto, NO se vuelve a agregar
 */
export function filasParaRevisar(resultado, menuActual = []) {
  const categoriasExistentes = new Map();
  menuActual.forEach((m) => { const k = normalizarNombre(m.cat); if (k && !categoriasExistentes.has(k)) categoriasExistentes.set(k, m.cat); });
  const porNombre = new Map(menuActual.map((m) => [normalizarNombre(m.name), m]));
  const vistos = new Set(); const filas = []; let n = 0;
  for (const c of resultado.categorias) {
    const cat = categoriasExistentes.get(normalizarNombre(c.nombre)) || c.nombre;
    for (const p of c.productos) {
      const clave = normalizarNombre(p.nombre);
      if (vistos.has(`${normalizarNombre(cat)}|${clave}`)) continue;
      vistos.add(`${normalizarNombre(cat)}|${clave}`);
      const actual = porNombre.get(clave);
      filas.push({ clave: `f${n++}`, nombre: p.nombre, precio: String(p.precio || ""), cat, dudoso: !!p.dudoso, existe: !!actual, precioActual: actual ? actual.price : null, incluir: !actual });
    }
  }
  return filas;
}

/** Aplica las filas elegidas al menú: agrega lo nuevo y, si se pidió, actualiza el precio de lo que ya existía. */
export function aplicarFilas(filas, menuActual, nuevoId) {
  let agregados = 0, actualizados = 0;
  const porNombre = new Map(menuActual.map((m) => [normalizarNombre(m.name), m]));
  const cambios = new Map(); const nuevos = [];
  for (const f of filas) {
    if (!f.incluir) continue;
    const nombre = limpiar(f.nombre, 80); const precio = Math.round(Number(String(f.precio).replace(/\D/g, "")) || 0);
    if (!nombre) continue;
    const previo = porNombre.get(normalizarNombre(nombre));
    if (previo) { if (precio > 0 && precio !== previo.price) { cambios.set(previo.id, precio); actualizados++; } }
    else { nuevos.push({ id: nuevoId(), name: nombre, price: precio, cost: 0, cat: limpiar(f.cat, 60) || "Carta" }); agregados++; }
  }
  const menu = [...menuActual.map((m) => (cambios.has(m.id) ? { ...m, price: cambios.get(m.id) } : m)), ...nuevos];
  return { menu, agregados, actualizados };
}

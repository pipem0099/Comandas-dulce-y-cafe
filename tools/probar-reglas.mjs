// Probador LOCAL de las reglas de seguridad (sin internet, sin Firebase).
// Simula cómo Firebase evalúa database.rules.json y prueba, por rol, lo que SÍ debe poder hacerse
// y lo que NO. Se corre antes de publicar cualquier cambio de reglas:
//
//     npm run reglas:probar                       → prueba database.rules.json (debe pasar todo)
//     node tools/probar-reglas.mjs --reglas tools/reglas-anteriores.json --informativo
//                                                  → muestra qué abusos permitían las reglas anteriores
//
// Es un SIMULADOR: reproduce las reglas del lenguaje de Firebase (child, val, exists, hasChildren…),
// pero la prueba definitiva sigue siendo la "Zona de pruebas de reglas" de la consola de Firebase.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const archivo = args.includes("--reglas") ? args[args.indexOf("--reglas") + 1] : join(aqui, "..", "database.rules.json");
const informativo = args.includes("--informativo");
const REGLAS = JSON.parse(readFileSync(archivo, "utf8")).rules;

/* ───────── árbol de datos (null = no existe; las listas se guardan como objetos con claves 0,1,2…) ───────── */
const normalizar = (v) => {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) { if (v.length === 0) return null; return Object.fromEntries(v.map((x, i) => [String(i), normalizar(x)]).filter(([, x]) => x !== null)); }
  if (typeof v === "object") { const e = Object.entries(v).map(([k, x]) => [k, normalizar(x)]).filter(([, x]) => x !== null); return e.length ? Object.fromEntries(e) : null; }
  return v;
};
const clonar = (v) => (v === null ? null : JSON.parse(JSON.stringify(v)));
const obtener = (arbol, ruta) => { let c = arbol; for (const k of ruta) { if (c === null || typeof c !== "object") return null; c = c[k] === undefined ? null : c[k]; } return c; };
const poner = (arbol, ruta, valor) => {
  if (ruta.length === 0) return normalizar(valor);
  const raiz = arbol && typeof arbol === "object" ? clonar(arbol) : {};
  let c = raiz;
  ruta.slice(0, -1).forEach((k) => { if (c[k] === undefined || c[k] === null || typeof c[k] !== "object") c[k] = {}; c = c[k]; });
  const ult = ruta[ruta.length - 1]; const nv = normalizar(valor);
  if (nv === null) delete c[ult]; else c[ult] = nv;
  return normalizar(raiz);
};

/* ───────── RuleDataSnapshot simulado ───────── */
class Snap {
  constructor(t) { this.t = t === undefined ? null : t; }
  child(p) { return new Snap(obtener(this.t, String(p).split("/"))); }
  exists() { return this.t !== null; }
  val() { if (this.t !== null && typeof this.t === "object") throw new Error("val() sobre un nodo con hijos: no lo uses en las reglas"); return this.t; }
  hasChild(p) { return this.child(p).exists(); }
  hasChildren(lista) { if (this.t === null || typeof this.t !== "object") return false; return lista ? lista.every((k) => this.t[k] !== undefined && this.t[k] !== null) : Object.keys(this.t).length > 0; }
  isString() { return typeof this.t === "string"; }
  isNumber() { return typeof this.t === "number"; }
  isBoolean() { return typeof this.t === "boolean"; }
}

const compiladas = new Map();
function evaluar(expr, { raiz, datos, nuevos, auth, vars }) {
  if (typeof expr === "boolean") return expr;
  const nombres = Object.keys(vars);
  const clave = expr + "|" + nombres.join(",");
  if (!compiladas.has(clave)) {
    const codigo = expr.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, "__v_$1");
    compiladas.set(clave, new Function("root", "data", "newData", "auth", ...nombres.map((n) => "__v_" + n), `return (${codigo});`));
  }
  try { return !!compiladas.get(clave)(new Snap(raiz), new Snap(datos), new Snap(nuevos), auth, ...nombres.map((n) => vars[n])); }
  catch (e) { throw new Error(`Regla con error: ${expr.slice(0, 90)}… → ${e.message}`); }
}
const hijoDeRegla = (nodo, clave) => {
  if (nodo[clave] && typeof nodo[clave] === "object") return [nodo[clave], null];
  const comodin = Object.keys(nodo).find((k) => k.startsWith("$"));
  return comodin ? [nodo[comodin], comodin.slice(1)] : [null, null];
};

/* ¿se puede LEER? (la regla de un nivel superior que dé permiso, lo da para todo lo de abajo) */
function puedeLeer(raiz, ruta, auth) {
  const subir = (nodo, prof, vars) => {
    if (nodo[".read"] !== undefined) {
      const dat = obtener(raiz, ruta.slice(0, prof));
      if (evaluar(nodo[".read"], { raiz, datos: dat, nuevos: dat, auth, vars })) return true;
    }
    if (prof === ruta.length) return false;
    const [hijo, v] = hijoDeRegla(nodo, ruta[prof]);
    return hijo ? subir(hijo, prof + 1, v ? { ...vars, [v]: ruta[prof] } : vars) : false;
  };
  return subir(REGLAS, 0, {});
}

/* ¿se puede ESCRIBIR en esa ruta (con el árbol nuevo ya aplicado) y los datos resultantes son válidos? */
function puedeEscribirRuta(raizVieja, raizNueva, ruta, auth) {
  const permiso = (nodo, prof, vars) => {
    if (nodo[".write"] !== undefined) {
      const dv = obtener(raizVieja, ruta.slice(0, prof)); const dn = obtener(raizNueva, ruta.slice(0, prof));
      if (evaluar(nodo[".write"], { raiz: raizVieja, datos: dv, nuevos: dn, auth, vars })) return true;
    }
    if (prof === ruta.length) return false;
    const [hijo, v] = hijoDeRegla(nodo, ruta[prof]);
    return hijo ? permiso(hijo, prof + 1, v ? { ...vars, [v]: ruta[prof] } : vars) : false;
  };
  if (!permiso(REGLAS, 0, {})) return { ok: false, motivo: "sin permiso de escritura" };

  // .validate: en la ruta escrita y en todo lo que queda debajo (no hacia arriba)
  const baja = (nodo, ruta2, vars) => {
    // nodo de regla correspondiente a `ruta2`
    let n = nodo, v = vars;
    for (const k of ruta2) { const [h, nombre] = hijoDeRegla(n, k); if (!h) return null; if (nombre) v = { ...v, [nombre]: k }; n = h; }
    return [n, v];
  };
  const validar = (nodo, ruta2, vars) => {
    const dn = obtener(raizNueva, ruta2); if (dn === null) return true;
    const dv = obtener(raizVieja, ruta2);
    if (nodo[".validate"] !== undefined && !evaluar(nodo[".validate"], { raiz: raizVieja, datos: dv, nuevos: dn, auth, vars })) return false;
    if (typeof dn === "object") for (const k of Object.keys(dn)) {
      const [h, nombre] = hijoDeRegla(nodo, k);
      if (h && !validar(h, [...ruta2, k], nombre ? { ...vars, [nombre]: k } : vars)) return false;
    }
    return true;
  };
  const base = baja(REGLAS, ruta, {});
  if (base && !validar(base[0], ruta, base[1])) return { ok: false, motivo: "datos no válidos (.validate)" };
  return { ok: true };
}

/* ───────── operaciones ───────── */
function escribir(raiz, auth, ruta, valor) {                // set()
  const nueva = poner(raiz, ruta, valor);
  const r = puedeEscribirRuta(raiz, nueva, ruta, auth);
  return { ...r, raiz: r.ok ? nueva : raiz };
}
function actualizar(raiz, auth, ruta, mapa) {               // update(): cada clave es una ruta que se evalúa por separado
  let nueva = raiz; const rutas = [];
  for (const [k, v] of Object.entries(mapa)) { const rr = [...ruta, ...k.split("/")]; nueva = poner(nueva, rr, v); rutas.push(rr); }
  for (const rr of rutas) { const r = puedeEscribirRuta(raiz, nueva, rr, auth); if (!r.ok) return { ...r, raiz }; }
  return { ok: true, raiz: nueva };
}

/* ───────── escenario: negocio con un equipo ───────── */
const perfil = (nombre, roles, extra = {}) => ({ nombre, activo: true, roles, ...extra });
const BASE = normalizar({
  perfiles: {
    dueno: perfil("Dueño", { admin: true }, { propietario: true }),
    admin2: perfil("Admin", { admin: true }),
    cajero: perfil("Caja", { cajero: true }),
    mesero: perfil("Ana", { mesero: true }),
    cocina: perfil("Cocina", { cocina: true }),
    mixto: perfil("Mixto", { mesero: true, cajero: true }),
    inactivo: { nombre: "Ex", activo: false, roles: { mesero: true } },
    sinrol: { nombre: "Sin rol", activo: true, roles: {} },
  },
  sistema: { inicializado: true, marca: { nombre: "Dulce" } },
  menu: [{ id: "m1", name: "Limonada", price: 9000 }],
  config: { businessName: "Dulce", auditLog: [{ ts: 1, accion: "x", actor: "Dueño" }] },
  orders: { o1: { id: "o1", cuentaId: "c1", mesa: "1", ts: 1000, estado: "pendiente", items: [{ id: "m1", name: "Limonada", qty: 1, price: 9000 }] } },
  cuentas: {
    c1: { id: "c1", mesa: "1", ts: 1000, estado: "abierta", mesero: "Ana" },
    c2: { id: "c2", mesa: "2", ts: 1000, estado: "pagada", pagadaTs: 2000, mesero: "Ana", pagos: [{ metodoPago: "efectivo", monto: 9000 }], descuento: { monto: 500, motivo: "x", aplicadoPor: "Dueño" } },
  },
  turnos: {
    t1: { id: "t1", aperturaTs: 1, estado: "cerrado", cierreTs: 9, baseEfectivo: 100000 },
    t2: { id: "t2", aperturaTs: 10, estado: "abierto", baseEfectivo: 100000 },
  },
  inventario: { i1: { nombre: "Harina", unidad: "kg", stock: 10, minimo: 2, costo: 3000 } },
  reservas: { r1: { id: "r1", nombre: "Felipe", personas: 6 } },
  mesas: [{ id: "1", nombre: "Mesa 1" }],
});
const U = (uid) => ({ uid });
const usuarios = { dueno: U("dueno"), admin2: U("admin2"), cajero: U("cajero"), mesero: U("mesero"), cocina: U("cocina"), mixto: U("mixto"), inactivo: U("inactivo"), sinrol: U("sinrol"), extrano: U("extrano"), anon: null };

const casos = [];
const caso = (grupo, quien, texto, op, ruta, valor, debe) => casos.push({ grupo, quien, texto, op, ruta: ruta.split("/"), valor, debe });
const SI = true, NO = false;
const cuentaAbierta = (extra = {}) => ({ id: "c1", mesa: "1", ts: 1000, estado: "abierta", mesero: "Ana", ...extra });
const pagoEf = { metodoPago: "efectivo", monto: 9000 };

/* — Lo que el trabajo normal necesita (TODO esto debe seguir funcionando) — */
caso("Uso normal", "mesero", "abre una cuenta nueva", "set", "cuentas/c9", { id: "c9", mesa: "3", ts: 5, estado: "abierta", mesero: "Ana" }, SI);
caso("Uso normal", "mesero", "junta una mesa a su cuenta", "set", "cuentas/c1", cuentaAbierta({ mesasExtra: ["2"] }), SI);
caso("Uso normal", "mesero", "fusiona dos cuentas (una queda 'fusionada')", "set", "cuentas/c1", cuentaAbierta({ estado: "fusionada", fusionadaEnId: "c3" }), SI);
caso("Uso normal", "mesero", "libera una mesa ya pagada", "set", "cuentas/c2", { ...BASE.cuentas.c2, liberada: true, liberadaTs: 5 }, SI);
caso("Uso normal", "mesero", "crea un pedido", "set", "orders/o9", { id: "o9", cuentaId: "c1", mesa: "1", ts: 6, estado: "pendiente", items: [{ id: "m1", qty: 1 }] }, SI);
caso("Uso normal", "mesero", "edita un pedido", "set", "orders/o1", { ...BASE.orders.o1, nota: "sin hielo" }, SI);
caso("Uso normal", "cocina", "marca productos listos en un pedido", "set", "orders/o1", { ...BASE.orders.o1, estado: "preparando", listos: { 0: 1 } }, SI);
caso("Uso normal", "mesero", "descuenta inventario al vender", "update", "inventario/i1", { stock: 8 }, SI);
caso("Uso normal", "mesero", "crea una reserva", "set", "reservas/r9", { id: "r9", nombre: "Ana", personas: 2 }, SI);
caso("Uso normal", "mesero", "borra una reserva", "set", "reservas/r1", null, SI);
caso("Uso normal", "cajero", "cobra una cuenta completa", "set", "cuentas/c1", cuentaAbierta({ estado: "pagada", pagadaTs: 3000, pagos: [pagoEf] }), SI);
caso("Uso normal", "cajero", "registra un pago parcial", "set", "cuentas/c1", cuentaAbierta({ pagos: [pagoEf] }), SI);
caso("Uso normal", "cajero", "cancela una cuenta", "set", "cuentas/c1", cuentaAbierta({ estado: "cancelada", canceladaTs: 4, canceladaPor: "Caja", montoCancelado: 0 }), SI);
caso("Uso normal", "cajero", "conserva el descuento ya aplicado al cobrar", "set", "cuentas/c2", { ...BASE.cuentas.c2, liberada: true }, SI);
caso("Uso normal", "cajero", "abre un turno nuevo", "set", "turnos/t9", { id: "t9", aperturaTs: 20, estado: "abierto", baseEfectivo: 1 }, SI);
caso("Uso normal", "cajero", "hace un relevo en el turno abierto", "set", "turnos/t2", { ...BASE.turnos.t2, relevo: { de: "a" } }, SI);
caso("Uso normal", "cajero", "cierra el turno abierto", "set", "turnos/t2", { ...BASE.turnos.t2, estado: "cerrado", cierreTs: 30 }, SI);
caso("Uso normal", "mixto", "mesero + cajero: cobra", "set", "cuentas/c1", cuentaAbierta({ estado: "pagada", pagadaTs: 3000, pagos: [pagoEf] }), SI);
caso("Uso normal", "admin2", "aplica un descuento", "set", "cuentas/c1", cuentaAbierta({ descuento: { monto: 1000, motivo: "cortesía", aplicadoPor: "Admin" } }), SI);
caso("Uso normal", "admin2", "edita el menú", "set", "menu", [{ id: "m1", name: "Limonada", price: 10000 }], SI);
caso("Uso normal", "admin2", "cambia la configuración y el registro de auditoría", "update", "config", { businessName: "Nuevo", auditLog: [{ ts: 2, accion: "y", actor: "Admin" }, { ts: 1, accion: "x", actor: "Dueño" }] }, SI);
caso("Uso normal", "admin2", "edita el inventario completo", "set", "inventario/i1", { ...BASE.inventario.i1, nombre: "Harina 000", movs: [{ ts: 1, tipo: "entrada", cant: 5 }] }, SI);
caso("Uso normal", "admin2", "restaura un respaldo (reemplaza cuentas y pedidos)", "set", "cuentas", BASE.cuentas, SI);
caso("Uso normal", "admin2", "restaura pedidos", "set", "orders", BASE.orders, SI);
caso("Uso normal", "admin2", "corrige un turno cerrado", "set", "turnos/t1", { ...BASE.turnos.t1, observaciones: "ok" }, SI);
caso("Uso normal", "admin2", "crea el perfil de un empleado", "set", "perfiles/nuevo", { nombre: "Nuevo", activo: true, roles: { mesero: true } }, SI);
caso("Uso normal", "admin2", "desactiva un empleado", "update", "perfiles/mesero", { activo: false }, SI);
caso("Uso normal", "dueno", "cambia los permisos de un administrador", "set", "perfiles/admin2", perfil("Admin", { admin: true, cajero: true }), SI);
caso("Uso normal", "admin2", "publica la marca para la pantalla de ingreso", "update", "sistema", { marca: { nombre: "Dulce", logo: "data:..." } }, SI);
caso("Uso normal", "admin2", "mantiene el directorio del equipo", "update", "equipo", { mesero: { uid: "mesero", nombre: "Ana", roles: { mesero: true }, activo: true } }, SI);
caso("Uso normal", "admin2", "guarda un respaldo automático", "set", "respaldos/2026-10-21", { dia: "2026-10-21", cuentas: [] }, SI);

/* — Abusos que NO deben ser posibles — */
caso("Abusos", "mesero", "marcar una cuenta como pagada", "set", "cuentas/c1", cuentaAbierta({ estado: "pagada", pagadaTs: 3000 }), NO);
caso("Abusos", "mesero", "agregar un pago a una cuenta abierta", "set", "cuentas/c1", cuentaAbierta({ pagos: [pagoEf] }), NO);
caso("Abusos", "mesero", "ponerle un descuento a una cuenta", "set", "cuentas/c1", cuentaAbierta({ descuento: { monto: 5000, motivo: "x" } }), NO);
caso("Abusos", "mesero", "ponerle propina a una cuenta", "set", "cuentas/c1", cuentaAbierta({ propina: { pct: 10, monto: 900 } }), NO);
caso("Abusos", "mesero", "bajar el monto de un pago ya registrado", "set", "cuentas/c2", { ...BASE.cuentas.c2, pagos: [{ metodoPago: "efectivo", monto: 1000 }] }, NO);
caso("Abusos", "mesero", "cambiar a tarjeta un pago en efectivo (para esconder efectivo)", "set", "cuentas/c2", { ...BASE.cuentas.c2, pagos: [{ metodoPago: "tarjeta", monto: 9000 }] }, NO);
caso("Abusos", "mesero", "quitarle el descuento o cambiarlo", "set", "cuentas/c2", { ...BASE.cuentas.c2, descuento: null }, NO);
caso("Abusos", "mesero", "cancelar una cuenta", "set", "cuentas/c1", cuentaAbierta({ estado: "cancelada", canceladaTs: 4, montoCancelado: 0 }), NO);
caso("Abusos", "mesero", "reabrir una cuenta pagada", "set", "cuentas/c2", { ...BASE.cuentas.c2, estado: "abierta" }, NO);
caso("Abusos", "mesero", "borrar una cuenta", "set", "cuentas/c1", null, NO);
caso("Abusos", "mesero", "borrar un pedido", "set", "orders/o1", null, NO);
caso("Abusos", "mesero", "escribir un pedido sin estado ni fecha", "set", "orders/o9", { id: "o9", basura: true }, NO);
caso("Abusos", "mesero", "tocar la caja (turnos)", "set", "turnos/t2", { ...BASE.turnos.t2, baseEfectivo: 0 }, NO);
caso("Abusos", "mesero", "cambiar el menú / precios", "set", "menu", [{ id: "m1", name: "Limonada", price: 1 }], NO);
caso("Abusos", "mesero", "darse permisos de administrador", "set", "perfiles/mesero", perfil("Ana", { mesero: true, admin: true }), NO);
caso("Abusos", "mesero", "darse permisos con un update parcial", "update", "perfiles/mesero", { "roles/admin": true }, NO);
caso("Abusos", "mesero", "escribir el registro de auditoría", "update", "config", { auditLog: [] }, NO);
caso("Abusos", "mesero", "modificar el inventario (fuera del stock)", "set", "inventario/i1", { ...BASE.inventario.i1, costo: 1 }, NO);
caso("Abusos", "mesero", "poner un stock que no es número", "update", "inventario/i1", { stock: "mucho" }, NO);
caso("Abusos", "mesero", "borrar un artículo del inventario", "set", "inventario/i1", null, NO);
caso("Abusos", "mesero", "borrar respaldos", "set", "respaldos", null, NO);
caso("Abusos", "cocina", "tocar cuentas", "set", "cuentas/c1", cuentaAbierta({ estado: "fusionada" }), NO);
caso("Abusos", "cocina", "tocar la caja", "set", "turnos/t2", { ...BASE.turnos.t2, baseEfectivo: 0 }, NO);
caso("Abusos", "cocina", "crear reservas", "set", "reservas/r9", { id: "r9", nombre: "x" }, NO);
caso("Abusos", "cajero", "aplicar un descuento", "set", "cuentas/c1", cuentaAbierta({ descuento: { monto: 8000, motivo: "x" } }), NO);
caso("Abusos", "cajero", "subir el descuento de una cuenta ya descontada", "set", "cuentas/c2", { ...BASE.cuentas.c2, descuento: { monto: 9000, motivo: "x" } }, NO);
caso("Abusos", "cajero", "borrar una cuenta", "set", "cuentas/c2", null, NO);
caso("Abusos", "cajero", "modificar un turno ya cerrado", "set", "turnos/t1", { ...BASE.turnos.t1, baseEfectivo: 0 }, NO);
caso("Abusos", "cajero", "borrar un turno", "set", "turnos/t2", null, NO);
caso("Abusos", "cajero", "reescribir el registro de auditoría", "update", "config", { auditLog: [] }, NO);
caso("Abusos", "cajero", "cambiar la configuración del negocio", "update", "config", { businessName: "Otro" }, NO);
caso("Abusos", "inactivo", "crear pedidos con la cuenta desactivada", "set", "orders/o9", { id: "o9", ts: 6, estado: "pendiente" }, NO);
caso("Abusos", "sinrol", "escribir pedidos sin ningún rol", "set", "orders/o9", { id: "o9", ts: 6, estado: "pendiente" }, NO);
caso("Abusos", "extrano", "escribir con una sesión sin perfil en el negocio", "set", "orders/o9", { id: "o9", ts: 6, estado: "pendiente" }, NO);
caso("Abusos", "anon", "escribir sin iniciar sesión", "set", "orders/o9", { id: "o9", ts: 6, estado: "pendiente" }, NO);
caso("Abusos", "anon", "crearse un perfil de propietario con el negocio ya iniciado", "set", "perfiles/hacker", { nombre: "H", activo: true, roles: { admin: true }, propietario: true }, NO);
caso("Abusos", "extrano", "crearse un perfil de administrador", "set", "perfiles/extrano", perfil("H", { admin: true }), NO);
caso("Abusos", "admin2", "modificar al propietario", "update", "perfiles/dueno", { activo: false }, NO);
caso("Abusos", "admin2", "darle propiedad a otra persona", "update", "perfiles/mesero", { propietario: true }, NO);
caso("Abusos", "dueno", "guardar un perfil con permisos que no son sí/no", "set", "perfiles/nuevo", { nombre: "N", activo: true, roles: { mesero: "si" } }, NO);

/* — Registro de errores de la app — */
caso("Errores de la app", "mesero", "reporta un error", "set", "errores/e1", { ts: 5, mensaje: "x is undefined", vista: "mesero", version: "2.6" }, SI);
caso("Errores de la app", "cocina", "reporta un error", "set", "errores/e2", { ts: 5, mensaje: "boom" }, SI);
caso("Errores de la app", "mesero", "NO puede reescribir un error ya reportado", "set", "errores/e1", { ts: 6, mensaje: "otro" }, NO, /* ver abajo */);
caso("Errores de la app", "mesero", "NO puede meter datos extra", "set", "errores/e3", { ts: 5, mensaje: "x", ataque: "y" }, NO);
caso("Errores de la app", "mesero", "NO puede mandar mensajes gigantes", "set", "errores/e4", { ts: 5, mensaje: "x".repeat(601) }, NO);
caso("Errores de la app", "anon", "NO se reporta sin sesión", "set", "errores/e5", { ts: 5, mensaje: "x" }, NO);
caso("Errores de la app", "admin2", "limpia los errores", "set", "errores", null, SI);

/* ───────── lecturas ───────── */
const lecturas = [
  ["anon", "sistema", SI, "la pantalla de ingreso lee el nombre y logo"],
  ["anon", "cuentas", NO, "sin sesión no se ve nada de ventas"],
  ["anon", "perfiles", NO, "sin sesión no se ve el equipo"],
  ["extrano", "cuentas", NO, "sesión sin perfil no ve ventas"],
  ["inactivo", "cuentas", NO, "cuenta desactivada no ve ventas"],
  ["mesero", "cuentas", SI, "el equipo ve las cuentas"],
  ["mesero", "perfiles", NO, "el mesero no lista al equipo"],
  ["mesero", "perfiles/mesero", SI, "pero sí su propio perfil"],
  ["mesero", "perfiles/cajero", NO, "no el de otra persona"],
  ["mesero", "respaldos", NO, "los respaldos son del administrador"],
  ["mesero", "errores", NO, "los errores solo los ve el administrador"],
  ["admin2", "perfiles", SI, "el administrador ve al equipo"],
  ["admin2", "respaldos", SI, "y los respaldos"],
  ["admin2", "errores", SI, "y los errores"],
];

/* ───────── ejecutar ───────── */
let fallas = 0, total = 0; const grupos = {};
for (const c of casos) {
  let raiz = clonar(BASE); const auth = usuarios[c.quien];
  if (c.texto.startsWith("NO puede reescribir un error")) raiz = poner(raiz, ["errores", "e1"], { ts: 1, mensaje: "viejo" });
  const r = c.op === "set" ? escribir(raiz, auth, c.ruta, c.valor) : actualizar(raiz, auth, c.ruta, c.valor);
  (grupos[c.grupo] = grupos[c.grupo] || []).push({ ...c, obtuvo: r.ok });
}
for (const [txt, lista] of Object.entries({})) void txt, lista;
for (const [g, lista] of Object.entries(grupos)) {
  console.log(`\n── ${g} ──`);
  for (const c of lista) {
    total++; const bien = c.obtuvo === c.debe; if (!bien) fallas++;
    const marca = bien ? "✔" : "✘";
    const detalle = bien ? "" : `   ← ${c.debe ? "debía poder y NO pudo" : "NO debía poder y SÍ pudo"}`;
    console.log(`${marca} ${c.quien.padEnd(8)} ${c.texto}${detalle}`);
  }
}
console.log("\n── Lecturas ──");
for (const [quien, ruta, debe, texto] of lecturas) {
  total++; const ok = puedeLeer(BASE, ruta.split("/"), usuarios[quien]); const bien = ok === debe; if (!bien) fallas++;
  console.log(`${bien ? "✔" : "✘"} ${quien.padEnd(8)} lee ${ruta.padEnd(16)} ${texto}${bien ? "" : `   ← ${debe ? "debía poder y NO pudo" : "NO debía poder y SÍ pudo"}`}`);
}
/* primer ingreso: con la base vacía, la primera persona se crea como propietaria; después ya no se puede */
{
  total += 2;
  const vacio = normalizar({});
  const dueno = { nombre: "Dueño", activo: true, roles: { admin: true }, propietario: true };
  const r1 = escribir(vacio, usuarios.extrano, ["perfiles", "extrano"], dueno);
  const r2 = escribir(r1.raiz, { uid: "otro" }, ["perfiles", "otro"], dueno);
  const b1 = r1.ok === true, b2 = r2.ok === false;
  if (!b1) fallas++; if (!b2) fallas++;
  console.log("\n── Primer ingreso ──");
  console.log(`${b1 ? "✔" : "✘"} con la base vacía, la primera persona se crea como propietaria`);
  console.log(`${b2 ? "✔" : "✘"} una segunda persona ya NO puede crearse como propietaria`);
}

console.log(`\n${total - fallas} de ${total} pruebas cumplen lo esperado.`);
if (fallas > 0 && !informativo) { console.error(`✘ ${fallas} prueba(s) fallaron: NO publiques estas reglas.`); process.exit(1); }
if (fallas > 0) console.log(`(Modo informativo) ${fallas} diferencias respecto a lo esperado.`);

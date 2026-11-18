/*
 * Base de datos EN MEMORIA con la misma interfaz que la de producción (netlify/lib/firebaseAdmin.mjs):
 *   leer(ruta) · escribir(ruta, valor) · parchar(ruta, parche) · transaccion(ruta, fn) · pedidosDeCuenta(cuentaId)
 * La usan las pruebas del servicio y las E2E. `datos` es un árbol plano de objetos.
 */
const partes = (r) => String(r).split("/").filter(Boolean);
const clon = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
export function crearDbMemoria(inicial = {}) {
  let raiz = clon(inicial);
  const get = (ps) => ps.reduce((o, k) => (o && typeof o === "object" && k in o ? o[k] : undefined), raiz);
  const set = (ps, v) => {
    if (ps.length === 0) { raiz = v ?? {}; return; }
    let o = raiz;
    ps.slice(0, -1).forEach((k) => { if (!o[k] || typeof o[k] !== "object") o[k] = {}; o = o[k]; });
    if (v === null || v === undefined) delete o[ps[ps.length - 1]]; else o[ps[ps.length - 1]] = v;
  };
  return {
    escrituras: [],
    async leer(ruta) { const v = get(partes(ruta)); return v === undefined ? null : clon(v); },
    async escribir(ruta, valor) { this.escrituras.push({ ruta, valor: clon(valor) }); set(partes(ruta), clon(valor)); },
    async parchar(ruta, parche) { this.escrituras.push({ ruta, parche: clon(parche) }); const ps = partes(ruta); const actual = get(ps) || {}; const nuevo = { ...actual }; for (const [k, v] of Object.entries(clon(parche))) { if (v === null) delete nuevo[k]; else nuevo[k] = v; } set(ps, nuevo); },
    async transaccion(ruta, fn) {
      const ps = partes(ruta); const actual = get(ps); const nuevo = fn(actual === undefined ? null : clon(actual));
      if (nuevo === undefined) return { committed: false, valor: actual === undefined ? null : clon(actual) };
      this.escrituras.push({ ruta, valor: clon(nuevo), transaccion: true }); set(ps, clon(nuevo)); return { committed: true, valor: clon(nuevo) };
    },
    async pedidosDeCuenta(cuentaId) { const o = get(["orders"]) || {}; return Object.values(o).filter((x) => x && x.cuentaId === cuentaId).map(clon); },
    volcar: () => clon(raiz),
  };
}

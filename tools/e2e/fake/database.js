// Simulación de firebase/database para las pruebas en navegador real.
//  · El "servidor" vive en localStorage (así sobrevive a recargar la página, como un servidor de verdad).
//  · Se puede cortar y devolver la conexión: window.__fakeRed.cortar() / restaurar() (el estado se guarda en localStorage).
//  · Sin conexión: los oyentes nuevos no reciben datos y las escrituras esperan hasta que vuelva (como el SDK real).
const KEY = "__fakeDB__", OFF = "__offline";
const leerDB = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } };
const guardarDB = (db) => localStorage.setItem(KEY, JSON.stringify(db));
const sinRed = () => localStorage.getItem(OFF) === "1";
const partes = (p) => String(p || "").split("/").filter(Boolean);
const getIn = (obj, ps) => ps.reduce((o, k) => (o && typeof o === "object" && k in o ? o[k] : undefined), obj);
function setIn(obj, ps, valor) {
  if (ps.length === 0) return valor;
  const o = obj && typeof obj === "object" ? obj : {};
  if (ps.length === 1) { if (valor === null || valor === undefined) delete o[ps[0]]; else o[ps[0]] = valor; return o; }
  o[ps[0]] = setIn(o[ps[0]], ps.slice(1), valor);
  if (o[ps[0]] && typeof o[ps[0]] === "object" && Object.keys(o[ps[0]]).length === 0) delete o[ps[0]];
  return o;
}
const resolver = (valorActual, v) => (v && typeof v === "object" && v[".sv"] && v[".sv"].increment !== undefined ? (Number(valorActual) || 0) + v[".sv"].increment : v);
const instantanea = (v) => ({ val: () => (v === undefined ? null : v), exists: () => v !== undefined && v !== null, key: null });

export const getDatabase = () => ({});
export const ref = (_db, path = "") => ({ path: partes(path).join("/") });
export const increment = (n) => ({ ".sv": { increment: n } });
export const orderByChild = (f) => ({ t: "orden", f });
export const startAt = (v) => ({ t: "desde", v });
export const equalTo = (v) => ({ t: "igual", v });
export const query = (r, ...restricciones) => ({ path: r.path, restricciones });

function evaluar(objetivo) {
  if (objetivo.path === ".info/connected") return !sinRed();
  if (objetivo.path === ".info/serverTimeOffset") return 0;
  let v = getIn(leerDB(), partes(objetivo.path));
  if (v === undefined) return null;
  const rs = objetivo.restricciones;
  if (rs && rs.length && v && typeof v === "object") {
    const campo = (rs.find((x) => x.t === "orden") || {}).f;
    const desde = rs.find((x) => x.t === "desde"), igual = rs.find((x) => x.t === "igual");
    const filtrado = {};
    for (const [k, hijo] of Object.entries(v)) {
      const x = hijo && typeof hijo === "object" ? hijo[campo] : undefined;
      if (desde && !(x >= desde.v)) continue;
      if (igual && x !== igual.v) continue;
      filtrado[k] = hijo;
    }
    v = Object.keys(filtrado).length ? filtrado : null;
  }
  return v;
}

const oyentes = new Set();
const enEspera = [];
function notificar() {
  oyentes.forEach((o) => {
    const esInfo = o.objetivo.path.startsWith(".info/");
    if (sinRed() && !esInfo) return;
    const v = evaluar(o.objetivo);
    const huella = JSON.stringify(v === undefined ? null : v);
    if (o.ultima === huella) return;
    o.ultima = huella;
    setTimeout(() => { try { o.cb(instantanea(v === null ? undefined : v)); } catch (e) { console.error(e); } }, 0);
  });
}
export function onValue(objetivo, cb, errCb) {
  const o = { objetivo, cb, errCb, ultima: undefined };
  oyentes.add(o);
  setTimeout(notificar, 0);
  return () => oyentes.delete(o);
}

function escribir(aplicar) {
  if (sinRed()) return new Promise((res) => enEspera.push(() => { aplicar(); res(); }));
  aplicar();
  return Promise.resolve();
}
function aplicarEn(ps, valor) { const db = leerDB(); const actual = getIn(db, ps); const nuevo = resolver(actual, valor); guardarDB(setIn(db, ps, nuevo === undefined ? null : nuevo) || {}); }
export const set = (r, valor) => escribir(() => { aplicarEn(partes(r.path), valor); notificar(); });
export const remove = (r) => escribir(() => { aplicarEn(partes(r.path), null); notificar(); });
export const update = (r, mapa) => escribir(() => { for (const [k, v] of Object.entries(mapa)) aplicarEn([...partes(r.path), ...partes(k)], v); notificar(); });
export function get(objetivo) {
  if (sinRed()) return Promise.reject(new Error("Client is offline"));
  const v = evaluar(objetivo);
  return Promise.resolve(instantanea(v === null ? undefined : v));
}
export function runTransaction(r, fn) {
  const correr = () => {
    const ps = partes(r.path);
    const actual = getIn(leerDB(), ps);
    const nuevo = fn(actual === undefined ? null : actual);
    if (nuevo === undefined) return { committed: false, snapshot: instantanea(actual) };
    aplicarEn(ps, nuevo === null ? null : nuevo); notificar();
    return { committed: true, snapshot: instantanea(nuevo === null ? undefined : nuevo) };
  };
  if (sinRed()) return new Promise((res) => enEspera.push(() => res(correr())));
  return Promise.resolve(correr());
}

if (typeof window !== "undefined") {
  window.__fakeRed = {
    cortar() { localStorage.setItem(OFF, "1"); notificar(); },
    restaurar() { localStorage.removeItem(OFF); const pend = enEspera.splice(0); pend.forEach((f) => f()); notificar(); },
    db: () => leerDB(),
    // Solo para las pruebas de facturación: el «servidor» (Node) devuelve aquí lo que escribió en su base (ramas de nivel superior).
    fusionar(ramas) { const db = leerDB(); for (const [k, v] of Object.entries(ramas || {})) { if (v === null || v === undefined) delete db[k]; else db[k] = v; } guardarDB(db); notificar(); },
  };
  window.addEventListener("storage", () => notificar());
}

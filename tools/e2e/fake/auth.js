// Simulación de firebase/auth: la sesión se guarda en localStorage (sobrevive a recargar, como la real).
const KEY = "__fakeSesion__", USUARIOS = "__fakeUsuarios__";
const leer = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; } };
const oyentes = new Set();
const usuarioObjeto = (u) => u && ({ ...u, getIdToken: async () => "token-e2e", reload: async () => {}, emailVerified: true });
const auth = { get currentUser() { return usuarioObjeto(leer()); } };
const avisar = () => oyentes.forEach((f) => setTimeout(() => f(auth.currentUser), 0));
export const getAuth = () => auth;
export const onAuthStateChanged = (_a, cb) => { oyentes.add(cb); setTimeout(() => cb(auth.currentUser), 0); return () => oyentes.delete(cb); };
export async function signInWithEmailAndPassword(_a, email, pass) {
  const us = JSON.parse(localStorage.getItem(USUARIOS) || "{}");
  const u = us[String(email).toLowerCase()];
  if (!u || u.pass !== pass) { const e = new Error("credenciales"); e.code = "auth/invalid-credential"; throw e; }
  localStorage.setItem(KEY, JSON.stringify({ uid: u.uid, email })); avisar(); return { user: auth.currentUser };
}
export async function createUserWithEmailAndPassword(_a, email, pass) {
  const us = JSON.parse(localStorage.getItem(USUARIOS) || "{}"); const uid = `u-${Object.keys(us).length + 1}`;
  us[String(email).toLowerCase()] = { uid, pass }; localStorage.setItem(USUARIOS, JSON.stringify(us));
  localStorage.setItem(KEY, JSON.stringify({ uid, email })); avisar(); return { user: auth.currentUser };
}
export const sendPasswordResetEmail = async () => {};
export const sendEmailVerification = async () => {};
export async function signOut() { localStorage.removeItem(KEY); avisar(); }

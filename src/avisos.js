// Un solo AudioContext para toda la app. iPhone/iPad dejan "suspendido" un contexto creado sin un toque del usuario
// (por eso la campana de cocina no sonaba): se crea una vez, se "despierta" con el primer toque y se reutiliza.
let ctxAudio = null;
function obtenerAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!ctxAudio || ctxAudio.state === "closed") ctxAudio = new Ctx();
  return ctxAudio;
}
/** Llamar dentro de un toque/clic del usuario: deja el audio listo para sonar después. */
export function desbloquearAudio() {
  try {
    const ctx = obtenerAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    // un silencio de 1 ms termina de "abrir" el audio en iOS
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch (e) { /* sin audio */ }
}
// Si la app vuelve a primer plano, el sistema pudo suspender el audio otra vez
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { try { if (!document.hidden && ctxAudio && ctxAudio.state === "suspended") ctxAudio.resume(); } catch (e) {} });
}

// ── Sonido de avisos (por dispositivo): se puede silenciar y elegir entre varios tonos suaves ──
export const TONOS = [
  { id: "campana", nombre: "Campana", nota: "El clásico de cocina" },
  { id: "suave", nombre: "Suave", nota: "Tres notas ascendentes" },
  { id: "gota", nombre: "Gota", nota: "Una nota corta y limpia" },
  { id: "cristal", nombre: "Cristal", nota: "Dos notas brillantes" },
  { id: "marimba", nombre: "Marimba", nota: "Cálida y redonda" },
];
const CLAVE_SONIDO = "comandas_sonido";
export function leerSonido() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_SONIDO) || "{}");
    return { silencio: !!v.silencio, tono: TONOS.some((t) => t.id === v.tono) ? v.tono : "campana" };
  } catch (e) { return { silencio: false, tono: "campana" }; }
}
export function guardarSonido(parte) {
  const nuevo = { ...leerSonido(), ...parte };
  try { localStorage.setItem(CLAVE_SONIDO, JSON.stringify(nuevo)); } catch (e) {}
  return nuevo;
}
const SECUENCIAS = {
  campana: { tipo: "sine", notas: [[880, 0], [1180, 0.16]], dur: 0.22, vol: 0.25 },
  suave: { tipo: "sine", notas: [[523.25, 0], [659.25, 0.13], [783.99, 0.26]], dur: 0.32, vol: 0.2 },
  gota: { tipo: "sine", notas: [[1046.5, 0]], dur: 0.35, vol: 0.22 },
  cristal: { tipo: "triangle", notas: [[1318.5, 0], [1760, 0.14]], dur: 0.3, vol: 0.16 },
  marimba: { tipo: "triangle", notas: [[392, 0], [587.33, 0.12]], dur: 0.4, vol: 0.28 },
};
/** Toca un tono (sirve también para escucharlo al elegirlo, aunque el sonido esté silenciado). */
export function playTono(id) {
  try {
    const ctx = obtenerAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const sec = SECUENCIAS[id] || SECUENCIAS.campana;
    const t0 = ctx.currentTime + 0.02;
    sec.notas.forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = sec.tipo;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(sec.vol, t0 + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + sec.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + sec.dur + 0.02);
    });
  } catch (e) {
    // silencioso si el navegador bloquea audio
  }
}
export function playBeep() {
  const { silencio, tono } = leerSonido();
  if (silencio) return;
  playTono(tono);
}

// Notificación del sistema (como cualquier notificación de WhatsApp) — solo
// funciona mientras el navegador siga abierto (aunque sea en segundo plano
// o en otra pestaña). Con la pantalla del celular totalmente bloqueada NO
// llega — eso necesitaría un servidor de notificaciones push aparte.
export function mostrarNotificacionSistema(titulo, cuerpo) {
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

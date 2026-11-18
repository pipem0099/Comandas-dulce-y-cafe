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

export function playBeep() {
  try {
    const ctx = obtenerAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    [880, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.16 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + i * 0.16);
      osc.stop(t0 + i * 0.16 + 0.24);
    });
  } catch (e) {
    // silencioso si el navegador bloquea audio
  }
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

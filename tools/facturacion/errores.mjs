/*
 * Clasificación de errores de emisión — función PURA (npm run fiscal:probar).
 *   red           → caída de red / timeout / 5xx. Si NADA llegó a enviarse (error «seguro») se reintenta SOLO en segundo plano.
 *                   Si pudo llegar (incierto), NO se reintenta a ciegas: podría duplicar la factura ante la DIAN; lo revisa un administrador.
 *   datos         → el proveedor/DIAN rechazó los datos (4xx: NIT o correo inválido…). Se muestra el motivo; el cajero corrige y pulsa
 *                   «Reintentar emisión» (misma llave de idempotencia = misma cuenta).
 *   credenciales  → llaves vencidas o mal escritas (401/403): lo arregla el administrador.
 *   configuracion → falta mapear catálogos, resolución, emisor…: lo arregla el administrador.
 */
export const MAX_REINTENTOS_AUTOMATICOS = 3;
export const ESPERA_REINTENTO_MS = [30_000, 120_000, 600_000]; // 30 s, 2 min, 10 min

export function clasificarError(e) {
  const x = e || {};
  const estado = Number(x.estado) || 0;
  const codigo = String(x.codigo || "");
  const incierto = x.incierto === true;
  if (codigo === "configuracion" || codigo === "sin_credenciales" || codigo === "no_soportado") return { clase: "configuracion", reintentoAutomatico: false, requiereCorreccion: false, soloAdmin: true, accion: "Un administrador debe revisar la configuración fiscal." };
  if (codigo === "credenciales" || estado === 401 || estado === 403) return { clase: "credenciales", reintentoAutomatico: false, requiereCorreccion: false, soloAdmin: true, accion: "Un administrador debe actualizar las credenciales del proveedor." };
  if (estado >= 400 && estado < 500 && estado !== 408 && estado !== 429) return { clase: "datos", reintentoAutomatico: false, requiereCorreccion: true, soloAdmin: false, accion: "Corrige los datos del cliente y pulsa «Reintentar emisión»." };
  const transitorio = estado === 0 || estado === 408 || estado === 429 || estado >= 500 || codigo === "red";
  if (transitorio || incierto) return { clase: "red", reintentoAutomatico: !incierto, requiereCorreccion: false, soloAdmin: incierto, accion: incierto ? "No sabemos si el proveedor alcanzó a emitirla: un administrador debe revisar su portal antes de reintentar." : "Se reintentará sola en unos momentos." };
  return { clase: "desconocido", reintentoAutomatico: false, requiereCorreccion: false, soloAdmin: false, accion: "Inténtalo de nuevo o avisa al administrador." };
}

/** ¿Toca reintentar solo ahora? `doc.error` guarda { clase, reintentoAutomatico }, `doc.intentosAuto` los intentos hechos y `doc.ts` la hora del último. */
export function proximoReintento(doc, ahora = Date.now()) {
  if (!doc || doc.estado !== "error" || !doc.error || doc.error.reintentoAutomatico !== true) return { reintentar: false };
  const hechos = Number(doc.intentosAuto) || 0;
  if (hechos >= MAX_REINTENTOS_AUTOMATICOS) return { reintentar: false, agotado: true };
  const cuando = (Number(doc.ts) || 0) + ESPERA_REINTENTO_MS[Math.min(hechos, ESPERA_REINTENTO_MS.length - 1)];
  return { reintentar: ahora >= cuando, cuando, intento: hechos + 1 };
}

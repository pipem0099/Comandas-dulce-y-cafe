// Operaciones sobre cuentas que avisan a la persona si algo falla. Usan transacciones (ver actualizarCuenta en firebase.js),
// así que siempre trabajan sobre la versión más reciente de la cuenta y no pisan lo que otro dispositivo acaba de hacer.
import { actualizarCuenta } from "./firebase.js";
import { avisar } from "./avisos.jsx";

export function avisarFalloGuardado() {
  avisar({ texto: "No se pudo guardar el cambio", detalle: "Revisa tu conexión e inténtalo de nuevo.", tipo: "error" });
}

/** Cambia campos de una cuenta (objeto con los campos nuevos) o aplica una función sobre la cuenta más reciente. */
export async function parcharCuenta(id, cambio) {
  const r = await actualizarCuenta(id, (c) => (typeof cambio === "function" ? cambio(c) : { ...c, ...cambio }));
  if (!r.ok) avisarFalloGuardado();
  return r;
}

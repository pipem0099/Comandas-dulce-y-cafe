/* Registro de adaptadores: `adaptadorDe("factus")` → objeto con emitirDocumento / anularDocumento / reenviarCorreo / probarConexion. */
import { simulado } from "./simulado.js";
import { factus } from "./factus.js";
import { alegra } from "./alegra.js";
import { siigo } from "./siigo.js";
import { dataico } from "./dataico.js";

export const ADAPTADORES = { simulado, factus, alegra, siigo, dataico };
export const adaptadorDe = (id) => ADAPTADORES[id] || null;
export { ErrorProveedor } from "./interfaz.js";

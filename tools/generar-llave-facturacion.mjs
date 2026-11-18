// Genera una llave maestra nueva para CLAVE_CIFRADO_FACTURACION (64 caracteres hexadecimales = 32 bytes).   npm run facturacion:llave
// Cópiala en Netlify → Site configuration → Environment variables. GUÁRDALA además en un lugar seguro (gestor de claves):
// si se pierde, las credenciales guardadas no se pueden recuperar (el administrador las vuelve a escribir y listo).
import { generarLlave } from "./facturacion/cifrado.mjs";
console.log(generarLlave());

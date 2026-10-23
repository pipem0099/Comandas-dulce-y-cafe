// Genera database.rules.json (las reglas de seguridad de Firebase) desde UN solo lugar legible.
// Uso:  npm run reglas:generar   →  luego  npm run reglas:probar   →  luego pegar en Firebase.
//
// Qué se protege (resumen):
//  · Todo exige sesión iniciada y perfil ACTIVO.
//  · Cada rol solo escribe lo suyo: el mesero no cobra ni da descuentos, la cocina no toca cuentas ni caja,
//    el cajero no da descuentos ni altera un turno ya cerrado, solo el administrador borra o corrige historial.
//  · El registro de auditoría (config/auditLog) solo lo escribe un administrador.
//  · Los errores de la app (errores/) se pueden CREAR pero no editar ni borrar (solo el administrador los lee y limpia).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const anteriores = JSON.parse(readFileSync(join(aqui, "reglas-anteriores.json"), "utf8")).rules;

/* ── piezas reutilizables ── */
const PER = "root.child('perfiles').child(auth.uid)";
const ACTIVO = `auth != null && ${PER}.child('activo').val() === true`;
const rol = (r) => `${PER}.child('roles').child('${r}').val() === true`;
const ADMIN = `${ACTIVO} && ${rol("admin")}`;
const COBRA = `${ACTIVO} && (${rol("admin")} || ${rol("cajero")})`;                                  // caja
const SALON = `${ACTIVO} && (${rol("admin")} || ${rol("mesero")} || ${rol("cajero")})`;              // sala: cuentas abiertas, reservas
const OPERA = `${ACTIVO} && (${rol("admin")} || ${rol("mesero")} || ${rol("cajero")} || ${rol("cocina")})`; // cualquier rol operativo

/* ── "este campo no cambió" (para que un rol no pueda tocar lo que no le corresponde) ── */
const igual = (ruta) => {
  const c = ruta.split("/").reduce((acc, k) => `${acc}.child('${k}')`, "");
  return `newData${c}.val() === data${c}.val()`;
};
const MAX_PAGOS = 10; // se protegen hasta 10 pagos por cuenta
const pagosIguales = Array.from({ length: MAX_PAGOS }, (_, i) => [igual(`pagos/${i}/monto`), igual(`pagos/${i}/metodoPago`)]).flat().join(" && ");
const DINERO_INTACTO = [igual("pagadaTs"), igual("montoCancelado"), igual("descuento/monto"), igual("propina/monto"), pagosIguales].join(" && ");

/* Cuentas: el administrador todo; el cajero todo menos descuentos; el resto de la sala solo cuentas ABIERTAS y sin tocar dinero. */
const CUENTA_ADMIN = ADMIN;
const CUENTA_CAJERO = `${COBRA} && newData.exists() && ${igual("descuento/monto")}`;
const CUENTA_SALA = `${SALON} && newData.exists() && (newData.child('estado').val() === data.child('estado').val() || ((!data.exists() || data.child('estado').val() === 'abierta') && (newData.child('estado').val() === 'abierta' || newData.child('estado').val() === 'fusionada'))) && ${DINERO_INTACTO}`;

const reglas = {
  rules: {
    sistema: {
      ".read": true,
      inicializado: { ".write": anteriores.sistema.inicializado[".write"], ".validate": "newData.isBoolean()" },
      marca: { ".write": ADMIN },
    },
    perfiles: {
      ".read": ADMIN,
      $uid: {
        ".read": "auth != null && auth.uid === $uid",
        ".write": anteriores.perfiles.$uid[".write"],
        activo: { ".validate": "newData.isBoolean()" },
        propietario: { ".validate": "newData.isBoolean()" },
        nombre: { ".validate": "newData.isString() && newData.val().length <= 80" },
        roles: { $r: { ".validate": "newData.isBoolean()" } },
      },
    },
    menu: { ".read": ACTIVO, ".write": ADMIN },
    mesas: { ".read": ACTIVO, ".write": ADMIN },
    // config: solo administradores (incluye el registro de auditoría: nadie más puede escribirlo ni borrarlo)
    config: { ".read": ACTIVO, ".write": ADMIN },
    orders: {
      ".read": ACTIVO,
      ".write": ADMIN, // restaurar respaldos completos
      ".indexOn": ["ts"],
      $id: {
        ".write": `${OPERA} && newData.exists()`, // nadie más que el administrador borra pedidos: se cancelan
        ".validate": "newData.hasChildren(['ts','estado']) && newData.child('ts').isNumber() && newData.child('estado').isString()",
      },
    },
    cuentas: {
      ".read": ACTIVO,
      ".write": ADMIN,
      ".indexOn": ["ts", "pagadaTs"],
      $id: {
        ".write": `(${CUENTA_ADMIN}) || (${CUENTA_CAJERO}) || (${CUENTA_SALA})`,
        ".validate": "newData.hasChildren(['mesa','ts','estado']) && newData.child('ts').isNumber() && newData.child('estado').isString()",
      },
    },
    turnos: {
      ".read": ACTIVO,
      ".write": ADMIN,
      $id: {
        // el cajero abre, hace relevos y cierra; un turno ya CERRADO solo lo corrige un administrador
        ".write": `${COBRA} && newData.exists() && (!data.exists() || data.child('estado').val() !== 'cerrado')`,
      },
    },
    inventario: {
      ".read": ACTIVO,
      ".write": ADMIN,
      $id: {
        ".validate": "newData.hasChild('nombre')",
        stock: { ".write": `${OPERA} && newData.isNumber()` }, // los pedidos descuentan stock solos
      },
    },
    reservas: { ".read": ACTIVO, ".write": SALON },
    respaldos: { ".read": ADMIN, ".write": ADMIN },
    equipo: { ".read": ACTIVO, ".write": ADMIN },
    // errores que la propia app reporta: cualquiera con sesión puede CREAR uno; nadie puede editarlos; solo el administrador los lee y limpia
    errores: {
      ".read": ADMIN,
      ".write": ADMIN,
      ".indexOn": ["ts"],
      $id: {
        ".write": `${ACTIVO} && !data.exists() && newData.exists()`,
        ".validate": "newData.hasChildren(['ts','mensaje'])",
        ts: { ".validate": "newData.isNumber()" },
        mensaje: { ".validate": "newData.isString() && newData.val().length <= 600" },
        pila: { ".validate": "newData.isString() && newData.val().length <= 2500" },
        vista: { ".validate": "newData.isString() && newData.val().length <= 80" },
        rol: { ".validate": "newData.isString() && newData.val().length <= 80" },
        version: { ".validate": "newData.isString() && newData.val().length <= 20" },
        uid: { ".validate": "newData.isString() && newData.val().length <= 80" },
        agente: { ".validate": "newData.isString() && newData.val().length <= 300" },
        $otro: { ".validate": false },
      },
    },
  },
};

const salida = join(aqui, "..", "database.rules.json");
writeFileSync(salida, JSON.stringify(reglas, null, 2) + "\n");
console.log("✔ Reglas generadas en database.rules.json (" + JSON.stringify(reglas).length + " caracteres).");

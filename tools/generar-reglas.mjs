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

/* ── opciones ──
 *  --propietario correo@dominio.com   el primer ingreso (crear al propietario) solo lo puede hacer ESE correo, ya verificado.
 *                                     Sin esto, cualquiera con sesión puede reclamar el negocio mientras no tenga propietario.
 *  --exigir-correo-verificado         todas las reglas exigen además que el correo de la sesión esté verificado.
 *                                     Actívalo SOLO cuando todo el equipo ya verificó su correo (docs/SEGURIDAD.md), o quedarán fuera.
 *  También se pueden dar por variables de entorno: PROPIETARIO_EMAIL=… y EXIGIR_CORREO_VERIFICADO=1                    */
export function generarReglas({ propietario = "", exigirVerificado = false } = {}) {
const correo = String(propietario || "").trim().toLowerCase();
if (correo && !/^[^\s'"\\@]+@[^\s'"\\@]+\.[^\s'"\\@]+$/.test(correo)) throw new Error("El correo del propietario no es válido: " + correo);
const VERIFICADO = exigirVerificado ? " && auth.token.email_verified === true" : "";

/* ── piezas reutilizables ── */
const PER = "root.child('perfiles').child(auth.uid)";
const ACTIVO = `auth != null${VERIFICADO} && ${PER}.child('activo').val() === true`;
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

/* Cuentas pendientes (deudas): leen y cobran el cajero y el administrador. El cajero puede CREAR una deuda y cobrarla (el saldo solo baja),
   pero no condonarla, no borrarla, no cambiar cuánto se debe ni a quién, y no tocar una deuda ya resuelta. Condonar y borrar: solo el administrador. */
const DEUDA_ADMIN = ADMIN;
const DEUDA_CAJERO = `${COBRA} && newData.exists() && newData.child('estado').val() !== 'condonada' && !newData.child('condonacion').exists() && (!data.exists() || (data.child('estado').val() === 'pendiente' && ${igual("total")} && ${igual("cuentaId")} && ${igual("cliente/busqueda")} && ${igual("registradaPor")} && newData.child('saldo').val() <= data.child('saldo').val()))`;

/* Pedidos: la cocina puede marcar avance y estado, pero NO cambiar qué se pidió ni a qué precio. */
const MAX_ITEMS = 40;
const itemsIguales = Array.from({ length: MAX_ITEMS }, (_, i) => ["id", "name", "qty", "price"].map((c) => igual(`items/${i}/${c}`))).flat().join(" && ");
const CAMPOS_PEDIDO_FIJOS = [igual("cuentaId"), igual("mesa"), igual("ts"), `!newData.child('items').child('${MAX_ITEMS}').exists()`, itemsIguales].join(" && ");
const PEDIDO_SALA = `${ACTIVO} && (${rol("admin")} || ${rol("mesero")} || ${rol("cajero")}) && newData.exists()`;
const PEDIDO_COCINA = `${ACTIVO} && ${rol("cocina")} && data.exists() && newData.exists() && ${CAMPOS_PEDIDO_FIJOS}`;
const LOGO_MAX = 600000; // caracteres base64 (~450 KB): el logo se reduce a 480 px antes de guardarse

/* Primer ingreso: quién puede crearse como propietario cuando todavía no existe ningún perfil */
const PRIMER_INGRESO_ANTES = "(auth != null && auth.uid === $uid && !root.child('perfiles').exists() && ";
const PRIMER_INGRESO = `(auth != null && auth.uid === $uid && !root.child('perfiles').exists() && ${correo ? `auth.token.email === '${correo}' && auth.token.email_verified === true && ` : ""}`;
const escrituraPerfil = String(anteriores.perfiles.$uid[".write"]);
if (!escrituraPerfil.startsWith(PRIMER_INGRESO_ANTES)) throw new Error("reglas-anteriores.json cambió: revisa la regla de primer ingreso.");
const ESCRIBIR_PERFIL = (PRIMER_INGRESO + escrituraPerfil.slice(PRIMER_INGRESO_ANTES.length)).replaceAll("auth != null && root.child('perfiles')", `auth != null${VERIFICADO} && root.child('perfiles')`);

const reglas = {
  rules: {
    sistema: {
      ".read": true,
      inicializado: { ".write": String(anteriores.sistema.inicializado[".write"]).replace("auth != null &&", `auth != null${VERIFICADO} &&`), ".validate": "newData.isBoolean()" },
      marca: { ".write": ADMIN, logo: { ".validate": `newData.isString() && newData.val().length <= ${LOGO_MAX}` } },
    },
    perfiles: {
      ".read": ADMIN,
      $uid: {
        ".read": "auth != null && auth.uid === $uid",
        ".write": ESCRIBIR_PERFIL,
        activo: { ".validate": "newData.isBoolean()" },
        propietario: { ".validate": "newData.isBoolean()" },
        nombre: { ".validate": "newData.isString() && newData.val().length <= 80" },
        roles: { $r: { ".validate": "newData.isBoolean()" } },
      },
    },
    menu: { ".read": ACTIVO, ".write": ADMIN },
    mesas: { ".read": ACTIVO, ".write": ADMIN },
    // config: solo administradores (incluye el registro de auditoría: nadie más puede escribirlo ni borrarlo)
    config: { ".read": ACTIVO, ".write": ADMIN, marca: { logo: { ".validate": `newData.isString() && newData.val().length <= ${LOGO_MAX}` } } },
    orders: {
      ".read": ACTIVO,
      ".write": ADMIN, // restaurar respaldos completos
      ".indexOn": ["ts"],
      $id: {
        ".write": `(${PEDIDO_SALA}) || (${PEDIDO_COCINA})`, // nadie más que el administrador borra pedidos: se cancelan
        ".validate": "newData.hasChildren(['ts','estado']) && newData.child('ts').isNumber() && newData.child('estado').isString() && newData.child('estado').val().length <= 30",
        items: { $i: {
          qty: { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 999" },
          price: { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000000" },
          name: { ".validate": "newData.isString() && newData.val().length <= 200" },
        } },
      },
    },
    cuentas: {
      ".read": ACTIVO,
      ".write": ADMIN,
      ".indexOn": ["ts", "pagadaTs"],
      $id: {
        ".write": `(${CUENTA_ADMIN}) || (${CUENTA_CAJERO}) || (${CUENTA_SALA})`,
        ".validate": "newData.hasChildren(['mesa','ts','estado']) && newData.child('ts').isNumber() && newData.child('estado').isString()",
        personas: { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 50" }, // cuántas personas comieron (ticket por persona)
      },
    },
    deudas: {
      ".read": COBRA,
      ".write": ADMIN, // restaurar respaldos
      ".indexOn": ["ts", "estado"],
      $id: {
        ".write": `(${DEUDA_ADMIN}) || (${DEUDA_CAJERO})`,
        ".validate": "newData.hasChildren(['cuentaId','ts','total','saldo','estado','cliente']) && newData.child('ts').isNumber() && newData.child('total').isNumber() && newData.child('saldo').isNumber() && newData.child('saldo').val() >= 0 && newData.child('saldo').val() <= 1000000000 && newData.child('estado').isString() && (newData.child('estado').val() === 'pendiente' || newData.child('estado').val() === 'pagada' || newData.child('estado').val() === 'condonada')",
        cliente: {
          nombre: { ".validate": "newData.isString() && newData.val().length <= 120" },
          telefono: { ".validate": "newData.isString() && newData.val().length <= 40" },
          doc: { ".validate": "newData.isString() && newData.val().length <= 40" },
          busqueda: { ".validate": "newData.isString() && newData.val().length <= 300" },
        },
        nota: { ".validate": "newData.isString() && newData.val().length <= 300" },
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
    // Bitácora de control: cada cancelación, descuento o anulación queda escrita con QUIÉN (su uid de verdad), CUÁNDO y CUÁNTO.
    // Solo se puede CREAR (nadie la edita ni la borra, ni siquiera el administrador) y solo el administrador la lee.
    auditoria: {
      ".read": ADMIN,
      ".indexOn": ["ts"],
      $id: {
        ".write": `${ACTIVO} && !data.exists() && newData.exists() && newData.child('uid').val() === auth.uid`,
        ".validate": "newData.hasChildren(['ts','uid','accion'])",
        ts: { ".validate": "newData.isNumber() && newData.val() <= now + 600000 && newData.val() >= now - 600000" },
        uid: { ".validate": "newData.isString() && newData.val().length <= 80" },
        nombre: { ".validate": "newData.isString() && newData.val().length <= 120" },
        rol: { ".validate": "newData.isString() && newData.val().length <= 80" },
        accion: { ".validate": "newData.isString() && (newData.val() === 'cancelar_cuenta' || newData.val() === 'cancelar_pedido' || newData.val() === 'descuento' || newData.val() === 'deshacer_cancelacion' || newData.val() === 'quitar_descuento' || newData.val() === 'anular_pago' || newData.val() === 'dejar_pendiente' || newData.val() === 'cobrar_pendiente' || newData.val() === 'condonar_deuda')" },
        cuentaId: { ".validate": "newData.isString() && newData.val().length <= 80" },
        mesa: { ".validate": "(newData.isString() && newData.val().length <= 80) || newData.isNumber()" },
        monto: { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000" },
        motivo: { ".validate": "newData.isString() && newData.val().length <= 300" },
        responsable: { ".validate": "newData.isString() && newData.val().length <= 120" },
        $otro: { ".validate": false },
      },
    },
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

return reglas;
}

// Solo se escribe el archivo cuando se ejecuta directamente (npm run reglas:generar), no al importarlo desde las pruebas.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const valor = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : "");
  const propietario = valor("--propietario") || process.env.PROPIETARIO_EMAIL || "";
  const exigirVerificado = args.includes("--exigir-correo-verificado") || process.env.EXIGIR_CORREO_VERIFICADO === "1";
  if (!propietario) console.warn("⚠ Sin --propietario: mientras el negocio no tenga propietario, CUALQUIER cuenta con sesión podría reclamarlo. Úsalo al instalar un negocio nuevo.");
  const reglas = generarReglas({ propietario, exigirVerificado });
  const salida = join(aqui, "..", "database.rules.json");
  writeFileSync(salida, JSON.stringify(reglas, null, 2) + "\n");
  console.log("✔ Reglas generadas en database.rules.json (" + JSON.stringify(reglas).length + " caracteres)." + (propietario ? ` Propietario: ${propietario}.` : "") + (exigirVerificado ? " Exige correo verificado." : ""));
}

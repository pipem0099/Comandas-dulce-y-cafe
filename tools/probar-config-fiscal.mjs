// Pruebas de la configuración fiscal e idempotencia (puras).   npm run fiscal:probar
import { validarAjustes, validarResolucion, estadoResolucion, validarCredenciales, enmascarar, conDefectos, configParaMotor, PROVEEDORES, ETIQUETA_TIPO_DOC, ETIQUETA_IMPUESTO } from "./facturacion/config.mjs";
import { decidirEmision, puedeAnular, referenciaProveedor, cuentaIdValido, VENTANA_PROCESANDO_MS } from "./facturacion/idempotencia.mjs";
let total = 0, fallas = 0;
const ok = (c, t, extra = "") => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}${!c && extra ? `\n    ${extra}` : ""}`); };
const RES = { prefijo: "SETT", numero: "18760000001", desde: "1", hasta: "5000", vigenciaDesde: "2026-01-01", vigenciaHasta: "2027-12-31" };

console.log("── Proveedores y campos ──");
ok(PROVEEDORES.map((p) => p.valor).join() === "simulado,factus,alegra,siigo,dataico", "los 5 proveedores pedidos, en orden");
ok(PROVEEDORES.find((p) => p.valor === "factus").campos.map((c) => c.etiqueta).join("|") === "Client ID|Client Secret|Usuario|Contraseña", "Factus: Client ID, Client Secret, Usuario, Contraseña");
ok(PROVEEDORES.find((p) => p.valor === "alegra").campos.map((c) => c.etiqueta).join("|") === "Correo electrónico|Token API", "Alegra: Correo electrónico, Token API");
ok(PROVEEDORES.find((p) => p.valor === "siigo").campos.map((c) => c.etiqueta).join("|") === "Usuario API|Access Key|ID Tipo Comprobante", "Siigo: Usuario API, Access Key, ID Tipo Comprobante");
ok(PROVEEDORES.find((p) => p.valor === "dataico").campos.map((c) => c.etiqueta).join("|") === "Auth Token|Account ID", "Dataico: Auth Token, Account ID");
ok(PROVEEDORES.find((p) => p.valor === "simulado").campos.length === 0, "Simulado no pide credenciales");
ok(ETIQUETA_TIPO_DOC.pos === "Documento Equivalente Electrónico POS" && ETIQUETA_IMPUESTO.inc.includes("INC 8%"), "etiquetas tal como las pide el producto");

console.log("\n── Ajustes ──");
let v = validarAjustes({});
ok(v.ok && v.valor.activa === false && v.valor.proveedor === "simulado" && v.valor.modo === "pruebas", "ajustes vacíos: válidos, apagados, simulado, pruebas");
ok(!validarAjustes({ ...conDefectos({}), modo: "x" }).ok && !validarAjustes({ impuesto: "z" }).ok && !validarAjustes({ proveedor: "otro" }).ok, "valores desconocidos se rechazan");
const EM = { razonSocial: "Café Dulce SAS", nit: "800197268", regimen: "responsable_iva", municipio: "Bogotá", codigoDane: "11001", correo: "facturas@cafe.co" };
v = validarAjustes({ activa: true, proveedor: "factus" }, { credencialConfigurada: false });
ok(!v.ok && v.errores.credenciales, "no se activa un proveedor real sin credenciales guardadas");
v = validarAjustes({ activa: true, proveedor: "factus", tipoDocumento: "factura", modo: "pruebas", emisor: EM }, { credencialConfigurada: true });
ok(v.ok, "con credenciales guardadas sí se activa en pruebas (la resolución es opcional en sandbox)");
v = validarAjustes({ activa: true, proveedor: "factus", tipoDocumento: "factura", modo: "produccion" }, { credencialConfigurada: true });
ok(!v.ok && v.errores["resolucion.numero"], "en producción la resolución es obligatoria");
v = validarAjustes({ activa: true, proveedor: "factus", tipoDocumento: "factura", modo: "produccion", resolucion: RES, emisor: EM }, { credencialConfigurada: true, hoy: "2026-11-16" });
ok(v.ok, "producción con resolución vigente y credenciales: válido");
v = validarAjustes({ activa: true, proveedor: "factus", tipoDocumento: "factura", modo: "produccion", resolucion: RES }, { credencialConfigurada: true, hoy: "2028-01-02" });
ok(!v.ok && v.errores["resolucion.vigenciaHasta"], "producción con resolución vencida se bloquea");
v = validarAjustes({ proveedor: "factus", tipoDocumento: "pos" });
ok(!v.ok && v.errores.tipoDocumento && validarAjustes({ proveedor: "siigo", tipoDocumento: "pos" }).ok && validarAjustes({ proveedor: "simulado", tipoDocumento: "pos" }).ok, "Documento Equivalente POS solo con proveedores que lo soportan (Siigo, Simulado)");
v = validarAjustes({ activa: true, proveedor: "simulado", modo: "produccion" });
ok(!v.ok && v.errores.proveedor, "el simulado no puede ir a producción");
v = validarAjustes({ resolucion: { ...RES, prefijo: "toolong", hasta: "0", desde: "10" } });
ok(!v.ok && v.errores["resolucion.prefijo"] && v.errores["resolucion.hasta"], "resolución: prefijo largo y rango al revés se rechazan");
ok(validarResolucion({ ...RES, vigenciaHasta: "2025-12-31" }).errores.vigenciaHasta, "vigencia final anterior a la inicial se rechaza");
ok(validarResolucion({ ...RES, vigenciaDesde: "2026-02-30" }).errores.vigenciaDesde, "una fecha imposible (30 de febrero) se rechaza");
ok(validarResolucion({ ...RES, prefijo: " sett " }).valor.prefijo === "SETT", "el prefijo se normaliza a mayúsculas");
ok(validarResolucion({}).ok, "resolución vacía y sin exigir: válida");
ok(JSON.stringify(configParaMotor({ tipoDocumento: "factura", impuesto: "iva", precios: "suman", propina: "incluir", activa: true })) === JSON.stringify({ tipoDocumento: "factura", impuesto: "iva", precios: "suman", propina: "incluir" }), "los ajustes se traducen a la configuración del motor");
v = validarAjustes({ activa: "si", emisionAutomatica: 1 });
ok(v.valor.activa === false && v.valor.emisionAutomatica === false, "los booleanos solo valen si son true de verdad");

console.log("\n── Estado de la resolución ──");
ok(estadoResolucion(RES, "2026-11-16").estado === "vigente", "vigente");
ok(estadoResolucion(RES, "2027-12-10").estado === "por_vencer" && estadoResolucion(RES, "2027-12-10").dias === 21, "por vencer (≤ 30 días) con los días que faltan");
ok(estadoResolucion(RES, "2028-01-01").estado === "vencida", "vencida");
ok(estadoResolucion(RES, "2025-12-31").estado === "aun_no_rige", "aún no rige");
ok(estadoResolucion({}, "2026-11-16").estado === "sin_configurar", "sin configurar");

console.log("\n── Credenciales ──");
let c = validarCredenciales("factus", { clientId: " id ", clientSecret: "x".repeat(40), usuario: "a@b.co", contrasena: "pw", extra: "no" });
ok(c.ok && c.valor.clientId === "id" && !("extra" in c.valor), "Factus completo: válido, limpia espacios y descarta campos ajenos");
c = validarCredenciales("factus", { clientId: "id" });
ok(!c.ok && c.errores.clientSecret && c.errores.usuario && c.errores.contrasena, "faltantes: un mensaje por cada campo");
ok(!validarCredenciales("alegra", { correo: "malo", tokenApi: "t" }).ok, "Alegra con correo inválido se rechaza");
ok(!validarCredenciales("siigo", { usuarioApi: "a@b.co", accessKey: "k", idTipoComprobante: "abc" }).ok && validarCredenciales("siigo", { usuarioApi: "a@b.co", accessKey: "k", idTipoComprobante: "5113" }).ok, "Siigo: el ID de comprobante debe ser numérico");
ok(validarCredenciales("simulado", {}).ok && !validarCredenciales("nada", {}).ok, "Simulado no pide nada; proveedor desconocido se rechaza");
ok(!validarCredenciales("dataico", { authToken: "a\nb", accountId: "1" }).ok, "saltos de línea no se aceptan (evita inyectar cabeceras HTTP)");
ok(enmascarar("alegra", { tokenApi: "abcdefghijkl1234" }) === "••••1234", "se muestra solo ••••1234");
ok(enmascarar("alegra", { tokenApi: "corto" }) === "••••", "un secreto corto no muestra ni sus últimos 4");

console.log("\n── Idempotencia ──");
const ahora = 1_000_000_000;
ok(decidirEmision(null).accion === "emitir", "sin documento: se emite");
ok(decidirEmision({ estado: "emitida" }).accion === "devolver" && decidirEmision({ estado: "anulada" }).accion === "devolver", "ya emitida o anulada: se devuelve lo que hay, sin llamar al proveedor");
ok(decidirEmision({ estado: "procesando", ts: ahora - 5000 }, { ahora }).accion === "esperar", "otro envío en curso: se espera");
ok(decidirEmision({ estado: "procesando", ts: ahora - VENTANA_PROCESANDO_MS - 1 }, { ahora }).accion === "revisar", "envío caído hace rato: se pide revisar (puede haberse emitido)");
ok(decidirEmision({ estado: "procesando", ts: ahora - VENTANA_PROCESANDO_MS - 1 }, { ahora, forzar: true, esAdmin: true }).accion === "reintentar", "solo un administrador puede forzar tras revisar");
ok(decidirEmision({ estado: "procesando", ts: ahora - VENTANA_PROCESANDO_MS - 1 }, { ahora, forzar: true, esAdmin: false }).accion === "revisar", "un cajero NO puede forzar");
ok(decidirEmision({ estado: "error", error: { incierto: false } }).accion === "reintentar", "rechazo definitivo del proveedor: se puede reintentar");
ok(decidirEmision({ estado: "error", error: { incierto: true } }).accion === "revisar", "error dudoso (red cortada tras enviar): no se reintenta a ciegas");
ok(referenciaProveedor("c-abc123") === "CMD-c-abc123" && referenciaProveedor("c-abc123") === referenciaProveedor("c-abc123"), "la referencia al proveedor es estable por cuenta");
ok(referenciaProveedor("a/b.c$d") === "CMD-abcd", "la referencia no deja pasar caracteres raros");
ok(cuentaIdValido("c-ab_12") && !cuentaIdValido("../x") && !cuentaIdValido("a/b") && !cuentaIdValido("") && !cuentaIdValido(5), "solo ids de cuenta seguros entran a una ruta de Firebase");
ok(puedeAnular({ estado: "emitida" }, { esAdmin: true, motivo: "Error de digitación" }).ok, "admin anula una emitida con motivo");
ok(puedeAnular({ estado: "emitida" }, { esAdmin: false, motivo: "Error de digitación" }).codigo === "permiso", "cajero NO anula");
ok(puedeAnular({ estado: "emitida" }, { esAdmin: true, motivo: "  " }).codigo === "motivo" && puedeAnular({ estado: "emitida" }, { esAdmin: true, motivo: "abc" }).codigo === "motivo", "sin motivo (o muy corto) no se anula");
ok(puedeAnular({ estado: "error" }, { esAdmin: true, motivo: "Error de digitación" }).codigo === "estado" && puedeAnular({ estado: "anulada" }, { esAdmin: true, motivo: "Error de digitación" }).codigo === "estado" && puedeAnular(null, { esAdmin: true, motivo: "Error de digitación" }).codigo === "estado", "solo se anula lo emitido");

// v23: emisor, UVT y propina con mapeo
v = validarAjustes({ activa: true, proveedor: "factus", tipoDocumento: "factura" }, { credencialConfigurada: true });
ok(!v.ok && v.errores["emisor.nit"] && v.errores["emisor.razonSocial"], "para activar un proveedor real se exigen los datos del emisor");
v = validarAjustes({ activa: true, proveedor: "simulado", tipoDocumento: "pos" });
ok(v.ok, "el simulado se activa sin datos del emisor (demos)");
v = validarAjustes({ proveedor: "factus", tipoDocumento: "factura", emisor: { ...EM, nit: "800197268-9" } });
ok(!v.ok && /es 4/.test(v.errores["emisor.nit"]), "NIT del emisor con DV equivocado se rechaza aunque no esté activa");
v = validarAjustes({ proveedor: "factus", tipoDocumento: "factura", emisor: EM });
ok(v.ok && v.valor.emisor.dv === "4" && v.valor.valorUvt === 52374, "guarda el DV calculado y el UVT por defecto");
ok(!validarAjustes({ valorUvt: 12 }).ok && validarAjustes({ valorUvt: 12 }).errores.valorUvt, "el UVT debe ser un valor razonable");
v = validarAjustes({ activa: true, proveedor: "factus", tipoDocumento: "factura", propina: "incluir", emisor: EM }, { credencialConfigurada: true, propinaMapeada: false });
ok(!v.ok && v.errores.propina, "propina «incluir» sin ítem mapeado no deja activar");
ok(validarAjustes({ activa: true, proveedor: "factus", tipoDocumento: "factura", propina: "incluir", emisor: EM }, { credencialConfigurada: true, propinaMapeada: true }).ok, "propina «incluir» con ítem mapeado sí");
ok(conDefectos({}).propina === "excluir", "la propina viene EXCLUIDA por defecto");

console.log(`\n${total - fallas}/${total} pruebas correctas.`);
if (fallas > 0) { console.error(`✘ ${fallas} prueba(s) fallaron`); process.exit(1); }

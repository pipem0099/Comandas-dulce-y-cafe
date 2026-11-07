# Reglas de arquitectura (para no repetir errores)

## Dinero: nunca se guarda una cuenta "entera" desde una copia vieja
Dos dispositivos pueden tocar la misma cuenta a la vez (caja y administración, dos pestañas). Si cada uno guarda la cuenta completa, **el último borra lo del primero** (un pago, una propina, un descuento).
- Para cambiar campos: `parcharCuenta(id, { campo: valor })` o `parcharCuenta(id, (cuentaActual) => nuevaCuenta)` (`src/cuentasOps.js`).
- Propina en "Por producto": `src/propinaSplit.js` (puro). Modo **proporcional** (propina × lo que consumió ÷ subtotal) o **equitativa** (propina ÷ N pagadores); la última persona absorbe el redondeo. El modo y N se guardan en la cuenta (`propinaModo`, `propinaPagadores`) junto con el primer pago (`aplicarPagos(..., { extra })`) y cada pago guarda su `propinaMonto`.
- Cuentas pendientes (saldos deudores): la cuenta pasa a `estado: "pendiente"` (la mesa queda libre porque la sala solo ocupa mesas con cuentas `abierta`) y se crea `deudas/{d-cuentaId}` con el cliente, el saldo, copia de lo consumido y los cobros. Lógica pura en `src/deudas.js`; escrituras en `src/deudasOps.js`; pantalla `Caja → Pendientes` (`src/pantallas/Pendientes.jsx`). Los cobros tardíos entran a `cuenta.pagos` con la hora de HOY, así el arqueo del turno actual los suma sin tocar turnos ya cerrados. Cajero: crea y cobra (el saldo solo baja). Administrador: además condona (con motivo), ve las resueltas y descarga el Excel. La app solo descarga las deudas pendientes (`subscribeCollectionWhere`, índice `estado`).
- Carga diferida (`src/cargaDiferida.js`): cada pantalla (Mesero, Cocina, Caja, Reservas, Menú, Mesas, Equipo, Respaldos, Análisis y las pestañas Inventario, Historial y Reportes) se descarga solo al usarse, y las librerías grandes van en archivos aparte (`vendor-react`, `vendor-firebase`, `vendor-graficas`; el Excel `xlsx` se baja solo al exportar). La descarga inicial pasó de ~480 KB a ~190 KB comprimidos más la pantalla del rol. Si una pantalla no se puede bajar (señal mala o versión nueva publicada), se reintenta una vez y la app se recarga una sola vez.
- Modo sin conexión (`public/sw.js` + `vite.config.js`): el build genera `precache.json` con todos los archivos de la app y el service worker los guarda (la "cáscara"). Abrir la app: red primero (3 s máximo) y, si no hay internet, la copia guardada. Los archivos con hash salen de la copia. **Los datos nunca se guardan en el service worker**: pedidos, cuentas y turnos viajan siempre directo a Firebase, que conserva lo pendiente y lo sube al volver la conexión. Al publicar una versión nueva se instala sola y borra la anterior. `/sw.js`, `/precache.json` e `/index.html` deben servirse sin caché (ya está en `netlify.toml`).
- Diseño: los colores de chips, botones secundarios y el texto sobre el color de marca salen de variables (`theme.js`); el texto del botón activo se elige solo (blanco u oscuro) para que siempre tenga contraste de 4,5 o más (`src/contraste.js`). Los botones pequeños llevan la clase `toque44` (área de toque de 44 px sin cambiar su tamaño visual).
- Para cobrar: `actualizarCuenta(id, (actual) => aplicarPagos(actual, …))` (`src/cobros.js`). Es una **transacción**: trabaja sobre la versión más reciente del servidor, suma el pago al de otro dispositivo y rechaza cobrar una cuenta que ya está pagada.
- Deshacer un cobro quita **solo** los pagos recién hechos (`deshacerPagos`), no restaura una copia vieja.
- `npm run revisar` falla si alguien vuelve a escribir `saveCuenta({ ...cuenta, … })`.
- Las cuentas nuevas de mesa usan un id previsible (`idCuentaNueva`: mesa + día + número): dos meseros abriendo la misma mesa a la vez generan el mismo id y queda UNA cuenta.

## Pedido + inventario en una sola escritura
`saveOrder(pedido, deltaStock)` guarda el pedido y mueve el inventario juntos (`guardarPedidoYStock`): o pasan los dos o ninguno.
(Pendiente: cancelar una cuenta completa todavía devuelve el inventario en un segundo paso.)

## Lecturas fallidas
Si una lectura de menú, mesas o configuración falla, la pantalla muestra los datos de fábrica y **se bloquea guardar encima** (`lecturasFallidas` en `firebase.js`), para no pisar los datos reales.

## Bitácora de control
`registrarAuditoria` firma cada cancelación, descuento, pedido cancelado y pago/cancelación deshecho con el uid real y la hora del **servidor** (no la del celular). Reglas: solo crear, nadie edita ni borra, solo el administrador lee.

## Rendimiento
- `cuentaOrders` usa un índice por cuenta (`src/dinero.js`): sumar miles de cuentas ya no es cuadrático.
- La app se repinta cada 15 s (antes cada segundo).
- "Análisis y control" carga solo los últimos 120 días, no todo el historial.

## Pruebas y revisiones (`npm run verificar`)
`reglas:probar` · `menu-foto:probar` · `seguridad:probar` · `analitica:probar` · `cobros:probar` · `deudas:probar` · `diseno:probar` · `offline:probar` · `revisar` (revisión estática sin dependencias) · `vite build`.

## Pendiente a propósito (necesita internet, consola de Google o un navegador para probarlo)
App Check y restricción de la API key (consola de Google) · migrar `xlsx` (requiere regenerar `package-lock.json`) · pasar la CSP de "solo reportar" a "aplicar" (probar antes en un navegador) · partir los componentes grandes (`Mesero.jsx`, `CuentaMesa.jsx`, `Turno.jsx`, `inventario.jsx`) · cancelar cuenta con inventario atómico.

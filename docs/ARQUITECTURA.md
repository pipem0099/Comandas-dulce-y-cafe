# Reglas de arquitectura (para no repetir errores)

## Dinero: nunca se guarda una cuenta "entera" desde una copia vieja
Dos dispositivos pueden tocar la misma cuenta a la vez (caja y administración, dos pestañas). Si cada uno guarda la cuenta completa, **el último borra lo del primero** (un pago, una propina, un descuento).
- Para cambiar campos: `parcharCuenta(id, { campo: valor })` o `parcharCuenta(id, (cuentaActual) => nuevaCuenta)` (`src/cuentasOps.js`).
- Propina en "Por producto": `src/propinaSplit.js` (puro). Modo **proporcional** (propina × lo que consumió ÷ subtotal) o **equitativa** (propina ÷ N pagadores); la última persona absorbe el redondeo. El modo y N se guardan en la cuenta (`propinaModo`, `propinaPagadores`) junto con el primer pago (`aplicarPagos(..., { extra })`) y cada pago guarda su `propinaMonto`.
- Cuentas pendientes (saldos deudores): la cuenta pasa a `estado: "pendiente"` (la mesa queda libre porque la sala solo ocupa mesas con cuentas `abierta`) y se crea `deudas/{d-cuentaId}` con el cliente, el saldo, copia de lo consumido y los cobros. Lógica pura en `src/deudas.js`; escrituras en `src/deudasOps.js`; pantalla `Caja → Pendientes` (`src/pantallas/Pendientes.jsx`). Los cobros tardíos entran a `cuenta.pagos` con la hora de HOY, así el arqueo del turno actual los suma sin tocar turnos ya cerrados. Cajero: crea y cobra (el saldo solo baja). Administrador: además condona (con motivo), ve las resueltas y descarga el Excel. La app solo descarga las deudas pendientes (`subscribeCollectionWhere`, índice `estado`).
- Carga diferida (`src/cargaDiferida.js`): cada pantalla (Mesero, Cocina, Caja, Reservas, Menú, Mesas, Equipo, Respaldos, Análisis y las pestañas Inventario, Historial y Reportes) se descarga solo al usarse, y las librerías grandes van en archivos aparte (`vendor-react`, `vendor-firebase`, `vendor-graficas`; el Excel `xlsx` se baja solo al exportar). La descarga inicial pasó de ~480 KB a ~190 KB comprimidos más la pantalla del rol. Si una pantalla no se puede bajar (señal mala o versión nueva publicada), se reintenta una vez y la app se recarga una sola vez.
- Modo sin conexión (`public/sw.js` + `vite.config.js`): el build genera `precache.json` con todos los archivos de la app y el service worker los guarda (la "cáscara"). Abrir la app: red primero (3 s máximo) y, si no hay internet, la copia guardada. Los archivos con hash salen de la copia. **Los datos nunca se guardan en el service worker**: pedidos, cuentas y turnos viajan siempre directo a Firebase, que conserva lo pendiente y lo sube al volver la conexión. Al publicar una versión nueva se instala sola y borra la anterior. `/sw.js`, `/precache.json` e `/index.html` deben servirse sin caché (ya está en `netlify.toml`).
- Diseño: los colores de chips, botones secundarios y el texto sobre el color de marca salen de variables (`theme.js`); el texto del botón activo se elige solo (blanco u oscuro) para que siempre tenga contraste de 4,5 o más (`src/contraste.js`). Los botones pequeños llevan la clase `toque44` (área de toque de 44 px sin cambiar su tamaño visual).
- Campos propios (`src/componentes/Campos.jsx`): `Selector` (lista), `CampoFecha` (calendario) y `CampoHora` reemplazan los del sistema (Android/iOS), que sacaban a la persona de la app y se veían distintos en cada teléfono. No debe volver a usarse `<select>`, `type="date"` ni `type="time"`. Lógica pura en `src/fechas.js` y `src/horas.js` (horas en formato «4:00 – 5:00 p. m.» y orden que empieza cuando abre el negocio).
- Chips y pestañas: el estado ACTIVO es un tinte suave del color de marca (`--chip-on-bg`, `--chip-on-fg`, `--chip-on-line`), calculado en `theme.js` con `fichaActiva()` para que el texto siempre tenga contraste de 4,5 o más en los 9 colores y en claro y oscuro. Los botones secundarios (`--btn2-bg`) son más claros que la tarjeta donde se apoyan (nunca más oscuros: se verían hundidos).
- Trabajo sin conexión (`src/sinConexion/`, integrado en `firebase.js`): copia local (IndexedDB) de lo último que mandó el servidor, para abrir la app sin internet; bandeja de cambios pendientes (pedidos, cobros, turnos...) que se guardan en el equipo, se ven encima de la copia y se envían solos y en orden al volver la conexión. Las cuentas y deudas se **fusionan** con lo que pasó en el servidor (`fusion.js`): los pagos de dos dispositivos se unen sin repetir y un choque grave (la cuenta ya se cerró desde otro dispositivo) NO se aplica y queda en un aviso para que un administrador lo revise. Al cerrar sesión se borra la copia de datos pero no los cambios pendientes. Límite: sin internet los dispositivos no se ven entre sí (la cocina no recibe el pedido hasta que vuelva la conexión). El respaldo diario y la marca de inicialización no corren sin conexión (se guardaría un respaldo vacío).
- Impresión térmica (`src/termica/`): generador ESC/POS con tildes (CP858), tickets de cuenta y de cocina armados con los mismos datos del comprobante, y conexión por Bluetooth (BLE), USB, puerto serie o RawBT (Android). La impresora se guarda en cada equipo (Mi cuenta → Impresora de tickets). Impresión automática de pedidos nuevos en el equipo de la cocina. **No se ha probado con una impresora física**: usar «Probar impresión» al configurarla.
- Datos para factura (`src/facturacion/`): captura y valida (con dígito de verificación del NIT) los datos del cliente, los muestra en el comprobante y los exporta en la hoja «Para facturación» del Excel. **No emite factura electrónica válida ante la DIAN**: eso exige un proveedor tecnológico autorizado, que no está conectado.
- Pruebas en navegador real (`tools/e2e/`): `npm run e2e` construye una versión de prueba con un Firebase simulado (que guarda entre recargas y permite cortar la conexión) y la recorre en Chromium en celular, tablet y computador: arranque, pedidos, **trabajo sin internet con recarga y reconexión**, calendario propio, contraste de todos los botones y desbordes de pantalla. Requiere Chromium (`npx playwright-core install chromium`, o `CHROME_PATH` con la ruta de tu Chrome).
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
_Además de los scripts de `tools/`, `npm run e2e` construye la app (más una segunda versión) y la prueba en un navegador real con Firebase simulado: `tools/e2e/e2e.mjs`._
`reglas:probar` · `menu-foto:probar` · `seguridad:probar` · `analitica:probar` · `cobros:probar` · `deudas:probar` · `diseno:probar` · `offline:probar` · `sinconexion:probar` · `termica:probar` · `facturacion:probar` · `accesibilidad:revisar` · `humo:probar` (pantallas en navegador simulado) · `revisar` (revisión estática sin dependencias) · `vite build`.

## Aviso «Hay una versión nueva» (nunca recarga solo)
- Cada compilación lleva un `buildId` (hash del contenido de `src/`, `public/` e `index.html`, calculado en `vite.config.js`). Se mete en el paquete (`src/buildId.js`) y se copia a `/precache.json` junto con `version` y `archivos`.
- `src/versionApp.js` (lógica pura) compara el `buildId` que corre con el de `/precache.json` (pedido sin caché) al iniciar, al volver el foco a la pestaña, al recuperar internet y cada 5 min (mínimo 15 s entre revisiones). `src/componentes/AvisoVersion.jsx` muestra «Hay una versión nueva» · «Actualizar» solo si hay versión nueva **y** `navigator.onLine`. Sin amarillo (es de alertas).
- `public/sw.js`: una versión nueva del service worker **espera** (no hace `skipWaiting` sola) cuando ya había uno activo; solo toma el control al recibir `{ tipo: "SALTAR_ESPERA" }`. En la primera instalación sí se activa de inmediato.
- `src/actualizarApp.js`: al pulsar «Actualizar» busca el service worker nuevo, espera a que termine de guardarse, le manda `SALTAR_ESPERA`, espera `controllerchange` y recarga. Los pendientes sin internet viven en IndexedDB (`src/sinConexion/`), que la recarga no toca.
- Pruebas: `npm run version:probar` (lógica), `probar-offline` (service worker) y E2E «Versión nueva» (`tools/e2e/segunda-version.mjs` crea `dist-e2e-v2`, otra versión publicada; el servidor de pruebas cambia de carpeta con `cambiarCarpeta`).

## Comanda impresa desde el equipo del mesero
- Opción **local** de cada equipo (`termica:config.imprimirAlEnviar`, en «Impresora de tickets»). Si está activa y hay impresora, al enviar un pedido (o modificarlo) sale la comanda, con o sin internet.
- Cada pedido es una **ronda** (`numeroRonda`). Eventos de impresión: `n` (comanda del pedido; solo sus productos nuevos, con «Ronda N» desde la 2) y `aj-<hora>` (ticket de **ajuste**: `+` lo agregado, `-` lo cancelado, calculado por `diferenciasPedido`).
- Datos nuevos en `orders/$id` (validados en `tools/generar-reglas.mjs`): `impresiones/{clave}` = `{ ts, por, equipo? }` y `ultimoAjuste` = `{ ts, agregados[], cancelados[], notas?, notaGeneral? }`.
- **Deduplicación**: la marca se anota **solo cuando la impresora confirmó** (`crearServicioComandas`). Las marcas llevan un *ámbito*: `n` = se imprimió todo el pedido (nadie más lo repite); `n_<estación>-<piso>` = esa pantalla de Cocina imprimió su parte (las demás siguen con la suya). Cocina espera 6 s desde que ve el pedido (el mesero alcanza a imprimir y marcar) y vuelve a mirar el pedido justo antes de imprimir. Si la impresora falla, el pedido se envía igual y sale una alerta con «Reintentar»; «Reimprimir comanda» (detalle del pedido) no toca las marcas.
- La lógica está en `src/termica/comandaMesero.js` (pura, probada con `npm run comanda:probar`); `src/termica/imprimirComandas.js` la une a la impresora real y a Firebase.

## Pisos, varias cajas y destino de cada pedido
Ver `docs/PISOS-Y-CAJAS.md` (datos: `config.pisos/planos/cajas`, `mesa.piso`, `turno.cajaId`, `pago.cajaId`, `item.estacion/pisoPrep/pisoEntrega`).

## Facturación electrónica (DIAN)
Multi-proveedor (Simulado, Factus, Alegra, Siigo, Dataico) y configurable por el administrador desde la app. Guía completa: `docs/FACTURACION_DIAN.md`.
- Lógica pura en `tools/facturacion/` (motor tributario en centavos enteros, configuración, cifrado AES-256-GCM, idempotencia, servicio) con pruebas Node (`npm run fiscal:probar`). Adaptadores en `src/facturacion/adaptadores/`.
- Los montos los recalcula el servidor (`netlify/functions/facturacion.mjs`); el navegador nunca manda cifras ni lee secretos. Un documento por cuenta (`facturacion/documentos/{cuentaId}`), reservado con transacción: **nunca dos facturas por cuenta**.
- Las credenciales viven cifradas en `facturacionSecretos/{pruebas|produccion}` (reglas: ningún cliente web lee ni escribe); catálogo sincronizado y mapeo de conceptos por ambiente en `facturacion/catalogo/{modo}` y `facturacion/mapeo/{modo}` (solo los escribe la función; cero IDs fijos en el código). Ver `tools/probar-reglas.mjs`.
- v23: emisor con DV módulo 11, alertas de resolución/folios y tope POS de 5 UVT (`tools/facturacion/{emisor,alertas,mapeo,errores}.mjs`), tirilla térmica con CUFE y QR (`src/termica/tickets.js`), Nota Crédito que revierte la caja (`src/facturacion/reversos.js`).
- Sin internet, la factura entra en la bandeja (`tipo: "facturacion"`) y se envía sola al volver, sin duplicar.
- Anular (Nota Crédito) es solo administrador, con motivo, y queda en la bitácora.

## Pendiente a propósito (necesita internet, consola de Google o un navegador para probarlo)
App Check y restricción de la API key (consola de Google) · migrar `xlsx` (requiere regenerar `package-lock.json`) · pasar la CSP de "solo reportar" a "aplicar" (probar antes en un navegador) · partir los componentes grandes (`Mesero.jsx`, `CuentaMesa.jsx`, `Turno.jsx`, `inventario.jsx`) · cancelar cuenta con inventario atómico.

# Facturación electrónica (DIAN) en Comandas

Comandas **no** habla directamente con la DIAN: arma el documento y se lo entrega a un **proveedor tecnológico autorizado** (Factus, Alegra, Siigo o Dataico), que lo firma, lo valida y lo envía. Todo se configura desde la app (menú «Mi cuenta» → **Facturación electrónica**, solo administrador); no hay que cambiar código ni variables por cada restaurante.

> **Estado honesto de la integración.** El proveedor **Simulado** está probado de punta a punta (sirve para demos y capacitación; **no tiene validez ante la DIAN**). Los adaptadores de Factus, Alegra, Siigo y Dataico están escritos con la documentación pública y probados solo contra respuestas simuladas: **todavía no se han probado contra el sandbox real de cada proveedor.** Antes de facturar de verdad, haz la «Primera prueba» de la sección 1.5 con tu cuenta de pruebas. Los puntos dudosos están marcados `VERIFICAR` en `src/facturacion/adaptadores/*.js`.

---

## 1. Guía para el dueño del restaurante

### 1.1 Qué necesitas antes de empezar
1. Estar **habilitado como facturador electrónico** ante la DIAN (lo hace tu contador o el propio proveedor).
2. Una cuenta con **un** proveedor (puedes cambiar después). Pide siempre acceso a su **ambiente de pruebas (sandbox)**.
3. La **resolución de facturación** de la DIAN (prefijo, número de resolución, rango autorizado y fechas de vigencia).
4. Tu contador a mano para los 4 selectores tributarios (sección 1.3).

### 1.2 Dónde conseguir las llaves de cada proveedor
Los nombres exactos de los menús pueden cambiar; si no los encuentras, escríbele al soporte del proveedor pidiendo «credenciales de API».

| Proveedor | Qué escribes en Comandas | Dónde se consigue |
|---|---|---|
| **Factus** | Client ID, Client Secret, Usuario, Contraseña | Panel de Factus → sección de API / aplicaciones (te dan Client ID y Client Secret). El usuario y la contraseña son los de tu cuenta de Factus. Pide el acceso al sandbox (`api-sandbox.factus.com.co`). |
| **Alegra** | Correo electrónico, Token API | Alegra → Configuración → **Integraciones / API**. El correo es el de tu usuario y el token es el que genera esa pantalla. |
| **Siigo** | Usuario API, Access Key, ID Tipo Comprobante | Siigo Nube → Configuración → **Integraciones / API** (usuario de API y *Access Key*). El *ID Tipo Comprobante* es el número de tu comprobante de factura de venta (o de documento equivalente POS) en Siigo; pídeselo a tu contador o a soporte de Siigo. |
| **Dataico** | Auth Token, Account ID | Dataico → Configuración → **API / Integraciones** (el *Auth Token*) y el identificador de tu cuenta. |
| **Simulado** | nada | Solo para probar la app y capacitar al equipo. |

Notas por proveedor (importantes):
- **Ya no hay IDs «quemados».** Tras guardar las credenciales, la app **sincroniza los catálogos reales de tu cuenta** (numeraciones, impuestos, medios de pago, productos) y tú eliges con selectores cuál usar (sección 1.4, paso 4). **Alegra y Siigo** necesitan un producto/servicio contable genérico (por ejemplo «Consumo restaurante») creado por ti en su plataforma; lo eliges en el selector. Si activas la propina como ingreso para terceros, necesitas además un ítem «Propinas».
- **Documento Equivalente Electrónico POS:** con la app solo funciona con **Simulado** y **Siigo** (usando el ID del comprobante POS de Siigo). Con Factus, Alegra y Dataico elige «Factura Electrónica de Venta»: la app no te deja guardar POS con ellos.
- **Tope del POS:** el Documento Equivalente POS tiene un tope de **5 UVT** por documento. Caja muestra una alerta amarilla cuando una cuenta lo supera (pide datos del cliente y emite Factura Electrónica de Venta). El valor de la UVT (por defecto 52.374, año 2026) se confirma cada enero en «Opciones tributarias avanzadas».

### 1.3 Qué preguntarle a tu contador (los 4 selectores)
| Selector en la app | Pregunta para el contador |
|---|---|
| **Tipo de documento** | «¿Facturamos con Factura Electrónica de Venta o con Documento Equivalente POS?» |
| **Impuesto aplicable** | «¿Somos responsables de INC 8% (restaurantes), de IVA 19% o estamos exentos/no responsables?» |
| **Precios de la carta** | «¿Los precios de la carta ya incluyen el impuesto o se le suma al subtotal?» (Casi siempre: *ya incluyen*.) |
| **Propina voluntaria** | «¿La propina va fuera de la factura o la incluimos como ingreso para terceros no gravado?» Por defecto se **excluye**; la opción de incluirla está en «Opciones tributarias avanzadas» y exige elegir el ítem de propinas. |
| **Régimen del restaurante** | «¿Somos Responsables de IVA (O-48), Régimen Simple (O-47) o No responsables (R-99-PN)?» Está en el RUT. |

Además: pídele la **razón social, NIT, municipio y código DANE** (están en el RUT) y la **resolución** (prefijo, número, rango desde/hasta, vigente desde/hasta). En Pruebas son opcionales; en Producción son obligatorias y la app avisa cuando faltan pocos días para el vencimiento.

### 1.4 Configurar en la app (administrador): 6 pasos guiados
«Mi cuenta» → **Facturación electrónica**. La pantalla es una guía de arriba hacia abajo:
1. **Datos del restaurante (emisor):** razón social, NIT (el **dígito de verificación se calcula solo**), régimen, municipio, código DANE y correo oficial.
2. **Estado y ambiente:** activa la facturación y elige **Pruebas / Sandbox** (o Producción). **Cada ambiente tiene sus propias credenciales, catálogos y relaciones**: cambiar de ambiente no mezcla ni borra lo del otro.
3. **Proveedor y credenciales:** elige el proveedor (el icono (i) te dice dónde sacar las llaves), escríbelas y toca **Guardar credenciales**. Se cifran en el servidor y la app solo muestra «Configurado (••••1234)». Para **rotarlas** escríbelas todas de nuevo: el historial de facturas y tus relaciones de catálogos **se conservan** (solo si cambias de *proveedor* se reinician las relaciones, porque los códigos son de otra cuenta).
4. **Conectar y relacionar catálogos:** toca **Probar conexión y sincronizar catálogos**. Si falla, abre «Detalle técnico del proveedor». Luego elige con selectores tu resolución, impuesto, medios de pago (efectivo, datáfono, transferencia) y producto contable, y toca **Guardar relaciones**. Para terminar, **Ejecutar prueba de emisión (Sandbox / Simulada)**: emite un documento de prueba sin tocar cuentas reales.
5. **Reglas tributarias:** tipo de documento, impuesto, precios (incluyen/suman). La propina queda en «Excluir»; en **Opciones tributarias avanzadas** puedes incluirla como ingreso para terceros (no gravado) y fijar el valor de la UVT.
6. **Resolución y numeración:** prefijo, número, rango y vigencia. La app muestra los **folios usados y disponibles** y, aquí y en Caja, **alertas amarillas** cuando la resolución está por vencer (30 días), vencida o quedan pocos folios (10 % o 50). Las alertas avisan; nunca bloquean la venta.

Toca **Guardar configuración**. Opcional: **Emitir automáticamente al cobrar**.

### 1.5 Primera prueba (obligatoria antes de producción)
0. Ejecuta **Ejecutar prueba de emisión** (paso 4). Debe decir «Prueba correcta».
1. Con ambiente **Pruebas**, cobra una cuenta pequeña (sin datos del cliente = **Consumidor final**, 222222222222) y toca **Emitir factura**. Debe quedar «Emitida» con número y CUFE.
2. Abre el **PDF** y revisa: total, impuesto, propina y datos del cliente contra lo que cobraste. Imprime la **tirilla** (80 o 58 mm): lleva tus datos, la resolución DIAN, base e impuesto, el CUFE completo y el código QR.
3. Pídele al contador que revise ese documento **en el panel del proveedor**.
4. Prueba **Reenviar por correo** a tu propio correo.
5. Prueba **Anular factura (Nota Crédito)**: pide un motivo y deja registro. El efectivo devuelto aparece como «Devoluciones por Nota Crédito» en el cuadre de caja y en el resumen del día.
6. Prueba **sin internet**: apaga el wifi, toca «Emitir factura» (queda «Pendiente de envío») y enciéndelo: debe emitirse sola y **una sola vez**.
7. Solo entonces cambia a **Producción** (cada factura pasa a tener validez fiscal real) y verifica la resolución.

### 1.6 Quién puede qué
- **Cajero y administrador:** emitir, **reintentar emisión**, ver PDF, imprimir tirilla, reenviar por correo.
- **Solo administrador:** guardar credenciales, sincronizar catálogos, guardar relaciones, prueba de emisión, cambiar la configuración y **anular** (con motivo obligatorio; queda en la bitácora con nombre y hora).

---

## 2. Guía técnica

### 2.1 Cómo está armado
```
Caja (navegador) ──POST──► /.netlify/functions/facturacion ──► procesar() ──► adaptador del proveedor ──► API del proveedor
        │                      verifica el ID Token de Firebase      │
        │ cola sin conexión     y el rol en perfiles/{uid}            ├─ facturacion/documentos/{cuentaId}  (1 por cuenta)
        ▼                                                             ├─ facturacionSecretos/{pruebas|produccion}  (cifrado, nadie del navegador lo lee)
                                                             ├─ facturacion/{credencial|catalogo|mapeo}/{modo}
   bandeja (tipo "facturacion")                                       └─ auditoria
```
- Lógica pura y probada con Node: `tools/facturacion/` (`motor`, `config`, `emisor`, `mapeo`, `alertas`, `errores`, `cifrado`, `idempotencia`, `payload`, `servicio`, `dbMemoria`). En `src/`: `facturacion/qr.js`, `facturacion/reversos.js`, `termica/tickets.js` (`ticketFactura`).
- Adaptadores: `src/facturacion/adaptadores/{simulado,factus,alegra,siigo,dataico}.js` con el contrato `emitirDocumento · anularDocumento · reenviarCorreo · probarConexionYSincronizar`.
- Función Netlify: `netlify/functions/facturacion.mjs`; acceso a Firebase con cuenta de servicio en `netlify/lib/firebaseAdmin.mjs`.
- Los montos **se recalculan en el servidor** desde la cuenta y sus pedidos; el navegador no manda cifras.
- **Idempotencia:** un documento por cuenta (`facturacion/documentos/{cuentaId}`), reservado con transacción, y referencia estable `CMD-<cuentaId>` hacia el proveedor. Si una llamada queda en duda (corte de red tras enviar, error 5xx) el documento queda en «Error» *incierto*: no se reintenta a ciegas; solo un administrador puede forzar el reintento después de revisar en el panel del proveedor.

### 2.2 Variables de entorno en Netlify
Site configuration → Environment variables:

| Variable | Para qué |
|---|---|
| `CLAVE_CIFRADO_FACTURACION` | Llave AES-256-GCM de las credenciales. 64 caracteres hexadecimales (o 32 bytes en base64). |
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo de la cuenta de servicio (Firebase → ⚙ Configuración del proyecto → **Cuentas de servicio** → *Generar nueva clave privada*). Necesaria para escribir en las ramas privadas. |
| `VITE_FIREBASE_*` | Las que la app ya usa (incluye la URL de la base de datos). |

**Generar la llave** (una vez, en tu computador):
```
npm run facturacion:llave
```
Copia el valor impreso a `CLAVE_CIFRADO_FACTURACION` y vuelve a desplegar. **Guarda una copia en un gestor de contraseñas:** si la pierdes o la cambias, las credenciales guardadas dejan de poderse descifrar y el administrador debe escribirlas de nuevo (no se pierde nada más). No la subas al repositorio.
Si falta alguna de las dos variables la función responde 503 y la app muestra «no disponible» sin afectar el resto de Caja.

### 2.3 Reglas de la base de datos
Se generan con `tools/generar-reglas.mjs` → `database.rules.json`. Publica el archivo en Firebase (Realtime Database → Reglas) o con `firebase deploy --only database`.
- `facturacion/ajustes`: lo lee cualquier usuario activo; lo escribe solo el administrador (con validación de cada campo).
- `facturacion/ajustes`: además valida el emisor (régimen, DANE de 5 dígitos…) y `valorUvt`; sin campos extra.
- `facturacion/credencial/{modo}`, `facturacion/catalogo/{modo}`, `facturacion/mapeo/{modo}` (`modo` = `pruebas` o `produccion`): lectura administrador; **escritura imposible desde el navegador** (solo la función).
- `facturacion/documentos` (facturas y Notas Crédito): lectura caja/administrador; escritura imposible desde el navegador, por eso **nadie puede editar una factura o nota ya emitida** (solo la función, que la deja inmutable salvo el flujo de anulación/correo).
- `facturacionSecretos/{modo}` (credenciales cifradas): **lectura y escritura denegadas a todo cliente web**, ni siquiera el dueño. Lo prueba `tools/probar-reglas.mjs` (225 casos).
- `auditoria`: solo se crea; acciones nuevas `guardar_mapeo_fiscal` y `prueba_emision_fiscal`.
La cuenta de servicio de la función no está sujeta a las reglas, por eso puede escribir.

### 2.4 Catálogos que dependen de la cuenta del proveedor
No hay IDs fijos en el código: cada adaptador implementa `probarConexionYSincronizar` y devuelve `{ resoluciones, impuestos, mediosPago, productos, vendedores }` con `{ id, etiqueta }`. La función los guarda en `facturacion/catalogo/{modo}` y el administrador los relaciona (`facturacion/mapeo/{modo}`). Qué exige cada proveedor está en `REQUISITOS` (`tools/facturacion/mapeo.mjs`). Factus y Dataico usan catálogos estáticos de la DIAN (impuestos, medios de pago) y sincronizan lo demás. **Los endpoints y campos de cada proveedor se tomaron de su documentación pública y están marcados «VERIFICAR» en el encabezado de cada adaptador: hay que confirmarlos en el sandbox real.**

### 2.5 Pruebas
- `npm run fiscal:probar`: motor tributario (23), configuración (59), cifrado (19), adaptadores con `fetch` simulado (33), servicio (48), cliente y estados (35), lógica v23 — DV, emisor, folios, UVT, errores, mapeo (51), servicio v23 — credenciales por ambiente, sincronización, mapeo, prueba de emisión (39) y reversos de caja (8).
- `npm run verificar`: incluye lo anterior y las reglas.
- `node tools/probar-contratos-dian.mjs` (incluida en `npm run verificar`): **contratos y cuadre** de los 4 adaptadores, sin red (130 pruebas, con los IDs que el administrador mapeó). Valida campos y tipos de cada JSON y que `(base × cantidad) − descuentos + impuestos + propina de terceros` sea EXACTAMENTE el total cobrado, en centavos. Los esquemas salen de la documentación pública y de la lista de campos acordada, **no** de un OpenAPI oficial ni de un sandbox: si el proveedor cambia un campo, esta prueba no lo detecta.
- `npm run e2e`: navegador real con el proveedor simulado (`tools/e2e/facturacion.mjs`): configuración del admin (emisor con DV, ambientes separados, sincronización de catálogos, prueba de emisión), emisión a Consumidor Final con CUFE, emisión sin internet + reconexión sin duplicados, cajero bloqueado y anulación por el administrador.
- Para probar un proveedor real: sandbox + «Probar conexión» + «Primera prueba» (1.5).

### 2.5.1 Límite conocido de redondeo (Alegra, Siigo, Dataico)
Con INC 8 % (o IVA) **incluido** en el precio, ~7 % de los precios en pesos enteros (p. ej. **$8.300 × 1** o **$7.900 × 1**) no tienen una base de 2 decimales cuyo impuesto redondeado complete justo el precio: el proveedor, que calcula el impuesto él mismo, suma **1 centavo de más o de menos**. La app reparte las filas para evitarlo siempre que se puede (varias cantidades, fila agrupada «(×3)»), pero con cantidad 1 no hay forma. **Factus** no lo sufre porque recibe el precio con impuesto incluido. Confirma en tu sandbox cómo redondea cada proveedor y qué tolerancia acepta la DIAN; la prueba de contratos lo muestra como aviso, no como error.

### 2.6 Problemas frecuentes
| Síntoma | Causa probable |
|---|---|
| «La función de facturación no está disponible» | Falta `FIREBASE_SERVICE_ACCOUNT` o `CLAVE_CIFRADO_FACTURACION`, o no se desplegó la función. |
| «Guarda primero las credenciales» | Se cambió la llave de cifrado o las credenciales son de otro proveedor. |
| Error con «Detalle técnico» | Respuesta tal cual del proveedor (resolución vencida, NIT inválido, catálogo mal configurado…). |
| «Error» marcado como incierto | La red se cortó después de enviar: revisa en el panel del proveedor si la factura existe antes de reintentar. |

### 2.7 Errores de emisión: qué se reintenta solo y qué no
Clasificación en `tools/facturacion/errores.mjs`:
| Clase | Ejemplos | Qué pasa |
|---|---|---|
| **Red segura** | sin internet o fallo antes de que nada saliera (también en consultas de solo lectura) | Reintento **automático** en segundo plano: a los 30 s, 2 min y 10 min (máx. 3). Luego queda para reintento manual. |
| **Datos** | 4xx: NIT o correo inválido | Se muestra el motivo. El cajero corrige los datos del cliente y toca **Reintentar emisión** (misma cuenta = misma llave de idempotencia, nunca duplica). |
| **Incierto** | la red se cortó *después* de enviar | **No se reintenta solo**: podría duplicar la factura ante la DIAN. Un administrador revisa el portal del proveedor y fuerza el reintento. |
| **Credenciales / configuración** | llaves vencidas, falta mapear | Solo administrador. |

### 2.8 Tirilla térmica y código QR
`ticketFactura` (`src/termica/tickets.js`) imprime en 80 mm (48 columnas) o 58 mm (32): emisor, NIT-DV, régimen, resolución (número, prefijo, rango, vigencia), cliente, líneas, base, INC/IVA, propina, pagos, **CUFE/CUDE completo** y **QR**. El QR apunta a la consulta oficial de la DIAN: `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey={CUFE}` (en Pruebas: `catalogo-vpfe-hab.dian.gov.co`); si el proveedor entrega su propia dirección, se usa esa. Sin CUFE no se inventa número: dice «sin consecutivo asignado». La Nota Crédito tiene su propia tirilla. **No se ha probado con una impresora física**: usa «Probar impresión» al configurarla.

### 2.9 Nota Crédito y caja
Al anular, el servidor guarda en el documento `anulacion { motivo, numeroNota, cufeNota, monto, pagos[] }`. `src/facturacion/reversos.js` reparte el monto entre los métodos de pago originales; el **efectivo devuelto resta del «Efectivo esperado»** del tramo de caja (en el momento de la nota, no el de la venta) y tarjeta/transferencia devueltas salen en el resumen del día. Una cuenta pagada offline conserva su hora de cobro original en la factura (`pagadaTs`).

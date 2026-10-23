# Mantener la app en el tiempo

La idea es que casi no haga falta intervenir. Esto es lo poco que sí conviene hacer y lo que la app hace sola.

## Lo que la app hace sola
- **Avisa si algo falla**: los errores quedan registrados en *Ajustes → Respaldos y datos → Errores de la app* y aparecen en la campana de alertas del administrador.
- **Avisa de lo importante**: caja abierta demasiadas horas, cancelaciones o descuentos inusuales, productos agotados, inventario vencido o por agotarse.
- **Guarda respaldos diarios** automáticamente y avisa si hay cambios que no se han podido subir por falta de internet.
- **Se actualiza sola**: cada vez que se publica una versión nueva, los dispositivos la reciben al abrir la app (no usa caché vieja).

## Rutina mensual (10 minutos)
1. Abre la campana de alertas y *Errores de la app*. Si hay errores repetidos, cópialos (botón *Copiar detalle*) y pásaselos a quien mantiene la app. Luego *Borrar registro*.
2. Descarga una **copia completa** (Ajustes → Respaldos y datos → *Descargar copia completa*) y guárdala **fuera de Firebase** (Drive, correo, disco). Los respaldos automáticos viven en la misma base de datos: si la base se perdiera, se perderían con ella.
3. En **Equipo y usuarios**, desactiva a quien ya no trabaje en el negocio.
4. Revisa el consumo en Firebase → Realtime Database → *Uso*. Si el negocio crece, pasa a plan **Blaze** y pon una **alerta de presupuesto** (Google Cloud → Facturación → Presupuestos y alertas).

## Cada vez que se cambie el código
```
npm install
npm run reglas:probar     # las reglas de seguridad siguen protegiendo y no bloquean el trabajo normal
npm run build             # la app compila
```
GitHub ejecuta esto solo en cada cambio (`.github/workflows/verificar.yml`). **Si falla, no se publica.**

## Cambiar las reglas de seguridad
1. Edita `tools/generar-reglas.mjs` (es el único lugar; no edites `database.rules.json` a mano).
2. `npm run reglas:generar` y luego `npm run reglas:probar` (debe decir "todas cumplen").
3. Antes de pegar en Firebase, copia las reglas que están publicadas a un archivo (por si hay que volver atrás; la copia anterior está en `tools/reglas-anteriores.json`).
4. Pégalas en Firebase → Realtime Database → Reglas → **Publicar**, y prueba entrar con un mesero y con un cajero.

## Activar la política de contenido (una sola vez)
En `netlify.toml` la política de contenido está en modo "solo reportar". Para pasarla a "aplicar":
1. Abre la app publicada en Chrome y abre la consola (F12 → Console).
2. Haz un recorrido completo: iniciar sesión, tomar un pedido, cocina (con sonido), cobrar, imprimir un reporte, exportar a Excel, ajustes (cambiar la fuente).
3. Si en la consola **no aparece** ningún aviso `Content Security Policy`, cambia `Content-Security-Policy-Report-Only` por `Content-Security-Policy` en `netlify.toml` y publica.
4. Si aparece alguno, agrega ese origen a la lista del tipo que indique el aviso y repite.

## Si alguien sospecha de un acceso indebido
1. Equipo y usuarios → **desactiva** la cuenta (corta el acceso al instante).
2. Firebase → Authentication → cambia/restablece la clave de esa cuenta.
3. Revisa *Historial* (cancelaciones, descuentos) y el *Registro de seguridad*.
4. Cambia la clave del propietario y de las cuentas de Firebase y Netlify.

## Qué NO puede garantizar esta app (y cómo se cubre)
- Las reglas impiden que cada rol toque lo que no le corresponde, pero **un administrador puede todo**: protege esas cuentas (clave larga, verificación en dos pasos, no compartirlas).
- Para integridad contable de nivel bancario (que ni un administrador pueda alterar cuentas) hace falta un servidor propio (Cloud Functions); no está incluido.

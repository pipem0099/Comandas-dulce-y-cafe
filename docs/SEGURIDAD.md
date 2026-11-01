# Seguridad: lista de revisión

Marca cada punto cuando esté hecho. Está pensada para revisarla al instalar y una vez al año.

## Cuentas
- [ ] Verificación en dos pasos en la cuenta de Google (Firebase), Netlify y GitHub.
- [ ] Clave larga y única para el propietario de la app.
- [ ] Cada persona tiene su propia cuenta; nadie comparte claves.
- [ ] Las personas que ya no trabajan quedaron **desactivadas** (Equipo y usuarios).

## Firebase
- [ ] Reglas publicadas = `database.rules.json` (no `".read": true`). Se prueban con `npm run reglas:probar`.
- [ ] Política de contraseñas del servidor: mínimo 10 caracteres (Authentication → Configuración).
- [ ] Alerta de presupuesto si el negocio pasa al plan Blaze.

## Netlify y código
- [ ] Repositorio **privado**.
- [ ] Variables de entorno cargadas en Netlify, nunca escritas en el código. La clave de la IA (`ANTHROPIC_API_KEY`) **no** lleva el prefijo `VITE_`.
- [ ] Política de contenido activada (ver `docs/MANTENIMIENTO.md`, "Activar la política de contenido").

## En el día a día
- [ ] Campana de alertas revisada (cancelaciones, descuentos, errores).
- [ ] Copia completa descargada y guardada **fuera** de la app, una vez al mes.
- [ ] Ante un acceso sospechoso: desactivar la cuenta y cambiar claves (ver `docs/MANTENIMIENTO.md`).

## Cambios de la auditoría (v13) y cómo activarlos

**Ya activos al publicar esta versión** (no requieren nada más que subir el código y publicar `database.rules.json`):
- Reglas: la cocina ya no puede cambiar qué se pidió ni a qué precio; precios y cantidades tienen límites; el logo tiene tope de tamaño.
- Correo de verificación al crear cuentas (propietario y empleados). La pantalla de acceso permite reenviarlo.
- Las claves nuevas se comparan con filtraciones conocidas (solo se envían 5 caracteres del hash; si no hay internet no bloquea).
- Identificadores impredecibles, revisión del tipo real de las fotos, límites de tamaño al restaurar respaldos y al subir el logo.

**Para un negocio NUEVO** (antes de abrir la base al equipo): genera las reglas con el correo del dueño. Así nadie más puede reclamar el negocio.
```
npm run reglas:generar -- --propietario correo-del-dueno@dominio.com
npm run reglas:probar
```
Luego publica `database.rules.json` en Firebase. El dueño debe abrir el enlace del correo de verificación antes de poder reclamar el negocio.

**Exigir correo verificado a TODO el equipo** (recomendado, pero en dos pasos para no dejar a nadie fuera):
1. Cada persona abre el enlace del correo de verificación (si no le llegó, "Reenviar el correo" en la pantalla de acceso; también sirve "¿Olvidaste tu clave?", que además lo verifica).
2. Cuando todos estén verificados: `npm run reglas:generar -- --propietario correo@dominio.com --exigir-correo-verificado`, publica las reglas y agrega en Netlify la variable `VITE_EXIGIR_CORREO_VERIFICADO=1`.

**Pendiente en la consola de Google/Firebase (no se puede hacer desde el código):**
- [ ] Authentication → Configuración → política de contraseñas: mínimo 10 caracteres, exigida por el servidor.
- [ ] Google Cloud → Credenciales → restringir la clave de API de Firebase a tu dominio de Netlify (y a localhost si desarrollas).
- [ ] Activar Firebase App Check (reCAPTCHA) para la base de datos y Authentication.
- [ ] Netlify: confirmar que `VITE_FIREBASE_*` están cargadas; luego, si quieres, borrar el bloque `CONFIG-DE-RESPALDO` de `src/firebase.js` (`npm run preparar-entrega` lo hace).
- [ ] Después de probar la app completa, cambiar `Content-Security-Policy-Report-Only` por `Content-Security-Policy` en `netlify.toml`.
- [ ] `xlsx@0.18.5` (solo se usa para ESCRIBIR Excel) tiene avisos públicos; migra a la versión de cdn.sheetjs.com cuando puedas regenerar `package-lock.json` con internet.

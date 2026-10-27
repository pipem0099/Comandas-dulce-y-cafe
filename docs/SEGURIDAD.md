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

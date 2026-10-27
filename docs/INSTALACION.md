# Instalar la app para un negocio nuevo

Cada negocio tiene **su propio proyecto de Firebase** y **su propio sitio en Netlify**. Así sus datos están
separados de los de los demás y un problema en uno no afecta a otro. Tiempo estimado: 30–40 minutos.

## Lo que necesitas
- Cuenta de Google (para Firebase) y cuenta de Netlify. **Actívales la verificación en dos pasos.**
- El proyecto (este repositorio) subido a GitHub.

## 1. Crear el proyecto de Firebase
1. Entra a https://console.firebase.google.com → **Agregar proyecto** (puedes desactivar Google Analytics).
2. **Compilación → Authentication → Comenzar** → pestaña *Método de acceso* → activa **Correo electrónico/contraseña**.
3. En Authentication → *Configuración* → **Política de contraseñas**: exige longitud mínima de **10** y activa la aplicación (así también se cumple desde el servidor, no solo en la pantalla).
4. **Compilación → Realtime Database → Crear base de datos**. Elige la región más cercana y, cuando pregunte por las reglas, elige **Modo bloqueado**. ❌ *No elijas "modo de prueba": deja todo abierto a cualquiera.*
5. En la pestaña **Reglas**, borra lo que hay, pega el contenido completo de `database.rules.json` y pulsa **Publicar**.
6. **Configuración del proyecto (engranaje) → General → Tus apps → ícono web `</>`** → registra la app y copia los 7 valores de `firebaseConfig`.

## 2. Publicar en Netlify
1. Netlify → **Add new site → Import an existing project** → elige el repositorio de GitHub.
2. Build command `npm run build`, publish directory `dist` (ya vienen en `netlify.toml`).
3. **Site configuration → Environment variables**: crea las 7 variables de `.env.example` con los valores del paso 1.6.
4. Despliega. Abre el link.

## 3. Primer ingreso
1. En la pantalla de ingreso toca **Primer ingreso** y crea la cuenta del propietario (clave de mínimo 10 caracteres).
2. Dentro de la app: **Ajustes → Equipo y usuarios** para crear las cuentas de cada persona con su rol.
3. **Ajustes → Ajustes del negocio**: nombre, logo, colores.
4. **Ajustes → Menú y precios** y **Mesas y plano**.

## 4. Revisión final (5 minutos, no te la saltes)
- En Firebase → Realtime Database → Reglas: debe verse el contenido de `database.rules.json`, **no** `".read": true`.
- Inicia sesión con una cuenta de **mesero** y comprueba que no puede abrir Caja ni Ajustes.
- Haz un pedido de prueba, cóbralo, cierra la caja y bórralo todo desde Respaldos si quieres empezar limpio.
- Anota en un lugar seguro: correo del propietario, proyecto de Firebase, sitio de Netlify.

## Al entregarle la app a otro negocio
Mira `docs/ENTREGA.md`: hay una herramienta que prepara una copia limpia (sin tu configuración de Firebase ni tu marca).
Nunca reutilices el proyecto de Firebase de otro cliente.

## Opcional: crear el menú desde una foto
Esta función usa una IA que lee la foto de la carta. Necesita una clave que **va solo en Netlify** (nunca en el código):
1. Crea una cuenta en https://console.anthropic.com, agrega saldo y crea una **clave de API**.
2. En Netlify → Site configuration → Environment variables, crea `ANTHROPIC_API_KEY` con esa clave.
3. Vuelve a desplegar el sitio. Ya aparece funcionando en **Menú y precios → Crear el menú desde una foto**.

Cada foto cuesta unos pocos centavos de dólar (consulta la tarifa vigente de la IA). Quién paga ese consumo —el negocio o tú— lo decides tú al venderla. Si no activas la clave, la app sigue funcionando: la opción de **pegar el texto de la carta** no usa IA ni cuesta nada.
Solo un administrador puede usarla, y se limita a 12 usos por hora por persona.

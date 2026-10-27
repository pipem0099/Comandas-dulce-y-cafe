# Entregar la app a otro negocio (traspaso)

La idea: cada negocio queda con **su propia copia**, **su propio Firebase** y **su propio Netlify**. Tú no conservas ningún acceso.

## 1) Prepara la copia limpia
```
npm run preparar-entrega -- --nombre "Café Neira" --salida ../entrega-cafe-neira
```
La herramienta copia el proyecto sin `node_modules`, `.git` ni archivos `.env`, quita la configuración de Firebase de tu negocio, cambia el nombre y deja un menú neutro. Al terminar te avisa si todavía queda algo de tu negocio.

A mano falta:
- Cambiar los íconos de `public/icons` (son los de tu negocio).
- Revisar que no hayas dejado datos reales (nombres de clientes, teléfonos) en capturas o documentos que le entregues.

## 2) El comprador hace su instalación
Sigue `docs/INSTALACION.md` con **su** cuenta de Google y de Netlify (con verificación en dos pasos). Tú puedes acompañarlo por videollamada.

## 3) Súbela a un repositorio PRIVADO del comprador
Nunca al tuyo ni a uno público: el código es lo que vendes.

## 4) Qué le entregas
- La copia limpia y el acceso al repositorio (transfiere la propiedad).
- Las guías de `docs/` y las guías por rol que están dentro de la app (Mi cuenta → Cómo se usa la app, con botón para imprimirlas).
- Por escrito: que la app emite **comprobantes internos, no facturas electrónicas**; que necesita internet; y que las copias de seguridad las descarga él cada mes.

## 5) Antes de cerrar la venta (no es código)
- Un contrato con: tipo de licencia o cesión, garantía limitada (por ejemplo 30 días), responsabilidad tributaria del negocio y tratamiento de datos personales. Que lo revise un abogado, sobre todo por haberse hecho con ayuda de IA.
- Que el contador del negocio confirme cómo debe facturar.

# Pisos, varias cajas y destino de cada pedido

Todo es **opcional**: con un solo piso, una sola caja y una sola estación la app funciona exactamente igual que antes.

## Cómo se configura (administrador)
1. **Pisos** → *Menú de usuario → Mesas y espacios → Pisos*. Agrega los pisos; cada uno tiene sus mesas y su propio plano (pestañas arriba). El primero es el piso base y no se borra. Cada mesa tiene un selector para pasarla de piso (no se puede si tiene cuenta abierta).
2. **Estaciones** → *Ajustes del negocio → Estaciones*. Una por cada lugar de preparación (Cocina, Barra, Postres…). La "sugerencia por categoría" ya no manda: el mesero elige.
3. **Cajas** → *Ajustes del negocio → Cajas*. Agrega las cajas (ej. "Caja piso 3"). Se puede agregar una caja con el negocio abierto: el turno abierto sigue abierto y queda como la caja principal ("Caja 1"); la caja nueva se abre aparte.

## Cómo trabaja el equipo
- **Mesero**: ve un piso a la vez (pestañas). Al enviar, el botón **"Va a…"** pide estación, piso donde se prepara y piso donde se entrega. Se recuerda lo último elegido; "Un producto va a otro lado…" permite excepciones. Si algo se prepara en otro piso, le suena y aparece en *Para servir ahora* con "viene de Piso 2".
- **Trasladar mesa entre pisos**: en la mesa → ⇄ → *Trasladar*; elige el piso y la mesa libre. Lo que falta entregar pasa a entregarse en el piso nuevo; lo que se estaba preparando sigue donde estaba.
- **Cocina / Barra**: cada pantalla se queda fija en su **estación** y su **piso** (se guarda en el dispositivo). Las líneas que suben/bajan muestran "→ Entregar en Piso 3".
- **Caja**: con varias cajas, cada dispositivo elige la suya (chips arriba); cada caja abre/cierra su propio turno y cuadra su efectivo. **Cualquier caja cobra cualquier cuenta de cualquier piso**; el pago queda marcado con la caja que lo recibió. Un cliente puede pagar una parte en cada caja.

## Datos nuevos (todos opcionales, no requieren cambiar las reglas de Firebase)
`config.pisos`, `config.planos[pisoId]`, `config.cajas` · `mesa.piso` · `turno.cajaId/cajaNombre` · `pago.cajaId`, `cuenta.cajaId` · por línea de pedido: `estacion`, `pisoPrep`, `pisoEntrega` · `pedido.pisoOrigen`.
Lo viejo sin esos datos se interpreta como piso base / caja "principal".

## Pruebas
`npm run pisos:probar` (40 pruebas de la lógica). Forma parte de `npm run verificar`.

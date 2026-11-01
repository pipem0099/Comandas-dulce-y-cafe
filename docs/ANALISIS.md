# Análisis y control — cómo funciona

Pantalla: **Menú de usuario (tu nombre) › Análisis y control** (solo administradores).
Toda la lógica está en `src/analitica.js` (con pruebas: `npm run analitica:probar`); la pantalla `src/pantallas/Analisis.jsx` solo dibuja.

## Definiciones (iguales en todos los reportes)
- **Venta neta** = lo vendido en productos − descuentos. No incluye propinas ni domicilio.
- Una cuenta es venta cuando está **pagada**, y se fecha por la hora en que se **cobró**.
- **Costo** de un producto, en este orden: el que quedó guardado en la venta → el de su receta (inventario) → % estimado por categoría → *sin costo*. Lo *sin costo* **no entra** al margen (antes contaba como costo 0 e inventaba margen).

## Qué hace cada pestaña
| Pestaña | Qué responde | Fórmula |
|---|---|---|
| Resumen | ¿Vendí más o menos que antes? ¿Por qué? | Δ% = (A − B)/B. "Hoy" se compara con el mismo día y la misma hora de la semana pasada. Con menos de 5 cuentas en la base no se muestra porcentaje. ΔVenta = (N_A − N_B)·T_B (afluencia) + N_A·(T_A − T_B) (ticket): suma exacta. |
| Productos | ¿Qué deja más ganancia? ¿Qué no se vende? | Margen neto = ventas − descuento repartido − costo. Estrella / Se vende mucho, deja poco / Deja mucho, se vende poco / Vende poco y deja poco. "Sin ventas" = 30 días sin vender (no cuenta lo nuevo ni lo de temporada). |
| Pérdidas | ¿Quién cancela o da descuentos? | Por *responsable* (mesero de la cuenta) y *quien autorizó*. Se marca "para revisar" si su tasa es ≥ 2,5× la mediana de sus compañeros (necesita ≥ 3 personas, ≥ 10 cuentas y ≥ 3 eventos). Es una señal para mirar los motivos, no una acusación. |
| Semana | ¿Cuánto venderé? ¿Cuánta gente necesito? ¿Qué compro? | Pronóstico = mediana de los mismos días de las últimas 8 semanas × tendencia (limitada a ±20%). Compras = unidades esperadas × receta + mínimo − stock. |
| Costos | Costos estimados, margen objetivo y alertas | Precio sugerido = costo / (1 − margen objetivo). |

## Alertas contra lo habitual
Se calculan cada minuto en la campana de alertas. Comparan hoy, **hasta esta hora**, con los mismos días de la semana anteriores (mínimo 4 semanas con ventas):
- Ventas y ticket: desviación robusta (mediana y MAD). Cancelaciones: probabilidad de Poisson. Descuentos: % de lo consumido.
- Sensibilidad ajustable (Costos › Alertas automáticas): apagadas / pocas / normal / muchas.
- Se corrigió un error de la alerta de descuentos: usaba `cuenta.total`, un campo que nunca se guardaba, y por eso el % salía cercano a 100%.

## Datos nuevos
- `cuentas/{id}/personas`: se anota en la cuenta (Personas en la mesa). Sin él, el ticket por persona no se muestra.
- `menu[].creadoTs`: fecha de creación del producto (para no llamar "muerto" a uno recién agregado).
- `config.plantillaCostos`, `config.margenObjetivo`, `config.alertasSensibilidad`, `config.cuentasPorMeseroHora`.
- `auditoria/{id}`: bitácora de cancelaciones y descuentos con uid real, hora y monto. **Solo se puede crear**: nadie la edita ni la borra (ni el administrador). La lee solo el administrador. Reglas probadas en `npm run reglas:probar`.

## Después de actualizar
1. Publica `database.rules.json` (nodo `auditoria` y validación de `personas`).
2. Entra a **Análisis y control › Costos** y usa "Usar valores sugeridos" (ajústalos).
3. Pide al cajero anotar las personas por mesa; el ticket por persona aparece desde ese momento.
4. Los pronósticos mejoran con las semanas: con menos de 2 semanas de ventas la pantalla lo avisa.

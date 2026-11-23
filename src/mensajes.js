/*
 * Mensajes de WhatsApp editables: recordatorio de reserva y resumen del día.
 * Cada plantilla usa variables entre llaves, por ejemplo {nombre} o {hora}; se guardan en config.mensajes.
 * Nada se envía solo: la app abre WhatsApp con el texto ya escrito y la persona toca "Enviar".
 */
export const PLANTILLAS = {
  reserva: {
    titulo: "Recordatorio de reserva",
    defecto: "Hola {nombre}, te recordamos tu reserva en {negocio} para hoy {fecha} a las {hora} ({personas}). ¡Te esperamos! Si no puedes venir, avísanos por aquí.",
    variables: [["nombre", "Nombre de quien reservó"], ["fecha", "Fecha"], ["hora", "Hora"], ["personas", "Personas"], ["negocio", "Nombre del negocio"]],
    ejemplo: { nombre: "Laura", fecha: "lun 23 nov", hora: "8:00 p. m.", personas: "4 personas", negocio: "tu negocio" },
  },
  resumen: {
    titulo: "Resumen del día",
    defecto: "*{negocio}* · resumen de {fecha}\nVendido: {vendido}\n· Efectivo: {efectivo}\n· Tarjeta: {tarjeta}\n· Transferencia: {transferencia}\nPropinas: {propinas}\nCaja: {cuadre}",
    variables: [["negocio", "Nombre del negocio"], ["fecha", "Fecha"], ["vendido", "Total vendido"], ["efectivo", "Ventas en efectivo"], ["tarjeta", "Ventas con tarjeta"], ["transferencia", "Ventas por transferencia"], ["propinas", "Propinas"], ["cuadre", "Si la caja cuadró"]],
    ejemplo: { negocio: "tu negocio", fecha: "lun 23 nov", vendido: "$ 1.250.000", efectivo: "$ 600.000", tarjeta: "$ 450.000", transferencia: "$ 200.000", propinas: "$ 80.000", cuadre: "cuadró ✓" },
  },
};

export const plantillaDe = (config, clave) => {
  const guardada = config && config.mensajes && config.mensajes[clave];
  return typeof guardada === "string" && guardada.trim() ? guardada : PLANTILLAS[clave].defecto;
};

// Las variables que no existen se dejan tal cual, para que se note el error al revisar el texto.
export const rellenar = (texto, vars) => String(texto).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));

export const linkWhatsApp = (telefono, texto) => {
  const d = String(telefono || "").replace(/\D/g, "");
  const base = d ? `https://wa.me/${d.length === 10 ? "57" + d : d}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(texto)}`;
};

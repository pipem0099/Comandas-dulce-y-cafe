/*
 * Guías cortas por rol. Se muestran dentro de la app (Mi cuenta → Cómo se usa la app) y se pueden imprimir
 * o guardar como PDF para entregarlas al equipo. Si cambia algo en la app, se actualiza aquí.
 */
export const GUIAS = [
  { id: "mesero", titulo: "Mesero", resumen: "Tomar pedidos, juntar mesas y servir", pasos: [
    "Abre la pestaña **Mesero** y toca la mesa que vas a atender.",
    "Busca el producto o usa las categorías y toca **+**. Si tiene opciones (sabor, tamaño…), la app te las pregunta.",
    "Toca **Enviar pedido**: llega a la cocina al instante. Puedes agregar una nota para cocina con el botón de mensaje.",
    "¿Te equivocaste o el cliente cambió de idea? En el pedido, toca los tres puntos **⋯** del producto: **Quitar**, **Quitar 1** o **Cambiar por otro**. La cocina ve el cambio tachado, y tienes unos segundos para **Deshacer**.",
    "Cuando la cocina marca un producto como listo, aparece en **Para servir ahora**. Toca **Servir** al llevarlo a la mesa (se sirve de a uno).",
    "Para unir mesas (grupos grandes) usa el botón **⇄** de la mesa y elige **Juntar**. Se ven pegadas y quedan en una sola cuenta.",
    "Cuando el cliente pida la cuenta, avisa a caja. Una mesa ya pagada se libera al tocarla; si los clientes siguen y quieren pedir más, toca **Siguen aquí · quieren pedir más**.",
  ] },
  { id: "cocina", titulo: "Cocina", resumen: "Preparar y marcar lo que está listo", pasos: [
    "Abre la pestaña **Cocina**. Los pedidos nuevos llegan a **Pendientes** (con sonido si lo tienes activado).",
    "Toca **Empezar preparación**: el pedido pasa a **Preparando**.",
    "En **Preparando**, marca cada producto con **Listo** cuando lo tengas. Pasa solo a **Listas** para que el mesero lo recoja; no hace falta esperar a que esté todo el pedido.",
    "Si el mesero cambia algo, sale un aviso amarillo y el producto quitado queda **tachado** (QUITADO o CAMBIÓ DE PRODUCTO). Toca **Entendido**.",
    "Arriba tienes sonido, tamaño de letra y pantalla completa, para dejar la tablet fija en la cocina.",
  ] },
  { id: "caja", titulo: "Caja", resumen: "Abrir, cobrar, comprobantes y cerrar", pasos: [
    "Al empezar el día, en **Caja → Resumen**, abre la caja con la base de efectivo que dejaste.",
    "En **Cobrar mesas** busca la cuenta (hay un buscador). Antes de cobrar puedes dar la **Cuenta para el cliente** (imprimir o enviar por WhatsApp).",
    "Elige la propina y cómo pagan: **Pago único**, **Pago mixto**, **Partes iguales** o **Por producto**. En efectivo, escribe con cuánto pagan y la app calcula el cambio.",
    "Al cobrar sale un aviso con **Comprobante** (imprimir o WhatsApp) y **Deshacer** por unos segundos, por si te equivocas.",
    "Registra el dinero que entra o sale del cajón (compras, retiros, base adicional) en **Registrar movimiento**.",
    "Al terminar el turno, **cierra la caja**: cuenta el efectivo y revisa tarjeta y transferencia. Si no cuadra, explica por qué; queda registrado.",
    "El comprobante es interno: **no es factura electrónica de venta**.",
  ] },
  { id: "admin", titulo: "Dueño o administrador", resumen: "Configurar y controlar el negocio", pasos: [
    "En tu perfil (arriba a la derecha) están los ajustes: **Menú y precios**, **Mesas y plano**, **Equipo y usuarios**, **Respaldos y datos** y **Ajustes del negocio**.",
    "En **Menú y precios** puedes crear el menú **desde una foto** de tu carta y revisarlo antes de agregarlo.",
    "En **Equipo y usuarios** crea una cuenta por persona con su rol (mesero, cocina, caja). Desactiva a quien deje de trabajar contigo.",
    "En **Ajustes del negocio** pon el nombre y los datos que salen en el comprobante (NIT, dirección, teléfono).",
    "En **Caja** tienes **Historial** (ventas del día e impresión), **Reportes** (por día, semana o mes) e **Inventario** (stock, mermas, compras).",
    "La **campana** de arriba te avisa de lo importante: caja abierta demasiadas horas, cancelaciones o descuentos inusuales, productos agotados o inventario por vencer.",
    "Una vez al mes, en **Respaldos y datos**, descarga una **copia completa** y guárdala fuera de la app (Drive, correo). La app te lo recuerda.",
    "Necesitas internet para usar la app. Si se cae, los cambios esperan y se suben al volver, pero **no cierres la app** mientras tanto.",
  ] },
];

/** Qué guías ve cada persona según sus roles (el administrador ve todas). */
export function guiasPara(usuario) {
  const roles = (usuario && usuario.roles) || {};
  if (roles.admin) return GUIAS;
  const ver = GUIAS.filter((g) => roles[g.id === "caja" ? "cajero" : g.id]);
  return ver.length ? ver : GUIAS.slice(0, 1);
}

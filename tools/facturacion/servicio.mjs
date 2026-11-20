/*
 * Servicio de facturación electrónica (lado servidor) — toda la lógica de decisión, SIN depender de Netlify ni de Firebase:
 * recibe sus dependencias por parámetro (`deps`), así se prueba entera con `npm run fiscal:probar` y la reutilizan las E2E.
 * La Netlify Function (netlify/functions/facturacion.mjs) solo une esto con el mundo real.
 *
 *   procesar(solicitud, token, deps) → { status, cuerpo }
 *
 * Acciones:  guardar_credenciales (admin, por ambiente) · probar_conexion / sincronizar_catalogos (admin) · guardar_mapeo (admin) · prueba_emision (admin, solo sandbox/simulado)
 *            emitir (cajero|admin) · anular (SOLO admin) · reenviar_correo (cajero|admin)
 *
 * Seguridad:
 *  · El token de Firebase se verifica SIEMPRE y el rol sale de `perfiles/{uid}` (nunca de lo que diga el navegador).
 *  · Los montos NO los manda el navegador: se recalculan aquí desde la cuenta y sus pedidos guardados.
 *  · Los secretos se descifran solo en memoria para llamar al proveedor; jamás se devuelven ni se guardan en claro ni salen en errores.
 *  · Idempotencia: un solo documento por cuenta (llave = id de la cuenta), con reserva atómica antes de llamar al proveedor.
 * Códigos HTTP: 200 (también cuando el PROVEEDOR rechaza: `ok:false`), 400 datos, 401 sesión, 403 permiso, 404 no existe, 409 estado/en proceso,
 * 503 sin configurar. La app reintenta solo ante fallos de red o 5xx; con 2xx/4xx la solicitud se da por entregada.
 */
import { cifrar, descifrar } from "./cifrado.mjs";
import { validarAjustes, validarCredenciales, enmascarar, proveedorPorValor, conDefectos } from "./config.mjs";
import { validarMapeo, conMapeoVacio, conCatalogoVacio } from "./mapeo.mjs";
import { clasificarError } from "./errores.mjs";
import { decidirEmision, puedeAnular, cuentaIdValido } from "./idempotencia.mjs";
import { construirPayload, fechaHoraBogota } from "./payload.mjs";

export const RUTAS = {
  ajustes: "facturacion/ajustes", credencial: "facturacion/credencial", documentos: "facturacion/documentos", secretos: "facturacionSecretos",
  catalogo: "facturacion/catalogo", mapeo: "facturacion/mapeo", auditoria: "auditoria", // credencial, secretos, catalogo y mapeo cuelgan de /{pruebas|produccion}: ambientes SEPARADOS
};
const resp = (status, cuerpo) => ({ status, cuerpo });
const error = (status, codigo, mensaje, extra = {}) => resp(status, { ok: false, error: codigo, mensaje, ...extra });
const CAMPOS_RESULTADO = ["numero", "prefijo", "cufe", "pdfUrl", "pdfSimulado", "qrUrl", "idProveedor", "estadoProveedor", "correoEnviado", "clienteId"];
const limpiar = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? null : v)), (k, v) => (v === null ? undefined : v));
const modoDe = (m, defecto) => (m === "produccion" ? "produccion" : m === "pruebas" ? "pruebas" : defecto);
const correoOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || ""));

function resumenError(e) {
  const c = clasificarError(e);
  return { mensaje: String((e && e.message) || "Error desconocido").slice(0, 300), detalle: String((e && e.detalle) || "").slice(0, 2000), incierto: !!(e && e.incierto), codigo: (e && e.codigo) || "proveedor", estado: (e && e.estado) || 0, clase: c.clase, reintentoAutomatico: c.reintentoAutomatico, requiereCorreccion: c.requiereCorreccion, accion: c.accion };
}

export async function procesar(solicitud, token, deps) {
  const { db, ahora = () => Date.now() } = deps;
  // 1) ¿Quién llama? (token verificado + perfil activo en la base de datos)
  let uid;
  try { uid = (await deps.verificarToken(token)).uid; } catch (e) { return error(401, "sesion", "Tu sesión no es válida. Cierra sesión y vuelve a entrar."); }
  const perfil = await db.leer(`perfiles/${uid}`);
  const roles = (perfil && perfil.activo === true && perfil.roles) || {};
  const esAdmin = roles.admin === true, esCajero = roles.cajero === true;
  if (!esAdmin && !esCajero) return error(403, "permiso", "Tu usuario no tiene permiso para facturar.");
  const yo = { uid, nombre: String(perfil.nombre || "").slice(0, 120), rol: esAdmin ? "admin" : "cajero", esAdmin };
  const accion = solicitud && solicitud.accion;
  const adminSolo = ["guardar_credenciales", "probar_conexion", "sincronizar_catalogos", "guardar_mapeo", "prueba_emision", "anular"];
  if (adminSolo.includes(accion) && !esAdmin) return error(403, "permiso", accion === "anular" ? "Solo un administrador puede anular una factura." : "Solo un administrador puede configurar la facturación.");

  const auditar = async (evento) => {
    const id = `${ahora().toString(36)}${deps.nuevoId()}`;
    await db.escribir(`${RUTAS.auditoria}/${id}`, limpiar({ ts: ahora(), uid: yo.uid, nombre: yo.nombre, rol: yo.rol, ...evento }));
  };
  const leerAjustes = async () => conDefectos(await db.leer(RUTAS.ajustes));
  const credencialesDe = async (proveedor, modo) => {
    if (proveedor === "simulado") return {};
    const s = await db.leer(`${RUTAS.secretos}/${modo}`);
    if (!s || s.proveedor !== proveedor) { const e = new Error(`Guarda primero las credenciales de ${(proveedorPorValor(proveedor) || {}).etiqueta || proveedor}.`); e.codigo = "sin_credenciales"; throw e; }
    try { return descifrar(s.datos, deps.llave(), `facturacion:${proveedor}`); }
    catch (e) { const x = new Error(e.message); x.codigo = "cifrado"; throw x; }
  };
  const contexto = (aj, cred, extra = {}) => ({ credenciales: cred, modo: aj.modo, fetch: deps.fetch, mapeo: extra.mapeo || conMapeoVacio(null), emisor: aj.emisor || {} });
  const mapeoDe = async (modo) => conMapeoVacio(await db.leer(`${RUTAS.mapeo}/${modo}`));

  try {
    switch (accion) {
      /* ───────── guardar credenciales (cifradas) ───────── */
      case "guardar_credenciales": {
        const proveedor = solicitud.proveedor;
        const prov = proveedorPorValor(proveedor);
        if (!prov) return error(400, "datos", "Proveedor desconocido.");
        const modo = modoDe(solicitud.modo, (await leerAjustes()).modo);
        if (proveedor === "simulado") return resp(200, { ok: true, mensaje: "El proveedor Simulado no usa credenciales.", mascara: "" });
        const v = validarCredenciales(proveedor, solicitud.credenciales);
        if (!v.ok) return error(400, "datos", "Revisa los campos de las credenciales.", { errores: v.errores });
        const datos = cifrar(v.valor, deps.llave(), `facturacion:${proveedor}`);
        const mascara = enmascarar(proveedor, v.valor);
        const previa = await db.leer(`${RUTAS.credencial}/${modo}`);
        await db.escribir(`${RUTAS.secretos}/${modo}`, { proveedor, datos, ts: ahora(), por: yo.uid });
        await db.escribir(`${RUTAS.credencial}/${modo}`, { proveedor, mascara, ts: ahora(), por: yo.uid, porNombre: yo.nombre });
        // ROTAR llaves del MISMO proveedor no toca el historial de facturas ni los catálogos mapeados. Cambiar de proveedor sí invalida los IDs (son de otra cuenta).
        const cambioProveedor = !!(previa && previa.proveedor && previa.proveedor !== proveedor);
        if (cambioProveedor) { await db.escribir(`${RUTAS.catalogo}/${modo}`, null); await db.escribir(`${RUTAS.mapeo}/${modo}`, null); }
        await auditar({ accion: "guardar_credenciales_fiscales", motivo: `${previa ? "Rotación" : "Alta"} · ${prov.etiqueta} · ${modo === "produccion" ? "Producción" : "Pruebas"}` });
        return resp(200, { ok: true, mascara, modo, catalogosReiniciados: cambioProveedor });
      }
      /* ───────── probar conexión y SINCRONIZAR catálogos (el detalle técnico del proveedor se devuelve SOLO al administrador) ───────── */
      case "probar_conexion": case "sincronizar_catalogos": {
        const aj = await leerAjustes();
        const proveedor = solicitud.proveedor || aj.proveedor;
        const ad = deps.adaptadores[proveedor];
        if (!ad) return error(400, "datos", "Proveedor desconocido.");
        const modo = modoDe(solicitud.modo, aj.modo);
        try {
          const cred = await credencialesDe(proveedor, modo);
          const r = await ad.probarConexionYSincronizar({ ...contexto({ ...aj, modo }, cred) });
          const catalogos = conCatalogoVacio(r.catalogos);
          const tope = (l) => l.slice(0, 300).map((i) => limpiar({ ...i, id: String(i.id).slice(0, 100), etiqueta: String(i.etiqueta || i.id).slice(0, 200) }));
          const guardado = { ts: ahora(), proveedor, resoluciones: tope(catalogos.resoluciones), impuestos: tope(catalogos.impuestos), mediosPago: tope(catalogos.mediosPago), productos: tope(catalogos.productos), vendedores: tope(catalogos.vendedores) };
          await db.escribir(`${RUTAS.catalogo}/${modo}`, guardado);
          // ¿Lo ya mapeado sigue existiendo en la cuenta del proveedor?
          const m = await mapeoDe(modo);
          const chequeo = validarMapeo(m, { proveedor, ajustes: aj, catalogo: guardado });
          return resp(200, { ok: true, mensaje: r.mensaje || "Conexión correcta.", modo, catalogos: guardado, mapeoCompleto: chequeo.ok, mapeoPendiente: chequeo.errores });
        } catch (e) { const r = resumenError(e); return resp(200, { ok: false, error: r.codigo, mensaje: r.mensaje, detalle: r.detalle, estado: r.estado }); }
      }
      /* ───────── guardar el mapeo de catálogos (solo administrador; se valida contra el catálogo sincronizado) ───────── */
      case "guardar_mapeo": {
        const aj = await leerAjustes();
        const modo = modoDe(solicitud.modo, aj.modo);
        const catalogo = await db.leer(`${RUTAS.catalogo}/${modo}`);
        if (aj.proveedor !== "simulado" && !catalogo) return error(409, "catalogo", "Primero pulsa «Probar conexión y sincronizar catálogos».");
        const v = validarMapeo(solicitud.mapeo, { proveedor: aj.proveedor, ajustes: aj, catalogo: catalogo || { ...conCatalogoVacio(null) } });
        const m = conMapeoVacio(solicitud.mapeo);
        // Se guarda aunque falten cosas (para no perder lo ya elegido), pero se avisa qué falta.
        const limite = (x) => String(x || "").slice(0, 100);
        const limpio = { resolucion: limite(m.resolucion), impuestos: Object.fromEntries(Object.entries(m.impuestos).map(([k, x]) => [k, limite(x)])), mediosPago: Object.fromEntries(Object.entries(m.mediosPago).map(([k, x]) => [k, limite(x)])), producto: limite(m.producto), propina: limite(m.propina), vendedor: limite(m.vendedor), ts: ahora(), por: yo.uid };
        await db.escribir(`${RUTAS.mapeo}/${modo}`, limpio);
        await auditar({ accion: "guardar_mapeo_fiscal", motivo: `${aj.proveedor} · ${modo === "produccion" ? "Producción" : "Pruebas"}${v.ok ? "" : " · incompleto"}` });
        return resp(200, { ok: true, completo: v.ok, pendiente: v.errores, modo });
      }
      /* ───────── prueba de emisión (sandbox / simulado): un ciclo completo SIN tocar cuentas reales ni consumir folios de producción ───────── */
      case "prueba_emision": {
        const aj = await leerAjustes();
        if (aj.modo === "produccion" && aj.proveedor !== "simulado") return error(409, "produccion", "La prueba de emisión solo se hace en el ambiente de Pruebas. Cambia el ambiente y vuelve a intentar.");
        const chequeo = validarAjustes({ ...aj, activa: true }, { credencialConfigurada: aj.proveedor === "simulado" || !!(await db.leer(`${RUTAS.secretos}/${aj.modo}`)), hoy: fechaHoraBogota(ahora()).fecha });
        if (!chequeo.ok) return error(409, "configuracion", `Completa la configuración antes de probar: ${Object.values(chequeo.errores)[0]}`);
        const m = await mapeoDe(aj.modo);
        const mp = validarMapeo(m, { proveedor: aj.proveedor, ajustes: aj });
        if (!mp.ok) return error(409, "configuracion", `Falta mapear catálogos: ${Object.values(mp.errores)[0]}`);
        const idPrueba = `PRUEBA-${ahora().toString(36)}`;
        const cuenta = { id: idPrueba, mesa: 0, estado: "pagada", pagadaTs: ahora(), pagos: [{ monto: 10000, metodoPago: "efectivo" }], datosFiscales: null };
        const pedidos = [{ estado: "listo", items: [{ id: "prueba", name: "Prueba de emisión (Comandas)", qty: 1, price: 10000 }] }];
        const payload = construirPayload({ cuenta, pedidos, ajustes: aj, ahora: ahora() });
        try {
          const cred = await credencialesDe(aj.proveedor, aj.modo);
          const r = await deps.adaptadores[aj.proveedor].emitirDocumento({ ...contexto(aj, cred, { mapeo: m }), payload });
          await auditar({ accion: "prueba_emision_fiscal", motivo: `${aj.proveedor} · ${r.prefijo || ""}${r.numero || ""}`.slice(0, 300) });
          return resp(200, { ok: true, prueba: true, numero: r.numero, prefijo: r.prefijo, cufe: r.cufe, estadoProveedor: r.estadoProveedor, mensaje: "Ciclo de emisión completo." });
        } catch (e) { const er = resumenError(e); return resp(200, { ok: false, prueba: true, error: er.codigo, mensaje: er.mensaje, detalle: er.detalle, clase: er.clase }); }
      }
      /* ───────── emitir ───────── */
      case "emitir": {
        const cuentaId = solicitud.cuentaId;
        if (!cuentaIdValido(cuentaId)) return error(400, "datos", "Cuenta no válida.");
        const aj = await leerAjustes();
        if (aj.activa !== true) return error(409, "inactiva", "La facturación electrónica no está activada.");
        const mapeo = await mapeoDe(aj.modo);
        const chequeo = validarAjustes(aj, { credencialConfigurada: aj.proveedor === "simulado" || !!(await db.leer(`${RUTAS.secretos}/${aj.modo}`)), hoy: fechaHoraBogota(ahora()).fecha, propinaMapeada: !!mapeo.propina });
        if (!chequeo.ok) return error(409, "configuracion", `La configuración fiscal tiene un problema: ${Object.values(chequeo.errores)[0]}`);
        const chequeoMapeo = validarMapeo(mapeo, { proveedor: aj.proveedor, ajustes: aj });
        if (!chequeoMapeo.ok) return error(409, "configuracion", `Falta mapear catálogos del proveedor: ${Object.values(chequeoMapeo.errores)[0]}`);
        const ruta = `${RUTAS.documentos}/${cuentaId}`;
        const existente = await db.leer(ruta);
        const forzar = solicitud.forzar === true;
        const d0 = decidirEmision(existente, { ahora: ahora(), forzar, esAdmin });
        if (d0.accion === "devolver") return resp(200, { ok: true, repetido: true, documento: existente });
        if (d0.accion === "esperar") return error(409, "en_proceso", "Esta cuenta ya se está enviando. Espera unos segundos.", { documento: existente });
        if (d0.accion === "revisar") return error(409, "revisar", d0.motivo, { documento: existente });

        const cuenta = await db.leer(`cuentas/${cuentaId}`);
        if (!cuenta) return error(404, "cuenta", "No encontré esa cuenta.");
        if (cuenta.estado !== "pagada") return error(409, "cuenta", "La cuenta todavía no está pagada.");
        const pedidos = await db.pedidosDeCuenta(cuentaId);
        const payload = construirPayload({ cuenta: { ...cuenta, id: cuentaId }, pedidos, ajustes: aj, ahora: ahora() });
        if (payload.lineas.length === 0 || !(payload.totales.totalDocumento > 0)) return error(409, "vacia", "La cuenta no tiene valor para facturar.");
        if (aj.consumidorFinal === false && payload.cliente.consumidorFinal) return error(409, "datos", "Esta cuenta no tiene datos del cliente (cédula o NIT). Agrégalos para facturar, o activa «Permitir venta sin cédula» en la configuración.");

        // Reserva atómica: solo UNA solicitud pasa de aquí al proveedor, aunque lleguen dos al tiempo.
        const t0 = ahora();
        const reserva = await db.transaccion(ruta, (actual) => {
          const d = decidirEmision(actual, { ahora: t0, forzar, esAdmin });
          if (d.accion !== "emitir" && d.accion !== "reintentar") return undefined;
          const nuevo = { ...(actual || {}), cuentaId, estado: "procesando", ts: t0, proveedor: aj.proveedor, modo: aj.modo, referencia: payload.referencia, intentos: ((actual && actual.intentos) || 0) + 1, intentosAuto: solicitud.reintentoAuto === true && actual && actual.error && actual.error.reintentoAutomatico === true ? ((actual && actual.intentosAuto) || 0) + 1 : 0, solicitadaPor: yo.uid };
          delete nuevo.error;
          return nuevo;
        });
        if (!reserva.committed) {
          const ahoraDoc = reserva.valor;
          if (ahoraDoc && (ahoraDoc.estado === "emitida" || ahoraDoc.estado === "anulada")) return resp(200, { ok: true, repetido: true, documento: ahoraDoc });
          return error(409, "en_proceso", "Esta cuenta ya se está enviando. Espera unos segundos.", { documento: ahoraDoc });
        }
        let r;
        try {
          const cred = await credencialesDe(aj.proveedor, aj.modo);
          r = await deps.adaptadores[aj.proveedor].emitirDocumento({ ...contexto(aj, cred, { mapeo }), payload });
        } catch (e) {
          const er = resumenError(e);
          await db.parchar(ruta, { estado: "error", ts: ahora(), error: { ...er, ts: ahora() } });
          return resp(200, { ok: false, error: er.codigo, mensaje: er.mensaje, detalle: er.detalle, incierto: er.incierto, documento: await db.leer(ruta) });
        }
        // Desde aquí la factura YA existe en el proveedor: nada de lo que siga puede dejarla marcada como error (se facturaría dos veces).
        const sel = {}; CAMPOS_RESULTADO.forEach((k) => { if (r[k] !== undefined) sel[k] = r[k]; });
        await db.parchar(ruta, limpiar({ estado: "emitida", ...sel, emitidaTs: ahora(), emitidaPor: yo.uid, emitidaPorNombre: yo.nombre, totalDocumento: payload.totales.totalDocumento, payload }));
        try { await auditar({ accion: "emitir_factura", cuentaId, mesa: cuenta.mesa, monto: Math.round(payload.totales.totalDocumento), motivo: `${aj.proveedor} · ${sel.prefijo || ""}${sel.numero || ""}`.slice(0, 300) }); }
        catch (e) { console.error("facturacion: no se pudo escribir la bitácora", e && e.message); }
        return resp(200, { ok: true, documento: await db.leer(ruta) });
      }
      /* ───────── anular (Nota Crédito) — SOLO administrador ───────── */
      case "anular": {
        const cuentaId = solicitud.cuentaId;
        if (!cuentaIdValido(cuentaId)) return error(400, "datos", "Cuenta no válida.");
        const ruta = `${RUTAS.documentos}/${cuentaId}`;
        const doc = await db.leer(ruta);
        const motivo = String(solicitud.motivo || "").trim().slice(0, 300);
        const puede = puedeAnular(doc, { esAdmin, motivo });
        if (!puede.ok) return error(puede.codigo === "permiso" ? 403 : puede.codigo === "estado" ? 409 : 400, puede.codigo, puede.mensaje);
        if (doc.anulacion && doc.anulacion.estado === "incierto" && solicitud.forzar !== true) return error(409, "revisar", "El intento anterior de anular quedó en duda: revisa en el portal del proveedor si la Nota Crédito existe antes de reintentar.", { documento: doc });
        const t0 = ahora();
        const bloqueo = await db.transaccion(ruta, (a) => (a && a.estado === "emitida" && !(a.anulacion && a.anulacion.estado === "procesando" && t0 - (a.anulacion.ts || 0) < 120000) ? { ...a, anulacion: { estado: "procesando", ts: t0, por: yo.uid } } : undefined));
        if (!bloqueo.committed) return error(409, "en_proceso", "La anulación ya está en curso o la factura cambió de estado.");
        let r;
        try {
          const aj = await leerAjustes();
          const proveedor = doc.proveedor || aj.proveedor;
          const modoDoc = doc.modo || aj.modo;
          const cred = await credencialesDe(proveedor, modoDoc);
          r = await deps.adaptadores[proveedor].anularDocumento({ ...contexto({ ...aj, modo: modoDoc }, cred, { mapeo: await mapeoDe(modoDoc) }), documento: { ...doc, cuentaId }, motivo, payload: doc.payload });
        } catch (e) {
          const er = resumenError(e);
          await db.parchar(ruta, { anulacion: er.incierto ? { estado: "incierto", ts: ahora(), por: yo.uid, mensaje: er.mensaje } : null });
          return resp(200, { ok: false, error: er.codigo, mensaje: er.mensaje, detalle: er.detalle, incierto: er.incierto, documento: await db.leer(ruta) });
        }
        // Impacto en caja: se guarda el valor y los pagos que se REVERSAN, para que el cuadre y los reportes del día los descuenten.
        const cuentaAnulada = await db.leer(`cuentas/${cuentaId}`);
        await db.parchar(ruta, limpiar({ estado: "anulada", anulacion: { motivo, por: yo.uid, porNombre: yo.nombre, ts: ahora(), numeroNota: r.numeroNota, cufeNota: r.cufeNota, idProveedor: r.idProveedor, monto: Math.round(doc.totalDocumento || 0), pagos: (doc.payload && doc.payload.pagos) || [], turnoId: (cuentaAnulada && cuentaAnulada.turnoId) || undefined } }));
        try { await auditar({ accion: "anular_factura", cuentaId, monto: Math.round(doc.totalDocumento || 0), motivo: `${motivo} · NC ${r.numeroNota || ""}`.slice(0, 300), responsable: doc.emitidaPorNombre }); }
        catch (e) { console.error("facturacion: no se pudo escribir la bitácora", e && e.message); }
        return resp(200, { ok: true, documento: await db.leer(ruta) });
      }
      /* ───────── reenviar por correo ───────── */
      case "reenviar_correo": {
        const cuentaId = solicitud.cuentaId;
        if (!cuentaIdValido(cuentaId)) return error(400, "datos", "Cuenta no válida.");
        const ruta = `${RUTAS.documentos}/${cuentaId}`;
        const doc = await db.leer(ruta);
        if (!doc || doc.estado !== "emitida") return error(409, "estado", "Solo se reenvía una factura emitida.");
        const correo = String(solicitud.correo || (doc.payload && doc.payload.cliente && doc.payload.cliente.correo) || "").trim().toLowerCase();
        if (!correoOk(correo)) return error(400, "correo", "Escribe un correo válido.");
        const aj = await leerAjustes();
        try {
          const modoDoc = doc.modo || aj.modo;
          const cred = await credencialesDe(doc.proveedor || aj.proveedor, modoDoc);
          await deps.adaptadores[doc.proveedor || aj.proveedor].reenviarCorreo({ ...contexto({ ...aj, modo: modoDoc }, cred, { mapeo: await mapeoDe(modoDoc) }), documento: { ...doc, cuentaId }, correo });
          await db.parchar(ruta, { ultimoCorreo: { a: correo, ts: ahora(), por: yo.uid } });
          return resp(200, { ok: true, documento: await db.leer(ruta) });
        } catch (e) { const er = resumenError(e); return resp(200, { ok: false, error: er.codigo, mensaje: er.mensaje, detalle: er.detalle }); }
      }
      default: return error(400, "accion", "Acción desconocida.");
    }
  } catch (e) {
    // Fallo inesperado (por ejemplo, la llave maestra no está configurada): sin detalles internos hacia el navegador.
    console.error("facturacion:", e && e.codigo, e && e.message);
    if (e && (e.codigo === "sin_credenciales")) return error(409, "sin_credenciales", e.message);
    if (e && e.codigo === "cifrado") return error(409, "cifrado", e.message);
    if (e && /CLAVE_CIFRADO_FACTURACION/.test(e.message)) return error(503, "no_configurado", "Falta configurar la llave de cifrado en el servidor (CLAVE_CIFRADO_FACTURACION). Avísale a quien instaló la app.");
    return error(500, "interno", "No se pudo completar la operación. Inténtalo de nuevo.");
  }
}

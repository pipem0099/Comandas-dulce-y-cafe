import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { calcularAlertas } from "./alertas.js";
import { contextoErrores } from "./errores.js";
import { avisar } from "./avisos.jsx";
import {
  AlertTriangle,
} from "lucide-react";
import { aplicarMarca } from "./theme.js";
import { esExterna, etiquetaExterna } from "./logica.js";
import { subscribeShared, saveShared, subscribeCollection, subscribeCollectionSince, getCollectionAll, getCollectionRange, getRecord, saveRecord, saveRecords, deleteRecord, updateRecord, ajustarStock, observarSesion, cerrarSesion, updateShared, ultimoErrorDeEscritura, observarPendientes, borrarColeccion } from "./firebase.js";
import { TopBar, BarraInferior, Lateral, itemsNavegacion } from "./componentes/BarraSuperior.jsx";
import { useDispositivo } from "./useAncho.js";
import { instalarEnterSiguiente } from "./enterSiguiente.js";
import { PantallaCarga } from "./componentes/PantallaCarga.jsx";
import { AvisoRelevo } from "./pantallas/RelevoCaja.jsx";
import { AjustesPanel } from "./extras.jsx";
import { MenuEditor } from "./pantallas/Menu.jsx";
import { ReservasView } from "./pantallas/Reservas.jsx";
import { MesasEditor } from "./pantallas/Mesas.jsx";
import { Equipo } from "./pantallas/Equipo.jsx";
import { Respaldos } from "./pantallas/Respaldos.jsx";
import { guardarMarcaCache } from "./marcaCache.js";
import { DEFAULT_CONFIG, DEFAULT_MENU, DEFAULT_MESAS, VENTANA_MS } from "./constantes.js";
import { styles } from "./estilos.js";
import { AccesoDenegado, InicioSesion, SinAcceso } from "./pantallas/Acceso.jsx";
import { CajaView } from "./pantallas/Caja.jsx";
import { CocinaView } from "./pantallas/Cocina.jsx";
import { MeseroView } from "./pantallas/Mesero.jsx";
import { NOMBRES_EXTERNOS, dayKey, rolesDe, tieneRol } from "./utilidades.js";

export default function App() {
  const [role, setRole] = useState("mesero");
  const [menu, setMenu] = useState(DEFAULT_MENU);
  const [kioskoCocina, setKioskoCocina] = useState(false);
  useEffect(() => instalarEnterSiguiente(), []);
  const dispositivo = useDispositivo(); // (los hooks van arriba, antes de cualquier "return" anticipado)
  const fantasmasRef = useRef([]);   // ids de registros de inventario sin nombre (restos de insumos borrados)
  const insumosRef = useRef([]);
  const [orders, setOrders] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [turnos, setTurnos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [mesas, setMesas] = useState(DEFAULT_MESAS);
  const [insumos, setInsumos] = useState([]);
  const menuRef = useRef(DEFAULT_MENU);
  menuRef.current = menu;
  insumosRef.current = insumos;
  const [equipo, setEquipo] = useState([]); // directorio del equipo (nombre, roles, activo): lo leen todos para elegir a quién entregar la caja
  const [vista, setVista] = useState(null); // pantalla de administración abierta: menu | mesas | equipo | respaldos | ajustes
  const ultimaMarcaPublica = useRef("");
  const [sesion, setSesion] = useState(undefined); // undefined = comprobando · null = sin iniciar sesión
  const [perfil, setPerfil] = useState(undefined); // undefined = cargando · null = esta cuenta no tiene perfil
  const [loaded, setLoaded] = useState(false);
  const configRef = useRef(DEFAULT_CONFIG);
  const [, forceTick] = useState(0);
  // Si algo falla al guardar en Firebase (por ejemplo, se cortó el internet a
  // mitad de camino), esto deja de ser un error silencioso en la consola —
  // se muestra un aviso visible para que quien esté usando la app se entere
  // en el momento, en vez de descubrirlo días después con datos faltantes.
  const [errorGuardado, setErrorGuardado] = useState(null);
  // Cambios esperando subirse: si pasan unos segundos sin confirmarse (sin internet o conexión lenta) se avisa cuántos son.
  const [pendientes, setPendientes] = useState(0);
  const [pendientesLentos, setPendientesLentos] = useState(false);
  useEffect(() => observarPendientes(setPendientes), []);
  useEffect(() => {
    if (pendientes === 0) { setPendientesLentos(false); return undefined; }
    const t = setTimeout(() => setPendientesLentos(true), 5000);
    return () => clearTimeout(t);
  }, [pendientes > 0]);
  const avisarErrorGuardado = useCallback((msg) => {
    // Si Firebase rechazó el permiso (reglas sin publicar / rol sin acceso), decirlo claro en vez de culpar al internet.
    const sinPermiso = String(ultimoErrorDeEscritura() || "").toUpperCase().includes("PERMISSION");
    setErrorGuardado(sinPermiso ? "No se pudo guardar — esta cuenta no tiene permiso para escribir ahí. Pide al administrador publicar las reglas más recientes de la base de datos (database.rules.json)." : msg);
  }, []);
  // (el login de caja usa el mismo usuarioActual de arriba — ya no hay un estado separado)
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  // Los navegadores bloquean audio automático hasta que hay una interacción real
  // del usuario. Con el primer toque en cualquier parte de la app "despertamos"
  // el audio para que la campanita de cocina sí pueda sonar más adelante.
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.01);
        setTimeout(() => ctx.close(), 200);
      } catch (e) {}
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("click", unlock);
    };
    window.addEventListener("touchstart", unlock, { once: true });
    window.addEventListener("click", unlock, { once: true });
    return () => { window.removeEventListener("touchstart", unlock); window.removeEventListener("click", unlock); };
  }, []);

  // Estado de conexión real del navegador (sirve como indicador de "en vivo").
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // Suscripción en vivo a Firebase: cualquier cambio hecho desde otro dispositivo
  // (otro mesero, cocina o caja) se refleja aquí automáticamente, sin recargar.
  // Pedidos y cuentas solo se suscriben a los últimos VENTANA_DIAS (ver arriba)
  // — eso es lo único que hace falta para operar el día a día, y por eso
  // nunca pesa más aunque pasen los años. La ventana se refresca cada hora
  // para que siga corriendo con el tiempo en sesiones muy largas. Turnos,
  // menú, mesas y config son siempre chicos y se cargan completos.
  const [ventanaEpoch, setVentanaEpoch] = useState(0);
  useEffect(() => {
    const refrescar = setInterval(() => setVentanaEpoch((e) => e + 1), 60 * 60 * 1000);
    return () => clearInterval(refrescar);
  }, []);

  useEffect(() => {
    const unsub = observarSesion((u) => { setSesion(u); if (!u) setPerfil(null); });
    return () => unsub && unsub();
  }, []);
  // El perfil (nombre, roles, activo) de quien inició sesión. Si un administrador desactiva
  // la cuenta, esto cambia en vivo y la app se cierra sola para esa persona.
  useEffect(() => {
    if (!sesion) return;
    setPerfil(undefined);
    return subscribeShared(`perfiles/${sesion.uid}`, null, setPerfil);
  }, [sesion]);
  const accesoOk = !!(sesion && perfil && perfil.activo === true);
  useEffect(() => { if (accesoOk) return subscribeCollection("equipo", setEquipo); }, [accesoOk]);
  const usuarioActual = useMemo(
    () => (accesoOk ? { uid: sesion.uid, nombre: perfil.nombre, correo: perfil.correo || sesion.email, roles: rolesDe(perfil), propietario: perfil.propietario === true } : null),
    [accesoOk, sesion, perfil]
  );
  // Al entrar, cada quien cae directo en su sección: un mesero no tiene por qué terminar en Caja,
  // ni la tablet de cocina en Mesero. Un admin se queda donde estaba, porque tiene acceso a todo.
  const rolInicialAplicado = useRef(false);
  useEffect(() => {
    if (!usuarioActual) { rolInicialAplicado.current = false; return; }
    if (rolInicialAplicado.current) return;
    rolInicialAplicado.current = true;
    const m = tieneRol(usuarioActual, "mesero"), c = tieneRol(usuarioActual, "cajero"), k = tieneRol(usuarioActual, "cocina"), a = tieneRol(usuarioActual, "admin");
    if (a) return;
    if (k && !m && !c) setRole("cocina");
    else if (m && !c) setRole("mesero");
    else if (c && !m) setRole("caja");
  }, [usuarioActual]);
  const cerrarSesionYRecargar = async () => { await cerrarSesion(); window.location.reload(); };


  useEffect(() => {
    if (!accesoOk) return;
    const pending = new Set(["menu", "orders", "cuentas", "config", "turnos", "mesas", "inventario"]);
    const markLoaded = (key) => { pending.delete(key); if (pending.size === 0) setLoaded(true); };
    const desde = Date.now() - VENTANA_MS;

    const unsubs = [
      subscribeShared("menu", DEFAULT_MENU, (v) => { setMenu(v); markLoaded("menu"); }),
      subscribeCollectionSince("orders", "ts", desde, (v) => { setOrders(v); markLoaded("orders"); }),
      subscribeCollectionSince("cuentas", "ts", desde, (v) => { setCuentas(v); markLoaded("cuentas"); }),
      subscribeShared("config", DEFAULT_CONFIG, (v) => { setConfig({ ...DEFAULT_CONFIG, ...v }); markLoaded("config"); }),
      subscribeCollection("turnos", (v) => { setTurnos(v); markLoaded("turnos"); }),
      subscribeCollection("reservas", (v) => setReservas(v || [])),
      subscribeCollection("inventario", (v) => {
        // Un registro SIN nombre es un "fantasma": lo crea un descuento de stock sobre un insumo ya borrado.
        const reales = (v || []).filter((i) => i && i.nombre);
        fantasmasRef.current = (v || []).filter((i) => i && !i.nombre).map((i) => i.id);
        setInsumos(reales); markLoaded("inventario");
      }),
      subscribeShared("mesas", DEFAULT_MESAS, (v) => { setMesas(v && v.length > 0 ? v : DEFAULT_MESAS); markLoaded("mesas"); }),
    ];
    const clock = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => { unsubs.forEach((unsub) => unsub && unsub()); clearInterval(clock); };
  }, [ventanaEpoch, accesoOk]);

  // Limpieza automática (solo la hace un administrador): borra los registros de inventario sin nombre
  // que dejaron insumos eliminados antes de este arreglo.
  useEffect(() => {
    if (!loaded || !usuarioActual || !usuarioActual.roles.includes("admin")) return;
    const ids = fantasmasRef.current || [];
    if (ids.length === 0) return;
    fantasmasRef.current = [];
    ids.forEach((id) => deleteRecord("inventario", id));
  }, [loaded, insumos, usuarioActual]);

  // Historial completo bajo demanda: null hasta que alguien entra a Historial
  // o pide exportar/respaldar. Se pide UNA VEZ (no en vivo) y se combina con
  // lo que ya está cargado en vivo (que siempre tiene lo más reciente).
  const [historialCompleto, setHistorialCompleto] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const cargarHistorialCompleto = useCallback(async () => {
    if (historialCompleto || cargandoHistorial) return;
    setCargandoHistorial(true);
    const [todosOrders, todasCuentas] = await Promise.all([getCollectionAll("orders"), getCollectionAll("cuentas")]);
    setHistorialCompleto({ orders: todosOrders, cuentas: todasCuentas });
    setCargandoHistorial(false);
  }, [historialCompleto, cargandoHistorial]);
  // Combina el historial completo (si ya se pidió) con la ventana en vivo,
  // dejando que la ventana en vivo "gane" por ser más reciente.
  const mergeConVentana = (base, ventana) => {
    const byId = Object.fromEntries(base.map((r) => [r.id, r]));
    ventana.forEach((r) => { byId[r.id] = r; });
    return Object.values(byId);
  };
  const ordersParaHistorial = historialCompleto ? mergeConVentana(historialCompleto.orders, orders) : orders;
  const cuentasParaHistorial = historialCompleto ? mergeConVentana(historialCompleto.cuentas, cuentas) : cuentas;

  // Respaldo automático diario: cada vez que un administrador abre la app,
  // revisa si ya existe una copia del día de AYER (el de hoy todavía no ha
  // terminado). Si falta, la crea sola — solo trae los pedidos y cuentas de
  // ESE día puntual (no todo el historial), así el respaldo automático nunca
  // se vuelve más pesado sin importar cuántos años lleve funcionando esto.
  useEffect(() => {
    if (!usuarioActual || !tieneRol(usuarioActual, "admin") || !loaded) return;
    let cancelado = false;
    (async () => {
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dk = dayKey(ayer.getTime());
      const yaExiste = await getRecord(`respaldos/${dk}/hecho`);
      if (cancelado || yaExiste) return;
      const inicioDia = new Date(ayer); inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date(ayer); finDia.setHours(23, 59, 59, 999);
      const [cuentasDia, ordersDia] = await Promise.all([
        getCollectionRange("cuentas", "ts", inicioDia.getTime(), finDia.getTime()),
        getCollectionRange("orders", "ts", inicioDia.getTime(), finDia.getTime()),
      ]);
      if (cancelado) return;
      await saveShared(`respaldos/${dk}`, {
        hecho: true, generadoTs: Date.now(), dia: dk,
        cuentas: cuentasDia, orders: ordersDia, menu, mesas, config,
      });
    })();
    return () => { cancelado = true; };
  }, [usuarioActual, loaded]);

  const MSG_SIN_CONEXION = "No se pudo guardar — revisa tu conexión a internet e inténtalo de nuevo.";
  const persistMenu = useCallback(async (next) => { setMenu(next); const ok = await saveShared("menu", next); if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION); }, [avisarErrorGuardado]);
  configRef.current = config;
  // Solo se guardan los campos de la configuración que CAMBIARON (no el documento completo): así un
  // cajero que registra algo en el historial no toca la marca ni las estaciones, y las reglas de la
  // base de datos pueden pedir permisos distintos para cada campo.
  const persistConfig = useCallback(async (next) => {
    const prev = configRef.current || {};
    const cambios = {};
    Object.keys({ ...prev, ...next }).forEach((k) => {
      if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) cambios[k] = next[k] === undefined ? null : next[k];
    });
    setConfig(next);
    configRef.current = next;
    if (Object.keys(cambios).length === 0) return;
    const ok = await updateShared("config", cambios);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const persistMesas = useCallback(async (next) => { setMesas(next); const ok = await saveShared("mesas", next); if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION); }, [avisarErrorGuardado]);

  // Guardan UN registro a la vez (pedido / cuenta / turno), no la lista completa.
  const saveOrder = useCallback(async (order) => {
    setOrders((prev) => { const i = prev.findIndex((o) => o.id === order.id); if (i === -1) return [...prev, order]; const next = [...prev]; next[i] = order; return next; });
    const ok = await saveRecord("orders", order.id, order);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const saveOrdersMap = useCallback(async (recordsById) => {
    setOrders((prev) => { const byId = Object.fromEntries(prev.map((o) => [o.id, o])); Object.entries(recordsById).forEach(([id, val]) => { byId[id] = val; }); return Object.values(byId); });
    const ok = await saveRecords("orders", recordsById);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const saveCuenta = useCallback(async (cuenta) => {
    setCuentas((prev) => { const i = prev.findIndex((c) => c.id === cuenta.id); if (i === -1) return [...prev, cuenta]; const next = [...prev]; next[i] = cuenta; return next; });
    const ok = await saveRecord("cuentas", cuenta.id, cuenta);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const saveReserva = useCallback(async (r) => {
    setReservas((prev) => { const i = prev.findIndex((x) => x.id === r.id); if (i === -1) return [...prev, r]; const next = [...prev]; next[i] = r; return next; });
    const ok = await saveRecord("reservas", r.id, r);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const deleteReserva = useCallback(async (id) => {
    setReservas((prev) => prev.filter((x) => x.id !== id));
    const ok = await deleteRecord("reservas", id);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const saveTurno = useCallback(async (turno) => {
    setTurnos((prev) => { const i = prev.findIndex((t) => t.id === turno.id); if (i === -1) return [...prev, turno]; const next = [...prev]; next[i] = turno; return next; });
    const ok = await saveRecord("turnos", turno.id, turno);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);

  const saveInsumo = useCallback(async (ins) => {
    setInsumos((prev) => [...prev.filter((i) => i.id !== ins.id), ins]);
    const ok = await saveRecord("inventario", ins.id, ins);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const updateInsumo = useCallback(async (id, parcial) => {
    setInsumos((prev) => prev.map((i) => (i.id === id ? { ...i, ...parcial } : i)));
    const ok = await updateRecord("inventario", id, parcial);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);
  const deleteInsumo = useCallback(async (id) => {
    setInsumos((prev) => prev.filter((i) => i.id !== id));
    const ok = await deleteRecord("inventario", id);
    if (!ok) avisarErrorGuardado(MSG_SIN_CONEXION);
    // Quita el insumo de las recetas: si no, cada pedido lo seguiría descontando y lo "resucitaría".
    const m = menuRef.current || [];
    if (m.some((p) => (p.receta || []).some((r) => r.insumoId === id))) {
      persistMenu(m.map((p) => ((p.receta || []).some((r) => r.insumoId === id) ? { ...p, receta: p.receta.filter((r) => r.insumoId !== id) } : p)));
    }
  }, [avisarErrorGuardado, persistMenu]);
  // Suma o resta stock: { insumoId: +cantidad | -cantidad }. Usa increment en Firebase,
  // así dos pedidos simultáneos descuentan bien sin pisarse.
  const ajustarInventario = useCallback(async (mapa) => {
    // Solo se descuenta de insumos que existen (así uno borrado no reaparece).
    const existentes = new Set((insumosRef.current || []).map((i) => i.id));
    const entradas = Object.entries(mapa || {}).filter(([id, d]) => d && existentes.has(id));
    if (entradas.length === 0) return;
    setInsumos((prev) => prev.map((i) => (mapa[i.id] ? { ...i, stock: (Number(i.stock) || 0) + mapa[i.id] } : i)));
    const res = await Promise.all(entradas.map(([id, d]) => ajustarStock(id, d)));
    if (res.some((r) => !r)) avisarErrorGuardado(MSG_SIN_CONEXION);
  }, [avisarErrorGuardado]);

  const turnoAbierto = turnos.find((t) => t.estado === "abierto") || null;

  // Errores que la propia app registró (solo el administrador los lee): últimos 7 días
  const [errores, setErrores] = useState([]);
  useEffect(() => {
    if (!accesoOk || !usuarioActual || !tieneRol(usuarioActual, "admin")) { setErrores([]); return undefined; }
    return subscribeCollectionSince("errores", "ts", Date.now() - 7 * 24 * 3600 * 1000, setErrores);
  }, [accesoOk, usuarioActual]);
  const limpiarErrores = useCallback(async () => { await borrarColeccion("errores"); setErrores([]); }, []);
  // Con quién y en qué pantalla estaba la persona cuando algo falle (para que el registro sirva)
  useEffect(() => {
    contextoErrores({ uid: usuarioActual ? usuarioActual.uid : "", rol: usuarioActual ? Object.keys(usuarioActual.roles || {}).filter((r) => usuarioActual.roles[r]).join(",") : "", vista: vista || role });
  }, [usuarioActual, role, vista]);

  // Alertas del administrador (se recalculan cada minuto y cuando cambian los datos)
  const esAdminActual = !!usuarioActual && tieneRol(usuarioActual, "admin");
  const minutoActual = Math.floor(Date.now() / 60000);
  const alertas = useMemo(
    () => (esAdminActual ? calcularAlertas({ turnoAbierto, cuentas, menu, insumos, errores }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [esAdminActual, turnoAbierto, cuentas, menu, insumos, errores, minutoActual]
  );
  // Una alerta urgente NUEVA se anuncia con un aviso (la primera carga no, para no recibir una avalancha al entrar)
  const alertasVistas = useRef(null);
  useEffect(() => {
    if (!esAdminActual) return;
    const ids = new Set(alertas.map((a) => a.id));
    if (alertasVistas.current) alertas.filter((a) => a.nivel === "alta" && !alertasVistas.current.has(a.id)).forEach((a) => avisar({ texto: a.titulo, detalle: "mira la campana de alertas", tipo: "error", duracion: 7000 }));
    alertasVistas.current = ids;
  }, [alertas, esAdminActual]);

  // Color, tipografía y logo del negocio (Ajustes → Marca): se aplican en todos los dispositivos.
  useEffect(() => { aplicarMarca(config.marca); }, [config.marca]);
  // Se recuerda en este dispositivo para que la carga y el ingreso salgan ya con la marca.
  useEffect(() => { if (loaded) guardarMarcaCache(config.businessName, config.marca); }, [loaded, config.businessName, config.marca]);
  const esAdminApp = !!usuarioActual && tieneRol(usuarioActual, "admin");
  // Datos públicos del negocio (nombre y marca) para la pantalla de ingreso, que se ve antes de iniciar sesión.
  useEffect(() => {
    if (!loaded || !esAdminApp) return;
    const m = config.marca || {};
    const publica = { nombre: config.businessName || "", color: m.color || "terracota", fuente: m.fuente || "clasica", logo: m.logo || null };
    const huella = JSON.stringify(publica);
    if (ultimaMarcaPublica.current === huella) return;
    ultimaMarcaPublica.current = huella;
    updateShared("sistema", { marca: publica });
  }, [loaded, esAdminApp, config.businessName, config.marca]);
  // Directorio del equipo: los perfiles solo los lee un administrador, así que él mantiene una copia
  // (solo nombre, roles y si está activo) para que cada cajero pueda elegir a quién entregarle la caja.
  const ultimoEquipo = useRef("");
  useEffect(() => {
    if (!loaded || !esAdminApp) return;
    return subscribeCollection("perfiles", (lista) => {
      const mapa = {};
      lista.forEach((p) => { mapa[p.uid] = { uid: p.uid, nombre: p.nombre, roles: p.roles || {}, activo: p.activo === true }; });
      const huella = JSON.stringify(mapa);
      if (huella !== ultimoEquipo.current) { ultimoEquipo.current = huella; updateShared("equipo", mapa); }
    });
  }, [loaded, esAdminApp]);
  // Aviso público de que el negocio ya tiene propietario (oculta la opción de "primer ingreso").
  useEffect(() => {
    if (!loaded || !usuarioActual || !usuarioActual.propietario) return;
    getRecord("sistema/inicializado").then((v) => { if (v !== true) updateShared("sistema", { inicializado: true }); });
  }, [loaded, usuarioActual]);

  // nombres de los pedidos para llevar / domicilio (se usan en cocina, caja e historial)
  cuentasParaHistorial.forEach((c) => { if (esExterna(c)) NOMBRES_EXTERNOS[c.mesa] = etiquetaExterna(c); });

  if (sesion === undefined || (sesion && perfil === undefined)) {
    return <PantallaCarga />;
  }
  if (!sesion) return <InicioSesion />;
  if (!accesoOk) return <SinAcceso sesion={sesion} perfil={perfil} onSalir={cerrarSesionYRecargar} />;

  if (!loaded) {
    return <PantallaCarga />;
  }

  const movil = dispositivo === "movil";
  const ocultarNav = kioskoCocina && role === "cocina"; // pantalla completa de cocina: solo se ve la cocina
  const items = itemsNavegacion(usuarioActual);
  // Cada pantalla solo se dibuja si la persona tiene el rol que la autoriza (no basta con "estar" en ella)
  const puede = (id) => items.some((i) => i.id === id);
  const cambiarRol = (r) => { setVista(null); setRole(r); };
  // Las alertas llevan a una pantalla principal (caja, mesero…) o a una de administración (respaldos…)
  const irDesdeAlerta = (v) => { if (["menu", "mesas", "equipo", "respaldos", "ajustes"].includes(v)) setVista(v); else cambiarRol(v); };

  return (
    <div style={styles.app}>
      {movil && !ocultarNav && <TopBar config={config} usuarioActual={usuarioActual} online={online} alertas={alertas} onIrAlerta={irDesdeAlerta} onIr={setVista} onSalir={cerrarSesionYRecargar} />}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: movil ? "column" : "row" }}>
        {!movil && !ocultarNav && <Lateral items={items} role={role} setRole={cambiarRol} config={config} usuarioActual={usuarioActual} online={online} alertas={alertas} onIrAlerta={irDesdeAlerta} ancho={dispositivo === "escritorio"} onIr={setVista} onSalir={cerrarSesionYRecargar} />}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <AvisoRelevo turno={turnoAbierto} usuarioActual={usuarioActual} />
      {pendientes > 0 && pendientesLentos && !errorGuardado && (
        <div style={styles.pendientesBanner} role="status">
          <span style={styles.pendientesPunto} />
          <span style={{ flex: 1 }}>Sin conexión estable · <b>{pendientes}</b> {pendientes === 1 ? "cambio espera" : "cambios esperan"} subirse. Se guardan solos al volver el internet; no cierres la app.</span>
        </div>
      )}
      {errorGuardado && (
        <div style={styles.errorGuardadoBanner}>
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>{errorGuardado}</span>
          <button style={styles.errorGuardadoCerrar} onClick={() => setErrorGuardado(null)}>✕</button>
        </div>
      )}
      <div key={vista ? `v-${vista}` : `r-${role}`} className="vista-anim" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {vista && esAdminApp && (
        <>
          {vista === "menu" && <MenuEditor menu={menu} persistMenu={persistMenu} config={config} persistConfig={persistConfig} actor={usuarioActual.nombre} insumos={insumos} onClose={() => setVista(null)} />}
          {vista === "mesas" && <MesasEditor mesas={mesas} persistMesas={persistMesas} cuentas={cuentas} orders={orders} config={config} persistConfig={persistConfig} actor={usuarioActual.nombre} onClose={() => setVista(null)} />}
          {vista === "ajustes" && <div style={styles.screen}><AjustesPanel config={config} persistConfig={persistConfig} menu={menu} onClose={() => setVista(null)} /></div>}
          {vista === "equipo" && <div style={styles.screen}><Equipo config={config} persistConfig={persistConfig} usuarioActual={usuarioActual} onClose={() => setVista(null)} /></div>}
          {vista === "respaldos" && (
            <div style={styles.screen}>
              <Respaldos
                onClose={() => setVista(null)} menu={menu} orders={orders} cuentas={cuentas} config={config} turnos={turnos} mesas={mesas}
                persistConfig={persistConfig} usuarioActual={usuarioActual} ordersParaHistorial={ordersParaHistorial} cuentasParaHistorial={cuentasParaHistorial}
                historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto}
                errores={errores} limpiarErrores={limpiarErrores}
              />
            </div>
          )}
        </>
      )}
      {!vista && items.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center", color: "var(--c-5c5648-t)", fontSize: 14.5, lineHeight: 1.5 }}>
          Tu cuenta todavía no tiene ningún rol asignado. Pídele al administrador que te asigne uno (mesero, cajero o cocina) en Ajustes → Equipo y usuarios.
        </div>
      )}
      {!vista && role === "mesero" && puede("mesero") && (
        !tieneRol(usuarioActual, "mesero") && !tieneRol(usuarioActual, "admin") ? (
          <AccesoDenegado mensaje="Tu usuario no tiene el rol de Mesero — esto es Mesero." accion="Ir a Caja" onAccion={() => setRole("caja")} onCambiarUsuario={cerrarSesionYRecargar} />
        ) : (
          <MeseroView reservas={reservas}
            menu={menu} orders={orders} cuentas={cuentas} usuarioActual={usuarioActual} config={config}
            mesas={mesas} persistMesas={persistMesas}
            saveOrder={saveOrder} saveOrdersMap={saveOrdersMap} saveCuenta={saveCuenta}
            persistMenu={persistMenu} persistConfig={persistConfig}
            insumos={insumos} ajustarInventario={ajustarInventario}
          />
        )
      )}
      {!vista && role === "reservas" && puede("reservas") && <ReservasView reservas={reservas} saveReserva={saveReserva} deleteReserva={deleteReserva} mesas={mesas} usuarioActual={usuarioActual} />}
      {!vista && role === "cocina" && puede("cocina") && <CocinaView orders={orders} saveOrder={saveOrder} mesas={mesas} config={config} onKiosko={setKioskoCocina} />}
      {!vista && role === "caja" && puede("caja") && (
        !tieneRol(usuarioActual, "cajero") && !tieneRol(usuarioActual, "admin") ? (
          <AccesoDenegado mensaje="Tu usuario no tiene el rol de Cajero — esto es Caja." accion="Ir a Mesero" onAccion={() => setRole("mesero")} onCambiarUsuario={cerrarSesionYRecargar} />
        ) : (
          <CajaView
            menu={menu} orders={orders} cuentas={cuentas} saveCuenta={saveCuenta} saveOrdersMap={saveOrdersMap}
            turnos={turnos} turnoAbierto={turnoAbierto} saveTurno={saveTurno}
            config={config} persistConfig={persistConfig} usuarioActual={usuarioActual}
            mesas={mesas} persistMesas={persistMesas}
            equipo={equipo} insumos={insumos} saveInsumo={saveInsumo} updateInsumo={updateInsumo} deleteInsumo={deleteInsumo} ajustarInventario={ajustarInventario}
            ordersParaHistorial={ordersParaHistorial} cuentasParaHistorial={cuentasParaHistorial} onIr={setVista}
            historialCompleto={historialCompleto} cargandoHistorial={cargandoHistorial} cargarHistorialCompleto={cargarHistorialCompleto}
          />
        )
      )}
      </div>
        </div>
      </div>
      {movil && !ocultarNav && <BarraInferior items={items} role={role} setRole={cambiarRol} />}
    </div>
  );
}

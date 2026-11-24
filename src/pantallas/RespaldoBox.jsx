import { useState, useEffect, useRef } from "react";
import { Lock, Download, Upload, CalendarDays } from "lucide-react";
import { saveShared, getRecord, saveCollectionArray, mergeCollectionArray } from "../firebase.js";
import { InfoTip } from "../componentes/InfoTip.jsx";
import { GrupoSecciones, Seccion } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { descargarRespaldo } from "../exportar.js";
import { dateTimeLabel, dayKey } from "../utilidades.js";

export function RespaldoBox({ menu, orders, cuentas, config, turnos, mesas, deudas, persistConfig, usuarioActual, ordersParaHistorial, cuentasParaHistorial, historialCompleto, cargandoHistorial, cargarHistorialCompleto }) {
  const [restaurando, setRestaurando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const onArchivoElegido = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50_000_000) { setError("Ese archivo es demasiado grande para ser un respaldo."); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || typeof data !== "object" || !data.menu || !Array.isArray(data.orders) || !Array.isArray(data.cuentas) || !data.config || typeof data.config !== "object") throw new Error("Archivo incompleto");
        if (!data.orders.every((o) => o && typeof o === "object" && typeof o.id === "string" && typeof o.estado === "string" && typeof o.ts === "number")) throw new Error("Pedidos no válidos");
        if (!data.cuentas.every((c) => c && typeof c === "object" && typeof c.id === "string" && typeof c.estado === "string" && typeof c.ts === "number")) throw new Error("Cuentas no válidas");
        setArchivo(data);
        setConfirmando(true);
        setError("");
      } catch (err) {
        setError("Ese archivo no parece un respaldo válido.");
      }
    };
    reader.readAsText(file);
  };

  const confirmarRestauracion = async () => {
    if (!archivo) return;
    await saveShared("menu", archivo.menu);
    await saveCollectionArray("orders", archivo.orders);
    await saveCollectionArray("cuentas", archivo.cuentas);
    await saveCollectionArray("turnos", archivo.turnos || []);
    if (Array.isArray(archivo.deudas) && archivo.deudas.length > 0) await mergeCollectionArray("deudas", archivo.deudas);
    if (archivo.mesas && archivo.mesas.length > 0) await saveShared("mesas", archivo.mesas);
    const nuevoConfig = {
      ...archivo.config,
      auditLog: [{ ts: Date.now(), accion: "Restauró un respaldo desde archivo", actor: usuarioActual.nombre }, ...(archivo.config.auditLog || [])].slice(0, 500),
    };
    await saveShared("config", nuevoConfig);
    window.location.reload();
  };

  const descargarPendiente = useRef(false);
  // Una vez que el historial completo termina de cargar, dispara la descarga.
  useEffect(() => {
    if (descargarPendiente.current && historialCompleto) {
      descargarPendiente.current = false;
      descargarRespaldo({ menu, orders: ordersParaHistorial, cuentas: cuentasParaHistorial, config, turnos, mesas, deudas });
      persistConfig({ ...config, ultimaCopiaTs: Date.now() }); // para recordarte la próxima copia
    }
  }, [historialCompleto]);
  const onClickDescargar = () => {
    if (historialCompleto) {
      descargarRespaldo({ menu, orders: ordersParaHistorial, cuentas: cuentasParaHistorial, config, turnos, mesas, deudas });
      persistConfig({ ...config, ultimaCopiaTs: Date.now() }); // para recordarte la próxima copia
    } else {
      descargarPendiente.current = true;
      cargarHistorialCompleto();
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <GrupoSecciones>

        <Seccion titulo="Copia de seguridad completa" resumen="Descargar todo el historial" info={<InfoTip titulo="Copia de seguridad completa">
            Guarda un archivo en este dispositivo con todo el historial del negocio:
            <ul style={styles.respaldoLista}>
              <li>Menú, productos y precios</li>
              <li>Pedidos y cuentas, con sus pagos, propinas, descuentos y cancelaciones</li>
              <li>Turnos, arqueos y movimientos de caja</li>
              <li>Mesas y su ubicación en el plano</li>
              <li>Ajustes del negocio: nombre, marca y registro de seguridad</li>
            </ul>
            No cambia nada en la app. <b>No incluye</b> el inventario ni las cuentas de usuario del equipo.
          </InfoTip>}>
          <button style={styles.modoChoiceBtn} onClick={onClickDescargar} disabled={cargandoHistorial}>
            <Download size={15} /> {cargandoHistorial ? "Preparando respaldo completo…" : "Descargar copia de seguridad completa"}
          </button>
        </Seccion>

        <Seccion titulo="Restaurar desde un archivo" resumen="Volver a un respaldo anterior" info={<InfoTip titulo="Restaurar desde un archivo">
            Vuelve la app al estado de un archivo de respaldo. <b>Reemplaza</b> lo que hay ahora de: menú, pedidos, cuentas, turnos, mesas y ajustes.
            Todo lo registrado después de la fecha del archivo se pierde. No toca el inventario ni los usuarios. Recomendado: descarga una copia de lo actual antes de restaurar.
          </InfoTip>}>
          {!restaurando ? (
            <button style={styles.modoChoiceBtn} onClick={() => setRestaurando(true)}><Upload size={15} /> Elegir archivo de respaldo</button>
          ) : (
            <div className="despliega" style={styles.turnoBox}>
              <div style={styles.closeConfirmText}><b>Cuidado:</b> esto no se puede deshacer. Elige el archivo .json del respaldo.</div>
              <input ref={fileInputRef} type="file" accept="application/json" onChange={onArchivoElegido} />
              {error && <div style={styles.pinError}>{error}</div>}
              {confirmando && archivo && (
                <div style={styles.closeConfirmBox}>
                  <div style={styles.closeConfirmText}>
                    Este archivo es de "{archivo.config.businessName}", exportado el {dateTimeLabel(archivo.exportadoTs)}. ¿Restaurar y reemplazar todo lo actual?
                  </div>
                  {archivo.automatica && (
                    <div style={styles.pinError}>
                      Es una copia automática de un solo día ({archivo.dia}). Si la restauras, el historial completo se reemplaza por las ventas de ese único día y los turnos quedan vacíos.
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={styles.cancelEditBtn} onClick={() => { setConfirmando(false); setArchivo(null); }}>Cancelar</button>
                    <button style={{ ...styles.sendBtn, flex: 1 }} onClick={confirmarRestauracion}><Lock size={15} /> Sí, restaurar</button>
                  </div>
                </div>
              )}
              <button style={styles.cancelEditBtn} onClick={() => { setRestaurando(false); setArchivo(null); setConfirmando(false); setError(""); }}>Cerrar</button>
            </div>
          )}
        </Seccion>

        <RespaldosAutomaticosBox />
      </GrupoSecciones>
    </div>
  );
}

export function RespaldosAutomaticosBox(propsSeccion) {
  const [dias, setDias] = useState(null); // null = sin cargar todavía
  const [cargando, setCargando] = useState(false);

  const cargarLista = async () => {
    setCargando(true);
    const hoy = new Date();
    const candidatos = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
      candidatos.push(dayKey(d.getTime()));
    }
    const resultados = await Promise.all(candidatos.map((dk) => getRecord(`respaldos/${dk}`)));
    setDias(resultados.filter((r) => r && r.dia).sort((a, b) => b.dia.localeCompare(a.dia)));
    setCargando(false);
  };

  const descargarDia = (r) => {
    const data = { version: 2, exportadoTs: Date.now(), automatica: true, dia: r.dia, menu: r.menu || [], orders: r.orders || [], cuentas: r.cuentas || [], config: r.config || {}, turnos: [], mesas: r.mesas || [] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `respaldo_automatico_${r.dia}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Seccion {...propsSeccion} titulo="Copias automáticas" resumen="Los últimos 14 días" info={<InfoTip titulo="Copias automáticas">
        Cada día, la primera vez que un administrador abre la app, se guarda sola una copia del <b>día anterior</b>: sus cuentas y pedidos, más el menú, las mesas y los ajustes.
        Aquí puedes ver y descargar las de los últimos 14 días, útiles para consultar o recuperar lo de un día puntual.
        Cada una trae <b>un solo día</b> de ventas y no incluye turnos, así que no sirven para restaurar todo el negocio (para eso usa la copia completa).
      </InfoTip>}>
      {dias === null ? (
        <button style={styles.modoChoiceBtn} onClick={cargarLista} disabled={cargando}>
          <CalendarDays size={15} /> {cargando ? "Buscando…" : "Ver copias de los últimos 14 días"}
        </button>
      ) : dias.length === 0 ? (
        <div style={styles.cajaEmptyText}>Todavía no hay copias automáticas (se generan solas cada día que un admin abre la app — la de hoy se hace mañana).</div>
      ) : (
        <div className="despliega">
          {dias.map((r) => (
            <div key={r.dia} style={styles.turnoRow}>
              <span style={styles.cierreDate}>{r.dia} · {(r.cuentas || []).length} {(r.cuentas || []).length === 1 ? "cuenta" : "cuentas"}</span>
              <button style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, padding: "0 12px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }} onClick={() => descargarDia(r)}><Download size={13} /> Descargar</button>
            </div>
          ))}
        </div>
      )}
    </Seccion>
  );
}

/** Junta en un solo lugar las señales que ya existían regadas por la app
 * (cancelaciones, descuentos, descuadres de turno) para que el admin no
 * tenga que ir a buscarlas una por una — no es una acusación, es solo un
 * resumen para que decidas tú si algo amerita una conversación. */

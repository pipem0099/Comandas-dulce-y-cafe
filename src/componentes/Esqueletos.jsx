import React, { useEffect, useState } from "react";
import { styles } from "../estilos.js";
import { useDispositivo } from "../useAncho.js";

/*
 * Esqueletos de carga (skeleton) y aviso de conexión lenta.
 *  - Un esqueleto solo aparece si la carga tarda más de ~200 ms: si es instantánea no hay destello.
 *  - Si pasa mucho tiempo sin cargar, se explica qué pasa y se ofrece reintentar (antes la barra giraba sin fin).
 */

/** true cuando pasó `ms` desde que el componente apareció. */
export function useTranscurrido(ms) {
  const [paso, setPaso] = useState(ms <= 0);
  useEffect(() => {
    if (ms <= 0) return undefined;
    const t = setTimeout(() => setPaso(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return paso;
}

const Barra = ({ w = "100%", h = 14, r }) => <span className="esq" style={{ width: w, height: h, ...(r ? { borderRadius: r } : null) }} aria-hidden="true" />;

export function EsqueletoLista({ filas = 5 }) {
  return (
    <div role="status" aria-label="Cargando" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="esq-tarjeta" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Barra w={42} h={42} r={21} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Barra w={`${55 + ((i * 17) % 35)}%`} h={14} />
            <Barra w={`${30 + ((i * 11) % 30)}%`} h={11} />
          </div>
          <Barra w={56} h={16} />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoMesas() {
  return (
    <div role="status" aria-label="Cargando" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}><Barra w={86} h={34} r={17} /><Barra w={86} h={34} r={17} /><Barra w={86} h={34} r={17} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 12 }}>
        {Array.from({ length: 8 }).map((_, i) => <Barra key={i} h={92} r={16} />)}
      </div>
    </div>
  );
}

export function EsqueletoComandas() {
  return (
    <div role="status" aria-label="Cargando" style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="esq-tarjeta">
          <div style={{ display: "flex", justifyContent: "space-between" }}><Barra w="40%" h={16} /><Barra w="18%" h={14} /></div>
          <Barra w="85%" /><Barra w="70%" /><Barra w="60%" />
          <Barra h={38} r={12} />
        </div>
      ))}
    </div>
  );
}

/** Historial: filas con el nombre a la izquierda y el monto a la derecha, igual que las filas reales (ancho máx. 1050). */
export function EsqueletoHistorial({ filas = 8 }) {
  return (
    <div role="status" aria-label="Cargando" style={{ padding: "8px 16px", maxWidth: 1050 }}>
      <Barra w={64} h={12} />
      <div style={{ height: 12 }} />
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 0", borderBottom: "1px solid var(--c-ede7d8-o)" }}>
          <Barra w={`${28 + ((i * 13) % 22)}%`} h={14} />
          <span style={{ flex: 1 }} />
          <Barra w={92} h={11} />
          <Barra w={64} h={14} />
        </div>
      ))}
    </div>
  );
}

/** Inventario: tres cifras arriba, buscador, chips y tarjetas en la misma cuadrícula que la lista real. */
export function EsqueletoInventario() {
  return (
    <div role="status" aria-label="Cargando" style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}><Barra w={48} h={24} /><Barra w={72} h={11} /></div>)}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Barra w={140} h={40} r={12} /><Barra w={96} h={40} r={12} /></div>
      <Barra h={44} r={12} />
      <div style={{ display: "flex", gap: 8 }}><Barra w={64} h={34} r={17} /><Barra w={72} h={34} r={17} /><Barra w={88} h={34} r={17} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="esq-tarjeta" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}><Barra w="50%" h={15} /><Barra w="35%" h={11} /></div>
            <Barra w={80} h={22} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reportes: selector de rango, tarjetas de cifras y listas. */
export function EsqueletoReportes() {
  return (
    <div role="status" aria-label="Cargando" style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1050 }}>
      <div style={{ display: "flex", gap: 8 }}>{[0, 1, 2, 3].map((i) => <Barra key={i} w={84} h={34} r={17} />)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {[0, 1, 2].map((i) => <div key={i} className="esq-tarjeta"><Barra w="40%" h={11} /><Barra w="60%" h={26} /></div>)}
      </div>
      <div className="esq-tarjeta">{Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><Barra w={`${30 + ((i * 9) % 25)}%`} h={13} /><Barra w={60} h={13} /></div>)}</div>
    </div>
  );
}

/** Para <Suspense fallback=…>: no muestra nada los primeros 200 ms y luego el esqueleto (sin tapar toda la pantalla con la marca). */
export function CargandoContenido({ tipo = "lista", retraso = 200 }) {
  const ver = useTranscurrido(retraso);
  if (!ver) return <div style={{ flex: 1 }} />;
  return <div className="esq-aparece" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{tipo === "mesas" ? <EsqueletoMesas /> : tipo === "comandas" ? <EsqueletoComandas /> : tipo === "historial" ? <EsqueletoHistorial /> : tipo === "inventario" ? <EsqueletoInventario /> : tipo === "reportes" ? <EsqueletoReportes /> : <EsqueletoLista />}</div>;
}

/** Aviso cuando la carga se alarga: dice qué pasa y deja reintentar. */
export function AvisoLento({ despuesMs = 8000 }) {
  const lento = useTranscurrido(despuesMs);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const a = () => setOffline(false), b = () => setOffline(true);
    window.addEventListener("online", a); window.addEventListener("offline", b);
    return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, []);
  if (!lento) return null;
  return (
    <div role="status" className="esq-aparece" style={{ margin: "0 16px", padding: "12px 14px", borderRadius: 14, background: "var(--c-f1ecdd-b)", color: "var(--c-242019-t)", fontSize: 14, lineHeight: 1.4, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ flex: 1 }}>{offline ? "Sin internet. Cuando vuelva, la app carga sola." : "La conexión está lenta. Sigue cargando…"}</span>
      <button onClick={() => window.location.reload()} style={{ border: "none", borderRadius: 10, padding: "10px 14px", minHeight: 44, background: "var(--accent)", color: "var(--accent-fg, #fff)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Reintentar</button>
    </div>
  );
}

/** Mientras llegan los datos iniciales: la estructura de la app (barras) con esqueletos adentro, en vez de la pantalla de marca fija. */
export function CascaronCarga() {
  const dispositivo = useDispositivo();
  const movil = dispositivo === "movil";
  return (
    <div style={styles.app} role="status" aria-label="Cargando la app">
      {movil && <div style={{ ...styles.topBar, padding: "calc(10px + env(safe-area-inset-top)) 16px 10px" }}><Barra w={120} h={22} /><Barra w={34} h={34} r={17} /></div>}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: movil ? "column" : "row" }}>
        {!movil && <div style={{ width: dispositivo === "escritorio" ? 232 : 84, flexShrink: 0, padding: 16, display: "flex", flexDirection: "column", gap: 10, borderRight: "1px solid var(--chrome-line)" }}><Barra h={40} /><Barra h={40} /><Barra h={40} /></div>}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <AvisoLento />
          <EsqueletoMesas />
        </div>
      </div>
      {movil && <div style={{ padding: "6px 14px calc(10px + env(safe-area-inset-bottom))" }}><Barra h={56} r={26} /></div>}
    </div>
  );
}

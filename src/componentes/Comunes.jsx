import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { METODO_META } from "../constantes.js";
import { styles } from "../estilos.js";
import { money } from "../logica.js";

export function LogoMarca({ marca, size = 22 }) {
  if (marca && marca.logo) return <img src={marca.logo} alt="" style={{ height: size, width: "auto", maxWidth: size * 3, objectFit: "contain", flexShrink: 0 }} />;
  return <span style={styles.brandMark}>◆</span>;
}

/** Campo para escribir montos en pesos. A diferencia de un <input type="number">,
 * SÍ entiende el punto como separador de miles (como se escribe en Colombia:
 * "50.000") — solo guarda los dígitos por dentro y siempre muestra el número
 * formateado, así que nunca se puede escribir un monto ambiguo o mal leído. */
export function CampoMonto({ value, onChange, placeholder, style, autoFocus, onEnter, onBlur }) {
  // El cero "por defecto" no se muestra: el campo aparece vacío (con "0" tenue de guía), así que
  // al tocarlo no hay nada que borrar ni seleccionar — se escribe y listo.
  const [escribiendo, setEscribiendo] = useState(false);
  const digitos = (value || "").toString().replace(/\D/g, "");
  const esCero = !digitos || Number(digitos) === 0;
  const mostrado = esCero && !escribiendo ? "" : Number(digitos).toLocaleString("es-CO");
  return (
    <input
      autoFocus={autoFocus}
      style={style || styles.editInput}
      type="text"
      inputMode="numeric"
      placeholder={placeholder ?? "0"}
      value={mostrado}
      // con un monto ya escrito, al tocar se selecciona todo para poder reemplazarlo rápido
      onFocus={(e) => { if (!esCero) { try { e.target.select(); } catch (err) {} } }}
      onBlur={(e) => { setEscribiendo(false); if (onBlur) onBlur(e); }}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(e); } }}
      onChange={(e) => { setEscribiendo(true); onChange(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "")); }}
    />
  );
}

/** Banner discreto para activar notificaciones del sistema — se puede
 * descartar, y no vuelve a aparecer en esta sesión si ya se descartó o si
 * el navegador no las soporta. */
export function AvisoActivarNotificaciones() {
  const soportado = typeof window !== "undefined" && "Notification" in window;
  const [permiso, setPermiso] = useState(soportado ? Notification.permission : "unsupported");
  const [descartado, setDescartado] = useState(false);

  if (!soportado || permiso !== "default" || descartado) return null;

  return (
    <div style={styles.avisoNotifBanner}>
      <span>Activa las notificaciones para enterarte aunque cambies de pantalla (no llegan con el celular bloqueado).</span>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button style={styles.avisoNotifBtn} onClick={() => Notification.requestPermission().then(setPermiso)}>Activar</button>
        <button style={styles.avisoNotifCerrar} onClick={() => setDescartado(true)}>✕</button>
      </div>
    </div>
  );
}

export function MetodoPills({ selected, onSelect }) {
  return (
    <div style={styles.metodoPillsRow}>
      {Object.entries(METODO_META).map(([key, meta]) => {
        const Icon = meta.icon;
        const isSel = selected === key;
        return (
          <button key={key} style={{ ...styles.metodoPill, ...(isSel ? { background: "var(--chip-on-bg)", color: "var(--chip-on-fg)", border: "none", boxShadow: "inset 0 0 0 1px var(--chip-on-line)", fontWeight: 700 } : {}) }} onClick={() => onSelect(key)}>
            <Icon size={14} /> {meta.label}
          </button>
        );
      })}
    </div>
  );
}

/** Bloque desplegable (un mes, una sección): la cabecera siempre se ve, el contenido se abre al tocar.
 * `abierto` puede ser controlado desde fuera; si no, empieza según `inicialAbierto`. */
/** Flecha de desplegables: SIEMPRE la misma en toda la app, y gira al abrir (nada de ▲ ▼ ˅ ˄ en texto). */
export function Chevron({ abierto, size = 16, style }) {
  return <ChevronDown size={size} aria-hidden style={{ flexShrink: 0, transition: "transform .24s cubic-bezier(.32,.72,0,1)", transform: abierto ? "rotate(180deg)" : "none", ...style }} />;
}

export function Acordeon({ titulo, resumen, inicialAbierto = false, children }) {
  const [abierto, setAbierto] = useState(inicialAbierto);
  return (
    <div style={styles.acordeon}>
      <button style={styles.acordeonHead} onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left", minWidth: 0 }}>
          <span style={styles.acordeonTitulo}>{titulo}</span>
          {resumen && <span style={styles.acordeonResumen}>{resumen}</span>}
        </span>
        <Chevron abierto={abierto} size={18} />
      </button>
      {abierto && <div className="despliega" style={styles.acordeonBody}>{children}</div>}
    </div>
  );
}

/** Monto con signo: el cero va en gris y sin signo; solo se colorea cuando hay un valor real. */
export function MontoSigno({ valor, signo, positivo }) {
  const cero = !valor;
  return (
    <b style={{ color: cero ? "var(--c-9a9382-t)" : positivo ? "var(--pago-ok)" : "var(--c-c1442d-t)", fontWeight: cero ? 600 : 700 }}>
      {cero ? "" : signo}{money(valor)}
    </b>
  );
}

/** Fila de pastillas que se desliza de lado: se difumina el borde donde hay más contenido
 *  y la pastilla activa (aria-current="true") se centra sola. */
export function FilaTabs({ children, className, style }) {
  const ref = useRef(null);
  const [borde, setBorde] = useState({ izq: false, der: false });
  const medir = useCallback(() => {
    const el = ref.current; if (!el) return;
    const izq = el.scrollLeft > 4;
    const der = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setBorde((b) => (b.izq === izq && b.der === der ? b : { izq, der }));
  }, []);
  const activo = React.Children.toArray(children).findIndex((c) => c && c.props && c.props["aria-current"] === "true");
  // Centra la pastilla activa solo cuando cambia (no en cada actualización de datos).
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const on = el.querySelector('[aria-current="true"]');
    if (on) el.scrollTo({ left: Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2), behavior: "smooth" });
  }, [activo]);
  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir, children]);
  const mask = `linear-gradient(90deg, ${borde.izq ? "transparent, #000 28px" : "#000, #000 0"}, ${borde.der ? "#000 calc(100% - 28px), transparent" : "#000 100%, #000"})`;
  return (
    <div ref={ref} className={className} onScroll={medir} style={{ ...style, overflowX: "auto", WebkitMaskImage: mask, maskImage: mask }}>
      {children}
    </div>
  );
}


/*
 * Fila de dato en dos columnas, justificada de extremo a extremo (estilo tabla de Stripe):
 *  izquierda: nombre (peso 500) y, debajo, un detalle atenuado (12 px, opacidad .5)
 *  derecha:   el valor (dinero, cantidad o porcentaje) alineado al borde derecho, en una sola línea y con cifras tabulares.
 */
export function FilaDato({ nombre, detalle, valor, valorColor, onClick, ultima }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%", padding: "12px 0", background: "transparent", border: "none", borderBottom: ultima ? "none" : "1px solid var(--c-ede7d8-o)", textAlign: "left", cursor: onClick ? "pointer" : "default", color: "var(--c-242019-t)" }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 14.5, fontWeight: 500, color: "var(--c-242019-t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre}</span>
        {detalle ? <span style={{ fontSize: 12, color: "var(--c-242019-t)", opacity: "var(--detalle-op)" }}>{detalle}</span> : null}
      </span>
      <span style={{ flexShrink: 0, marginLeft: "auto", textAlign: "right", whiteSpace: "nowrap", fontSize: 14.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: valorColor || "var(--c-242019-t)" }}>{valor}</span>
    </Tag>
  );
}


/*
 * Menú contextual clásico de tres puntos (…) para acciones secundarias de una tarjeta.
 *   <MenuContextual acciones={[{ label: "Enviar clave nueva", onClick }, { label: "Desactivar", onClick, peligro: true }]} />
 * Se cierra al tocar fuera o con Esc. Las acciones en `false`/`null` no se muestran; sin acciones no dibuja nada.
 */
export function MenuContextual({ acciones, label = "Más acciones" }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    const esc = (e) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("touchstart", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  const visibles = (acciones || []).filter(Boolean);
  if (visibles.length === 0) return null;
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}
        style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: abierto ? "var(--btn2-bg)" : "transparent", color: "var(--btn2-mute)", cursor: "pointer", padding: 0 }}>
        <MoreHorizontal size={18} />
      </button>
      {abierto && (
        <div role="menu" className="anim-in" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40, minWidth: 210, padding: 6, background: "var(--c-fffdf8-b)", border: "1px solid var(--btn2-line)", borderRadius: 12, boxShadow: "var(--shadow-float)", display: "flex", flexDirection: "column", gap: 2 }}>
          {visibles.map((a) => (
            <button key={a.label} type="button" role="menuitem" onClick={() => { setAbierto(false); a.onClick(); }}
              style={{ textAlign: "left", minHeight: 44, padding: "0 12px", borderRadius: 8, border: "none", background: "transparent", color: a.peligro ? "var(--c-c1442d-t)" : "var(--c-242019-t)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

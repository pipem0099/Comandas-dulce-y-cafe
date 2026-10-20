import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
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
export function CampoMonto({ value, onChange, placeholder, style, autoFocus }) {
  const digitos = (value || "").toString().replace(/\D/g, "");
  const mostrado = digitos ? Number(digitos).toLocaleString("es-CO") : "";
  return (
    <input
      autoFocus={autoFocus}
      style={style || styles.editInput}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={mostrado}
      onFocus={(e) => { try { e.target.select(); } catch (err) {} }}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
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
          <button key={key} style={{ ...styles.metodoPill, ...(isSel ? { background: "var(--neon)", color: "var(--neon-text)", border: "1px solid var(--neon)", boxShadow: "var(--neon-glow)", fontWeight: 800 } : {}) }} onClick={() => onSelect(key)}>
            <Icon size={14} /> {meta.label}
          </button>
        );
      })}
    </div>
  );
}

/** Bloque desplegable (un mes, una sección): la cabecera siempre se ve, el contenido se abre al tocar.
 * `abierto` puede ser controlado desde fuera; si no, empieza según `inicialAbierto`. */
export function Acordeon({ titulo, resumen, inicialAbierto = false, children }) {
  const [abierto, setAbierto] = useState(inicialAbierto);
  return (
    <div style={styles.acordeon}>
      <button style={styles.acordeonHead} onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left", minWidth: 0 }}>
          <span style={styles.acordeonTitulo}>{titulo}</span>
          {resumen && <span style={styles.acordeonResumen}>{resumen}</span>}
        </span>
        <ChevronDown size={18} style={{ flexShrink: 0, transition: "transform .32s cubic-bezier(.32,.72,0,1)", transform: abierto ? "rotate(180deg)" : "none" }} />
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

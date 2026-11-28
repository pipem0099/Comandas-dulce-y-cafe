import React, { useState, useRef, useEffect, useCallback, Children, cloneElement, isValidElement } from "react";
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
        <button aria-label="Cerrar aviso de notificaciones" style={styles.avisoNotifCerrar} onClick={() => setDescartado(true)}>✕</button>
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
      <Despliegue abierto={abierto}><div style={styles.acordeonBody}>{children}</div></Despliegue>
    </div>
  );
}

/** Contenedor que abre y cierra animando altura y opacidad (curva de Apple): el resto de la pantalla se acomoda despacio, sin saltos. */
export function Despliegue({ abierto, siempre = false, children }) {
  const [montado, setMontado] = useState(!!abierto);
  useEffect(() => {
    if (siempre) return undefined;
    if (abierto) { setMontado(true); return undefined; }
    const t = setTimeout(() => setMontado(false), 420);
    return () => clearTimeout(t);
  }, [abierto]);
  return (
    <div className="despliegue" data-abierto={abierto ? "1" : "0"} aria-hidden={abierto ? undefined : true}>
      <div className="despliegue-in">{(siempre || abierto || montado) ? children : null}</div>
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
  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir, children]);
  const mask = `linear-gradient(90deg, ${borde.izq ? "transparent, #000 28px" : "#000, #000 0"}, ${borde.der ? "#000 calc(100% - 28px), transparent" : "#000 100%, #000"})`;
  // El indicador deslizante y el centrado de la pestaña activa los hace Segmentado.
  return (
    <Segmentado innerRef={ref} role="group" className={className} onScroll={medir} style={{ ...style, overflowX: "auto", WebkitMaskImage: mask, maskImage: mask }}>
      {children}
    </Segmentado>
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
    <Tag onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%", maxWidth: 640, padding: "12px 0", background: "transparent", border: "none", borderBottom: ultima ? "none" : "1px solid var(--c-ede7d8-o)", textAlign: "left", cursor: onClick ? "pointer" : "default", color: "var(--c-242019-t)" }}>
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

/** Tarjeta plegable (estilo iOS): cabecera táctil de 44 px con título, resumen opcional y flecha; el cuerpo se despliega con animación suave. */
export function Plegable({ titulo, resumen, inicialAbierto = false, estilo, estiloTitulo, children }) {
  const [abierto, setAbierto] = useState(inicialAbierto);
  return (
    <div style={estilo}>
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", minHeight: 44, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ ...estiloTitulo, margin: 0 }}>{titulo}</span>
          {resumen && <span style={{ fontSize: 12.5, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resumen}</span>}
        </span>
        <Chevron abierto={abierto} size={18} />
      </button>
      <Despliegue abierto={abierto} siempre>
        <div className="seccion-cuerpo" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>{children}</div>
      </Despliegue>
    </div>
  );
}

/**
 * Lista agrupada estilo iOS, sin íconos: una sola tarjeta con filas (título, resumen y flecha). Al tocar una fila se
 * despliega SOLO esa sección (las demás se pliegan), así ves únicamente lo que quieres editar.
 *   <GrupoSecciones><Seccion titulo="Marca" resumen="Logo y color">…</Seccion> …</GrupoSecciones>
 */
export function GrupoSecciones({ children, inicial = null }) {
  const [abierta, setAbierta] = useState(inicial);
  const hijos = Children.toArray(children).filter(isValidElement);
  return (
    <div className="grupo-secciones" style={{ borderRadius: 14, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", overflow: "hidden", flexShrink: 0, marginTop: 4 }}>
      {hijos.map((h, i) => cloneElement(h, {
        key: h.key || i, ultima: i === hijos.length - 1,
        abierta: abierta === (h.props.id || h.props.titulo),
        alternar: () => setAbierta((a) => (a === (h.props.id || h.props.titulo) ? null : (h.props.id || h.props.titulo))),
      }))}
    </div>
  );
}

export function Seccion({ titulo, resumen, info, abierta, alternar, ultima, children }) {
  return (
    <div style={{ position: "relative", borderBottom: ultima ? "none" : "1px solid var(--c-e4dfce-o)" }}>
      <button type="button" aria-expanded={!!abierta} onClick={alternar}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", minHeight: 52, padding: info ? "13px 14px 13px 14px" : "13px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", color: "var(--c-242019-t)", font: "inherit" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{titulo}</span>
          {resumen && <span style={{ fontSize: 11.5, color: "var(--c-8a8272-t)", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resumen}</span>}
        </span>
        <Chevron abierto={!!abierta} size={16} style={{ color: "var(--c-9a9382-t)", marginLeft: info ? 34 : 0 }} />
      </button>
      {info && <div style={{ position: "absolute", right: 38, top: 12, display: "flex" }}>{info}</div>}
      <Despliegue abierto={!!abierta} siempre>
        <div className="seccion-cuerpo" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "2px 14px 16px" }}>{children}</div>
      </Despliegue>
    </div>
  );
}

/** Control segmentado estilo iOS: un indicador único se desliza hasta la opción elegida.
Los hijos son botones con role="tab" y aria-selected; el color del indicador viene de --chip-on-*.
Se mide con ResizeObserver, así que sigue funcionando si cambian los textos o el ancho. */
export function Segmentado({ children, style, className = "", ariaLabel, innerRef, radio = 999, ...resto }) {
  const ref = useRef(null);
  const asignar = useCallback((el) => { ref.current = el; if (typeof innerRef === "function") innerRef(el); else if (innerRef) innerRef.current = el; }, [innerRef]);
  const [ind, setInd] = useState({ x: 0, y: 0, w: 0, h: 0, ok: false });
  const [anima, setAnima] = useState(false);
  const medir = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const on = c.querySelector('[aria-selected="true"], [aria-current="true"], [aria-current="page"]');
    if (!on) { setInd((p) => (p.ok ? { ...p, ok: false } : p)); return; }
    const x = on.offsetLeft, y = on.offsetTop, w = on.offsetWidth, h = on.offsetHeight;
    setInd((p) => (p.ok && p.x === x && p.y === y && p.w === w && p.h === h ? p : { x, y, w, h, ok: true }));
    // lleva la opción elegida al centro si la fila se desplaza
    if (c.scrollWidth > c.clientWidth + 2) {
      const destino = x - (c.clientWidth - w) / 2;
      if (Math.abs(c.scrollLeft - destino) > 24 && typeof c.scrollTo === "function") c.scrollTo({ left: Math.max(0, destino), behavior: "smooth" });
    }
  }, []);
  useEffect(() => {
    medir();
    const t = requestAnimationFrame(() => setAnima(true)); // el primer cuadro no se anima
    const c = ref.current;
    let ro = null, mo = null;
    if (c && typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(medir); ro.observe(c); Array.from(c.children).forEach((h) => ro.observe(h)); }
    if (c && typeof MutationObserver !== "undefined") { mo = new MutationObserver(medir); mo.observe(c, { attributes: true, attributeFilter: ["aria-selected", "aria-current"], subtree: true, childList: true }); }
    return () => { cancelAnimationFrame(t); if (ro) ro.disconnect(); if (mo) mo.disconnect(); };
  }, [medir]);
  return (
    <div ref={asignar} role="tablist" aria-label={ariaLabel} className={`seg ${className}`.trim()} style={{ position: "relative", ...style }} {...resto}>
      <span aria-hidden="true" className={`seg-ind${anima ? " seg-ind--anima" : ""}`} style={{ borderRadius: radio, opacity: ind.ok ? 1 : 0, width: ind.w, height: ind.h, top: ind.y, transform: `translateX(${ind.x}px)` }} />
      {children}
    </div>
  );
}

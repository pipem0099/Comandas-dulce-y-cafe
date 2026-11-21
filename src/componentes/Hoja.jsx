import React, { useCallback, useEffect, useRef, useState } from "react";

/*
 * Hoja flotante (bottom sheet) tipo iOS — la usan TODOS los diálogos de la app.
 *  - Celular: tarjeta flotante con márgenes y esquinas amplias que sube desde abajo.
 *  - Tablet / escritorio: ventana centrada que aparece con un leve zoom.
 *  - Entrada y salida suaves (curva iOS, sin rebote). Esc, tocar el fondo, la ✕ y arrastrar hacia abajo la cierran.
 *  - `children` puede ser una función: ({ cerrar }) => <>…</> — usa `cerrar()` en tus botones para que salga animada.
 * Los estilos (clases .hoja-v2*) están en index.css.
 */
const DUR_SALIDA = 320;
const CURVA = "cubic-bezier(.32,.72,0,1)";

// Pila de hojas abiertas: Esc y el gesto/botón "atrás" cierran SOLO la de encima (antes cerraban todas a la vez).
const pila = [];
let idSecuencia = 0;
let ignorarPop = 0;

export function Hoja({ onCerrar, children, ancho = 460, gap = 12, label, z = 60, padding, centro = false, vidrio = false }) {
  const [fase, setFase] = useState("entrando");
  const panelRef = useRef(null);
  const scrimRef = useRef(null);
  const scrollRef = useRef(null);
  const cerrando = useRef(false);
  const timer = useRef(null);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;

  // Entrada: un par de frames después de montar, para que el navegador anime desde la posición inicial.
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFase("abierta")));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Si algún campo con autoFocus se enfoca mientras la hoja aún entra, el navegador desplaza el panel (queda cortado
  // por arriba). Durante la entrada se mantiene todo en scrollTop = 0.
  useEffect(() => {
    const p = panelRef.current, sc = scrollRef.current;
    const arriba = () => { if (p && p.scrollTop) p.scrollTop = 0; if (p && p.scrollLeft) p.scrollLeft = 0; if (sc && sc.scrollTop) sc.scrollTop = 0; };
    arriba();
    if (p) p.addEventListener("scroll", arriba);
    if (sc) sc.addEventListener("scroll", arriba);
    const t = setTimeout(() => { arriba(); if (p) p.removeEventListener("scroll", arriba); if (sc) sc.removeEventListener("scroll", arriba); }, 650);
    return () => { clearTimeout(t); if (p) p.removeEventListener("scroll", arriba); if (sc) sc.removeEventListener("scroll", arriba); };
  }, []);

  // `mantenerEstilo === true` solo lo usa el arrastre (el panel ya viene animándose hacia abajo).
  const cerrar = useCallback((mantenerEstilo) => {
    if (cerrando.current) return;
    cerrando.current = true;
    if (mantenerEstilo !== true) {
      const p = panelRef.current, sc = scrimRef.current;
      if (p) { p.style.transition = ""; p.style.transform = ""; }
      if (sc) { sc.style.transition = ""; sc.style.opacity = ""; }
    }
    setFase("saliendo");
    timer.current = setTimeout(() => { if (onCerrarRef.current) onCerrarRef.current(); }, DUR_SALIDA);
  }, []);
  const cerrarPublico = useCallback(() => cerrar(false), [cerrar]);

  // Esc y "atrás" (gesto de borde en iPhone, botón en Android) cierran solo la hoja de encima.
  useEffect(() => {
    const yo = { id: ++idSecuencia, cerrar: () => cerrar(false), tieneEntrada: false };
    pila.push(yo);
    try { window.history.pushState({ hoja: yo.id }, ""); yo.tieneEntrada = true; } catch (e) { /* sin historial */ }
    const onKey = (e) => { if (e.key === "Escape" && pila[pila.length - 1] === yo) { e.stopPropagation(); cerrar(false); } };
    const onPop = () => {
      if (ignorarPop > 0) { ignorarPop--; return; }
      if (pila[pila.length - 1] === yo) { yo.tieneEntrada = false; cerrar(false); }
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      const i = pila.indexOf(yo); if (i >= 0) pila.splice(i, 1);
      // Se cerró con la ✕ o tocando el fondo: se quita la entrada que se había agregado al historial
      if (yo.tieneEntrada) { try { if (window.history.state && window.history.state.hoja === yo.id) { ignorarPop++; window.history.back(); } } catch (e) {} }
    };
  }, [cerrar]);

  // Arrastrar hacia abajo para cerrar (solo celular, con el dedo).
  useEffect(() => {
    const panel = panelRef.current, scrim = scrimRef.current, sc = scrollRef.current;
    if (!panel || !scrim) return undefined;
    if (centro) return undefined; // ventana centrada: no se arrastra hacia abajo
    if (window.matchMedia && window.matchMedia("(min-width: 700px)").matches) return undefined;

    let y0 = 0, lastY = 0, lastT = 0, dy = 0, vel = 0;
    let activo = false, arrastrando = false, desdeAgarre = false;

    const inicio = (e) => {
      if (e.touches.length !== 1 || cerrando.current) { activo = false; return; }
      activo = true; arrastrando = false; dy = 0; vel = 0;
      y0 = lastY = e.touches[0].clientY;
      lastT = performance.now();
      desdeAgarre = !!(e.target.closest && e.target.closest("[data-agarre]"));
    };
    const mueve = (e) => {
      if (!activo) return;
      const y = e.touches[0].clientY;
      const d = y - y0;
      if (!arrastrando) {
        const arriba = desdeAgarre || !sc || sc.scrollTop <= 0;
        if (arriba && d > 6) {
          arrastrando = true;
          panel.style.transition = "none";
          scrim.style.transition = "none";
        } else return;
      }
      if (e.cancelable) e.preventDefault();
      dy = d > 0 ? d : d * 0.12; // hacia arriba apenas cede (resistencia)
      const ahora = performance.now();
      const inst = (y - lastY) / Math.max(1, ahora - lastT);
      vel = vel * 0.6 + inst * 0.4;
      lastY = y; lastT = ahora;
      panel.style.transform = `translate3d(0, ${dy}px, 0)`;
      const h = panel.offsetHeight || 1;
      scrim.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / h));
    };
    const fin = () => {
      if (!activo) return;
      activo = false;
      if (!arrastrando) return;
      arrastrando = false;
      const h = panel.offsetHeight || 1;
      if (dy > h * 0.3 || vel > 0.6) {
        panel.style.transition = `transform ${DUR_SALIDA}ms ${CURVA}`;
        scrim.style.transition = `opacity ${DUR_SALIDA}ms ease`;
        panel.style.transform = "translate3d(0, 115%, 0)";
        scrim.style.opacity = "0";
        cerrar(true);
      } else {
        panel.style.transition = `transform .42s ${CURVA}`;
        scrim.style.transition = "opacity .42s ease";
        panel.style.transform = "";
        scrim.style.opacity = "";
        setTimeout(() => { panel.style.transition = ""; scrim.style.transition = ""; }, 460);
      }
    };

    panel.addEventListener("touchstart", inicio, { passive: true });
    panel.addEventListener("touchmove", mueve, { passive: false });
    panel.addEventListener("touchend", fin);
    panel.addEventListener("touchcancel", fin);
    return () => {
      panel.removeEventListener("touchstart", inicio);
      panel.removeEventListener("touchmove", mueve);
      panel.removeEventListener("touchend", fin);
      panel.removeEventListener("touchcancel", fin);
    };
  }, [cerrar, centro]);

  return (
    <div className={"hoja-v2 hoja-overlay-v2" + (centro ? " hoja-v2--centro" : "") + (vidrio ? " hoja-v2--vidrio" : "")} data-fase={fase} style={{ zIndex: z }}>
      <div ref={scrimRef} className="hoja-v2-scrim" onClick={cerrarPublico} />
      <div ref={panelRef} className="hoja-v2-panel" style={{ maxWidth: Math.min(ancho, 520) }} role="dialog" aria-modal="true" aria-label={label}>
        <div className="hoja-v2-agarre" data-agarre aria-hidden="true"><span /></div>
        <div ref={scrollRef} className="hoja-v2-scroll" style={{ gap, ...(padding ? { padding } : null) }}>
          {typeof children === "function" ? children({ cerrar: cerrarPublico }) : children}
        </div>
      </div>
    </div>
  );
}

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

export function Hoja({ onCerrar, children, ancho = 460, gap = 12, label, z = 60, padding }) {
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

  // Esc cierra
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") cerrar(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cerrar]);

  // Arrastrar hacia abajo para cerrar (solo celular, con el dedo).
  useEffect(() => {
    const panel = panelRef.current, scrim = scrimRef.current, sc = scrollRef.current;
    if (!panel || !scrim) return undefined;
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
  }, [cerrar]);

  return (
    <div className="hoja-v2 hoja-overlay-v2" data-fase={fase} style={{ zIndex: z }}>
      <div ref={scrimRef} className="hoja-v2-scrim" onClick={cerrarPublico} />
      <div ref={panelRef} className="hoja-v2-panel" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={label}>
        <div className="hoja-v2-agarre" data-agarre aria-hidden="true"><span /></div>
        <div ref={scrollRef} className="hoja-v2-scroll" style={{ gap, ...(padding ? { padding } : null) }}>
          {typeof children === "function" ? children({ cerrar: cerrarPublico }) : children}
        </div>
      </div>
    </div>
  );
}

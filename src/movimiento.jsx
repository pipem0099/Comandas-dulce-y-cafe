import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hoja } from "./componentes/Hoja.jsx";
import { vibrar } from "./theme.js";

/*
 * Movimiento tipo iOS: piezas reutilizables para que nada cambie "de golpe".
 *  - <Transicion>        cambia de contenido con fundido cruzado, deslizamiento corto y altura animada
 *  - <NumeroAnimado>     cifras que ruedan hasta su valor nuevo
 *  - useFlip             las tarjetas de una lista se deslizan a su nuevo lugar (en vez de saltar)
 *  - <FilaDeslizable>    deslizar una tarjeta para actuar + mantener pulsado para ver más acciones
 *  - useDeslizarHorizontal  deslizar de lado para cambiar de pestaña o de día
 *  - <HojaAcciones>      menú de acciones al mantener pulsado (hoja inferior con desenfoque)
 *  - <Rueda>             selector de rueda con imán (hora, minutos…)
 * Todo respeta "reducir movimiento" del sistema. Los estilos están en index.css (bloque "Movimiento").
 */

export const reducirMovimiento = () => {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
};

/* ───────────────────────── Transición entre contenidos ─────────────────────────
 * <Transicion clave={tab} indice={posición}>…</Transicion>
 * Cuando `clave` cambia, el contenido anterior se queda un instante como "foto" (copia del DOM, sin volver a montar
 * nada) mientras se funde hacia afuera y el nuevo entra deslizándose desde el lado correcto. `indice` (número) decide
 * la dirección: si crece entra desde la derecha. La altura del contenedor se anima, así la pantalla no da un salto.
 * `altura={false}` para contenedores que llenan la pantalla (flex) y no deben animar su alto. */
export function Transicion({ clave, indice, altura = true, modo = "fundido", children, className = "", style, estiloDentro }) {
  const caja = useRef(null);
  const dentro = useRef(null);
  const claveAnt = useRef(clave);
  const indiceAnt = useRef(indice);
  const foto = useRef(null);
  const altoAnt = useRef(0);
  const dir = useRef(0);
  const hubo = useRef(false);
  const timer = useRef(null);

  // Durante el render el DOM todavía es el de la clave anterior: ahí se toma la "foto" del contenido que se va.
  if (claveAnt.current !== clave) {
    if (!foto.current && dentro.current) {
      try { foto.current = dentro.current.cloneNode(true); altoAnt.current = caja.current ? caja.current.offsetHeight : dentro.current.offsetHeight; } catch (e) { foto.current = null; }
    }
    dir.current = typeof indice === "number" && typeof indiceAnt.current === "number" ? Math.sign(indice - indiceAnt.current) : 0;
    hubo.current = true;
  }

  useLayoutEffect(() => {
    if (claveAnt.current === clave) return undefined;
    claveAnt.current = clave;
    indiceAnt.current = indice;
    const f = foto.current; foto.current = null;
    const c = caja.current, nuevo = dentro.current;
    if (!c || !nuevo || reducirMovimiento()) return undefined;
    clearTimeout(timer.current);
    Array.from(c.children).forEach((n) => { if (n.classList && n.classList.contains("trans-sale")) c.removeChild(n); });
    c.classList.add("trans-activa");
    if (f) {
      f.classList.remove("trans-entra");
      f.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      f.setAttribute("aria-hidden", "true");
      try { f.setAttribute("inert", ""); } catch (e) { /* sin inert */ }
      f.classList.add("trans-sale");
      f.style.setProperty("--dir", String(dir.current));
      // La posición se fija en línea (no depende de la hoja de estilos): la copia que se va NUNCA debe ocupar sitio en el flujo.
      f.style.position = "absolute"; f.style.left = "0"; f.style.right = "0"; f.style.top = "0";
      f.style.pointerEvents = "none"; f.style.zIndex = "0";
      if (!altura) f.style.bottom = "0";
      c.appendChild(f);
      const quitar = () => { if (f.parentNode) f.parentNode.removeChild(f); };
      f.addEventListener("animationend", quitar, { once: true });
      setTimeout(quitar, 600);
    }
    const h0 = altoAnt.current;
    let animoAltura = false;
    if (altura && h0) {
      const h1 = c.offsetHeight; // alto natural de la caja (sin altura fija todavía)
      if (Math.abs(h1 - h0) > 2) {
        c.style.transition = "none"; c.style.height = h0 + "px"; c.style.overflow = "hidden";
        void c.offsetHeight; // fuerza el cálculo para que arranque desde la altura anterior
        c.style.transition = "height .44s cubic-bezier(.32,.72,0,1)"; c.style.height = h1 + "px";
        animoAltura = true;
      }
    }
    timer.current = setTimeout(() => {
      if (animoAltura) { c.style.height = ""; c.style.overflow = ""; c.style.transition = ""; } // solo lo que esta transición puso (un `height` fijo del llamador se respeta)
      c.classList.remove("trans-activa");
    }, 480);
    return undefined;
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div ref={caja} className={("trans " + (modo === "fundido" ? "trans--fundido " : "") + className).trim()} style={{ position: "relative", display: "flow-root", ...style }}>
      <div key={String(clave)} ref={dentro} className={hubo.current ? "trans-entra" : undefined} style={{ ...estiloDentro, "--dir": dir.current, "--dirabs": Math.abs(dir.current) }}>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── Números que ruedan ───────────────────────── */
export function NumeroAnimado({ valor, formato, ms = 560 }) {
  const n = Number(valor) || 0;
  const [mostrado, setMostrado] = useState(n);
  const actual = useRef(n);
  useEffect(() => {
    if (reducirMovimiento() || actual.current === n) { actual.current = n; setMostrado(n); return undefined; }
    const a = actual.current, t0 = performance.now();
    let raf = 0;
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const v = p >= 1 ? n : a + (n - a) * (1 - Math.pow(1 - p, 3));
      actual.current = v; setMostrado(v);
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  const f = formato || ((x) => String(x));
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{f(Math.round(mostrado))}</span>;
}

/* ───────────────────────── Listas que se reacomodan con movimiento (FLIP) ─────────────────────────
 * useFlip(ref): los hijos directos con data-flip="id" se deslizan a su nueva posición cuando la lista cambia. */
export function useFlip(ref) {
  const pos = useRef(new Map());
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    let escala = 1;
    try { escala = parseFloat(getComputedStyle(c).zoom || "1") || 1; } catch (e) { /* sin zoom */ }
    const hijos = Array.from(c.children).filter((h) => h.dataset && h.dataset.flip);
    if (hijos.length > 80 || escala !== 1) { pos.current = new Map(); return; }
    const anima = !reducirMovimiento();
    const nuevo = new Map();
    hijos.forEach((h) => {
      const base = h.offsetParent === c ? { x: 0, y: 0 } : { x: c.offsetLeft, y: c.offsetTop };
      const x = h.offsetLeft - base.x, y = h.offsetTop - base.y;
      const k = h.dataset.flip;
      nuevo.set(k, { x, y });
      const p = pos.current.get(k);
      if (anima && p && (p.x !== x || p.y !== y) && typeof h.animate === "function") {
        h.animate([{ transform: `translate(${p.x - x}px, ${p.y - y}px)` }, { transform: "none" }], { duration: 440, easing: "cubic-bezier(.32,.72,0,1)" });
      }
    });
    pos.current = nuevo;
  });
}

/* ───────────────────────── Fila deslizable + mantener pulsado ─────────────────────────
 *  derecha:   acción que aparece al deslizar la tarjeta hacia la IZQUIERDA (queda a la derecha)
 *  izquierda: acción que aparece al deslizar hacia la DERECHA
 *  cada acción: { texto, icono: Icono, color, onAccion }
 *  onMantener: se llama al mantener pulsada la tarjeta (o clic derecho con mouse)
 * Con `touch-action: pan-y` el scroll vertical sigue normal y el gesto horizontal es solo de la tarjeta. */
const UMBRAL = 92;
export function FilaDeslizable({ children, izquierda, derecha, onMantener, radio = 16, style, className = "", ...resto }) {
  const cara = useRef(null);
  const g = useRef({ x0: 0, y0: 0, dx: 0, eje: null, activo: false, armado: false, movido: false, mantuvo: 0 });
  const timer = useRef(null);
  const [lado, setLado] = useState(0);       // 1 = se ve la acción de la izquierda, -1 = la de la derecha
  const [armado, setArmado] = useState(false);

  const limpiarTimer = () => { clearTimeout(timer.current); timer.current = null; };
  useEffect(() => limpiarTimer, []);

  const inicio = (e) => {
    if (e.touches.length !== 1) { g.current.activo = false; return; }
    const t = e.touches[0];
    Object.assign(g.current, { x0: t.clientX, y0: t.clientY, dx: 0, eje: null, activo: true, armado: false, movido: false });
    if (cara.current) cara.current.style.transition = "none";
    const dentroDeControl = e.target.closest && e.target.closest("a, button, input, textarea, select");
    if (onMantener && !dentroDeControl) {
      limpiarTimer();
      timer.current = setTimeout(() => {
        if (!g.current.activo || g.current.eje === "x") return;
        g.current.mantuvo = Date.now(); g.current.activo = false;
        vibrar(18); onMantener();
      }, 480);
    }
  };
  const mueve = (e) => {
    const s = g.current;
    if (!s.activo) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x0, dy = t.clientY - s.y0;
    if (s.eje === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.eje = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      limpiarTimer();
      if (s.eje === "y") { s.activo = false; return; }
    }
    if (s.eje !== "x") return;
    s.movido = true;
    const hay = dx > 0 ? izquierda : derecha;
    // sin acción de ese lado: casi no cede (resistencia); con acción: sigue al dedo y se frena un poco pasado el umbral
    let v = dx;
    if (!hay) v = dx * 0.12;
    else if (Math.abs(dx) > UMBRAL) v = Math.sign(dx) * (UMBRAL + (Math.abs(dx) - UMBRAL) * 0.35);
    s.dx = v;
    if (cara.current) cara.current.style.transform = `translate3d(${v}px,0,0)`;
    const nl = hay ? (dx > 0 ? 1 : -1) : 0;
    setLado((p) => (p === nl ? p : nl));
    const arm = !!hay && Math.abs(dx) >= UMBRAL;
    if (arm !== s.armado) { s.armado = arm; setArmado(arm); if (arm) vibrar(10); }
  };
  const fin = () => {
    const s = g.current;
    limpiarTimer();
    const c = cara.current;
    const accion = s.armado ? (s.dx > 0 ? izquierda : derecha) : null;
    const habiaGesto = s.eje === "x";
    s.activo = false; s.eje = null;
    if (!habiaGesto || !c) return;
    if (accion) {
      c.style.transition = "transform .2s cubic-bezier(.32,.72,0,1)";
      c.style.transform = `translate3d(${s.dx > 0 ? 110 : -110}%,0,0)`;
      setTimeout(() => {
        accion.onAccion();
        c.style.transition = "none"; c.style.transform = "";
        setLado(0); setArmado(false);
      }, 190);
    } else {
      c.style.transition = "transform .55s var(--resorte-vivo)";
      c.style.transform = "";
      setLado(0); setArmado(false);
    }
  };
  // Si hubo deslizamiento o pulsación larga, el "clic" que sigue no debe activar el botón de debajo
  const bloquearClic = (e) => {
    const s = g.current;
    if (s.movido || Date.now() - s.mantuvo < 700) { e.preventDefault(); e.stopPropagation(); s.movido = false; }
  };
  const menuContexto = (e) => {
    if (!onMantener) return;
    e.preventDefault();
    if (Date.now() - g.current.mantuvo < 900) return; // el mismo gesto ya abrió el menú
    g.current.mantuvo = Date.now(); onMantener();
  };

  const capa = (a, izq) => a ? (
    <div aria-hidden="true" className="fila-desl-capa" data-on={lado === (izq ? 1 : -1) ? "1" : "0"} data-armado={armado ? "1" : "0"}
      style={{ background: a.color, justifyContent: izq ? "flex-start" : "flex-end" }}>
      <span className="fila-desl-accion">{a.icono ? <a.icono size={20} /> : null}<b>{a.texto}</b></span>
    </div>
  ) : null;

  return (
    <div data-gesto="fila" className={("fila-desl " + className).trim()} style={{ borderRadius: radio, ...style }} {...resto}>
      {capa(izquierda, true)}
      {capa(derecha, false)}
      <div ref={cara} className="fila-desl-cara" style={{ borderRadius: radio }}
        onTouchStart={inicio} onTouchMove={mueve} onTouchEnd={fin} onTouchCancel={fin}
        onClickCapture={bloquearClic} onContextMenu={menuContexto}>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── Deslizar de lado (cambiar de pestaña / día) ─────────────────────────
 * Solo cuenta un gesto claramente horizontal y rápido; se ignora cerca de los bordes de la pantalla (gesto "atrás" de
 * iOS), dentro de campos, hojas, filas deslizables y de cualquier fila que ya se desplace de lado.
 * `soloEn`: selector opcional; el gesto solo vale si empieza dentro de un elemento que lo cumpla. */
export function useDeslizarHorizontal(ref, { onIzq, onDer, activo = true, soloEn } = {}) {
  const cb = useRef({});
  cb.current = { onIzq, onDer };
  useEffect(() => {
    const el = ref.current;
    if (!el || !activo) return undefined;
    let s = null;
    const inicio = (e) => {
      s = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < 24 || t.clientX > window.innerWidth - 24) return;
      const tg = e.target;
      if (!tg || !tg.closest) return;
      if (tg.closest("[data-gesto=fila], input, textarea, select, [role=dialog], [contenteditable=true]")) return;
      if (soloEn && !tg.closest(soloEn)) return;
      for (let n = tg; n && n !== el; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 2) {
          let ox = ""; try { ox = getComputedStyle(n).overflowX; } catch (err) { /* nada */ }
          if (ox === "auto" || ox === "scroll") return;
        }
      }
      s = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const fin = (e) => {
      if (!s) return;
      const t = e.changedTouches && e.changedTouches[0];
      const ini = s; s = null;
      if (!t) return;
      const dx = t.clientX - ini.x, dy = t.clientY - ini.y;
      if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.5 || Date.now() - ini.t > 650) return;
      if (dx < 0) { if (cb.current.onIzq) cb.current.onIzq(); } else if (cb.current.onDer) cb.current.onDer();
    };
    const cancelar = () => { s = null; };
    el.addEventListener("touchstart", inicio, { passive: true });
    el.addEventListener("touchend", fin, { passive: true });
    el.addEventListener("touchcancel", cancelar, { passive: true });
    return () => { el.removeEventListener("touchstart", inicio); el.removeEventListener("touchend", fin); el.removeEventListener("touchcancel", cancelar); };
  }, [ref, activo, soloEn]);
}

/* ───────────────────────── Menú de acciones (mantener pulsado) ─────────────────────────
 * acciones: [{ texto, icono, onClick, peligro, abre }]  — `abre` = abre otra ventana (se espera a que esta termine de cerrarse) */
export function HojaAcciones({ titulo, subtitulo, acciones, onCerrar }) {
  return (
    <Hoja onCerrar={onCerrar} ancho={420} gap={8} label={titulo} z={90}>
      {({ cerrar }) => (
        <>
          <div style={{ padding: "2px 4px 4px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: 12.5, color: "var(--c-8a8272-t)", marginTop: 2 }}>{subtitulo}</div>}
          </div>
          <div className="acciones-lista">
            {(acciones || []).filter(Boolean).map((a) => {
              const Icono = a.icono;
              return (
                <button key={a.texto} type="button" className="accion-fila fila-tap" data-peligro={a.peligro ? "1" : "0"}
                  onClick={() => { cerrar(); vibrar(8); if (a.abre) setTimeout(a.onClick, 340); else a.onClick(); }}>
                  {Icono ? <Icono size={18} strokeWidth={1.9} /> : null}<span>{a.texto}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Hoja>
  );
}

/* ───────────────────────── Rueda con imán (estilo selector de iOS) ─────────────────────────
 * opciones: [{ v, label }] · valor: v elegido · onChange(v) se llama cuando la rueda se detiene */
const ALTO_OP = 44, VISIBLES = 5;
export function Rueda({ opciones, valor, onChange, etiqueta }) {
  const ref = useRef(null);
  const t = useRef(0);
  const ultimo = useRef(-1);
  const idx = Math.max(0, opciones.findIndex((o) => o.v === valor));
  const [vivo, setVivo] = useState(idx);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = idx * ALTO_OP; ultimo.current = idx; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(t.current), []);
  const alDesplazar = useCallback(() => {
    const el = ref.current; if (!el) return;
    const i = Math.max(0, Math.min(opciones.length - 1, Math.round(el.scrollTop / ALTO_OP)));
    if (i !== ultimo.current) { ultimo.current = i; setVivo(i); vibrar(5); }
    clearTimeout(t.current);
    t.current = setTimeout(() => { const o = opciones[ultimo.current]; if (o && o.v !== valor) onChange(o.v); }, 120);
  }, [opciones, valor, onChange]);
  return (
    <div className="rueda" style={{ height: ALTO_OP * VISIBLES }}>
      <div ref={ref} className="rueda-scroll" data-no-arrastre="" role="listbox" aria-label={etiqueta} tabIndex={0} onScroll={alDesplazar}>
        <div style={{ height: ALTO_OP * 2, flexShrink: 0 }} />
        {opciones.map((o, i) => (
          <div key={String(o.v)} role="option" aria-selected={i === vivo} className="rueda-op" data-sel={i === vivo ? "1" : "0"}
            onClick={() => { if (ref.current) ref.current.scrollTo({ top: i * ALTO_OP, behavior: "smooth" }); }}>{o.label}</div>
        ))}
        <div style={{ height: ALTO_OP * 2, flexShrink: 0 }} />
      </div>
      <div className="rueda-banda" aria-hidden="true" />
    </div>
  );
}

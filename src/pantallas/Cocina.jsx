import React, { useState, useEffect, useRef } from "react";
import {
  Check, Flame, Clock, Volume2, VolumeX, Maximize2, Minimize2, Undo2, BellRing,
} from "lucide-react";
import { vibrar } from "../theme.js";
import { getEstaciones, estacionDeLinea, itemNombre } from "../logica.js";
import { mostrarNotificacionSistema, playBeep, playTono, TONOS, leerSonido, guardarSonido } from "../avisos.js";
import { Hoja } from "../componentes/Hoja.jsx";
import { Interruptor } from "../componentes/FilasIos.jsx";
import { AvisoActivarNotificaciones } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { avisar } from "../avisos.jsx";
import { impresora } from "../termica/impresora.js";
import { crearControlImpresos } from "../termica/autoCocina.js";
import { servicioComandas } from "../termica/imprimirComandas.js";
import { eventosParaCocina, ambitoDe, numeroRonda, yaImpreso } from "../termica/comandaMesero.js";

const ESPERA_DEDUP_MS = 6000; // tiempo que Cocina espera antes de imprimir un pedido, para que el equipo del mesero imprima primero si le toca
import { getPisos, pisoPrepDeLinea, pisoEntregaDeLinea, nombrePiso } from "../pisos.js";
import { conProgreso, elapsedLabel, itemListos, itemServidos, mesaNombre, timeLabel, urgencyColor } from "../utilidades.js";

/* ---------------- COCINA ---------------- */

export const ESCALAS_KDS = [1, 1.25, 1.5, 1.8];
export function CocinaView({ orders, saveOrder, mesas, config, onKiosko }) {
  // Estaciones (Cocina, Barra…): cada pantalla puede quedarse fija en la suya.
  // La estación y el tamaño de letra se guardan en ESTE dispositivo.
  const estaciones = getEstaciones(config);
  const multi = estaciones.length > 1;
  const [estSel, setEstSel] = useState(() => { try { return localStorage.getItem("comandas_estacion") || "todas"; } catch (e) { return "todas"; } });
  const est = multi && estaciones.some((e) => e.id === estSel) ? estSel : "todas";
  const elegirEstacion = (id) => { setEstSel(id); try { localStorage.setItem("comandas_estacion", id); } catch (e) {} };

  // Pisos: cada pantalla de preparación puede quedarse fija en SU piso (también se guarda en este dispositivo).
  const pisos = getPisos(config);
  const variosPisos = pisos.length > 1;
  const [pisoSelC, setPisoSelC] = useState(() => { try { return localStorage.getItem("comandas_piso_prep") || "todos"; } catch (e) { return "todos"; } });
  const pisoFiltro = variosPisos && pisos.some((p) => p.id === pisoSelC) ? pisoSelC : "todos";
  const elegirPisoPrep = (id) => { setPisoSelC(id); try { localStorage.setItem("comandas_piso_prep", id); } catch (e) {} };
  const enPisoPrep = (it) => pisoFiltro === "todos" || pisoPrepDeLinea(it, config) === pisoFiltro;

  // Impresión automática: si este equipo tiene impresora y la opción activada, cada pedido NUEVO y cada AJUSTE sale impreso una sola vez
  // (solo lo de esta estación y este piso). Para no duplicar con el equipo del mesero:
  //   · espera unos segundos desde que VE el pedido (el mesero alcanza a imprimir y a anotar su marca);
  //   · vuelve a mirar el pedido justo antes de imprimir; si ya tiene la marca, no imprime;
  //   · anota su marca (por estación/piso) solo cuando la impresora confirmó.
  const impresosRef = useRef(null); if (!impresosRef.current) impresosRef.current = crearControlImpresos();
  const ordersRef = useRef(orders); ordersRef.current = orders;
  const vistosRef = useRef(new Map());
  const ultimoAvisoRef = useRef(0);
  const [reintento, setReintento] = useState(0);
  useEffect(() => {
    const cfg = impresora.config();
    if (!cfg.tipo || !cfg.autoCocina) return undefined;
    const impresos = impresosRef.current;
    const ambito = ambitoDe(est, pisoFiltro);
    const yaVisto = (llave, ahora) => { if (!vistosRef.current.has(llave)) vistosRef.current.set(llave, ahora); return vistosRef.current.get(llave); };
    const lista = eventosParaCocina(orders, { desdeTs: cfg.activadoTs, ambito, yaVisto, ahora: Date.now(), esperaMs: ESPERA_DEDUP_MS, enCurso: (l) => servicioComandas.enCurso(l) }).filter((x) => !impresos.ya(x.llave));
    const esperas = lista.filter((x) => x.esperar > 0).map((x) => x.esperar);
    const temporizador = esperas.length ? setTimeout(() => setReintento((n) => n + 1), Math.min(...esperas) + 50) : null;
    const listos = lista.filter((x) => x.esperar === 0);
    if (listos.length > 0) (async () => {
      const deEstaPantalla = (it) => (est === "todas" || estacionDeLinea(it, config) === est) && (pisoFiltro === "todos" || pisoPrepDeLinea(it, config) === pisoFiltro);
      for (const x of listos) {
        const fresco = ordersRef.current.find((o) => o.id === x.pedido.id) || x.pedido;       // lo más reciente (puede que el mesero ya imprimió)
        if (yaImpreso(fresco, x.evento.base) || yaImpreso(fresco, x.evento.clave)) { impresos.marcar(x.llave); continue; }
        const nombreEst = est === "todas" ? "" : ` · ${(estaciones.find((e) => e.id === est) || {}).nombre || ""}`;
        const ctx = { por: "Cocina", equipo: `Cocina${nombreEst}`.slice(0, 80), ambito, lugar: mesaNombre(mesas, fresco.mesa), mesero: fresco.mesero || "", ronda: numeroRonda(ordersRef.current, fresco) };
        let r;
        if (x.evento.tipo === "nuevo") {
          const items = (fresco.items || []).filter(deEstaPantalla);
          if (items.length === 0) { impresos.marcar(x.llave); continue; }                     // nada de esta estación: no hay ticket
          r = await servicioComandas.imprimirNuevo(fresco, { ...ctx, items });
        } else {
          const aj = x.evento.ajuste;
          const parte = { ...aj, agregados: (aj.agregados || []).filter(deEstaPantalla), cancelados: (aj.cancelados || []).filter(deEstaPantalla) };
          if (est !== "todas" || pisoFiltro !== "todos") { delete parte.notas; delete parte.notaGeneral; }
          if (parte.agregados.length === 0 && parte.cancelados.length === 0 && !parte.notas && parte.notaGeneral === undefined) { impresos.marcar(x.llave); continue; }
          r = await servicioComandas.imprimirAjuste(fresco, parte, ctx);
        }
        if (r.ok) impresos.marcar(x.llave);
        else if (Date.now() - ultimoAvisoRef.current > 60000) { ultimoAvisoRef.current = Date.now(); avisar({ texto: "No se pudo imprimir el pedido", detalle: r.motivo, tipo: "error", duracion: 20000, accion: { texto: "Reintentar", fn: () => { ultimoAvisoRef.current = 0; setReintento((n) => n + 1); } } }); break; }
      }
    })();
    return () => { if (temporizador) clearTimeout(temporizador); };
  }, [orders, est, pisoFiltro, reintento]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sonido, setSonido] = useState(leerSonido);
  const [verSonido, setVerSonido] = useState(false);
  const [escala, setEscala] = useState(() => { try { const v = Number(localStorage.getItem("comandas_kds_escala")); return ESCALAS_KDS.includes(v) ? v : 1; } catch (e) { return 1; } });
  const ciclarEscala = () => {
    const next = ESCALAS_KDS[(ESCALAS_KDS.indexOf(escala) + 1) % ESCALAS_KDS.length];
    setEscala(next);
    try { localStorage.setItem("comandas_kds_escala", String(next)); } catch (e) {}
  };
  const enEstacion = (it) => (est === "todas" || estacionDeLinea(it, config) === est) && enPisoPrep(it);
  // "Entregar en piso 3": solo se muestra cuando se prepara en un piso y se entrega en otro
  const traspaso = (it) => (variosPisos && pisoEntregaDeLinea(it, config) !== pisoPrepDeLinea(it, config) ? `→ Entregar en ${nombrePiso(config, pisoEntregaDeLinea(it, config))}` : null);
  const nombreEstacion = (it) => (estaciones.find((e) => e.id === estacionDeLinea(it, config)) || estaciones[0]).nombre;

  const activos = orders.filter((o) => o.estado !== "listo" && o.estado !== "servido" && o.estado !== "cancelado");
  const active = activos.filter((o) => o.items.some((it) => enEstacion(it) && itemListos(o, it) < it.qty)).sort((a, b) => a.ts - b.ts);
  // "Listas": cada producto que se marca listo pasa de una vez a esta sección (no espera a que toda la comanda termine).
  // Se ven (a) las unidades listas que aún no se han llevado a la mesa y (b) las comandas completas de los últimos 10 min.
  const lineasListas = (o) => {
    const completaReciente = o.estado === "listo" && o.listoTs && Date.now() - o.listoTs < 10 * 60 * 1000;
    return o.items
      .map((it, idx) => ({ it, idx, n: completaReciente ? it.qty : itemListos(o, it) - itemServidos(o, it) }))
      .filter(({ it, n }) => enEstacion(it) && n > 0);
  };
  const recienListos = orders
    .filter((o) => o.estado !== "cancelado" && o.estado !== "servido" && lineasListas(o).length > 0)
    .sort((a, b) => (b.listoTs || b.ts) - (a.listoTs || a.ts));
  const pendientes = active.filter((o) => o.estado === "pendiente");
  const preparando = active.filter((o) => o.estado !== "pendiente");
  const [vista, setVista] = useState("pendientes"); // pendientes | preparando | listas
  const lista = vista === "pendientes" ? pendientes : vista === "preparando" ? preparando : [];

  // Pantalla completa de cocina: oculta la navegación para que la pantalla se quede en la cocina.
  // Usa la pantalla completa del navegador si existe (en iPhone no existe: igual se oculta el menú) y evita que se apague.
  const [kiosko, setKiosko] = useState(false);
  const wakeRef = useRef(null);
  const entrarKiosko = async () => {
    setKiosko(true);
    try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) {}
    await pedirPantallaEncendida();
  };
  // El sistema suelta el "pantalla encendida" cada vez que la app pasa a segundo plano: se vuelve a pedir al regresar.
  const pedirPantallaEncendida = async () => {
    try { if (navigator.wakeLock && !wakeRef.current) { wakeRef.current = await navigator.wakeLock.request("screen"); wakeRef.current.addEventListener("release", () => { wakeRef.current = null; }); } } catch (e) {}
  };
  useEffect(() => {
    if (!kiosko) return undefined;
    const alVolver = () => { if (!document.hidden) pedirPantallaEncendida(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [kiosko]);
  const salirKiosko = async () => {
    setKiosko(false);
    try { if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); } catch (e) {}
    try { if (wakeRef.current) { await wakeRef.current.release(); wakeRef.current = null; } } catch (e) {}
  };
  useEffect(() => {
    const f = () => { if (!document.fullscreenElement) setKiosko((k) => (k ? false : k)); };
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  useEffect(() => { if (onKiosko) onKiosko(kiosko); }, [kiosko]);
  useEffect(() => () => { if (onKiosko) onKiosko(false); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} try { if (wakeRef.current) wakeRef.current.release(); } catch (e) {} }, []);

  // Avisos para cocina: comandas que el mesero modificó o canceló y cocina todavía no ha visto.
  const conCambio = orders.filter((o) => o.cambio && o.cambioVisto === false && o.estado !== "cancelado" && o.estado !== "servido");
  const canceladas = orders.filter((o) => o.estado === "cancelado" && o.canceladoTs && o.cancelAvisoVisto === false && Date.now() - o.canceladoTs < 60 * 60 * 1000);
  const avisos = conCambio.length + canceladas.length;
  const prevAvisosRef = useRef(avisos);
  useEffect(() => {
    if (avisos > prevAvisosRef.current) {
      playBeep(); setTimeout(playBeep, 650);
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
      const o = conCambio[0] || canceladas[0];
      mostrarNotificacionSistema("Comandas — Cocina", `${mesaNombre(mesas, o.mesa)}: la comanda ${o.estado === "cancelado" ? "fue cancelada" : "cambió"}`);
    }
    prevAvisosRef.current = avisos;
  }, [avisos]);
  const entendidoCambio = (o) => saveOrder({ ...o, cambioVisto: true });
  const entendidoCancel = (o) => saveOrder({ ...o, cancelAvisoVisto: true });

  const prevCountRef = useRef(active.length);
  const [flash, setFlash] = useState(false);

  const prevAmbitoRef = useRef(est + "|" + pisoFiltro);
  useEffect(() => {
    const ambitoAhora = est + "|" + pisoFiltro;
    const cambioFiltro = prevAmbitoRef.current !== ambitoAhora; // al cambiar de estación/piso la lista cambia, pero NO llegó nada nuevo
    prevAmbitoRef.current = ambitoAhora;
    if (!cambioFiltro && active.length > prevCountRef.current) {
      playBeep();
      setFlash(true);
      mostrarNotificacionSistema("Comandas — Cocina", "Llegó un pedido nuevo");
      setTimeout(() => setFlash(false), 900);
    }
    prevCountRef.current = active.length;
  }, [active.length, est, pisoFiltro]);

  const advance = async (id) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    if (o.estado === "pendiente") { await saveOrder({ ...o, estado: "preparando" }); return; }
    // "Marcar todo listo": lo que falte por salir (de ESTA estación) se marca listo de una vez
    const items = o.items.map((it) => ({ ...it, listos: enEstacion(it) ? it.qty : itemListos(o, it), servidos: itemServidos(o, it) }));
    await saveOrder(conProgreso(o, items));
  };
  const retroceder = async (id) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const items = o.items.map((it) => ({ ...it, listos: itemServidos(o, it), servidos: itemServidos(o, it) }));
    await saveOrder({ ...conProgreso(o, items), estado: "pendiente", listoTs: null });
  };
  const deshacerListo = async (id) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    // vuelve a "preparando": lo que aún no se ha servido deja de contar como listo
    const items = o.items.map((it) => ({ ...it, listos: itemServidos(o, it), servidos: itemServidos(o, it) }));
    await saveOrder({ ...conProgreso({ ...o, estado: "preparando" }, items), estado: "preparando", listoTs: null });
  };
  // Marca UNA unidad de un producto como lista (sale de cocina hacia el mesero).
  const itemListo = async (id, idx) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const it = o.items[idx];
    if (!it || itemListos(o, it) >= it.qty) return;
    vibrar(20);
    const items = o.items.map((x, i) => (i === idx ? { ...x, listos: itemListos(o, x) + 1, servidos: itemServidos(o, x) } : x));
    await saveOrder(conProgreso(o, items));
  };
  const itemDeshacer = async (id, idx) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const it = o.items[idx];
    if (!it || itemListos(o, it) <= itemServidos(o, it)) return; // lo ya servido no se puede devolver
    const items = o.items.map((x, i) => (i === idx ? { ...x, listos: itemListos(o, x) - 1, servidos: itemServidos(o, x) } : x));
    await saveOrder({ ...conProgreso({ ...o, estado: "preparando" }, items), estado: "preparando", listoTs: null });
  };

  return (
    <div style={{ ...styles.screenDark, ...(flash ? styles.screenFlash : {}) }}>
      <AvisoActivarNotificaciones />
      {verSonido && (
        <Hoja onCerrar={() => setVerSonido(false)} ancho={420} gap={10} label="Sonido de pedidos nuevos" z={90} centro>
          {({ cerrar }) => (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>Sonido de pedidos</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48 }}>
                <span style={{ fontSize: 15 }}>Sonido activado</span>
                <Interruptor valor={!sonido.silencio} onChange={(v) => setSonido(guardarSonido({ silencio: !v }))} etiqueta="Activar el sonido de pedidos nuevos" />
              </div>
              <div style={{ borderRadius: 14, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", overflow: "hidden", opacity: sonido.silencio ? 0.5 : 1, transition: "opacity .2s" }}>
                {TONOS.map((t, i) => (
                  <button key={t.id} type="button" disabled={sonido.silencio} aria-pressed={sonido.tono === t.id}
                    onClick={() => { setSonido(guardarSonido({ tono: t.id })); playTono(t.id); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", minHeight: 52, padding: "10px 14px", border: "none", borderBottom: i === TONOS.length - 1 ? "none" : "1px solid var(--c-e4dfce-o)", background: "transparent", color: "var(--c-242019-t)", textAlign: "left", cursor: "pointer", font: "inherit" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t.nombre}</span>
                      <span style={{ fontSize: 11.5, color: "var(--c-8a8272-t)" }}>{t.nota}</span>
                    </span>
                    {sonido.tono === t.id && <Check size={18} color="var(--accent)" aria-hidden="true" />}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--c-8a8272-t)" }}>Se guarda en este dispositivo. Toca un tono para escucharlo.</div>
              <button type="button" onClick={cerrar} style={{ minHeight: 44, borderRadius: 12, border: "1px solid var(--btn2-line)", background: "var(--btn2-bg)", color: "var(--btn2-fg)", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>Listo</button>
            </>
          )}
        </Hoja>
      )}
      <div style={ck.cabecera}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={ck.titulo}>Cocina</div>
          <span style={ck.envivo}><span style={ck.pulso} /> En vivo</span>
        </div>
        <div style={ck.herr}>
          <button style={ck.btnIcono} onClick={() => setVerSonido(true)} aria-label="Sonido de pedidos nuevos" title="Sonido de pedidos nuevos">{sonido.silencio ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
          <button style={ck.btnIcono} onClick={ciclarEscala} title="Tamaño de letra"><span style={{ fontSize: 10, fontWeight: 700 }}>A</span><span style={{ fontSize: 15, fontWeight: 700 }}>A</span></button>
          <button style={ck.btnIcono} onClick={kiosko ? salirKiosko : entrarKiosko} title={kiosko ? "Salir de pantalla completa" : "Pantalla completa"} aria-label="Pantalla completa">
            {kiosko ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {variosPisos && (
        <div style={ck.estaciones} role="tablist" aria-label="Piso donde se prepara">
          {["todos", ...pisos.map((p) => p.id)].map((id) => (
            <button key={id} role="tab" aria-selected={pisoFiltro === id} style={{ ...ck.chip, ...(pisoFiltro === id ? ck.chipOn : {}) }} onClick={() => elegirPisoPrep(id)}>
              {id === "todos" ? "Todos los pisos" : pisos.find((p) => p.id === id).nombre}
            </button>
          ))}
        </div>
      )}
      {multi && (
        <div style={ck.estaciones}>
          {["todas", ...estaciones.map((e) => e.id)].map((id, i) => {
            const on = est === id;
            return (
              <button key={id} style={{ ...ck.chip, ...(on ? ck.chipOn : {}) }} onClick={() => elegirEstacion(id)}>
                {id !== "todas" && <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORES_ESTACION[(i - 1) % COLORES_ESTACION.length] }} />}
                {id === "todas" ? "Todas" : estaciones.find((e) => e.id === id).nombre}
              </button>
            );
          })}
        </div>
      )}

      <div style={ck.pestanas}>
        {[["pendientes", "Pendientes", pendientes.length, "var(--warn-solid)"], ["preparando", "Preparando", preparando.length, "var(--accent)"], ["listas", "Listas", recienListos.length, "var(--ok-solid)"]].map(([id, label, n, color]) => (
          <button key={id} style={{ ...ck.pestana, ...(vista === id ? ck.pestanaOn : {}) }} onClick={() => setVista(id)}>
            {label} <span style={{ ...ck.contador, ...(n > 0 ? { background: color } : { background: "var(--c-ede7d8-b)", color: "var(--c-8a8272-t)" }) }}>{n}</span>
          </button>
        ))}
      </div>

      {avisos > 0 && (
        <div style={ck.avisos}>
          {canceladas.map((o) => (
            <div key={o.id} className="anim-in" style={{ ...ck.aviso, ...ck.avisoRojo }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={ck.avisoTitulo}>{mesaNombre(mesas, o.mesa).toUpperCase()} · COMANDA CANCELADA</div>
                <div style={ck.avisoTexto}>{o.items.map((it) => `${it.qty}× ${itemNombre(it)}`).join(", ")}</div>
                <div style={ck.avisoMeta}>Por {o.canceladoPor || "el mesero"} · no la prepares</div>
              </div>
              <button style={ck.avisoBtn} onClick={() => entendidoCancel(o)}>Entendido</button>
            </div>
          ))}
          {conCambio.map((o) => (
            <div key={o.id} className="anim-in" style={{ ...ck.aviso, ...ck.avisoAmbar }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={ck.avisoTitulo}>{mesaNombre(mesas, o.mesa).toUpperCase()} · LA COMANDA CAMBIÓ</div>
                <div style={ck.avisoTexto}>{o.cambio.texto}</div>
                <div style={ck.avisoMeta}>Por {o.cambio.por || "el mesero"} · revisa el pedido actualizado</div>
              </div>
              <button style={ck.avisoBtn} onClick={() => entendidoCambio(o)}>Entendido</button>
            </div>
          ))}
        </div>
      )}

      <div key={vista} className="tab-anim">
      {vista === "listas" ? (
        recienListos.length === 0 ? (
          <div style={styles.emptyKitchen} className="anim-in">
            <BellRing size={30} strokeWidth={1.4} color="var(--c-9a9382-t)" />
            <div style={styles.emptyKitchenText}>Nada listo todavía</div>
            <div style={styles.emptyKitchenSub}>Cada producto que marcas como listo aparece aquí al instante, hasta que el mesero lo sirve.</div>
          </div>
        ) : (
          <div style={{ ...styles.railGrid, zoom: escala }}>
            {recienListos.map((o) => {
              const completa = o.estado === "listo";
              const faltan = o.items.filter(enEstacion).reduce((a, it) => a + Math.max(0, it.qty - itemListos(o, it)), 0);
              return (
                <div key={o.id} className="anim-in" style={{ ...styles.ticket, borderLeftColor: "var(--ok-solid)" }}>
                  <div style={styles.ticketHead}>
                    <span style={styles.ticketMesa}>{mesaNombre(mesas, o.mesa).toUpperCase()}</span>
                    {completa
                      ? <span style={styles.ticketTime}>Listo a las {timeLabel(o.listoTs)}</span>
                      : <span style={{ ...styles.ticketTime, color: "var(--c-b98a2e-t)", fontWeight: 700 }}>Faltan {faltan}</span>}
                  </div>
                  <div style={styles.ticketDivider} />
                  {lineasListas(o).map(({ it, idx, n }) => (
                    <div key={idx} style={styles.ticketLine}>
                      <span style={styles.ticketQty}>{n}×</span>
                      <span style={styles.ticketItemName}>{it.name}</span>
                      {!completa && itemListos(o, it) > itemServidos(o, it) && (
                        <span style={styles.itemKdsActions}><button className="toque44" style={styles.itemKdsUndo} onClick={() => itemDeshacer(o.id, idx)} title="Deshacer">−</button></span>
                      )}
                    </div>
                  ))}
                  {completa && (
                    <>
                      <div style={styles.ticketDivider} />
                      <button style={{ ...styles.ticketBtn, background: "var(--c-242019-b)" }} onClick={() => deshacerListo(o.id)}><Undo2 size={14} /> Deshacer "listo"</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : lista.length === 0 ? (
        <div style={styles.emptyKitchen} className="anim-in">
          <Flame size={30} strokeWidth={1.4} color="var(--c-9a9382-t)" />
          <div style={styles.emptyKitchenText}>{vista === "pendientes" ? "Sin pedidos pendientes" : "Nada en preparación"}</div>
          <div style={styles.emptyKitchenSub}>Cuando un mesero envíe un pedido aparece aquí y suena la campana.</div>
        </div>
      ) : (
        <div style={{ ...styles.railGrid, zoom: escala }}>
          {lista.map((o) => (
            <div key={o.id} className="anim-in" style={{ ...styles.ticket, borderLeftColor: urgencyColor(o.ts) }}>
              <div style={styles.ticketHead}>
                <span style={styles.ticketMesa}>
                  {mesaNombre(mesas, o.mesa).toUpperCase()}
                  {o.editado && <span style={{ ...styles.editedBadge, ...(o.cambio && o.cambioVisto === false ? { background: "var(--warn-solid)", color: "#FFFFFF" } : {}) }}>MODIFICADO</span>}
                </span>
                <span style={{ ...styles.ticketTime, color: urgencyColor(o.ts), fontWeight: 700 }}><Clock size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{elapsedLabel(o.ts)}</span>
              </div>
              <div style={styles.ticketExactTime}>
                {o.tipo === "llevar" && <span style={styles.ticketTipo}>PARA LLEVAR</span>}
                {o.tipo === "domicilio" && <span style={{ ...styles.ticketTipo, background: "var(--info-solid)" }}>DOMICILIO</span>}
                Pedido a las {timeLabel(o.ts)}
              </div>
              <div style={styles.ticketDivider} />
              {o.items.map((it, idx) => ({ it, idx })).filter(({ it }) => enEstacion(it) && itemListos(o, it) < it.qty).map(({ it, idx }) => {
                const l = itemListos(o, it);
                const completo = false; // lo que ya está listo pasa a la pestaña "Listas"
                return (
                  <div key={idx}>
                    <div style={styles.ticketLine}>
                      <span style={styles.ticketQty}>{it.qty}×</span>
                      <span style={{ ...styles.ticketItemName, textDecoration: completo ? "line-through" : "none" }}>
                        {it.name}
                        {multi && est === "todas" && <span style={styles.ticketEstTag}>{nombreEstacion(it)}</span>}
                        {traspaso(it) && <span style={{ ...styles.ticketEstTag, color: "var(--info-solid, #2f6690)" }}>{traspaso(it)}</span>}
                      </span>
                      <span style={styles.itemKdsActions}>
                        {/* Despachar producto por producto solo tiene sentido ya en preparación */}
                        {o.estado !== "pendiente" && it.qty > 1 && <span style={styles.itemKdsCount}>{l}/{it.qty}</span>}
                        {o.estado !== "pendiente" && l > itemServidos(o, it) && (
                          <button className="toque44" style={styles.itemKdsUndo} onClick={() => itemDeshacer(o.id, idx)} title="Deshacer">−</button>
                        )}
                        {o.estado !== "pendiente" && !completo && (
                          <button style={styles.itemKdsBtn} onClick={() => itemListo(o.id, idx)}><Check size={12} /> Listo</button>
                        )}
                      </span>
                    </div>
                    {it.mods && it.mods.length > 0 && <div style={styles.ticketItemMods}>{it.mods.map((m) => m.n).join(" · ")}</div>}
                    {it.nota && <div style={styles.ticketItemNote}>↳ {it.nota}</div>}
                    {it.cambioDe && <div style={styles.ticketItemNote}>↳ cambió de producto (antes: {it.cambioDe})</div>}
                  </div>
                );
              })}
              {/* Lo que el mesero quitó o cambió se queda en la comanda, tachado, para que cocina lo vea sin tener que adivinar */}
              {(o.historialCambios || []).filter((h) => enEstacion(h)).slice(-5).map((h, i) => (
                <div key={`h${i}`} style={styles.ticketCambio}>
                  <span style={{ textDecoration: "line-through" }}>{h.qty}× {h.name}</span>
                  <span style={styles.ticketCambioTag}>{h.tipo === "cambio" ? "CAMBIÓ DE PRODUCTO" : "QUITADO"}</span>
                  {h.tipo === "cambio" && <span style={{ color: "var(--c-242019-t)", fontWeight: 600 }}>→ {h.aQty}× {h.aName}</span>}
                </div>
              ))}
              {o.nota && <div style={styles.ticketNote}>"{o.nota}"</div>}
              {(() => {
                const yaListos = o.items.filter((it) => enEstacion(it) && itemListos(o, it) >= it.qty).length;
                return yaListos > 0 ? (
                  <button style={styles.ticketYaListos} onClick={() => setVista("listas")}><Check size={12} /> {yaListos} {yaListos === 1 ? "producto ya está listo" : "productos ya están listos"} · ver en Listas</button>
                ) : null;
              })()}
              <div style={styles.ticketDivider} />
              <div style={{ display: "flex", gap: 6 }}>
                {o.estado === "preparando" && est === "todas" && (
                  <button style={styles.ticketBackBtn} onClick={() => retroceder(o.id)} title="Volver a pendiente">◀</button>
                )}
                <button style={{ ...styles.ticketBtn, flex: 1, background: o.estado === "pendiente" ? "var(--warn-solid)" : "var(--ok-solid)" }} onClick={() => advance(o.id)}>
                  {o.estado === "pendiente" ? <><Flame size={14} /> Empezar preparación</> : <><Check size={14} /> Marcar todo listo</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

const COLORES_ESTACION = ["var(--accent)", "var(--warn-solid)", "var(--ok-solid)", "var(--danger-solid)", "var(--c-8a8272-t)"];
const ck = {
  avisos: { display: "flex", flexDirection: "column", gap: 8, margin: "0 16px 12px" },
  aviso: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "1.5px solid" },
  avisoAmbar: { background: "var(--c-fbefd9-b)", borderColor: "var(--warn-solid)" },
  avisoRojo: { background: "var(--c-fbe2dc-b)", borderColor: "var(--danger-solid)" },
  avisoTitulo: { fontSize: 13, fontWeight: 800, letterSpacing: 0.4, color: "var(--c-242019-t)" },
  avisoTexto: { fontSize: 14, color: "var(--c-242019-t)", marginTop: 3, lineHeight: 1.35 },
  avisoMeta: { fontSize: 11.5, color: "var(--c-5c5648-t)", marginTop: 3 },
  avisoBtn: { padding: "10px 14px", borderRadius: 12, border: "none", background: "var(--neon)", color: "var(--neon-text)", fontWeight: 800, fontSize: 13.5, cursor: "pointer", flexShrink: 0, boxShadow: "var(--neon-glow)" },
  cabecera: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px 6px" },
  titulo: { fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--c-242019-t)" },
  envivo: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "var(--c-e4eee1-b)", color: "var(--c-5b7553-t)", border: "1px solid var(--ok-border)" },
  pulso: { width: 7, height: 7, borderRadius: 4, background: "var(--ok-solid)", boxShadow: "0 0 0 4px var(--ok-border)" },
  herr: { display: "flex", gap: 8 },
  btnIcono: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 1, minWidth: 40, height: 40, borderRadius: 12, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-f1ecdd-b)", color: "var(--c-3b372e-t)", cursor: "pointer" },
  estaciones: { display: "flex", gap: 8, overflowX: "auto", padding: "6px 16px", scrollbarWidth: "none" },
  chip: { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, border: "1px solid var(--c-e4dfce-o)", background: "transparent", color: "var(--c-5c5648-t)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },
  chipOn: { background: "var(--neon)", color: "var(--neon-text)", borderColor: "transparent", boxShadow: "var(--neon-glow)" },
  pestanas: { display: "flex", gap: 4, margin: "8px 16px 12px", padding: 4, borderRadius: 14, background: "var(--c-f1ecdd-b)" },
  pestana: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 6px", borderRadius: 11, border: "none", background: "transparent", color: "var(--c-5c5648-t)", fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
  pestanaOn: { background: "var(--neon)", color: "var(--neon-text)", boxShadow: "var(--neon-glow)" },
  contador: { minWidth: 22, height: 22, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#FFFFFF", padding: "0 6px" },
};

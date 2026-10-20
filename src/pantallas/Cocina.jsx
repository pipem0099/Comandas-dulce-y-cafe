import React, { useState, useEffect, useRef } from "react";
import {
  Check, Flame, Clock, Volume2, Maximize2, Minimize2, Undo2, BellRing,
} from "lucide-react";
import { vibrar } from "../theme.js";
import { getEstaciones, estacionDeLinea, itemNombre } from "../logica.js";
import { mostrarNotificacionSistema, playBeep } from "../avisos.js";
import { AvisoActivarNotificaciones } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
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
  const [escala, setEscala] = useState(() => { try { const v = Number(localStorage.getItem("comandas_kds_escala")); return ESCALAS_KDS.includes(v) ? v : 1; } catch (e) { return 1; } });
  const ciclarEscala = () => {
    const next = ESCALAS_KDS[(ESCALAS_KDS.indexOf(escala) + 1) % ESCALAS_KDS.length];
    setEscala(next);
    try { localStorage.setItem("comandas_kds_escala", String(next)); } catch (e) {}
  };
  const enEstacion = (it) => est === "todas" || estacionDeLinea(it, config) === est;
  const nombreEstacion = (it) => (estaciones.find((e) => e.id === estacionDeLinea(it, config)) || estaciones[0]).nombre;

  const activos = orders.filter((o) => o.estado !== "listo" && o.estado !== "servido" && o.estado !== "cancelado");
  const active = activos.filter((o) => o.items.some((it) => enEstacion(it) && itemListos(o, it) < it.qty)).sort((a, b) => a.ts - b.ts);
  const recienListos = orders
    .filter((o) => o.estado === "listo" && o.listoTs && Date.now() - o.listoTs < 10 * 60 * 1000 && o.items.some(enEstacion))
    .sort((a, b) => b.listoTs - a.listoTs);
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
    try { if (navigator.wakeLock) wakeRef.current = await navigator.wakeLock.request("screen"); } catch (e) {}
  };
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
      playBeep(); playBeep();
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

  useEffect(() => {
    if (active.length > prevCountRef.current) {
      playBeep();
      setFlash(true);
      mostrarNotificacionSistema("Comandas — Cocina", "Llegó un pedido nuevo");
      setTimeout(() => setFlash(false), 900);
    }
    prevCountRef.current = active.length;
  }, [active.length]);

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
      <div style={ck.cabecera}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={ck.titulo}>Cocina</div>
          <span style={ck.envivo}><span style={ck.pulso} /> En vivo</span>
        </div>
        <div style={ck.herr}>
          <span style={ck.btnIcono} title="Suena una campana con cada pedido nuevo"><Volume2 size={16} /></span>
          <button style={ck.btnIcono} onClick={ciclarEscala} title="Tamaño de letra"><span style={{ fontSize: 10, fontWeight: 700 }}>A</span><span style={{ fontSize: 15, fontWeight: 700 }}>A</span></button>
          <button style={ck.btnIcono} onClick={kiosko ? salirKiosko : entrarKiosko} title={kiosko ? "Salir de pantalla completa" : "Pantalla completa"} aria-label="Pantalla completa">
            {kiosko ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

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
        {[["pendientes", "Pendientes", pendientes.length, "#C58B1B"], ["preparando", "Preparando", preparando.length, "#3B82F6"], ["listas", "Listas", recienListos.length, "#1F8A62"]].map(([id, label, n, color]) => (
          <button key={id} style={{ ...ck.pestana, ...(vista === id ? ck.pestanaOn : {}) }} onClick={() => setVista(id)}>
            {label} <span style={{ ...ck.contador, background: color }}>{n}</span>
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

      {vista === "listas" ? (
        recienListos.length === 0 ? (
          <div style={styles.emptyKitchen} className="anim-in">
            <BellRing size={30} strokeWidth={1.4} color="#5C6670" />
            <div style={styles.emptyKitchenText}>Nada listo todavía</div>
            <div style={styles.emptyKitchenSub}>Aquí quedan los pedidos que terminaste en los últimos 10 minutos, por si necesitas deshacer uno.</div>
          </div>
        ) : (
          <div style={{ ...styles.railGrid, zoom: escala }}>
            {recienListos.map((o) => (
              <div key={o.id} className="anim-in" style={{ ...styles.ticket, borderLeftColor: "#1F8A62" }}>
                <div style={styles.ticketHead}><span style={styles.ticketMesa}>{mesaNombre(mesas, o.mesa).toUpperCase()}</span><span style={styles.ticketTime}>Listo a las {timeLabel(o.listoTs)}</span></div>
                <div style={styles.ticketDivider} />
                {o.items.filter(enEstacion).map((it, i) => (
                  <div key={i} style={styles.ticketLine}><span style={styles.ticketQty}>{it.qty}×</span><span style={styles.ticketItemName}>{it.name}</span></div>
                ))}
                <div style={styles.ticketDivider} />
                <button style={{ ...styles.ticketBtn, background: "#475569" }} onClick={() => deshacerListo(o.id)}><Undo2 size={14} /> Deshacer "listo"</button>
              </div>
            ))}
          </div>
        )
      ) : lista.length === 0 ? (
        <div style={styles.emptyKitchen} className="anim-in">
          <Flame size={30} strokeWidth={1.4} color="#5C6670" />
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
                  {o.editado && <span style={{ ...styles.editedBadge, ...(o.cambio && o.cambioVisto === false ? { background: "#ff8a00", color: "#1a0e00" } : {}) }}>MODIFICADO</span>}
                </span>
                <span style={{ ...styles.ticketTime, color: urgencyColor(o.ts), fontWeight: 700 }}><Clock size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{elapsedLabel(o.ts)}</span>
              </div>
              <div style={styles.ticketExactTime}>
                {o.tipo === "llevar" && <span style={styles.ticketTipo}>PARA LLEVAR</span>}
                {o.tipo === "domicilio" && <span style={{ ...styles.ticketTipo, background: "#2E6FD6" }}>DOMICILIO</span>}
                Pedido a las {timeLabel(o.ts)}
              </div>
              <div style={styles.ticketDivider} />
              {o.items.map((it, idx) => ({ it, idx })).filter(({ it }) => enEstacion(it)).map(({ it, idx }) => {
                const l = itemListos(o, it);
                const completo = l >= it.qty;
                return (
                  <div key={idx} style={{ opacity: completo ? 0.5 : 1, transition: "opacity .25s" }}>
                    <div style={styles.ticketLine}>
                      <span style={styles.ticketQty}>{it.qty}×</span>
                      <span style={{ ...styles.ticketItemName, textDecoration: completo ? "line-through" : "none" }}>
                        {it.name}
                        {multi && est === "todas" && <span style={styles.ticketEstTag}>{nombreEstacion(it)}</span>}
                      </span>
                      <span style={styles.itemKdsActions}>
                        {it.qty > 1 && <span style={styles.itemKdsCount}>{l}/{it.qty}</span>}
                        {l > itemServidos(o, it) && (
                          <button style={styles.itemKdsUndo} onClick={() => itemDeshacer(o.id, idx)} title="Deshacer">−</button>
                        )}
                        {!completo && (
                          <button style={styles.itemKdsBtn} onClick={() => itemListo(o.id, idx)}><Check size={12} /> Listo</button>
                        )}
                      </span>
                    </div>
                    {it.mods && it.mods.length > 0 && <div style={styles.ticketItemMods}>{it.mods.map((m) => m.n).join(" · ")}</div>}
                    {it.nota && <div style={styles.ticketItemNote}>↳ {it.nota}</div>}
                  </div>
                );
              })}
              {o.nota && <div style={styles.ticketNote}>"{o.nota}"</div>}
              <div style={styles.ticketDivider} />
              <div style={{ display: "flex", gap: 6 }}>
                {o.estado === "preparando" && est === "todas" && (
                  <button style={styles.ticketBackBtn} onClick={() => retroceder(o.id)} title="Volver a pendiente">◀</button>
                )}
                <button style={{ ...styles.ticketBtn, flex: 1, background: o.estado === "pendiente" ? "#C58B1B" : "#1F8A62" }} onClick={() => advance(o.id)}>
                  {o.estado === "pendiente" ? <><Flame size={14} /> Empezar preparación</> : <><Check size={14} /> Marcar todo listo</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const COLORES_ESTACION = ["#E08A3C", "#D64545", "#3B82F6", "#8B5CF6", "#14B8A6"];
const ck = {
  avisos: { display: "flex", flexDirection: "column", gap: 8, margin: "0 16px 12px" },
  aviso: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "1.5px solid" },
  avisoAmbar: { background: "rgba(255,138,0,.14)", borderColor: "#ff8a00" },
  avisoRojo: { background: "rgba(255,69,69,.14)", borderColor: "#ff4545" },
  avisoTitulo: { fontSize: 13, fontWeight: 800, letterSpacing: 0.4, color: "#F4F6F8" },
  avisoTexto: { fontSize: 14, color: "#F4F6F8", marginTop: 3, lineHeight: 1.35 },
  avisoMeta: { fontSize: 11.5, color: "#B6BEC8", marginTop: 3 },
  avisoBtn: { padding: "10px 14px", borderRadius: 12, border: "none", background: "var(--neon)", color: "var(--neon-text)", fontWeight: 800, fontSize: 13.5, cursor: "pointer", flexShrink: 0, boxShadow: "var(--neon-glow)" },
  cabecera: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px 6px" },
  titulo: { fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "#F4F6F8" },
  envivo: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "rgba(52,199,142,.14)", color: "#34d399", border: "1px solid rgba(52,199,142,.35)" },
  pulso: { width: 7, height: 7, borderRadius: 4, background: "#34d399", boxShadow: "0 0 0 4px rgba(52,199,142,.25)" },
  herr: { display: "flex", gap: 8 },
  btnIcono: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 1, minWidth: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "#E6EAEF", cursor: "pointer" },
  estaciones: { display: "flex", gap: 8, overflowX: "auto", padding: "6px 16px", scrollbarWidth: "none" },
  chip: { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "transparent", color: "#B6BEC8", fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },
  chipOn: { background: "var(--neon)", color: "var(--neon-text)", borderColor: "transparent", boxShadow: "var(--neon-glow)" },
  pestanas: { display: "flex", gap: 4, margin: "8px 16px 12px", padding: 4, borderRadius: 14, background: "rgba(255,255,255,.06)" },
  pestana: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 6px", borderRadius: 11, border: "none", background: "transparent", color: "#B6BEC8", fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
  pestanaOn: { background: "var(--neon)", color: "var(--neon-text)", boxShadow: "var(--neon-glow)" },
  contador: { minWidth: 22, height: 22, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", padding: "0 6px" },
};

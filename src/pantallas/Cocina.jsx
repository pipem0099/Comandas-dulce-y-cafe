import React, { useState, useEffect, useRef } from "react";
import {
  Check, Flame, Clock, Volume2,
} from "lucide-react";
import { vibrar } from "../theme.js";
import { getEstaciones, estacionDeLinea } from "../logica.js";
import { mostrarNotificacionSistema, playBeep } from "../avisos.js";
import { AvisoActivarNotificaciones } from "../componentes/Comunes.jsx";
import { styles } from "../estilos.js";
import { conProgreso, elapsedLabel, itemListos, itemServidos, mesaNombre, timeLabel, urgencyColor } from "../utilidades.js";

/* ---------------- COCINA ---------------- */

export const ESCALAS_KDS = [1, 1.25, 1.5, 1.8];
export function CocinaView({ orders, saveOrder, mesas, config }) {
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
      <div style={styles.kdsHeader}>
        <div>
          <div style={styles.kdsEyebrow}>{(est === "todas" ? "COCINA" : (estaciones.find((e) => e.id === est) || estaciones[0]).nombre.toUpperCase())} — PANTALLA EN VIVO <Volume2 size={11} style={{ verticalAlign: -2, marginLeft: 4 }} /></div>
          <div style={styles.kdsTitle}>Comandas activas</div>
        </div>
        <div style={styles.kdsCount}>{active.length}</div>
      </div>

      <div style={styles.kdsTools}>
        {multi && (
          <div style={styles.kdsChips}>
            {["todas", ...estaciones.map((e) => e.id)].map((id) => (
              <button key={id} style={{ ...styles.kdsChip, ...(est === id ? styles.kdsChipOn : {}) }} onClick={() => elegirEstacion(id)}>
                {id === "todas" ? "Todas" : estaciones.find((e) => e.id === id).nombre}
              </button>
            ))}
          </div>
        )}
        <button style={styles.kdsZoomBtn} onClick={ciclarEscala} title="Tamaño de letra">
          <span style={{ fontSize: 11, fontWeight: 700 }}>A</span><span style={{ fontSize: 16, fontWeight: 700 }}>A</span> {Math.round(escala * 100)}%
        </button>
      </div>

      {recienListos.length > 0 && (
        <div style={styles.recienListosRow}>
          {recienListos.map((o) => (
            <button key={o.id} style={styles.recienListoChip} onClick={() => deshacerListo(o.id)}>
              ↺ {mesaNombre(mesas, o.mesa)} — deshacer "listo"
            </button>
          ))}
        </div>
      )}

      {active.length === 0 ? (
        <div style={styles.emptyKitchen} className="anim-in">
          <Flame size={30} strokeWidth={1.4} color="#5C6670" />
          <div style={styles.emptyKitchenText}>Todo al día</div>
          <div style={styles.emptyKitchenSub}>Cuando un mesero envíe un pedido aparece aquí y suena la campana.</div>
        </div>
      ) : (
        <div style={{ ...styles.railGrid, zoom: escala }}>
          {active.map((o) => (
            <div key={o.id} className="anim-in" style={{ ...styles.ticket, borderLeftColor: urgencyColor(o.ts) }}>
              <div style={styles.ticketHead}>
                <span style={styles.ticketMesa}>
                  {mesaNombre(mesas, o.mesa).toUpperCase()}
                  {o.editado && <span style={styles.editedBadge}>MODIFICADO</span>}
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

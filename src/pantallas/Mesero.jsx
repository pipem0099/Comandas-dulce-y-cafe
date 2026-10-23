import React, { useState, useEffect, useRef } from "react";
import { Plus, Minus, Send, Check, Pencil, Ban, AlertTriangle, Users, ArrowRightLeft, Volume2, MessageSquarePlus, PencilLine, ShoppingBag, Bike, Phone, MapPin, Search, X } from "lucide-react";
import { vibrar } from "../theme.js";
import { claveLinea, precioUnitario, modsTexto, itemNombre, tieneOpciones, estacionDe, consumoDeItems, difConsumo, negar, faltaStock, TIPO_META, esExterna, etiquetaExterna, uid, money } from "../logica.js";
import { ModalOpciones, NuevoPedidoExterno } from "../extras.jsx";
import { mostrarNotificacionSistema, playBeep } from "../avisos.js";
import { AvisoActivarNotificaciones, Chevron } from "../componentes/Comunes.jsx";
import { STATE_META } from "../constantes.js";
import { styles } from "../estilos.js";
import { PlanoSalon } from "../pantallas/Mesas.jsx";
import { reservaProxima, NOMBRES_EXTERNOS, conProgreso, cuentaCubre, cuentaDeMesa, cuentaOrders, cuentaSubtotal, dayKey, esPorLiberar, estadoVisualMesa, itemListos, itemServidos, mesaMatch, mesaNombre, orderTotal, porServir, timeLabel } from "../utilidades.js";

import { Hoja } from "../componentes/Hoja.jsx";
/* ---------------- MESERO ---------------- */

/** Texto corto de qué cambió entre la versión enviada y la nueva (para avisar a cocina). */
function resumenCambio(antes, despues) {
  const previos = new Map(antes.map((i) => [i.id, i]));
  const out = [];
  despues.forEach((it) => {
    const p = previos.get(it.id);
    if (!p) out.push(`Nuevo: ${it.qty}× ${itemNombre(it)}`);
    else if (it.qty !== p.qty) out.push(`${itemNombre(it)}: ${p.qty} → ${it.qty}`);
    else if ((it.nota || "") !== (p.nota || "")) out.push(`${itemNombre(it)}: nota cambió`);
    previos.delete(it.id);
  });
  previos.forEach((p) => out.push(`Se quitó ${p.qty}× ${itemNombre(p)}`));
  return out;
}

export function MeseroView({ reservas = [], menu, orders, cuentas, usuarioActual, config, mesas, persistMesas, saveOrder, saveOrdersMap, saveCuenta, persistMenu, persistConfig, insumos, ajustarInventario }) {
  // Editar el menú, precios y mesas queda reservado al administrador — un
  // mesero normal no debería poder cambiar precios ni borrar productos.
  const meseroActual = usuarioActual.nombre;

  // Aviso sonoro para el mesero: cuando cocina marca "listo" un pedido de
  // alguna de SUS mesas todavía abiertas, suena y aparece un mensaje — así
  // no tiene que estar entrando a cada mesa a chequear si ya puede servir.
  const idsListosVistosRef = useRef(null);
  const [avisoListo, setAvisoListo] = useState(null);
  useEffect(() => {
    const misCuentaIds = new Set(cuentas.filter((c) => c.mesero === meseroActual && c.estado === "abierta").map((c) => c.id));
    const listosAhora = [];
    orders.forEach((o) => {
      if (o.estado === "cancelado" || !misCuentaIds.has(o.cuentaId)) return;
      o.items.forEach((it, idx) => {
        const n = itemListos(o, it) - itemServidos(o, it);
        // una "marca" por cada unidad lista sin servir, para detectar cuando sale una nueva
        for (let k = 1; k <= n; k++) listosAhora.push({ id: `${o.id}#${idx}#${itemServidos(o, it) + k}`, mesa: o.mesa, nombre: itemNombre(it) });
      });
    });
    const idsActuales = new Set(listosAhora.map((o) => o.id));
    if (idsListosVistosRef.current === null) {
      idsListosVistosRef.current = idsActuales; // primera carga: no suena por lo que ya estaba listo antes
      return;
    }
    const nuevos = listosAhora.filter((o) => !idsListosVistosRef.current.has(o.id));
    idsListosVistosRef.current = idsActuales;
    if (nuevos.length > 0) {
      playBeep();
      // "Mesa 3: 2× Limonada Natural" — qué mesa y qué producto, agrupando lo que salió junto
      const grupos = new Map();
      nuevos.forEach((u) => {
        const k = `${u.mesa}|${u.nombre}`;
        grupos.set(k, { mesa: u.mesa, nombre: u.nombre, n: (grupos.get(k)?.n || 0) + 1 });
      });
      const lista = [...grupos.values()];
      const partes = lista.slice(0, 3).map((g) => `${mesaNombre(mesas, g.mesa)}: ${g.n}× ${g.nombre}`);
      const texto = partes.join("  ·  ") + (lista.length > 3 ? `  · +${lista.length - 3} más` : "");
      const mesasUnicas = [...new Set(lista.map((g) => g.mesa))];
      setAvisoListo({ texto, mesa: mesasUnicas.length === 1 ? mesasUnicas[0] : null });
      mostrarNotificacionSistema("Para servir", texto);
      setTimeout(() => setAvisoListo(null), 7000);
    }
  }, [orders, cuentas, meseroActual, mesas]);

  const [selectedMesa, setSelectedMesa] = useState(null);
  const [draft, setDraft] = useState({}); // { itemId: { qty, nota } }
  const [notaAbierta, setNotaAbierta] = useState(false); // la nota para cocina se muestra solo si se pide
  const [verPedidos, setVerPedidos] = useState(false); // lista de pedidos de la mesa: compacta por defecto
  const [note, setNote] = useState("");
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [justSent, setJustSent] = useState(false);
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState("");
  const [notingItemId, setNotingItemId] = useState(null);
  const [mesaAction, setMesaAction] = useState(null); // 'trasladar' | 'unir'
  const [mesasJuntas, setMesasJuntas] = useState([]); // mesas juntadas ANTES del primer pedido (aún sin cuenta)
  const [vistaMesas, setVistaMesas] = useState("grid"); // 'grid' | 'plano'
  const [modalItem, setModalItem] = useState(null);       // producto con opciones que se está personalizando
  const [nuevoExterno, setNuevoExterno] = useState(null); // 'llevar' | 'domicilio'

  const [liberarCuenta, setLiberarCuenta] = useState(null); // mesa ya pagada que se está por liberar
  const tocarMesa = (id) => {
    const c = cuentaDeMesa(cuentas, id);
    if (c && esPorLiberar(c)) setLiberarCuenta(c); else enterMesa(id);
  };
  const liberarMesa = async (c) => { await saveCuenta({ ...c, liberada: true, liberadaTs: Date.now(), liberadaPor: meseroActual }); setLiberarCuenta(null); };
  const cuentaAbiertaDe = (mesaId) => cuentas.find((c) => cuentaCubre(c, mesaId) && c.estado === "abierta");

  const totalItems = Object.values(draft).reduce((a, b) => a + b.qty, 0);

  const resetDraft = () => { setNotaAbierta(false); setMesasJuntas([]); setDraft({}); setNote(""); setEditingOrderId(null); setNotingItemId(null); };
  const enterMesa = (n) => { resetDraft(); setActiveCat(null); setSearch(""); setConfirmCancelId(null); setMesaAction(null); setSelectedMesa(n); };
  const exitMesa = () => { resetDraft(); setActiveCat(null); setSearch(""); setMesaAction(null); setSelectedMesa(null); };

  const agregarConOpciones = (item, mods, qty, nota) => {
    const key = claveLinea(item.id, mods);
    setDraft((prev) => {
      const cur = prev[key];
      return { ...prev, [key]: { baseId: item.id, mods, qty: (cur ? cur.qty : 0) + qty, nota: nota || (cur ? cur.nota : "") } };
    });
    setModalItem(null);
  };
  const addQty = (id, d) => {
    if (d > 0) vibrar(8);
    // al modificar un pedido enviado, lo que ya se sirvió no se puede quitar
    let minimo = 0;
    if (editingOrderId) {
      const orig = orders.find((o) => o.id === editingOrderId);
      const prevIt = orig && orig.items.find((x) => x.id === id);
      if (prevIt) minimo = itemServidos(orig, prevIt);
    }
    setDraft((prev) => {
      const cur = prev[id] || { qty: 0, nota: "" };
      const nextQty = Math.max(minimo, cur.qty + d);
      const next = { ...prev };
      if (nextQty === 0) delete next[id];
      else next[id] = { ...cur, qty: nextQty };
      return next;
    });
  };
  const setItemNota = (id, text) => {
    setDraft((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], nota: text } } : prev));
  };

  const startEdit = (order) => {
    const d = {};
    order.items.forEach((it) => (d[it.id] = { qty: it.qty, nota: it.nota || "", baseId: it.baseId, mods: it.mods || [] }));
    setDraft(d);
    setNote(order.nota || "");
    setEditingOrderId(order.id);
  };

  const repetirUltimoPedido = (cuenta) => {
    const propios = cuentaOrders(orders, cuenta.id).sort((a, b) => b.ts - a.ts);
    if (propios.length === 0) return;
    const d = {};
    propios[0].items.forEach((it) => (d[it.id] = { qty: it.qty, nota: it.nota || "", baseId: it.baseId, mods: it.mods || [] }));
    setDraft(d); setNote(""); setEditingOrderId(null);
  };

  const cancelarPedido = async (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      // lo que ese pedido había descontado del inventario vuelve a su lugar
      if (order.consumo && Object.keys(order.consumo).length > 0) await ajustarInventario(order.consumo);
      await saveOrder({ ...order, estado: "cancelado", consumo: {}, canceladoTs: Date.now(), canceladoPor: meseroActual, cancelAvisoVisto: false });
    }
    setConfirmCancelId(null);
    if (editingOrderId === orderId) resetDraft();
  };

  // Sirve UNA unidad de un producto (solo si cocina ya la marcó lista).
  const servirItem = async (orderId, idx) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const it = order.items[idx];
    if (!it || itemServidos(order, it) >= itemListos(order, it)) return;
    vibrar(15);
    const items = order.items.map((x, i) => (i === idx ? { ...x, listos: itemListos(order, x), servidos: itemServidos(order, x) + 1 } : x));
    await saveOrder(conProgreso(order, items));
  };
  // Sirve todas las unidades listas de UN producto (para el panel "Para servir ahora").
  const servirLinea = async (orderId, idx) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const it = order.items[idx];
    if (!it || itemServidos(order, it) >= itemListos(order, it)) return;
    vibrar(15);
    const items = order.items.map((x, i) => (i === idx ? { ...x, listos: itemListos(order, x), servidos: itemListos(order, x) } : x));
    await saveOrder(conProgreso(order, items));
  };
  // Sirve de una vez todo lo que ya está listo en ese pedido.
  const servirTodoListo = async (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const items = order.items.map((x) => ({ ...x, listos: itemListos(order, x), servidos: itemListos(order, x) }));
    await saveOrder(conProgreso(order, items));
  };

  const enviandoRef = useRef(false);
  const buscadorProdRef = useRef(null);
  const enviarAtajoRef = useRef(null);
  enviarAtajoRef.current = null; // solo vale en la pantalla de una mesa (se vuelve a asignar abajo)
  useEffect(() => {
    const alTeclear = (e) => {
      const el = document.activeElement; const tag = el && el.tagName;
      const escribiendo = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !escribiendo && buscadorProdRef.current) { e.preventDefault(); buscadorProdRef.current.focus(); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && enviarAtajoRef.current) { e.preventDefault(); enviarAtajoRef.current(); }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);
  const [enviando, setEnviando] = useState(false);
  const enviarPedido = async (mesaNum) => {
    if (totalItems === 0) return;
    if (enviandoRef.current) return; // ya se está enviando — ignora el segundo toque para no duplicar el pedido
    enviandoRef.current = true;
    setEnviando(true);
    try {
      // Si alguien borró un producto del menú desde otro dispositivo justo mientras
      // este mesero lo tenía en el carrito, lo ignoramos en vez de romper el envío.
      const items = Object.entries(draft)
        .map(([key, e]) => {
          const baseId = e.baseId || key;
          const m = menu.find((x) => x.id === baseId);
          if (!m) return null;
          const mods = e.mods || [];
          // Se guarda el costo y el precio de ESTE momento junto al pedido (el precio ya incluye
          // lo que suman las opciones) — así una venta vieja no cambia si luego editas el menú.
          return { id: key, baseId, name: m.name, price: precioUnitario(m, mods), cost: m.cost || 0, qty: e.qty, nota: (e.nota || "").trim(), mods, estacion: estacionDe(m, config) };
        })
        .filter(Boolean);
      if (items.length === 0) { resetDraft(); return; }

      if (editingOrderId) {
        const original = orders.find((o) => o.id === editingOrderId);
        if (original) {
          const conservados = items.map((it) => {
            const prev = original.items.find((x) => x.id === it.id);
            if (!prev) return it;
            const l = Math.min(itemListos(original, prev), it.qty);
            return { ...it, listos: l, servidos: Math.min(itemServidos(original, prev), l) };
          });
          const consumoNuevo = consumoDeItems(conservados, menu);
          const dif = difConsumo(consumoNuevo, original.consumo || {});
          if (Object.keys(dif).length > 0) await ajustarInventario(negar(dif));
          const cambios = resumenCambio(original.items, conservados);
          if ((original.nota || "") !== note.trim()) cambios.push("nota general");
          const aviso = cambios.length > 0 ? { cambio: { ts: Date.now(), por: meseroActual, texto: cambios.join(" · ") }, cambioVisto: false } : {};
          await saveOrder(conProgreso({ ...original, nota: note.trim(), editado: true, consumo: consumoNuevo, ...aviso }, conservados));
        }
      } else {
        let cuenta = cuentaAbiertaDe(mesaNum);
        // un pedido para llevar / domicilio ya cobrado no se puede seguir llenando
        if (!cuenta && String(mesaNum).startsWith("ext-")) { exitMesa(); return; }
        if (!cuenta) {
          for (const vieja of cuentas.filter((c) => mesaMatch(c.mesa, mesaNum) && esPorLiberar(c))) await saveCuenta({ ...vieja, liberada: true, liberadaTs: Date.now(), liberadaPor: meseroActual });
          const extras = mesasJuntas.filter((id) => !cuentaDeMesa(cuentas, id));
          cuenta = { id: uid(), mesa: mesaNum, ts: Date.now(), estado: "abierta", mesero: meseroActual, ...(extras.length ? { mesasExtra: extras } : {}) };
          await saveCuenta(cuenta);
        }
        const consumo = consumoDeItems(items, menu);
        const order = { id: uid(), mesa: mesaNum, cuentaId: cuenta.id, items, nota: note.trim(), estado: "pendiente", ts: Date.now(), tipo: cuenta.tipo || "mesa", consumo };
        if (Object.keys(consumo).length > 0) await ajustarInventario(negar(consumo));
        await saveOrder(order);
        vibrar(30);
        setJustSent(true);
        setTimeout(() => setJustSent(false), 2200);
      }
      resetDraft();
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const crearExterno = async ({ tipo, cliente, costoEnvio }) => {
    const mesaId = `ext-${uid()}`;
    const hoy = dayKey(Date.now());
    const n = cuentas.filter((c) => c.tipo === tipo && dayKey(c.ts) === hoy).length + 1;
    const cuenta = { id: uid(), mesa: mesaId, tipo, cliente: { ...cliente, nombre: cliente.nombre || `#${n}` }, costoEnvio, ts: Date.now(), estado: "abierta", mesero: meseroActual };
    NOMBRES_EXTERNOS[mesaId] = etiquetaExterna(cuenta);
    await saveCuenta(cuenta);
    setNuevoExterno(null);
    enterMesa(mesaId);
  };

  const mesasLibres = (excluir) => mesas.filter((m) => !mesaMatch(m.id, excluir) && !cuentaAbiertaDe(m.id));
  // Mesas que se pueden juntar a la actual: libres (sin cuenta ni "por liberar") y que no estén ya juntadas.
  const mesasParaJuntar = (excluir, cuenta) => mesas.filter((m) => !mesaMatch(m.id, excluir) && !cuentaDeMesa(cuentas, m.id) && !mesasJuntas.some((j) => mesaMatch(j, m.id)) && !(cuenta && cuentaCubre(cuenta, m.id)));
  const mesasOcupadas = (excluir, cuenta) => mesas.filter((m) => !mesaMatch(m.id, excluir) && cuentaAbiertaDe(m.id) && !(cuenta && cuentaCubre(cuenta, m.id)));

  const juntarMesaLibre = async (cuenta, mesaId) => {
    if (cuenta) await saveCuenta({ ...cuenta, mesasExtra: [...(cuenta.mesasExtra || []), mesaId] });
    else setMesasJuntas((p) => [...p, mesaId]);
    setMesaAction(null);
  };
  const separarMesa = async (cuenta, mesaId) => {
    if (cuenta) await saveCuenta({ ...cuenta, mesasExtra: (cuenta.mesasExtra || []).filter((m) => !mesaMatch(m, mesaId)) });
    else setMesasJuntas((p) => p.filter((m) => !mesaMatch(m, mesaId)));
  };

  const trasladarA = async (cuenta, nuevaMesa) => {
    const afectadas = cuentaOrders(orders, cuenta.id);
    const patch = {};
    afectadas.forEach((o) => { patch[o.id] = { ...o, mesa: nuevaMesa }; });
    if (Object.keys(patch).length > 0) await saveOrdersMap(patch);
    await saveCuenta({ ...cuenta, mesa: nuevaMesa });
    setMesaAction(null);
    setSelectedMesa(nuevaMesa);
  };

  const unirCon = async (cuentaOrigen, cuentaDestino) => {
    const afectadas = cuentaOrders(orders, cuentaOrigen.id);
    const patch = {};
    afectadas.forEach((o) => { patch[o.id] = { ...o, cuentaId: cuentaDestino.id, mesa: cuentaDestino.mesa }; });
    if (Object.keys(patch).length > 0) await saveOrdersMap(patch);
    const extrasOrigen = cuentaOrigen.mesasExtra || [];
    if (extrasOrigen.length) await saveCuenta({ ...cuentaDestino, mesasExtra: [...(cuentaDestino.mesasExtra || []), ...extrasOrigen] });
    await saveCuenta({ ...cuentaOrigen, mesasExtra: [], estado: "fusionada", fusionadaEnId: cuentaDestino.id });
    setMesaAction(null);
    setSelectedMesa(cuentaDestino.mesa);
  };

  if (selectedMesa) {
    const categories = [...new Set(menu.map((m) => m.cat))];
    const cuenta = cuentaAbiertaDe(selectedMesa);
    const pending = cuenta ? cuentaOrders(orders, cuenta.id).filter((o) => o.estado !== "cancelado") : [];
    const esMesaNormal = !(cuenta && esExterna(cuenta)) && !String(selectedMesa).startsWith("ext-");
    const idsMesas = cuenta ? [cuenta.mesa, ...(cuenta.mesasExtra || [])] : [selectedMesa, ...mesasJuntas];
    const tituloMesas = idsMesas.map((id) => mesaNombre(mesas, id)).join(" + ");
    enviarAtajoRef.current = () => { if (totalItems > 0 && !enviando) enviarPedido(selectedMesa); }; // Ctrl+Enter

    return (
      <div style={styles.screen}>
        {avisoListo && <div style={styles.avisoListoBanner}><Volume2 size={14} /> {avisoListo.texto}</div>}
        {modalItem && <ModalOpciones item={modalItem} onClose={() => setModalItem(null)} onAdd={(mods, qty, nota) => agregarConOpciones(modalItem, mods, qty, nota)} />}
        <div className="ancho" style={styles.subHeader}>
          <button style={styles.backBtn} onClick={exitMesa}>← Mesas</button>
          <div style={styles.mesaTitleWrap}>
            <span style={styles.mesaEyebrow}>{TIPO_META[(cuenta && cuenta.tipo) || "mesa"].corto}</span>
            <span style={styles.mesaTitle}>{cuenta && esExterna(cuenta) && cuenta.cliente && cuenta.cliente.nombre ? cuenta.cliente.nombre : tituloMesas}</span>
            {cuenta && <span style={styles.cuentaOpenSub}>Cuenta abierta · {timeLabel(cuenta.ts)}</span>}
          </div>
          {esMesaNormal ? (
            <button style={styles.mesaActionBtn} onClick={() => setMesaAction(mesaAction ? null : "menu")} title="Trasladar o unir esta mesa">
              <ArrowRightLeft size={15} />
            </button>
          ) : (
            <div style={{ width: 34 }} />
          )}
        </div>

        {cuenta && esExterna(cuenta) && (
          <div className="ancho" style={styles.extInfo}>
            {cuenta.cliente && cuenta.cliente.telefono && <span style={styles.extInfoItem}><Phone size={12} /> {cuenta.cliente.telefono}</span>}
            {cuenta.cliente && cuenta.cliente.direccion && <span style={styles.extInfoItem}><MapPin size={12} /> {cuenta.cliente.direccion}{cuenta.cliente.referencia ? ` · ${cuenta.cliente.referencia}` : ""}</span>}
            {cuenta.costoEnvio > 0 && <span style={styles.extInfoItem}><Bike size={12} /> Domicilio {money(cuenta.costoEnvio)}</span>}
            {!(cuenta.cliente && (cuenta.cliente.telefono || cuenta.cliente.direccion)) && !(cuenta.costoEnvio > 0) && <span style={styles.extInfoItem}>Se cobra en Caja al entregar</span>}
          </div>
        )}

        {mesaAction === "menu" && (
          <div style={styles.mesaActionPanel}>
            {cuenta && (
              <button style={styles.modoChoiceBtn} onClick={() => setMesaAction("trasladar")}>
                <ArrowRightLeft size={15} /> Trasladar esta mesa a otra
              </button>
            )}
            <button style={styles.modoChoiceBtn} onClick={() => setMesaAction("unir")}>
              <Users size={15} /> Unir con otra mesa
            </button>
          </div>
        )}
        {mesaAction === "trasladar" && (
          <div style={styles.mesaActionPanel}>
            <div style={styles.closeConfirmText}>Elige la mesa libre destino:</div>
            <div style={styles.mesaPickerRow}>
              {mesasLibres(selectedMesa).length === 0 && <span style={styles.cajaEmptyText}>No hay mesas libres.</span>}
              {mesasLibres(selectedMesa).map((m) => (
                <button key={m.id} style={styles.mesaPickerBtn} onClick={() => trasladarA(cuenta, m.id)}>{m.nombre}</button>
              ))}
            </div>
            <button style={styles.cancelEditBtn} onClick={() => setMesaAction("menu")}>Volver</button>
          </div>
        )}
        {mesaAction === "unir" && (
          <div style={styles.mesaActionPanel}>
            <div style={styles.closeConfirmText}>Juntar mesas libres (quedan en una sola cuenta):</div>
            <div style={styles.mesaPickerRow}>
              {mesasParaJuntar(selectedMesa, cuenta).length === 0 && <span style={styles.cajaEmptyText}>No hay mesas libres.</span>}
              {mesasParaJuntar(selectedMesa, cuenta).map((m) => (
                <button key={m.id} style={styles.mesaPickerBtn} onClick={() => juntarMesaLibre(cuenta, m.id)}>{m.nombre}</button>
              ))}
            </div>
            {mesasOcupadas(selectedMesa, cuenta).length > 0 && (
              <>
                <div style={{ ...styles.closeConfirmText, marginTop: 6 }}>{cuenta ? "O fusionar con una cuenta ya abierta:" : "O sumarte a una cuenta ya abierta:"}</div>
                <div style={styles.mesaPickerRow}>
                  {mesasOcupadas(selectedMesa, cuenta).map((m) => (
                    <button key={m.id} style={styles.mesaPickerBtn} onClick={() => (cuenta ? unirCon(cuenta, cuentaAbiertaDe(m.id)) : (setMesaAction(null), setSelectedMesa(m.id)))}>{m.nombre}</button>
                  ))}
                </div>
              </>
            )}
            <button style={styles.cancelEditBtn} onClick={() => setMesaAction("menu")}>Volver</button>
          </div>
        )}

        {esMesaNormal && idsMesas.length > 1 && (
          <div className="ancho" style={styles.extInfo}>
            <span style={styles.extInfoItem}><Users size={12} /> Mesas juntas:</span>
            {idsMesas.slice(1).map((id) => (
              <button key={id} style={{ ...styles.extInfoItem, background: "transparent", border: "1px solid var(--c-e4dfce-o)", borderRadius: 999, padding: "2px 9px", color: "inherit", cursor: "pointer", fontSize: 12.5 }} onClick={() => separarMesa(cuenta, id)} title="Separar esta mesa">
                {mesaNombre(mesas, id)} ✕
              </button>
            ))}
          </div>
        )}

        <div style={styles.cuerpoScroll}>
        {pending.length > 0 && (() => {
          const activos = pending.filter((o) => o.estado !== "servido");
          const enCocinaU = activos.reduce((a, o) => a + o.items.reduce((x, it) => x + (it.qty - itemListos(o, it)), 0), 0);
          const listosU = activos.reduce((a, o) => a + porServir(o), 0);
          const totalCuenta = cuentaSubtotal(orders, cuenta.id);
          return (
            <div className="ancho" style={styles.pedidosWrap}>
              <button style={styles.pedidosResumen} onClick={() => setVerPedidos((v) => !v)}>
                <span style={styles.pedidosResumenTxt}>
                  {enCocinaU > 0 && <span style={{ color: "var(--c-c1442d-t)", fontWeight: 700 }}>● {enCocinaU} en cocina</span>}
                  {listosU > 0 && <span style={{ color: "var(--c-2f6690-t)", fontWeight: 700 }}>● {listosU} para servir</span>}
                  {enCocinaU === 0 && listosU === 0 && <span style={{ color: "var(--c-5b7553-t)", fontWeight: 700 }}>✓ Todo servido</span>}
                </span>
                <span style={{ ...styles.pedidosResumenTotal, display: "inline-flex", alignItems: "center", gap: 6 }}>{money(totalCuenta)} <Chevron abierto={verPedidos} size={15} /></span>
              </button>
              {verPedidos && (
                <div style={styles.pedidosLista}>
                  {pending.map((o) => {
                    const puedeModificar = o.estado === "pendiente" || o.estado === "preparando" || o.estado === "listo";
                    const hayServidos = o.items.some((it) => itemServidos(o, it) > 0);
                    const numRonda = pending.slice().sort((a, b) => a.ts - b.ts).findIndex((x) => x.id === o.id) + 1;
                    if (o.estado === "servido") {
                      return (
                        <div key={o.id} style={styles.pedidoServidoRow}>
                          <span style={{ color: "var(--c-5b7553-t)" }}>✓</span> {o.items.reduce((a, i) => a + i.qty, 0)} ítems servidos · {money(orderTotal(o))}
                          <span style={styles.miniTicketTime}>{timeLabel(o.ts)}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={o.id} className="anim-in" style={styles.pedidoCard}>
                        <div style={styles.pedidoCardHead}>
                          <span style={styles.pedidoCardInfo}>
                            <span style={{ ...styles.stateDot, background: STATE_META[o.estado].color }} />
                            Ronda {numRonda} · {timeLabel(o.ts)} · {money(orderTotal(o))}
                            {o.editado && <span style={styles.editedTag}>editado</span>}
                          </span>
                          {puedeModificar && (
                            <div style={styles.miniTicketActions}>
                              {confirmCancelId === o.id ? (
                                <>
                                  <span style={styles.confirmText}>¿Cancelar?</span>
                                  <button style={styles.confirmYes} onClick={() => cancelarPedido(o.id)}>Sí</button>
                                  <button style={styles.confirmNo} onClick={() => setConfirmCancelId(null)}>No</button>
                                </>
                              ) : (
                                <>
                                  <button style={styles.iconBtn} onClick={() => startEdit(o)} title="Modificar"><Pencil size={13} /></button>
                                  {!hayServidos && <button style={{ ...styles.iconBtn, color: "var(--c-c1442d-t)" }} onClick={() => setConfirmCancelId(o.id)} title="Cancelar"><Ban size={13} /></button>}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        {o.items.map((it, idx) => {
                          const l = itemListos(o, it), sv = itemServidos(o, it);
                          const disponibles = l - sv;
                          return (
                            <div key={idx} style={styles.itemEstadoRow}>
                              <span style={styles.itemEstadoName}>
                                {it.qty}× {itemNombre(it)}
                                <span style={{ ...styles.itemEstadoTag, color: sv >= it.qty ? "var(--c-5b7553-t)" : disponibles > 0 ? "var(--c-2f6690-t)" : "var(--c-8a8272-t)" }}>
                                  {sv >= it.qty ? "servido" : disponibles > 0 ? `${disponibles} listo${disponibles > 1 ? "s" : ""} para servir` : "en cocina"}
                                  {it.qty > 1 && ` · ${sv}/${it.qty} servidos`}
                                </span>
                              </span>
                              {disponibles > 0 && (
                                <button style={styles.marcarServidoBtn} onClick={() => servirItem(o.id, idx)}><Check size={12} /> Servir{it.qty > 1 ? " 1" : ""}</button>
                              )}
                            </div>
                          );
                        })}
                        {porServir(o) > 1 && (
                          <button style={{ ...styles.marcarServidoBtn, alignSelf: "flex-start" }} onClick={() => servirTodoListo(o.id)}><Check size={12} /> Servir todo lo listo ({porServir(o)})</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {editingOrderId && (
          <div style={styles.editingBanner}><AlertTriangle size={14} /> Modificando pedido ya enviado — los cambios se reflejan en cocina.</div>
        )}
        {justSent && (
          <div style={styles.sentBanner}><Check size={14} /> Pedido enviado a cocina</div>
        )}
        {!editingOrderId && totalItems === 0 && cuenta && cuentaOrders(orders, cuenta.id).length > 0 && (
          <button style={styles.repeatBtn} onClick={() => repetirUltimoPedido(cuenta)}>↻ Repetir último pedido de esta cuenta</button>
        )}

        <div style={{ ...styles.catPillsWrap, position: "sticky", top: 0, zIndex: 5, background: "var(--c-f7f4ec-b)" }}>
          <div style={{ position: "relative" }}>
            <Search size={17} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-8a8272-t)", pointerEvents: "none" }} />
            <input style={{ ...styles.searchInput, width: "100%", boxSizing: "border-box", paddingLeft: 40, paddingRight: search ? 38 : 12 }} ref={buscadorProdRef} data-enter="blur" placeholder="Buscar producto…  ( / )" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button aria-label="Borrar búsqueda" onClick={() => setSearch("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--c-8a8272-t)", cursor: "pointer" }}><X size={15} /></button>
            )}
          </div>
          {!search.trim() && (
            <div style={styles.catPills}>
              {categories.map((cat) => {
                const qtyInCat = menu.filter((m) => m.cat === cat).reduce((s, m) => s + (draft[m.id]?.qty || 0), 0);
                const isActive = (activeCat || categories[0]) === cat;
                return (
                  <button key={cat} style={{ ...styles.catPill, ...(isActive ? styles.catPillActive : {}) }} onClick={() => setActiveCat(cat)}>
                    {cat}
                    {qtyInCat > 0 && <span style={styles.catPillBadge}>{qtyInCat}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="ancho" style={{ ...styles.menuScroll, flex: "none", overflowY: "visible" }}>
          {(search.trim()
            ? menu.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))
            : menu.filter((m) => m.cat === (activeCat || categories[0]))
          ).map((item) => {
            const conOpc = tieneOpciones(item);
            const d = draft[item.id];
            const lineas = conOpc ? Object.entries(draft).filter(([k, v]) => (v.baseId || k) === item.id) : [];
            const qtyTot = conOpc ? lineas.reduce((a, [, v]) => a + v.qty, 0) : (d?.qty || 0);
            const agotadoManual = !!item.agotado;
            const sinStock = !agotadoManual && faltaStock(item, insumos);
            const agotado = agotadoManual || (sinStock && !!config.inventarioBloquear);
            return (
              <div key={item.id} style={{ ...styles.menuRow, flexWrap: "wrap", opacity: agotado ? 0.5 : 1 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={styles.menuItemName}>{item.name} {agotadoManual && <span style={styles.agotadoTag}>AGOTADO</span>}{sinStock && <span style={styles.agotadoTag}>SIN STOCK</span>}</div>
                  {search.trim() && <div style={styles.menuItemCat}>{item.cat}</div>}
                  <div style={styles.menuItemPrice}>{conOpc ? "desde " : ""}{money(item.price)}</div>
                  {lineas.map(([k, v]) => (
                    <div key={k} style={styles.lineaOpc} className="anim-in">
                      <span style={styles.lineaOpcTxt}>{v.qty}× {v.mods && v.mods.length ? modsTexto(v.mods) : "Normal"}{v.nota ? ` · ${v.nota}` : ""}</span>
                      <button style={styles.lineaOpcBtn} onClick={() => addQty(k, -1)}><Minus size={11} /></button>
                      <button style={styles.lineaOpcBtn} onClick={() => addQty(k, 1)}><Plus size={11} /></button>
                    </div>
                  ))}
                </div>
                {conOpc ? (
                  <div style={styles.stepper}>
                    {qtyTot > 0 && <span style={styles.stepVal}>{qtyTot}</span>}
                    <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus, width: qtyTot > 0 ? 28 : 64 }} disabled={agotado} onClick={() => setModalItem(item)}>
                      {qtyTot > 0 ? <Plus size={14} /> : <span style={{ fontSize: 12, fontWeight: 700 }}>Elegir</span>}
                    </button>
                  </div>
                ) : (
                  <div style={styles.stepper}>
                    <button style={styles.stepBtn} disabled={agotado} onClick={() => addQty(item.id, -1)}><Minus size={14} /></button>
                    <span style={styles.stepVal}>{d?.qty || 0}</span>
                    <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus }} disabled={agotado} onClick={() => addQty(item.id, 1)}><Plus size={14} /></button>
                  </div>
                )}
                {!conOpc && d && d.qty > 0 && (
                  <div style={{ flexBasis: "100%", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 2 }}>
                    {notingItemId === item.id ? (
                      <>
                        <input
                          autoFocus style={{ ...styles.itemNoteInput, flex: 1, minWidth: 0 }} placeholder="Nota para este producto…" enterKeyHint="done"
                          value={d.nota} onChange={(e) => setItemNota(item.id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") setNotingItemId(null); }}
                        />
                        <button style={styles.notaListoBtn} onMouseDown={(e) => e.preventDefault()} onClick={() => setNotingItemId(null)}><Check size={16} /> Listo</button>
                      </>
                    ) : (
                      <button style={{ ...styles.notaBtn, ...(d.nota ? styles.notaBtnOn : {}) }} onClick={() => setNotingItemId(item.id)}>
                        <PencilLine size={14} /> {d.nota ? d.nota : "Agregar nota"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {search.trim() && menu.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
            <div style={styles.noResults}>Sin resultados para "{search}"</div>
          )}
        </div>
        </div>

        <div className="ancho" style={styles.orderBar}>
          {(notaAbierta || note) && (
            <input autoFocus={!note} placeholder="Nota general para cocina (opcional)" value={note} onChange={(e) => setNote(e.target.value)} style={styles.noteInput} />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {editingOrderId && <button style={styles.cancelEditBtn} onClick={resetDraft}>Descartar</button>}
            {!(notaAbierta || note) && (
              <button style={{ ...styles.cancelEditBtn, flex: "0 0 auto", padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center" }} onClick={() => setNotaAbierta(true)} aria-label="Agregar nota para cocina" title="Nota para cocina"><MessageSquarePlus size={18} /></button>
            )}
            <button style={{ ...styles.sendBtn, flex: 1, opacity: totalItems === 0 || enviando ? 0.4 : 1 }} disabled={totalItems === 0 || enviando} onClick={() => enviarPedido(selectedMesa)}>
              {editingOrderId ? <Check size={16} /> : <Send size={16} />}
              {enviando ? "Enviando…" : editingOrderId ? `Guardar cambios (${totalItems})` : `Enviar pedido ${totalItems > 0 ? `(${totalItems})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Todo lo que ya salió de cocina y falta llevar, por mesa — solo de MIS cuentas abiertas.
  const paraServirPorMesa = (() => {
    const grupos = [];
    cuentas
      .filter((c) => c.mesero === meseroActual && c.estado === "abierta")
      .forEach((c) => {
        const lineas = [];
        cuentaOrders(orders, c.id).forEach((o) => {
          if (o.estado === "cancelado") return;
          o.items.forEach((it, idx) => {
            const n = itemListos(o, it) - itemServidos(o, it);
            if (n > 0) lineas.push({ orderId: o.id, idx, nombre: itemNombre(it), n, faltan: it.qty - itemListos(o, it), ts: o.ts });
          });
        });
        if (lineas.length > 0) grupos.push({ mesa: c.mesa, nombre: mesaNombre(mesas, c.mesa), lineas: lineas.sort((a, b) => a.ts - b.ts), ts: Math.min(...lineas.map((l) => l.ts)) });
      });
    return grupos.sort((a, b) => a.ts - b.ts);
  })();

  return (
    <div style={styles.screen}>
      {avisoListo && (
        <button style={{ ...styles.avisoListoBanner, width: "100%", border: "none", textAlign: "left", cursor: avisoListo.mesa ? "pointer" : "default" }} onClick={() => avisoListo.mesa && enterMesa(avisoListo.mesa)}>
          <Volume2 size={16} /> <span style={{ flex: 1 }}>{avisoListo.texto}</span>{avisoListo.mesa && <span style={{ fontSize: 11, opacity: 0.9 }}>ir a la mesa ›</span>}
        </button>
      )}
      <AvisoActivarNotificaciones />
      {liberarCuenta && (
        <Hoja onCerrar={() => setLiberarCuenta(null)} ancho={440} gap={12} label="Liberar mesa">
{({ cerrar: cerrarHoja }) => (
<>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" }}>{mesaNombre(mesas, liberarCuenta.mesa)} ya pagó</div>
            <div style={{ fontSize: 13.5, color: "var(--c-5c5648-t)", lineHeight: 1.5 }}>La cuenta está cobrada y la mesa sigue ocupada hasta que se libere. Libérala cuando el cliente ya se haya ido.</div>
            <button style={styles.sendBtn} onClick={() => liberarMesa(liberarCuenta)}>Liberar mesa</button>
            <button style={styles.cancelEditBtn} onClick={cerrarHoja}>Cancelar</button>
          </>
)}
</Hoja>
      )}
      <div className="ancho" style={styles.mesaGridHeader}>
        <div>
          <div style={styles.pageEyebrow}>SALÓN</div>
          <div style={styles.pageTitle}>Mesas</div>
        </div>
      </div>
      <div className="ancho" style={styles.vistaMesasSwitch}>
        <button style={{ ...styles.vistaMesasBtn, ...(vistaMesas === "grid" ? styles.vistaMesasBtnActive : {}) }} onClick={() => setVistaMesas("grid")}>Cuadrícula</button>
        <button style={{ ...styles.vistaMesasBtn, ...(vistaMesas === "plano" ? styles.vistaMesasBtnActive : {}) }} onClick={() => setVistaMesas("plano")}>Plano</button>
      </div>
      <div style={styles.mesasScroll}>
        {paraServirPorMesa.length > 0 && (
          <div className="ancho" style={styles.paraServirWrap}>
            <div style={styles.paraServirTitulo}><Volume2 size={13} /> PARA SERVIR AHORA</div>
            {paraServirPorMesa.map((g) => (
              <div key={g.mesa} className="anim-in" style={styles.paraServirCard}>
                <button style={styles.paraServirMesa} onClick={() => enterMesa(g.mesa)}>{g.nombre} ›</button>
                {g.lineas.map((l) => (
                  <div key={`${l.orderId}-${l.idx}`} style={styles.paraServirLinea}>
                    <span style={styles.paraServirTxt}><b>{l.n}×</b> {l.nombre}{l.faltan > 0 ? <span style={styles.paraServirFaltan}> · faltan {l.faltan} en cocina</span> : null}</span>
                    <button style={styles.marcarServidoBtn} onClick={() => servirLinea(l.orderId, l.idx)}><Check size={12} /> Servir{l.n > 1 ? ` ${l.n}` : ""}</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      {vistaMesas === "plano" ? (
        <div style={{ padding: "0 16px 16px" }}>
          <PlanoSalon mesas={mesas} zonas={(config.plano && config.plano.zonas) || []} alto={(config.plano && config.plano.alto) || 100} cuentas={cuentas} orders={orders} editable={false} onTapMesa={tocarMesa} />
        </div>
      ) : (
        <div className="ancho" style={styles.mesaGrid}>
          {mesas.length === 0 && (
            <div style={styles.cajaEmptyText}>No hay mesas creadas todavía. Toca "Mesas" para agregar la primera.</div>
          )}
          {mesas.map((m) => {
            const cuenta = cuentaDeMesa(cuentas, m.id);
            const visual = estadoVisualMesa(cuenta, cuenta ? cuentaOrders(orders, cuenta.id) : []);
            // Mesas juntas: se dibujan fusionadas en un solo bloque (2, 3… recuadros pegados con una sola cuenta).
            const miembros = cuenta ? mesas.filter((x) => cuentaCubre(cuenta, x.id)) : [];
            if (miembros.length > 1) {
              if (miembros[0].id !== m.id) return null; // el bloque se dibuja una sola vez, en la primera mesa del grupo
              const n = miembros.length;
              const cols = n <= 3 ? n : n === 4 ? 2 : 3;
              return (
                <div key={"fus-" + cuenta.id} className="anim-in" style={{ ...styles.mesaFusion, borderColor: visual.bg }}>
                  <div style={{ ...styles.mesaFusionGrid, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                    {miembros.map((x) => (
                      <button key={x.id} style={styles.mesaFusionTile} onClick={() => tocarMesa(x.id)}>
                        <span style={styles.mesaCardNum}>{x.nombre}</span>
                      </button>
                    ))}
                  </div>
                  <div style={styles.mesaFusionPie}>
                    <span style={{ ...styles.mesaCardTag, background: visual.bg, color: visual.color }}>{visual.tag}</span>
                    <span style={styles.mesaCardSince}>{n} mesas juntas · {esPorLiberar(cuenta) ? `pagada ${timeLabel(cuenta.pagadaTs)}` : `desde ${timeLabel(cuenta.ts)}`}</span>
                  </div>
                </div>
              );
            }
            return (
              <button key={m.id} className="anim-in" style={styles.mesaCard} onClick={() => tocarMesa(m.id)}>
                <span style={styles.mesaCardNum}>{m.nombre}</span>
                <span style={{ ...styles.mesaCardTag, background: visual.bg, color: visual.color }}>{visual.tag}</span>
                {visual.extra && <span style={styles.mesaCardExtra}>{visual.extra}</span>}
                {!cuenta && (() => { const res = reservaProxima(reservas, m.id); return res ? <span style={{ ...styles.mesaCardExtra, color: "var(--warn-solid)", fontWeight: 700 }}>Reserva {new Date(res.ts).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })} · {res.nombre}</span> : null; })()}
                {cuenta && <span style={styles.mesaCardSince}>{esPorLiberar(cuenta) ? `pagada ${timeLabel(cuenta.pagadaTs)}` : `desde ${timeLabel(cuenta.ts)}`}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="ancho" style={styles.externosWrap}>
        <div style={styles.catLabel}>PARA LLEVAR Y DOMICILIOS</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.externoBtn} onClick={() => setNuevoExterno("llevar")}><ShoppingBag size={16} /> Para llevar</button>
          <button style={styles.externoBtn} onClick={() => setNuevoExterno("domicilio")}><Bike size={16} /> Domicilio</button>
        </div>
        {cuentas.filter((c) => esExterna(c) && c.estado === "abierta").sort((a, b) => a.ts - b.ts).map((c) => {
          const visual = estadoVisualMesa(c, cuentaOrders(orders, c.id));
          return (
            <button key={c.id} style={styles.externoCard} className="anim-in" onClick={() => enterMesa(c.mesa)}>
              <span style={styles.externoIcon}>{c.tipo === "domicilio" ? <Bike size={18} /> : <ShoppingBag size={18} />}</span>
              <span style={styles.externoInfo}>
                <span style={styles.externoNombre}>{mesaNombre(mesas, c.mesa)}</span>
                <span style={styles.externoSub}>{c.cliente && c.cliente.direccion ? c.cliente.direccion : `desde ${timeLabel(c.ts)}`}</span>
              </span>
              <span style={{ ...styles.mesaCardTag, background: visual.bg, color: visual.color }}>{visual.tag}</span>
            </button>
          );
        })}
      </div>
      </div>
      {nuevoExterno && <NuevoPedidoExterno tipo={nuevoExterno} onCancel={() => setNuevoExterno(null)} onCrear={crearExterno} />}
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Minus, Check, Receipt, Ban, AlertTriangle, Lock, Wallet,
  Users, Gift, Phone, MapPin, Shuffle, HandCoins, ChevronDown,
} from "lucide-react";
import { itemNombre, TIPO_META, esExterna, uid, money } from "../logica.js";
import { avisar } from "../avisos.jsx";

// Enter dentro de un monto = pulsar el botón principal del cobro (si está disponible)
const confirmarConEnter = () => {
  const b = document.querySelector("[data-confirmar]:not([disabled])");
  if (b) b.click();
};
import { CampoMonto, MetodoPills, Chevron } from "../componentes/Comunes.jsx";
import { METODO_META, PROPINA_OPCIONES } from "../constantes.js";
import { styles } from "../estilos.js";
import { conProgreso, cuentaGranTotal, cuentaItemCount, cuentaOrders, cuentaSubtotal, dateTimeLabel, itemsAgregados, mesaNombre, orderTotal, pagosDe, pagosTotal, qtyAsignadaPorProducto, tieneRol, timeLabel } from "../utilidades.js";

export function MesaCuentaCard({ cuenta, orders, saveCuenta, saveOrdersMap, turnoAbierto, usuarioActual, mesas, ajustarInventario, expanded, onToggle, modoPanel }) {
  const subtotal = cuentaSubtotal(orders, cuenta.id);
  const total = cuentaGranTotal(orders, cuenta);
  const items = cuentaItemCount(orders, cuenta.id);
  const ords = cuentaOrders(orders, cuenta.id).filter((o) => o.estado !== "cancelado");
  const pagos = pagosDe(cuenta);
  const cobrado = pagosTotal(cuenta);
  const restante = Math.max(0, total - cobrado);
  const enCurso = pagos.length > 0 && restante > 0;

  const [modoLocal, setModoLocal] = useState(null);
  const [metodoSel, setMetodoSel] = useState(null);
  const [efectivoRecibido, setEfectivoRecibido] = useState("");
  const [vueltaPropina, setVueltaPropina] = useState(false); // dejar la vuelta como propina
  const [montoMixto, setMontoMixto] = useState("");           // monto de este pago en "Pago mixto"
  const [numPartes, setNumPartes] = useState(2);
  const [verAjustes, setVerAjustes] = useState(false); // propina y descuento son opcionales: van ocultos hasta que se necesiten
  // Pago combinado: una misma parte/persona se paga con varios métodos (ej. $5.000 efectivo + $8.000 transferencia).
  // Los abonos se anotan aquí y solo se guardan todos juntos cuando suman lo que esa parte debe.
  const [combinar, setCombinar] = useState(false);
  const [abonos, setAbonos] = useState([]);
  const [montoAbono, setMontoAbono] = useState("");
  const limpiarCombinado = () => { setCombinar(false); setAbonos([]); setMontoAbono(""); };
  const [cart, setCart] = useState({});
  const [etiqueta, setEtiqueta] = useState("");
  const [propinaCustom, setPropinaCustom] = useState("");
  const [mostrarDescuento, setMostrarDescuento] = useState(false);
  const [descMonto, setDescMonto] = useState("");
  const [descMotivo, setDescMotivo] = useState("");
  const [confirmCancelarCuenta, setConfirmCancelarCuenta] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  useEffect(() => { if (!expanded) { setModoLocal(null); setMetodoSel(null); setEfectivoRecibido(""); setVueltaPropina(false); setMontoMixto(""); setCart({}); setEtiqueta(""); setMostrarDescuento(false); limpiarCombinado(); } }, [expanded]);
  const seleccionarMetodo = (m) => { setMetodoSel(m); setEfectivoRecibido(""); setVueltaPropina(false); };

  // Calculadora de vueltos: solo aplica cuando el método elegido es efectivo.
  // Si sobra vuelta, se puede dejar como propina: ese sobrante se suma a la propina de la cuenta
  // y al cobro (así aparece en caja, en los reportes y en el reparto de propinas, como cualquier otra).
  const renderVueltos = (monto) => {
    if (metodoSel !== "efectivo") return null;
    const recibido = parseFloat(efectivoRecibido) || 0;
    const vueltos = Math.round(recibido - monto);
    return (
      <div style={styles.vueltosBox}>
        <CampoMonto placeholder={`¿Con cuánto paga? (a cobrar ${money(monto)})`} value={efectivoRecibido} onChange={setEfectivoRecibido} onEnter={confirmarConEnter} />
        {efectivoRecibido !== "" && (
          <div style={{ ...styles.diferenciaBox, background: vueltos >= 0 ? "var(--c-e4eee1-b)" : "var(--c-fbe2dc-b)" }}>
            {vueltos < 0 ? `Faltan ${money(Math.abs(vueltos))}` : vueltaPropina && vueltos > 0 ? `Se cobra ${money(monto + vueltos)}: ${money(monto)} + ${money(vueltos)} de propina` : `Total a devolver: ${money(vueltos)}`}
          </div>
        )}
        {vueltos > 0 && (
          <button
            type="button" onClick={() => setVueltaPropina((v) => !v)}
            style={{ ...styles.vueltaPropinaBtn, ...(vueltaPropina ? styles.vueltaPropinaBtnOn : {}) }}
          >
            <HandCoins size={15} /> {vueltaPropina ? `Vuelta dejada como propina (${money(vueltos)}) ✓` : `Dejar la vuelta como propina (${money(vueltos)})`}
          </button>
        )}
      </div>
    );
  };
  // Cuánto de la vuelta se deja de propina en este cobro (0 si no aplica)
  const vueltaDejada = (monto) => {
    if (!vueltaPropina || metodoSel !== "efectivo") return 0;
    return Math.max(0, Math.round((parseFloat(efectivoRecibido) || 0) - monto));
  };

  const effectiveModo = cuenta.splitMode || modoLocal;

  async function patchCuenta(patch) {
    await saveCuenta({ ...cuenta, ...patch });
  }

  const cobrandoRef = useRef(false);
  const [cobrando, setCobrando] = useState(false);
  // Guarda uno o varios pagos de una sola vez (un pago combinado son varios registros, uno por método).
  async function guardarPagos(entradas) {
    if (cobrandoRef.current) return; // ya se está registrando un pago — ignora el segundo toque para no cobrar doble
    cobrandoRef.current = true;
    setCobrando(true);
    try {
      // La vuelta dejada como propina sube la propina de la cuenta y el monto cobrado en la misma cantidad.
      const vueltaTotal = entradas.reduce((s, e) => s + (e.vuelta || 0), 0);
      const nuevos = entradas.map(({ pago, vuelta }) => (vuelta > 0 ? { ...pago, monto: pago.monto + vuelta, propinaVuelta: vuelta } : pago));
      const totalNuevo = total + vueltaTotal;
      const nuevosPagos = [...pagosDe(cuenta), ...nuevos];
      const totalPagado = nuevosPagos.reduce((s, p) => s + p.monto, 0);
      const completo = totalPagado >= totalNuevo - 1;
      const cuentaAntes = cuenta; let ordenesAntes = [];
      if (completo) {
        // La mesa ya se pagó por completo — si quedó algo sin marcar "listo" o
        // "servido" en Cocina/Mesero, lo cerramos ahora como servido (si ya se
        // pagó es porque ya se consumió). Si no, se queda como un pedido
        // fantasma activo para siempre, aunque ya esté cobrado.
        const sinCerrar = cuentaOrders(orders, cuenta.id).filter((o) => o.estado === "pendiente" || o.estado === "preparando" || o.estado === "listo");
        if (sinCerrar.length > 0) {
          ordenesAntes = sinCerrar;
          const patch = {};
          sinCerrar.forEach((o) => { patch[o.id] = conProgreso(o, o.items.map((it) => ({ ...it, listos: it.qty, servidos: it.qty }))); });
          await saveOrdersMap(patch);
        }
      }
      const propina = vueltaTotal > 0 ? { pct: null, monto: ((cuenta.propina && cuenta.propina.monto) || 0) + vueltaTotal } : (cuenta.propina || null);
      await saveCuenta({ ...cuenta, propina, pagos: nuevosPagos, splitMode: effectiveModo || cuenta.splitMode || null, estado: completo ? "pagada" : "abierta", pagadaTs: completo ? Date.now() : cuenta.pagadaTs, ...(completo && !esExterna(cuenta) ? { liberada: false } : {}) });
      setMetodoSel(null); setEfectivoRecibido(""); setVueltaPropina(false); setMontoMixto(""); setCart({}); setEtiqueta(""); limpiarCombinado();
      const montoRegistrado = nuevos.reduce((s, p) => s + p.monto, 0);
      avisar({
        texto: completo ? "Cuenta cobrada" : "Pago registrado",
        detalle: completo ? `${mesaNombre(mesas, cuenta.mesa)} · ${money(totalNuevo)}` : `${money(montoRegistrado)} · falta ${money(Math.max(0, totalNuevo - totalPagado))}`,
        deshacer: async () => {
          if (ordenesAntes.length > 0) await saveOrdersMap(Object.fromEntries(ordenesAntes.map((o) => [o.id, o])));
          await saveCuenta(cuentaAntes);
        },
      });
    } finally {
      cobrandoRef.current = false;
      setCobrando(false);
    }
  }
  const guardarPago = (pagoBase, vuelta = 0) => guardarPagos([{ pago: pagoBase, vuelta }]);

  const esAdmin = tieneRol(usuarioActual, "admin");

  const setPropina = async (pct) => {
    const monto = pct === "custom" ? Math.round(parseFloat(propinaCustom) || 0) : Math.round((subtotal * pct) / 100);
    await patchCuenta({ propina: { pct: pct === "custom" ? null : pct, monto } });
  };
  const aplicarDescuento = async () => {
    if (!esAdmin) return;
    const monto = Math.round(parseFloat(descMonto) || 0);
    if (monto <= 0) return;
    await patchCuenta({ descuento: { monto, motivo: descMotivo.trim() || "Sin motivo especificado", aplicadoPor: usuarioActual.nombre } });
    setMostrarDescuento(false); setDescMonto(""); setDescMotivo("");
  };
  const quitarDescuento = async () => { if (esAdmin) patchCuenta({ descuento: null }); };
  const quitarPropina = async () => { if (pagos.length === 0) patchCuenta({ propina: null }); };

  // Al cancelar la cuenta, también hay que cancelar sus pedidos activos —
  // si no, se quedan "pendientes" para siempre y Cocina los sigue mostrando
  // como si nada, aunque la mesa ya no exista en Caja (pedido fantasma).
  const cancelarPedidosDeCuenta = async () => {
    const activos = cuentaOrders(orders, cuenta.id).filter((o) => o.estado !== "cancelado");
    if (activos.length === 0) return null;
    const patch = {};
    const devolver = {};
    activos.forEach((o) => {
      patch[o.id] = { ...o, estado: "cancelado", consumo: {} };
      // Lo que todavía no se preparó vuelve al inventario; lo que ya salió de cocina ya se gastó.
      if (o.estado === "pendiente" || o.estado === "preparando") Object.entries(o.consumo || {}).forEach(([k, v]) => { devolver[k] = (devolver[k] || 0) + v; });
    });
    await saveOrdersMap(patch);
    if (Object.keys(devolver).length > 0) await ajustarInventario(devolver);
    return { activos, devolver };
  };

  const cancelarCuenta = async () => {
    const cuentaAntes = cuenta; let previo = null;
    const deshacerCancelacion = async () => {
      if (previo) {
        await saveOrdersMap(Object.fromEntries(previo.activos.map((o) => [o.id, o])));
        const volver = {}; Object.entries(previo.devolver).forEach(([k, v]) => { volver[k] = -v; });
        if (Object.keys(volver).length > 0) await ajustarInventario(volver);
      }
      await saveCuenta(cuentaAntes);
    };
    if (total > 0) {
      if (!esAdmin) return;
      if (!motivoCancelacion.trim()) return; // el motivo es obligatorio cuando hay dinero de por medio
      previo = await cancelarPedidosDeCuenta();
      await patchCuenta({
        estado: "cancelada", canceladaTs: Date.now(), canceladaPor: usuarioActual.nombre,
        motivoCancelacion: motivoCancelacion.trim(), montoCancelado: total,
      });
    } else {
      previo = await cancelarPedidosDeCuenta();
      await patchCuenta({ estado: "cancelada", canceladaTs: Date.now(), canceladaPor: usuarioActual.nombre, montoCancelado: 0 });
    }
    setConfirmCancelarCuenta(false); setMotivoCancelacion("");
    avisar({ texto: "Cuenta cancelada", detalle: mesaNombre(mesas, cuenta.mesa), tipo: "info", deshacer: deshacerCancelacion });
  };

  const confirmarUnico = () => { if (!metodoSel) return; guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: total, tipo: "unico", etiqueta: null, items: itemsAgregados(orders, cuenta.id), procesadoPor: usuarioActual.nombre }, vueltaDejada(total)); };

  // Las partes se calculan sobre el total sin las propinas que alguien dejó con su vuelta, para que
  // la propina de una persona no encarezca la parte de las demás.
  const totalBase = total - pagos.reduce((a, p) => a + (p.propinaVuelta || 0), 0);
  const parteMonto = numPartes > 0 ? Math.round(totalBase / numPartes) : 0;
  const partesRegistradas = new Set(pagos.filter((p) => p.tipo === "equitativo").map((p) => p.etiqueta)).size;
  const parteActual = partesRegistradas + 1;
  const esUltimaParte = parteActual >= numPartes;
  const montoParteActual = esUltimaParte ? totalBase - parteMonto * (numPartes - 1) : parteMonto;
  const confirmarParte = () => { if (!metodoSel) return; guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: montoParteActual, tipo: "equitativo", etiqueta: `Parte ${parteActual} de ${numPartes}`, procesadoPor: usuarioActual.nombre }, vueltaDejada(montoParteActual)); };

  const confirmarParteCombinada = (lista) => {
    const grupo = uid();
    guardarPagos(lista.map((a) => ({ pago: { id: uid(), ts: Date.now(), metodoPago: a.metodoPago, monto: a.monto, tipo: "equitativo", etiqueta: `Parte ${parteActual} de ${numPartes}`, grupo, procesadoPor: usuarioActual.nombre }, vuelta: a.vuelta })));
  };

  const agregados = itemsAgregados(orders, cuenta.id);
  const asignada = qtyAsignadaPorProducto(cuenta);
  const pendientes = agregados.map((it) => ({ ...it, qtyPend: it.qty - (asignada[it.key] || 0) })).filter((it) => it.qtyPend > 0);
  const cartMonto = Object.entries(cart).reduce((s, [key, qty]) => { const it = agregados.find((a) => a.key === key); return s + (it ? it.price * qty : 0); }, 0);
  const numPersonaSugerido = new Set(pagos.filter((p) => p.tipo === "por_producto").map((p) => p.grupo || p.id)).size + 1;

  const addToCart = (key, d) => {
    setAbonos([]); // si cambia lo que paga esta persona, los abonos anotados ya no aplican
    setCart((prev) => {
      const it = agregados.find((a) => a.key === key);
      if (!it) return prev;
      const pend = it.qty - (asignada[key] || 0);
      const cur = prev[key] || 0;
      const next = Math.max(0, Math.min(pend, cur + d));
      const copy = { ...prev, [key]: next };
      if (next === 0) delete copy[key];
      return copy;
    });
  };
  const confirmarProducto = () => {
    if (!metodoSel || Object.keys(cart).length === 0) return;
    const itemsSel = Object.entries(cart)
      .map(([key, qty]) => { const it = agregados.find((a) => a.key === key); return it ? { key, name: it.name, price: it.price, qty } : null; })
      .filter(Boolean);
    if (itemsSel.length === 0) return;
    const montoReal = itemsSel.reduce((s, it) => s + it.price * it.qty, 0);
    guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: montoReal, tipo: "por_producto", etiqueta: etiqueta.trim() || `Persona ${numPersonaSugerido}`, items: itemsSel, procesadoPor: usuarioActual.nombre }, vueltaDejada(montoReal));
  };
  const confirmarProductoCombinado = (lista) => {
    const itemsSel = Object.entries(cart)
      .map(([key, qty]) => { const it = agregados.find((a) => a.key === key); return it ? { key, name: it.name, price: it.price, qty } : null; })
      .filter(Boolean);
    if (itemsSel.length === 0) return;
    const grupo = uid();
    const nombre = etiqueta.trim() || `Persona ${numPersonaSugerido}`;
    // Los productos van solo en el primer registro, para que no se cuenten dos veces.
    guardarPagos(lista.map((a, i) => ({ pago: { id: uid(), ts: Date.now(), metodoPago: a.metodoPago, monto: a.monto, tipo: "por_producto", etiqueta: nombre, grupo, ...(i === 0 ? { items: itemsSel } : {}), procesadoPor: usuarioActual.nombre }, vuelta: a.vuelta })));
  };
  const cobrarResto = () => {
    if (!metodoSel || restante <= 0) return;
    const itemsSel = pendientes.map((it) => ({ key: it.key, name: it.name, price: it.price, qty: it.qtyPend }));
    guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: restante, tipo: "por_producto", etiqueta: etiqueta.trim() || `Persona ${numPersonaSugerido} (resto)`, items: itemsSel, procesadoPor: usuarioActual.nombre }, vueltaDejada(restante));
  };

  // Pago mixto: el cliente reparte la cuenta entre varios métodos (ej. $30.000 en efectivo y el saldo con tarjeta).
  // Cada pago descuenta del saldo pendiente por su cuenta; la mesa se cierra cuando el saldo llega a cero.
  // Sin monto escrito = nada elegido todavía (así "Todo el saldo" y "La mitad" se pueden marcar y desmarcar).
  const montoEste = montoMixto === "" ? 0 : Math.min(restante, Math.round(parseFloat(montoMixto) || 0));
  const esTodo = montoMixto !== "" && montoEste >= restante;
  const esMitad = montoMixto !== "" && !esTodo && montoEste === Math.round(restante / 2);
  const pagosMixtos = pagos.filter((p) => p.tipo === "mixto").length;
  const confirmarMixto = () => {
    if (!metodoSel || montoEste <= 0) return;
    const final = montoEste >= restante;
    guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: montoEste, tipo: "mixto", etiqueta: final && pagosMixtos > 0 ? `Pago ${pagosMixtos + 1} (saldo)` : `Pago ${pagosMixtos + 1}`, procesadoPor: usuarioActual.nombre }, vueltaDejada(montoEste));
  };

  // Pantalla de pago combinado para una parte/persona que debe `objetivo`.
  const renderCombinado = (objetivo, onConfirmar, textoFinal) => {
    const abonado = abonos.reduce((s, a) => s + a.monto, 0);
    const falta = Math.max(0, objetivo - abonado);
    const montoSel = montoAbono === "" ? falta : Math.min(falta, Math.round(parseFloat(montoAbono) || 0));
    const esFinal = montoSel >= falta;
    const anotar = () => {
      if (!metodoSel || montoSel <= 0) return;
      const nuevo = { id: uid(), metodoPago: metodoSel, monto: montoSel, vuelta: vueltaDejada(montoSel) };
      if (esFinal) { onConfirmar([...abonos, nuevo]); return; }
      setAbonos([...abonos, nuevo]); setMontoAbono(""); setMetodoSel(null); setEfectivoRecibido(""); setVueltaPropina(false);
    };
    return (
      <div style={styles.combinadoBox}>
        <div style={styles.combinadoHead}>
          <span style={styles.combinadoTitulo}><Shuffle size={14} /> Varios métodos · {money(objetivo)}</span>
          <button style={styles.inlineLink} onClick={() => { setAbonos([]); setMontoAbono(""); setCombinar(false); }}>Un solo método</button>
        </div>
        {abonos.length > 0 && (
          <div style={styles.pagosRegistradosBox}>
            {abonos.map((a) => {
              const meta = METODO_META[a.metodoPago]; const Icon = meta.icon;
              return (
                <div key={a.id} style={styles.pagoRow}>
                  <span style={styles.pagoIcono}><Icon size={14} color="var(--pago-ok)" /></span>
                  <div style={styles.pagoRowMid}><span style={styles.pagoRowEtiqueta}>{meta.label}</span><span style={styles.pagoRowTime}>Anotado, se guarda al completar</span></div>
                  <span style={styles.pagoRowMonto}>{money(a.monto)}</span>
                  <button style={styles.abonoQuitar} onClick={() => setAbonos(abonos.filter((x) => x.id !== a.id))} aria-label="Quitar">✕</button>
                </div>
              );
            })}
          </div>
        )}
        <div style={styles.mixtoSaldo}><span>Falta por cobrar</span><b style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>{money(falta)}</b></div>
        <CampoMonto placeholder={`¿Cuánto paga con este método? (falta ${money(falta)})`} value={montoAbono} onChange={setMontoAbono} onEnter={confirmarConEnter} />
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ ...styles.propinaPill, ...(montoSel === falta ? styles.pillOn : {}) }} onClick={() => setMontoAbono(String(falta))}>Todo lo que falta</button>
          <button style={styles.propinaPill} onClick={() => setMontoAbono(String(Math.round(falta / 2)))}>La mitad</button>
        </div>
        <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
        {renderVueltos(montoSel)}
        <button style={{ ...styles.sendBtn, opacity: metodoSel && montoSel > 0 ? 1 : 0.4 }} disabled={!metodoSel || montoSel <= 0 || cobrando} onClick={anotar}>
          <Check size={15} /> {esFinal ? `${textoFinal} — ${money(objetivo)}` : `Anotar ${money(montoSel)} y elegir otro método`}
        </button>
        {!esFinal && montoSel > 0 && <div style={styles.closeConfirmText}>Después de este abono faltarán {money(falta - montoSel)}.</div>}
      </div>
    );
  };
  const linkCombinar = (
    <button style={styles.inlineAddLink} onClick={() => { setCombinar(true); setAbonos([]); setMontoAbono(""); setMetodoSel(null); setEfectivoRecibido(""); setVueltaPropina(false); }}>
      <Shuffle size={16} /> Pagar con varios métodos
    </button>
  );

  return (
    <div className="anim-in" style={styles.mesaCuentaCard}>
      {modoPanel ? (
        <div style={{ ...styles.mesaCuentaHead, cursor: "default" }}>
          <div style={styles.mesaCuentaLeft}>
            <span style={styles.mesaCuentaNum}>{mesaNombre(mesas, cuenta.mesa)}{esExterna(cuenta) && <span style={styles.extTag}>{TIPO_META[cuenta.tipo].corto}</span>}</span>
            <span style={styles.mesaCuentaSince}>{ords.length} {ords.length === 1 ? "ronda" : "rondas"} · desde {timeLabel(cuenta.ts)}{cuenta.mesero ? ` · ${cuenta.mesero}` : ""}</span>
          </div>
          <button style={styles.cerrarPanelBtn} onClick={onToggle} aria-label="Cerrar detalle">✕</button>
        </div>
      ) : (
      <button style={styles.mesaCuentaHead} onClick={onToggle}>
        <div style={styles.mesaCuentaLeft}>
          <span style={styles.mesaCuentaNum}>{mesaNombre(mesas, cuenta.mesa)}{esExterna(cuenta) && <span style={styles.extTag}>{TIPO_META[cuenta.tipo].corto}</span>}</span>
          <span style={styles.mesaCuentaSince}>{ords.length} {ords.length === 1 ? "ronda" : "rondas"} · desde {timeLabel(cuenta.ts)}{cuenta.mesero ? ` · ${cuenta.mesero}` : ""}</span>
          {enCurso && <span style={styles.enCursoTag}>Cobro en curso · {money(cobrado)} de {money(total)}</span>}
        </div>
        <div style={styles.mesaCuentaRight}><span style={styles.mesaCuentaItems}>{restante < total ? "Por cobrar" : `${items} ítems`}</span><span style={styles.mesaCuentaTotal}>{money(restante)}</span></div>
      </button>
      )}

      {(expanded || modoPanel) && (
        <div style={styles.mesaCuentaBody}>
          {/* Saldo pendiente: lo primero que se ve al cobrar */}
          <div style={styles.saldoCard}>
            <span style={styles.saldoEt}>SALDO PENDIENTE</span>
            <span style={styles.saldoMonto}>{money(restante)}</span>
            <div style={styles.saldoFila}><span>Total de la cuenta</span><b>{money(total)}</b></div>
            {cobrado > 0 && <div style={styles.saldoFila}><span>Ya cobrado</span><b style={{ color: "var(--pago-ok)" }}>{money(cobrado)}</b></div>}
          </div>
          {esExterna(cuenta) && cuenta.cliente && (cuenta.cliente.telefono || cuenta.cliente.direccion) && (
            <div style={styles.extInfoCaja}>
              {cuenta.cliente.telefono && <span style={styles.extInfoItem}><Phone size={12} /> {cuenta.cliente.telefono}</span>}
              {cuenta.cliente.direccion && <span style={styles.extInfoItem}><MapPin size={12} /> {cuenta.cliente.direccion}{cuenta.cliente.referencia ? ` · ${cuenta.cliente.referencia}` : ""}</span>}
            </div>
          )}
          {/* Cada pedido es una ronda, en su propia tarjeta */}
          <div style={styles.rondasBox}>
            {ords.slice().sort((a, b) => a.ts - b.ts).map((o, idx) => (
              <div key={o.id} style={styles.rondaCard}>
                <div style={styles.rondaHead}>
                  <span style={styles.rondaTitulo}>Ronda {idx + 1}</span>
                  <span style={styles.rondaMeta}>{timeLabel(o.ts)}{cuenta.mesero ? ` · ${cuenta.mesero}` : ""}</span>
                  <span style={{ flex: 1 }} />
                  <span style={styles.rondaTotal}>{money(orderTotal(o))}</span>
                </div>
                {o.items.map((it, i) => (
                  <div key={i} style={styles.rondaItem}>
                    <span style={styles.rondaQty}>{it.qty}×</span>
                    <span style={{ flex: 1, minWidth: 0 }}>{itemNombre(it)}{it.nota ? <span style={styles.rondaNota}> “{it.nota}”</span> : null}</span>
                    <span style={styles.rondaPrecio}>{money((it.price || 0) * it.qty)}</span>
                  </div>
                ))}
                {o.nota && <div style={styles.rondaNota}>Nota: {o.nota}</div>}
              </div>
            ))}
          </div>

          <div style={styles.subtotalRow}>
            <span>Subtotal</span><span>{money(subtotal)}</span>
          </div>
          {cuenta.costoEnvio > 0 && (
            <div style={styles.subtotalRow}><span>Domicilio</span><span>+{money(cuenta.costoEnvio)}</span></div>
          )}
          {cuenta.descuento && (
            <div style={styles.subtotalRow}>
              <span>
                Descuento ({cuenta.descuento.motivo}{cuenta.descuento.aplicadoPor ? ` · ${cuenta.descuento.aplicadoPor}` : ""})
                {esAdmin && <button style={styles.inlineLink} onClick={quitarDescuento}>quitar</button>}
              </span>
              <span style={{ color: "var(--c-c1442d-t)" }}>−{money(cuenta.descuento.monto)}</span>
            </div>
          )}
          {cuenta.propina && (
            <div style={styles.subtotalRow}>
              <span>
                Propina {cuenta.propina.pct != null ? `(${cuenta.propina.pct}%)` : ""}
                {pagos.length === 0 && <button style={styles.inlineLink} onClick={quitarPropina}>cambiar</button>}
              </span>
              <span>{money(cuenta.propina.monto)}</span>
            </div>
          )}
          {pagos.length === 0 && (!cuenta.descuento || !cuenta.propina) && (
            <div style={styles.ajustesWrap}>
              <button style={{ ...styles.propinaToggle, ...(verAjustes ? styles.propinaToggleAbierto : {}) }} aria-expanded={verAjustes} onClick={() => { if (verAjustes) setMostrarDescuento(false); setVerAjustes(!verAjustes); }}>
                <span>{!cuenta.descuento && !cuenta.propina ? "Propina y descuento" : !cuenta.propina ? "Propina" : "Descuento o cortesía"}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--c-8a8272-t)", fontWeight: 500, fontSize: 13 }}>
                  {!verAjustes && "Opcional"}
                  <Chevron abierto={verAjustes} size={17} />
                </span>
              </button>
              {verAjustes && (
                <div className="despliega" style={styles.ajustesBox}>
                {!cuenta.descuento && (
                  !esAdmin ? (
                    <div style={styles.lockedNote}><Lock size={11} /> Solo un administrador puede aplicar descuentos o cortesías.</div>
                  ) : mostrarDescuento ? (
                    <div style={styles.descuentoBox}>
                      <CampoMonto placeholder="Monto del descuento" value={descMonto} onChange={setDescMonto} />
                      <input style={{ ...styles.editInput, marginTop: 6 }} placeholder="Motivo (ej: cortesía, cliente frecuente)" value={descMotivo} onChange={(e) => setDescMotivo(e.target.value)} />
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <button style={styles.cancelEditBtn} onClick={() => setMostrarDescuento(false)}>Cancelar</button>
                        <button style={{ ...styles.sendBtn, flex: 1 }} onClick={aplicarDescuento}><Gift size={14} /> Aplicar</button>
                      </div>
                    </div>
                  ) : (
                    <button style={styles.inlineAddLink} onClick={() => setMostrarDescuento(true)}><Gift size={16} /> Aplicar descuento o cortesía</button>
                  )
                )}
                {!cuenta.propina && !mostrarDescuento && (
                  <div style={styles.propinaBox}>
                    <span style={styles.closeConfirmText}>Propina:</span>
                    <div style={styles.propinaPillsRow}>
                      {PROPINA_OPCIONES.map((p) => (
                        <button key={p} style={styles.propinaPill} onClick={() => setPropina(p)}>{p}%</button>
                      ))}
                      <span className="campo-prefijo" style={styles.propinaCustomWrap}><span style={{ color: "var(--c-8a8272-t)", fontWeight: 700, fontSize: 13 }}>$</span><CampoMonto style={styles.propinaCustomInput} placeholder="Otro monto" value={propinaCustom} onChange={setPropinaCustom} /></span>
                      <button style={styles.propinaCustomBtn} onClick={() => setPropina("custom")} disabled={!propinaCustom}>Ok</button>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>
          )}

          <div style={{ ...styles.subtotalRow, ...styles.subtotalRowFinal }}><span>Total a cobrar</span><span>{money(total)}</span></div>

          {total === 0 && pagos.length === 0 && (
            <div style={styles.cerrarVaciaBox}>
              <span style={styles.closeConfirmText}>Esta mesa no tiene nada que cobrar (sin pedidos, o se le quitó todo).</span>
              {confirmCancelarCuenta ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={styles.confirmText}>¿Cerrar la mesa sin cobro?</span>
                  <button style={styles.confirmYes} onClick={cancelarCuenta}>Sí</button>
                  <button style={styles.confirmNo} onClick={() => setConfirmCancelarCuenta(false)}>No</button>
                </div>
              ) : (
                <button style={styles.inlineAddLink} onClick={() => setConfirmCancelarCuenta(true)}><Ban size={16} /> Cerrar mesa (sin consumo)</button>
              )}
            </div>
          )}

          {pagos.length > 0 && (
            <div style={styles.pagosRegistradosBox}>
              <div style={styles.pagosRegistradosLabel}>PAGOS REGISTRADOS</div>
              {pagos.map((p) => {
                const meta = METODO_META[p.metodoPago]; const Icon = meta.icon;
                return (
                  <div key={p.id} style={styles.pagoRow}>
                    <span style={styles.pagoIcono}><Icon size={14} color="var(--pago-ok)" /></span>
                    <div style={styles.pagoRowMid}>
                      <span style={styles.pagoRowEtiqueta}>{p.etiqueta || "Cuenta completa"}</span>
                      {p.tipo === "por_producto" && (p.items || []).length > 0 && <span style={styles.pagoRowItems}>{p.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</span>}
                      <span style={styles.pagoRowTime}>{timeLabel(p.ts)} · {meta.label}{p.procesadoPor ? ` · cobró ${p.procesadoPor}` : ""}</span>
                      {p.propinaVuelta > 0 && <span style={styles.pagoRowItems}>Incluye {money(p.propinaVuelta)} de propina (la vuelta)</span>}
                    </div>
                    <span style={styles.pagoRowMonto}>{money(p.monto)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {!turnoAbierto && restante > 0 && (
            <div style={styles.warnBanner}><AlertTriangle size={14} /> Abre el turno para poder cobrar esta mesa.</div>
          )}

          {restante > 0 && turnoAbierto && (
            <div style={styles.cobroBox}>
              {!effectiveModo ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--c-242019-t)", margin: "2px 0 -2px" }}>¿Cómo quieren pagar?</div>
                  <div style={styles.modoGrid}>
                    <button style={styles.modoChoiceBtn} onClick={() => setModoLocal("unico")}><Wallet size={16} /> Pago único</button>
                    <button style={styles.modoChoiceBtn} onClick={() => setModoLocal("mixto")}><Shuffle size={16} /> Pago mixto</button>
                    <button style={styles.modoChoiceBtn} onClick={() => setModoLocal("igual")}><Users size={16} /> Partes iguales</button>
                    <button style={styles.modoChoiceBtn} onClick={() => setModoLocal("producto")}><Receipt size={16} /> Por producto</button>
                  </div>
                </>
              ) : effectiveModo === "unico" ? (
                <>
                  <div style={styles.closeConfirmText}>Cobrar {money(total)}. Elige el método de pago:</div>
                  <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
                  {renderVueltos(total)}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={styles.cancelEditBtn} onClick={() => setModoLocal(null)}>Volver</button>
                    <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel ? 1 : 0.4 }} disabled={!metodoSel} data-confirmar="1" onClick={confirmarUnico}><Lock size={15} /> Confirmar cobro</button>
                  </div>
                </>
              ) : effectiveModo === "mixto" ? (
                <>
                  <div style={styles.mixtoSaldo}>
                    <span>Saldo pendiente</span>
                    <b style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>{money(restante)}</b>
                  </div>
                  {cobrado > 0 && <div style={styles.closeConfirmText}>Ya se pagó {money(cobrado)} de {money(total)}.</div>}
                  <div style={styles.closeConfirmText}>¿Cuánto paga con este método?</div>
                  <CampoMonto placeholder={`Monto de este pago (saldo ${money(restante)})`} value={montoMixto} onChange={setMontoMixto} onEnter={confirmarConEnter} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ ...styles.propinaPill, ...(esTodo ? styles.pillOn : {}) }} onClick={() => setMontoMixto(esTodo ? "" : String(restante))}>Todo el saldo</button>
                    <button style={{ ...styles.propinaPill, ...(esMitad ? styles.pillOn : {}) }} onClick={() => setMontoMixto(esMitad ? "" : String(Math.round(restante / 2)))}>La mitad</button>
                  </div>
                  <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
                  {renderVueltos(montoEste)}
                  <div style={{ display: "flex", gap: 8 }}>
                    {pagos.length === 0 && <button style={styles.cancelEditBtn} onClick={() => setModoLocal(null)}>Volver</button>}
                    <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel && montoEste > 0 ? 1 : 0.4 }} disabled={!metodoSel || montoEste <= 0} data-confirmar="1" onClick={confirmarMixto}>
                      <Check size={15} /> {montoEste <= 0 ? "Elige o escribe un monto" : `${montoEste >= restante ? "Registrar pago final" : "Registrar pago parcial"} — ${money(montoEste)}`}
                    </button>
                  </div>
                  {montoEste < restante && montoEste > 0 && <div style={styles.closeConfirmText}>Después de este pago quedarán {money(restante - montoEste)} por cobrar, con otro método.</div>}
                </>
              ) : effectiveModo === "igual" ? (
                <>
                  {partesRegistradas === 0 ? (
                    <div style={styles.partesStepperRow}>
                      <span style={styles.closeConfirmText}>Dividir entre:</span>
                      <div style={styles.stepper}>
                        <button style={styles.stepBtn} onClick={() => { setAbonos([]); setNumPartes((n) => Math.max(2, n - 1)); }}><Minus size={14} /></button>
                        <span style={styles.stepVal}>{numPartes}</span>
                        <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus }} onClick={() => { setAbonos([]); setNumPartes((n) => Math.min(12, n + 1)); }}><Plus size={14} /></button>
                      </div>
                      <span style={styles.closeConfirmText}>personas</span>
                    </div>
                  ) : (
                    <div style={styles.closeConfirmText}>Dividido en {numPartes} partes de {money(parteMonto)} cada una.</div>
                  )}
                  {combinar ? renderCombinado(montoParteActual, confirmarParteCombinada, `Registrar parte ${parteActual}`) : (
                    <>
                      <div style={styles.closeConfirmText}>Parte {parteActual} de {numPartes} — {money(montoParteActual)}. Método de pago:</div>
                      <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
                      {renderVueltos(montoParteActual)}
                      <div style={{ display: "flex", gap: 8 }}>
                        {partesRegistradas === 0 && <button style={styles.cancelEditBtn} onClick={() => setModoLocal(null)}>Volver</button>}
                        <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel ? 1 : 0.4 }} disabled={!metodoSel} data-confirmar="1" onClick={confirmarParte}><Check size={15} /> Registrar parte {parteActual}</button>
                      </div>
                      {linkCombinar}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div style={styles.closeConfirmText}>Toca los productos de esta persona:</div>
                  {pendientes.map((it) => (
                    <div key={it.key} style={styles.productoSplitRow}>
                      <div><div style={styles.menuItemName}>{it.name}</div><div style={styles.menuItemPrice}>{money(it.price)} · quedan {it.qtyPend}</div></div>
                      <div style={styles.stepper}>
                        <button style={styles.stepBtn} onClick={() => addToCart(it.key, -1)}><Minus size={14} /></button>
                        <span style={styles.stepVal}>{cart[it.key] || 0}</span>
                        <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus }} onClick={() => addToCart(it.key, 1)}><Plus size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <input style={styles.editInput} placeholder={`Nombre de la persona (opcional, ej. "Persona ${numPersonaSugerido}")`} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
                  <div style={styles.closeConfirmText}>Subtotal de esta persona: <b>{money(cartMonto)}</b></div>
                  {combinar && cartMonto > 0 ? renderCombinado(cartMonto, confirmarProductoCombinado, "Registrar pago") : (
                    <>
                      <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
                      {renderVueltos(cartMonto)}
                      <div style={{ display: "flex", gap: 8 }}>
                        {pagos.length === 0 && <button style={styles.cancelEditBtn} onClick={() => setModoLocal(null)}>Volver</button>}
                        <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel && cartMonto > 0 ? 1 : 0.4 }} disabled={!metodoSel || cartMonto === 0} data-confirmar="1" onClick={confirmarProducto}><Check size={15} /> Registrar pago — {money(cartMonto)}</button>
                      </div>
                      {cartMonto > 0 && linkCombinar}
                      {/* Para cuando alguien decide pagar de una vez todo lo que falta (aunque haya productos tocados arriba) */}
                      <button style={{ ...styles.repeatBtn, margin: 0, opacity: metodoSel ? 1 : 0.5 }} disabled={!metodoSel} onClick={cobrarResto}>
                        Pagar todo lo pendiente — {money(restante)}
                      </button>
                      {!metodoSel && <div style={styles.closeConfirmText}>Elige primero el método de pago.</div>}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {esAdmin && total > 0 && (
            <div style={styles.cancelarCuentaBox}>
              {confirmCancelarCuenta ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={styles.closeConfirmText}>
                    Vas a cancelar {money(total)} de esta mesa <b>sin registrar ningún cobro</b>. Esto queda guardado con tu nombre en el historial. Escribe el motivo (obligatorio):
                  </span>
                  <input
                    autoFocus style={styles.editInput} placeholder="Ej: cliente se fue sin pagar, error al abrir la mesa…"
                    value={motivoCancelacion} onChange={(e) => setMotivoCancelacion(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={styles.cancelEditBtn} onClick={() => { setConfirmCancelarCuenta(false); setMotivoCancelacion(""); }}>Volver</button>
                    <button
                      style={{ ...styles.sendBtn, flex: 1, background: "var(--danger-solid)", opacity: motivoCancelacion.trim() ? 1 : 0.4 }}
                      disabled={!motivoCancelacion.trim()} onClick={cancelarCuenta}
                    >
                      <Ban size={14} /> Confirmar cancelación
                    </button>
                  </div>
                </div>
              ) : (
                <button style={{ ...styles.inlineLink, color: "var(--c-c1442d-t)" }} onClick={() => setConfirmCancelarCuenta(true)}>Cancelar esta cuenta sin cobrar</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

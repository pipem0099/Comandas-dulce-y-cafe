import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Minus, Check, Receipt, Ban, AlertTriangle, Lock, Wallet,
  Users, Gift, Phone, MapPin,
} from "lucide-react";
import { itemNombre, TIPO_META, esExterna, uid, money } from "../logica.js";
import { CampoMonto, MetodoPills } from "../componentes/Comunes.jsx";
import { METODO_META, PROPINA_OPCIONES } from "../constantes.js";
import { styles } from "../estilos.js";
import { conProgreso, cuentaGranTotal, cuentaItemCount, cuentaOrders, cuentaSubtotal, dateTimeLabel, itemsAgregados, mesaNombre, orderTotal, pagosDe, pagosTotal, qtyAsignadaPorProducto, tieneRol, timeLabel } from "../utilidades.js";

export function MesaCuentaCard({ cuenta, orders, saveCuenta, saveOrdersMap, turnoAbierto, usuarioActual, mesas, ajustarInventario, expanded, onToggle }) {
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
  const [numPartes, setNumPartes] = useState(2);
  const [cart, setCart] = useState({});
  const [etiqueta, setEtiqueta] = useState("");
  const [propinaCustom, setPropinaCustom] = useState("");
  const [mostrarDescuento, setMostrarDescuento] = useState(false);
  const [descMonto, setDescMonto] = useState("");
  const [descMotivo, setDescMotivo] = useState("");
  const [confirmCancelarCuenta, setConfirmCancelarCuenta] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  useEffect(() => { if (!expanded) { setModoLocal(null); setMetodoSel(null); setEfectivoRecibido(""); setCart({}); setEtiqueta(""); setMostrarDescuento(false); } }, [expanded]);
  const seleccionarMetodo = (m) => { setMetodoSel(m); setEfectivoRecibido(""); };

  // Calculadora de vueltos: solo aplica cuando el método elegido es efectivo.
  const renderVueltos = (monto) => {
    if (metodoSel !== "efectivo") return null;
    const recibido = parseFloat(efectivoRecibido) || 0;
    const vueltos = recibido - monto;
    return (
      <div style={styles.vueltosBox}>
        <CampoMonto placeholder={`¿Con cuánto paga? (a cobrar ${money(monto)})`} value={efectivoRecibido} onChange={setEfectivoRecibido} />
        {efectivoRecibido !== "" && (
          <div style={{ ...styles.diferenciaBox, background: vueltos >= 0 ? "var(--c-e4eee1-b)" : "var(--c-fbe2dc-b)" }}>
            {vueltos >= 0 ? `Total a devolver: ${money(vueltos)}` : `Faltan ${money(Math.abs(vueltos))}`}
          </div>
        )}
      </div>
    );
  };

  const effectiveModo = cuenta.splitMode || modoLocal;

  async function patchCuenta(patch) {
    await saveCuenta({ ...cuenta, ...patch });
  }

  const cobrandoRef = useRef(false);
  const [cobrando, setCobrando] = useState(false);
  async function guardarPago(pago) {
    if (cobrandoRef.current) return; // ya se está registrando un pago — ignora el segundo toque para no cobrar doble
    cobrandoRef.current = true;
    setCobrando(true);
    try {
      const nuevosPagos = [...pagosDe(cuenta), pago];
      const totalPagado = nuevosPagos.reduce((s, p) => s + p.monto, 0);
      const completo = totalPagado >= total - 1;
      if (completo) {
        // La mesa ya se pagó por completo — si quedó algo sin marcar "listo" o
        // "servido" en Cocina/Mesero, lo cerramos ahora como servido (si ya se
        // pagó es porque ya se consumió). Si no, se queda como un pedido
        // fantasma activo para siempre, aunque ya esté cobrado.
        const sinCerrar = cuentaOrders(orders, cuenta.id).filter((o) => o.estado === "pendiente" || o.estado === "preparando" || o.estado === "listo");
        if (sinCerrar.length > 0) {
          const patch = {};
          sinCerrar.forEach((o) => { patch[o.id] = conProgreso(o, o.items.map((it) => ({ ...it, listos: it.qty, servidos: it.qty }))); });
          await saveOrdersMap(patch);
        }
      }
      await saveCuenta({ ...cuenta, pagos: nuevosPagos, splitMode: effectiveModo || cuenta.splitMode || null, estado: completo ? "pagada" : "abierta", pagadaTs: completo ? Date.now() : cuenta.pagadaTs });
      setMetodoSel(null); setEfectivoRecibido(""); setCart({}); setEtiqueta("");
    } finally {
      cobrandoRef.current = false;
      setCobrando(false);
    }
  }

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
    if (activos.length === 0) return;
    const patch = {};
    const devolver = {};
    activos.forEach((o) => {
      patch[o.id] = { ...o, estado: "cancelado", consumo: {} };
      // Lo que todavía no se preparó vuelve al inventario; lo que ya salió de cocina ya se gastó.
      if (o.estado === "pendiente" || o.estado === "preparando") Object.entries(o.consumo || {}).forEach(([k, v]) => { devolver[k] = (devolver[k] || 0) + v; });
    });
    await saveOrdersMap(patch);
    if (Object.keys(devolver).length > 0) await ajustarInventario(devolver);
  };

  const cancelarCuenta = async () => {
    if (total > 0) {
      if (!esAdmin) return;
      if (!motivoCancelacion.trim()) return; // el motivo es obligatorio cuando hay dinero de por medio
      await cancelarPedidosDeCuenta();
      await patchCuenta({
        estado: "cancelada", canceladaTs: Date.now(), canceladaPor: usuarioActual.nombre,
        motivoCancelacion: motivoCancelacion.trim(), montoCancelado: total,
      });
    } else {
      await cancelarPedidosDeCuenta();
      await patchCuenta({ estado: "cancelada", canceladaTs: Date.now(), canceladaPor: usuarioActual.nombre, montoCancelado: 0 });
    }
    setConfirmCancelarCuenta(false); setMotivoCancelacion("");
  };

  const confirmarUnico = () => { if (!metodoSel) return; guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: total, tipo: "unico", etiqueta: null, items: itemsAgregados(orders, cuenta.id), procesadoPor: usuarioActual.nombre }); };

  const parteMonto = numPartes > 0 ? Math.round(total / numPartes) : 0;
  const partesRegistradas = pagos.filter((p) => p.tipo === "equitativo").length;
  const parteActual = partesRegistradas + 1;
  const esUltimaParte = parteActual >= numPartes;
  const montoParteActual = esUltimaParte ? total - parteMonto * (numPartes - 1) : parteMonto;
  const confirmarParte = () => { if (!metodoSel) return; guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: montoParteActual, tipo: "equitativo", etiqueta: `Parte ${parteActual} de ${numPartes}`, procesadoPor: usuarioActual.nombre }); };

  const agregados = itemsAgregados(orders, cuenta.id);
  const asignada = qtyAsignadaPorProducto(cuenta);
  const pendientes = agregados.map((it) => ({ ...it, qtyPend: it.qty - (asignada[it.key] || 0) })).filter((it) => it.qtyPend > 0);
  const cartMonto = Object.entries(cart).reduce((s, [key, qty]) => { const it = agregados.find((a) => a.key === key); return s + (it ? it.price * qty : 0); }, 0);
  const numPersonaSugerido = pagos.filter((p) => p.tipo === "por_producto").length + 1;

  const addToCart = (key, d) => {
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
    guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: montoReal, tipo: "por_producto", etiqueta: etiqueta.trim() || `Persona ${numPersonaSugerido}`, items: itemsSel, procesadoPor: usuarioActual.nombre });
  };
  const cobrarResto = () => {
    if (!metodoSel || restante <= 0) return;
    const itemsSel = pendientes.map((it) => ({ key: it.key, name: it.name, price: it.price, qty: it.qtyPend }));
    guardarPago({ id: uid(), ts: Date.now(), metodoPago: metodoSel, monto: restante, tipo: "por_producto", etiqueta: etiqueta.trim() || `Persona ${numPersonaSugerido} (resto)`, items: itemsSel, procesadoPor: usuarioActual.nombre });
  };

  return (
    <div className="anim-in" style={styles.mesaCuentaCard}>
      <button style={styles.mesaCuentaHead} onClick={onToggle}>
        <div style={styles.mesaCuentaLeft}>
          <span style={styles.mesaCuentaNum}>{mesaNombre(mesas, cuenta.mesa)}{esExterna(cuenta) && <span style={styles.extTag}>{TIPO_META[cuenta.tipo].corto}</span>}</span>
          <span style={styles.mesaCuentaSince}>Abierta desde {dateTimeLabel(cuenta.ts)}{cuenta.mesero ? ` · ${cuenta.mesero}` : ""}</span>
          {enCurso && <span style={styles.enCursoTag}>Cobro en curso · {money(cobrado)} de {money(total)}</span>}
        </div>
        <div style={styles.mesaCuentaRight}><span style={styles.mesaCuentaItems}>{items} ítems</span><span style={styles.mesaCuentaTotal}>{money(total)}</span></div>
      </button>

      {expanded && (
        <div style={styles.mesaCuentaBody}>
          {esExterna(cuenta) && cuenta.cliente && (cuenta.cliente.telefono || cuenta.cliente.direccion) && (
            <div style={styles.extInfoCaja}>
              {cuenta.cliente.telefono && <span style={styles.extInfoItem}><Phone size={12} /> {cuenta.cliente.telefono}</span>}
              {cuenta.cliente.direccion && <span style={styles.extInfoItem}><MapPin size={12} /> {cuenta.cliente.direccion}{cuenta.cliente.referencia ? ` · ${cuenta.cliente.referencia}` : ""}</span>}
            </div>
          )}
          {ords.slice().sort((a, b) => a.ts - b.ts).map((o) => (
            <div key={o.id} style={styles.mesaCuentaOrderRow}>
              <span style={styles.mesaCuentaOrderTime}>{timeLabel(o.ts)}</span>
              <span style={styles.mesaCuentaOrderItems}>{o.items.map((it) => `${it.qty}× ${itemNombre(it)}${it.nota ? ` (${it.nota})` : ""}`).join(", ")}</span>
              <span style={styles.mesaCuentaOrderTotal}>{money(orderTotal(o))}</span>
            </div>
          ))}

          <div style={styles.subtotalRow}>
            <span>Subtotal</span><span>{money(subtotal)}</span>
          </div>
          {cuenta.costoEnvio > 0 && (
            <div style={styles.subtotalRow}><span>Domicilio</span><span>+{money(cuenta.costoEnvio)}</span></div>
          )}
          {cuenta.descuento ? (
            <div style={styles.subtotalRow}>
              <span>
                Descuento ({cuenta.descuento.motivo}{cuenta.descuento.aplicadoPor ? ` · ${cuenta.descuento.aplicadoPor}` : ""})
                {esAdmin && <button style={styles.inlineLink} onClick={quitarDescuento}>quitar</button>}
              </span>
              <span style={{ color: "var(--c-c1442d-t)" }}>−{money(cuenta.descuento.monto)}</span>
            </div>
          ) : pagos.length === 0 ? (
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
              <button style={styles.inlineAddLink} onClick={() => setMostrarDescuento(true)}><Gift size={12} /> Aplicar descuento o cortesía</button>
            )
          ) : null}

          {cuenta.propina ? (
            <div style={styles.subtotalRow}>
              <span>
                Propina {cuenta.propina.pct != null ? `(${cuenta.propina.pct}%)` : ""}
                {pagos.length === 0 && <button style={styles.inlineLink} onClick={quitarPropina}>cambiar</button>}
              </span>
              <span>{money(cuenta.propina.monto)}</span>
            </div>
          ) : pagos.length === 0 && !mostrarDescuento ? (
            <div style={styles.propinaBox}>
              <span style={styles.closeConfirmText}>Propina:</span>
              <div style={styles.propinaPillsRow}>
                {PROPINA_OPCIONES.map((p) => (
                  <button key={p} style={styles.propinaPill} onClick={() => setPropina(p)}>{p}%</button>
                ))}
                <CampoMonto style={styles.propinaCustomInput} placeholder="$" value={propinaCustom} onChange={setPropinaCustom} />
                <button style={styles.propinaCustomBtn} onClick={() => setPropina("custom")} disabled={!propinaCustom}>Ok</button>
              </div>
            </div>
          ) : null}

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
                <button style={styles.inlineAddLink} onClick={() => setConfirmCancelarCuenta(true)}><Ban size={12} /> Cerrar mesa (sin consumo)</button>
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
                    <Icon size={13} color={meta.color} />
                    <div style={styles.pagoRowMid}>
                      <span style={styles.pagoRowEtiqueta}>{p.etiqueta || "Cuenta completa"}</span>
                      {p.tipo === "por_producto" && <span style={styles.pagoRowItems}>{p.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</span>}
                      <span style={styles.pagoRowTime}>{timeLabel(p.ts)} · {meta.label}{p.procesadoPor ? ` · cobró ${p.procesadoPor}` : ""}</span>
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
                  <div style={styles.closeConfirmText}>¿Cómo quieren pagar?</div>
                  <div style={styles.modoChoiceRow}>
                    <button style={styles.modoChoiceBtn} onClick={() => setModoLocal("unico")}><Wallet size={16} /> Pago único</button>
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
                    <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel ? 1 : 0.4 }} disabled={!metodoSel} onClick={confirmarUnico}><Lock size={15} /> Confirmar cobro</button>
                  </div>
                </>
              ) : effectiveModo === "igual" ? (
                <>
                  {partesRegistradas === 0 ? (
                    <div style={styles.partesStepperRow}>
                      <span style={styles.closeConfirmText}>Dividir entre:</span>
                      <div style={styles.stepper}>
                        <button style={styles.stepBtn} onClick={() => setNumPartes((n) => Math.max(2, n - 1))}><Minus size={14} /></button>
                        <span style={styles.stepVal}>{numPartes}</span>
                        <button style={{ ...styles.stepBtn, ...styles.stepBtnPlus }} onClick={() => setNumPartes((n) => Math.min(12, n + 1))}><Plus size={14} /></button>
                      </div>
                      <span style={styles.closeConfirmText}>personas</span>
                    </div>
                  ) : (
                    <div style={styles.closeConfirmText}>Dividido en {numPartes} partes de {money(parteMonto)} cada una.</div>
                  )}
                  <div style={styles.closeConfirmText}>Parte {parteActual} de {numPartes} — {money(montoParteActual)}. Método de pago:</div>
                  <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
                  {renderVueltos(montoParteActual)}
                  <div style={{ display: "flex", gap: 8 }}>
                    {partesRegistradas === 0 && <button style={styles.cancelEditBtn} onClick={() => setModoLocal(null)}>Volver</button>}
                    <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel ? 1 : 0.4 }} disabled={!metodoSel} onClick={confirmarParte}><Check size={15} /> Registrar parte {parteActual}</button>
                  </div>
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
                  <MetodoPills selected={metodoSel} onSelect={seleccionarMetodo} />
                  {renderVueltos(cartMonto)}
                  <div style={{ display: "flex", gap: 8 }}>
                    {pagos.length === 0 && <button style={styles.cancelEditBtn} onClick={() => setModoLocal(null)}>Volver</button>}
                    <button style={{ ...styles.sendBtn, flex: 1, opacity: metodoSel && cartMonto > 0 ? 1 : 0.4 }} disabled={!metodoSel || cartMonto === 0} onClick={confirmarProducto}><Check size={15} /> Registrar pago — {money(cartMonto)}</button>
                  </div>
                  {Object.keys(cart).length === 0 && (
                    <button style={{ ...styles.repeatBtn, margin: 0, opacity: metodoSel ? 1 : 0.5 }} disabled={!metodoSel} onClick={cobrarResto}>Cobrar todo lo que queda — {money(restante)}</button>
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
                      style={{ ...styles.sendBtn, flex: 1, background: "#C1442D", opacity: motivoCancelacion.trim() ? 1 : 0.4 }}
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

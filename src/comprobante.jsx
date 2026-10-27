import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, MessageCircle, Copy, Check, X } from "lucide-react";
import { money, esExterna, etiquetaExterna } from "./logica.js";
import { METODO_META } from "./constantes.js";
import { cuentaSubtotal, itemsAgregados, mesaNombre } from "./utilidades.js";
import { imprimir } from "./impresion.jsx";
import { Hoja } from "./componentes/Hoja.jsx";

/*
 * Comprobante de venta y cuenta para el cliente.
 *
 *  · "Cuenta de consumo": lo que el cliente pide ANTES de pagar (aún no es comprobante).
 *  · "Comprobante de venta": después de cobrar.
 *
 * IMPORTANTE: es un comprobante INTERNO. No es una factura electrónica de venta de la DIAN, y así lo dice el
 * documento. No debe llamarse "factura" mientras el negocio no emita facturas electrónicas con un proveedor autorizado.
 * Se puede imprimir en impresora de recibos (papel de 80 mm) o enviar por WhatsApp.
 */
let ctx = { config: {}, mesas: [] };
export function contextoComprobante(parcial) { ctx = { ...ctx, ...parcial }; }

const fechaLarga = (ts) => new Date(ts).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });

export function datosComprobante({ cuenta, orders, tipo = "comprobante" }) {
  const config = ctx.config || {};
  const neg = config.datosNegocio || {};
  const subtotal = cuentaSubtotal(orders, cuenta.id);
  const descuento = Number(cuenta.descuento && cuenta.descuento.monto) || 0;
  const propina = Number(cuenta.propina && cuenta.propina.monto) || 0;
  const envio = Number(cuenta.costoEnvio) || 0;
  const total = Math.max(0, subtotal - descuento + propina + envio);
  const cuando = tipo === "comprobante" ? (cuenta.pagadaTs || Date.now()) : Date.now();
  const d8 = new Date(cuando); const pad = (n) => String(n).padStart(2, "0");
  const numero = `C-${d8.getFullYear()}${pad(d8.getMonth() + 1)}${pad(d8.getDate())}-${String(cuenta.id || "").slice(-4).toUpperCase()}`;
  const porMetodo = {};
  (cuenta.pagos || []).forEach((p) => { porMetodo[p.metodoPago] = (porMetodo[p.metodoPago] || 0) + p.monto; });
  const lugar = esExterna(cuenta) ? (etiquetaExterna(cuenta) || "Pedido") : mesaNombre(ctx.mesas, cuenta.mesa);
  return {
    tipo, numero, cuando, lugar,
    negocio: config.businessName || "", nit: neg.nit || "", direccion: neg.direccion || "", telefono: neg.telefono || "",
    mensaje: neg.mensaje || "¡Gracias por tu visita!",
    logo: (config.marca && config.marca.logo) || "",
    mesero: cuenta.mesero || "",
    cliente: (cuenta.cliente && cuenta.cliente.nombre) || "",
    lineas: itemsAgregados(orders, cuenta.id).map((l) => ({ qty: l.qty, name: l.name, total: l.qty * l.price })),
    subtotal, descuento, propina, envio, total,
    propinaSugerida: tipo === "cuenta" && !propina ? Math.round((subtotal * 0.1) / 100) * 100 : 0,
    pagos: Object.entries(porMetodo).map(([m, monto]) => ({ metodo: (METODO_META[m] && METODO_META[m].label) || m, monto })),
    titulo: tipo === "cuenta" ? "CUENTA DE CONSUMO" : "COMPROBANTE DE VENTA",
    leyenda: tipo === "cuenta" ? "Aún no es comprobante de pago" : "No es factura electrónica de venta",
  };
}

/** Texto para WhatsApp (negritas con asteriscos). */
export function textoComprobante(d) {
  const L = [];
  if (d.negocio) L.push(`*${d.negocio}*`);
  if (d.nit) L.push(`NIT ${d.nit}`);
  if (d.direccion) L.push(d.direccion);
  if (d.telefono) L.push(`Tel. ${d.telefono}`);
  L.push("────────────", `*${d.titulo}*`, d.tipo === "comprobante" ? `N.° ${d.numero}` : "", fechaLarga(d.cuando), `${d.lugar}${d.mesero ? ` · Atendió: ${d.mesero}` : ""}`, d.cliente ? `Cliente: ${d.cliente}` : "", "");
  d.lineas.forEach((l) => L.push(`${l.qty}× ${l.name} — ${money(l.total)}`));
  L.push("", `Subtotal: ${money(d.subtotal)}`);
  if (d.descuento) L.push(`Descuento: -${money(d.descuento)}`);
  if (d.envio) L.push(`Domicilio: ${money(d.envio)}`);
  if (d.propina) L.push(`Propina: ${money(d.propina)}`);
  L.push(`*TOTAL: ${money(d.total)}*`);
  if (d.propinaSugerida) L.push(`Propina sugerida (10%, voluntaria): ${money(d.propinaSugerida)}`);
  if (d.pagos.length) { L.push(""); d.pagos.forEach((p) => L.push(`Pagó con ${p.metodo.toLowerCase()}: ${money(p.monto)}`)); }
  L.push("", d.mensaje, `_${d.leyenda}_`);
  return L.filter((x, i, a) => x !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
}

/** La hoja angosta (impresora de recibos de 80 mm). */
export function HojaComprobante({ d }) {
  return (
    <div className="imp-recibo">
      {d.logo && <div className="imp-rec-logo"><img src={d.logo} alt="" /></div>}
      {d.negocio && <div className="imp-rec-centro imp-rec-neg">{d.negocio}</div>}
      {d.nit && <div className="imp-rec-centro">NIT {d.nit}</div>}
      {d.direccion && <div className="imp-rec-centro">{d.direccion}</div>}
      {d.telefono && <div className="imp-rec-centro">Tel. {d.telefono}</div>}
      <div className="imp-rec-sep" />
      <div className="imp-rec-centro imp-rec-tit">{d.titulo}</div>
      {d.tipo === "comprobante" && <div className="imp-rec-centro">N.° {d.numero}</div>}
      <div className="imp-rec-centro">{fechaLarga(d.cuando)}</div>
      <div className="imp-rec-centro">{d.lugar}{d.mesero ? ` · Atendió: ${d.mesero}` : ""}</div>
      {d.cliente && <div className="imp-rec-centro">Cliente: {d.cliente}</div>}
      <div className="imp-rec-sep" />
      {d.lineas.map((l, i) => (
        <div key={i} className="imp-rec-fila"><span>{l.qty}× {l.name}</span><span>{money(l.total)}</span></div>
      ))}
      <div className="imp-rec-sep" />
      <div className="imp-rec-fila"><span>Subtotal</span><span>{money(d.subtotal)}</span></div>
      {d.descuento > 0 && <div className="imp-rec-fila"><span>Descuento</span><span>-{money(d.descuento)}</span></div>}
      {d.envio > 0 && <div className="imp-rec-fila"><span>Domicilio</span><span>{money(d.envio)}</span></div>}
      {d.propina > 0 && <div className="imp-rec-fila"><span>Propina</span><span>{money(d.propina)}</span></div>}
      <div className="imp-rec-fila imp-rec-total"><span>TOTAL</span><span>{money(d.total)}</span></div>
      {d.propinaSugerida > 0 && <div className="imp-rec-centro imp-rec-chico">Propina sugerida 10% (voluntaria): {money(d.propinaSugerida)}</div>}
      {d.pagos.length > 0 && (
        <>
          <div className="imp-rec-sep" />
          {d.pagos.map((p, i) => <div key={i} className="imp-rec-fila"><span>Pagó con {p.metodo.toLowerCase()}</span><span>{money(p.monto)}</span></div>)}
        </>
      )}
      <div className="imp-rec-sep" />
      <div className="imp-rec-centro">{d.mensaje}</div>
      <div className="imp-rec-centro imp-rec-chico">{d.leyenda}</div>
    </div>
  );
}

export const imprimirRecibo = (d) => imprimir(<HojaComprobante d={d} />, { papel: "recibo" });

/* ───── Ventana para ver / imprimir / enviar ───── */
const escuchas = new Set();
export function mostrarComprobante(args) { escuchas.forEach((f) => f({ ...args, id: Date.now() })); }

const soloDigitos = (v) => String(v || "").replace(/\D/g, "");
const telefonoWhatsApp = (v) => { const t = soloDigitos(v); if (!t) return ""; if (t.length === 10 && t.startsWith("3")) return `57${t}`; return t; };

function VentanaComprobante({ trabajo, cerrar }) {
  const d = datosComprobante(trabajo);
  const [tel, setTel] = useState((trabajo.cuenta.cliente && trabajo.cuenta.cliente.telefono) || "");
  const [copiado, setCopiado] = useState(false);
  const texto = textoComprobante(d);
  const whatsapp = () => { const n = telefonoWhatsApp(tel); window.open(`https://wa.me/${n}?text=${encodeURIComponent(texto)}`, "_blank", "noopener"); };
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch (e) { window.prompt("Copia el texto:", texto); } };
  return (
    <Hoja onCerrar={cerrar} ancho={420} gap={10} label={d.titulo} z={80}>
      {({ cerrar: salir }) => (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" }}>{d.tipo === "cuenta" ? "Cuenta para el cliente" : "Comprobante de venta"}</div>
            <button onClick={salir} aria-label="Cerrar" style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-5c5648-t)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={16} /></button>
          </div>
          <div className="recibo-vista"><HojaComprobante d={d} /></div>
          <input style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", minHeight: 44, borderRadius: 12, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-242019-t)", fontSize: 14 }} inputMode="tel" placeholder="Celular del cliente (opcional, para WhatsApp)" value={tel} onChange={(e) => setTel(e.target.value)} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={estiloBoton(true)} onClick={() => imprimirRecibo(d)}><Printer size={16} /> Imprimir</button>
            <button style={estiloBoton(false)} onClick={whatsapp}><MessageCircle size={16} /> WhatsApp</button>
            <button style={estiloBoton(false)} onClick={copiar}>{copiado ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}</button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--c-8a8272-t)", lineHeight: 1.45 }}>Es un comprobante interno del negocio. No reemplaza la factura electrónica de venta.</div>
        </>
      )}
    </Hoja>
  );
}
const estiloBoton = (principal) => ({ flex: "1 1 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, padding: "10px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, background: principal ? "var(--seg-on-bg)" : "var(--c-ede7d8-b)", color: principal ? "var(--seg-on-fg)" : "var(--c-242019-t)" });

export function AnfitrionComprobante() {
  const [trabajo, setTrabajo] = useState(null);
  useEffect(() => { const f = (t) => setTrabajo(t); escuchas.add(f); return () => escuchas.delete(f); }, []);
  if (!trabajo) return null;
  return createPortal(<VentanaComprobante key={trabajo.id} trabajo={trabajo} cerrar={() => setTrabajo(null)} />, document.body);
}

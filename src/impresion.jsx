import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dateTimeLabel } from "./utilidades.js";

/*
 * Sistema de impresión: en vez de mandar a papel lo que se ve en pantalla, cada reporte arma su propia
 * HOJA (A4, blanco y negro, con encabezado, tablas y firmas) y se imprime aparte de la app.
 *
 *   imprimir(<HojaDia ... />)   → dibuja la hoja fuera de la app y abre el diálogo de impresión / "Guardar como PDF".
 *
 * Las piezas (Hoja, Seccion, Tabla, Kpis, Firmas…) usan clases "imp-*" definidas en index.css.
 */

/* ───────── motor ───────── */
const escuchas = new Set();
export function imprimir(nodo, opciones = {}) {
  escuchas.forEach((f) => f({ nodo, opciones, id: Date.now() }));
}

export function AnfitrionImpresion() {
  const [trabajo, setTrabajo] = useState(null);
  useEffect(() => {
    const f = (t) => setTrabajo(t);
    escuchas.add(f);
    return () => escuchas.delete(f);
  }, []);
  useEffect(() => {
    if (!trabajo) return undefined;
    document.body.classList.add("imprimiendo");
    const limpiar = () => { document.body.classList.remove("imprimiendo"); setTrabajo(null); };
    const alTerminar = () => limpiar();
    window.addEventListener("afterprint", alTerminar, { once: true });
    // un instante para que se dibujen logo y tablas antes de abrir el diálogo
    const t1 = setTimeout(() => { try { window.print(); } catch (e) { limpiar(); } }, 350);
    // por si el navegador no avisa que terminó: al primer toque en la app se limpia
    const t2 = setTimeout(() => window.addEventListener("pointerdown", alTerminar, { once: true, capture: true }), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("afterprint", alTerminar); window.removeEventListener("pointerdown", alTerminar, true); document.body.classList.remove("imprimiendo"); };
  }, [trabajo]);
  const destino = typeof document !== "undefined" ? document.getElementById("hoja-impresion") : null;
  const recibo = trabajo && trabajo.opciones && trabajo.opciones.papel === "recibo";
  return trabajo && destino ? createPortal(
    <>
      {/* el papel de recibo es angosto (80 mm) y largo; los reportes van en A4 */}
      {recibo && <style>{"@media print { @page { size: 80mm auto; margin: 3mm; } }"}</style>}
      <div className="imp-hoja">{trabajo.nodo}</div>
    </>, destino) : null;
}

/* ───────── piezas ───────── */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Hoja completa: encabezado con marca, título, período, quién la generó y cuándo. */
export function Hoja({ config, usuario, titulo, subtitulo, children }) {
  const marca = (config && config.marca) || {};
  const negocio = (config && config.businessName) || "";
  return (
    <div>
      <div className="imp-cab">
        <div className="imp-cab-marca">
          {marca.logo && <span className="imp-logo"><img src={marca.logo} alt="" /></span>}
          <div>
            {negocio && <div className="imp-negocio">{negocio}</div>}
            <div className="imp-titulo">{titulo}</div>
            {subtitulo && <div className="imp-subtitulo">{subtitulo}</div>}
          </div>
        </div>
        <div className="imp-cab-meta">
          <div>Generado el {dateTimeLabel(Date.now())}</div>
          {usuario && usuario.nombre && <div>por {usuario.nombre}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Seccion({ titulo, nota, salto, children }) {
  return (
    <section className={"imp-seccion" + (salto ? " imp-salto" : "")}>
      <h2 className="imp-h2">{titulo}</h2>
      {nota && <div className="imp-nota">{nota}</div>}
      {children}
    </section>
  );
}

/** Cuadros de cifras clave. items: [{ t: "Total", v: "$91.000", s: "texto pequeño" }] */
export function Kpis({ items }) {
  return (
    <div className="imp-kpis">
      {items.map((k, i) => (
        <div key={i} className="imp-kpi">
          <div className="imp-kpi-t">{k.t}</div>
          <div className="imp-kpi-v">{k.v}</div>
          {k.s && <div className="imp-kpi-s">{k.s}</div>}
        </div>
      ))}
    </div>
  );
}

/**
 * Tabla. cols: [{ t: "Producto", v: (fila) => ..., d: true (alinear a la derecha), w: "30%" }]
 * pie: fila de totales con los mismos índices (array) — opcional.
 */
export function Tabla({ cols, filas, pie, vacio = "Sin datos en este período." }) {
  if (!filas || filas.length === 0) return <div className="imp-vacio">{vacio}</div>;
  return (
    <table className="imp-tabla">
      <thead>
        <tr>{cols.map((c, i) => <th key={i} className={c.d ? "imp-d" : ""} style={c.w ? { width: c.w } : undefined}>{c.t}</th>)}</tr>
      </thead>
      <tbody>
        {filas.map((f, ri) => (
          <React.Fragment key={ri}>
            <tr>{cols.map((c, i) => <td key={i} className={c.d ? "imp-d" : ""}>{c.v(f, ri)}</td>)}</tr>
            {f && f.__sub && <tr className="imp-sub"><td colSpan={cols.length}>{f.__sub}</td></tr>}
          </React.Fragment>
        ))}
      </tbody>
      {pie && (
        <tfoot>
          <tr>{pie.map((v, i) => <td key={i} className={cols[i] && cols[i].d ? "imp-d" : ""}>{v}</td>)}</tr>
        </tfoot>
      )}
    </table>
  );
}

/** Dos o tres líneas de firma al final del documento. */
export function Firmas({ etiquetas = ["Elaboró", "Revisó"], nombres = [] }) {
  return (
    <div className="imp-firmas">
      {etiquetas.map((e, i) => (
        <div key={i} className="imp-firma">
          <div className="imp-firma-linea">{nombres[i] || ""}</div>
          <div className="imp-firma-et">{e}</div>
        </div>
      ))}
    </div>
  );
}

/** Barra horizontal simple (para ventas por hora) — se ve igual en blanco y negro. */
export function BarraImp({ valor, max }) {
  const pct = max > 0 ? Math.max(2, Math.round((num(valor) / max) * 100)) : 0;
  return <span className="imp-barra"><span style={{ width: `${valor > 0 ? pct : 0}%` }} /></span>;
}

export const pctDe = (parte, total) => (total > 0 ? `${Math.round((parte / total) * 1000) / 10}%` : "—");

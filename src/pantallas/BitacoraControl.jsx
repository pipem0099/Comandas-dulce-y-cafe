import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { Hoja } from "../componentes/Hoja.jsx";
import { RegistroMensual } from "../componentes/RegistroMensual.jsx";
import { leerBitacora, borrarBitacora, registrarAuditoria } from "../firebase.js";
import { money } from "../logica.js";
import { tieneRol } from "../utilidades.js";

/* Bitácora de control (cancelaciones, descuentos, anulaciones…): firmada con el usuario real, agrupada por mes.
   Solo un administrador puede borrar registros (uno, varios o un mes) y cada borrado deja su propia constancia fija. */
const ACCION = {
  cancelar_cuenta: "Canceló una cuenta", cancelar_pedido: "Canceló un pedido", descuento: "Aplicó un descuento", quitar_descuento: "Quitó un descuento",
  deshacer_cancelacion: "Deshizo una cancelación", anular_pago: "Deshizo un pago", dejar_pendiente: "Dejó una cuenta pendiente", cobrar_pendiente: "Cobró una cuenta pendiente",
  condonar_deuda: "Perdonó una deuda", emitir_factura: "Emitió una factura", anular_factura: "Anuló una factura", guardar_credenciales_fiscales: "Guardó credenciales fiscales",
  guardar_mapeo_fiscal: "Guardó el mapeo fiscal", prueba_emision_fiscal: "Hizo una prueba de emisión", borrar_registros: "Borró registros",
};
export const textoBitacora = (b) => {
  const partes = [ACCION[b.accion] || String(b.accion || "").replace(/_/g, " ")];
  if (b.mesa) partes.push(`mesa ${b.mesa}`);
  if (b.monto) partes.push(money(b.monto));
  if (b.motivo) partes.push(b.motivo);
  return partes.join(" · ");
};

export function BitacoraControl({ usuarioActual }) {
  const [abierta, setAbierta] = useState(false);
  const [lista, setLista] = useState(null);
  const [fallo, setFallo] = useState(false);
  const esAdmin = !!usuarioActual && tieneRol(usuarioActual, "admin");

  const cargar = useCallback(async () => { const r = await leerBitacora(); setFallo(!r.ok); setLista(r.lista); }, []);
  useEffect(() => { if (abierta) cargar(); }, [abierta, cargar]);

  const borrar = async (ids, descripcion) => {
    const ok = await borrarBitacora(ids);
    if (!ok) return false;
    await registrarAuditoria({ accion: "borrar_registros", uid: usuarioActual.uid, nombre: usuarioActual.nombre, rol: "admin", motivo: `Borró ${descripcion}` });
    await cargar();
    return true;
  };
  const registros = (lista || []).map((b) => ({ id: b.id, ts: b.ts, quien: b.nombre || b.uid, texto: textoBitacora(b), protegido: b.accion === "borrar_registros" }));

  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className="fila-tap"
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48, padding: "0 4px", border: "none", background: "transparent", cursor: "pointer", color: "inherit", font: "inherit", textAlign: "left" }}>
        <ShieldCheck size={18} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>Bitácora de control<span style={{ display: "block", fontWeight: 400, fontSize: 12.5, opacity: 0.7 }}>Quién canceló, descontó o anuló, mes por mes</span></span>
        <ChevronRight size={17} />
      </button>
      {abierta && (
        <Hoja onCerrar={() => setAbierta(false)} ancho={600} gap={12} label="Bitácora de control" z={300} centro>
          {() => (
            <>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" }}>Bitácora de control</div>
                <div style={{ fontSize: 13, color: "var(--c-5c5648-t)", marginTop: 3 }}>Cada cancelación, descuento o anulación queda firmada con el usuario real. {esAdmin ? "Como administrador puedes borrar registros; cada borrado queda anotado y no se puede borrar." : "Solo un administrador puede borrar registros."}</div>
              </div>
              {lista === null ? <div style={{ fontSize: 13 }}>Cargando…</div>
                : fallo ? <div role="alert" style={{ fontSize: 13, color: "var(--c-c1442d-t)" }}>No se pudo leer la bitácora. Revisa tu conexión.</div>
                : <div style={{ maxHeight: "62vh", overflowY: "auto" }}><RegistroMensual registros={registros} puedeBorrar={esAdmin} onBorrar={borrar} /></div>}
            </>
          )}
        </Hoja>
      )}
    </>
  );
}

import React, { useState } from "react";
import { Bell, X, AlertTriangle, Info, ChevronRight } from "lucide-react";
import { Hoja } from "./Hoja.jsx";

const META = {
  alta: { color: "var(--danger-solid)", fondo: "var(--c-fbe2dc-b)", etiqueta: "Atender ya" },
  media: { color: "var(--warn-solid)", fondo: "var(--c-fbefd9-b)", etiqueta: "Revisar hoy" },
  info: { color: "var(--c-8a8272-t)", fondo: "var(--c-f1ecdd-b)", etiqueta: "Para tener en cuenta" },
};

/** Campana con el número de alertas importantes; al tocarla abre la lista. Solo para administradores. */
export function CampanaAlertas({ alertas, onIr, tamano = 36, compacto = false }) {
  const [abierta, setAbierta] = useState(false);
  const importantes = alertas.filter((a) => a.nivel !== "info").length;
  const hayAlta = alertas.some((a) => a.nivel === "alta");
  return (
    <>
      <button
        onClick={() => setAbierta(true)} aria-label={importantes ? `${importantes} alertas` : "Alertas"} title="Alertas"
        style={{ position: "relative", width: tamano, height: tamano, borderRadius: tamano / 2, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", background: compacto ? "transparent" : "var(--c-ede7d8-b)", color: "var(--c-5c5648-t)", flexShrink: 0 }}
      >
        <Bell size={compacto ? 19 : 18} />
        {(importantes > 0 || alertas.length > 0) && (
          <span style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9, background: importantes > 0 ? (hayAlta ? "var(--danger-solid)" : "var(--warn-solid)") : "var(--c-8a8272-t)", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--chrome-solid)" }}>
            {importantes > 0 ? importantes : alertas.length}
          </span>
        )}
      </button>
      {abierta && (
        <Hoja onCerrar={() => setAbierta(false)} ancho={460} gap={10} label="Alertas" z={75} centro>
          {({ cerrar }) => (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--c-8a8272-t)", fontWeight: 700 }}>Para el administrador</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" }}>Alertas</div>
                </div>
                <button onClick={cerrar} aria-label="Cerrar" style={{ width: 36, height: 36, borderRadius: 18, border: "1px solid var(--c-e4dfce-o)", background: "transparent", color: "var(--c-5c5648-t)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={16} /></button>
              </div>
              {alertas.length === 0 ? (
                <div style={{ padding: "22px 6px", textAlign: "center", color: "var(--c-5c5648-t)", fontSize: 14, lineHeight: 1.5 }}>
                  Todo en orden por ahora. Aquí aparecen avisos como una caja abierta demasiadas horas, descuentos o cancelaciones inusuales y productos agotados.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "58dvh", overflowY: "auto" }}>
                  {alertas.map((a) => {
                    const m = META[a.nivel]; const Icono = a.nivel === "info" ? Info : AlertTriangle;
                    return (
                      <button key={a.id} onClick={() => { cerrar(); setTimeout(() => onIr && onIr(a.vista), 220); }} style={{ display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left", padding: "12px 12px", borderRadius: 14, border: "none", background: m.fondo, cursor: "pointer", color: "var(--c-242019-t)" }}>
                        <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 14, background: m.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}><Icono size={15} /></span>
                        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700 }}>{a.titulo}</span>
                          <span style={{ fontSize: 13, color: "var(--c-5c5648-t)", lineHeight: 1.4 }}>{a.detalle}</span>
                          <span style={{ fontSize: 11.5, color: "var(--c-8a8272-t)", marginTop: 2 }}>{m.etiqueta} · {a.donde}</span>
                        </span>
                        <ChevronRight size={16} style={{ flexShrink: 0, marginTop: 6, color: "var(--c-8a8272-t)" }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Hoja>
      )}
    </>
  );
}

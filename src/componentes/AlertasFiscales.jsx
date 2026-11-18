import React from "react";
import { TriangleAlert } from "lucide-react";

/* Alertas amarillas preventivas (resolución por vencer, folios, tope POS). Informan; nunca bloquean la venta. Se usan en la configuración y en Caja. */
export function AlertasFiscales({ alertas = [], testid = "alertas-fiscales" }) {
  if (!alertas.length) return null;
  return (
    <div data-testid={testid} role="status" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alertas.map((a) => (
        <div key={a.clave} data-alerta={a.clave} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45, color: "var(--c-8a611a-t)", background: "var(--c-fbefd9-b)", borderRadius: 10, padding: "8px 10px" }}>
          <TriangleAlert size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{a.texto}</span>
        </div>
      ))}
    </div>
  );
}

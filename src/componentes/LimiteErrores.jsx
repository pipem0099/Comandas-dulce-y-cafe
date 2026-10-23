import React from "react";
import { reportarError } from "../errores.js";

/*
 * Red de seguridad: si una pantalla falla al dibujarse, en vez de dejar la app en blanco
 * muestra un aviso con salidas claras (intentar de nuevo o recargar).
 */
export class LimiteErrores extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Error en la pantalla:", error, info && info.componentStack); reportarError(error, "pantalla"); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--c-f7f4ec-b, #121316)", color: "var(--c-242019-t, #ECEDEF)", fontFamily: "var(--font-body, system-ui)" }}>
        <div style={{ maxWidth: 360, width: "100%", display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display, inherit)", fontSize: 22, fontWeight: 700 }}>Algo salió mal en esta pantalla</div>
          <div style={{ fontSize: 14, color: "var(--c-8a8272-t, #9aa0a6)", lineHeight: 1.5 }}>Tus datos están a salvo. Puedes intentar de nuevo o recargar la app.</div>
          <button style={{ padding: "13px 14px", borderRadius: 12, border: "none", background: "var(--neon, var(--accent, #0e9f6e))", color: "var(--neon-text, #fff)", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }} onClick={() => this.setState({ error: null })}>Intentar de nuevo</button>
          <button style={{ padding: "13px 14px", borderRadius: 12, border: "1px solid var(--c-e4dfce-o, #333)", background: "transparent", color: "inherit", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }} onClick={() => window.location.reload()}>Recargar la app</button>
        </div>
      </div>
    );
  }
}

import React, { useState, useRef } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Segmentado } from "./Comunes.jsx";
import { PLANTILLAS, plantillaDe, rellenar } from "../mensajes.js";

/* Editor de los mensajes de WhatsApp (recordatorio de reserva y resumen del día).
   Se escribe el texto y se toca una variable para meterla donde está el cursor. */
export function EditorMensajes({ config, persistConfig, x }) {
  const [clave, setClave] = useState("reserva");
  const [borradores, setBorradores] = useState({});
  const [guardado, setGuardado] = useState(false);
  const ref = useRef(null);
  const plantilla = PLANTILLAS[clave];
  const texto = borradores[clave] != null ? borradores[clave] : plantillaDe(config, clave);
  const cambiado = texto !== plantillaDe(config, clave);
  const poner = (v) => { setBorradores((b) => ({ ...b, [clave]: v })); setGuardado(false); };

  const insertar = (nombre) => {
    const el = ref.current; const ins = `{${nombre}}`;
    if (!el) { poner(texto + ins); return; }
    const a = el.selectionStart ?? texto.length, b = el.selectionEnd ?? texto.length;
    poner(texto.slice(0, a) + ins + texto.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + ins.length, a + ins.length); });
  };
  const guardar = async () => {
    await persistConfig({ ...config, mensajes: { ...(config.mensajes || {}), [clave]: texto.trim() } });
    setBorradores((b) => { const n = { ...b }; delete n[clave]; return n; });
    setGuardado(true); setTimeout(() => setGuardado(false), 1800);
  };
  const restaurar = async () => {
    const m = { ...(config.mensajes || {}) }; delete m[clave];
    await persistConfig({ ...config, mensajes: m });
    setBorradores((b) => { const n = { ...b }; delete n[clave]; return n; });
  };

  return (
    <>
      <Segmentado ariaLabel="Mensaje a editar">
        {Object.entries(PLANTILLAS).map(([k, p]) => (
          <button key={k} role="tab" aria-selected={clave === k} style={x.btnSmall} onClick={() => { setClave(k); setGuardado(false); }}>{p.titulo}</button>
        ))}
      </Segmentado>
      <textarea ref={ref} style={{ ...x.input, minHeight: 120, resize: "vertical", lineHeight: 1.45 }} value={texto} onChange={(e) => poner(e.target.value)} aria-label={plantilla.titulo} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {plantilla.variables.map(([n, desc]) => (
          <button key={n} type="button" title={desc} style={x.btnSmall} onClick={() => insertar(n)}>{`{${n}}`}</button>
        ))}
      </div>
      <div style={x.hint}>Toca una variable para meterla donde tienes el cursor; se reemplaza por el dato real al enviar.</div>
      <div style={x.label}>Así se verá</div>
      <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.45, padding: "10px 12px", borderRadius: 12, background: "var(--c-e4eee1-b)", color: "var(--c-242019-t)" }}>{rellenar(texto, plantilla.ejemplo)}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...x.btnDark, flex: 1, opacity: cambiado ? 1 : 0.5 }} disabled={!cambiado || !texto.trim()} onClick={guardar}>{guardado ? <><Check size={15} /> Guardado</> : "Guardar mensaje"}</button>
        <button style={{ ...x.btnSmall, minHeight: 44 }} onClick={restaurar} aria-label="Volver al texto original"><RotateCcw size={14} /> Original</button>
      </div>
      <div style={x.hint}>La app no envía nada sola: abre WhatsApp con el texto escrito y tú tocas «Enviar».</div>
    </>
  );
}

import { useState } from "react";
import { X, Lock, RotateCcw, AlertTriangle } from "lucide-react";
import { Hoja } from "../componentes/Hoja.jsx";
import { CampoMonto } from "../componentes/Comunes.jsx";
import { ResumenDia } from "./ResumenDia.jsx";
import { styles } from "../estilos.js";
import { mesaNombre, timeLabel } from "../utilidades.js";

/*
 * Cierre del turno (arqueo) en hoja flotante: la misma presentación que el cobro y la entrega de caja.
 * Paso 1 · Contar: efectivo, tarjeta y transferencia, sin ver lo esperado (cierre "a ciegas").
 * Paso 2 · Resultado: lo esperado contra lo contado; si no cuadra se corrige o se explica el motivo.
 * Todo el estado vive en TurnoView; esta hoja solo lo muestra.
 */
const k = {
  cabecera: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  titulo: { fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)", lineHeight: 1.15 },
  sub: { fontSize: 13, color: "var(--c-5c5648-t)", marginTop: 3, lineHeight: 1.4 },
  cerrar: { width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--btn2-bg)", color: "var(--btn2-fg)", border: "1px solid var(--btn2-line)", borderRadius: 16, cursor: "pointer", flexShrink: 0 },
  pasos: { display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, fontWeight: 700 },
  paso: (on, hecho) => ({ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 6px", borderRadius: 999, border: "1px solid var(--btn2-line)", background: on ? "var(--accent)" : "transparent", color: on ? "var(--accent-fg, #fff)" : hecho ? "var(--c-5b7553-t)" : "var(--c-5c5648-t)", transition: "background .3s, color .3s" }),
  num: (on) => ({ width: 20, height: 20, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, background: on ? "rgba(255,255,255,.22)" : "var(--btn2-bg)" }),
  campos: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  campo: { display: "flex", flexDirection: "column", gap: 5 },
  et: { fontSize: 13, fontWeight: 700, color: "var(--c-242019-t)" },
  pista: { fontSize: 12, color: "var(--c-5c5648-t)", lineHeight: 1.4 },
  pie: { display: "flex", gap: 8, marginTop: 2 },
};

export function HojaCierreTurno({
  turno, nombreCaja, mesasAbiertas, mesas, calculado, arqueos,
  contado, setContado, contadoTarjeta, setContadoTarjeta, contadoTransf, setContadoTransf,
  observaciones, setObservaciones, todoCuadra, calcular, corregir, armarCierre, cuentas, config, alConfirmar, onCerrar, ancha, esAdmin,
}) {
  const [entiendo, setEntiendo] = useState(false);   // el cajero debe reconocer que hay mesas sin cobrar antes de contar
  const bloqueado = !esAdmin && mesasAbiertas.length > 0 && !entiendo;
  const puedeConfirmar = todoCuadra || !!observaciones.trim();
  return (
    <Hoja onCerrar={onCerrar} centro={ancha} ancho={ancha ? 680 : 520} gap={14} label="Cerrar turno">
      {({ cerrar }) => (
        <>
          <div style={k.cabecera}>
            <div>
              <div style={k.titulo}>Cerrar turno</div>
              <div style={k.sub}>{nombreCaja ? `${nombreCaja} · ` : ""}abierta desde las {timeLabel(turno.aperturaTs)}</div>
            </div>
            <button className="toque44" style={k.cerrar} onClick={cerrar} aria-label="Cerrar"><X size={16} /></button>
          </div>

          <div style={k.pasos} aria-label={calculado ? "Paso 2 de 2" : "Paso 1 de 2"}>
            <span style={k.paso(!calculado, calculado)}><span style={k.num(!calculado)}>1</span>Contar</span>
            <span style={k.paso(calculado, false)}><span style={k.num(calculado)}>2</span>Resultado</span>
          </div>

          {mesasAbiertas.length > 0 && (
            <div style={{ ...styles.warnBanner, marginBottom: 0, alignItems: "flex-start" }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {mesasAbiertas.length === 1 ? "Una mesa sigue" : `${mesasAbiertas.length} mesas siguen`} sin cobrar ({mesasAbiertas.map((c) => mesaNombre(mesas, c.mesa)).join(", ")}).
                Si cierras ahora, esas cuentas siguen abiertas y su dinero no entra en este cierre.
                {!esAdmin && !calculado && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontWeight: 700, cursor: "pointer" }}>
                    <input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
                    Entiendo que quedan sin cobrar
                  </label>
                )}
              </span>
            </div>
          )}

          <div style={k.sub}>
            {calculado ? "Resultado del arqueo. Si algo no cuadra, corrige el conteo y vuelve a calcular." : esAdmin ? "Registra lo que contaste para compararlo con lo esperado." : "Registra lo que contaste. El sistema no te muestra lo esperado hasta que calcules."}
            {arqueos.length > 0 && <span> · {arqueos.length} {arqueos.length === 1 ? "cálculo" : "cálculos"} en este cierre (todos quedan registrados)</span>}
          </div>

          <div style={k.campos}>
            <div style={k.campo}>
              <label style={k.et}>Efectivo en caja</label>
              <CampoMonto placeholder="Efectivo contado" value={contado} onChange={(v) => !calculado && setContado(v)} />
              <span style={k.pista}>Lo que hay físicamente en el cajón.</span>
            </div>
            <div style={k.campo}>
              <label style={k.et}>Tarjeta</label>
              <CampoMonto placeholder="Total tarjeta" value={contadoTarjeta} onChange={(v) => !calculado && setContadoTarjeta(v)} />
              <span style={k.pista}>Total del cierre de lote del datáfono.</span>
            </div>
            <div style={k.campo}>
              <label style={k.et}>Transferencia</label>
              <CampoMonto placeholder="Total transferencias" value={contadoTransf} onChange={(v) => !calculado && setContadoTransf(v)} />
              <span style={k.pista}>Total recibido según tu banco.</span>
            </div>
          </div>

          {!calculado ? (
            <div style={k.pie}>
              <button style={styles.cancelEditBtn} onClick={cerrar}>Cancelar</button>
              <button style={{ ...styles.sendBtn, flex: 1, opacity: bloqueado ? 0.4 : 1 }} disabled={bloqueado} onClick={calcular}>Calcular resultado</button>
            </div>
          ) : (
            <>
              <ResumenDia turno={armarCierre(Date.now())} cuentas={cuentas} config={config} />
              {!todoCuadra ? (
                <>
                  <button style={styles.addItemBtn} onClick={corregir}><RotateCcw size={15} /> Corregir conteo y volver a calcular</button>
                  <div style={k.sub}>¿No hay nada que corregir? Para cerrar con la diferencia, <b>cuéntanos por qué (obligatorio):</b></div>
                  <input style={styles.editInput} placeholder="Ej: se dio mal un vuelto, faltó registrar un pago…" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                </>
              ) : (
                <input style={styles.editInput} placeholder="Observaciones (opcional)" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              )}
              <button data-atajo="confirmar" style={{ ...styles.sendBtn, opacity: puedeConfirmar ? 1 : 0.4 }} disabled={!puedeConfirmar} onClick={() => { alConfirmar(); cerrar(); }}>
                <Lock size={15} /> Confirmar cierre
              </button>
            </>
          )}
        </>
      )}
    </Hoja>
  );
}

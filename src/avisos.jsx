import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Info, AlertTriangle, X } from "lucide-react";

/*
 * Avisos breves de confirmación ("Cuenta cobrada · $91.000") con "Deshacer" por unos segundos.
 * Se pueden lanzar desde cualquier parte, incluso si la pantalla que hizo la acción ya se cerró:
 *
 *   avisar({ texto: "Cuenta cobrada", detalle: "$91.000", deshacer: async () => { ... } })
 */
const escuchas = new Set();
let seq = 0;
export function avisar({ texto, detalle, tipo = "ok", deshacer, duracion }) {
  const aviso = { id: ++seq, texto, detalle, tipo, deshacer, duracion: duracion || (deshacer ? 8000 : 4000) };
  escuchas.forEach((f) => f(aviso));
  return aviso.id;
}

function Aviso({ a, cerrar }) {
  const [haciendo, setHaciendo] = useState(false);
  const [pausa, setPausa] = useState(false);
  const restante = useRef(a.duracion);
  const inicio = useRef(Date.now());
  useEffect(() => {
    if (pausa || haciendo) return undefined;
    inicio.current = Date.now();
    const t = setTimeout(cerrar, restante.current);
    return () => { clearTimeout(t); restante.current = Math.max(800, restante.current - (Date.now() - inicio.current)); };
  }, [pausa, haciendo, cerrar]);
  const Icono = a.tipo === "error" ? AlertTriangle : a.tipo === "info" ? Info : Check;
  const deshacer = async () => {
    if (haciendo) return;
    setHaciendo(true);
    try { await a.deshacer(); avisar({ texto: "Listo, se deshizo", tipo: "info" }); } catch (e) { avisar({ texto: "No se pudo deshacer", detalle: "Inténtalo de nuevo o corrígelo a mano.", tipo: "error" }); }
    cerrar();
  };
  return (
    <div className="aviso-toast" role="status" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      <span className={"aviso-icono aviso-" + a.tipo}><Icono size={15} /></span>
      <span className="aviso-texto">
        <b>{a.texto}</b>
        {a.detalle && <span className="aviso-detalle"> · {a.detalle}</span>}
      </span>
      {a.deshacer && <button className="aviso-btn" onClick={deshacer} disabled={haciendo}>{haciendo ? "Deshaciendo…" : "Deshacer"}</button>}
      <button className="aviso-x" onClick={cerrar} aria-label="Cerrar aviso"><X size={14} /></button>
      {a.deshacer && !haciendo && <span className="aviso-barra" style={{ animationDuration: `${a.duracion}ms`, animationPlayState: pausa ? "paused" : "running" }} />}
    </div>
  );
}

export function AnfitrionAvisos() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    const f = (a) => setLista((l) => [...l.slice(-2), a]);
    escuchas.add(f);
    return () => escuchas.delete(f);
  }, []);
  if (lista.length === 0) return null;
  return createPortal(
    <div className="aviso-pila no-imprimir" aria-live="polite">
      {lista.map((a) => <Aviso key={a.id} a={a} cerrar={() => setLista((l) => l.filter((x) => x.id !== a.id))} />)}
    </div>,
    document.body
  );
}

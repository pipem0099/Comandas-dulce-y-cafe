import React, { useState } from "react";
import { Minus, Plus, Check, Camera } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { uid } from "../logica.js";
import { PLANTILLAS, plantillaPorId, menuDePlantilla, mesasIniciales } from "../plantillas.js";

/*
 * Asistente de primer ingreso (también sirve como "modo demo"): en 4 pasos el dueño deja el negocio listo:
 * nombre, menú de ejemplo según su tipo de negocio, mesas y a quién le da acceso. Todo se puede cambiar después.
 */
const e = {
  titulo: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-242019-t)" },
  sub: { fontSize: 13.5, color: "var(--c-5c5648-t)", lineHeight: 1.5 },
  campo: { width: "100%", boxSizing: "border-box", padding: "12px 14px", minHeight: 46, borderRadius: 12, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-242019-t)", fontSize: 15, fontFamily: "inherit" },
  primario: { flex: 2, minHeight: 46, borderRadius: 12, border: "none", background: "var(--seg-on-bg)", color: "var(--seg-on-fg)", fontSize: 14.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 },
  secundario: { flex: 1, minHeight: 46, borderRadius: 12, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};

export function AsistenteInicio({ config, menu, menuDeFabrica, persistConfig, persistMenu, persistMesas, onIrEquipo, onCerrar }) {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState(config.businessName && config.businessName !== "Dulce & Café" ? config.businessName : "");
  const [tipo, setTipo] = useState(null);
  const [numMesas, setNumMesas] = useState(6);
  const [barra, setBarra] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const plantilla = plantillaPorId(tipo);

  const aplicar = async () => {
    if (aplicando) return;
    setAplicando(true);
    // si el menú todavía es el de ejemplo de fábrica, la plantilla lo REEMPLAZA; si ya tiene el menú del negocio, solo se agregan los productos que falten
    const base = menuDeFabrica ? [] : menu;
    const nuevos = plantilla ? menuDePlantilla(plantilla, base, uid) : [];
    if (plantilla) await persistMenu([...base, ...nuevos]);
    await persistMesas(mesasIniciales(numMesas, barra));
    await persistConfig({ ...config, businessName: nombre.trim() || config.businessName, asistenteTerminado: true });
    setResumen({ productos: nuevos.length, mesas: numMesas + (barra ? 1 : 0) });
    setAplicando(false); setPaso(4);
  };
  const noVolver = async () => { await persistConfig({ ...config, asistenteTerminado: true }); onCerrar(); };

  return (
    <Hoja onCerrar={onCerrar} ancho={500} gap={12} label="Asistente de configuración" z={85} centro>
      {({ cerrar }) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 360 }}>
          <div style={{ display: "flex", gap: 5 }} aria-hidden>
            {[0, 1, 2, 3].map((i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= Math.min(paso, 3) ? "var(--accent)" : "var(--c-ede7d8-b)" }} />)}
          </div>

          {paso === 0 && (
            <>
              <div style={e.titulo}>¡Bienvenido! Dejemos todo listo</div>
              <div style={e.sub}>En 4 pasos cortos configuras tu negocio. Todo se puede cambiar después. Empecemos por el nombre.</div>
              <input style={e.campo} autoFocus placeholder="Nombre de tu negocio" value={nombre} onChange={(ev) => setNombre(ev.target.value)} />
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={e.secundario} onClick={cerrar}>Ahora no</button>
                <button style={{ ...e.primario, opacity: nombre.trim() ? 1 : 0.5 }} disabled={!nombre.trim()} onClick={() => setPaso(1)}>Siguiente</button>
              </div>
            </>
          )}

          {paso === 1 && (
            <>
              <div style={e.titulo}>¿Qué tipo de negocio es?</div>
              <div style={e.sub}>Cargo un menú de ejemplo con precios típicos para que no empieces de cero. Luego lo ajustas.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "42dvh", overflowY: "auto" }}>
                {PLANTILLAS.map((p) => (
                  <button key={p.id} onClick={() => setTipo(p.id)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "10px 12px", minHeight: 56, borderRadius: 12, border: tipo === p.id ? "2px solid var(--accent)" : "2px solid transparent", background: "var(--c-f1ecdd-b)", cursor: "pointer", color: "var(--c-242019-t)", fontFamily: "inherit" }}>
                    <span style={{ fontSize: 24 }}>{p.icono}</span>
                    <span style={{ flex: 1 }}><b style={{ display: "block", fontSize: 14.5 }}>{p.nombre}</b><span style={{ fontSize: 12, color: "var(--c-5c5648-t)" }}>{p.descripcion}</span></span>
                    {tipo === p.id && <Check size={18} color="var(--accent)" />}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--c-8a8272-t)", display: "flex", gap: 6, alignItems: "center" }}><Camera size={14} /> ¿Ya tienes tu carta? Después, en Menú y precios, puedes crearla desde una foto.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={e.secundario} onClick={() => setPaso(0)}>Atrás</button>
                <button style={{ ...e.primario, opacity: tipo ? 1 : 0.5 }} disabled={!tipo} onClick={() => setPaso(2)}>Siguiente</button>
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <div style={e.titulo}>¿Cuántas mesas tienes?</div>
              <div style={e.sub}>Las crearé como Mesa 1, Mesa 2… Después las nombras y acomodas en el plano.</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "10px 0" }}>
                <button style={{ ...e.secundario, flex: "0 0 52px", fontSize: 20 }} onClick={() => setNumMesas((n) => Math.max(0, n - 1))} aria-label="Menos mesas"><Minus size={18} /></button>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700, minWidth: 70, textAlign: "center", color: "var(--c-242019-t)" }}>{numMesas}</div>
                <button style={{ ...e.secundario, flex: "0 0 52px" }} onClick={() => setNumMesas((n) => Math.min(60, n + 1))} aria-label="Más mesas"><Plus size={18} /></button>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--c-242019-t)" }}>
                <input type="checkbox" checked={barra} onChange={(ev) => setBarra(ev.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--accent)" }} /> También tengo una barra
              </label>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={e.secundario} onClick={() => setPaso(1)}>Atrás</button>
                <button style={e.primario} onClick={() => setPaso(3)}>Siguiente</button>
              </div>
            </>
          )}

          {paso === 3 && (
            <>
              <div style={e.titulo}>Todo listo para aplicar</div>
              <div style={{ background: "var(--c-f1ecdd-b)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 6, fontSize: 14, color: "var(--c-242019-t)" }}>
                <div><b>Negocio:</b> {nombre.trim()}</div>
                <div><b>Menú:</b> {plantilla ? `${plantilla.nombre} (${plantilla.categorias.reduce((n, c) => n + c.productos.length, 0)} productos de ejemplo)` : "—"}</div>
                <div><b>Mesas:</b> {numMesas}{barra ? " + barra" : ""}</div>
              </div>
              <div style={e.sub}>Esto reemplaza las mesas actuales y agrega los productos que falten al menú. Nada se borra de ventas ni de inventario.</div>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={e.secundario} onClick={() => setPaso(2)}>Atrás</button>
                <button style={{ ...e.primario, opacity: aplicando ? 0.6 : 1 }} disabled={aplicando} onClick={aplicar}>{aplicando ? "Aplicando…" : "Aplicar y terminar"}</button>
              </div>
            </>
          )}

          {paso === 4 && resumen && (
            <>
              <div style={e.titulo}>¡Listo, {nombre.trim()}! 🎉</div>
              <div style={e.sub}>Quedaron {resumen.productos} productos y {resumen.mesas} mesa{resumen.mesas === 1 ? "" : "s"}. Lo que sigue:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button style={{ ...e.secundario, flex: "none", textAlign: "left", padding: "12px 14px" }} onClick={() => { cerrar(); setTimeout(() => onIrEquipo(), 250); }}><b style={{ display: "block" }}>1. Crea las cuentas de tu equipo</b><span style={{ fontSize: 12, color: "var(--c-5c5648-t)" }}>Meseros, cocina y caja, cada quien con su rol.</span></button>
                <div style={{ ...e.sub, padding: "0 4px" }}><b>2.</b> Revisa los precios en <b>Menú y precios</b>.<br /><b>3.</b> Prueba tomando un pedido en la pestaña Mesero.</div>
              </div>
              <div style={{ flex: 1 }} />
              <button style={{ ...e.primario, flex: "none" }} onClick={cerrar}>Empezar a usar la app</button>
            </>
          )}

          {paso < 4 && <button onClick={noVolver} style={{ alignSelf: "center", background: "transparent", border: "none", color: "var(--c-8a8272-t)", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 4 }}>No volver a mostrar este asistente</button>}
        </div>
      )}
    </Hoja>
  );
}

import React, { useRef, useState } from "react";
import { Camera, FileText, Loader2, AlertTriangle, Check, X } from "lucide-react";
import { Hoja } from "./Hoja.jsx";
import { CampoMonto } from "./Comunes.jsx";
import { avisar } from "../avisos.jsx";
import { uid, money } from "../logica.js";
import { reducirImagen, pedirMenuDeFoto } from "../menuFoto.js";
import { parsearMenuTexto, filasParaRevisar, aplicarFilas, unirCategorias } from "../menuFotoLogica.js";

/*
 * "Crear el menú desde una foto": se fotografía la carta (o se pega su texto), la app propone los productos
 * por categorías y el dueño REVISA antes de agregar. Nada se guarda hasta que toca "Agregar".
 */
const c = {
  titulo: { fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--c-242019-t)" },
  sub: { fontSize: 13, color: "var(--c-5c5648-t)", lineHeight: 1.45 },
  grande: { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 14px", minHeight: 64, borderRadius: 14, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", minHeight: 42, borderRadius: 10, border: "1px solid var(--c-e4dfce-o)", background: "var(--c-fffdf8-b)", color: "var(--c-242019-t)", fontSize: 14, fontFamily: "inherit" },
};

function FilaRevision({ f, onCambio }) {
  return (
    <div style={{ background: "var(--c-f1ecdd-b)", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 8, opacity: f.incluir ? 1 : 0.55 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={f.incluir} onChange={(e) => onCambio({ incluir: e.target.checked })} style={{ width: 20, height: 20, accentColor: "var(--accent)", flexShrink: 0 }} aria-label="Agregar este producto" />
        <input style={{ ...c.input, fontWeight: 600 }} value={f.nombre} onChange={(e) => onCambio({ nombre: e.target.value })} aria-label="Nombre del producto" />
      </label>
      <div style={{ display: "flex", gap: 8, paddingLeft: 30 }}>
        <div style={{ flex: "0 0 38%" }}><CampoMonto style={{ ...c.input, borderColor: f.dudoso ? "var(--warn-solid)" : undefined }} placeholder="Precio" value={f.precio} onChange={(v) => onCambio({ precio: v, dudoso: false })} /></div>
        <input style={{ ...c.input, flex: 1, minWidth: 0 }} list="menu-foto-categorias" value={f.cat} onChange={(e) => onCambio({ cat: e.target.value })} placeholder="Categoría" aria-label="Categoría" />
      </div>
      {(f.dudoso || f.existe) && (
        <div style={{ paddingLeft: 30, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {f.dudoso && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--c-8a611a-t)", background: "var(--c-fbefd9-b)", borderRadius: 8, padding: "2px 8px" }}>⚠ Revisa el precio</span>}
          {f.existe && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--c-5c5648-t)", background: "var(--c-ede7d8-b)", borderRadius: 8, padding: "2px 8px" }}>Ya existe a {money(f.precioActual)}{f.incluir ? " · se actualizará el precio" : " · no se agrega"}</span>}
        </div>
      )}
    </div>
  );
}

export function MenuDesdeFoto({ menu, persistMenu, onCerrar }) {
  const [paso, setPaso] = useState("inicio"); // inicio | leyendo | texto | revisar
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [sinIA, setSinIA] = useState(false);
  const [progreso, setProgreso] = useState({ n: 0, de: 0 });
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const cancelado = useRef(false);
  const selector = useRef(null);
  const categorias = [...new Set([...menu.map((m) => m.cat), ...filas.map((f) => f.cat)].filter(Boolean))];

  const leerFotos = async (archivos) => {
    const lista = Array.from(archivos || []).slice(0, 6);
    if (selector.current) selector.current.value = "";
    if (!lista.length) return;
    setError(""); setSinIA(false); setPaso("leyendo"); cancelado.current = false;
    const acumulado = [];
    try {
      for (let i = 0; i < lista.length; i++) {
        if (cancelado.current) return;
        setProgreso({ n: i + 1, de: lista.length });
        const r = await pedirMenuDeFoto(await reducirImagen(lista[i]));
        acumulado.push(...r.categorias);
      }
      if (cancelado.current) return;
      setFilas(filasParaRevisar(unirCategorias(acumulado), menu)); setPaso("revisar");
    } catch (e) {
      if (cancelado.current) return;
      setError(e.mensaje || "No se pudo leer la carta."); setSinIA(e.codigo === "no_configurado"); setPaso("inicio");
    }
  };
  const interpretarTexto = () => {
    const r = parsearMenuTexto(texto);
    if (r.total === 0) { setError("No encontré productos. Escribe cada producto en una línea con su precio al final, por ejemplo: Tinto 3000."); return; }
    setError(""); setFilas(filasParaRevisar(r, menu)); setPaso("revisar");
  };
  const cambiar = (clave, parcial) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...parcial } : f)));
  const marcadas = filas.filter((f) => f.incluir).length;
  const sinPrecio = filas.filter((f) => f.incluir && !f.existe && !(Number(String(f.precio).replace(/\D/g, "")) > 0)).length;

  const agregar = async () => {
    if (guardando || marcadas === 0) return;
    setGuardando(true);
    const antes = menu;
    const { menu: nuevo, agregados, actualizados } = aplicarFilas(filas, menu, uid);
    await persistMenu(nuevo);
    avisar({
      texto: agregados ? `Se agregaron ${agregados} producto${agregados === 1 ? "" : "s"} al menú` : "Menú actualizado",
      detalle: actualizados ? `${actualizados} precio${actualizados === 1 ? "" : "s"} actualizado${actualizados === 1 ? "" : "s"}` : undefined,
      deshacer: async () => { await persistMenu(antes); },
    });
    onCerrar();
  };

  return (
    <Hoja onCerrar={onCerrar} ancho={560} gap={10} label="Crear el menú desde una foto" z={72}>
      {({ cerrar }) => (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={c.titulo}>{paso === "revisar" ? "Revisa antes de agregar" : "Crear el menú desde una foto"}</div>
            <button onClick={() => { cancelado.current = true; cerrar(); }} aria-label="Cerrar" style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-5c5648-t)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><X size={16} /></button>
          </div>

          {error && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--c-fbe2dc-b)", color: "var(--c-8a3a2b-t)", borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.4 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
            </div>
          )}

          {paso === "inicio" && (
            <>
              <div style={c.sub}>Toma una foto de tu carta (o elige una de la galería) y la app arma los productos por categorías. <b>Tú los revisas antes de agregarlos.</b></div>
              <input ref={selector} type="file" accept="image/*" multiple hidden onChange={(e) => leerFotos(e.target.files)} />
              <button style={{ ...c.grande, background: "var(--seg-on-bg)", color: "var(--seg-on-fg)", opacity: sinIA ? 0.5 : 1 }} onClick={() => selector.current && selector.current.click()}>
                <Camera size={22} /><span><b style={{ display: "block", fontSize: 15 }}>Tomar o elegir foto</b><span style={{ fontSize: 12, opacity: 0.8 }}>Puedes subir varias páginas a la vez (hasta 6)</span></span>
              </button>
              <button style={{ ...c.grande, background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)" }} onClick={() => { setError(""); setPaso("texto"); }}>
                <FileText size={22} /><span><b style={{ display: "block", fontSize: 15 }}>Pegar o escribir el texto</b><span style={{ fontSize: 12, color: "var(--c-5c5648-t)" }}>Sirve sin IA: un producto por línea con su precio</span></span>
              </button>
              <div style={{ fontSize: 12, color: "var(--c-8a8272-t)", lineHeight: 1.5 }}>Para que lea bien: foto de frente, con buena luz, sin reflejos, una página por foto.</div>
            </>
          )}

          {paso === "leyendo" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "26px 8px" }}>
              <Loader2 size={32} style={{ animation: "giro 1s linear infinite", color: "var(--accent)" }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-242019-t)" }}>Leyendo la carta{progreso.de > 1 ? ` · foto ${progreso.n} de ${progreso.de}` : ""}…</div>
              <div style={{ ...c.sub, textAlign: "center" }}>Puede tardar unos segundos.</div>
              <button style={{ padding: "9px 16px", minHeight: 40, borderRadius: 12, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)", fontWeight: 600, cursor: "pointer" }} onClick={() => { cancelado.current = true; setPaso("inicio"); }}>Cancelar</button>
            </div>
          )}

          {paso === "texto" && (
            <>
              <div style={c.sub}>Un producto por línea, con el precio al final. Las líneas sin precio se toman como categorías.</div>
              <textarea style={{ ...c.input, minHeight: 180, resize: "vertical", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }} placeholder={"BEBIDAS CALIENTES\nTinto 3.000\nCafé con leche 4.500\n\nPOSTRES\nBrownie 6.500"} value={texto} onChange={(e) => setTexto(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ flex: 1, minHeight: 44, borderRadius: 12, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)", fontWeight: 600, cursor: "pointer" }} onClick={() => { setError(""); setPaso("inicio"); }}>Atrás</button>
                <button style={{ flex: 2, minHeight: 44, borderRadius: 12, border: "none", background: "var(--seg-on-bg)", color: "var(--seg-on-fg)", fontWeight: 700, cursor: "pointer", opacity: texto.trim() ? 1 : 0.5 }} disabled={!texto.trim()} onClick={interpretarTexto}>Interpretar</button>
              </div>
            </>
          )}

          {paso === "revisar" && (
            <>
              <datalist id="menu-foto-categorias">{categorias.map((k) => <option key={k} value={k} />)}</datalist>
              <div style={c.sub}>Encontré <b>{filas.length}</b> producto{filas.length === 1 ? "" : "s"}. Corrige lo que haga falta y desmarca lo que no quieras. Los precios con ⚠ conviene mirarlos.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ padding: "7px 12px", minHeight: 34, borderRadius: 10, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }} onClick={() => setFilas((fs) => fs.map((f) => ({ ...f, incluir: !f.existe })))}>Solo lo nuevo</button>
                <button style={{ padding: "7px 12px", minHeight: 34, borderRadius: 10, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }} onClick={() => setFilas((fs) => fs.map((f) => ({ ...f, incluir: false })))}>Ninguno</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "44dvh", overflowY: "auto" }}>
                {filas.map((f) => <FilaRevision key={f.clave} f={f} onCambio={(p) => cambiar(f.clave, p)} />)}
              </div>
              {sinPrecio > 0 && <div style={{ fontSize: 12.5, color: "var(--c-8a611a-t)" }}>⚠ {sinPrecio} producto{sinPrecio === 1 ? "" : "s"} sin precio: se agregarán en $0 y podrás ponerles el precio después.</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ flex: 1, minHeight: 46, borderRadius: 12, border: "none", background: "var(--c-ede7d8-b)", color: "var(--c-242019-t)", fontWeight: 600, cursor: "pointer" }} onClick={() => setPaso("inicio")}>Otra foto</button>
                <button style={{ flex: 2, minHeight: 46, borderRadius: 12, border: "none", background: "var(--seg-on-bg)", color: "var(--seg-on-fg)", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: marcadas === 0 || guardando ? 0.5 : 1 }} disabled={marcadas === 0 || guardando} onClick={agregar}>
                  <Check size={16} /> Agregar {marcadas} al menú
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Hoja>
  );
}

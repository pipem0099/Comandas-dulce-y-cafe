import React from "react";
import ReactDOM from "react-dom/client";
import { aplicarMarca } from "./theme.js";
import { leerMarcaCache } from "./marcaCache.js";
import "./index.css";
import App from "./App.jsx";
import { LimiteErrores } from "./componentes/LimiteErrores.jsx";
import { AnfitrionImpresion } from "./impresion.jsx";
import { AnfitrionAvisos } from "./avisos.jsx";
import { instalarCapturaDeErrores } from "./errores.js";

// Marca (color y tipografía) de este negocio, desde el primer instante
const marcaGuardada = leerMarcaCache();
if (marcaGuardada && marcaGuardada.marca) aplicarMarca(marcaGuardada.marca);

// "Instalar la app": Chrome avisa cuando se puede; el menú de usuario ofrece el botón.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__instalarApp = e;
  window.dispatchEvent(new Event("instalar-disponible"));
});

instalarCapturaDeErrores();
ReactDOM.createRoot(document.getElementById("root")).render(<LimiteErrores><App /><AnfitrionImpresion /><AnfitrionAvisos /></LimiteErrores>);
// La pantalla de carga ya cubre todo con el mismo color; recién entonces se suelta el color de arranque.
requestAnimationFrame(() => requestAnimationFrame(() => { const a = document.getElementById("arranque"); if (a) a.remove(); }));

// Registra el service worker para que la app se pueda "instalar" en el
// celular (ícono propio, se abre en su ventana). No cachea datos.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.error("Error registrando el service worker:", e));
  });
}

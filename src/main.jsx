import React from "react";
import ReactDOM from "react-dom/client";
import "./theme.js";
import "./index.css";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

// Registra el service worker para que la app se pueda "instalar" en el
// celular (ícono propio, se abre en su ventana). No cachea datos.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.error("Error registrando el service worker:", e));
  });
}

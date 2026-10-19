import { useEffect, useState } from "react";

/** Ancho de la ventana en vivo (se actualiza al girar el celular o cambiar el tamaño). */
export function useAncho() {
  const [ancho, setAncho] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 400));
  useEffect(() => {
    const f = () => setAncho(window.innerWidth);
    window.addEventListener("resize", f);
    window.addEventListener("orientationchange", f);
    return () => { window.removeEventListener("resize", f); window.removeEventListener("orientationchange", f); };
  }, []);
  return ancho;
}

/** "movil" (< 700px), "tablet" (700–1099px) o "escritorio" (≥ 1100px). */
export function useDispositivo() {
  const a = useAncho();
  return a < 700 ? "movil" : a < 1100 ? "tablet" : "escritorio";
}

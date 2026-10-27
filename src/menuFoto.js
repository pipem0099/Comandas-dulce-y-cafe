import { obtenerIdToken } from "./firebase.js";

/*
 * Parte del celular de "Crear el menú desde una foto": reduce la foto antes de subirla (para que sea rápida y no
 * gaste datos) y la manda a la función del servidor, que usa la IA. La clave de la IA nunca está en el celular.
 */
const blobABase64 = (blob) => new Promise((resolver, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => resolver(String(lector.result).split(",")[1] || "");
  lector.onerror = () => rechazar(new Error("No se pudo leer la foto"));
  lector.readAsDataURL(blob);
});
const cargarImagen = (archivo) => new Promise((resolver, rechazar) => {
  const url = URL.createObjectURL(archivo); const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
  img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error("No se pudo abrir la foto")); };
  img.src = url;
});

/** Reduce a ~1568 px (lo que la IA aprovecha) y a JPEG. Devuelve { tipo, datos } con la imagen en base64. */
export async function reducirImagen(archivo, { ladoMax = 1568, calidad = 0.85, maxBase64 = 4_000_000 } = {}) {
  let origen;
  try { origen = await createImageBitmap(archivo, { imageOrientation: "from-image" }); } catch (e) { origen = await cargarImagen(archivo); }
  const ancho0 = origen.width || origen.naturalWidth, alto0 = origen.height || origen.naturalHeight;
  const escala = Math.min(1, ladoMax / Math.max(ancho0, alto0));
  let w = Math.max(1, Math.round(ancho0 * escala)), h = Math.max(1, Math.round(alto0 * escala));
  for (let intento = 0; intento < 4; intento++) {
    const lienzo = document.createElement("canvas"); lienzo.width = w; lienzo.height = h;
    const ctx = lienzo.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(origen, 0, 0, w, h);
    const blob = await new Promise((res) => lienzo.toBlob(res, "image/jpeg", Math.max(0.5, calidad - intento * 0.1)));
    if (!blob) throw new Error("No se pudo preparar la foto");
    const datos = await blobABase64(blob);
    if (datos.length <= maxBase64) return { tipo: "image/jpeg", datos };
    w = Math.round(w * 0.8); h = Math.round(h * 0.8);
  }
  throw new Error("La foto es demasiado pesada");
}

const RUTA = "/.netlify/functions/menu-desde-foto";
const falla = (mensaje, codigo) => Object.assign(new Error(mensaje), { mensaje, codigo });

/** Manda UNA foto a la función y devuelve { categorias, total }. Los errores traen un mensaje listo para mostrar. */
export async function pedirMenuDeFoto(imagen) {
  const token = await obtenerIdToken();
  if (!token) throw falla("Tu sesión venció. Cierra sesión y vuelve a entrar.", "sesion");
  let r;
  try {
    r = await fetch(RUTA, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(imagen) });
  } catch (e) { throw falla("Sin conexión a internet. Inténtalo de nuevo cuando tengas señal.", "red"); }
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch (e) { /* respuesta que no es JSON */ }
  if (r.ok && cuerpo && Array.isArray(cuerpo.categorias)) return cuerpo;
  if (r.status === 404 || (!cuerpo && r.status >= 500)) throw falla("La lectura por foto todavía no está activada en esta instalación. Puedes pegar el texto de la carta.", "no_configurado");
  throw falla((cuerpo && cuerpo.mensaje) || "No se pudo leer la carta. Inténtalo otra vez.", (cuerpo && cuerpo.error) || "ia");
}

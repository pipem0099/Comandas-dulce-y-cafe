import React, { useState } from "react";
import {
  KeyRound, ArrowRightLeft,
} from "lucide-react";

import { saveRecord, iniciarSesion, enviarCorreoCambioClave } from "../firebase.js";
import { styles } from "../estilos.js";

export const MENSAJES_AUTH = {
  "auth/invalid-credential": "Correo o clave incorrectos.",
  "auth/wrong-password": "Correo o clave incorrectos.",
  "auth/user-not-found": "Correo o clave incorrectos.",
  "auth/invalid-email": "Ese correo no parece válido.",
  "auth/too-many-requests": "Demasiados intentos — espera unos minutos.",
  "auth/network-request-failed": "Sin conexión — revisa tu internet.",
  "auth/operation-not-allowed": "Falta activar el acceso con correo y contraseña en Firebase.",
  "auth/email-already-in-use": "Ese correo ya tiene una cuenta con otra clave.",
  "auth/weak-password": "La clave es muy corta (mínimo 6 caracteres).",
};
export const msgAuth = (code) => MENSAJES_AUTH[code] || "No se pudo completar. Inténtalo de nuevo.";

export function InicioSesion() {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const entrar = async () => {
    if (!correo.trim() || !clave || enviando) return;
    setEnviando(true); setError(""); setInfo("");
    const r = await iniciarSesion(correo, clave);
    setEnviando(false);
    if (r.ok) return; // onAuthStateChanged hace el resto
    setClave("");
    setError(msgAuth(r.code));
  };
  const olvide = async () => {
    if (!correo.trim()) { setError("Escribe tu correo arriba y vuelve a tocar aquí."); return; }
    setError(""); setInfo("");
    const r = await enviarCorreoCambioClave(correo);
    if (r.ok) setInfo("Listo: si ese correo tiene cuenta, te llegará un mensaje para crear una clave nueva.");
    else setError(msgAuth(r.code));
  };
  return (
    <div style={{ ...styles.app, alignItems: "center", justifyContent: "center" }}>
      <div style={styles.loginWrap}>
        <div style={styles.pageEyebrow}>INGRESAR</div>
        <div style={styles.pageTitle}>Entra con tu cuenta</div>
        <input
          style={styles.editInput} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" placeholder="Correo"
          value={correo} onChange={(e) => { setCorreo(e.target.value); setError(""); }}
        />
        <input
          style={{ ...styles.editInput, marginTop: 8 }} type="password" autoComplete="current-password" placeholder="Clave"
          value={clave} onChange={(e) => { setClave(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
        />
        {error && <div style={styles.pinError}>{error}</div>}
        {info && <div style={styles.closeConfirmText}>{info}</div>}
        <button style={{ ...styles.addItemBtn, marginTop: 10, opacity: !correo.trim() || !clave || enviando ? 0.5 : 1 }} disabled={!correo.trim() || !clave || enviando} onClick={entrar}>
          <KeyRound size={15} /> {enviando ? "Verificando…" : "Entrar"}
        </button>
        <button style={{ ...styles.inlineAddLink, marginTop: 14 }} onClick={olvide}>Olvidé mi clave</button>
      </div>
    </div>
  );
}

// Cuenta que inició sesión pero no puede usar la app: sin perfil (todavía no la dieron de alta)
// o desactivada. El dueño, la primera vez, crea aquí su perfil de administrador.
export function SinAcceso({ sesion, perfil, onSalir }) {
  const [primeraVez, setPrimeraVez] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const desactivada = !!perfil && perfil.activo === false;
  const configurar = async () => {
    if (!nombre.trim()) { setError("Escribe tu nombre."); return; }
    setGuardando(true); setError("");
    const ok = await saveRecord("perfiles", sesion.uid, { uid: sesion.uid, nombre: nombre.trim(), correo: sesion.email || "", roles: { admin: true }, activo: true, creado: Date.now() });
    setGuardando(false);
    if (!ok) setError("No se pudo. Esta opción solo funciona para el dueño, en el primer ingreso.");
  };
  return (
    <div style={{ ...styles.app, alignItems: "center", justifyContent: "center" }}>
      <div style={styles.loginWrap}>
        <div style={styles.pageEyebrow}>{desactivada ? "ACCESO DESACTIVADO" : "SIN ACCESO TODAVÍA"}</div>
        <div style={styles.pageTitle}>{desactivada ? "Tu cuenta está desactivada" : "Tu cuenta aún no está dada de alta"}</div>
        <div style={styles.cajaEmptyText}>
          {desactivada
            ? "Un administrador desactivó tu acceso. Si crees que es un error, habla con él."
            : `Ingresaste como ${sesion.email || "tu cuenta"}, pero todavía no tienes un rol. Pídele al administrador que te dé de alta.`}
        </div>
        {!desactivada && !primeraVez && (
          <button style={{ ...styles.inlineAddLink, marginTop: 10 }} onClick={() => setPrimeraVez(true)}>Soy el dueño y es la primera vez</button>
        )}
        {!desactivada && primeraVez && (
          <>
            <div style={{ ...styles.closeConfirmText, marginTop: 10 }}>Esta cuenta quedará como Administrador: podrá crear las cuentas de todo el equipo.</div>
            <input style={styles.editInput} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {error && <div style={styles.pinError}>{error}</div>}
            <button style={{ ...styles.addItemBtn, marginTop: 8, opacity: guardando ? 0.5 : 1 }} disabled={guardando} onClick={configurar}><KeyRound size={15} /> Crear mi perfil de administrador</button>
          </>
        )}
        <button style={{ ...styles.inlineAddLink, marginTop: 16 }} onClick={onSalir}>Cerrar sesión</button>
      </div>
    </div>
  );
}

export function AccesoDenegado({ mensaje, accion, onAccion, onCambiarUsuario }) {
  return (
    <div style={styles.screen}>
      <div style={styles.loginWrap}>
        <div style={styles.pageEyebrow}>SIN ACCESO</div>
        <div style={styles.cajaEmptyText}>{mensaje}</div>
        <button style={styles.addItemBtn} onClick={onAccion}><ArrowRightLeft size={15} /> {accion}</button>
        <button style={styles.inlineAddLink} onClick={onCambiarUsuario}>Cerrar sesión</button>
      </div>
    </div>
  );
}

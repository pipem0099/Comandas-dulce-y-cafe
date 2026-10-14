import React, { useState, useEffect } from "react";
import {
  KeyRound, ArrowRightLeft,
} from "lucide-react";

import { saveRecord, iniciarSesion, enviarCorreoCambioClave, crearCuentaPropietaria } from "../firebase.js";
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
  const [modo, setModo] = useState("entrar"); // 'entrar' | 'crear' (primer ingreso: crear la cuenta del propietario)
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const cambiarModo = (m) => { setModo(m); setError(""); setInfo(""); setClave(""); setClave2(""); };
  const entrar = async () => {
    if (!correo.trim() || !clave || enviando) return;
    setEnviando(true); setError(""); setInfo("");
    const r = await iniciarSesion(correo, clave);
    setEnviando(false);
    if (r.ok) return; // onAuthStateChanged hace el resto
    setClave("");
    setError(msgAuth(r.code));
  };
  const crear = async () => {
    if (enviando) return;
    if (!nombre.trim()) { setError("Escribe tu nombre."); return; }
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) { setError("Escribe un correo válido."); return; }
    if (clave.length < 6) { setError("La clave debe tener mínimo 6 caracteres."); return; }
    if (clave !== clave2) { setError("Las dos claves no son iguales."); return; }
    setEnviando(true); setError("");
    // Se recuerda el nombre para crear el perfil de propietario apenas la cuenta quede creada.
    try { sessionStorage.setItem("primera_vez_nombre", nombre.trim()); } catch (e) {}
    const r = await crearCuentaPropietaria(correo, clave);
    setEnviando(false);
    if (r.ok) return; // onAuthStateChanged hace el resto
    try { sessionStorage.removeItem("primera_vez_nombre"); } catch (e) {}
    setError(msgAuth(r.code));
  };
  const olvide = async () => {
    if (!correo.trim()) { setError("Escribe tu correo arriba y vuelve a tocar aquí."); return; }
    setError(""); setInfo("");
    const r = await enviarCorreoCambioClave(correo);
    if (r.ok) setInfo("Listo: si ese correo tiene cuenta, te llegará un mensaje para crear una clave nueva.");
    else setError(msgAuth(r.code));
  };
  const esCrear = modo === "crear";
  const listo = esCrear ? nombre.trim() && correo.trim() && clave && clave2 : correo.trim() && clave;
  return (
    <div style={{ ...styles.app, alignItems: "center", justifyContent: "center" }}>
      <div style={styles.loginWrap}>
        <div style={styles.pageEyebrow}>{esCrear ? "PRIMER INGRESO" : "INGRESAR"}</div>
        <div style={styles.pageTitle}>{esCrear ? "Crea la cuenta del propietario" : "Entra con tu cuenta"}</div>
        {esCrear && (
          <div style={styles.cajaEmptyText}>Solo se hace una vez, al configurar el negocio. Esta cuenta quedará como <b>propietaria</b>: desde ahí creas las cuentas de tu equipo.</div>
        )}
        {esCrear && (
          <input style={styles.editInput} autoComplete="name" placeholder="Tu nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); setError(""); }} />
        )}
        <input
          style={{ ...styles.editInput, marginTop: esCrear ? 8 : 0 }} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" placeholder="Correo"
          value={correo} onChange={(e) => { setCorreo(e.target.value); setError(""); }}
        />
        <input
          style={{ ...styles.editInput, marginTop: 8 }} type="password" autoComplete={esCrear ? "new-password" : "current-password"} placeholder={esCrear ? "Clave (mínimo 6 caracteres)" : "Clave"}
          value={clave} onChange={(e) => { setClave(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && !esCrear && entrar()}
        />
        {esCrear && (
          <input
            style={{ ...styles.editInput, marginTop: 8 }} type="password" autoComplete="new-password" placeholder="Repite la clave"
            value={clave2} onChange={(e) => { setClave2(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && crear()}
          />
        )}
        {error && <div style={styles.pinError}>{error}</div>}
        {info && <div style={styles.closeConfirmText}>{info}</div>}
        <button style={{ ...styles.addItemBtn, marginTop: 10, opacity: !listo || enviando ? 0.5 : 1 }} disabled={!listo || enviando} onClick={esCrear ? crear : entrar}>
          <KeyRound size={15} /> {enviando ? "Un momento…" : esCrear ? "Crear cuenta" : "Entrar"}
        </button>
        {!esCrear && <button style={{ ...styles.inlineAddLink, marginTop: 14 }} onClick={olvide}>Olvidé mi clave</button>}
        <button style={{ ...styles.inlineAddLink, marginTop: 10 }} onClick={() => cambiarModo(esCrear ? "entrar" : "crear")}>
          {esCrear ? "Ya tengo cuenta — entrar" : "Es la primera vez que se instala este negocio"}
        </button>
      </div>
    </div>
  );
}

// Cuenta que inició sesión pero no puede usar la app: sin perfil (todavía no la dieron de alta)
// o desactivada. La primera cuenta de todo el negocio queda como PROPIETARIA (y administradora);
// después de eso, las cuentas solo las da de alta un administrador.
export function SinAcceso({ sesion, perfil, onSalir }) {
  const [primeraVez, setPrimeraVez] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const desactivada = !!perfil && perfil.activo === false;

  const reclamar = async (nombreFinal) => {
    setGuardando(true); setError("");
    const ok = await saveRecord("perfiles", sesion.uid, {
      uid: sesion.uid, nombre: nombreFinal, correo: sesion.email || "",
      roles: { admin: true }, propietario: true, activo: true, creado: Date.now(),
    });
    setGuardando(false);
    try { sessionStorage.removeItem("primera_vez_nombre"); } catch (e) {}
    if (!ok) setError("Este negocio ya tiene propietario. Pídele que te dé de alta desde Caja → Turno → Equipo.");
  };
  const configurar = () => {
    if (!nombre.trim()) { setError("Escribe tu nombre."); return; }
    reclamar(nombre.trim());
  };
  // Si acaba de crear la cuenta en "primer ingreso", el perfil de propietario se crea solo.
  useEffect(() => {
    let pendiente = "";
    try { pendiente = sessionStorage.getItem("primera_vez_nombre") || ""; } catch (e) {}
    if (pendiente && perfil === null) reclamar(pendiente);
  }, []);

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
        {guardando && <div style={styles.closeConfirmText}>Configurando tu cuenta…</div>}
        {error && <div style={styles.pinError}>{error}</div>}
        {!desactivada && !primeraVez && !guardando && (
          <button style={{ ...styles.inlineAddLink, marginTop: 10 }} onClick={() => setPrimeraVez(true)}>Es la primera vez que se instala este negocio</button>
        )}
        {!desactivada && primeraVez && (
          <>
            <div style={{ ...styles.closeConfirmText, marginTop: 10 }}>Esta cuenta quedará como <b>Propietaria</b> del negocio: es administradora y ese rol no se puede quitar, solo transferir a otra persona.</div>
            <input style={styles.editInput} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <button style={{ ...styles.addItemBtn, marginTop: 8, opacity: guardando ? 0.5 : 1 }} disabled={guardando} onClick={configurar}><KeyRound size={15} /> Quedar como propietario</button>
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

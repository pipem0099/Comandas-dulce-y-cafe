import React, { useState, useEffect } from "react";
import { KeyRound, ArrowRightLeft, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";

import { saveRecord, updateShared, subscribeShared, iniciarSesion, enviarCorreoCambioClave, crearCuentaPropietaria } from "../firebase.js";
import { aplicarMarca } from "../theme.js";
import { leerMarcaCache } from "../marcaCache.js";
import { VERSION } from "../constantes.js";
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

/* ───────── Pantallas de ingreso: oscuras y sobrias, con la marca del negocio ───────── */

// Datos públicos del negocio (nombre, marca y si ya tiene propietario). Se leen SIN iniciar sesión.
function useSistema() {
  const [sistema, setSistema] = useState(undefined); // undefined = todavía cargando
  useEffect(() => subscribeShared("sistema", null, (v) => setSistema(v || {})), []);
  useEffect(() => { if (sistema && sistema.marca) aplicarMarca(sistema.marca); }, [sistema]);
  return sistema;
}

function MarcoAcceso({ sistema, children }) {
  const cache = leerMarcaCache();
  const marca = (sistema && sistema.marca) || (cache && cache.marca) || null;
  const nombre = (marca && marca.nombre) || (cache && cache.nombre) || "Comandas";
  return (
    <div style={a.pagina}>
      <div style={a.brillo} />
      <div style={a.columna} className="anim-in">
        <div style={a.marca}>
          {marca && marca.logo
            ? <img src={marca.logo} alt="" style={a.logo} />
            : <div style={a.monograma}>{nombre.trim().charAt(0).toUpperCase()}</div>}
          <div style={a.nombre}>{nombre.toUpperCase()}</div>
          <div style={a.linea} />
        </div>
        <div style={a.tarjeta}>{children}</div>
        <div style={a.pie}>SISTEMA DE COMANDAS · V{VERSION}</div>
      </div>
    </div>
  );
}

function CampoClave({ value, onChange, placeholder, autoComplete, onEnter }) {
  const [ver, setVer] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        style={{ ...a.input, paddingRight: 46 }} type={ver ? "text" : "password"} autoComplete={autoComplete}
        placeholder={placeholder} value={value} onChange={onChange}
        onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()}
      />
      <button type="button" style={a.ojo} onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar clave" : "Ver clave"} tabIndex={-1}>
        {ver ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function InicioSesion() {
  const sistema = useSistema();
  const [modo, setModo] = useState("entrar"); // 'entrar' | 'crear' (primer ingreso: crear la cuenta del propietario)
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Cuando el negocio ya tiene propietario, la opción de "primer ingreso" desaparece para todos.
  const yaTienePropietario = !!sistema && sistema.inicializado === true;
  const puedeCrear = sistema !== undefined && !yaTienePropietario;
  const esCrear = modo === "crear" && puedeCrear;

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
    if (r.ok) setInfo("Si ese correo tiene cuenta, te llegará un mensaje para crear una clave nueva.");
    else setError(msgAuth(r.code));
  };
  const listo = esCrear ? nombre.trim() && correo.trim() && clave && clave2 : correo.trim() && clave;

  return (
    <MarcoAcceso sistema={sistema}>
      <div style={a.eyebrow}>{esCrear ? "PRIMER INGRESO" : "BIENVENIDO"}</div>
      <div style={a.titulo}>{esCrear ? "Crea la cuenta del propietario" : "Iniciar sesión"}</div>
      {esCrear && <div style={a.texto}>Se hace una sola vez. Esta cuenta queda como <b style={{ color: "#F3EEE3" }}>propietaria</b> y desde ahí creas las cuentas de tu equipo.</div>}
      <div style={a.campos}>
        {esCrear && <input style={a.input} autoComplete="name" placeholder="Tu nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); setError(""); }} />}
        <input style={a.input} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" placeholder="Correo electrónico" value={correo} onChange={(e) => { setCorreo(e.target.value); setError(""); }} />
        <CampoClave value={clave} onChange={(e) => { setClave(e.target.value); setError(""); }} placeholder={esCrear ? "Clave (mínimo 6 caracteres)" : "Clave"} autoComplete={esCrear ? "new-password" : "current-password"} onEnter={esCrear ? undefined : entrar} />
        {esCrear && <CampoClave value={clave2} onChange={(e) => { setClave2(e.target.value); setError(""); }} placeholder="Repite la clave" autoComplete="new-password" onEnter={crear} />}
      </div>
      {error && <div style={a.error}><AlertCircle size={15} /> <span>{error}</span></div>}
      {info && <div style={a.info}>{info}</div>}
      <button style={{ ...a.boton, opacity: !listo || enviando ? 0.5 : 1 }} disabled={!listo || enviando} onClick={esCrear ? crear : entrar}>
        {enviando ? "Un momento…" : esCrear ? "Crear cuenta" : "Entrar"} {!enviando && <ArrowRight size={17} />}
      </button>
      <div style={a.enlaces}>
        {!esCrear && <button style={a.enlace} onClick={olvide}>¿Olvidaste tu clave?</button>}
        {puedeCrear && (
          <button style={a.enlace} onClick={() => cambiarModo(esCrear ? "entrar" : "crear")}>
            {esCrear ? "Ya tengo cuenta" : "Configurar este negocio por primera vez"}
          </button>
        )}
      </div>
    </MarcoAcceso>
  );
}

// Cuenta que inició sesión pero no puede usar la app: sin perfil (todavía no la dieron de alta)
// o desactivada. La primera cuenta de todo el negocio queda como PROPIETARIA (y administradora);
// después de eso, las cuentas solo las da de alta un administrador.
export function SinAcceso({ sesion, perfil, onSalir }) {
  const sistema = useSistema();
  const [primeraVez, setPrimeraVez] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const desactivada = !!perfil && perfil.activo === false;
  const yaTienePropietario = !!sistema && sistema.inicializado === true;

  const reclamar = async (nombreFinal) => {
    setGuardando(true); setError("");
    const ok = await saveRecord("perfiles", sesion.uid, {
      uid: sesion.uid, nombre: nombreFinal, correo: sesion.email || "",
      roles: { admin: true }, propietario: true, activo: true, creado: Date.now(),
    });
    try { sessionStorage.removeItem("primera_vez_nombre"); } catch (e) {}
    // Aviso público de que el negocio ya tiene propietario (oculta la opción de "primer ingreso").
    if (ok) await updateShared("sistema", { inicializado: true });
    setGuardando(false);
    if (!ok) setError("Este negocio ya tiene propietario. Pídele que te dé de alta desde Equipo y usuarios.");
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
    <MarcoAcceso sistema={sistema}>
      <div style={a.eyebrow}>{desactivada ? "ACCESO DESACTIVADO" : "SIN ACCESO TODAVÍA"}</div>
      <div style={a.titulo}>{desactivada ? "Tu cuenta está desactivada" : "Tu cuenta aún no está dada de alta"}</div>
      <div style={a.texto}>
        {desactivada
          ? "Un administrador desactivó tu acceso. Si crees que es un error, habla con él."
          : `Ingresaste como ${sesion.email || "tu cuenta"}, pero todavía no tienes un rol asignado. Pídele al administrador que te dé de alta.`}
      </div>
      {guardando && <div style={a.info}>Configurando tu cuenta…</div>}
      {error && <div style={a.error}><AlertCircle size={15} /> <span>{error}</span></div>}
      {!desactivada && primeraVez && !yaTienePropietario && (
        <>
          <div style={a.texto}>Esta cuenta quedará como <b style={{ color: "#F3EEE3" }}>Propietaria</b>: es administradora y ese rol no se puede quitar, solo transferir.</div>
          <input style={a.input} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <button style={{ ...a.boton, opacity: guardando ? 0.5 : 1 }} disabled={guardando} onClick={configurar}><KeyRound size={16} /> Quedar como propietario</button>
        </>
      )}
      <div style={a.enlaces}>
        {!desactivada && !primeraVez && !guardando && sistema !== undefined && !yaTienePropietario && (
          <button style={a.enlace} onClick={() => setPrimeraVez(true)}>Configurar este negocio por primera vez</button>
        )}
        <button style={a.enlace} onClick={onSalir}>Cerrar sesión</button>
      </div>
    </MarcoAcceso>
  );
}

const a = {
  pagina: { minHeight: "100dvh", background: "#14110D", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden", boxSizing: "border-box" },
  brillo: { position: "absolute", top: -180, left: "50%", width: 640, height: 640, transform: "translateX(-50%)", background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 26%, transparent) 0%, transparent 62%)", pointerEvents: "none" },
  columna: { position: "relative", width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 22 },
  marca: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  logo: { height: 60, width: "auto", maxWidth: 240, objectFit: "contain" },
  monograma: { width: 68, height: 68, borderRadius: 18, border: "1.5px solid var(--accent)", color: "var(--accent-t)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, background: "rgba(255,255,255,0.02)" },
  nombre: { fontFamily: "var(--font-display)", color: "#F7F4EC", letterSpacing: 5, fontSize: 17, fontWeight: 600, textAlign: "center" },
  linea: { width: 36, height: 2, background: "var(--accent)", borderRadius: 1 },
  tarjeta: { display: "flex", flexDirection: "column", gap: 12, padding: 24, background: "rgba(255,255,255,0.035)", border: "1px solid #2B261E", borderRadius: 20, boxShadow: "0 24px 60px -24px rgba(0,0,0,.7)", backdropFilter: "blur(8px)" },
  eyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 2, color: "var(--accent-t)", fontWeight: 600 },
  titulo: { fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 700, color: "#F7F4EC", lineHeight: 1.15, marginBottom: 2 },
  texto: { fontSize: 13.5, lineHeight: 1.55, color: "#A59D8A" },
  campos: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 },
  input: { width: "100%", boxSizing: "border-box", padding: "14px 15px", background: "#1D1913", border: "1px solid #373026", borderRadius: 12, color: "#F3EEE3", fontSize: 15, fontFamily: "var(--font-body)" },
  ojo: { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#8A8272", cursor: "pointer" },
  boton: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, padding: "15px 16px", background: "var(--accent)", color: "#F7F4EC", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, letterSpacing: 0.3, cursor: "pointer", boxShadow: "0 10px 28px -10px color-mix(in srgb, var(--accent) 70%, transparent)" },
  error: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#E8A090", background: "rgba(193,68,45,0.12)", border: "1px solid rgba(193,68,45,0.35)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.4 },
  info: { fontSize: 13, color: "#8FB487", lineHeight: 1.45 },
  enlaces: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 4 },
  enlace: { background: "transparent", border: "none", color: "#B3A891", fontSize: 13, padding: "8px 6px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "#4A4236" },
  pie: { textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.8, color: "#4A4236" },
};

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

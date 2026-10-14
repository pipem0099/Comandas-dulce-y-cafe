import React, { useState, useEffect } from "react";
import {
  Plus, UserCircle2,
} from "lucide-react";

import { subscribeCollection, saveRecord, updateRecord, enviarCorreoCambioClave, crearCuentaEmpleado } from "../firebase.js";
import { ROLES_ORDEN } from "../constantes.js";
import { styles } from "../estilos.js";
import { msgAuth } from "../pantallas/Acceso.jsx";
import { dateTimeLabel, rolLabel, rolesAMapa, rolesDe, rolesLabel, tieneRol } from "../utilidades.js";

export function GestionUsuarios({ config, persistConfig, usuarioActual }) {
  const auditLog = config.auditLog || [];
  const [perfiles, setPerfiles] = useState(null);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [rolesNuevo, setRolesNuevo] = useState(["mesero"]);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState({}); // mensajes por usuario (ej. "correo enviado")

  useEffect(() => subscribeCollection("perfiles", (v) => setPerfiles(v)), []);

  const registrar = (accion) => ({ ts: Date.now(), accion, actor: usuarioActual.nombre });
  const log = (accion) => persistConfig({ ...config, auditLog: [registrar(accion), ...auditLog].slice(0, 50) });
  const lista = (perfiles || []).slice().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  const adminsActivos = lista.filter((u) => u.activo === true && rolesDe(u).includes("admin"));

  const toggleRolNuevo = (r) => setRolesNuevo((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const crear = async () => {
    setError(""); setExito("");
    const mail = correo.trim().toLowerCase();
    if (!nombre.trim()) { setError("Escribe el nombre."); return; }
    if (!/^\S+@\S+\.\S+$/.test(mail)) { setError("Escribe un correo válido."); return; }
    if (clave.length < 6) { setError("La clave inicial debe tener mínimo 6 caracteres."); return; }
    if (rolesNuevo.length === 0) { setError("Elige al menos un rol."); return; }
    if (lista.some((u) => (u.correo || "").toLowerCase() === mail)) { setError("Ya hay una cuenta con ese correo."); return; }
    setCreando(true);
    const r = await crearCuentaEmpleado(mail, clave);
    if (!r.ok) { setCreando(false); setError(msgAuth(r.code)); return; }
    const ok = await saveRecord("perfiles", r.uid, { uid: r.uid, nombre: nombre.trim(), correo: mail, roles: rolesAMapa(rolesNuevo), activo: true, creado: Date.now(), creadoPor: usuarioActual.nombre });
    setCreando(false);
    if (!ok) { setError("La cuenta se creó pero no se pudo guardar su perfil. Vuelve a intentarlo con el mismo correo y la misma clave."); return; }
    await log(`Creó la cuenta de "${nombre.trim()}" (${rolesNuevo.map(rolLabel).join(" + ")})`);
    setExito(`Cuenta creada. Dale a ${nombre.trim()} este correo y esta clave: ${mail} · ${clave}. Podrá cambiar la clave con "Olvidé mi clave".`);
    setNombre(""); setCorreo(""); setClave(""); setRolesNuevo(["mesero"]);
  };

  const toggleRolUsuario = async (u, r) => {
    setError("");
    const actuales = rolesDe(u);
    const tiene = actuales.includes(r);
    if (tiene && actuales.length === 1) { setError("El usuario debe tener al menos un rol."); return; }
    if (tiene && r === "admin" && u.activo && adminsActivos.length <= 1) { setError("Debe quedar al menos un administrador."); return; }
    const nuevos = tiene ? actuales.filter((x) => x !== r) : [...actuales, r];
    await updateRecord("perfiles", u.uid, { roles: rolesAMapa(nuevos) });
    await log(`${tiene ? "Le quitó" : "Le agregó"} el rol ${rolLabel(r)} ${tiene ? "a" : "a"} "${u.nombre}"`);
  };

  const cambiarActivo = async (u, activo) => {
    setError("");
    if (u.uid === usuarioActual.uid) { setError("No puedes desactivar tu propia cuenta."); return; }
    if (!activo && u.activo && rolesDe(u).includes("admin") && adminsActivos.length <= 1) { setError("Debe quedar al menos un administrador."); return; }
    await updateRecord("perfiles", u.uid, { activo });
    await log(`${activo ? "Reactivó" : "Desactivó"} la cuenta de "${u.nombre}"`);
  };

  const enviarClave = async (u) => {
    const r = await enviarCorreoCambioClave(u.correo);
    setAviso((a) => ({ ...a, [u.uid]: r.ok ? `Correo enviado a ${u.correo}` : msgAuth(r.code) }));
  };

  const hayPinesViejos = (config.usuarios || []).length > 0;

  return (
    <div>
      <div style={styles.catLabel}>EQUIPO</div>
      {perfiles === null && <div style={styles.cajaEmptyText}>Cargando equipo…</div>}
      {lista.map((u) => (
        <div key={u.uid} style={{ ...styles.usuarioRow, opacity: u.activo ? 1 : 0.6 }}>
          <div style={styles.usuarioRowLeft}>
            <UserCircle2 size={16} color="var(--c-8a8272-t)" />
            <span style={styles.pagoRowEtiqueta}>{u.nombre}</span>
            <span style={styles.rolBadge}>{u.activo ? rolesLabel(u) : "Desactivada"}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--c-8a8272-t)" }}>{u.correo}</div>
          <div style={styles.usuarioRowActions}>
            <div style={styles.rolPillsRowSmall}>
              {ROLES_ORDEN.map((r) => (
                <button key={r} style={{ ...styles.rolPillSmall, ...(tieneRol(u, r) ? styles.rolPillActive : {}) }} onClick={() => toggleRolUsuario(u, r)}>{rolLabel(r)}</button>
              ))}
            </div>
            <button style={styles.inlineLink} onClick={() => enviarClave(u)}>enviar clave nueva</button>
            {u.uid !== usuarioActual.uid && (
              u.activo
                ? <button style={{ ...styles.inlineLink, color: "var(--c-c1442d-t)" }} onClick={() => cambiarActivo(u, false)}>desactivar</button>
                : <button style={styles.inlineLink} onClick={() => cambiarActivo(u, true)}>reactivar</button>
            )}
          </div>
          {aviso[u.uid] && <div style={{ fontSize: 12, color: "var(--c-5b7553-t)", fontWeight: 600 }}>{aviso[u.uid]}</div>}
        </div>
      ))}
      {perfiles && lista.length === 0 && <div style={styles.cajaEmptyText}>Todavía no hay cuentas.</div>}

      <div style={{ ...styles.catLabel, marginTop: 16 }}>CREAR CUENTA</div>
      <div style={styles.turnoBox}>
        <div style={styles.closeConfirmText}>Cada persona entra con su propio correo y clave. Puedes marcar más de un rol (ej. Mesero + Cajero). La tablet de cocina puede tener su propia cuenta con el rol Cocina.</div>
        <input style={styles.editInput} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input style={styles.editInput} type="email" inputMode="email" autoCapitalize="none" placeholder="Correo" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <input style={styles.editInput} placeholder="Clave inicial (mínimo 6 caracteres)" value={clave} onChange={(e) => setClave(e.target.value)} />
        <div style={styles.rolPillsRow}>
          {ROLES_ORDEN.map((r) => (
            <button key={r} style={{ ...styles.rolPill, ...(rolesNuevo.includes(r) ? styles.rolPillActive : {}) }} onClick={() => toggleRolNuevo(r)}>{rolLabel(r)}</button>
          ))}
        </div>
        {error && <div style={styles.pinError}>{error}</div>}
        {exito && <div style={{ ...styles.closeConfirmText, color: "var(--c-5b7553-t)", fontWeight: 600 }}>{exito}</div>}
        <button style={{ ...styles.addItemBtn, opacity: creando ? 0.5 : 1 }} disabled={creando} onClick={crear}><Plus size={15} /> {creando ? "Creando…" : "Crear cuenta"}</button>
      </div>

      {hayPinesViejos && (
        <>
          <div style={{ ...styles.catLabel, marginTop: 16 }}>PIN ANTIGUOS</div>
          <div style={styles.turnoBox}>
            <div style={styles.closeConfirmText}>Todavía hay {config.usuarios.length} usuario(s) del sistema anterior con su PIN guardado en la base. Ya no se usan para entrar. Cuando termines de crear las cuentas nuevas, bórralos.</div>
            <button style={styles.addItemBtn} onClick={async () => { await persistConfig({ ...config, usuarios: [], auditLog: [registrar("Borró los PIN del sistema anterior"), ...auditLog].slice(0, 50) }); }}>Borrar PIN antiguos</button>
          </div>
        </>
      )}

      {auditLog.length > 0 && (
        <>
          <div style={{ ...styles.catLabel, marginTop: 16 }}>REGISTRO DE SEGURIDAD</div>
          {auditLog.map((r, i) => (
            <div key={i} style={styles.turnoRow}>
              <span style={styles.cierreDate}>{dateTimeLabel(r.ts)}</span>
              <span style={styles.auditText}>{r.actor}: {r.accion}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

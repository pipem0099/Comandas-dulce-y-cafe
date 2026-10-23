import React, { useState, useEffect } from "react";
import { Plus, UserCircle2, UserPlus, ShieldCheck, ChevronUp, ChevronDown } from "lucide-react";

import { subscribeCollection, saveRecord, updateRecord, updateShared, enviarCorreoCambioClave, crearCuentaEmpleado } from "../firebase.js";
import { ROLES_ORDEN } from "../constantes.js";
import { styles } from "../estilos.js";
import { msgAuth } from "../pantallas/Acceso.jsx";
import { Acordeon } from "../componentes/Comunes.jsx";
import { agruparPorMes, dateTimeLabel, rolLabel, rolesAMapa, rolesDe, rolesLabel, tieneRol } from "../utilidades.js";

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
  const [crearAbierto, setCrearAbierto] = useState(false); // formulario "Agregar persona" plegado por defecto
  const [logAbierto, setLogAbierto] = useState(false);       // registro de seguridad plegado por defecto
  const [confirmTransfer, setConfirmTransfer] = useState(null); // uid de quien recibiría la propiedad
  const yoPropietario = usuarioActual.propietario === true;

  useEffect(() => subscribeCollection("perfiles", (v) => setPerfiles(v)), []);

  const registrar = (accion) => ({ ts: Date.now(), accion, actor: usuarioActual.nombre });
  const log = (accion) => persistConfig({ ...config, auditLog: [registrar(accion), ...auditLog].slice(0, 500) });
  const lista = (perfiles || []).slice().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  const adminsActivos = lista.filter((u) => u.activo === true && rolesDe(u).includes("admin"));

  const toggleRolNuevo = (r) => setRolesNuevo((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const crear = async () => {
    setError(""); setExito("");
    const mail = correo.trim().toLowerCase();
    if (!nombre.trim()) { setError("Escribe el nombre."); return; }
    if (!/^\S+@\S+\.\S+$/.test(mail)) { setError("Escribe un correo válido."); return; }
    if (clave.length < 10) { setError("La clave inicial debe tener mínimo 10 caracteres."); return; }
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
    if (u.propietario && r === "admin") { setError("El propietario siempre es administrador."); return; }
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
    if (u.propietario) { setError("Al propietario no se le puede desactivar. Primero transfiere la propiedad."); return; }
    if (u.uid === usuarioActual.uid) { setError("No puedes desactivar tu propia cuenta."); return; }
    if (!activo && u.activo && rolesDe(u).includes("admin") && adminsActivos.length <= 1) { setError("Debe quedar al menos un administrador."); return; }
    await updateRecord("perfiles", u.uid, { activo });
    await log(`${activo ? "Reactivó" : "Desactivó"} la cuenta de "${u.nombre}"`);
  };

  // Pasa la propiedad a otra persona (que debe estar activa). Quien la entrega sigue como administrador.
  // Se escriben los dos perfiles en una sola operación: o cambian los dos o no cambia ninguno.
  const transferir = async (u) => {
    setError("");
    const yo = lista.find((x) => x.uid === usuarioActual.uid);
    if (!yo || !yoPropietario || !u.activo) return;
    const ok = await updateShared("perfiles", {
      [u.uid]: { ...u, propietario: true, activo: true, roles: { ...rolesAMapa(rolesDe(u)), admin: true } },
      [yo.uid]: { ...yo, propietario: false },
    });
    setConfirmTransfer(null);
    if (!ok) { setError("No se pudo transferir. Revisa tu conexión e inténtalo de nuevo."); return; }
    await log(`Transfirió la propiedad del negocio a "${u.nombre}"`);
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
            <span style={{ ...styles.rolBadge, ...(u.propietario ? { background: "var(--c-242019-b)", color: "#F4F6F8" } : {}) }}>{u.activo ? rolesLabel(u) : "Desactivada"}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--c-8a8272-t)" }}>{u.correo}</div>
          {(!u.propietario || u.uid === usuarioActual.uid) && (
            <div style={styles.usuarioRowActions}>
              <div style={styles.rolPillsRowSmall}>
                {ROLES_ORDEN.map((r) => {
                  const bloqueado = u.propietario && r === "admin"; // el propietario siempre es admin
                  return (
                    <button
                      key={r} disabled={bloqueado} title={bloqueado ? "El propietario siempre es administrador" : undefined}
                      style={{ ...styles.rolPillSmall, ...(tieneRol(u, r) ? styles.rolPillActive : {}), ...(bloqueado ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}
                      onClick={() => toggleRolUsuario(u, r)}
                    >{rolLabel(r)}</button>
                  );
                })}
              </div>
              <button style={styles.inlineLink} onClick={() => enviarClave(u)}>enviar clave nueva</button>
              {!u.propietario && u.uid !== usuarioActual.uid && (
                u.activo
                  ? <button style={{ ...styles.inlineLink, color: "var(--c-c1442d-t)" }} onClick={() => cambiarActivo(u, false)}>desactivar</button>
                  : <button style={styles.inlineLink} onClick={() => cambiarActivo(u, true)}>reactivar</button>
              )}
              {yoPropietario && !u.propietario && u.activo && (
                <button style={styles.inlineLink} onClick={() => setConfirmTransfer(u.uid)}>transferir propiedad</button>
              )}
            </div>
          )}
          {confirmTransfer === u.uid && (
            <div style={{ ...styles.turnoBox, marginTop: 6 }}>
              <div style={styles.closeConfirmText}>
                ¿Transferir la propiedad del negocio a <b>{u.nombre}</b>? Pasará a ser la propietaria y tú seguirás como administrador. Solo ella podrá volver a transferirla.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.cancelEditBtn} onClick={() => setConfirmTransfer(null)}>Cancelar</button>
                <button style={{ ...styles.addItemBtn, flex: 1 }} onClick={() => transferir(u)}>Sí, transferir</button>
              </div>
            </div>
          )}
          {aviso[u.uid] && <div style={{ fontSize: 12, color: "var(--c-5b7553-t)", fontWeight: 600 }}>{aviso[u.uid]}</div>}
        </div>
      ))}
      {perfiles && lista.length === 0 && <div style={styles.cajaEmptyText}>Todavía no hay cuentas.</div>}

      {!crearAbierto ? (
        <button style={{ ...styles.addItemBtn, marginTop: 16 }} onClick={() => setCrearAbierto(true)}><UserPlus size={15} /> Agregar persona</button>
      ) : (
        <>
      <div style={{ ...styles.catLabel, marginTop: 16 }}>NUEVA CUENTA</div>
      <div style={styles.turnoBox}>
        <div style={styles.closeConfirmText}>Cada persona entra con su propio correo y clave. Puedes marcar más de un rol (ej. Mesero + Cajero). La tablet de cocina puede tener su propia cuenta con el rol Cocina.</div>
        <input style={styles.editInput} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input style={styles.editInput} type="email" inputMode="email" autoCapitalize="none" placeholder="Correo" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <input style={styles.editInput} placeholder="Clave inicial (mínimo 10 caracteres)" value={clave} onChange={(e) => setClave(e.target.value)} />
        <div style={styles.rolPillsRow}>
          {ROLES_ORDEN.map((r) => (
            <button key={r} style={{ ...styles.rolPill, ...(rolesNuevo.includes(r) ? styles.rolPillActive : {}) }} onClick={() => toggleRolNuevo(r)}>{rolLabel(r)}</button>
          ))}
        </div>
        {error && <div style={styles.pinError}>{error}</div>}
        {exito && <div style={{ ...styles.closeConfirmText, color: "var(--c-5b7553-t)", fontWeight: 600 }}>{exito}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.cancelEditBtn} onClick={() => { setCrearAbierto(false); setError(""); setExito(""); }}>Cerrar</button>
          <button style={{ ...styles.addItemBtn, flex: 1, opacity: creando ? 0.5 : 1 }} disabled={creando} onClick={crear}><Plus size={15} /> {creando ? "Creando…" : "Crear cuenta"}</button>
        </div>
      </div>

        </>
      )}

      {hayPinesViejos && (
        <>
          <div style={{ ...styles.catLabel, marginTop: 16 }}>PIN ANTIGUOS</div>
          <div style={styles.turnoBox}>
            <div style={styles.closeConfirmText}>Todavía hay {config.usuarios.length} usuario(s) del sistema anterior con su PIN guardado en la base. Ya no se usan para entrar. Cuando termines de crear las cuentas nuevas, bórralos.</div>
            <button style={styles.addItemBtn} onClick={async () => { await persistConfig({ ...config, usuarios: [], auditLog: [registrar("Borró los PIN del sistema anterior"), ...auditLog].slice(0, 500) }); }}>Borrar PIN antiguos</button>
          </div>
        </>
      )}

      {auditLog.length > 0 && (
        <>
          <button style={styles.plegableBtn} onClick={() => setLogAbierto((v) => !v)} aria-expanded={logAbierto}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={15} /> Registro de seguridad <span style={styles.plegableCuenta}>{auditLog.length}</span></span>
            {logAbierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {logAbierto && (
            <div className="despliega" style={{ marginTop: 10 }}>
              {agruparPorMes(auditLog, (r) => r.ts).map((mes, i) => (
                <Acordeon key={mes.key} titulo={mes.titulo} inicialAbierto={i === 0} resumen={`${mes.items.length} ${mes.items.length === 1 ? "movimiento" : "movimientos"}`}>
                  {mes.items.map((r, j) => (
                    <div key={j} style={styles.auditRow}>
                      <span style={styles.cierreDate}>{dateTimeLabel(r.ts)}</span>
                      <span style={styles.auditText}>{r.actor}: {r.accion}</span>
                    </div>
                  ))}
                </Acordeon>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

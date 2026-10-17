/*
 * Relevo de caja: un mismo turno puede pasar por varias personas. Cada persona es responsable de un
 * "tramo": desde que recibe el efectivo hasta que lo entrega (o cierra el turno). El esperado de cada
 * tramo se calcula por separado, así cada quien responde solo por el suyo.
 *
 *   tramo = { id, uid, nombre, inicioTs, base, finTs, ventasEfectivo, entradas, salidas,
 *             esperado, contado, diferencia, estado: activo | pendiente | entregado | cerrado }
 *
 * Los turnos viejos (sin tramos) se leen como un único tramo.
 */
import { uid } from "./logica.js";
import { updateRecord } from "./firebase.js";
import { movimientosDe, ventasEnRango } from "./utilidades.js";

export function tramosDe(turno) {
  if (turno && turno.tramos) return Object.values(turno.tramos).sort((a, b) => a.inicioTs - b.inicioTs);
  if (!turno) return [];
  // turno anterior a los relevos: un solo tramo con los datos del turno
  const cerrado = turno.estado === "cerrado";
  return [{
    id: "t0", uid: turno.abiertoPorUid || null, nombre: (cerrado && turno.cerradoPor) || turno.abiertoPor || "—",
    inicioTs: turno.aperturaTs, base: turno.baseEfectivo || 0, estado: cerrado ? "cerrado" : "activo",
    ...(cerrado ? {
      finTs: turno.cierreTs, ventasEfectivo: turno.ventasEfectivo, entradas: turno.entradas, salidas: turno.salidas,
      esperado: turno.esperado, contado: turno.contado, diferencia: turno.diferencia,
    } : {}),
  }];
}
// El tramo que sigue abierto (el último que todavía no terminó)
export function tramoVigente(turno) {
  const abiertos = tramosDe(turno).filter((t) => !t.finTs);
  return abiertos[abiertos.length - 1] || null;
}
export function responsableDe(turno) {
  if (turno && turno.responsableActual) return turno.responsableActual;
  return { uid: turno && turno.abiertoPorUid, nombre: turno && turno.abiertoPor };
}
// Ventas en efectivo, entradas, salidas y esperado de un tramo (hasta ahora, o hasta su fin)
export function statsTramo(turno, cuentas, tramo) {
  const desde = tramo.inicioTs, hasta = tramo.finTs || Infinity;
  const ventasEfectivo = ventasEnRango(cuentas, desde, hasta).efectivo;
  let entradas = 0, salidas = 0;
  movimientosDe(turno).forEach((m) => {
    if (m.anulado || m.ts < desde || m.ts >= hasta) return;
    if (m.tipo === "entrada") entradas += m.monto || 0; else salidas += m.monto || 0;
  });
  return { ventasEfectivo, entradas, salidas, esperado: (tramo.base || 0) + ventasEfectivo + entradas - salidas };
}

const guardar = (turno, cambios) => updateRecord("turnos", turno.id, cambios);

/**
 * Entrega la caja. El tramo de quien entrega se cierra con lo que contó y nace el de quien recibe, con
 * esa cifra como base. Normalmente queda pendiente hasta que la otra persona toca "Recibir". Si es
 * `forzado` (la persona se fue sin entregar) quien cuenta asume la caja de una vez y se deja constancia.
 * Todo se escribe en una sola operación: o se guarda completo o no se guarda nada.
 */
export async function proponerRelevo({ turno, cuentas, a, contado, observaciones, forzado, porNombre }) {
  const ahora = Date.now();
  const actual = tramoVigente(turno);
  const st = statsTramo(turno, cuentas, actual);
  const de = responsableDe(turno);
  const diferencia = contado - st.esperado;
  const nuevoId = uid(), relevoId = uid();
  const origen = {
    ...actual, finTs: ahora, ...st, contado, diferencia, estado: "entregado",
    entregadoA: { uid: a.uid, nombre: a.nombre }, observaciones: observaciones || null,
    ...(forzado ? { forzado: true, cerradoPor: porNombre } : {}),
  };
  const destino = { id: nuevoId, uid: a.uid, nombre: a.nombre, inicioTs: ahora + 1, base: contado, estado: forzado ? "activo" : "pendiente", ...(forzado ? { aceptadoTs: ahora } : {}) };
  const relevo = { id: relevoId, deUid: de.uid || null, deNombre: de.nombre, aUid: a.uid, aNombre: a.nombre, ts: ahora, contado, esperado: st.esperado, diferencia, observaciones: observaciones || null, tramoOrigen: actual.id, tramoDestino: nuevoId };
  const cambios = { [`tramos/${actual.id}`]: origen, [`tramos/${nuevoId}`]: destino };
  if (forzado) {
    cambios.responsableActual = { uid: a.uid, nombre: a.nombre, desdeTs: ahora };
    cambios[`relevos/${relevoId}`] = { ...relevo, estado: "forzado", por: porNombre, aceptadoTs: ahora };
    cambios.relevo = null;
  } else {
    cambios.relevo = relevo;
  }
  return guardar(turno, cambios);
}

// Quien recibe confirma que le entregaron esa cantidad: pasa a ser el responsable de la caja.
export async function aceptarRelevo({ turno, usuario }) {
  const r = turno.relevo;
  if (!r) return false;
  const ahora = Date.now();
  return guardar(turno, {
    [`tramos/${r.tramoDestino}/estado`]: "activo",
    [`tramos/${r.tramoDestino}/aceptadoTs`]: ahora,
    responsableActual: { uid: r.aUid, nombre: r.aNombre, desdeTs: ahora },
    [`relevos/${r.id}`]: { ...r, estado: "aceptado", aceptadoTs: ahora, por: usuario.nombre },
    relevo: null,
  });
}

// "No coincide" (quien recibe) o cancelar (quien entrega): se deshace la entrega y el tramo de
// quien entregaba vuelve a quedar abierto. Los conteos que hizo siguen guardados.
export async function deshacerRelevo({ turno, usuario, motivo, cancelar }) {
  const r = turno.relevo;
  if (!r) return false;
  const origen = (turno.tramos && turno.tramos[r.tramoOrigen]) || null;
  const cambios = {
    [`relevos/${r.id}`]: { ...r, estado: cancelar ? "cancelado" : "rechazado", por: usuario.nombre, ts: Date.now(), motivo: motivo || null },
    relevo: null,
    [`tramos/${r.tramoDestino}`]: null,
  };
  if (origen) {
    cambios[`tramos/${r.tramoOrigen}`] = {
      ...origen, estado: "activo", finTs: null, contado: null, esperado: null, diferencia: null,
      ventasEfectivo: null, entradas: null, salidas: null, entregadoA: null, observaciones: null,
    };
  }
  return guardar(turno, cambios);
}

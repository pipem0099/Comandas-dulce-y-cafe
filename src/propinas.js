import { dayKey } from "./dinero.js";

/* Reparto de propinas — lógica pura (sin pantalla).
   Reglas:
   · Solo se reparten propinas de turnos YA CERRADOS (lo de un turno abierto se ve aparte, como «en curso»).
   · Cada cuenta tiene un «candado» (propinasPagadas/{cuentaId} = id del reparto). Con candado = ya repartida: nunca se vuelve a sumar.
   · Las propinas de cualquier método de pago (tarjeta, transferencia…) se entregan en efectivo: aquí no se separan por método. */

const CAJA = "principal";
const montoDe = (c) => (c && c.propina && Number(c.propina.monto)) || 0;

/** El turno CERRADO de esa caja que contiene ese momento (o null). */
export function turnoCerradoDe(turnos, ts, cajaId) {
  return (turnos || []).find((t) => t.estado === "cerrado" && (t.cajaId || CAJA) === (cajaId || CAJA) && ts >= t.aperturaTs && ts <= (t.cierreTs || Infinity)) || null;
}

/**
 * Clasifica las propinas de las cuentas pagadas entre `desde` y `hasta`:
 *  · pendientes: turno cerrado y sin candado → se pueden repartir ahora
 *  · repartidas: con candado (dice en qué reparto)
 *  · enCurso:    su turno sigue abierto (o no hay turno que la cubra) → todavía no se reparten
 * `porDia` junta lo mismo por día, para mostrar qué días ya estaban pagos y cuáles se liquidan ahora.
 */
export function clasificarPropinas({ cuentas, turnos, candados = {}, desde, hasta = Infinity }) {
  const pendientes = [], repartidas = [], enCurso = [];
  const porDia = {};
  (cuentas || []).filter((c) => c.estado === "pagada" && c.pagadaTs >= desde && c.pagadaTs < hasta && montoDe(c) > 0).forEach((c) => {
    const t = turnoCerradoDe(turnos, c.pagadaTs, c.cajaId);
    const item = { id: c.id, ts: c.pagadaTs, monto: montoDe(c), mesero: c.mesero || "Sin asignar", turnoId: t ? t.id : null, repartoId: candados[c.id] || null };
    const dia = (porDia[dayKey(c.pagadaTs)] = porDia[dayKey(c.pagadaTs)] || { dia: dayKey(c.pagadaTs), ts: c.pagadaTs, pendiente: 0, repartido: 0, enCurso: 0, repartos: new Set() });
    if (item.repartoId) { repartidas.push(item); dia.repartido += item.monto; dia.repartos.add(item.repartoId); }
    else if (t) { pendientes.push(item); dia.pendiente += item.monto; }
    else { enCurso.push(item); dia.enCurso += item.monto; }
  });
  const suma = (l) => l.reduce((s, x) => s + x.monto, 0);
  return {
    pendientes, repartidas, enCurso,
    totalPendiente: suma(pendientes), totalRepartido: suma(repartidas), totalEnCurso: suma(enCurso),
    porDia: Object.values(porDia).map((d) => ({ ...d, repartos: Array.from(d.repartos) })).sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}

/** Desglose por turno cerrado y por mesero (quién abrió las cuentas), con lo pendiente y lo repartido. */
export function desglosePorTurno(items, turnos) {
  const mapa = {};
  items.forEach((it) => {
    const clave = it.turnoId || "en-curso";
    const t = (turnos || []).find((x) => x.id === it.turnoId);
    const f = (mapa[clave] = mapa[clave] || { turnoId: it.turnoId, ts: t ? t.aperturaTs : it.ts, cierreTs: t ? t.cierreTs : null, meseros: {} });
    const m = (f.meseros[it.mesero] = f.meseros[it.mesero] || { nombre: it.mesero, pendiente: 0, repartido: 0, cuentas: 0 });
    m.cuentas += 1; if (it.repartoId) m.repartido += it.monto; else m.pendiente += it.monto;
  });
  return Object.values(mapa).sort((a, b) => a.ts - b.ts).map((f) => ({ ...f, meseros: Object.values(f.meseros).sort((a, b) => (b.pendiente + b.repartido) - (a.pendiente + a.repartido)) }));
}

/** Divide `monto` en partes enteras entre los destinatarios; lo que sobra por redondeo se da de a un peso a los primeros (la suma siempre cuadra). */
export function dividirPropina(monto, destinatarios) {
  const n = destinatarios.length; if (n === 0) return [];
  const total = Math.round(monto); const base = Math.floor(total / n); let resto = total - base * n;
  return destinatarios.map((d) => { const extra = resto > 0 ? 1 : 0; resto -= extra; return { uid: d.uid, nombre: d.nombre, monto: base + extra }; });
}

/**
 * Arma lo que se guarda al repartir: el reparto, lo de cada persona y los candados. Todo va en UNA sola escritura (o se guarda todo o nada).
 * modo: "uno" (una sola persona se lleva todo) | "varios" (partes iguales). No reparta nada si no hay pendientes o destinatarios.
 */
export function armarReparto({ pendientes, destinatarios, modo, repartoId, ahora, usuario, desde, hasta, periodo }) {
  if (!pendientes.length || !destinatarios.length) return null;
  const quienes = modo === "uno" ? destinatarios.slice(0, 1) : destinatarios;
  const total = pendientes.reduce((s, p) => s + p.monto, 0);
  const lineas = dividirPropina(total, quienes);
  const cuentas = {}; pendientes.forEach((p) => { cuentas[p.id] = true; });
  const reparto = { id: repartoId, ts: ahora, uid: usuario.uid, nombre: usuario.nombre || "", desde, hasta, periodo: periodo || "", modo: modo === "uno" ? "uno" : "varios", total, nCuentas: pendientes.length, lineas, cuentas };
  const personas = lineas.map((l) => ({ uid: l.uid, valor: { ts: ahora, monto: l.monto, nombre: l.nombre, periodo: periodo || "", por: usuario.nombre || "", repartoId } }));
  return { reparto, personas, candados: Object.keys(cuentas) };
}

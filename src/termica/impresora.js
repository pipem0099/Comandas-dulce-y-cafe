/*
 * Conexión con la impresora térmica de ESTE equipo (la impresora es de cada tablet o computador, por eso se guarda en el equipo, no en la nube).
 *
 * Formas de conectar:
 *   · Bluetooth (BLE) y USB y Puerto serie: directo desde el navegador (Chrome/Edge en Android o computador).
 *   · RawBT (solo Android): app gratuita que maneja casi cualquier impresora, incluidas las Bluetooth clásicas (que son la mayoría de las baratas
 *     de 58 mm y NO funcionan por Bluetooth directo del navegador).
 *
 * Se crea con dependencias inyectables (navegador, almacenamiento, ventana) para poder probar la lógica sin impresora: `npm run termica:probar`.
 * Importante: NO se ha probado con una impresora física; usa «Probar impresión» al configurarla.
 */
import { enviarEnTrozos, aBase64 } from "./escpos.js";

const SERVICIOS_BLE = ["000018f0-0000-1000-8000-00805f9b34fb", "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "49535343-fe7d-4ae5-8fa9-9fafd205e455", "0000ff00-0000-1000-8000-00805f9b34fb", "0000fee7-0000-1000-8000-00805f9b34fb", "0000ffe0-0000-1000-8000-00805f9b34fb"];
const POR_DEFECTO = { tipo: "", nombre: "", columnas: 48, tabla: 19, autoCocina: false, activadoTs: 0, imprimirAlEnviar: false };
export const TIPOS = { bluetooth: "Bluetooth", usb: "USB", serial: "Puerto serie", rawbt: "RawBT (Android)" };

export function crearImpresora({ navegador = typeof navigator !== "undefined" ? navigator : {}, almacen = typeof localStorage !== "undefined" ? localStorage : null, ventana = typeof window !== "undefined" ? window : {}, reloj = Date.now } = {}) {
  const CLAVE = "termica:config";
  let conexion = null;           // { escribir(bytes), cerrar(), nombre, tipo, tam, pausa }
  const oyentes = new Set();
  const avisar = () => oyentes.forEach((f) => { try { f(estado()); } catch (_) { /* un oyente roto no frena a los demás */ } });

  function config() {
    try { return { ...POR_DEFECTO, ...JSON.parse((almacen && almacen.getItem(CLAVE)) || "{}") }; } catch (_) { return { ...POR_DEFECTO }; }
  }
  function guardarConfig(parcial) {
    const nueva = { ...config(), ...parcial };
    try { if (almacen) almacen.setItem(CLAVE, JSON.stringify(nueva)); } catch (_) { /* sin espacio: queda solo en esta sesión */ }
    avisar(); return nueva;
  }
  const disponibles = () => ({
    bluetooth: !!navegador.bluetooth, usb: !!navegador.usb, serial: !!navegador.serial,
    rawbt: /Android/i.test(String(navegador.userAgent || "")),
  });
  function estado() { const c = config(); return { tipo: c.tipo, nombre: c.nombre, conectada: !!conexion || c.tipo === "rawbt", configurada: !!c.tipo, autoCocina: c.autoCocina, imprimirAlEnviar: c.imprimirAlEnviar }; }

  async function viaBluetooth(dispositivoDado) {
    const dispositivo = dispositivoDado || await navegador.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICIOS_BLE });
    const servidor = await dispositivo.gatt.connect();
    for (const s of await servidor.getPrimaryServices()) {
      const caracteristicas = await s.getCharacteristics();
      const c = caracteristicas.find((x) => x.properties && (x.properties.writeWithoutResponse || x.properties.write));
      if (c) return { tipo: "bluetooth", nombre: dispositivo.name || "Impresora Bluetooth", tam: 100, pausa: 20, escribir: (b) => (c.properties.writeWithoutResponse ? c.writeValueWithoutResponse(b) : c.writeValue(b)), cerrar: () => { try { dispositivo.gatt.disconnect(); } catch (_) { /* ya estaba cerrada */ } } };
    }
    throw new Error("Esta impresora no recibe datos por Bluetooth directo (suele pasar con las Bluetooth clásicas). Instala RawBT y elige «RawBT».");
  }
  async function viaUSB(dispositivoDado) {
    const d = dispositivoDado || await navegador.usb.requestDevice({ filters: [{ classCode: 7 }] });
    await d.open(); if (!d.configuration) await d.selectConfiguration(1);
    const interfaz = d.configuration.interfaces.find((i) => i.alternates.some((a) => a.interfaceClass === 7)) || d.configuration.interfaces[0];
    await d.claimInterface(interfaz.interfaceNumber);
    const alterna = interfaz.alternates.find((a) => a.interfaceClass === 7) || interfaz.alternates[0];
    const salida = alterna.endpoints.find((e) => e.direction === "out");
    if (!salida) throw new Error("No se encontró por dónde enviar datos a la impresora USB.");
    return { tipo: "usb", nombre: d.productName || "Impresora USB", tam: 4096, pausa: 0, escribir: (b) => d.transferOut(salida.endpointNumber, b), cerrar: () => d.close() };
  }
  async function viaSerial(puertoDado) {
    const p = puertoDado || await navegador.serial.requestPort();
    await p.open({ baudRate: 9600 });
    const w = p.writable.getWriter();
    return { tipo: "serial", nombre: "Puerto serie", tam: 512, pausa: 0, escribir: (b) => w.write(b), cerrar: async () => { try { w.releaseLock(); await p.close(); } catch (_) { /* ya estaba cerrado */ } } };
  }

  /** Conecta (hay que llamarlo desde un toque del usuario: el navegador lo exige). */
  async function conectar(tipo) {
    if (conexion) { try { await conexion.cerrar(); } catch (_) { /* nada */ } conexion = null; }
    if (tipo === "rawbt") { guardarConfig({ tipo: "rawbt", nombre: "RawBT" }); return { ok: true, nombre: "RawBT" }; }
    if (!disponibles()[tipo]) throw new Error(`Este navegador no permite conectar por ${TIPOS[tipo] || tipo}. Prueba con Chrome o con RawBT.`);
    const c = await ({ bluetooth: viaBluetooth, usb: viaUSB, serial: viaSerial }[tipo])();
    conexion = c; guardarConfig({ tipo: c.tipo, nombre: c.nombre });
    return { ok: true, nombre: c.nombre };
  }

  /** Intenta volver a conectar sola (USB y puerto serie lo permiten sin pedir nada; Bluetooth casi nunca). */
  async function reconectar() {
    const c = config();
    try {
      if (c.tipo === "usb" && navegador.usb && navegador.usb.getDevices) { const d = (await navegador.usb.getDevices())[0]; if (d) { conexion = await viaUSB(d); avisar(); return true; } }
      if (c.tipo === "serial" && navegador.serial && navegador.serial.getPorts) { const p = (await navegador.serial.getPorts())[0]; if (p) { conexion = await viaSerial(p); avisar(); return true; } }
      if (c.tipo === "bluetooth" && navegador.bluetooth && navegador.bluetooth.getDevices) { const d = (await navegador.bluetooth.getDevices()).find((x) => x.name === c.nombre); if (d) { conexion = await viaBluetooth(d); avisar(); return true; } }
    } catch (_) { /* queda desconectada: se avisa y se reconecta con un toque */ }
    return false;
  }

  /** Manda los bytes a la impresora. Devuelve { ok } o { ok: false, motivo } con un texto que se puede mostrar tal cual. */
  async function imprimir(bytes) {
    const c = config();
    if (!c.tipo) return { ok: false, motivo: "No hay impresora configurada en este equipo." };
    try {
      if (c.tipo === "rawbt") { ventana.location.href = `rawbt:base64,${aBase64(bytes)}`; return { ok: true }; }
      if (!conexion && !(await reconectar())) return { ok: false, motivo: "La impresora está desconectada. Toca «Conectar» en Impresora de tickets." };
      await enviarEnTrozos(bytes, conexion.escribir, conexion.tam, conexion.pausa);
      return { ok: true };
    } catch (e) {
      conexion = null; avisar();
      return { ok: false, motivo: `No se pudo imprimir: ${(e && e.message) || e}` };
    }
  }

  async function desconectar() {
    if (conexion) { try { await conexion.cerrar(); } catch (_) { /* nada */ } }
    conexion = null; guardarConfig({ tipo: "", nombre: "", autoCocina: false, imprimirAlEnviar: false });
  }

  return { config, guardarConfig, disponibles, estado, conectar, reconectar, imprimir, desconectar, observar: (f) => { oyentes.add(f); return () => oyentes.delete(f); }, ahora: reloj };
}

export const impresora = crearImpresora();

// Pruebas de la impresión de la comanda desde el equipo del mesero: diferencias entre rondas, deduplicación y fallos de impresora.
//   npm run comanda:probar        (sin impresora ni navegador; NO prueban una impresora física)
import { numeroRonda, diferenciasPedido, ajusteDePedido, eventosPorImprimir, eventosParaCocina, marcaDeImpresion, imprimeAlEnviar, crearServicioComandas, claveConAmbito, ambitoDe, claveAjuste, yaImpreso } from "../src/termica/comandaMesero.js";
import { ticketCocina, ticketAjusteCocina } from "../src/termica/tickets.js";

let total = 0, fallas = 0;
const ok = (c, t) => { total++; if (!c) fallas++; console.log(`${c ? "✔" : "✘"} ${t}`); };
const LARGO_CMD = { 0x1B: { 0x40: 2, 0x74: 3, 0x61: 3, 0x45: 3, 0x64: 3, 0x70: 5 }, 0x1D: { 0x21: 3, 0x56: 4 } };
const renglones = (bytes) => { const t = []; let cur = []; for (let i = 0; i < bytes.length;) { const x = bytes[i]; if (LARGO_CMD[x] && LARGO_CMD[x][bytes[i + 1]]) { i += LARGO_CMD[x][bytes[i + 1]]; continue; } if (x === 0x0A) { t.push(String.fromCharCode(...cur)); cur = []; } else cur.push(x >= 0x20 && x < 0x7F ? x : 0x3F); i++; } return t; };
const pausa = (ms = 0) => new Promise((r) => setTimeout(r, ms));

console.log("── Rondas ──");
const p1 = { id: "a", cuentaId: "c1", ts: 100, estado: "pendiente", items: [] };
const p2 = { id: "b", cuentaId: "c1", ts: 200, estado: "pendiente", items: [] };
const p3 = { id: "c", cuentaId: "c2", ts: 150, estado: "pendiente", items: [] };
const p4 = { id: "d", cuentaId: "c1", ts: 300, estado: "cancelado", items: [] };
ok(numeroRonda([p2, p1, p3, p4], p1) === 1 && numeroRonda([p2, p1, p3, p4], p2) === 2, "la ronda es el orden de envío dentro de la cuenta");
ok(numeroRonda([p1, p3], p3) === 1, "cada cuenta cuenta sus propias rondas");
ok(numeroRonda([p1, p2, p4], p4) === 3, "un pedido que no está en la lista toma el siguiente número");

console.log("\n── Diferencias entre lo enviado y lo nuevo ──");
const base = [{ id: "m1", name: "Limonada", qty: 2 }, { id: "m2", name: "Sándwich", qty: 1, nota: "sin cebolla" }, { id: "m3", name: "Torta", qty: 1 }];
{
  const d = diferenciasPedido(base, [{ id: "m1", name: "Limonada", qty: 3 }, { id: "m2", name: "Sándwich", qty: 1, nota: "sin cebolla" }, { id: "m3", name: "Torta", qty: 1 }, { id: "m4", name: "Café", qty: 2 }]);
  ok(d.agregados.length === 2 && d.agregados[0].name === "Limonada" && d.agregados[0].qty === 1 && d.agregados[1].name === "Café" && d.agregados[1].qty === 2 && d.cancelados.length === 0, "subir una cantidad y agregar un producto nuevo: solo se agrega lo que falta (+1 limonada, +2 café)");
}
{
  const d = diferenciasPedido(base, [{ id: "m1", name: "Limonada", qty: 1 }, { id: "m2", name: "Sándwich", qty: 1, nota: "sin cebolla" }]);
  ok(d.cancelados.length === 2 && d.cancelados[0].name === "Limonada" && d.cancelados[0].qty === 1 && d.cancelados[1].name === "Torta" && d.cancelados[1].qty === 1 && d.agregados.length === 0, "bajar una cantidad y quitar un producto: se cancela lo que sobra (-1 limonada, -1 torta)");
}
{
  const d = diferenciasPedido(base, [{ id: "m1", name: "Limonada", qty: 2 }, { id: "m2", name: "Sándwich", qty: 1, nota: "con todo" }, { id: "m3", name: "Torta", qty: 1 }]);
  ok(d.agregados.length === 0 && d.cancelados.length === 0 && d.notas.length === 1 && d.notas[0].nota === "con todo", "cambiar solo una nota queda como cambio de nota");
}
{
  const d = diferenciasPedido([{ id: "m1", name: "Jugo", qty: 1, mods: [{ n: "sin azúcar" }] }], [{ id: "m2", name: "Jugo", qty: 1, mods: [{ n: "en leche" }] }]);
  ok(d.cancelados[0].name === "Jugo (sin azúcar)" && d.agregados[0].name === "Jugo (en leche)", "cambiar un producto por otro: sale uno cancelado y uno agregado, con sus opciones");
}
ok(ajusteDePedido(base, base, 5) === null, "sin cambios no hay ajuste que imprimir");
ok(ajusteDePedido(base, base, 5, "", "alergia a nueces").notaGeneral === "alergia a nueces", "cambiar solo la nota general también es un ajuste");
{
  const conDestino = [{ id: "m1", name: "Limonada", qty: 2, estacion: "e2", pisoPrep: "p2" }, base[1], base[2]];
  const a = ajusteDePedido(conDestino, [{ ...conDestino[0], qty: 1 }, base[1], base[2]], 9);
  ok(a.ts === 9 && a.cancelados[0].estacion === "e2" && a.cancelados[0].pisoPrep === "p2", "el ajuste recuerda de qué estación y piso era cada producto");
  ok(!JSON.stringify(ajusteDePedido(base, [], 1)).includes("undefined"), "el ajuste no lleva campos «undefined» (Firebase los rechaza)");
}

console.log("\n── Qué falta imprimir ──");
const nuevo = { id: "o1", cuentaId: "c1", ts: 1000, estado: "pendiente", items: base };
ok(eventosPorImprimir(nuevo).map((e) => e.clave).join() === "n", "un pedido nuevo debe imprimir su comanda");
ok(eventosPorImprimir({ ...nuevo, impresiones: { n: { ts: 1, por: "Ana" } } }).length === 0, "si ya está marcado como impreso, no se imprime otra vez");
ok(eventosPorImprimir({ ...nuevo, estado: "cancelado" }).length === 0, "un pedido cancelado no se imprime");
ok(eventosPorImprimir(nuevo, { desdeTs: 2000 }).length === 0, "lo anterior a activar la opción no se imprime");
{
  const aj = { ts: 1500, agregados: [{ name: "Café", qty: 1 }], cancelados: [] };
  const ev = eventosPorImprimir({ ...nuevo, impresiones: { n: { ts: 1, por: "Ana" } }, ultimoAjuste: aj });
  ok(ev.length === 1 && ev[0].tipo === "ajuste" && ev[0].clave === "aj-1500", "un ajuste nuevo pide su propio ticket aunque la comanda ya esté impresa");
  ok(eventosPorImprimir({ ...nuevo, impresiones: { n: { ts: 1, por: "Ana" }, "aj-1500": { ts: 2, por: "Ana" } }, ultimoAjuste: aj }).length === 0, "y no se repite cuando el ajuste ya se imprimió");
  ok(eventosPorImprimir({ ...nuevo, ultimoAjuste: aj }).map((e) => e.clave).join() === "n,aj-1500", "si nada se imprimió, salen la comanda y luego el ajuste");
}
ok(marcaDeImpresion({ por: "x".repeat(300), equipo: "y".repeat(300), ahora: 5 }).por.length === 120 && marcaDeImpresion({ por: "Ana", ahora: 5 }).ts === 5 && !("equipo" in marcaDeImpresion({ por: "Ana" })), "la marca respeta los topes de las reglas y no lleva campos vacíos");
ok(imprimeAlEnviar({ tipo: "usb", imprimirAlEnviar: true }) && !imprimeAlEnviar({ tipo: "", imprimirAlEnviar: true }) && !imprimeAlEnviar({ tipo: "usb", imprimirAlEnviar: false }) && !imprimeAlEnviar(null), "solo imprime al enviar si la opción está activa Y hay impresora configurada");

console.log("\n── Ámbito: cada estación y piso imprime lo suyo ──");
ok(ambitoDe("todas", "todos") === "" && ambitoDe("e2", "todos") === "e2" && ambitoDe("e2", "p3") === "e2-p3" && ambitoDe(undefined, "p3") === "p3", "el ámbito junta estación y piso (vacío = todo el pedido)");
ok(claveConAmbito("n", "") === "n" && claveConAmbito("n", "e2") === "n_e2" && /^[A-Za-z0-9_-]+$/.test(claveConAmbito("aj-1", "e$/2.#")), "las claves no llevan caracteres que Firebase prohíbe");
ok(eventosPorImprimir({ ...nuevo, impresiones: { n_e1: { ts: 1, por: "K" } } }, { ambito: "e2" }).length === 1, "si la Cocina ya imprimió su parte, la Barra imprime la suya");
ok(eventosPorImprimir({ ...nuevo, impresiones: { n_e1: { ts: 1, por: "K" } } }, { ambito: "e1" }).length === 0, "pero la misma estación no repite lo suyo");
ok(eventosPorImprimir({ ...nuevo, impresiones: { n: { ts: 1, por: "Ana" } } }, { ambito: "e2" }).length === 0, "si el equipo del mesero imprimió TODO el pedido, ninguna estación lo repite");

console.log("\n── Deduplicación entre el mesero y la Cocina ──");
{
  const vistos = new Map(); const yaVisto = (llave, ahora) => { if (!vistos.has(llave)) vistos.set(llave, ahora); return vistos.get(llave); };
  const e1 = eventosParaCocina([nuevo], { yaVisto, ahora: 10000, esperaMs: 6000 });
  ok(e1.length === 1 && e1[0].esperar === 6000, "la Cocina ve un pedido nuevo pero espera unos segundos antes de imprimirlo");
  const e2 = eventosParaCocina([{ ...nuevo, impresiones: { n: { ts: 10500, por: "Ana" } } }], { yaVisto, ahora: 13000, esperaMs: 6000 });
  ok(e2.length === 0, "si el mesero imprimió y anotó la marca durante la espera, la Cocina NO imprime");
  const e3 = eventosParaCocina([nuevo], { yaVisto, ahora: 17000, esperaMs: 6000 });
  ok(e3.length === 1 && e3[0].esperar === 0, "si pasó la espera y nadie imprimió (el mesero no tiene impresora), la Cocina imprime");
  const e4 = eventosParaCocina([nuevo], { yaVisto: (l, a) => a - 100000, ahora: 200000, esperaMs: 6000, enCurso: () => true });
  ok(e4.length === 0, "mientras un evento se está imprimiendo no se pide otra vez");
  const e5 = eventosParaCocina([{ ...nuevo, estado: "preparando" }], { yaVisto, ahora: 99999 });
  ok(e5.length === 0, "un pedido que ya se está preparando no se imprime «de golpe» como nuevo");
  const e6 = eventosParaCocina([{ ...nuevo, estado: "preparando", ultimoAjuste: { ts: 1500, agregados: [{ name: "Café", qty: 1 }], cancelados: [] }, impresiones: { n: { ts: 1, por: "Ana" } } }], { yaVisto, ahora: 99999, esperaMs: 0 });
  ok(e6.length === 1 && e6[0].evento.tipo === "ajuste", "pero un ajuste sí se imprime aunque el pedido ya esté en preparación");
}

console.log("\n── Servicio de impresión ──");
const crear = ({ resultados = [{ ok: true }], marcarFalla = false } = {}) => {
  const e = { enviados: [], marcas: [], intentos: 0 };
  const impresora = { config: () => ({ tipo: "usb", imprimirAlEnviar: true }), imprimir: async (bytes) => { const r = resultados[Math.min(e.intentos, resultados.length - 1)]; e.intentos++; if (r.lanza) throw new Error("usb se desconectó"); if (r.ok) e.enviados.push(bytes); await pausa(5); return r; } };
  const marcar = async (pedido, clave, marca) => { if (marcarFalla) throw new Error("sin red"); e.marcas.push({ id: pedido.id, clave, marca }); };
  const armar = { nuevo: (p) => new Uint8Array([1, p.items.length]), ajuste: (p, a) => new Uint8Array([2, a.agregados.length]), reimpresion: (p) => new Uint8Array([3]) };
  e.servicio = crearServicioComandas({ impresora, marcar, armar, equipo: "Mesero", ahora: () => 777 });
  return e;
};
{
  const e = crear(); const r = await e.servicio.imprimirNuevo(nuevo, { por: "Ana" });
  ok(r.ok && e.enviados.length === 1 && e.marcas.length === 1 && e.marcas[0].clave === "n" && e.marcas[0].marca.por === "Ana" && e.marcas[0].marca.equipo === "Mesero" && e.marcas[0].marca.ts === 777, "si la impresora confirma, se imprime y SOLO ENTONCES se anota la marca");
}
{
  const e = crear({ resultados: [{ ok: false, motivo: "La impresora está desconectada." }] }); const r = await e.servicio.imprimirNuevo(nuevo, { por: "Ana" });
  ok(!r.ok && r.motivo === "La impresora está desconectada." && e.marcas.length === 0, "si la impresora falla NO se anota la marca (se podrá reintentar) y se devuelve el motivo");
}
{
  const e = crear({ resultados: [{ lanza: true }] }); const r = await e.servicio.imprimirNuevo(nuevo, { por: "Ana" });
  ok(!r.ok && /usb se desconectó/.test(r.motivo) && e.marcas.length === 0, "si la impresora lanza un error, no se rompe nada: devuelve el motivo y no marca");
}
{
  const e = crear({ resultados: [{ ok: false, motivo: "falló" }, { ok: true }] });
  const a = await e.servicio.imprimirNuevo(nuevo, { por: "Ana" }); const b = await e.servicio.imprimirNuevo(nuevo, { por: "Ana" });
  ok(!a.ok && b.ok && e.marcas.length === 1, "«Reintentar» después de un fallo imprime y recién ahí anota la marca");
}
{
  const e = crear({ marcarFalla: true }); const r = await e.servicio.imprimirNuevo(nuevo, { por: "Ana" });
  ok(r.ok && e.enviados.length === 1, "si se imprimió pero no se pudo anotar la marca, igual cuenta como impreso (no se reclama un fallo falso)");
}
{
  const e = crear({ resultados: [{ ok: true }] });
  const [a, b] = await Promise.all([e.servicio.imprimirNuevo(nuevo, { por: "Ana" }), e.servicio.imprimirNuevo(nuevo, { por: "Ana" })]);
  ok(e.enviados.length === 1 && (a.repetido || b.repetido), "dos pedidos de imprimir el mismo evento a la vez sacan UN solo ticket");
}
{
  const e = crear(); const aj = { ts: 1500, agregados: [{ name: "Café", qty: 1 }], cancelados: [] };
  await e.servicio.imprimirAjuste(nuevo, aj, { por: "Ana" });
  ok(e.enviados[0][0] === 2 && e.marcas[0].clave === claveAjuste(1500), "un ajuste usa su propio ticket y su propia marca");
  await e.servicio.imprimirNuevo(nuevo, { por: "Ana", ambito: "e2" });
  ok(e.marcas[1].clave === "n_e2", "una pantalla de estación anota la marca con su ámbito");
}
{
  const e = crear(); const r = await e.servicio.reimprimir(nuevo, { por: "Ana" });
  ok(r.ok && e.enviados[0][0] === 3 && e.marcas.length === 0, "«Reimprimir comanda» saca el ticket pero NO anota marcas (no altera el control de duplicados)");
  ok(!yaImpreso(nuevo, "n"), "y el pedido no queda marcado");
}

console.log("\n── Tickets ──");
const ts = new Date(2026, 10, 8, 20, 15).getTime();
{
  const r = renglones(ticketAjusteCocina({ pedido: nuevo, lugar: "Mesa 4", mesero: "Ana", ronda: 2, ajuste: { ts, agregados: [{ name: "Café", qty: 2, nota: "sin azúcar" }], cancelados: [{ name: "Torta", qty: 1 }], notas: [{ name: "Sándwich", nota: "con todo" }], notaGeneral: "alergia a las nueces" } })).join("\n");
  ok(/AJUSTE/.test(r) && /Mesa 4/.test(r) && /Ronda 2/.test(r), "el ticket de ajuste dice AJUSTE, la mesa y la ronda");
  ok(/\+ 2 x Caf/.test(r) && /> sin az/.test(r), "lo agregado sale con «+»");
  ok(/- 1 x Torta/.test(r) && /CANCELADO/.test(r), "lo cancelado sale con «-» y la palabra CANCELADO");
  ok(/Nota de S/.test(r) && /alergia a las nueces/.test(r), "las notas cambiadas también salen");
}
{
  const r = renglones(ticketCocina({ pedido: { ts, items: [{ qty: 1, name: "Café" }] }, lugar: "Mesa 4", ronda: 2 })).join("\n");
  ok(/Ronda 2/.test(r) && !/REIMPRESI/.test(r), "la comanda de una ronda nueva dice el número de ronda");
  const c = renglones(ticketCocina({ pedido: { ts, items: [{ qty: 1, name: "Café", dest: "Barra · Piso 2" }] }, lugar: "Mesa 4", reimpresion: true, destino: "Cocina · Piso 2 -> Piso 3" })).join("\n");
  ok(/REIMPRESI/.test(c) && /Barra/.test(c) && /Piso 2 -> Piso 3/.test(c), "una reimpresión se marca como copia y muestra el destino");
}

console.log(`\n${total - fallas} de ${total} pruebas cumplen lo esperado.`);
process.exit(fallas ? 1 : 0);

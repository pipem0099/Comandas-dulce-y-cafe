/*
 * Almacén local clave-valor que sobrevive a recargar o cerrar la app (IndexedDB).
 * Si el navegador no lo permite (modo privado, pruebas), usa la memoria: la app sigue funcionando, solo que sin esa persistencia.
 */
export function almacenMemoria() {
  const m = new Map();
  return {
    persistente: false,
    async leer(k) { return m.has(k) ? JSON.parse(m.get(k)) : undefined; },
    async guardar(k, v) { m.set(k, JSON.stringify(v)); },
    async borrar(k) { m.delete(k); },
    async claves(prefijo = "") { return [...m.keys()].filter((k) => k.startsWith(prefijo)); },
    async limpiar(prefijo = "") { [...m.keys()].filter((k) => k.startsWith(prefijo)).forEach((k) => m.delete(k)); },
  };
}

export function almacenIndexedDB(nombre = "comandas-sin-conexion") {
  if (typeof indexedDB === "undefined") return almacenMemoria();
  let abierta = null;
  const abrir = () => {
    if (!abierta) {
      abierta = new Promise((res, rej) => {
        let req;
        try { req = indexedDB.open(nombre, 1); } catch (e) { rej(e); return; }
        req.onupgradeneeded = () => { req.result.createObjectStore("kv"); };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
        req.onblocked = () => rej(new Error("bloqueada"));
      });
    }
    return abierta;
  };
  const tx = async (modo, fn) => {
    const db = await abrir();
    return new Promise((res, rej) => {
      const t = db.transaction("kv", modo);
      const st = t.objectStore("kv");
      let salida;
      try { salida = fn(st); } catch (e) { rej(e); return; }
      t.oncomplete = () => res(salida && typeof salida === "object" && "result" in salida ? salida.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  const respaldo = almacenMemoria();
  const seguro = (op, alterno) => async (...a) => { try { return await op(...a); } catch (e) { return alterno(...a); } };
  return {
    persistente: true,
    leer: seguro(async (k) => { const r = await tx("readonly", (st) => st.get(k)); return r === undefined ? undefined : JSON.parse(r); }, (k) => respaldo.leer(k)),
    guardar: seguro(async (k, v) => { await tx("readwrite", (st) => st.put(JSON.stringify(v), k)); }, (k, v) => respaldo.guardar(k, v)),
    borrar: seguro(async (k) => { await tx("readwrite", (st) => st.delete(k)); }, (k) => respaldo.borrar(k)),
    claves: seguro(async (prefijo = "") => { const todas = await tx("readonly", (st) => st.getAllKeys()); return todas.filter((k) => String(k).startsWith(prefijo)); }, (p) => respaldo.claves(p)),
    limpiar: seguro(async (prefijo = "") => {
      const todas = await tx("readonly", (st) => st.getAllKeys());
      const borrar = todas.filter((k) => String(k).startsWith(prefijo));
      await tx("readwrite", (st) => { borrar.forEach((k) => st.delete(k)); });
    }, (p) => respaldo.limpiar(p)),
  };
}

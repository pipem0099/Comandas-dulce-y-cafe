/*
 * Fusión de cambios hechos SIN internet con lo que pasó mientras tanto en el servidor (otros dispositivos).
 * Puras: se prueban con `npm run offline:probar`.
 *
 *   fusionar(base, local, remoto)
 *     base    cómo estaba el registro cuando se hizo el cambio sin internet
 *     local   cómo quedó después del cambio hecho en este dispositivo
 *     remoto  cómo está AHORA en el servidor
 *   → { valor, conflictos, aplicable }
 *
 * Reglas (por campo): si solo cambió este dispositivo, queda lo local; si solo cambió el servidor, queda lo del servidor;
 * si cambiaron los dos, las listas con `id` (como los pagos) se UNEN sin repetir, y cualquier otro choque lo gana el servidor y queda anotado.
 * Un choque GRAVE (ej. la cuenta ya se cerró desde otro dispositivo mientras aquí se le cobraba) NO se aplica: queda para revisión humana,
 * para no cobrar dos veces ni perder plata en silencio.
 */
const esObjeto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const vacio = (x) => x === undefined || x === null;

export function iguales(a, b) {
  if (vacio(a) && vacio(b)) return true;
  if (vacio(a) || vacio(b)) return false;
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => iguales(x, b[i]));
  }
  if (esObjeto(a)) {
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of ks) if (!iguales(a[k], b[k])) return false;
    return true;
  }
  return false;
}

const conId = (arr) => Array.isArray(arr) && arr.every((x) => esObjeto(x) && x.id !== undefined);

function unirListas(b, l, r, ruta, out) {
  const base = new Map((b || []).map((x) => [x.id, x]));
  const loc = new Map((l || []).map((x) => [x.id, x]));
  const rem = new Map((r || []).map((x) => [x.id, x]));
  const res = [];
  for (const [id, itemR] of rem) {
    if (loc.has(id) && base.has(id)) res.push(unir(base.get(id), loc.get(id), itemR, `${ruta}[${id}]`, out));
    else res.push(itemR); // lo del servidor se conserva (si lo borró el local, aquí no se pierde nada de otros)
  }
  for (const [id, itemL] of loc) {
    if (!rem.has(id) && !base.has(id)) res.push(itemL);              // nuevo de este dispositivo
    // existía en la base y el servidor lo borró: gana el servidor
  }
  return res;
}

function unir(b, l, r, ruta, out) {
  if (iguales(l, b)) return r;
  if (iguales(r, b)) return l;
  if (iguales(l, r)) return l;
  if (esObjeto(l) && esObjeto(r) && (esObjeto(b) || vacio(b))) {
    const res = {};
    const ks = new Set([...Object.keys(b || {}), ...Object.keys(l), ...Object.keys(r)]);
    for (const k of ks) {
      const v = unir((b || {})[k], l[k], r[k], ruta ? `${ruta}.${k}` : k, out);
      if (v !== undefined) res[k] = v;
    }
    return res;
  }
  if (Array.isArray(l) && Array.isArray(r) && conId(l) && conId(r) && (vacio(b) || conId(b))) return unirListas(b, l, r, ruta, out);
  out.push({ campo: ruta || "(registro)", local: l, remoto: r, grave: false });
  return r;
}

const ESTADOS_CERRADOS = ["pagada", "cancelada", "fusionada", "pendiente", "condonada"];

export function fusionar(base, local, remoto) {
  const conflictos = [];
  if (vacio(remoto)) {
    if (vacio(base)) return { valor: local, conflictos, aplicable: true };                    // creado sin internet, el servidor no lo tiene: se sube
    conflictos.push({ campo: "(registro)", local, remoto: null, grave: true, motivo: "borrado-en-servidor" });
    return { valor: null, conflictos, aplicable: false };
  }
  if (vacio(base)) {
    if (iguales(local, remoto)) return { valor: remoto, conflictos, aplicable: true };       // ya estaba subido (reintento)
    conflictos.push({ campo: "(registro)", local, remoto, grave: true, motivo: "creado-en-ambos" });
    return { valor: remoto, conflictos, aplicable: false };
  }
  const valor = unir(base, local, remoto, "", conflictos);
  // Choque grave: aquí se cobró/anotó pagos y desde otro dispositivo la cuenta ya se cerró o cambió de estado.
  const idsPagos = (x) => new Set(((x && x.pagos) || []).map((p) => p && p.id));
  const nuevosLocales = ((local && local.pagos) || []).filter((p) => p && !idsPagos(base).has(p.id) && !idsPagos(remoto).has(p.id));
  const estadoCambioRemoto = remoto.estado !== base.estado && ESTADOS_CERRADOS.includes(remoto.estado);
  if (nuevosLocales.length > 0 && estadoCambioRemoto) {
    conflictos.push({ campo: "estado", local: local.estado, remoto: remoto.estado, grave: true, motivo: "cuenta-cerrada-en-otro-dispositivo" });
  }
  return { valor, conflictos, aplicable: !conflictos.some((c) => c.grave) };
}

import { useEffect, useState } from "react";
import { subscribeShared, observarConexion, facturasEnCola } from "./firebase.js";

/** Ajustes fiscales del restaurante (no secretos). null mientras cargan. */
export function useAjustesFiscales() {
  const [a, setA] = useState(null);
  useEffect(() => subscribeShared("facturacion/ajustes", {}, setA), []);
  return a;
}

/** Documento electrónico de UNA cuenta (en vivo). `undefined` mientras carga, null si no hay. Solo caja y administrador pueden leerlo. */
export function useDocumentoFactura(cuentaId, habilitado = true) {
  const [doc, setDoc] = useState(undefined);
  useEffect(() => {
    if (!cuentaId || !habilitado) { setDoc(undefined); return undefined; }
    return subscribeShared(`facturacion/documentos/${cuentaId}`, null, setDoc);
  }, [cuentaId, habilitado]);
  return doc;
}

/** Cuentas con una emisión guardada en este equipo esperando internet. */
export function useFacturasEnCola() {
  const [ids, setIds] = useState(() => facturasEnCola());
  useEffect(() => observarConexion(() => setIds(facturasEnCola())), []);
  return ids;
}

/** Todos los documentos electrónicos (para cuadrar caja con las Notas Crédito). Solo caja y administrador pueden leerlos; el resto recibe {}. */
export function useDocumentosFiscales(habilitado = true) {
  const [docs, setDocs] = useState({});
  useEffect(() => {
    if (!habilitado) { setDocs({}); return undefined; }
    return subscribeShared("facturacion/documentos", {}, (d) => setDocs(d || {}));
  }, [habilitado]);
  return docs;
}

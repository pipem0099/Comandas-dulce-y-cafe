/*
 * Municipios de Caldas con su código DANE (DIVIPOLA). El usuario NUNCA escribe el código: elige el municipio y el código se llena solo.
 * Función/constantes PURAS (npm run fiscal:probar).
 */
export const MUNICIPIOS_CALDAS = Object.freeze([
  { municipio: "Manizales", departamento: "Caldas", dane: "17001" },
  { municipio: "Aguadas", departamento: "Caldas", dane: "17013" },
  { municipio: "Anserma", departamento: "Caldas", dane: "17042" },
  { municipio: "Aranzazu", departamento: "Caldas", dane: "17050" },
  { municipio: "Belalcázar", departamento: "Caldas", dane: "17088" },
  { municipio: "Chinchiná", departamento: "Caldas", dane: "17174" },
  { municipio: "Filadelfia", departamento: "Caldas", dane: "17272" },
  { municipio: "La Dorada", departamento: "Caldas", dane: "17380" },
  { municipio: "La Merced", departamento: "Caldas", dane: "17388" },
  { municipio: "Manzanares", departamento: "Caldas", dane: "17433" },
  { municipio: "Marmato", departamento: "Caldas", dane: "17442" },
  { municipio: "Marquetalia", departamento: "Caldas", dane: "17444" },
  { municipio: "Marulanda", departamento: "Caldas", dane: "17446" },
  { municipio: "Neira", departamento: "Caldas", dane: "17486" },
  { municipio: "Norcasia", departamento: "Caldas", dane: "17495" },
  { municipio: "Pácora", departamento: "Caldas", dane: "17513" },
  { municipio: "Palestina", departamento: "Caldas", dane: "17524" },
  { municipio: "Pensilvania", departamento: "Caldas", dane: "17541" },
  { municipio: "Riosucio", departamento: "Caldas", dane: "17614" },
  { municipio: "Risaralda", departamento: "Caldas", dane: "17616" },
  { municipio: "Salamina", departamento: "Caldas", dane: "17653" },
  { municipio: "Samaná", departamento: "Caldas", dane: "17662" },
  { municipio: "San José", departamento: "Caldas", dane: "17665" },
  { municipio: "Supía", departamento: "Caldas", dane: "17777" },
  { municipio: "Victoria", departamento: "Caldas", dane: "17867" },
  { municipio: "Villamaría", departamento: "Caldas", dane: "17873" },
  { municipio: "Viterbo", departamento: "Caldas", dane: "17877" },
].map((m) => Object.freeze(m)));

export const MUNICIPIO_POR_DEFECTO = "Manizales";
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const municipioPorNombre = (nombre) => MUNICIPIOS_CALDAS.find((m) => norm(m.municipio) === norm(nombre)) || null;
export const municipioPorDane = (dane) => MUNICIPIOS_CALDAS.find((m) => m.dane === String(dane || "")) || null;
/** Busca por parte del nombre (sin tildes ni mayúsculas) para el buscador del selector. */
export const buscarMunicipios = (texto) => { const t = norm(texto); return t ? MUNICIPIOS_CALDAS.filter((m) => norm(m.municipio).includes(t)) : [...MUNICIPIOS_CALDAS]; };
/** Si el municipio es de Caldas, su código DANE debe ser el del catálogo. Devuelve "" si es coherente (o si es de otro departamento). */
export function errorMunicipioDane(municipio, dane) {
  const m = municipioPorNombre(municipio);
  return m && String(dane || "") !== m.dane ? `El código DANE de ${m.municipio} es ${m.dane}. Elige el municipio de nuevo.` : "";
}

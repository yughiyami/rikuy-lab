/**
 * @rikuy/curriculum-cneb: CNEB subset (science and technology), literal quote checker, concept graph.
 * Docs: docs/ecosistema/ARQUITECTURA_ECOSISTEMA.md, 4.4 and 5.4 F9.
 */
export const packageName = '@rikuy/curriculum-cneb' as const;

export { AREA_CYT, extraerCyT, serializarSubconjunto } from './extraccion.ts';
export type { CompetenciaCyT, DocumentoFuente, EntradaFuente, GradoCyT, Nivel, SubconjuntoCyT } from './extraccion.ts';
export { subconjunto } from './datos.ts';
export { citaLiteral, desempenoTexto, LONGITUD_MINIMA_CITA, ubicarCita } from './cita.ts';
export type { UbicacionCita } from './cita.ts';
export { ARISTAS, CONCEPTOS, NIVELES_CONCEPTO, RELACIONES, SISTEMAS, conceptoPorId, conceptosMencionados, normalizarTexto, validarGrafo, vecinos } from './conceptos.ts';
export type { ConceptoArista, ConceptoNodo, GrafoConceptos, NivelConcepto, Relacion, Sistema } from './conceptos.ts';
export { corregirEnsayo, validarClaves, validarEnsayo } from './ensayo.ts';
export type { ClavesEnsayo, Ensayo, PreguntaEnsayo, ResultadoEnsayo } from './ensayo.ts';
export { PRACTICAS, SLUGS_PRACTICAS, practicaPorClave, slugDePractica, textosParaEstudiantes } from './practicas.ts';
export { citarFuente, construirIndice, corpusCneb, indiceCurricular, raiz, tokenizar } from './rag/index.ts';
export type { Fragmento, FuenteFragmento, IndiceCurricular, ResultadoBusqueda } from './rag/index.ts';

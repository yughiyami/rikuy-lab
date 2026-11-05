/**
 * Assessment item bank with provenance (pre/post checks, exhibit "Reto", teacher reports).
 * Every item says where it comes from and what its licence allows. Scoring is transparent
 * (correct % overall, per item, per capacity); no psychometric claim beyond the source, no ranking.
 */
import datos from '../../data/items-evaluacion.json';

export type TemaItem = 'pendulo' | 'lactasa' | 'respiratorio' | 'materiales';
export type Validacion = 'fuente-oficial' | 'practica-del-equipo';

export interface ItemEvaluacion {
  id: string;
  tema: TemaItem;
  tipo: 'opcion-multiple' | 'abierta';
  enunciado: string;
  opciones: { clave: string; texto: string }[] | null;
  respuestaCorrecta: string | null;
  rubrica: string | null;
  /** true: stem and options copied verbatim (licence allows it). false: short paraphrase plus link. */
  textoLiteral: boolean;
  requiereFigura: boolean;
  /** CNEB science and technology competency (1 Indaga, 2 Explica, 3 Diseña). */
  competencia: 1 | 2 | 3;
  capacidad: string;
  grado: number;
  fuente: { titulo: string; institucion: string; anio: number | null; url: string; pagina: number | null; codigoItem: string | null };
  licencia: { nombre: string; url: string | null; textoLiteral: string | null; permiteTextoCompleto: boolean };
  validacion: Validacion;
  nota?: string;
}

export const ETIQUETA_PRACTICA = 'Ítem de práctica elaborado por el equipo, no validado';

export const ITEMS: readonly ItemEvaluacion[] = datos as ItemEvaluacion[];

export function etiquetaProcedencia(item: ItemEvaluacion): string {
  if (item.validacion === 'practica-del-equipo') return ETIQUETA_PRACTICA;
  const modo = item.textoLiteral ? 'texto original' : 'paráfrasis con enlace a la fuente';
  const anio = item.fuente.anio ? `, ${item.fuente.anio}` : '';
  return `Validado: fuente oficial (${item.fuente.institucion}, ${item.fuente.titulo}${anio}; ${modo})`;
}

export function validarItem(item: ItemEvaluacion): string[] {
  const e: string[] = [];
  if (item.enunciado.trim() === '') e.push('enunciado vacío');
  if (item.validacion === 'fuente-oficial') {
    if (!item.fuente.url) e.push('falta la URL de la fuente');
    if (!item.licencia.nombre) e.push('falta la licencia');
  }
  if (item.textoLiteral && !item.licencia.permiteTextoCompleto) e.push('la licencia no permite texto literal');
  if (item.tipo === 'opcion-multiple' && item.respuestaCorrecta && item.opciones && !item.opciones.some((o) => o.clave === item.respuestaCorrecta)) {
    e.push('la clave no está entre las opciones');
  }
  return e;
}

/** Up to `limite` scorable multiple-choice items of a topic (pre/post check, exhibit Reto). */
export function itemsPorTema(tema: TemaItem, limite = 3): ItemEvaluacion[] {
  return ITEMS.filter((i) => i.tema === tema && i.tipo === 'opcion-multiple' && i.respuestaCorrecta !== null).slice(0, limite);
}

export interface Conteo {
  correctas: number;
  respondidas: number;
  porcentaje: number;
}
export interface ResultadoItems {
  total: Conteo;
  porItem: Record<string, Conteo>;
  porCapacidad: Record<string, Conteo>;
}

const conteo = (): Conteo => ({ correctas: 0, respondidas: 0, porcentaje: 0 });
function sumar(c: Conteo, ok: boolean): void {
  c.respondidas += 1;
  if (ok) c.correctas += 1;
  c.porcentaje = Math.round((100 * c.correctas) / c.respondidas);
}

/** Aggregates anonymous answers (no student id): item-level and capacity-level correct %. */
export function puntuar(items: readonly ItemEvaluacion[], respuestas: readonly { itemId: string; respuesta: string }[]): ResultadoItems {
  const r: ResultadoItems = { total: conteo(), porItem: {}, porCapacidad: {} };
  for (const { itemId, respuesta } of respuestas) {
    const item = items.find((i) => i.id === itemId);
    if (!item || item.respuestaCorrecta === null) continue;
    const ok = respuesta === item.respuestaCorrecta;
    sumar(r.total, ok);
    sumar((r.porItem[item.id] ??= conteo()), ok);
    sumar((r.porCapacidad[item.capacidad] ??= conteo()), ok);
  }
  return r;
}

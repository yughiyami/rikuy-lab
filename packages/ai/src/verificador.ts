/**
 * Deterministic verifier of a practice draft (4.4). It always runs first, and it fails closed:
 * if it cannot run or cannot find the official text, the draft cannot be approved.
 */
import type { DesempenoRef } from '@rikuy/contracts';
import type { BorradorPractica } from './esquemas.ts';
import { contarPalabras, contieneFrase, extraerNumeros, normalizar, oraciones, palabrasClave, tieneDatosPersonales } from './texto.ts';

export type ReglaVerificacion =
  | 'desempeno_inexistente'
  | 'cita_literal'
  | 'pista_revela'
  | 'quiz_invalido'
  | 'quiz_revela'
  | 'vocabulario_afectivo'
  | 'material_inseguro'
  | 'limitaciones'
  | 'nivel_lectura'
  | 'datos_personales'
  | 'svg_inseguro'
  | 'variables'
  | 'cneb_sin_fundamento';

export interface Hallazgo {
  regla: ReglaVerificacion;
  mensaje: string;
  ruta?: string;
}
export interface ResultadoVerificacion {
  ok: boolean;
  hallazgos: Hallazgo[];
}
export interface ContextoVerificacion {
  /** The requested performance (grade, competency and number). */
  desempeno: Pick<DesempenoRef, 'nivel' | 'grado' | 'competencia' | 'desempeno'>;
  /** Official text of a performance, or undefined when it is unknown. */
  textoOficial(ref: Pick<DesempenoRef, 'nivel' | 'grado' | 'competencia' | 'desempeno'>): string | undefined;
  /**
   * Retrieved CNEB chunks (RAG). When present, the quote must also be literally inside one of them:
   * a CNEB claim that retrieval did not surface is rejected as ungrounded.
   */
  recuperados?: readonly { texto: string }[];
}

const LARGO_MINIMO_CITA = 20;

/** The quote must be an EXACT substring of the official text (like `indexOf` in supermentes). */
export function citaLiteral(cita: string, textoOficial: string): boolean {
  return cita.length >= LARGO_MINIMO_CITA && textoOficial.indexOf(cita) !== -1;
}

/** Stems of affective words about a person. Matched on normalized words (prefix). */
const RAICES_AFECTIVAS = [
  'frustr', 'aburr', 'ansios', 'ansied', 'trist', 'nervios', 'enojad', 'enfad', 'miedo', 'asustad', 'estres',
  'deprim', 'desanim', 'preocupad', 'angusti', 'desmotiv', 'avergonz', 'emocion', 'feliz', 'contento', 'alegr',
  'molest', 'cansad', 'agobi', 'inseguro', 'inseguridad', 'frustracion',
];
const FRASES_AFECTIVAS = ['te sientes', 'se siente', 'se sienten', 'te sentiste', 'como te sientes', 'te da miedo', 'te preocupa'];

function tieneVocabularioAfectivo(texto: string): boolean {
  const n = normalizar(texto);
  if (FRASES_AFECTIVAS.some((f) => contieneFrase(texto, f))) return true;
  return n.split(' ').some((p) => RAICES_AFECTIVAS.some((r) => p.startsWith(r)));
}

const PATRONES_INSEGUROS = [
  /fuego/, /llama abierta/, /\bvela\b/, /encendid/, /mechero/, /encendedor/, /fosforo/, /\bacido/, /lejia/, /soda caustica/,
  /electricidad/, /enchufe/, /tomacorriente/, /\b220 ?v\b/, /\b110 ?v\b/, /corriente de la red/, /\bhervir/, /\bcuchilla/,
];
function esMaterialInseguro(texto: string): boolean {
  const n = normalizar(texto);
  return PATRONES_INSEGUROS.some((p) => p.test(n));
}

/** Max words per sentence by school stage; a safety net, not a readability index. */
function limiteOracion(ref: ContextoVerificacion['desempeno']): number {
  if (ref.nivel === 'secundaria') return 28;
  if (ref.grado <= 2) return 14;
  if (ref.grado <= 4) return 18;
  return 22;
}

/** A number in a text "is" the result when it equals a result value or its rounding to 1 or 2 decimals. */
function coincideConResultado(n: number, valores: number[]): boolean {
  return valores.some((v) => {
    if (Math.abs(n - v) <= Math.max(0.005, Math.abs(v) * 0.005)) return true;
    if (Math.round(v * 10) / 10 === n || Math.round(v * 100) / 100 === n) return true;
    return Math.abs(v) >= 10 && Math.round(v) === n;
  });
}

function revelaConclusion(texto: string, conclusion: string): boolean {
  if (contieneFrase(texto, conclusion)) return true;
  const claves = palabrasClave(conclusion);
  if (claves.length < 3) return false;
  const presentes = new Set(palabrasClave(texto));
  const comunes = claves.filter((c) => presentes.has(c)).length;
  return comunes >= 3 && comunes / claves.length >= 0.6;
}

function svgSeguro(svg: string): boolean {
  const s = svg.trim();
  if (!/^<svg[\s>]/i.test(s) || !/viewBox\s*=/.test(s)) return false;
  if (/<script|<foreignObject|<iframe|<object|<embed/i.test(s)) return false;
  if (/\bon[a-z]+\s*=/i.test(s)) return false;
  if (/javascript:/i.test(s)) return false;
  if (/(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:)/i.test(s)) return false;
  if (/url\(\s*["']?\s*(?:https?:|\/\/)/i.test(s) || /@import/i.test(s)) return false;
  return true;
}

export function verificarBorrador(b: BorradorPractica, ctx: ContextoVerificacion): ResultadoVerificacion {
  const h: Hallazgo[] = [];
  const falla = (regla: ReglaVerificacion, mensaje: string, ruta?: string) => h.push({ regla, mensaje, ...(ruta ? { ruta } : {}) });

  // 1. Exact quote of the declared performance.
  const oficial = ctx.textoOficial(ctx.desempeno);
  if (oficial === undefined) {
    falla('desempeno_inexistente', 'No se encontró el texto oficial del desempeño; no se puede verificar la cita.', 'citaDesempeno');
  } else if (!citaLiteral(b.citaDesempeno, oficial)) {
    falla('cita_literal', 'La cita no es una subcadena exacta del desempeño oficial.', 'citaDesempeno');
  }
  if (ctx.recuperados && !ctx.recuperados.some((f) => citaLiteral(b.citaDesempeno, f.texto))) {
    falla('cneb_sin_fundamento', 'La cita del CNEB no aparece en ningún fragmento recuperado del currículo.', 'citaDesempeno');
  }

  const { valores, conclusion, frasesProhibidas } = b.resultadoEsperado;
  const revelaTexto = (texto: string): string | undefined => {
    if (extraerNumeros(texto).some((n) => coincideConResultado(n, valores))) return 'contiene el resultado numérico';
    if (revelaConclusion(texto, conclusion)) return 'enuncia la conclusión esperada';
    const prohibida = (frasesProhibidas ?? []).find((f) => contieneFrase(texto, f));
    if (prohibida) return 'contiene una frase prohibida';
    return undefined;
  };

  // 2. Hints must not reveal the result.
  b.pistas.forEach((pista, i) => {
    const motivo = revelaTexto(pista);
    if (motivo) falla('pista_revela', `La pista ${i + 1} ${motivo}.`, `pistas.${i}`);
  });

  // 3. Quiz: well-formed and not revealing.
  (b.quiz ?? []).forEach((p, i) => {
    const ruta = `quiz.${i}`;
    const unicas = new Set(p.opciones.map(normalizar));
    if (p.correcta < 0 || p.correcta >= p.opciones.length || unicas.size !== p.opciones.length) {
      falla('quiz_invalido', `La pregunta ${i + 1} tiene un índice de respuesta fuera de rango u opciones repetidas.`, ruta);
      return;
    }
    const correcta = p.opciones[p.correcta]!;
    if (contieneFrase(p.enunciado, correcta)) {
      falla('quiz_revela', `El enunciado de la pregunta ${i + 1} contiene la opción correcta.`, `${ruta}.enunciado`);
      return;
    }
    const motivo = revelaTexto(p.enunciado);
    if (motivo) falla('quiz_revela', `El enunciado de la pregunta ${i + 1} ${motivo}.`, `${ruta}.enunciado`);
  });

  // 4. Every piece of text meant for students, and the teacher-only ones too.
  const textos: Array<[string, string]> = [
    ['titulo', b.titulo],
    ['preguntaGuia', b.preguntaGuia],
    ...b.pistas.map((t, i): [string, string] => [`pistas.${i}`, t]),
    ...b.limitaciones.map((t, i): [string, string] => [`limitaciones.${i}`, t]),
    ...b.materiales.map((m, i): [string, string] => [`materiales.${i}`, m.nombre]),
    ...(b.quiz ?? []).flatMap((p, i): Array<[string, string]> => [
      [`quiz.${i}.enunciado`, p.enunciado],
      ...p.opciones.map((o, j): [string, string] => [`quiz.${i}.opciones.${j}`, o]),
      ...p.retro.map((r, j): [string, string] => [`quiz.${i}.retro.${j}`, r]),
    ]),
    ...(b.guionVideo ?? []).map((t, i): [string, string] => [`guionVideo.${i}`, t]),
    ...Object.entries(b.diagrama?.etiquetas ?? {}).map(([k, t]): [string, string] => [`diagrama.etiquetas.${k}`, t]),
    ...(b.pictogramas ?? []).map((p, i): [string, string] => [`pictogramas.${i}`, p.descripcion]),
  ];
  for (const [ruta, texto] of textos) {
    if (tieneVocabularioAfectivo(texto)) falla('vocabulario_afectivo', 'Contiene vocabulario afectivo sobre el alumno.', ruta);
    if (tieneDatosPersonales(texto)) falla('datos_personales', 'Contiene datos personales (teléfono, correo, DNI o un nombre).', ruta);
  }

  // 5. Safe materials.
  b.materiales.forEach((m, i) => {
    if (esMaterialInseguro(m.nombre)) falla('material_inseguro', `Material no permitido: ${m.nombre}.`, `materiales.${i}`);
  });
  if ([b.preguntaGuia, ...b.pistas].some(esMaterialInseguro)) {
    falla('material_inseguro', 'El texto menciona fuego abierto, ácidos o electricidad de red.', 'pistas');
  }

  // 6. Limitations present.
  if (!b.limitaciones.some((l) => l.trim().length >= 10)) {
    falla('limitaciones', 'Falta al menos una limitación del modelo (mínimo 10 caracteres).', 'limitaciones');
  }

  // 7. Reading level.
  const tope = limiteOracion(ctx.desempeno);
  const largas = [b.preguntaGuia, ...b.pistas, ...(b.quiz ?? []).map((p) => p.enunciado)].flatMap(oraciones).filter((o) => contarPalabras(o) > tope);
  if (largas.length > 0) falla('nivel_lectura', `Hay ${largas.length} oración(es) de más de ${tope} palabras.`, 'preguntaGuia');

  // 8. Diagram is safe SVG.
  if (b.diagrama && !svgSeguro(b.diagrama.svg)) {
    falla('svg_inseguro', 'El SVG no es seguro (scripts, eventos, recursos externos) o no tiene viewBox.', 'diagrama.svg');
  }

  // 9. Variables are coherent.
  b.variables.forEach((v, i) => {
    if (!(v.min < v.max) || v.paso <= 0 || v.porDefecto < v.min || v.porDefecto > v.max) {
      falla('variables', `La variable ${v.id} tiene un rango incoherente.`, `variables.${i}`);
    }
  });

  return { ok: h.length === 0, hallazgos: h };
}

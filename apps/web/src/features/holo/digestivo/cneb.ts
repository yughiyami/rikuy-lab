/**
 * CNEB linkage of the digestive hologram (Ciencia y Tecnología, secundaria) and the hook the plan
 * feature uses to open it from a teacher's topic: `rutaParaTema()` / `abrirEscenaPorTema()`.
 *
 * Only ids are stored here (grade, competency, capacity and performance numbers of the official
 * subset in @rikuy/curriculum-cneb); the literal text is always read from that subset, never
 * paraphrased or invented.
 */
import { conceptosMencionados, desempenoTexto, normalizarTexto, subconjunto } from '@rikuy/curriculum-cneb';

export interface RefCneb {
  nivel: 'secundaria';
  grado: number;
  /** 1 = Indaga…, 2 = Explica el mundo físico… */
  competencia: 1 | 2;
  /** 1-based index into the competency's `capacidades`. */
  capacidad: number;
  /** 1-based index into the competency's `desempenos`. */
  desempeno: number;
}

/** Competency id as in the subset: `secundaria-2:cyt:c2`. */
export const idCompetencia = (r: RefCneb) => `${r.nivel}-${r.grado}:cyt:c${r.competencia}`;

const EXPLICA_NUTRICION: RefCneb = { nivel: 'secundaria', grado: 2, competencia: 2, capacidad: 1, desempeno: 8 };
const EXPLICA_BIOMOLECULAS: RefCneb = { nivel: 'secundaria', grado: 1, competencia: 2, capacidad: 1, desempeno: 5 };
const INDAGA_HIPOTESIS: RefCneb = { nivel: 'secundaria', grado: 2, competencia: 1, capacidad: 1, desempeno: 1 };
const INDAGA_CONTRASTA: RefCneb = { nivel: 'secundaria', grado: 2, competencia: 1, capacidad: 4, desempeno: 4 };

/** Scene metadata: each semantic level -> the CNEB performances it serves. */
export const CNEB_DIGESTIVO: Readonly<Record<0 | 1 | 2 | 3, readonly RefCneb[]>> = {
  0: [EXPLICA_NUTRICION, INDAGA_HIPOTESIS],
  1: [EXPLICA_NUTRICION],
  2: [EXPLICA_BIOMOLECULAS, INDAGA_HIPOTESIS, INDAGA_CONTRASTA],
  3: [EXPLICA_BIOMOLECULAS, INDAGA_CONTRASTA],
};

/** Official texts of a reference (undefined if the id does not exist in the subset). */
export function textoCneb(r: RefCneb): { competencia: string; capacidad: string; desempeno: string } | undefined {
  const g = subconjunto.grados.find((x) => x.nivel === r.nivel && x.grado === r.grado);
  const c = g?.competencias.find((x) => x.numero === r.competencia);
  const capacidad = c?.capacidades[r.capacidad - 1];
  const desempeno = desempenoTexto(r.nivel, r.grado, r.competencia, r.desempeno);
  if (!c || !capacidad || !desempeno) return undefined;
  return { competencia: c.nombre, capacidad, desempeno };
}

/** Level of the digestive journey that best shows each concept of the concept graph. */
const NIVEL_DE_CONCEPTO: Record<string, 0 | 1 | 2 | 3> = {
  sistema_digestivo: 0,
  higado: 0,
  intolerancia_lactosa: 2,
  intestino_delgado: 1,
  vellosidad: 2,
  enterocito: 2,
  lactasa: 3,
  lactosa: 3,
};

const PALABRAS_EXTRA: [RegExp, 0 | 1 | 2 | 3][] = [
  [/\b(estomago|esofago|boca|pancreas|nutricion|alimento|aparato digestivo)\b/, 0],
  [/\b(absorcion|pared intestinal|pliegue)\b/, 1],
  [/\b(microvellosidad\w*|celula\w*)\b/, 2],
  [/\b(biomolecula\w*|proteina\w*|carbohidrato\w*|glucosa|galactosa|desnaturaliza\w*)\b/, 3],
];

export interface DestinoTema {
  escena: 'digestivo';
  nivel: 0 | 1 | 2 | 3;
  ruta: string;
}

const destino = (nivel: 0 | 1 | 2 | 3): DestinoTema => ({ escena: 'digestivo', nivel, ruta: `/holo/ver/digestivo?nivel=${nivel}` });

/**
 * Plan item / topic -> where to open the hologram. Accepts a CNEB reference of this scene
 * (`secundaria-2:cyt:c2` with a performance number, or `secundaria-2:cyt:c2:d8`) or the topic text
 * of the teacher's document ("La digestión de la leche", "enzimas", "intolerancia a la lactosa").
 * Returns null when the topic is not about this scene.
 */
export function rutaParaTema(tema: string | { competenciaId: string; desempeno?: number }): DestinoTema | null {
  const ref = typeof tema === 'string' ? /^(secundaria-\d):cyt:c(\d)(?::d(\d+))?$/.exec(tema.trim()) : null;
  const id = typeof tema === 'string' ? (ref ? `${ref[1]}:cyt:c${ref[2]}` : null) : tema.competenciaId;
  const d = typeof tema === 'string' ? (ref?.[3] ? Number(ref[3]) : undefined) : tema.desempeno;
  if (id) {
    for (const n of [0, 1, 2, 3] as const) {
      if (CNEB_DIGESTIVO[n].some((r) => idCompetencia(r) === id && (d === undefined || r.desempeno === d) && r.competencia === 2)) return destino(n);
    }
    if (typeof tema !== 'string' || ref) return null;
  }
  const texto = typeof tema === 'string' ? tema : '';
  const niveles = conceptosMencionados(texto).flatMap((c) => (c.id in NIVEL_DE_CONCEPTO ? [NIVEL_DE_CONCEPTO[c.id]] : []));
  const normal = normalizarTexto(texto);
  for (const [re, n] of PALABRAS_EXTRA) if (re.test(normal)) niveles.push(n);
  if (niveles.length === 0) return null;
  // The deepest level named wins: "lactasa en el intestino" opens at the molecule.
  return destino(Math.max(...niveles) as 0 | 1 | 2 | 3);
}

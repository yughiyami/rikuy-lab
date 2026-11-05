/**
 * Pure logic of the "digestivo" hologram (no Three.js): semantic zoom levels, the journey of a
 * glass of milk through the tract, and what happens to lactose with and without lactase.
 */

export interface NivelDigestivo {
  n: 0 | 1 | 2 | 3;
  clave: 'tracto' | 'pared' | 'vellosidad' | 'molecula';
  nombre: string;
}

export const NIVELES: readonly NivelDigestivo[] = [
  { n: 0, clave: 'tracto', nombre: 'Tubo digestivo' },
  { n: 1, clave: 'pared', nombre: 'Pared del intestino delgado' },
  { n: 2, clave: 'vellosidad', nombre: 'Vellosidades y microvellosidades' },
  { n: 3, clave: 'molecula', nombre: 'Lactasa y lactosa' },
];

export const NIVEL_MAX = NIVELES.length - 1;

export function nivelValido(v: number | undefined): 0 | 1 | 2 | 3 {
  if (v === undefined || !Number.isFinite(v)) return 0;
  return Math.min(NIVEL_MAX, Math.max(0, Math.round(v))) as 0 | 1 | 2 | 3;
}

/** Pinch zoom past these targets dives one level deeper (or goes back one level). */
export const ZOOM_PROFUNDIZAR = 1.9;
export const ZOOM_VOLVER = 0.6;

/**
 * Semantic zoom: the continuous zoom of touch, wheel and the pinch gesture turns into level
 * changes at the edges. Returns the new level and whether the view zoom must snap back to 1.
 */
export function zoomSemantico(nivel: number, zoomObjetivo: number): { nivel: 0 | 1 | 2 | 3; reiniciarZoom: boolean } {
  const actual = nivelValido(nivel);
  if (zoomObjetivo >= ZOOM_PROFUNDIZAR && actual < NIVEL_MAX) return { nivel: (actual + 1) as 0 | 1 | 2 | 3, reiniciarZoom: true };
  if (zoomObjetivo <= ZOOM_VOLVER && actual > 0) return { nivel: (actual - 1) as 0 | 1 | 2 | 3, reiniciarZoom: true };
  return { nivel: actual, reiniciarZoom: false };
}

export type Organo = 'boca' | 'esofago' | 'estomago' | 'intestino_delgado' | 'intestino_grueso';

/** Stretch of the journey (0..1) spent in each organ, in order. */
export const TRAMOS: readonly { organo: Organo; desde: number; hasta: number }[] = [
  { organo: 'boca', desde: 0, hasta: 0.06 },
  { organo: 'esofago', desde: 0.06, hasta: 0.16 },
  { organo: 'estomago', desde: 0.16, hasta: 0.3 },
  { organo: 'intestino_delgado', desde: 0.3, hasta: 0.72 },
  { organo: 'intestino_grueso', desde: 0.72, hasta: 1 },
];

export function organoEn(s: number): Organo {
  const t = Math.min(1, Math.max(0, s));
  return (TRAMOS.find((x) => t < x.hasta) ?? TRAMOS[TRAMOS.length - 1]).organo;
}

export interface FaseLactosa {
  organo: Organo;
  /** Fraction of the lactose of the glass still undigested (1 = all of it). */
  lactosa: number;
  /** Glucose + galactose absorbed into the blood (0..1). */
  absorbido: number;
  /** Gas produced by bacterial fermentation in the large intestine (0..1). */
  gas: number;
}

/**
 * Causal story the students predict before it is revealed: lactase in the brush border of the
 * small intestine splits lactose and the sugars are absorbed. Without it, lactose reaches the
 * large intestine and bacteria ferment it (gas, discomfort).
 */
export function faseLactosa(s: number, conLactasa: boolean): FaseLactosa {
  const t = Math.min(1, Math.max(0, s));
  const organo = organoEn(t);
  const delgado = TRAMOS[3];
  const grueso = TRAMOS[4];
  const enDelgado = Math.min(1, Math.max(0, (t - delgado.desde) / (delgado.hasta - delgado.desde)));
  const enGrueso = Math.min(1, Math.max(0, (t - grueso.desde) / (grueso.hasta - grueso.desde)));
  if (conLactasa) {
    const digerido = smooth(enDelgado);
    return { organo, lactosa: 1 - digerido, absorbido: digerido, gas: 0 };
  }
  return { organo, lactosa: 1 - 0.9 * smooth(enGrueso), absorbido: 0, gas: smooth(enGrueso) };
}

function smooth(x: number): number {
  return x * x * (3 - 2 * x);
}

/** Ease used by camera dives between levels. */
export function suavizar(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

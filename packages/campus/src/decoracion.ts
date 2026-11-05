/**
 * Hall props and decor (pure): where plants, benches, shelves, rugs and wall hangings go in each
 * template, themed by the hall's science area. Floor pieces with `bloquea` join the collision grid so
 * groups walk around them; wall pieces sit on wall tiles and rugs lie under everyone.
 * The renderer (`canvas/`) decides how each `pieza` looks (Kenney CC0 sprites or own pixel art).
 */
import type { Rect } from './grilla.ts';

export type PiezaDecor =
  // Kenney "Roguelike Indoor" (CC0)
  | 'planta'
  | 'planta-alta'
  | 'banco'
  | 'taburete'
  | 'vasija'
  | 'idolo'
  | 'estante'
  | 'cuadro'
  | 'tapiz'
  // own pixel art (Andean and science details)
  | 'alfombra'
  | 'quipu'
  | 'pendulo'
  | 'microscopio'
  | 'matraz'
  | 'roca'
  | 'yunque'
  | 'ceramica'
  | 'pizarra';

export interface Decor extends Rect {
  pieza: PiezaDecor;
  /** Blocks walking (floor props). */
  bloquea: boolean;
  /** Hangs on a wall tile (drawn over the wall face, never blocks). */
  pared?: boolean;
  /** Variant index (painting, tapestry or rug colours). */
  variante?: number;
}

const piso = (pieza: PiezaDecor, x: number, y: number, ancho = 1, alto = 1, variante = 0): Decor => ({
  pieza,
  x,
  y,
  ancho,
  alto,
  bloquea: true,
  variante,
});
const pared = (pieza: PiezaDecor, x: number, y: number, ancho = 1, variante = 0): Decor => ({
  pieza,
  x,
  y,
  ancho,
  alto: 1,
  bloquea: false,
  pared: true,
  variante,
});
const alfombra = (x: number, y: number, ancho: number, alto: number, variante = 0): Decor => ({
  pieza: 'alfombra',
  x,
  y,
  ancho,
  alto,
  bloquea: false,
  variante,
});

/** Signature object of each science hall (own pixel art). */
const TEMA: Record<string, PiezaDecor> = {
  'sala-fisica': 'pendulo',
  'sala-biologia': 'microscopio',
  'sala-quimica': 'matraz',
  'sala-tierra': 'roca',
  'sala-taller': 'yunque',
};

function vestibulo(): Decor[] {
  return [
    alfombra(4, 16, 6, 3, 1),
    alfombra(20, 16, 6, 3, 2),
    alfombra(4, 3, 6, 3, 3),
    alfombra(20, 3, 6, 3, 0),
    pared('tapiz', 12, 0, 3, 0),
    pared('tapiz', 15, 0, 3, 1),
    pared('quipu', 1, 0),
    pared('quipu', 28, 0),
    pared('cuadro', 6, 0, 1, 0),
    pared('cuadro', 7, 0, 1, 1),
    pared('cuadro', 22, 0, 1, 2),
    pared('cuadro', 23, 0, 1, 3),
    piso('planta-alta', 2, 1),
    piso('planta-alta', 11, 1),
    piso('planta-alta', 18, 1),
    piso('planta-alta', 27, 1),
    piso('planta', 1, 20),
    piso('planta', 28, 20),
    piso('planta', 12, 20),
    piso('planta', 17, 20),
    piso('banco', 4, 7, 4, 1),
    piso('banco', 22, 7, 4, 1),
    piso('banco', 4, 14, 4, 1),
    piso('banco', 22, 14, 4, 1),
    piso('idolo', 6, 4),
    piso('vasija', 23, 4),
    piso('ceramica', 6, 17),
    piso('vasija', 23, 17),
  ];
}

function salaTematica(salaId: string): Decor[] {
  const tema = TEMA[salaId] ?? 'ceramica';
  const tinte = Math.max(0, Object.keys(TEMA).indexOf(salaId));
  return [
    alfombra(6, 9, 3, 3, tinte),
    alfombra(11, 9, 3, 2, tinte + 1),
    pared('cuadro', 2, 0, 1, tinte),
    pared('quipu', 6, 0),
    pared('tapiz', 9, 0, 3, tinte % 3),
    pared('quipu', 13, 0),
    pared('cuadro', 17, 0, 1, tinte + 1),
    pared('tapiz', 3, 6, 3, (tinte + 1) % 3),
    pared('pizarra', 14, 6, 2),
    piso('planta-alta', 1, 1),
    piso('planta-alta', 18, 1),
    piso('vasija', 1, 5),
    piso('idolo', 18, 5),
    piso('planta', 1, 7),
    piso('planta', 18, 7),
    piso('estante', 2, 7),
    piso(tema, 4, 7),
    piso('banco', 13, 7, 4, 1),
    piso(tema, 17, 12),
    piso('planta', 1, 12),
    piso('taburete', 6, 12),
  ];
}

function patio(): Decor[] {
  return [
    alfombra(8, 6, 4, 2, 2),
    piso('planta-alta', 1, 1),
    piso('planta-alta', 18, 1),
    piso('planta', 1, 12),
    piso('planta', 18, 12),
    piso('planta', 9, 1),
    piso('planta', 10, 1),
    piso('taburete', 6, 11),
    piso('taburete', 13, 11),
  ];
}

function auditorio(): Decor[] {
  return [
    pared('tapiz', 4, 0, 3, 0),
    pared('tapiz', 13, 0, 3, 1),
    pared('quipu', 9, 0),
    pared('quipu', 10, 0),
    piso('planta-alta', 1, 1),
    piso('planta-alta', 18, 1),
    piso('banco', 4, 6, 4, 1),
    piso('banco', 12, 6, 4, 1),
    piso('banco', 4, 8, 4, 1),
    piso('banco', 12, 8, 4, 1),
    piso('planta', 1, 12),
    piso('planta', 18, 12),
  ];
}

/** Decor of one scene. `plantilla` is the Tiled template name (`vestibulo` for the vestibule). */
export function decoracionDe(escenaId: string, plantilla: string): Decor[] {
  switch (plantilla) {
    case 'vestibulo':
      return vestibulo();
    case 'sala-tematica':
      return salaTematica(escenaId);
    case 'patio':
      return patio();
    case 'auditorio':
      return auditorio();
    default:
      return [];
  }
}

/** Tiles blocked by floor props, for the collision grid. */
export function bloqueosDecor(decor: readonly Decor[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const d of decor) {
    if (!d.bloquea) continue;
    for (let y = d.y; y < d.y + d.alto; y++) for (let x = d.x; x < d.x + d.ancho; x++) out.push({ x, y });
  }
  return out;
}

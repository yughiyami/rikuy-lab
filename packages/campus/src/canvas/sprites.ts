/**
 * Pixel-art data and pure helpers for the world renderer (no DOM here, so it is testable in Node).
 * - Kenney "Roguelike Indoor" (CC0, www.kenney.nl): 16x16 tiles with a 1 px margin; `KENNEY` names the
 *   cells we use. The sheet is served from `apps/web/public/arte/kenney/roguelike-indoor/`.
 * - Characters, Rikuy and the Andean/science props are own pixel art (16 px grid), drawn from the
 *   strings below, recoloured per group.
 */

export const PX = 16;
const MARGEN = 1;

export type PiezaKenney = 'planta' | 'planta-alta' | 'banco' | 'taburete' | 'vasija' | 'idolo' | 'estante' | 'cuadro' | 'tapiz';

/** Cells (column, row) of each piece; multi-tile pieces list their cells row-major in `celdas`. */
export const KENNEY: Record<PiezaKenney, { ancho: number; alto: number; variantes: [number, number][][] }> = {
  planta: { ancho: 1, alto: 1, variantes: [[[17, 0]]] },
  'planta-alta': { ancho: 1, alto: 1, variantes: [[[16, 0]]] },
  banco: { ancho: 4, alto: 1, variantes: [[[4, 6], [5, 6], [6, 6], [7, 6]]] },
  taburete: { ancho: 1, alto: 1, variantes: [[[17, 3]]] },
  vasija: { ancho: 1, alto: 1, variantes: [[[16, 4]]] },
  idolo: { ancho: 1, alto: 1, variantes: [[[18, 4]]] },
  estante: { ancho: 1, alto: 1, variantes: [[[21, 17]], [[20, 17]]] },
  cuadro: { ancho: 1, alto: 1, variantes: [[[19, 15]], [[20, 15]], [[21, 15]], [[19, 13]], [[19, 12]], [[19, 14]]] },
  tapiz: {
    ancho: 3,
    alto: 1,
    variantes: [
      [[16, 14], [17, 14], [18, 14]],
      [[16, 15], [17, 15], [18, 15]],
      [[16, 16], [17, 16], [18, 16]],
    ],
  },
};

export function esPiezaKenney(p: string): p is PiezaKenney {
  return Object.hasOwn(KENNEY, p);
}

/** Source rectangle of one sheet cell. */
export function celdaKenney(col: number, fila: number): { sx: number; sy: number; sw: number; sh: number } {
  return { sx: col * (PX + MARGEN), sy: fila * (PX + MARGEN), sw: PX, sh: PX };
}

/** Cells of a piece for a variant (wraps around). */
export function celdasDe(p: PiezaKenney, variante = 0): [number, number][] {
  const v = KENNEY[p].variantes;
  return v[((variante % v.length) + v.length) % v.length]!;
}

// ---------------------------------------------------------------- characters (own art, 16x20)

/**
 * Palette keys: o outline, h hair, s skin, r cheek, e eye, c shirt (group colour), d shirt shade,
 * p trousers, b shoes, k hat (curator chullo), w hat stripe. '.' is transparent.
 */
const CABEZA_FRENTE = [
  '................',
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohsssssssho...'.slice(0, 13) + 'o..',
  '..ossessssesso..',
  '..ossessssesso..',
  '..osrssssssrso..',
  '...osssssssso...',
];
const CABEZA_ESPALDA = [
  '................',
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '...ohhhhhhhho...',
];
const CABEZA_LADO = [
  '................',
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhsssssso..',
  '..ohhhssssseso..',
  '..ohhhssssseso..',
  '..ohhhssssssro..',
  '...ohhsssssso...',
];
const TORSO_FRENTE = [
  '...occccccccco..'.slice(0, 3) + 'occcccccco' + '...',
  '..occccccccccco.'.slice(0, 2) + 'occcccccccco' + '..',
  '..occccccccccco.'.slice(0, 2) + 'ocdccccccdco' + '..',
  '..osddddddddso..',
  '...opppppppppo..'.slice(0, 3) + 'oppppppppo' + '...',
];
const TORSO_LADO = [
  '....occccccco...'.slice(0, 4) + 'occccccco' + '...',
  '...occccccccco..'.slice(0, 3) + 'occcccccco' + '...',
  '...occccccccco..'.slice(0, 3) + 'occcdcccco' + '...',
  '...occccsdddco..'.slice(0, 3) + 'odddsdddo' + '....',
  '....oppppppppo..'.slice(0, 4) + 'opppppppo' + '...',
];
const PIERNAS_FRENTE = [
  ['...opppoopppo...', '...obbboobbbo...', '....ooo..ooo....'],
  ['...obbboopppo...', '....ooo.obbbo...', '.........ooo....'],
  ['...opppoobbbo...', '...obbbo.ooo....', '....ooo.........'],
];
const PIERNAS_LADO = [
  ['.....opppppo....', '.....obbbbbo....', '......ooooo.....'],
  ['....oppo.oppo...', '...obbo...obbo..', '....oo.....oo...'],
  ['.....opppppo....', '.....obbbbbo....', '......ooooo.....'],
];

export type Orientacion = 'frente' | 'espalda' | 'lado';
export const ALTO_PERSONAJE = 20;

/** Sprite rows (16 wide, 20 tall) for an orientation and walk pose (0 stand, 1 and 2 stride). */
export function filasPersonaje(o: Orientacion, pose: number): string[] {
  const cabeza = o === 'frente' ? CABEZA_FRENTE : o === 'espalda' ? CABEZA_ESPALDA : CABEZA_LADO;
  const torso = o === 'lado' ? TORSO_LADO : TORSO_FRENTE;
  const piernas = (o === 'lado' ? PIERNAS_LADO : PIERNAS_FRENTE)[pose % 3]!;
  return [...cabeza, ...torso, ...piernas, '................', '................'];
}

/** Realtime `dir` (0 east, 2 south, 4 west, 6 north) to sprite orientation and mirroring. */
export function orientacionDe(dir: number): { o: Orientacion; espejo: boolean } {
  const d = ((Math.round(dir) % 8) + 8) % 8;
  if (d === 0 || d === 1 || d === 7) return { o: 'lado', espejo: false };
  if (d === 3 || d === 4 || d === 5) return { o: 'lado', espejo: true };
  if (d === 6) return { o: 'espalda', espejo: false };
  return { o: 'frente', espejo: false };
}

/** Walk cycle pose at time `t` (s): 0 when idle, else 1, 0, 2, 0 at 8 steps per second. */
export function poseCaminata(t: number, moviendo: boolean): number {
  if (!moviendo) return 0;
  const paso = Math.floor(t * 8) % 4;
  return paso === 1 ? 1 : paso === 3 ? 2 : 0;
}

/** Vertical bob in sprite pixels: a breathing bob when idle, a step bounce when walking. */
export function rebote(t: number, moviendo: boolean, reducido: boolean): number {
  if (reducido) return 0;
  if (moviendo) return Math.floor(t * 8) % 2 === 0 ? 0 : -1;
  return Math.floor(t * 1.6) % 2 === 0 ? 0 : -1;
}

/** Rikuy blinks for ~0.15 s every ~3.6 s (never under reduced motion). */
export function parpadea(t: number, reducido: boolean): boolean {
  if (reducido) return false;
  return t % 3.6 > 3.45;
}

const PELOS = ['#2B1B14', '#3B2417', '#1C1A1F', '#5A3A22', '#14110F'];
const PIELES = ['#C98E66', '#B47A52', '#D9A57E', '#A86B45', '#E0B48F'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Stable hair and skin per avatar id (variety across groups, same look on every device). */
export function rasgosDe(id: string): { pelo: string; piel: string } {
  const h = hash(id);
  return { pelo: PELOS[h % PELOS.length]!, piel: PIELES[(h >>> 8) % PIELES.length]! };
}

/** Darkens (f < 1) or lightens (f > 1) a #RRGGBB colour; other strings pass through. */
export function sombrear(color: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1]!, 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Device pixels per art pixel, snapped so pixel art stays crisp: half steps rounded down with `floor` (keeps the
 * whole hall inside the stage), or to the nearest half step with `round` (camera-follow views).
 */
export function escalaPixel(tileDispositivo: number, modo: 'floor' | 'round' = 'round'): number {
  const s = tileDispositivo / PX;
  if (!Number.isFinite(s) || s <= 0) return 1;
  if (s < 1.5) return Math.max(0.5, Math.round(s * 4) / 4);
  return Math.max(1, modo === 'floor' ? Math.floor(s * 2) / 2 : Math.round(s * 2) / 2);
}

// ---------------------------------------------------------------- Rikuy (own art, 12x11)

const RIKUY = [
  '...oooooo...',
  '..oSlSSSSo..',
  '.oSlSSSSSSo.',
  'oSSwwwwwwSSo',
  'oSwwwiiwwwSo',
  'oSwwiiIiwwSo',
  'oSwwwiiwwwSo',
  'oSSwwwwwwSSo',
  '.oSSSSSSSDo.',
  '..oDSSSSDo..',
  '...oooooo...',
];
const RIKUY_OJO_CERRADO = ['oSSSSSSSSSSo', 'oSSSSSSSSSSo', 'oSoooooooSSo'.slice(0, 2) + 'oooooooo' + 'So', 'oSSSSSSSSSSo', 'oSSSSSSSSSSo'];

export function filasRikuy(cerrado: boolean): string[] {
  if (!cerrado) return RIKUY;
  return [...RIKUY.slice(0, 3), ...RIKUY_OJO_CERRADO, ...RIKUY.slice(8)];
}

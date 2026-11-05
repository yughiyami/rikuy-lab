/**
 * Canvas 2D world renderer (1.3, DESIGN.md 7.4): a top-down pixel-art museum.
 * - Static layer (floors, rugs, walls with depth, doors, wall hangings, the curator's gate) is drawn once
 *   per scene at 16 px per tile into an offscreen canvas and blitted scaled with smoothing off.
 * - Each frame draws a y-sorted list (props, vitrines, NPCs, avatars) so people pass behind and in front of
 *   props, then overlays (name tags, speech bubble, "E" prompt). No per-frame allocations in the hot path
 *   beyond a pooled draw list.
 * - Art: Kenney "Roguelike Indoor" (CC0) for plants, benches, shelves, paintings and tapestries when the
 *   sheet is loaded (`ponerAtlas`); everything else is own pixel art from `sprites.ts`. Without the sheet
 *   every piece falls back to own art, so the world never breaks offline.
 */
import type { Decor } from '../decoracion.ts';
import type { Escena } from '../generador.ts';
import type { ObjetoMapa } from '../tiled.ts';
import type { AvatarRender, EstadoRender, RenderizadorMundo } from '../puertos.ts';
import {
  ALTO_PERSONAJE,
  PX,
  celdaKenney,
  celdasDe,
  escalaPixel,
  esPiezaKenney,
  filasPersonaje,
  filasRikuy,
  orientacionDe,
  parpadea,
  poseCaminata,
  rasgosDe,
  rebote,
  sombrear,
} from './sprites.ts';

export const TILE_CSS = 32;
const DPR_MAX = 2;

export interface Paleta {
  bg: string;
  surface: string;
  ink: string;
  ink2: string;
  sol: string;
  foton: string;
  primary: string;
  /** Colour of the current hall (vestibule: primary). */
  hall: string;
  hallTint: string;
  /** Lintel colour per hall id (vestibule doors). */
  salas: Record<string, string>;
}

type Lienzo = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function crearLienzo(ancho: number, alto: number): Lienzo {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, ancho), Math.max(1, alto));
  const c = document.createElement('canvas');
  c.width = Math.max(1, ancho);
  c.height = Math.max(1, alto);
  return c;
}

function ctx2d(l: Lienzo): Ctx {
  const c = l.getContext('2d') as Ctx | null;
  if (!c) throw new Error('Canvas 2D is not available');
  c.imageSmoothingEnabled = false;
  return c;
}

const r = (c: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

function ruido(x: number, y: number, s = 0): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 1442695041, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------------------- floors and walls

type Estilo = 'piedra' | 'madera' | 'cesped' | 'tablado';

function estiloDe(escena: Escena): Estilo {
  if (escena.id === 'vestibulo') return 'piedra';
  if (escena.id === 'patio') return 'cesped';
  if (escena.id === 'auditorio') return 'tablado';
  return 'madera';
}

function suelo(c: Ctx, estilo: Estilo, tx: number, ty: number, x: number, y: number) {
  if (estilo === 'piedra') {
    const claro = (tx + ty) % 2 === 0;
    r(c, x, y, PX, PX, claro ? '#EADFC8' : '#DCCCAE');
    r(c, x, y + PX - 1, PX, 1, '#C9B795');
    r(c, x + PX - 1, y, 1, PX, '#C9B795');
    r(c, x, y, PX, 1, claro ? '#F3EBD9' : '#E6D8BD');
    for (let i = 0; i < 3; i++) {
      r(c, x + 2 + Math.floor(ruido(tx, ty, i) * 11), y + 2 + Math.floor(ruido(ty, tx, i) * 11), 1, 1, '#CDBB98');
    }
    return;
  }
  if (estilo === 'cesped') {
    r(c, x, y, PX, PX, (tx + ty) % 2 ? '#8CBF5C' : '#86B857');
    for (let i = 0; i < 5; i++) {
      r(c, x + Math.floor(ruido(tx, ty, i) * 15), y + Math.floor(ruido(ty, tx, i + 7) * 14), 1, 2, '#6E9D43');
    }
    if (ruido(tx, ty, 9) > 0.86) {
      r(c, x + 4 + Math.floor(ruido(tx, ty, 10) * 8), y + 4 + Math.floor(ruido(tx, ty, 11) * 8), 2, 2, ruido(tx, ty, 12) > 0.5 ? '#F5B301' : '#FFFFFF');
    }
    return;
  }
  // wood planks: 4 px boards with staggered seams
  const base = estilo === 'tablado' ? ['#9A6440', '#8F5B39', '#A56D46'] : ['#CD9A63', '#C38F58', '#D6A56E'];
  const junta = estilo === 'tablado' ? '#6F4429' : '#A06E40';
  for (let fila = 0; fila < 4; fila++) {
    const yy = y + fila * 4;
    const tabla = ty * 4 + fila;
    r(c, x, yy, PX, 4, base[Math.floor(ruido(tx >> 1, tabla, 1) * 3)]!);
    r(c, x, yy + 3, PX, 1, junta);
    if ((tabla + tx) % 3 === 0) r(c, x + ((tabla * 5) % 16), yy, 1, 3, junta);
    if (ruido(tx, tabla, 3) > 0.92) r(c, x + 3 + Math.floor(ruido(tx, fila, 4) * 9), yy + 1, 2, 1, junta);
  }
}

/** Awayu (Andean woven cloth) pattern: stripes and diamonds in the given colours. */
function awayu(c: Ctx, x: number, y: number, w: number, h: number, colores: readonly string[], borde: string) {
  const banda = 4;
  for (let yy = 0; yy < h; yy += banda) {
    const k = Math.floor(yy / banda) % colores.length;
    r(c, x, y + yy, w, Math.min(banda, h - yy), colores[k]!);
    r(c, x, y + yy, w, 1, sombrear(colores[k]!, 0.85));
  }
  const cy = y + Math.floor(h / 2);
  for (let xx = 2; xx < w - 6; xx += 7) {
    r(c, x + xx + 2, cy - 2, 1, 1, '#FFF4D6');
    r(c, x + xx + 1, cy - 1, 3, 1, '#FFF4D6');
    r(c, x + xx, cy, 5, 1, '#FFF4D6');
    r(c, x + xx + 1, cy + 1, 3, 1, '#FFF4D6');
    r(c, x + xx + 2, cy + 2, 1, 1, '#FFF4D6');
    r(c, x + xx + 2, cy, 1, 1, colores[1 % colores.length]!);
  }
  r(c, x, y, w, 1, borde);
  r(c, x, y + h - 1, w, 1, borde);
  r(c, x, y, 1, h, borde);
  r(c, x + w - 1, y, 1, h, borde);
  for (let xx = 1; xx < w - 1; xx += 2) {
    r(c, x + xx, y - 1, 1, 1, '#FFF4D6');
    r(c, x + xx, y + h, 1, 1, '#FFF4D6');
  }
}

function coloresAwayu(p: Paleta, variante: number): string[] {
  const juegos = [
    [p.hall, '#B8243A', p.sol, '#B8243A'],
    ['#B8243A', p.sol, '#2F7D4A', p.sol],
    ['#7A2E6B', '#E86A2C', p.sol, '#E86A2C'],
    ['#C2410C', p.primary, p.sol, p.primary],
  ];
  return juegos[((variante % juegos.length) + juegos.length) % juegos.length]!;
}

function esMuro(escena: Escena, x: number, y: number): boolean {
  const { mapa } = escena;
  if (x < 0 || y < 0 || x >= mapa.ancho || y >= mapa.alto) return true;
  const i = y * mapa.ancho + x;
  return mapa.muros[i] !== 0 || mapa.suelo[i] === 0;
}

function muro(c: Ctx, escena: Escena, tx: number, ty: number, x: number, y: number, p: Paleta) {
  const tope = '#3C4E54';
  if (!esMuro(escena, tx, ty + 1)) {
    r(c, x, y, PX, 5, tope);
    r(c, x, y, PX, 1, '#5A6E74');
    // plaster face with a wainscot in the hall colour
    r(c, x, y + 5, PX, 6, sombrear(p.hallTint, 0.97));
    r(c, x, y + 5, PX, 1, sombrear(p.hallTint, 0.85));
    r(c, x, y + 11, PX, 1, p.sol);
    r(c, x, y + 12, PX, 4, sombrear(p.hall, 0.95));
    r(c, x, y + 15, PX, 1, sombrear(p.hall, 0.6));
    if (tx % 2 === 0) r(c, x, y + 12, 1, 3, sombrear(p.hall, 0.75));
  } else {
    r(c, x, y, PX, PX, tope);
    if (!esMuro(escena, tx - 1, ty)) r(c, x, y, 2, PX, '#5A6E74');
    if (!esMuro(escena, tx + 1, ty)) r(c, x + PX - 2, y, 2, PX, '#5A6E74');
    if (!esMuro(escena, tx, ty - 1)) r(c, x, y, PX, 2, '#5A6E74');
  }
}

function sombraDeMuro(c: Ctx, escena: Escena, tx: number, ty: number, x: number, y: number) {
  c.globalAlpha = 0.18;
  if (esMuro(escena, tx, ty - 1)) r(c, x, y, PX, 3, '#0D2B33');
  if (esMuro(escena, tx - 1, ty)) r(c, x, y, 2, PX, '#0D2B33');
  c.globalAlpha = 1;
}

function puerta(c: Ctx, o: ObjetoMapa, escena: Escena, p: Paleta) {
  const color = (typeof o.props.salaId === 'string' && escena.id === 'vestibulo' ? p.salas[o.props.salaId] : undefined) ?? p.hall;
  const x = o.x * PX;
  const y = o.y * PX;
  const w = o.ancho * PX;
  const h = o.alto * PX;
  if (o.y === 0) {
    // doorway in the top wall: dark opening, coloured frame and lintel
    r(c, x, y, w, h, '#1C292D');
    r(c, x + 2, y + 6, w - 4, h - 6, '#26383D');
    r(c, x, y, w, 4, color);
    r(c, x, y, w, 1, sombrear(color, 1.35));
    r(c, x, y, 2, h, sombrear(color, 0.8));
    r(c, x + w - 2, y, 2, h, sombrear(color, 0.8));
    r(c, x + w / 2 - 1, y + 1, 2, 2, p.sol);
    return;
  }
  // side or bottom opening: a doormat in the hall colour
  const vertical = o.alto > o.ancho;
  const mx = x + (vertical ? 2 : 1);
  const my = y + (vertical ? 1 : 3);
  const mw = w - (vertical ? 4 : 2);
  const mh = h - (vertical ? 2 : 6);
  r(c, mx, my, mw, mh, color);
  r(c, mx + 1, my + 1, mw - 2, mh - 2, sombrear(color, 1.25));
  r(c, mx + 2, my + 2, mw - 4, mh - 4, color);
}

function reja(c: Ctx, o: ObjetoMapa) {
  const x = o.x * PX;
  const y = o.y * PX;
  const w = o.ancho * PX;
  r(c, x, y + 2, w, 2, '#2C3A3E');
  r(c, x, y + 12, w, 2, '#2C3A3E');
  for (let i = 1; i < w; i += 4) {
    r(c, x + i, y, 2, 16, '#3E5157');
    r(c, x + i, y, 1, 16, '#6C8187');
    r(c, x + i, y - 1, 2, 1, '#F5B301');
  }
  r(c, x + w / 2 - 2, y + 6, 4, 4, '#F5B301');
  r(c, x + w / 2 - 1, y + 7, 2, 2, '#7A5A00');
}

function escenario(c: Ctx, o: ObjetoMapa, p: Paleta) {
  const x = o.x * PX;
  const y = o.y * PX;
  const w = o.ancho * PX;
  const h = o.alto * PX;
  r(c, x, y, w, h - 5, '#7A4A2C');
  for (let yy = 0; yy < h - 5; yy += 4) r(c, x, y + yy + 3, w, 1, '#5E3820');
  r(c, x, y + h - 5, w, 5, '#4A2C18');
  r(c, x, y + h - 5, w, 1, p.sol);
  const cx = x + w / 2;
  c.globalAlpha = 0.85;
  for (let i = 0; i < 10; i++) r(c, cx - i, y + 4 + i, i * 2, 1, i % 3 === 0 ? '#C9F6FF' : p.foton);
  c.globalAlpha = 1;
}

// ------------------------------------------------------------------------------- own props

/** Own pixel-art props, drawn with (x, y) as the top-left of their tile footprint, in art pixels. */
function propio(c: Ctx, pieza: string, x: number, y: number, ancho: number, t: number, variante = 0) {
  switch (pieza) {
    case 'pendulo': {
      r(c, x + 2, y + 13, 12, 3, '#6B4226');
      r(c, x + 3, y - 6, 2, 19, '#8B5A33');
      r(c, x + 11, y - 6, 2, 19, '#8B5A33');
      r(c, x + 2, y - 7, 12, 2, '#6B4226');
      const a = Math.sin(t * 2.4) * 0.5;
      const bx = x + 8 + Math.round(Math.sin(a) * 9);
      const by = y - 5 + Math.round(Math.cos(a) * 12);
      c.strokeStyle = '#E8E0CC';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 8.5, y - 5);
      c.lineTo(bx + 0.5, by);
      c.stroke();
      r(c, bx - 2, by - 1, 4, 4, '#E0A100');
      r(c, bx - 1, by - 1, 1, 1, '#FFE08A');
      return;
    }
    case 'microscopio':
      r(c, x + 3, y + 12, 10, 3, '#334047');
      r(c, x + 8, y + 2, 3, 11, '#46555C');
      r(c, x + 5, y + 8, 6, 2, '#5C6D74');
      r(c, x + 6, y - 1, 4, 5, '#2B3438');
      r(c, x + 7, y - 3, 2, 2, '#19CBEE');
      r(c, x + 4, y + 9, 2, 1, '#9AD06A');
      return;
    case 'matraz':
      r(c, x + 1, y + 8, 14, 3, '#8B5A33');
      r(c, x + 2, y + 11, 2, 5, '#6B4226');
      r(c, x + 12, y + 11, 2, 5, '#6B4226');
      r(c, x + 3, y + 4, 4, 4, '#9E3206');
      r(c, x + 4, y + 1, 2, 3, '#DDF6FB');
      r(c, x + 9, y + 2, 4, 6, '#DDF6FB');
      r(c, x + 9, y + 5, 4, 3, '#19CBEE');
      return;
    case 'roca':
      r(c, x + 2, y + 10, 12, 5, '#7C6A58');
      r(c, x + 4, y + 7, 8, 4, '#93806C');
      r(c, x + 6, y + 3, 2, 5, '#B48CF2');
      r(c, x + 9, y + 4, 2, 4, '#8E64D8');
      r(c, x + 6, y + 3, 1, 1, '#E7DBFF');
      return;
    case 'yunque':
      r(c, x + 1, y + 6, 14, 3, '#A06E40');
      r(c, x + 2, y + 9, 2, 7, '#7A4E2C');
      r(c, x + 12, y + 9, 2, 7, '#7A4E2C');
      r(c, x + 3, y + 3, 4, 3, '#5C6D74');
      r(c, x + 9, y + 2, 1, 4, '#8B5A33');
      r(c, x + 8, y + 2, 3, 1, '#9AA7AD');
      return;
    case 'ceramica':
      r(c, x + 3, y + 12, 10, 4, '#8B5A33');
      r(c, x + 5, y + 2, 6, 10, '#B5532C');
      r(c, x + 4, y + 5, 8, 6, '#B5532C');
      r(c, x + 6, y + 1, 4, 2, '#8E3E1E');
      r(c, x + 4, y + 7, 8, 1, '#F2DDB0');
      for (let i = 0; i < 4; i++) r(c, x + 4 + i * 2, y + 8, 1, 1, '#2B1B14');
      r(c, x + 5, y + 4, 1, 3, '#D9784A');
      return;
    case 'quipu': {
      r(c, x + 1, y + 6, 14, 2, '#C9A26A');
      const hilos = ['#F5B301', '#B8243A', '#075E6C', '#F2DDB0', '#2F7D4A', '#7A2E6B'];
      for (let i = 0; i < 6; i++) {
        const largo = 5 + ((i * 3 + variante) % 4);
        r(c, x + 2 + i * 2, y + 8, 1, largo, hilos[i]!);
        r(c, x + 2 + i * 2, y + 9 + (i % 3), 1, 1, sombrear(hilos[i]!, 0.55));
      }
      return;
    }
    case 'pizarra':
      r(c, x + 1, y + 3, ancho * PX - 2, 10, '#6B4226');
      r(c, x + 2, y + 4, ancho * PX - 4, 8, '#2F5D46');
      r(c, x + 4, y + 6, 8, 1, '#E8F1EA');
      r(c, x + 4, y + 9, 12, 1, '#E8F1EA');
      r(c, x + 18, y + 5, 6, 5, '#E8F1EA');
      r(c, x + 19, y + 6, 4, 3, '#2F5D46');
      return;
    default:
  }
}

/** Fallback art for Kenney pieces when the sheet is not loaded (offline first paint). */
function respaldo(c: Ctx, pieza: string, x: number, y: number, ancho: number, p: Paleta) {
  if (pieza === 'planta' || pieza === 'planta-alta') {
    r(c, x + 5, y + 10, 6, 5, '#C2410C');
    r(c, x + 3, y + 2, 10, 8, '#2F7D4A');
    r(c, x + 5, y, 6, 4, '#3E9A5C');
  } else if (pieza === 'banco') {
    r(c, x + 1, y + 5, ancho * PX - 2, 5, '#A06E40');
    r(c, x + 2, y + 10, 2, 5, '#6B4226');
    r(c, x + ancho * PX - 4, y + 10, 2, 5, '#6B4226');
  } else if (pieza === 'tapiz') {
    awayu(c, x + 2, y + 3, ancho * PX - 4, 10, coloresAwayu(p, 1), '#4A2C18');
  } else if (pieza === 'cuadro') {
    r(c, x + 2, y + 2, 12, 10, '#C9A26A');
    r(c, x + 3, y + 3, 10, 8, p.hall);
  } else {
    r(c, x + 3, y + 4, 10, 11, '#8B5A33');
  }
}

// ------------------------------------------------------------------------------- vitrines

type Objeto = 'pendulo' | 'leche' | 'pulmones' | 'atomo' | 'hoja' | 'matraz' | 'cerro' | 'herramienta' | 'trofeo' | 'ceramica';

interface Vitrina {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  destinoId: string | undefined;
  objeto: Objeto;
  vacia: boolean;
}

function objetoDe(o: ObjetoMapa, escena: Escena): Objeto {
  const id = `${String(o.props.exhibicionId ?? '')} ${String(o.props.practicaId ?? '')}`.toLowerCase();
  if (o.props.retoId) return 'trofeo';
  if (id.includes('pendulo')) return 'pendulo';
  if (id.includes('lactasa')) return 'leche';
  if (id.includes('respir')) return 'pulmones';
  switch (escena.id) {
    case 'sala-fisica':
      return 'atomo';
    case 'sala-biologia':
      return 'hoja';
    case 'sala-quimica':
      return 'matraz';
    case 'sala-tierra':
      return 'cerro';
    case 'sala-taller':
      return 'herramienta';
    default:
      return 'ceramica';
  }
}

function vitrinasDe(escena: Escena): Vitrina[] {
  return escena.mapa.objetos
    .filter((o) => o.tipo === 'pedestal')
    .map((o) => {
      const destinoId = o.props.exhibicionId ? `exh-${String(o.props.exhibicionId)}` : o.props.retoId ? `reto-${String(o.props.retoId)}` : undefined;
      return { x: o.x, y: o.y, ancho: o.ancho, alto: o.alto, destinoId, objeto: objetoDe(o, escena), vacia: !destinoId };
    });
}

function objetoVitrina(c: Ctx, objeto: Objeto, cx: number, cy: number, t: number, p: Paleta) {
  switch (objeto) {
    case 'pendulo': {
      r(c, cx - 6, cy - 9, 12, 1, '#8B5A33');
      r(c, cx - 6, cy - 9, 1, 12, '#8B5A33');
      r(c, cx + 5, cy - 9, 1, 12, '#8B5A33');
      const a = Math.sin(t * 2.6) * 0.45;
      const bx = cx + Math.round(Math.sin(a) * 7);
      const by = cy - 8 + Math.round(Math.cos(a) * 9);
      c.strokeStyle = '#3C4E54';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cx + 0.5, cy - 8);
      c.lineTo(bx + 0.5, by);
      c.stroke();
      r(c, bx - 2, by - 1, 4, 4, '#E0A100');
      r(c, bx - 1, by - 1, 1, 1, '#FFE08A');
      return;
    }
    case 'leche':
      r(c, cx - 7, cy - 4, 5, 8, '#F7F7F2');
      r(c, cx - 7, cy - 6, 5, 2, '#B9C7CC');
      r(c, cx + 1, cy - 6, 2, 10, '#DDF6FB');
      r(c, cx + 1, cy - 1, 2, 5, '#9AD06A');
      r(c, cx + 4, cy - 6, 2, 10, '#DDF6FB');
      r(c, cx + 4, cy, 2, 4, '#F5B301');
      return;
    case 'pulmones':
      r(c, cx - 1, cy - 8, 2, 5, '#E9ECE4');
      r(c, cx - 7, cy - 4, 6, 9, '#E07A8A');
      r(c, cx + 1, cy - 4, 6, 9, '#E07A8A');
      r(c, cx - 6, cy - 3, 2, 4, '#F4AAB5');
      r(c, cx + 2, cy - 3, 2, 4, '#F4AAB5');
      return;
    case 'atomo': {
      r(c, cx - 2, cy - 3, 4, 4, '#F5B301');
      for (let i = 0; i < 3; i++) {
        const ang = t * 1.5 + (i * Math.PI * 2) / 3;
        r(c, cx + Math.round(Math.cos(ang) * 7) - 1, cy - 2 + Math.round(Math.sin(ang) * 3), 2, 2, '#19CBEE');
      }
      return;
    }
    case 'hoja':
      r(c, cx - 1, cy - 2, 2, 7, '#2F7D4A');
      r(c, cx - 6, cy - 7, 5, 5, '#5DAA4F');
      r(c, cx + 1, cy - 9, 6, 6, '#7BC060');
      r(c, cx - 5, cy - 6, 2, 2, '#A6DB84');
      return;
    case 'matraz':
      r(c, cx - 1, cy - 9, 3, 5, '#DDF6FB');
      r(c, cx - 5, cy - 4, 11, 8, '#DDF6FB');
      r(c, cx - 4, cy - 1, 9, 5, '#9E3206');
      r(c, cx - 2, cy - 1, 2, 1, '#F2A07B');
      return;
    case 'cerro':
      for (let i = 0; i < 8; i++) r(c, cx - i, cy - 6 + i, i * 2, 1, i < 3 ? '#F7F7F2' : '#7C6A58');
      r(c, cx - 8, cy + 2, 16, 2, '#5D8B3A');
      return;
    case 'herramienta':
      r(c, cx - 6, cy - 1, 12, 3, '#5C6D74');
      r(c, cx - 1, cy - 9, 2, 8, '#8B5A33');
      r(c, cx - 4, cy - 10, 8, 3, '#9AA7AD');
      return;
    case 'trofeo':
      r(c, cx - 5, cy - 8, 10, 6, p.sol);
      r(c, cx - 3, cy - 2, 6, 2, '#C99300');
      r(c, cx - 1, cy, 2, 3, '#C99300');
      r(c, cx - 4, cy + 3, 8, 2, '#8B5A33');
      r(c, cx - 3, cy - 7, 2, 3, '#FFE08A');
      return;
    case 'ceramica':
      propio(c, 'ceramica', cx - 8, cy - 10, 1, t);
      return;
  }
}

function dibujarVitrina(c: Ctx, v: Vitrina, t: number, p: Paleta, bloqueada: boolean) {
  const w = v.ancho * PX;
  const h = v.alto * PX;
  const x = v.x * PX;
  const y = v.y * PX;
  const cx = x + Math.floor(w / 2);
  if (v.vacia) {
    // low plinth with a themed artefact
    r(c, x + 5, y + h - 14, w - 10, 12, '#8B5A33');
    r(c, x + 5, y + h - 16, w - 10, 3, '#B07A4C');
    r(c, x + 5, y + h - 3, w - 10, 1, '#5E3820');
    objetoVitrina(c, v.objeto === 'pendulo' ? 'atomo' : v.objeto, cx, y + h - 20, t, p);
    return;
  }
  // wooden base
  r(c, x + 2, y + h - 15, w - 4, 13, '#7A4A2C');
  r(c, x + 2, y + h - 17, w - 4, 3, '#A9744A');
  r(c, x + 2, y + h - 3, w - 4, 1, '#4A2C18');
  r(c, cx - 4, y + h - 10, 8, 3, p.sol);
  // glass case
  const gy = y - 4;
  const gh = h - 13;
  r(c, x + 3, gy, w - 6, gh, bloqueada ? 'rgba(60,78,84,0.55)' : 'rgba(205,240,250,0.35)');
  objetoVitrina(c, v.objeto, cx, gy + gh - 4, t, p);
  r(c, x + 3, gy, w - 6, gh, bloqueada ? 'rgba(13,43,51,0.35)' : 'rgba(205,240,250,0.18)');
  r(c, x + 3, gy, w - 6, 1, '#E8FAFF');
  r(c, x + 3, gy, 1, gh, '#BFE6EF');
  r(c, x + w - 4, gy, 1, gh, '#8FBFCB');
  r(c, x + 6, gy + 3, 1, 5, 'rgba(255,255,255,0.8)');
  r(c, x + 8, gy + 2, 1, 2, 'rgba(255,255,255,0.8)');
  r(c, x + 2, gy - 2, w - 4, 2, '#5E3820');
  if (bloqueada) {
    r(c, cx - 3, gy + 7, 6, 5, p.sol);
    r(c, cx - 2, gy + 4, 1, 3, '#C99300');
    r(c, cx + 1, gy + 4, 1, 3, '#C99300');
    r(c, cx - 2, gy + 4, 4, 1, '#C99300');
    r(c, cx - 1, gy + 9, 2, 2, '#7A5A00');
  }
}

// ------------------------------------------------------------------------------- characters

const COLORES_PJ: Record<string, string> = { o: '#1E2A2E', e: '#1E2A2E', p: '#2F3E66', b: '#3B2A20', r: '#E7907A', w: '#FFF4D6' };

function pintarFilas(c: Ctx, filas: readonly string[], colores: Record<string, string>) {
  for (let y = 0; y < filas.length; y++) {
    const f = filas[y]!;
    for (let x = 0; x < f.length; x++) {
      const col = colores[f[x]!];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x, y, 1, 1);
    }
  }
}

interface Mov {
  x: number;
  y: number;
  hasta: number;
}

// ------------------------------------------------------------------------------- renderer

export interface OpcionesCanvas {
  paleta: (escena: Escena) => Paleta;
  dpr?: number;
  /** Kenney "Roguelike Indoor" sheet; can also arrive later through `ponerAtlas`. */
  atlas?: CanvasImageSource | null;
}

export interface RenderizadorCanvas extends RenderizadorMundo {
  /** Hands over the Kenney sheet once it has loaded (the static layer is redrawn). */
  ponerAtlas(atlas: CanvasImageSource): void;
}

interface Dibujable {
  y: number;
  tipo: 0 | 1 | 2 | 3 | 4;
  i: number;
  a: AvatarRender | null;
}

export function crearRenderizadorCanvas(canvas: HTMLCanvasElement, opciones: OpcionesCanvas): RenderizadorCanvas {
  const contexto = canvas.getContext('2d', { alpha: false });
  if (!contexto) throw new Error('Canvas 2D is not available');
  const g: CanvasRenderingContext2D = contexto;
  const dpr = Math.min(opciones.dpr ?? (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1), DPR_MAX);
  let atlas: CanvasImageSource | null = opciones.atlas ?? null;
  let escala = escalaPixel(TILE_CSS * dpr);
  let tile = escala * PX;
  let cacheEscena: Escena | null = null;
  let cacheReja = false;
  let estatica: Lienzo | null = null;
  let paleta: Paleta | null = null;
  let vitrinas: Vitrina[] = [];
  let props: Decor[] = [];
  let bloqueadas = new Set<string>();
  let fondo: CanvasPattern | null = null;
  const sprites = new Map<string, Lienzo>();
  const movs = new Map<string, Mov>();
  const anchos = new Map<string, number>();
  const cola: Dibujable[] = [];
  const pool: Dibujable[] = [];

  function kenney(c: Ctx, pieza: string, x: number, y: number, ancho: number, variante: number, p: Paleta): void {
    if (!atlas || !esPiezaKenney(pieza)) {
      respaldo(c, pieza, x, y, ancho, p);
      return;
    }
    const celdas = celdasDe(pieza, variante);
    for (let i = 0; i < celdas.length; i++) {
      const [col, fila] = celdas[i]!;
      const s = celdaKenney(col, fila);
      c.drawImage(atlas, s.sx, s.sy, s.sw, s.sh, x + i * PX, y, PX, PX);
    }
  }

  function construirEstatica(escena: Escena) {
    const p = paleta!;
    const { mapa } = escena;
    const l = crearLienzo(mapa.ancho * PX, mapa.alto * PX);
    const c = ctx2d(l);
    const estilo = estiloDe(escena);
    const libre = (x: number, y: number) => x >= 0 && y >= 0 && x < mapa.ancho && y < mapa.alto && mapa.muros[y * mapa.ancho + x] === 0;
    const alfombra = (x: number, y: number) => {
      const gg = mapa.suelo[y * mapa.ancho + x];
      return libre(x, y) && (gg === 3 || gg === 6);
    };
    for (let ty = 0; ty < mapa.alto; ty++) {
      for (let tx = 0; tx < mapa.ancho; tx++) {
        const i = ty * mapa.ancho + tx;
        const x = tx * PX;
        const y = ty * PX;
        const gid = mapa.suelo[i]!;
        if (mapa.muros[i] !== 0) {
          muro(c, escena, tx, ty, x, y, p);
          continue;
        }
        if (gid === 0) {
          r(c, x, y, PX, PX, '#22343A');
          continue;
        }
        suelo(c, estilo, tx, ty, x, y);
        if (gid === 3 || gid === 6) {
          if (estilo === 'cesped') {
            r(c, x, y, PX, PX, '#D8C9A6');
            r(c, x + 1 + Math.floor(ruido(tx, ty) * 6), y + 3, 6, 4, '#C9B78F');
            r(c, x + 8, y + 9 + Math.floor(ruido(ty, tx) * 4), 6, 4, '#C9B78F');
            continue;
          }
          // the guide runner: a woven carpet with sol borders and a diamond motif
          r(c, x, y, PX, PX, '#A3263F');
          const horizontal = alfombra(tx - 1, ty) || alfombra(tx + 1, ty);
          const vertical = alfombra(tx, ty - 1) || alfombra(tx, ty + 1);
          if (horizontal && !vertical) {
            r(c, x, y + 3, PX, 2, p.sol);
            r(c, x, y + 11, PX, 2, p.sol);
          } else {
            r(c, x + 3, y, 2, PX, p.sol);
            r(c, x + 11, y, 2, PX, p.sol);
          }
          if (!alfombra(tx - 1, ty)) r(c, x, y, 2, PX, '#6E1428');
          if (!alfombra(tx + 1, ty)) r(c, x + PX - 2, y, 2, PX, '#6E1428');
          if (!alfombra(tx, ty - 1)) r(c, x, y, PX, 2, '#6E1428');
          if (!alfombra(tx, ty + 1)) r(c, x, y + PX - 2, PX, 2, '#6E1428');
          r(c, x + 7, y + 6, 2, 1, '#FFF4D6');
          r(c, x + 6, y + 7, 4, 2, '#FFF4D6');
          r(c, x + 7, y + 9, 2, 1, '#FFF4D6');
          r(c, x + 7, y + 7, 2, 2, p.hall);
          if (gid === 6) {
            // chakana (Andean stepped cross) medallion
            r(c, x + 4, y + 2, 8, 12, p.sol);
            r(c, x + 2, y + 4, 12, 8, p.sol);
            r(c, x + 6, y + 6, 4, 4, '#A3263F');
          }
        } else if (gid === 4 && estilo === 'piedra') {
          r(c, x, y + 6, PX, 4, '#C9B795');
          r(c, x + 7, y + 5, 2, 6, p.sol);
          r(c, x + 5, y + 7, 6, 2, p.sol);
        }
      }
    }
    for (const d of escena.decoracion) {
      if (d.pieza === 'alfombra') awayu(c, d.x * PX + 1, d.y * PX + 1, d.ancho * PX - 2, d.alto * PX - 2, coloresAwayu(p, d.variante ?? 0), '#4A2C18');
    }
    for (let ty = 1; ty < mapa.alto; ty++) {
      for (let tx = 0; tx < mapa.ancho; tx++) if (!esMuro(escena, tx, ty)) sombraDeMuro(c, escena, tx, ty, tx * PX, ty * PX);
    }
    for (const o of mapa.objetos) {
      if (o.tipo === 'puerta' && libre(Math.floor(o.x), Math.floor(o.y))) puerta(c, o, escena, p);
      else if (o.tipo === 'reja' && o.props.bloquea) reja(c, o);
      else if (o.tipo === 'interactivo') escenario(c, o, p);
    }
    for (const d of escena.decoracion) {
      if (!d.pared) continue;
      if (esPiezaKenney(d.pieza)) kenney(c, d.pieza, d.x * PX, d.y * PX - 1, d.ancho, d.variante ?? 0, p);
      else propio(c, d.pieza, d.x * PX, d.y * PX - 2, d.ancho, 0, d.variante ?? 0);
    }
    estatica = l;
    vitrinas = vitrinasDe(escena);
    props = escena.decoracion.filter((d) => !d.pared && d.pieza !== 'alfombra');
    bloqueadas = new Set(escena.destinos.filter((d) => d.bloqueada).map((d) => d.id));
  }

  function construirFondo() {
    const lado = Math.max(2, Math.round(PX * escala));
    const l = crearLienzo(lado * 2, lado * 2);
    const c = ctx2d(l);
    r(c, 0, 0, lado * 2, lado * 2, '#1F3237');
    r(c, 0, 0, lado, lado, '#223840');
    r(c, lado, lado, lado, lado, '#223840');
    const d = Math.max(1, Math.round(escala));
    r(c, lado / 2 - d, lado / 2 - d, d * 2, d * 2, '#2A434A');
    r(c, lado * 1.5 - d, lado * 1.5 - d, d * 2, d * 2, '#2A434A');
    fondo = g.createPattern(l as CanvasImageSource, 'repeat');
  }

  function sprite(clave: string, ancho: number, alto: number, pintar: (c: Ctx) => void): Lienzo {
    const hecho = sprites.get(clave);
    if (hecho) return hecho;
    const l = crearLienzo(ancho, alto);
    pintar(ctx2d(l));
    if (sprites.size > 400) sprites.clear();
    sprites.set(clave, l);
    return l;
  }

  function spritePersonaje(a: AvatarRender, curador: boolean, o: ReturnType<typeof orientacionDe>['o'], pose: number, p: Paleta): Lienzo {
    const { pelo, piel } = rasgosDe(a.id);
    const camisa = curador ? p.hall : a.color;
    return sprite(`pj|${curador ? 'c' : ''}|${camisa}|${pelo}|${piel}|${o}|${pose}`, 16, ALTO_PERSONAJE, (c) => {
      let filas = filasPersonaje(o, pose);
      if (curador) {
        // chullo (Andean knitted hat) with a stripe and ear flaps
        filas = filas.map((f, y) =>
          y >= 1 && y <= 4 ? f.replace(/h/g, y === 3 ? 'w' : 'k') : y >= 5 && y <= 8 ? f.replace(/^(..o)h/, '$1k').replace(/h(o..)$/, 'k$1') : f,
        );
      }
      pintarFilas(c, filas, {
        ...COLORES_PJ,
        h: pelo,
        s: piel,
        c: camisa,
        d: curador ? p.sol : sombrear(camisa, 0.72),
        k: '#B8243A',
      });
    });
  }

  function spriteRikuy(cerrado: boolean, marco: string): Lienzo {
    return sprite(`rk|${cerrado ? 1 : 0}|${marco}`, 12, 11, (c) =>
      pintarFilas(c, filasRikuy(cerrado), { o: marco, S: '#0B6574', l: '#2A8C99', D: '#074A55', w: '#FFFFFF', i: '#19CBEE', I: '#0D2B33' }),
    );
  }

  function sombraSuelo(cx: number, cy: number, rx: number, ry: number) {
    g.globalAlpha = 0.22;
    g.fillStyle = '#0D2B33';
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }

  function moviendose(a: AvatarRender, t: number): boolean {
    const m = movs.get(a.id);
    if (!m) {
      movs.set(a.id, { x: a.x, y: a.y, hasta: 0 });
      return false;
    }
    if (Math.abs(m.x - a.x) + Math.abs(m.y - a.y) > 0.002) m.hasta = t + 0.15;
    m.x = a.x;
    m.y = a.y;
    return t < m.hasta;
  }

  function dibujarPersonaje(a: AvatarRender, sx: number, sy: number, t: number, reducido: boolean, curador: boolean, p: Paleta) {
    const mov = !curador && moviendose(a, t);
    const { o, espejo } = orientacionDe(a.dir);
    const pose = reducido ? 0 : poseCaminata(t, mov);
    const l = spritePersonaje(a, curador, o, pose, p);
    const dy = rebote(t + (a.id.length % 5) * 0.13, mov, reducido) * escala;
    sombraSuelo(sx, sy, tile * 0.34, tile * 0.12);
    if (a.propio) {
      g.strokeStyle = p.sol;
      g.lineWidth = Math.max(1, escala);
      g.globalAlpha = 0.9;
      g.beginPath();
      g.ellipse(sx, sy, tile * 0.46, tile * 0.18, 0, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    const w = 16 * escala;
    const h = ALTO_PERSONAJE * escala;
    const x = Math.round(sx - w / 2);
    const y = Math.round(sy - h + 2 * escala + dy);
    if (espejo) {
      g.save();
      g.translate(x + w, y);
      g.scale(-1, 1);
      g.drawImage(l as CanvasImageSource, 0, 0, w, h);
      g.restore();
    } else {
      g.drawImage(l as CanvasImageSource, x, y, w, h);
    }
  }

  function etiqueta(texto: string, color: string, cx: number, y: number, p: Paleta, fuerte = false) {
    const fs = Math.round(11 * dpr);
    g.font = `${fuerte ? 700 : 600} ${fs}px system-ui, sans-serif`;
    const clave = `${fuerte ? 1 : 0}${texto}`;
    let ancho = anchos.get(clave);
    if (ancho === undefined) {
      ancho = g.measureText(texto).width;
      anchos.set(clave, ancho);
    }
    const pad = 6 * dpr;
    const punto = 7 * dpr;
    const w = ancho + pad * 2 + punto + 3 * dpr;
    const h = fs + 6 * dpr;
    const x = Math.round(cx - w / 2);
    const yy = Math.round(y - h);
    g.fillStyle = 'rgba(13,43,51,0.8)';
    g.beginPath();
    g.roundRect(x, yy, w, h, h / 2);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.arc(x + pad + punto / 2, yy + h / 2, punto / 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.surface;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(texto, x + pad + punto + 3 * dpr, yy + h / 2 + dpr * 0.5);
  }

  function burbuja(texto: string, cx: number, y: number, p: Paleta) {
    const fs = Math.round(12 * dpr);
    g.font = `700 ${fs}px system-ui, sans-serif`;
    const w = g.measureText(texto).width + 16 * dpr;
    const h = fs + 12 * dpr;
    const x = Math.round(cx - w / 2);
    const yy = Math.round(y - h - 6 * dpr);
    g.fillStyle = '#FFFFFF';
    g.strokeStyle = p.ink;
    g.lineWidth = 2 * dpr;
    g.beginPath();
    g.roundRect(x, yy, w, h, 8 * dpr);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(cx - 5 * dpr, yy + h - dpr);
    g.lineTo(cx, yy + h + 6 * dpr);
    g.lineTo(cx + 5 * dpr, yy + h - dpr);
    g.fill();
    g.stroke();
    g.fillRect(cx - 4 * dpr, yy + h - 3 * dpr, 8 * dpr, 3 * dpr);
    g.fillStyle = p.ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(texto, cx, yy + h / 2 + dpr * 0.5);
  }

  function tecla(cx: number, y: number, t: number, p: Paleta, reducido: boolean) {
    const s = 20 * dpr;
    const dy = reducido ? 0 : Math.round(Math.sin(t * 5) * 2 * dpr);
    const x = Math.round(cx - s / 2);
    const yy = Math.round(y - s + dy);
    g.fillStyle = p.ink;
    g.beginPath();
    g.roundRect(x, yy + 3 * dpr, s, s, 5 * dpr);
    g.fill();
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.roundRect(x, yy, s, s, 5 * dpr);
    g.fill();
    g.strokeStyle = p.ink;
    g.lineWidth = 1.5 * dpr;
    g.stroke();
    g.fillStyle = p.ink;
    g.font = `800 ${Math.round(12 * dpr)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('E', cx, yy + s / 2 + dpr * 0.5);
  }

  function resplandor(cx: number, cy: number, rx: number, t: number, reducido: boolean) {
    const k = reducido ? 0.55 : 0.55 + Math.sin(t * 3) * 0.15;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
    gr.addColorStop(0, 'rgba(255,214,90,0.95)');
    gr.addColorStop(1, 'rgba(255,214,90,0)');
    g.globalAlpha = k;
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, rx, rx * 0.6, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }

  function empujar(y: number, tipo: Dibujable['tipo'], i: number, a: AvatarRender | null) {
    const n = cola.length;
    const d = pool[n] ?? (pool[n] = { y, tipo, i, a });
    d.y = y;
    d.tipo = tipo;
    d.i = i;
    d.a = a;
    cola.push(d);
  }

  const porY = (a: Dibujable, b: Dibujable) => a.y - b.y;

  return {
    ponerAtlas(img) {
      atlas = img;
      cacheEscena = null;
    },
    redimensionar(anchoCss, altoCss, zoom = 1, encajar = false) {
      canvas.width = Math.round(anchoCss * dpr);
      canvas.height = Math.round(altoCss * dpr);
      canvas.style.width = `${anchoCss}px`;
      canvas.style.height = `${altoCss}px`;
      escala = escalaPixel(TILE_CSS * dpr * zoom, encajar ? 'floor' : 'round');
      tile = escala * PX;
      construirFondo();
      // view size in tiles, in CSS-relative terms (the camera math works in tiles)
      return { ancho: canvas.width / tile, alto: canvas.height / tile };
    },
    dibujar(e: EstadoRender) {
      if (e.escena !== cacheEscena || e.escena.rejaAbierta !== cacheReja || !estatica) {
        cacheEscena = e.escena;
        cacheReja = e.escena.rejaAbierta;
        paleta = opciones.paleta(e.escena);
        construirEstatica(e.escena);
      }
      const p = paleta!;
      const reducido = e.t === 0;
      const t = e.t;
      const ox = Math.round(-e.camara.x * tile);
      const oy = Math.round(-e.camara.y * tile);
      const aX = (x: number) => ox + x * tile;
      const aY = (y: number) => oy + y * tile;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = false;
      g.fillStyle = fondo ?? '#1F3237';
      g.fillRect(0, 0, canvas.width, canvas.height);
      const mw = e.escena.mapa.ancho * PX;
      const mh = e.escena.mapa.alto * PX;
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(ox + Math.round(tile * 0.25), oy + Math.round(tile * 0.3), mw * escala, mh * escala);
      g.drawImage(estatica as CanvasImageSource, 0, 0, mw, mh, ox, oy, mw * escala, mh * escala);

      // golden guide trail (marching dots)
      const fase = reducido ? 0 : Math.floor(t * 6);
      for (let i = 0; i < e.camino.length; i++) {
        const q = e.camino[i]!;
        const d = ((i + fase) % 3 === 0 ? 3 : 2) * escala;
        const x = Math.round(aX(q.x) - d / 2);
        const y = Math.round(aY(q.y) - d / 2);
        g.fillStyle = '#7A5A00';
        g.fillRect(x, y + escala, d, d);
        g.fillStyle = p.sol;
        g.fillRect(x, y, d, d);
      }

      // glow under the nearby / highlighted destination
      const brillo = e.cercano ?? e.resaltado;
      const dest = brillo ? e.escena.destinos.find((d) => d.id === brillo) : undefined;
      if (dest) resplandor(aX(dest.rect.x + dest.rect.ancho / 2), aY(dest.rect.y + dest.rect.alto * 0.75), tile * Math.max(dest.rect.ancho * 0.9, 1.3), t, reducido);

      // y-sorted world
      cola.length = 0;
      for (let i = 0; i < props.length; i++) empujar(props[i]!.y + props[i]!.alto, 0, i, null);
      for (let i = 0; i < vitrinas.length; i++) empujar(vitrinas[i]!.y + vitrinas[i]!.alto, 1, i, null);
      if (e.escena.curador) empujar(e.escena.curador.y + 0.3, 2, 0, null);
      if (e.escena.rikuy) empujar(e.escena.rikuy.y + 0.3, 3, 0, null);
      for (const a of e.otros) {
        const sx = aX(a.x);
        const sy = aY(a.y);
        if (sx < -tile * 2 || sy < -tile * 2 || sx > canvas.width + tile * 2 || sy > canvas.height + tile * 2) continue;
        empujar(a.y + 0.3, 4, 0, a);
      }
      empujar(e.jugador.y + 0.31, 4, 0, e.jugador);
      cola.sort(porY);

      for (const d of cola) {
        if (d.tipo === 0) {
          const pr = props[d.i]!;
          sombraSuelo(aX(pr.x + pr.ancho / 2), aY(pr.y + pr.alto - 0.12), (tile * pr.ancho) / 2.4, tile * 0.12);
          // plants sway: a skew pivoting on the pot
          const k = !reducido && (pr.pieza === 'planta' || pr.pieza === 'planta-alta') ? Math.sin(t * 1.4 + pr.x * 1.7) * 0.07 : 0;
          const fondoArte = 4 + PX * pr.alto;
          g.setTransform(escala, 0, k * escala, escala, Math.round(aX(pr.x) - k * escala * fondoArte), Math.round(aY(pr.y) - escala * 4));
          g.imageSmoothingEnabled = false;
          if (esPiezaKenney(pr.pieza)) kenney(g, pr.pieza, 0, 4, pr.ancho, pr.variante ?? 0, p);
          else propio(g, pr.pieza, 0, 4, pr.ancho, reducido ? 0 : t, pr.variante ?? 0);
          g.setTransform(1, 0, 0, 1, 0, 0);
        } else if (d.tipo === 1) {
          const v = vitrinas[d.i]!;
          sombraSuelo(aX(v.x + v.ancho / 2), aY(v.y + v.alto - 0.15), tile * v.ancho * 0.45, tile * 0.18);
          g.setTransform(escala, 0, 0, escala, ox, oy);
          dibujarVitrina(g, v, reducido ? 0 : t, p, !!v.destinoId && bloqueadas.has(v.destinoId));
          g.setTransform(1, 0, 0, 1, 0, 0);
        } else if (d.tipo === 2) {
          const c = e.escena.curador!;
          dibujarPersonaje({ id: `curador-${e.escena.id}`, x: c.x, y: c.y, dir: 2, color: p.hall, etiqueta: 'Curadora', integrantes: 1 }, aX(c.x), aY(c.y + 0.3), t, reducido, true, p);
        } else if (d.tipo === 3) {
          const k = e.escena.rikuy!;
          const cx = aX(k.x);
          const base = aY(k.y + 0.3);
          sombraSuelo(cx, base, tile * 0.3, tile * 0.1);
          const ang = reducido ? 0 : Math.sin((t * Math.PI * 2) / 4.2) * 0.12;
          const flota = reducido ? 0 : Math.round(Math.sin(t * 2) * 1.5) * escala;
          g.save();
          g.translate(cx, base - tile * 1.9 + flota);
          g.rotate(ang);
          g.fillStyle = '#F5B301';
          g.fillRect(-escala / 2, 0, escala, tile * 0.55);
          g.fillRect(-escala * 1.5, tile * 0.25, escala * 3, escala * 2);
          g.fillRect(-escala * 1.5, -escala, escala * 3, escala * 2);
          g.drawImage(spriteRikuy(parpadea(t, reducido), '#052A31') as CanvasImageSource, -6 * escala, tile * 0.5, 12 * escala, 11 * escala);
          g.restore();
        } else if (d.a) {
          dibujarPersonaje(d.a, aX(d.a.x), aY(d.a.y + 0.3), t, reducido, false, p);
          if (d.a.propio) {
            // the group's own stone floats by its shoulder (customisable cord and frame)
            const bob = reducido ? 0 : Math.round(Math.sin(t * 2.2) * 1.5) * escala;
            const sx = aX(d.a.x) + tile * 0.55;
            const sy = aY(d.a.y) - tile * 0.95 + bob;
            g.fillStyle = d.a.cordon ?? p.sol;
            g.fillRect(Math.round(sx - escala / 2), Math.round(sy - tile * 0.3), Math.max(1, Math.round(escala / 2)), Math.round(tile * 0.3));
            g.drawImage(spriteRikuy(parpadea(t + 1.3, reducido), d.a.marco ?? '#052A31') as CanvasImageSource, Math.round(sx - 3 * escala), Math.round(sy), 6 * escala, 5.5 * escala);
          }
        }
      }

      // overlays: door labels, names, curator hint, Rikuy speech, "E" prompt
      if (e.escena.id === 'vestibulo') {
        for (const d of e.escena.destinos) {
          if (d.tipo !== 'puerta' || !d.salaId) continue;
          const lx = d.rect.x === 0 ? aX(2.4) : d.rect.x >= e.escena.mapa.ancho - 1 ? aX(e.escena.mapa.ancho - 2.4) : aX(d.rect.x + d.rect.ancho / 2);
          const ly = d.rect.y === 0 ? aY(1.85) : aY(d.rect.y + 0.1);
          etiqueta(d.etiqueta, p.salas[d.salaId] ?? p.hall, lx, ly, p, true);
        }
      }
      if (e.escena.curador) {
        const c = e.escena.curador;
        etiqueta('Curadora', p.hall, aX(c.x), aY(c.y - 0.95), p);
        if (!e.escena.rejaAbierta) burbuja('?', aX(c.x), aY(c.y - 1.45), p);
      }
      for (const a of e.otros) {
        const sx = aX(a.x);
        if (sx < -tile * 2 || sx > canvas.width + tile * 2) continue;
        etiqueta(a.etiqueta, a.color, sx, aY(a.y - 0.95), p);
        if (a.pideAyuda) burbuja('✋ ayuda', sx, aY(a.y - 1.45), p);
      }
      etiqueta(e.jugador.etiqueta, e.jugador.color, aX(e.jugador.x), aY(e.jugador.y - 0.95), p, true);
      if (e.jugador.pideAyuda) burbuja('✋ ayuda', aX(e.jugador.x), aY(e.jugador.y - 1.45), p);
      if (e.escena.rikuy) {
        const k = e.escena.rikuy;
        const cerca = Math.hypot(k.x - e.jugador.x, k.y - e.jugador.y) < 3.2;
        const texto = e.camino.length ? '¡Por aquí!' : cerca ? '¡Hola! Soy Rikuy' : '';
        if (texto) burbuja(texto, aX(k.x), aY(k.y - 1.75), p);
      }
      if (e.cercano && dest && !dest.bloqueada && !dest.trasReja) {
        tecla(aX(dest.rect.x + dest.rect.ancho / 2), aY(dest.rect.y - (dest.tipo === 'exhibicion' ? 0.4 : 0.05)), t, p, reducido);
      }
    },
    destruir() {
      sprites.clear();
      movs.clear();
      estatica = null;
    },
  };
}

import { describe, expect, it } from 'vitest';
import {
  ALTO_PERSONAJE,
  KENNEY,
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

describe('Kenney atlas mapping', () => {
  it('maps a sheet cell to its 16 px source rectangle past the 1 px margins', () => {
    expect(celdaKenney(0, 0)).toEqual({ sx: 0, sy: 0, sw: 16, sh: 16 });
    expect(celdaKenney(17, 3)).toEqual({ sx: 289, sy: 51, sw: 16, sh: 16 });
  });

  it('every piece lists exactly ancho x alto cells inside the 27x18 sheet', () => {
    for (const p of Object.values(KENNEY)) {
      for (const v of p.variantes) {
        expect(v).toHaveLength(p.ancho * p.alto);
        for (const [c, f] of v) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(27);
          expect(f).toBeLessThan(18);
        }
      }
    }
  });

  it('wraps variants and tells Kenney pieces from own art', () => {
    expect(celdasDe('cuadro', 6)).toEqual(celdasDe('cuadro', 0));
    expect(celdasDe('tapiz', -1)).toEqual(KENNEY.tapiz.variantes[2]);
    expect(esPiezaKenney('banco')).toBe(true);
    expect(esPiezaKenney('pendulo')).toBe(false);
  });
});

describe('character sprites', () => {
  it('every orientation and pose is a 16x20 grid', () => {
    for (const o of ['frente', 'espalda', 'lado'] as const) {
      for (const pose of [0, 1, 2]) {
        const filas = filasPersonaje(o, pose);
        expect(filas).toHaveLength(ALTO_PERSONAJE);
        for (const f of filas) expect(f, `${o}/${pose}: "${f}"`).toHaveLength(16);
      }
    }
  });

  it('the front view has eyes and the back view does not', () => {
    expect(filasPersonaje('frente', 0).join('')).toContain('e');
    expect(filasPersonaje('espalda', 0).join('')).not.toContain('e');
  });

  it('maps the realtime direction to an orientation (west mirrors east)', () => {
    expect(orientacionDe(0)).toEqual({ o: 'lado', espejo: false });
    expect(orientacionDe(4)).toEqual({ o: 'lado', espejo: true });
    expect(orientacionDe(2)).toEqual({ o: 'frente', espejo: false });
    expect(orientacionDe(6)).toEqual({ o: 'espalda', espejo: false });
    expect(orientacionDe(-2)).toEqual({ o: 'espalda', espejo: false });
  });

  it('walk cycle alternates strides at 8 steps per second and stands when idle', () => {
    expect([0, 0.125, 0.25, 0.375, 0.5].map((t) => poseCaminata(t, true))).toEqual([0, 1, 0, 2, 0]);
    expect(poseCaminata(0.125, false)).toBe(0);
  });

  it('bobs gently, and not at all under reduced motion', () => {
    expect(rebote(0.125, true, false)).toBe(-1);
    expect(rebote(0, true, false)).toBe(0);
    expect(rebote(0.7, false, false)).toBe(-1);
    expect(rebote(0.7, false, true)).toBe(0);
  });

  it('gives each group a stable look', () => {
    expect(rasgosDe('grupo-1')).toEqual(rasgosDe('grupo-1'));
    expect(rasgosDe('grupo-1').piel).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('Rikuy sprite', () => {
  it('is a 12 px wide stone that blinks every few seconds', () => {
    for (const cerrado of [false, true]) {
      expect(filasRikuy(cerrado)).toHaveLength(11);
      for (const f of filasRikuy(cerrado)) expect(f).toHaveLength(12);
    }
    expect(filasRikuy(true).join('')).not.toContain('i');
    expect(parpadea(3.5, false)).toBe(true);
    expect(parpadea(1, false)).toBe(false);
    expect(parpadea(3.5, true)).toBe(false);
  });
});

describe('pixel helpers', () => {
  it('snaps the art scale to whole pixels from 1.5x up', () => {
    expect(escalaPixel(48)).toBe(3);
    expect(escalaPixel(40)).toBe(3); // 2.5 rounds up
    expect(escalaPixel(40, 'floor')).toBe(2);
    expect(escalaPixel(20)).toBe(1.25);
    expect(escalaPixel(0)).toBe(1);
  });

  it('shades hex colours and leaves others alone', () => {
    expect(sombrear('#808080', 0.5)).toBe('#404040');
    expect(sombrear('#000000', 2)).toBe('#ffffff');
    expect(sombrear('rgb(1,2,3)', 0.5)).toBe('rgb(1,2,3)');
  });
});

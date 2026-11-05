import { describe, expect, it } from 'vitest';
import { desempacarBits, disponerAtlas, disponerHoja, recorteCuadrado, tiemposFotogramas } from './modelo.ts';

describe('scan geometry', () => {
  it('samples 12 keyframes inside the clip and caps it at 30 s', () => {
    const t = tiemposFotogramas(15);
    expect(t).toHaveLength(12);
    expect(t[0]).toBeGreaterThan(0);
    expect(t.at(-1)).toBeLessThan(15);
    expect(tiemposFotogramas(90).at(-1)).toBeLessThan(30);
  });

  it('tiles the sheet with gutters so cells never touch', () => {
    const h = disponerHoja(12, 200, 356);
    expect(h.columnas).toBe(6);
    expect(h.celdas[3]).toEqual({ x: 696, y: 24, w: 200, h: 356 });
    expect(h.celdas[6]!.y).toBe(404);
    expect(h.ancho).toBe(1368);
    expect(h.alto).toBe(784);
  });

  it('unpacks MSB-first bits', () => {
    expect([...desempacarBits(btoa(String.fromCharCode(0x81, 0x80)), 3, 3)]).toEqual([1, 0, 0, 0, 0, 0, 0, 1, 1]);
  });

  it('lays out the atlas and crops a padded square around the object', () => {
    expect(disponerAtlas(12)).toEqual({ columnas: 4, filas: 3 });
    const r = recorteCuadrado({ x: 10, y: 20, w: 100, h: 50 }, 400, 400, 0.1);
    expect(r.w).toBeCloseTo(120);
    expect(r.x + r.w / 2).toBe(60);
    expect(recorteCuadrado(null, 200, 400).w).toBe(180);
  });
});

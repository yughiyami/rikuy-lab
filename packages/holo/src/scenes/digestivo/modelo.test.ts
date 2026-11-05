import { describe, expect, it } from 'vitest';
import { NIVEL_MAX, faseLactosa, nivelValido, organoEn, suavizar, zoomSemantico } from './modelo.ts';

describe('digestivo: semantic zoom', () => {
  it('dives one level when the pinch zoom passes the threshold and snaps the zoom back', () => {
    expect(zoomSemantico(0, 2)).toEqual({ nivel: 1, reiniciarZoom: true });
    expect(zoomSemantico(2, 1.95)).toEqual({ nivel: 3, reiniciarZoom: true });
  });

  it('goes back one level when zooming out, never below the whole tract', () => {
    expect(zoomSemantico(2, 0.5)).toEqual({ nivel: 1, reiniciarZoom: true });
    expect(zoomSemantico(0, 0.4)).toEqual({ nivel: 0, reiniciarZoom: false });
  });

  it('stays at the molecule level and inside the normal zoom band', () => {
    expect(zoomSemantico(NIVEL_MAX, 3)).toEqual({ nivel: 3, reiniciarZoom: false });
    expect(zoomSemantico(1, 1.2)).toEqual({ nivel: 1, reiniciarZoom: false });
  });

  it('clamps any level coming from the network', () => {
    expect(nivelValido(undefined)).toBe(0);
    expect(nivelValido(Number.NaN)).toBe(0);
    expect(nivelValido(7)).toBe(3);
    expect(nivelValido(-2)).toBe(0);
    expect(nivelValido(1.6)).toBe(2);
  });
});

describe('digestivo: the journey of lactose', () => {
  it('visits the organs in anatomical order', () => {
    expect([0.01, 0.1, 0.2, 0.5, 0.9].map(organoEn)).toEqual(['boca', 'esofago', 'estomago', 'intestino_delgado', 'intestino_grueso']);
  });

  it('with lactase: lactose is split and absorbed in the small intestine, no gas', () => {
    const fin = faseLactosa(0.72, true);
    expect(fin.lactosa).toBeCloseTo(0);
    expect(fin.absorbido).toBeCloseTo(1);
    expect(faseLactosa(1, true).gas).toBe(0);
  });

  it('without lactase: lactose reaches the large intestine intact and is fermented into gas', () => {
    expect(faseLactosa(0.72, false).lactosa).toBe(1);
    expect(faseLactosa(0.72, false).absorbido).toBe(0);
    const fin = faseLactosa(1, false);
    expect(fin.gas).toBeCloseTo(1);
    expect(fin.lactosa).toBeLessThan(0.2);
  });

  it('eases dives smoothly from 0 to 1', () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(1)).toBe(1);
    expect(suavizar(0.5)).toBeCloseTo(0.5);
    expect(suavizar(2)).toBe(1);
  });
});

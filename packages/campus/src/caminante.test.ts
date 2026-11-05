import { describe, expect, it } from 'vitest';
import { avanzar, chunksVisibles, encuadrar, zoomQueCubre, zoomQueEncuadra } from './caminante.ts';

describe('path walker', () => {
  it('walks along the path at the given speed and consumes reached waypoints', () => {
    const r = avanzar({ x: 0.5, y: 0.5 }, [{ x: 1.5, y: 0.5 }, { x: 1.5, y: 1.5 }], 4, 0.25);
    expect(r.pos).toEqual({ x: 1.5, y: 0.5 });
    expect(r.camino).toEqual([{ x: 1.5, y: 1.5 }]);
    expect(r.dir).toBe(0); // east
  });

  it('stops exactly on the last waypoint', () => {
    const r = avanzar({ x: 0.5, y: 0.5 }, [{ x: 0.5, y: 1.5 }], 4, 1);
    expect(r.pos).toEqual({ x: 0.5, y: 1.5 });
    expect(r.camino).toEqual([]);
    expect(r.dir).toBe(2); // south
  });

  it('does nothing without a path', () => {
    expect(avanzar({ x: 2, y: 2 }, [], 4, 1)).toEqual({ pos: { x: 2, y: 2 }, camino: [], dir: undefined });
  });
});

describe('camera and chunks', () => {
  it('centres the camera on the player and clamps it to the map', () => {
    expect(encuadrar({ x: 10, y: 10 }, { ancho: 30, alto: 22 }, { ancho: 11, alto: 14 })).toEqual({ x: 4.5, y: 3 });
    expect(encuadrar({ x: 1, y: 1 }, { ancho: 30, alto: 22 }, { ancho: 11, alto: 14 })).toEqual({ x: 0, y: 0 });
    // map smaller than the view: centred
    expect(encuadrar({ x: 1, y: 1 }, { ancho: 8, alto: 8 }, { ancho: 11, alto: 14 })).toEqual({ x: -1.5, y: -3 });
  });

  it('lists only the 16x16 chunks that intersect the view', () => {
    expect(chunksVisibles({ x: 0, y: 0 }, { ancho: 11, alto: 14 }, { ancho: 40, alto: 40 })).toEqual([[0, 0]]);
    expect(chunksVisibles({ x: 10, y: 10 }, { ancho: 11, alto: 14 }, { ancho: 40, alto: 40 })).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
  });
});

describe('zoomQueEncuadra (desktop stage)', () => {
  it('frames the whole map in the viewport, within the limits', () => {
    expect(zoomQueEncuadra({ ancho: 18, alto: 13 }, { ancho: 720, alto: 800 }, 32)).toBe(1.25);
    expect(zoomQueEncuadra({ ancho: 10, alto: 8 }, { ancho: 2000, alto: 2000 }, 32)).toBe(2.5);
    expect(zoomQueEncuadra({ ancho: 60, alto: 40 }, { ancho: 800, alto: 600 }, 32)).toBe(1);
    expect(zoomQueEncuadra({ ancho: 60, alto: 40 }, { ancho: 800, alto: 600 }, 32, 0.5)).toBe(0.5);
    expect(zoomQueEncuadra({ ancho: 60, alto: 40 }, { ancho: 800, alto: 600 }, 32, 0.3)).toBe(0.42);
    expect(zoomQueEncuadra({ ancho: 0, alto: 0 }, { ancho: 800, alto: 600 }, 32)).toBe(1);
  });
});

describe('zoomQueCubre', () => {
  it('fills a tall stage with a wide hall (no empty bands), within the clamp', () => {
    expect(zoomQueCubre({ ancho: 20, alto: 14 }, { ancho: 640, alto: 800 }, 32, 1, 3)).toBe(1.79);
    expect(zoomQueCubre({ ancho: 20, alto: 14 }, { ancho: 640, alto: 800 }, 32, 1, 1.5)).toBe(1.5);
    expect(zoomQueCubre({ ancho: 0, alto: 14 }, { ancho: 640, alto: 800 }, 32)).toBe(1);
  });
});

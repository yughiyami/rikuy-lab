import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneManager } from '../../engine/SceneManager.ts';
import { ViewController } from '../../engine/ViewController.ts';
import type { SceneContext } from '../types.ts';
import { digestivo } from './escena.ts';
import { GALACTOSA, GLUCOSA, LACTOSA, PROTEINA_CA, SITIO_ACTIVO } from './estructuras.ts';

const ctx = (variables: Record<string, number>): SceneContext => ({ running: true, time: 0, variables, releases: 0 });

describe('digestivo scene', () => {
  it('builds the whole tract and dives through every level, keeping at most two levels alive', () => {
    const s = digestivo();
    const root = s.build();
    expect(s.niveles).toBe(4);
    const c = ctx({ nivel: 0, lactasa: 1 });
    for (const nivel of [1, 2, 3, 2, 0]) {
      c.variables.nivel = nivel;
      for (let i = 0; i < 4; i++) {
        c.time += 0.05;
        s.update!(0.05, c);
        expect(root.children.length).toBeLessThanOrEqual(2);
      }
      for (let i = 0; i < 40; i++) s.update!(0.05, c);
      expect(root.children.length).toBe(1);
    }
    expect(s.readout!(c)).toEqual({ label: 'Nivel 1 · Tubo digestivo', value: 'con lactasa' });
    c.variables.lactasa = 0;
    expect(s.readout!(c)?.value).toBe('sin lactasa (intolerancia)');
    s.dispose!();
  });

  it('runs the molecular level with and without lactase', () => {
    const s = digestivo();
    s.build();
    const c = ctx({ nivel: 3, lactasa: 0 });
    for (let i = 0; i < 200; i++) s.update!(0.05, c);
    c.variables.lactasa = 1;
    for (let i = 0; i < 200; i++) s.update!(0.05, c);
    expect(s.highlight!('sitio activo')).toBe(true);
  });

  it('ships real coordinates: a C-alpha trace and three sugars', () => {
    expect(PROTEINA_CA.length / 3).toBeGreaterThan(900);
    expect(SITIO_ACTIVO).toHaveLength(3);
    expect(LACTOSA.elementos).toHaveLength(23); // C12H22O11 heavy atoms
    expect(GLUCOSA.elementos).toHaveLength(12);
    expect(GALACTOSA.elementos).toHaveLength(12);
  });
});

describe('semantic zoom in the scene manager', () => {
  it('a pinch past the edge dives one level and snaps the zoom back', () => {
    const pivot = new THREE.Group();
    const view = new ViewController(pivot);
    const m = new SceneManager(pivot, view, { modelsBaseUrl: 'http://invalid.local/' });
    m.current = digestivo(); // the morph needs a render loop; the manager logic does not
    m.zoom(1.5);
    expect(m.ctx.variables.nivel ?? 0).toBe(0);
    m.zoom(1.5);
    expect(m.ctx.variables.nivel).toBe(1);
    expect(view.targetZoom).toBe(1);
    m.profundizar(1);
    m.profundizar(1);
    m.profundizar(1);
    expect(m.ctx.variables.nivel).toBe(3);
    m.apply([{ tool: 'fijar_variable', args: { variable: 'profundizar', valor: -1 } }]);
    expect(m.ctx.variables.nivel).toBe(2);
  });
});

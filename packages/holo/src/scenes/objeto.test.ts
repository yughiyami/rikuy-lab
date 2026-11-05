import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { SCENES } from './registry.ts';
import { objeto } from './objeto.ts';
import { fijarObjetoHolograma, vistaParaAngulo } from './objetoDatos.ts';

afterEach(() => fijarObjetoHolograma(null));

describe('objeto scene (360° view from a video)', () => {
  it('maps the viewing angle to the nearest captured view, wrapping around', () => {
    expect(vistaParaAngulo(0, 12)).toBe(0);
    expect(vistaParaAngulo(Math.PI, 12)).toBe(6);
    expect(vistaParaAngulo(-Math.PI / 6, 12)).toBe(11);
    expect(vistaParaAngulo(2 * Math.PI - 0.01, 12)).toBe(0);
  });

  it('is registered and builds an empty group without a scanned object', () => {
    expect(Object.keys(SCENES)).toContain('objeto');
    expect(objeto().build().children).toHaveLength(0);
  });

  it('builds the billboard with the atlas and an honest title, and frees it', () => {
    const atlas = { width: 8, height: 8 } as unknown as TexImageSource;
    fijarObjetoHolograma({ id: 'x', nombre: 'Raspberry Pi 4', atlas, columnas: 4, filas: 3, vistas: 12, aspecto: 0.6 });
    const s = objeto();
    const g = s.build();
    const quad = g.getObjectByName('vista360') as THREE.Mesh;
    const m = quad.material as THREE.ShaderMaterial;
    expect(m.uniforms.uVistas!.value).toBe(12);
    expect(m.uniforms.uColumnas!.value).toBe(4);
    expect(s.label).toBe('Raspberry Pi 4');
    const box = new THREE.Box3().setFromObject(g);
    expect(box.getSize(new THREE.Vector3()).y).toBeGreaterThan(1.5);
    s.dispose?.();
  });
});

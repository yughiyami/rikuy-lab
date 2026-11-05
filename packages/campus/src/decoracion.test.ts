import type { Exhibicion } from '@rikuy/contracts';
import { describe, expect, it } from 'vitest';
import { PLANTILLAS, SALAS_CONTENIDO } from './contenido.ts';
import { bloqueosDecor, decoracionDe } from './decoracion.ts';
import { generarMuseo } from './generador.ts';
import { buscarCamino, distanciaARect } from './grilla.ts';

const ALCANCE_PRUEBA = 1.5; // same reach as the world controller

const exhs: Exhibicion[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].flatMap((p, i) =>
  ['sala-fisica', 'sala-biologia', 'sala-quimica', 'sala-tierra', 'sala-taller'].map((salaId) => ({
    id: `${salaId}-${i}`,
    salaId,
    practicaId: '01JC0000000000000000000P01',
    pedestal: p,
    recursos: [],
  })),
);

const museo = generarMuseo({
  salas: SALAS_CONTENIDO,
  exhibiciones: exhs,
  retos: Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, titulo: `Reto ${i}` })),
  plantillas: PLANTILLAS,
  rejasAbiertas: new Set(SALAS_CONTENIDO.map((s) => s.id)),
});
const escenas = [museo.vestibulo, ...Object.values(museo.salas)];

const solapa = (a: { x: number; y: number; ancho: number; alto: number }, b: typeof a) =>
  a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;

describe('decoracionDe', () => {
  it('themes each science hall with its own signature object', () => {
    const firma = (id: string) => decoracionDe(id, 'sala-tematica').find((d) => d.pieza === 'pendulo' || d.pieza === 'microscopio' || d.pieza === 'matraz' || d.pieza === 'roca' || d.pieza === 'yunque')?.pieza;
    expect(firma('sala-fisica')).toBe('pendulo');
    expect(firma('sala-biologia')).toBe('microscopio');
    expect(firma('sala-quimica')).toBe('matraz');
    expect(decoracionDe('x', 'desconocida')).toEqual([]);
  });

  it('only rugs and wall hangings let people through', () => {
    const d = decoracionDe('sala-fisica', 'sala-tematica');
    expect(d.filter((x) => !x.bloquea).every((x) => x.pieza === 'alfombra' || x.pared)).toBe(true);
    expect(bloqueosDecor([{ pieza: 'banco', x: 2, y: 3, ancho: 2, alto: 1, bloquea: true }])).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
  });

  for (const e of escenas) {
    describe(e.id, () => {
      it('wall pieces hang on walls and floor pieces stand on free floor, away from doors, NPCs and pedestals', () => {
        const { mapa } = e;
        for (const d of e.decoracion) {
          for (let y = d.y; y < d.y + d.alto; y++) {
            for (let x = d.x; x < d.x + d.ancho; x++) {
              const i = y * mapa.ancho + x;
              if (d.pared) expect(mapa.muros[i], `${d.pieza} at ${x},${y}`).not.toBe(0);
              else expect(mapa.muros[i] === 0 && mapa.suelo[i] !== 0, `${d.pieza} at ${x},${y}`).toBe(true);
            }
          }
          if (!d.bloquea) continue;
          for (const o of mapa.objetos) {
            if (o.tipo === 'zona') continue;
            expect(solapa(d, o), `${d.pieza} overlaps ${o.tipo} ${o.nombre}`).toBe(false);
          }
        }
      });

      it('every destination stays reachable from the spawn point', () => {
        for (const d of e.destinos) {
          const camino = buscarCamino(e.grilla, e.aparicion, (x, y) => distanciaARect(x + 0.5, y + 0.5, d.rect) <= ALCANCE_PRUEBA);
          expect(camino, `${e.id} → ${d.id}`).not.toBeNull();
        }
      });
    });
  }
});

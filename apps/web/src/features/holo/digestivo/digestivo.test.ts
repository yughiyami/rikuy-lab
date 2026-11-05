import { citaLiteral } from '@rikuy/curriculum-cneb';
import { describe, expect, it } from 'vitest';
import { CNEB_DIGESTIVO, idCompetencia, rutaParaTema, textoCneb } from './cneb.ts';
import { GUION, avanzarGuia, pasoDeNivel, reaccion, valorarExplicacion, type EstadoGuia } from './guion.ts';

describe('CNEB linkage of the digestive hologram', () => {
  it('every level points at real competencies, capacities and performances of the official subset', () => {
    for (const refs of Object.values(CNEB_DIGESTIVO)) {
      expect(refs.length).toBeGreaterThan(0);
      for (const r of refs) {
        const t = textoCneb(r);
        expect(t, idCompetencia(r)).toBeDefined();
        // The stored texts are verbatim: a literal-quote check against the subset passes.
        expect(citaLiteral({ nivel: r.nivel, grado: r.grado, area: 'ciencia-y-tecnologia', competencia: r.competencia, desempeno: r.desempeno, cita: t!.desempeno.slice(0, 60) })).toBe(true);
      }
    }
    expect(textoCneb(CNEB_DIGESTIVO[0][0])?.competencia).toMatch(/^Explica el mundo físico basándose en conocimientos sobre los seres vivos/);
    expect(textoCneb(CNEB_DIGESTIVO[0][1])?.competencia).toMatch(/^Indaga/);
  });

  it('opens the scene at the right level from a CNEB id or from the topic text', () => {
    expect(rutaParaTema('secundaria-2:cyt:c2:d8')).toEqual({ escena: 'digestivo', nivel: 0, ruta: '/holo/ver/digestivo?nivel=0' });
    expect(rutaParaTema({ competenciaId: 'secundaria-1:cyt:c2', desempeno: 5 })?.nivel).toBe(2);
    expect(rutaParaTema('La digestión de los alimentos')?.nivel).toBe(0);
    expect(rutaParaTema('Sistema digestivo')?.nivel).toBe(0);
    expect(rutaParaTema('Intolerancia a la lactosa en el Perú')?.nivel).toBe(3);
    expect(rutaParaTema('Las enzimas son proteínas')?.nivel).toBe(3);
    expect(rutaParaTema('Las vellosidades intestinales')?.nivel).toBe(2);
    expect(rutaParaTema('secundaria-2:cyt:c3:d1')).toBeNull();
    expect(rutaParaTema('El movimiento de un péndulo')).toBeNull();
  });
});

describe("Rikuy's guide: predict -> observe -> explain", () => {
  it('has one level per depth, each with exactly one right option and something to reveal', () => {
    expect(GUION.map((p) => p.nivel)).toEqual([0, 1, 2, 3]);
    for (const p of GUION) {
      expect(p.opciones.filter((o) => o.correcta)).toHaveLength(1);
      expect(p.revelar.length).toBeGreaterThan(0);
      expect(p.pregunta.endsWith('?')).toBe(true);
    }
  });

  it('never reveals before the students commit a prediction', () => {
    let e: EstadoGuia = { nivel: 0, fase: 'narracion', prediccion: null };
    e = avanzarGuia(e, { tipo: 'siguiente' });
    expect(e.fase).toBe('pregunta');
    expect(avanzarGuia(e, { tipo: 'siguiente' }).fase).toBe('pregunta');
    expect(avanzarGuia(e, { tipo: 'predecir', opcion: 'zz' }).fase).toBe('pregunta');
    e = avanzarGuia(e, { tipo: 'predecir', opcion: 'b' });
    expect(e).toEqual({ nivel: 0, fase: 'observacion', prediccion: 'b' });
    e = avanzarGuia(e, { tipo: 'siguiente' });
    expect(e.fase).toBe('explicacion');
    expect(avanzarGuia(e, { tipo: 'nivel', nivel: 2 })).toEqual({ nivel: 2, fase: 'narracion', prediccion: null });
    expect(avanzarGuia(e, { tipo: 'nivel', nivel: 0 })).toBe(e);
  });

  it('reacts to the prediction without grading it', () => {
    const p = pasoDeNivel(2);
    expect(reaccion(p, 'b')).toMatch(/coincide/);
    expect(reaccion(p, 'a')).toMatch(/Compara/);
  });

  it('judges the explanation with the F4 rules judge (literal quote, NO when not assessable)', () => {
    const p = pasoDeNivel(3);
    const buena = valorarExplicacion('Deja de funcionar porque el calor cambia la forma de la proteína y el sitio activo ya no encaja', p);
    expect(buena.nivel).toBe(3);
    expect('Deja de funcionar porque el calor cambia la forma de la proteína y el sitio activo ya no encaja').toContain(buena.cita);
    expect(valorarExplicacion('', p).nivel).toBeNull();
  });
});

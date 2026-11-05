import { SCENE_IDS } from '@rikuy/core';
import { SCENES } from '@rikuy/holo/engine';
import { describe, expect, it } from 'vitest';
import { EXHIBICIONES_DEMO, escenaHoloDeExhibicion, practicaDeEscena } from './catalogo.ts';

describe('hologram scene of every museum exhibit', () => {
  it('has at least the three F9 exhibits', () => {
    expect(EXHIBICIONES_DEMO.map((e) => e.id).sort()).toEqual(['exh-lactasa', 'exh-pendulo', 'exh-respiracion']);
  });

  it.each(EXHIBICIONES_DEMO.map((e) => [e.id] as const))('%s: its /holo/ver scene is registered, declared and builds a model', (id) => {
    const escena = escenaHoloDeExhibicion(id);
    expect(escena, `exhibit ${id} has no hologram scene`).toBeTruthy();
    expect(Object.keys(SCENES)).toContain(escena);
    expect(SCENE_IDS as readonly string[]).toContain(escena);
    const modulo = SCENES[escena!]!();
    expect(modulo.id).toBe(escena);
    expect(modulo.build().children.length).toBeGreaterThan(0);
  });

  it('resolves the practice of a scene (title and hints for the viewer)', () => {
    expect(practicaDeEscena('lactasa')?.titulo).toBe('¿Cómo digiere la leche nuestro cuerpo?');
    expect(practicaDeEscena('respiratorio')?.titulo).toBeTruthy();
    expect(practicaDeEscena('digestivo')?.titulo).toBe('¿Cómo digiere la leche nuestro cuerpo?');
    expect(escenaHoloDeExhibicion('exh-lactasa')).toBe('digestivo');
    expect(practicaDeEscena('pendulo')?.titulo).toBeTruthy();
  });

  it('answers undefined for an unknown exhibit', () => {
    expect(escenaHoloDeExhibicion('exh-no-existe')).toBeUndefined();
  });
});

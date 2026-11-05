import { construirIndice, type Fragmento } from '@rikuy/curriculum-cneb';
import { describe, expect, it } from 'vitest';
import { afirmacionFundamentada, fundamentoCurricular } from './fundamento.ts';

const f = (id: string, texto: string, verificado = true): Fragmento => ({ id, texto, fuente: { documento: 'CNEB', seccion: 'C20', pagina: 125, verificado } });
const indice = construirIndice([f('a', 'Analiza tendencias o relaciones en los datos y formula conclusiones.'), f('b', 'La lactasa digiere la lactosa.', false)]);

describe('fundamentoCurricular', () => {
  it('returns the best chunk with a human citation', () => {
    const r = fundamentoCurricular('¿cómo formulo conclusiones con mis datos?', indice);
    expect(r?.fragmento.id).toBe('a');
    expect(r?.cita).toContain('pág. 125');
  });
  it('marks unverified sources in the citation and returns nothing when there is no match', () => {
    expect(fundamentoCurricular('lactosa', indice)?.cita).toContain('por verificar');
    expect(fundamentoCurricular('hola', indice)).toBeUndefined();
  });
});

describe('afirmacionFundamentada', () => {
  it('accepts a CNEB quote only when it is literally inside a retrieved chunk', () => {
    const recuperados = indice.buscar('conclusiones datos').map((x) => x.fragmento);
    expect(afirmacionFundamentada('formula conclusiones', recuperados)).toBe(true);
    expect(afirmacionFundamentada('Formula   CONCLUSIONES.', recuperados)).toBe(true);
    expect(afirmacionFundamentada('diseña prototipos', recuperados)).toBe(false);
    expect(afirmacionFundamentada('formula conclusiones', [])).toBe(false);
  });
});

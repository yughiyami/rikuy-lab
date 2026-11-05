import { describe, expect, it } from 'vitest';
import { construirIndice, corpusCneb, raiz, tokenizar, type Fragmento } from './index.ts';

describe('tokenizar', () => {
  it('lowercases, strips accents and stopwords, and stems Spanish plurals and suffixes', () => {
    expect(tokenizar('Las Hipótesis de los científicos')).toEqual(['hipotesi', 'cientif']);
    expect(raiz('variables')).toBe(raiz('variable'));
    expect(raiz('indagación')).toBe(raiz('indagaciones'));
  });
});

const doc = (id: string, texto: string): Fragmento => ({ id, texto, fuente: { documento: 'D', seccion: 'S', pagina: 1, verificado: true } });

describe('construirIndice (BM25)', () => {
  const indice = construirIndice([
    doc('a', 'El péndulo oscila y su periodo depende de la longitud.'),
    doc('b', 'La enzima lactasa digiere la lactosa de la leche.'),
    doc('c', 'Formula hipótesis sobre variables que influyen en un fenómeno.'),
  ]);

  it('ranks the chunk that shares the rare terms first, accent-insensitive', () => {
    expect(indice.buscar('periodo del pendulo')[0]?.fragmento.id).toBe('a');
    expect(indice.buscar('LACTASA')[0]?.fragmento.id).toBe('b');
    expect(indice.buscar('hipotesis y variable')[0]?.fragmento.id).toBe('c');
  });

  it('returns nothing for an empty or unknown query and honours the limit', () => {
    expect(indice.buscar('')).toEqual([]);
    expect(indice.buscar('xilófono')).toEqual([]);
    expect(indice.buscar('la el de', 1)).toEqual([]);
  });

  it('returns the exact source with each result', () => {
    const [r] = indice.buscar('lactosa');
    expect(r?.fragmento.fuente).toEqual({ documento: 'D', seccion: 'S', pagina: 1, verificado: true });
    expect(r?.puntaje).toBeGreaterThan(0);
  });
});

describe('corpusCneb', () => {
  const corpus = corpusCneb();

  it('includes official CNEB paragraphs with PDF page, and secondary performances flagged as unverified', () => {
    const oficial = corpus.find((f) => f.fuente.documento.startsWith('Currículo Nacional'));
    expect(oficial?.fuente.pagina).toBeGreaterThan(0);
    expect(oficial?.fuente.verificado).toBe(true);
    const desempeno = corpus.find((f) => f.id.startsWith('desempeno:secundaria-2:'));
    expect(desempeno?.fuente.verificado).toBe(false);
    expect(desempeno?.fuente.pagina).toBeNull();
  });

  it('finds the official C20 standard for cycle VI on its PDF page', () => {
    const r = construirIndice(corpus).buscar('plan de recojo de datos hipótesis verificables', 3);
    const estandar = r.find((x) => x.fragmento.id === 'estandar:VI:1');
    expect(estandar?.fragmento.fuente.pagina).toBe(125);
    expect(estandar?.fragmento.fuente.verificado).toBe(true);
  });

  it('adds extra chunks (teacher plan, practices) to the same index', () => {
    const extra = doc('plan:1', 'Sesión sobre fotosíntesis en el biohuerto escolar');
    const r = construirIndice([...corpus, extra]).buscar('biohuerto');
    expect(r[0]?.fragmento.id).toBe('plan:1');
  });
});

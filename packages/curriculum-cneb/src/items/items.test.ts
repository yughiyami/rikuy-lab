import { describe, expect, it } from 'vitest';
import { ETIQUETA_PRACTICA, ITEMS, etiquetaProcedencia, puntuar, validarItem, type ItemEvaluacion } from './index.ts';

const base: ItemEvaluacion = {
  id: 'x1',
  tema: 'pendulo',
  tipo: 'opcion-multiple',
  enunciado: 'E',
  opciones: [
    { clave: 'A', texto: 'a' },
    { clave: 'B', texto: 'b' },
  ],
  respuestaCorrecta: 'B',
  rubrica: null,
  textoLiteral: true,
  requiereFigura: false,
  competencia: 1,
  capacidad: 'Analiza datos e información',
  grado: 2,
  fuente: { titulo: 'T', institucion: 'I', anio: 2019, url: 'https://umc.minedu.gob.pe/x.pdf', pagina: 3, codigoItem: null },
  licencia: { nombre: 'L', url: null, textoLiteral: null, permiteTextoCompleto: true },
  validacion: 'fuente-oficial',
};

describe('validarItem', () => {
  it('accepts a sourced official item', () => expect(validarItem(base)).toEqual([]));
  it('requires a URL for official items', () => {
    expect(validarItem({ ...base, fuente: { ...base.fuente, url: '' } })).toContain('falta la URL de la fuente');
  });
  it('forbids verbatim text when the licence does not allow it', () => {
    expect(validarItem({ ...base, licencia: { ...base.licencia, permiteTextoCompleto: false } })).toContain('la licencia no permite texto literal');
  });
  it('requires a key that is one of the options', () => {
    expect(validarItem({ ...base, respuestaCorrecta: 'D' })).toContain('la clave no está entre las opciones');
  });
  it('every bundled item is valid', () => {
    for (const item of ITEMS) expect(validarItem(item), item.id).toEqual([]);
  });
});

describe('etiquetaProcedencia', () => {
  it('labels team practice items explicitly', () => {
    expect(etiquetaProcedencia({ ...base, validacion: 'practica-del-equipo' })).toBe(ETIQUETA_PRACTICA);
    expect(etiquetaProcedencia(base)).toContain('Validado: fuente oficial');
  });
});

describe('puntuar', () => {
  it('gives correct % overall, per item and per capacidad, with no ranking', () => {
    const otro = { ...base, id: 'x2', capacidad: 'Problematiza situaciones' };
    const r = puntuar(
      [base, otro],
      [
        { itemId: 'x1', respuesta: 'B' },
        { itemId: 'x1', respuesta: 'A' },
        { itemId: 'x2', respuesta: 'B' },
        { itemId: 'zz', respuesta: 'B' },
      ],
    );
    expect(r.total).toEqual({ correctas: 2, respondidas: 3, porcentaje: 67 });
    expect(r.porItem.x1).toEqual({ correctas: 1, respondidas: 2, porcentaje: 50 });
    expect(r.porCapacidad['Problematiza situaciones']?.porcentaje).toBe(100);
    expect(Object.keys(r)).not.toContain('ranking');
  });
  it('is 0 % with no answers instead of NaN', () => expect(puntuar([base], []).total.porcentaje).toBe(0));
});

import { ETIQUETA_PRACTICA, type ItemEvaluacion } from '@rikuy/curriculum-cneb';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BancoItemsVista } from './BancoItems.tsx';

const item: ItemEvaluacion = {
  id: 'p1', tema: 'pendulo', tipo: 'opcion-multiple', enunciado: '¿Qué variable cambia el periodo?', opciones: [{ clave: 'A', texto: 'La longitud' }],
  respuestaCorrecta: 'A', rubrica: null, textoLiteral: true, requiereFigura: false, competencia: 1, capacidad: 'Problematiza situaciones', grado: 1,
  fuente: { titulo: 'T', institucion: 'Equipo', anio: null, url: 'https://example.org', pagina: null, codigoItem: null },
  licencia: { nombre: 'MIT', url: null, textoLiteral: null, permiteTextoCompleto: true }, validacion: 'practica-del-equipo',
};

describe('BancoItemsVista', () => {
  it('labels team practice items and shows the source link', () => {
    render(<BancoItemsVista items={[item]} />);
    expect(screen.getByText(new RegExp(ETIQUETA_PRACTICA))).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver fuente' })).toBeTruthy();
  });
  it('says so when there are no items', () => {
    render(<BancoItemsVista items={[]} />);
    expect(screen.getByRole('status').textContent).toContain('Aún no hay ítems');
  });
});

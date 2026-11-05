import { construirIndice, corpusCneb } from '@rikuy/curriculum-cneb';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BuscarCurriculoVista } from './BuscarCurriculo.tsx';

describe('BuscarCurriculoVista', () => {
  it('shows CNEB chunks with their exact source', async () => {
    const indice = construirIndice(corpusCneb());
    render(<BuscarCurriculoVista buscar={(c) => indice.buscar(c, 5)} />);
    await userEvent.type(screen.getByLabelText('Qué buscas en el currículo'), 'plan de recojo de datos');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getAllByText(/pág\. 125 del PDF/).length).toBeGreaterThan(0);
  });
});

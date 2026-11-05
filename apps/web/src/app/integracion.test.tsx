import 'fake-indexeddb/auto';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useBandejaGuardian } from '../features/guardian/bandeja.ts';
import { renderApp } from '../test-utils.tsx';

const GRUPO = { rol: 'grupo', codigo: 'ABC123', apodo: 'Puma' } as const;

describe('every feature is reachable from the tabs', () => {
  it('the Lab tab opens the pendulum practice', async () => {
    const { router } = await renderApp('/museo', GRUPO);
    await userEvent.click(screen.getByRole('tab', { name: 'Lab' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/lab/pendulo'));
  });

  it('Yo leads to the check-in, the Caja de dudas, the pictogram builder and accessibility', async () => {
    await renderApp('/yo', GRUPO);
    for (const [nombre, ruta] of [
      ['¿Cómo vamos? Contarle a Rikuy', '/yo/checkin'],
      ['Tengo una duda', '/yo/dudas'],
      ['Armar una frase con pictogramas', '/lab/inicio'],
      ['Accesibilidad', '/yo/accesibilidad'],
    ] as const) {
      expect(screen.getByRole('link', { name: nombre })).toHaveAttribute('href', ruta);
    }
  });

  it('a doubt sent from Yo reaches the teacher heatmap tray without a name', async () => {
    await renderApp('/yo/dudas', GRUPO);
    await userEvent.click(await screen.findByRole('radio', { name: /Longitud de la cuerda/ }));
    await userEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    expect(await screen.findByText(/No lleva tu nombre/)).toBeInTheDocument();
    const [duda] = useBandejaGuardian.getState().dudas;
    expect(duda).toMatchObject({ conceptoId: 'longitud', exhibicionId: 'exh-pendulo' });
    expect(JSON.stringify(duda)).not.toContain('Puma');
  });

  it('the teacher sees the Guardián and doubt views under Clase and Reportes', async () => {
    const { router } = await renderApp('/docente/reportes/dudas', { rol: 'docente' });
    expect(await screen.findByRole('heading', { name: 'Caja de dudas de la clase' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Reportes' })).toHaveAttribute('aria-selected', 'true');
    await router.navigate('/docente/clase/acercarse');
    expect(await screen.findByText('Esta semana no hay sugerencias.')).toBeInTheDocument();
    expect(screen.getByText(/nivel 2\) están apagadas/)).toBeInTheDocument();
  });
});

describe('the museum group is the joined group (F1 session)', () => {
  it('uses the class code and nickname of the join, not the demo group', async () => {
    const { grupoActual } = await import('../features/mundo/grupo.ts');
    await renderApp('/museo', GRUPO);
    expect(grupoActual().apodo).toBe('Puma');
    expect(grupoActual().id).not.toBe('01JC0000000000000000000G01');
    expect(grupoActual().dispositivo).toHaveLength(10);
  });
});

describe('museum exhibits open their F9 practice', () => {
  it('the pendulum exhibit opens the lab and the others their hologram scene', async () => {
    const { router } = await renderApp('/exhibicion/exh-pendulo', GRUPO);
    await waitFor(() => expect(router.state.location.pathname).toBe('/lab/pendulo'));
    await router.navigate('/exhibicion/exh-lactasa');
    await waitFor(() => expect(router.state.location.pathname).toBe('/holo/ver/digestivo'));
    // opened from the museum: the way back is the museum, not the hologram hub; no pendulum wording on the lactase scene
    expect(await screen.findByRole('link', { name: /Volver al museo/ })).toHaveAttribute('href', '/museo');
    expect(screen.queryByText(/Soltar el péndulo/)).toBeNull();
  });
});

describe('golden demo (Ajustes > Cargar demo)', () => {
  it('loads 2.º B with 4 groups, Yeni\'s literal quote and the example Guardián and doubt trays', async () => {
    const { router } = await renderApp('/docente/ajustes', { rol: 'docente' });
    await userEvent.click(await screen.findByRole('button', { name: 'Cargar demo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cargar la demo' }));
    expect(await screen.findByText(/Demo cargada/)).toBeInTheDocument();
    expect(screen.getAllByText(/2\.º B/).length).toBeGreaterThan(0);
    // the class line of the panel follows the loaded class (it used to keep the example fixture's section A)
    expect(screen.getByText('2.º B · Ciencia y Tec.')).toBeInTheDocument();
    expect(screen.queryByText(/2\.º A/)).toBeNull();

    await router.navigate('/docente/evidencia/evidencias');
    expect(await screen.findByText(/si la cuerda es más larga tarda más en volver/)).toBeInTheDocument();
    // confirmed quotes are not counted as pending: 8 quotes, 2 already confirmed by the teacher
    expect(screen.getByRole('note').textContent).toMatch(/Ves 6 frases por confirmar y 2 ya confirmadas/);

    await router.navigate('/docente/clase/acercarse');
    expect(await screen.findByText('Pidió hablar con usted.')).toBeInTheDocument();
    await router.navigate('/docente/reportes/curso');
    expect(await screen.findByText(/6 participan|6 de/)).toBeInTheDocument();
    await router.navigate('/docente/reportes/dudas');
    expect(await screen.findByRole('heading', { name: 'Caja de dudas de la clase' })).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay dudas.')).toBeNull();
  });
});

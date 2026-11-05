import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRACTICA_DEMO, visorSimulado } from './demo.ts';
import { crearClienteTutorNube, type ClienteTutorNube } from './nube.ts';
import { TutorPanel } from './TutorPanel.tsx';

afterEach(cleanup);

function nubeFalsa(turno: ClienteTutorNube['turno']): ClienteTutorNube {
  return {
    turno,
    juzgar: vi.fn(),
    voz: async () => null,
    transcribir: async () => null,
    dibujo: async () => ({ error: 'x' }),
    uso: async () => null,
  } as unknown as ClienteTutorNube;
}

async function decir(texto: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /escribe/i }), texto);
  await user.click(screen.getByRole('button', { name: /enviar/i }));
}

describe('live tutor in the panel', () => {
  it('shows the live reply with the IA badge and the live indicator', async () => {
    const turno = vi.fn(async () => ({ ok: true as const, valor: { texto: '¿Qué cambió entre 0,3 m y 0,9 m en tus datos?', simulado: false } }));
    render(<TutorPanel practica={PRACTICA_DEMO} visor={visorSimulado()} grupoId="G1" eventosInterruptor={[]} nube={nubeFalsa(turno)} datos={[{ x: 0.3, y: 1.1 }]} />);
    await decir('¿por qué tarda más?');
    expect(await screen.findByText(/Qué cambió entre 0,3 m/)).toBeTruthy();
    expect(screen.getByText('IA en vivo')).toBeTruthy();
    expect(screen.getAllByText('IA en línea').length).toBeGreaterThan(0);
    expect(turno).toHaveBeenCalledWith(expect.objectContaining({ mensaje: '¿por qué tarda más?', datos: [{ x: 0.3, y: 1.1 }] }), 4500);
  });

  it('falls back to the rules agent and says so when there is no network', async () => {
    render(<TutorPanel practica={PRACTICA_DEMO} visor={visorSimulado()} grupoId="G1" eventosInterruptor={[]} nube={nubeFalsa(async () => ({ ok: false, motivo: 'sin-red' }))} />);
    await decir('dame una pista');
    expect(await screen.findByText(/Te doy una pista, no la respuesta/)).toBeTruthy();
    expect(screen.getByText('Sin red: modo reglas')).toBeTruthy();
    expect(screen.getAllByText('Reglas').length).toBeGreaterThan(0);
  });
});

describe('cloud client', () => {
  it('reports sin-red when fetch fails and judges with rules', async () => {
    const c = crearClienteTutorNube({ baseUrl: 'http://x', colegioId: 'c-1', fetch: async () => Promise.reject(new TypeError('offline')) });
    expect(await c.turno({ mensaje: 'hola' })).toEqual({ ok: false, motivo: 'sin-red' });
    const v = await c.juzgar({ indicador: 'prediccion', respuesta: 'si alargo la cuerda tarda más', contexto: { variables: [{ id: 'longitud' }], variableProbada: 'longitud' }, datos: [] });
    expect(v.fuente).toBe('reglas');
  });
});

import { describe, expect, it } from 'vitest';
import { crearApp } from './app.ts';
import { crearDepsSimuladas } from './deps.ts';

const H = { 'content-type': 'application/json', 'x-rikuy-colegio': 'colegio-demo' };

describe('live tutor routes (mock)', () => {
  const app = crearApp(crearDepsSimuladas());
  it('answers a Socratic turn', async () => {
    const r = await app.request('/ia/tutor/turno', { method: 'POST', headers: H, body: JSON.stringify({ mensaje: '¿por qué tarda más?', datos: [{ x: 0.3, y: 1.1 }] }) });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { texto: string; fuente: string; simulado: boolean };
    expect(j.texto).toMatch(/\?$/);
    expect(j).toMatchObject({ fuente: 'ia-nube', simulado: true });
  });
  it('judges with the rules fallback when no model judges', async () => {
    const r = await app.request('/ia/tutor/juzgar', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ indicador: 'prediccion', respuesta: 'si alargo la cuerda tarda más', contexto: { variables: [{ id: 'longitud', etiqueta: 'Longitud de la cuerda' }], variableProbada: 'longitud' } }),
    });
    const j = (await r.json()) as { veredicto: { fuente: string; cita: string } };
    expect(j.veredicto.fuente).toBe('reglas');
  });
  it('voice is unavailable in mock mode (web falls back to Web Speech)', async () => {
    const r = await app.request('/ia/voz', { method: 'POST', headers: H, body: JSON.stringify({ texto: 'Hola' }) });
    expect(r.status).toBe(503);
  });
  it('rejects malformed turns', async () => {
    const r = await app.request('/ia/tutor/turno', { method: 'POST', headers: H, body: '{}' });
    expect(r.status).toBe(400);
  });
});

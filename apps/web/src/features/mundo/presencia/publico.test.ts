import { describe, expect, it } from 'vitest';
import { leerMensajePublico, sanitizarApodo } from './publico.ts';

describe('sala del público', () => {
  it('cleans free nicknames with the chat rules and caps them at 16 characters', () => {
    expect(sanitizarApodo('  Ana  ')).toBe('Ana');
    expect(sanitizarApodo('un apodo larguísimo de verdad')).toHaveLength(16);
    expect(sanitizarApodo('www.spam.com')).toBeNull();
    expect(sanitizarApodo('987654321')).toBeNull();
    expect(sanitizarApodo('')).toBeNull();
    expect(sanitizarApodo('idiota')).toBe('***');
  });

  it('parses peers, positions and grades, and drops anything else', () => {
    expect(leerMensajePublico({ type: 'peers', roles: ['control', 'panel'] })).toEqual({ tipo: 'pares', roles: ['control', 'panel'] });
    const pos = leerMensajePublico({ type: 'event', event: 'publico.pos', id: 'pub-1', apodo: 'Lu', x: 3, y: 4, dir: 9, ts: 1 });
    expect(pos).toEqual({ tipo: 'pos', pos: { id: 'pub-1', apodo: 'Lu', x: 3, y: 4, dir: 7, ts: 1 } });
    const c = leerMensajePublico({ type: 'event', event: 'publico.calificacion', apodo: 'Lu', nivel: 2, cita: 'más lento', fuente: 'reglas', ts: 5 });
    expect(c).toEqual({ tipo: 'calificacion', calificacion: { apodo: 'Lu', nivel: 2, cita: 'más lento', fuente: 'reglas', ts: 5 } });
    expect(leerMensajePublico({ type: 'event', event: 'publico.calificacion', apodo: 'Lu', nivel: 9, cita: '', fuente: '', ts: 1 })).toBeNull();
    expect(leerMensajePublico({ type: 'event', event: 'otro', apodo: 'Lu' })).toBeNull();
    expect(leerMensajePublico({ type: 'state' })).toBeNull();
  });
});

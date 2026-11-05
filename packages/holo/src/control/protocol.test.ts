import { BusMessage } from '@rikuy/contracts';
import { describe, expect, it } from 'vitest';
import { actionLabel, actionToMessage, messageToActions, type ViewerAction } from './protocol.ts';

describe('control protocol (two-phone hologram over BusMessage)', () => {
  const cases: Array<[ViewerAction, unknown]> = [
    [{ type: 'rotate', dx: 0.2, dy: -0.1 }, { type: 'gesture', dx: 0.2, dy: -0.1, dz: 1, from: 'control' }],
    [{ type: 'zoom', factor: 1.1 }, { type: 'gesture', dx: 0, dy: 0, dz: 1.1, from: 'control' }],
    [{ type: 'pause' }, { type: 'command', commands: [{ tool: 'pausar', args: {} }], from: 'control' }],
    [{ type: 'release' }, { type: 'command', commands: [{ tool: 'correr', args: {} }], from: 'control' }],
    [{ type: 'center' }, { type: 'command', commands: [{ tool: 'reiniciar_vista', args: {} }], from: 'control' }],
    [{ type: 'scene', scene: 'pendulo' }, { type: 'command', commands: [{ tool: 'ir_a', args: { escena: 'pendulo' } }], from: 'control' }],
    [{ type: 'variable', variable: 'longitud', value: 1 }, { type: 'command', commands: [{ tool: 'fijar_variable', args: { variable: 'longitud', valor: 1 } }], from: 'control' }],
    [{ type: 'variable', variable: 'amortiguacion', value: 1 }, { type: 'command', commands: [{ tool: 'fijar_variable', args: { variable: 'amortiguacion', valor: 1 } }], from: 'control' }],
    [{ type: 'variable', variable: 'lactasa', value: 0 }, { type: 'command', commands: [{ tool: 'fijar_variable', args: { variable: 'lactasa', valor: 0 } }], from: 'control' }],
    [{ type: 'level', delta: 1 }, { type: 'command', commands: [{ tool: 'fijar_variable', args: { variable: 'profundizar', valor: 1 } }], from: 'control' }],
    [{ type: 'level', delta: -1 }, { type: 'command', commands: [{ tool: 'fijar_variable', args: { variable: 'profundizar', valor: -1 } }], from: 'control' }],
  ];

  it('clamps the digestive scene variables and the level change from the network', () => {
    const msg = (variable: string, valor: number) => ({ type: 'command', commands: [{ tool: 'fijar_variable', args: { variable, valor } }], from: 'control' });
    expect(messageToActions(msg('nivel', 9), 'display')).toEqual([{ type: 'variable', variable: 'nivel', value: 3 }]);
    expect(messageToActions(msg('velocidad', 40), 'display')).toEqual([{ type: 'variable', variable: 'velocidad', value: 3 }]);
    expect(messageToActions(msg('profundizar', 50), 'display')).toEqual([{ type: 'level', delta: 1 }]);
    expect(messageToActions(msg('profundizar', 0), 'display')).toEqual([]);
    expect(actionLabel({ type: 'level', delta: 1 })).toBe('Profundizar');
    expect(actionLabel({ type: 'variable', variable: 'lactasa', value: 0 })).toBe('Sin lactasa');
  });

  it.each(cases)('encodes %o as a valid contract message', (action, expected) => {
    const msg = actionToMessage(action, 'control');
    expect(msg).toEqual(expected);
    expect(BusMessage.safeParse(msg).success).toBe(true);
  });

  it.each(cases)('decodes %o back on the projector', (action) => {
    expect(messageToActions(actionToMessage(action, 'control'), 'display')).toEqual([action]);
  });

  it('ignores its own echo (BroadcastChannel and relay both deliver)', () => {
    expect(messageToActions(actionToMessage({ type: 'pause' }, 'display'), 'display')).toEqual([]);
  });

  it('drops invalid or hostile messages from the network', () => {
    expect(messageToActions({ type: 'gesture', dx: 'x' }, 'display')).toEqual([]);
    expect(messageToActions(null, 'display')).toEqual([]);
    expect(messageToActions({ type: 'command', commands: [{ tool: 'borrar_todo', args: {} }], from: 'control' }, 'display')).toEqual([]);
  });

  it('clamps huge deltas so a bad peer cannot spin or blow up the model', () => {
    const [rot, zoom] = messageToActions({ type: 'gesture', dx: 900, dy: -900, dz: 50, from: 'control' }, 'display');
    expect(rot).toEqual({ type: 'rotate', dx: 1, dy: -1 });
    expect(zoom).toEqual({ type: 'zoom', factor: 1.5 });
  });

  it('accepts only known scene variables from the network, clamped to their lab range', () => {
    const set = (variable: string, valor: number) => messageToActions({ type: 'command', commands: [{ tool: 'fijar_variable', args: { variable, valor } }], from: 'control' }, 'display');
    expect(set('longitud', 1e9)).toEqual([{ type: 'variable', variable: 'longitud', value: 2.5 }]);
    expect(set('longitud', -3)).toEqual([{ type: 'variable', variable: 'longitud', value: 0.1 }]);
    expect(set('amortiguacion', 7)).toEqual([{ type: 'variable', variable: 'amortiguacion', value: 1 }]);
    expect(set('__proto__', 1)).toEqual([]);
    expect(set('temperatura', 40)).toEqual([{ type: 'variable', variable: 'temperatura', value: 40 }]);
  });

  it('labels every action in Spanish for the confirmation chips', () => {
    expect(actionLabel({ type: 'rotate', dx: 1, dy: 0 })).toBe('Girar');
    expect(actionLabel({ type: 'zoom', factor: 1.2 })).toBe('Acercar');
    expect(actionLabel({ type: 'zoom', factor: 0.8 })).toBe('Alejar');
    expect(actionLabel({ type: 'pause' })).toBe('Pausa');
    expect(actionLabel({ type: 'release' })).toBe('Soltar el péndulo');
    expect(actionLabel({ type: 'center' })).toBe('Centrar');
    expect(actionLabel({ type: 'variable', variable: 'longitud', value: 0.25 })).toBe('Longitud 0.25 m');
    expect(actionLabel({ type: 'variable', variable: 'amortiguacion', value: 1 })).toBe('Con rozamiento');
    expect(actionLabel({ type: 'variable', variable: 'amortiguacion', value: 0 })).toBe('Sin rozamiento');
  });
});

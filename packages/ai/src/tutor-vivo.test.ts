import { describe, expect, it } from 'vitest';
import { crearEnrutador, type Adaptador } from './enrutador.ts';
import { EntradaTutorVivo } from './esquemas-tutor.ts';
import { Presupuesto, RegistroUsoMemoria } from './presupuesto.ts';
import { ok, err } from './result.ts';
import { juzgarConIA, turnoTutorVivo, unaPregunta } from './tutor-vivo.ts';

const politica = { orden: ['gemini', 'meta'] as Adaptador['nombre'][], timeoutMs: 1000, privacidad: 'anonimizado' as const };

function enrutador(gemini: Adaptador['capacidades'], meta: Adaptador['capacidades'] = {}) {
  const registro = new RegistroUsoMemoria();
  const mk = (nombre: 'gemini' | 'meta', capacidades: Adaptador['capacidades']): Adaptador => ({ nombre, fuente: 'ia-nube', modelo: `m-${nombre}`, disponible: () => true, capacidades });
  return crearEnrutador({
    adaptadores: [mk('gemini', gemini), mk('meta', meta)],
    politicas: { tutorDialogo: politica, revisarPista: { ...politica, orden: ['meta'] }, juzgarIndagacion: politica },
    presupuesto: new Presupuesto({ registro }),
    registro,
  });
}
const pet = { colegioId: 'col-1', interruptores: {} };
const entrada = (x: Partial<EntradaTutorVivo> = {}) =>
  EntradaTutorVivo.parse({ mensaje: '¿por qué tarda más?', reservados: { numeros: [1.9], frases: ['a mayor longitud mayor periodo'] }, ...x });

describe('turnoTutorVivo', () => {
  it('keeps only the first question', () => {
    expect(unaPregunta('¿Qué mediste? ¿Y qué cambiaste?')).toBe('¿Qué mediste?');
  });
  it('passes a Socratic reply through', async () => {
    const r = await turnoTutorVivo(enrutador({ tutorDialogo: { turno: async () => ok({ texto: '¿Qué cambiaste entre tus dos mediciones?' }) } }), pet, entrada());
    expect(r.ok && r.valor.texto).toBe('¿Qué cambiaste entre tus dos mediciones?');
  });
  it('rejects a reply that reveals the expected number', async () => {
    const r = await turnoTutorVivo(enrutador({ tutorDialogo: { turno: async () => ok({ texto: 'El periodo es 1,9 s.' }) } }), pet, entrada());
    expect(!r.ok && r.error.tipo).toBe('revela');
  });
  it('rejects a hint the second reviewer flags', async () => {
    const r = await turnoTutorVivo(
      enrutador({ tutorDialogo: { turno: async () => ok({ texto: 'Compara tus datos.' }) } }, { revisarPista: { revisar: async () => ok({ veredicto: 'revela' as const, motivo: 'x' }) } }),
      pet,
      entrada({ modo: 'pista', nivelPista: 1 }),
    );
    expect(!r.ok && r.error.tipo).toBe('revela');
  });
  it('fails (so the client uses rules) when the provider fails', async () => {
    const r = await turnoTutorVivo(enrutador({ tutorDialogo: { turno: async () => err({ tipo: 'sin_red' as const, detalle: '' }) } }), pet, entrada());
    expect(r.ok).toBe(false);
  });
});

describe('juzgarConIA', () => {
  const s = { indicador: 'justificacion' as const, respuesta: 'porque recorre más distancia', contexto: { variables: [{ id: 'longitud' }], variableProbada: 'longitud' }, datos: [] };
  it('uses the model when quotes are literal', async () => {
    const v = await juzgarConIA(enrutador({ juzgarIndagacion: { juzgar: async () => ok({ nivel: '3' as const, cita: 'recorre más distancia' }) } }), pet, s);
    expect(v).toMatchObject({ nivel: 3, fuente: 'ia-nube', cita: 'recorre más distancia' });
  });
  it('falls back to the rules judge on invented quotes', async () => {
    const v = await juzgarConIA(enrutador({ juzgarIndagacion: { juzgar: async () => ok({ nivel: '3' as const, cita: 'la gravedad lo explica' }) } }), pet, s);
    expect(v.fuente).toBe('reglas');
  });
});

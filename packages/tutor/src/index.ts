/**
 * @rikuy/tutor: word-bounded intents, hint ladder, honesty policy, kill switch, command validation,
 * inquiry judge (level + literal quote + "NO"), data-based coherent conclusion, source badge.
 * Owner: F4 (docs/ecosistema/ARQUITECTURA_ECOSISTEMA.md, 5.4).
 */
export const packageName = '@rikuy/tutor' as const;

export * from './apoyo.ts';
export * from './atribucion.ts';
export * from './corpus.ts';
export * from './escalera.ts';
export * from './fuente.ts';
export * from './honestidad.ts';
export * from './indicios.ts';
export * from './intenciones.ts';
export * from './interruptor.ts';
export * from './juez/index.ts';
export * from './puertos.ts';
export * from './reglas/agente.ts';
export * from './reglas/recuerdos.ts';
export * from './result.ts';
export * from './texto.ts';
export * from './validar.ts';
export { afirmacionFundamentada, fundamentoCurricular } from './fundamento.ts';
export type { Fundamento } from './fundamento.ts';

/**
 * @rikuy/ai: AI ports and adapters, router and budget (docs/ecosistema/ARQUITECTURA_ECOSISTEMA.md, 4 and 5.4).
 * The keyed adapters (Gemini, Meta) are NOT exported from here: they are node-only subpaths (2.3.3).
 */
export const packageName = '@rikuy/ai' as const;
export * from './result.ts';
export * from './esquemas.ts';
export * from './puertos.ts';
export * from './texto.ts';
export * from './verificador.ts';
export * from './reintentos.ts';
export * from './presupuesto.ts';
export * from './enrutador.ts';
export * from './catalogo.ts';
export * from './firma.ts';
export * from './creador.ts';
export * from './plan/index.ts';
export * from './esquemas-tutor.ts';
export * from './tutor-vivo.ts';
export * from './adaptadores/simulado.ts';
export * from './adaptadores/reglas.ts';
export * from './adaptadores/webllm.ts';
export * from './adaptadores/openai-compat.ts';

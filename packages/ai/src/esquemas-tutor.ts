/** Schemas of the live tutor (see tutor-vivo.ts). */
import { z } from 'zod';

// ------------------------------------------------------------------ schemas

const Texto = (max: number) => z.string().trim().min(1).max(max);

export const EntradaTutorVivo = z.object({
  mensaje: Texto(600),
  /** dialogo: free Socratic turn; pista: a hint of rung `nivelPista`; curador: free question in a museum hall. */
  modo: z.enum(['dialogo', 'pista', 'curador']).default('dialogo'),
  nivelPista: z.number().int().min(1).max(3).optional(),
  historial: z.array(z.object({ autor: z.enum(['alumno', 'tutor']), texto: z.string().max(600) })).max(8).default([]),
  practica: z
    .object({
      preguntaGuia: z.string().max(400),
      limitaciones: z.array(z.string().max(300)).max(5).default([]),
      variables: z.array(z.string().max(80)).max(8).default([]),
    })
    .optional(),
  /** The group's own measurements (x = independent variable, y = measured value). */
  datos: z.array(z.object({ x: z.number(), y: z.number() })).max(40).default([]),
  /** What the reply must never say (expected numbers and conclusion). */
  reservados: z.object({ numeros: z.array(z.number()).max(40).default([]), frases: z.array(z.string().max(300)).max(10).default([]) }).default({ numeros: [], frases: [] }),
  /** Museum hall context, for curators and Rikuy in the museum. */
  sala: z.object({ nombre: z.string().max(80), descripcion: z.string().max(800) }).optional(),
  /** Optional grounding (curriculum retrieval). Fragments are quoted, sources are cited. */
  contexto: z.object({ fragmentos: z.array(z.string().max(1200)).max(6), fuentes: z.array(z.string().max(200)).max(6) }).optional(),
});
export type EntradaTutorVivo = z.infer<typeof EntradaTutorVivo>;

export const SalidaTutorModelo = z.object({ texto: z.string().min(1).max(700) });
export type SalidaTutorModelo = z.infer<typeof SalidaTutorModelo>;

export const SalidaRevisionPista = z.object({ veredicto: z.enum(['ok', 'revela']), motivo: z.string().max(300).default('') });
export type SalidaRevisionPista = z.infer<typeof SalidaRevisionPista>;

export const SalidaJuezModelo = z.object({ nivel: z.enum(['0', '1', '2', '3', 'NO']), cita: z.string().max(400) });
export type SalidaJuezModelo = z.infer<typeof SalidaJuezModelo>;

export const SalidaTranscripcion = z.object({ texto: z.string().max(1000) });

export interface AudioSintetizado {
  mime: string;
  base64: string;
}


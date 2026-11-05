/**
 * POST /ia/objeto3d: a filmed real object becomes a hologram exhibit.
 * The browser extracts the keyframes (no ffmpeg in the image) and sends a contact sheet of them plus the
 * hero frame. Gemini identifies the object and its parts (1 call); SAM 3.1 segments every keyframe in the
 * sheet with one concept prompt (1 call). No image-to-3D service is offered by the Meta Model API
 * (`GET /v1/models`: no SAM 3D), so the result is honestly a 360° view built from the video, not a mesh.
 * Images live only in memory for the request.
 */
import { subconjunto } from '@rikuy/curriculum-cneb';
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { identificarObjeto, type Identificacion, type OpcionesGemini } from './gemini.ts';
import { mascarasPorCelda, segmentarHoja, type MascaraCelda, type OpcionesSam } from './sam.ts';

export interface DepsObjeto3d {
  gemini?: OpcionesGemini;
  sam?: OpcionesSam;
}

const DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_CELDAS = 16;

export const SolicitudObjeto3d = z.object({
  heroe: z.string().max(1_500_000).regex(DATA_URL),
  hoja: z.string().max(4_000_000).regex(DATA_URL),
  celdas: z.array(z.object({ x: z.number().int().min(0), y: z.number().int().min(0), w: z.number().int().min(8), h: z.number().int().min(8) })).min(3).max(MAX_CELDAS),
  grado: z.string().regex(/^(primaria|secundaria)-[1-6]$/).default('secundaria-1'),
  pista: z.string().max(80).optional(),
});

export interface RespuestaObjeto3d {
  identificacion: Identificacion;
  mascaras: Array<MascaraCelda | null>;
  competencia: { id: string; nombre: string } | null;
  motor: { identificacion: 'gemini'; segmentacion: 'sam-3.1' | 'ninguna'; modelo3d: 'vista360' };
  aviso?: string;
}

/** "Diseña y construye soluciones tecnológicas" (CyT competence 3) of that grade, exact catalog id or null. */
export function competenciaTecnologica(grado: string): { id: string; nombre: string } | null {
  const g = subconjunto.grados.find((x) => x.id === grado);
  const c = g?.competencias.find((x) => x.numero === 3 && /soluciones tecnol/i.test(x.nombre));
  return c ? { id: c.id, nombre: c.nombre } : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rutasObjeto3d(app: Hono<any>, deps: DepsObjeto3d): void {
  app.post('/ia/objeto3d', async (c: Context) => {
    const p = SolicitudObjeto3d.safeParse(await c.req.json().catch(() => undefined));
    if (!p.success) return c.json({ error: 'solicitud_invalida', detalle: p.error.issues.slice(0, 4).map((i) => `${i.path.join('.')}: ${i.message}`) }, 400);
    if (!deps.gemini) return c.json({ error: 'sin_proveedor', detalle: 'La identificación necesita la nube con Gemini configurado.' }, 503);
    const s = p.data;
    let identificacion: Identificacion;
    try {
      identificacion = await identificarObjeto(deps.gemini, s.heroe, s.pista);
    } catch (e) {
      return c.json({ error: 'identificacion_fallida', detalle: (e as Error).message }, 502);
    }
    let mascaras: Array<MascaraCelda | null> = s.celdas.map(() => null);
    let segmentacion: RespuestaObjeto3d['motor']['segmentacion'] = 'ninguna';
    let aviso: string | undefined;
    if (deps.sam) {
      try {
        mascaras = mascarasPorCelda(await segmentarHoja(deps.sam, s.hoja, identificacion.conceptoSam), s.celdas);
        segmentacion = 'sam-3.1';
        if (mascaras.every((m) => m === null)) aviso = 'SAM no encontró el objeto; se usa el recorte simple.';
      } catch (e) {
        aviso = `Segmentación no disponible (${(e as Error).message}); se usa el recorte simple.`;
      }
    } else aviso = 'Sin SAM configurado; se usa el recorte simple.';
    const respuesta: RespuestaObjeto3d = {
      identificacion,
      mascaras,
      competencia: competenciaTecnologica(s.grado),
      motor: { identificacion: 'gemini', segmentacion, modelo3d: 'vista360' },
      ...(aviso ? { aviso } : {}),
    };
    return c.json(respuesta);
  });
}

type Env = Record<string, string | undefined>;

/** Providers from the environment; keys never leave the cloud. */
export function depsObjeto3dDesdeEntorno(env: Env): DepsObjeto3d {
  if (env.RIKUY_AI_MODE === 'mock') return {};
  return {
    ...(env.GEMINI_API_KEY ? { gemini: { apiKey: env.GEMINI_API_KEY, modelo: env.GEMINI_MODEL ?? 'gemini-3.8-flash' } } : {}),
    ...(env.META_API_KEY ? { sam: { apiKey: env.META_API_KEY, baseUrl: env.META_API_BASE_URL ?? 'https://api.meta.ai/v1' } } : {}),
  };
}

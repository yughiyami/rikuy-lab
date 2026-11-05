/**
 * Live tutor routes (/ia/tutor/*, /ia/voz, /ia/transcribir). Keys stay here; the web only sends the turn.
 * Every failure answers with a status the client reads as "use the rules agent" (offline-first).
 */
import { EntradaTutorVivo, juzgarConIA, sha256Hex, turnoTutorVivo, type AudioSintetizado } from '@rikuy/ai';
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import type { DepsNube } from './deps.ts';

type Vars = { Variables: { colegioId: string } };

const SolicitudJuezEntrada = z.object({
  indicador: z.enum(['variable', 'prediccion', 'justificacion', 'uso_del_dato', 'conclusion_coherente']),
  respuesta: z.string().max(1000),
  contexto: z.object({
    variables: z.array(z.object({ id: z.string().max(40), etiqueta: z.string().max(80).optional(), sinonimos: z.array(z.string().max(40)).max(10).optional() })).max(8),
    variableProbada: z.string().max(40),
    conceptos: z.array(z.string().max(40)).max(20).optional(),
  }),
  datos: z.array(z.object({ x: z.number(), y: z.number() })).max(40).default([]),
});

const MAX_CACHE_VOZ = 300;

async function leer<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S> | Response> {
  const p = schema.safeParse(await c.req.json().catch(() => undefined));
  if (p.success) return p.data;
  return c.json({ error: 'solicitud_invalida', detalle: p.error.issues.slice(0, 4).map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`) }, 400);
}

export function rutasTutor(app: Hono<Vars>, deps: DepsNube): void {
  const peticion = (c: Context<Vars>) => ({ colegioId: c.get('colegioId'), interruptores: {} });
  const cacheVoz = new Map<string, AudioSintetizado>();

  app.post('/ia/tutor/turno', async (c) => {
    const e = await leer(c, EntradaTutorVivo);
    if (e instanceof Response) return e;
    const inicio = Date.now();
    const r = await turnoTutorVivo(deps.enrutador, peticion(c), e);
    const latenciaMs = Date.now() - inicio;
    if (!r.ok) return c.json({ fallo: r.error, latenciaMs }, r.error.tipo === 'cuota' ? 429 : r.error.tipo === 'revela' ? 422 : 503);
    return c.json({ ...r.valor, fuente: 'ia-nube', latenciaMs });
  });

  app.post('/ia/tutor/juzgar', async (c) => {
    const s = await leer(c, SolicitudJuezEntrada);
    if (s instanceof Response) return s;
    const inicio = Date.now();
    const veredicto = await juzgarConIA(deps.enrutador, peticion(c), s as never);
    return c.json({ veredicto, latenciaMs: Date.now() - inicio });
  });

  app.post('/ia/voz', async (c) => {
    const p = await leer(c, z.object({ texto: z.string().trim().min(1).max(600) }));
    if (p instanceof Response) return p;
    const clave = await sha256Hex(p.texto);
    const guardado = cacheVoz.get(clave);
    if (guardado) return c.json({ ...guardado, cache: true });
    const r = await deps.enrutador.ejecutar('voz', peticion(c), (impl, ctx) => impl.sintetizar(p.texto, ctx));
    if (!r.resultado.ok) return c.json({ fallo: r.resultado.error }, r.resultado.error.tipo === 'cuota' ? 429 : 503);
    if (cacheVoz.size >= MAX_CACHE_VOZ) cacheVoz.delete(cacheVoz.keys().next().value!);
    cacheVoz.set(clave, r.resultado.valor);
    return c.json({ ...r.resultado.valor, cache: false });
  });

  app.post('/ia/transcribir', async (c) => {
    const p = await leer(c, z.object({ mime: z.string().regex(/^audio\/[a-z0-9.+-]+(;.*)?$/i), base64: z.string().min(10).max(4_000_000) }));
    if (p instanceof Response) return p;
    const r = await deps.enrutador.ejecutar('transcribir', peticion(c), (impl, ctx) => impl.transcribir({ mime: p.mime.split(';')[0]!, base64: p.base64 }, ctx));
    if (!r.resultado.ok) return c.json({ fallo: r.resultado.error }, r.resultado.error.tipo === 'cuota' ? 429 : 503);
    return c.json({ texto: r.resultado.valor });
  });
}

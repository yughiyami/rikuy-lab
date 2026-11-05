/**
 * Cloud gateway (Hono): AI with keys (/ia/*), practice registry (/paquetes/*), anonymous aggregates (/agregados/*)
 * and report delivery (/reportes/*). Per-IP limits; usage logs are metadata only. Runs on Node and on serverless.
 */
import {
  CAPACIDADES,
  ResultadoEsperado,
  SolicitudPractica,
  aprobarPropuesta,
  borradorDesdePropuesta,
  canonico,
  citaLiteral,
  ejecutarCadena,
  sha256Hex,
  verificarBorrador,
  verificarPaquete,
  type PropuestaCreador,
} from '@rikuy/ai';
import { PaqueteValidado, Practica, RecursoExhibicion } from '@rikuy/contracts';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { AgregadoSemanal, resumenPaquete, suprimir } from './almacen.ts';
import type { DepsNube } from './deps.ts';
import { limitePorIp } from './limites.ts';
import { rutasObjeto3d } from './objeto3d/rutas.ts';
import { rutasPlan } from './plan.ts';
import { rutasReportes } from './reportes/rutas.ts';

type Vars = { Variables: { colegioId: string } };

const RE_COLEGIO = /^[A-Za-z0-9_-]{3,40}$/;
const Interruptores = z.object({ iaLocal: z.boolean().optional(), iaNube: z.boolean().optional() }).optional();

const PropuestaEntrada = z.object({
  practica: Practica,
  resultadoEsperado: ResultadoEsperado,
  recursos: z.array(RecursoExhibicion),
  guionVideo: z.array(z.string()).optional(),
  pictogramas: z.array(z.object({ id: z.string(), descripcion: z.string(), imagen: z.object({ mime: z.string(), base64: z.string() }).optional() })).default([]),
});

async function leer<S extends z.ZodType>(c: Context, schema: S): Promise<{ ok: true; datos: z.infer<S> } | { ok: false; respuesta: Response }> {
  const cuerpo = await c.req.json().catch(() => undefined);
  const p = schema.safeParse(cuerpo);
  if (p.success) return { ok: true, datos: p.data };
  return { ok: false, respuesta: c.json({ error: 'solicitud_invalida', detalle: p.error?.issues.slice(0, 4).map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`) ?? ['JSON inválido'] }, 400) };
}

export function crearApp(deps: DepsNube): Hono<Vars> {
  const app = new Hono<Vars>();
  const lim = (l: DepsNube['limites']['ia']) => limitePorIp(l, { confiarProxy: deps.confiarProxy, reloj: deps.reloj });

  app.use('*', cors({ origin: deps.origenesPermitidos, allowHeaders: ['content-type', 'x-rikuy-colegio', 'x-rikuy-ugel-token'] }));
  const limiteGeneral = bodyLimit({ maxSize: 6 * 1024 * 1024, onError: (c) => c.json({ error: 'cuerpo_demasiado_grande' }, 413) });
  // The plan upload has its own (larger) limit on its route.
  app.use('*', (c, next) => (c.req.path === '/ia/plan/extraer' ? next() : limiteGeneral(c, next)));
  app.get('/salud', (c) => c.json({ ok: true }));

  // ---------------------------------------------------------------- /ia/*
  app.use('/ia/*', lim(deps.limites.ia));
  app.use('/ia/*', async (c, next) => {
    const colegio = c.req.header('x-rikuy-colegio') ?? '';
    if (!RE_COLEGIO.test(colegio)) return c.json({ error: 'colegio_invalido', detalle: 'Falta la cabecera x-rikuy-colegio (3 a 40 letras, números, - o _).' }, 400);
    c.set('colegioId', colegio);
    await next();
  });

  app.get('/ia/estado', (c) => {
    const colegioId = c.get('colegioId');
    return c.json({
      modo: deps.modo,
      adaptadores: deps.enrutador.adaptadores().map((a) => ({ nombre: a.nombre, fuente: a.fuente, modelo: a.modelo, simulado: a.simulado ?? false, capacidades: CAPACIDADES.filter((k) => a.capacidades[k]) })),
      topeMensualUsd: deps.presupuesto.topeMensualUsd,
      restanteUsd: deps.presupuesto.restanteUsd(colegioId),
    });
  });

  app.get('/ia/desempenos', (c) => c.json({ desempenos: deps.catalogo.listar?.() ?? [] }));

  app.get('/ia/uso', (c) => {
    const colegioId = c.get('colegioId');
    const propias = deps.registro.entradas().filter((e) => e.colegioId === colegioId);
    return c.json({ gastadoUsd: deps.presupuesto.gastado(colegioId), restanteUsd: deps.presupuesto.restanteUsd(colegioId), entradas: propias.slice(-50) });
  });

  app.post('/ia/generar-practica', async (c) => {
    const p = await leer(c, z.object({ solicitud: SolicitudPractica, interruptores: Interruptores }));
    if (!p.ok) return p.respuesta;
    const salida = await ejecutarCadena(deps.creador, { colegioId: c.get('colegioId'), ...(p.datos.interruptores ? { interruptores: p.datos.interruptores } : {}) }, p.datos.solicitud);
    if (salida.estado === 'rechazado') return c.json(salida, 422);
    return c.json(salida);
  });

  app.post('/ia/revisar-practica', async (c) => {
    const p = await leer(c, z.object({ propuesta: PropuestaEntrada }));
    if (!p.ok) return p.respuesta;
    const prop = p.datos.propuesta as unknown as PropuestaCreador;
    const borrador = borradorDesdePropuesta(prop);
    const verificacion = verificarBorrador(borrador, { desempeno: prop.practica.desempeno, textoOficial: (r) => deps.catalogo.textoOficial(r) });
    const rev = await deps.enrutador.ejecutar('revisarPractica', { colegioId: c.get('colegioId'), interruptores: {} }, (impl, ctx) => impl.revisar(borrador, ctx));
    return c.json({ verificacion, revision: rev.resultado.ok ? rev.resultado.valor : undefined, fallo: rev.resultado.ok ? undefined : rev.resultado.error, simulado: rev.simulado ?? false });
  });

  app.post('/ia/aprobar-practica', async (c) => {
    const p = await leer(c, z.object({ propuesta: PropuestaEntrada, docente: z.string().min(1).max(60) }));
    if (!p.ok) return p.respuesta;
    const r = await aprobarPropuesta(deps.creador, p.datos.propuesta as unknown as PropuestaCreador, { docente: p.datos.docente });
    if (!r.ok) return c.json({ error: 'verificacion_fallida', hallazgos: r.error }, 422);
    return c.json(r.valor);
  });

  app.post('/ia/pictogramas', async (c) => {
    const p = await leer(c, z.object({ id: z.string().max(40), descripcion: z.string().min(3).max(300) }));
    if (!p.ok) return p.respuesta;
    const r = await deps.enrutador.ejecutar('pictogramas', { colegioId: c.get('colegioId'), interruptores: {} }, (impl, ctx) => impl.generar(p.datos, ctx));
    if (!r.resultado.ok) return c.json({ fallo: r.resultado.error }, r.resultado.error.tipo === 'cuota' ? 429 : 502);
    const bytes = new Uint8Array(await r.resultado.valor.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return c.json({ id: p.datos.id, imagen: { mime: r.resultado.valor.type || 'image/png', base64: btoa(s) }, simulado: r.simulado ?? false });
  });

  app.post('/ia/vision-tabla', async (c) => {
    const p = await leer(c, z.object({ imagenBase64: z.string().min(10), mime: z.enum(['image/jpeg', 'image/png', 'image/webp']) }));
    if (!p.ok) return p.respuesta;
    const blob = new Blob([Uint8Array.from(atob(p.datos.imagenBase64), (ch) => ch.charCodeAt(0))], { type: p.datos.mime });
    const r = await deps.enrutador.ejecutar('visionTabla', { colegioId: c.get('colegioId'), interruptores: {} }, (impl, ctx) => impl.leer(blob, ctx));
    if (!r.resultado.ok) return c.json({ fallo: r.resultado.error }, r.resultado.error.tipo === 'cuota' ? 429 : 502);
    return c.json({ filas: r.resultado.valor, aConfirmar: true, simulado: r.simulado ?? false }); // the teacher confirms every row
  });

  app.post('/ia/traducir', async (c) => {
    const p = await leer(c, z.object({ texto: z.string().min(1).max(2000), lengua: z.enum(['es', 'quy', 'quz', 'ayr']) }));
    if (!p.ok) return p.respuesta;
    const r = await deps.enrutador.ejecutar('traducir', { colegioId: c.get('colegioId'), interruptores: {} }, (impl, ctx) => impl.traducir(p.datos.texto, p.datos.lengua, ctx));
    if (!r.resultado.ok) return c.json({ fallo: r.resultado.error }, r.resultado.error.tipo === 'cuota' ? 429 : 502);
    return c.json({ traduccion: r.resultado.valor, simulado: r.simulado ?? false });
  });

  rutasPlan(app, deps);
  rutasObjeto3d(app, deps.objeto3d ?? {});

  // ---------------------------------------------------------------- /paquetes/*
  app.use('/paquetes/*', lim(deps.limites.escritura));
  app.use('/paquetes', lim(deps.limites.escritura));

  app.post('/paquetes', async (c) => {
    const p = await leer(c, z.object({ paquete: z.unknown(), clavePublica: z.string().min(1) }));
    if (!p.ok) return p.respuesta;
    const v = PaqueteValidado.safeParse(p.datos.paquete);
    if (!v.success || v.data.tipo !== 'practica') return c.json({ error: 'paquete_invalido', detalle: 'Se espera un paquete de práctica con la firma de la docente.' }, 422);
    const practica = v.data.cuerpo;
    if (practica.estado !== 'aprobada') return c.json({ error: 'no_aprobada', detalle: 'Solo se registran prácticas aprobadas por la docente.' }, 422);
    if (!(await verificarPaquete(v.data as never, p.datos.clavePublica))) return c.json({ error: 'firma_invalida' }, 403);
    const oficial = deps.catalogo.textoOficial(practica.desempeno);
    if (oficial === undefined || !citaLiteral(practica.desempeno.cita, oficial)) {
      return c.json({ error: 'cita_no_literal', hallazgos: [{ regla: oficial === undefined ? 'desempeno_inexistente' : 'cita_literal', mensaje: 'La cita no es una subcadena exacta del desempeño oficial.' }] }, 422);
    }
    const sha256 = await sha256Hex(canonico(v.data));
    const r = deps.paquetes.guardar({ id: practica.id, version: practica.version, sha256, publicado: deps.reloj().toISOString(), paquete: v.data as never });
    if (r.resultado === 'conflicto') return c.json({ error: 'version_existente', detalle: 'Ya existe esa versión con otro contenido: sube la versión.' }, 409);
    return c.json({ id: practica.id, version: practica.version, sha256 }, r.resultado === 'creado' ? 201 : 200);
  });

  app.get('/paquetes', (c) => c.json({ paquetes: deps.paquetes.listar().map(resumenPaquete) }));
  app.get('/paquetes/:id', (c) => {
    const version = c.req.query('version');
    const p = deps.paquetes.obtener(c.req.param('id'), version ? Number(version) : undefined);
    return p ? c.json({ id: p.id, version: p.version, sha256: p.sha256, paquete: p.paquete }) : c.json({ error: 'no_encontrado' }, 404);
  });

  // ---------------------------------------------------------------- /agregados/*
  app.use('/agregados/*', lim(deps.limites.escritura));
  app.use('/agregados', lim(deps.limites.escritura));

  app.post('/agregados', async (c) => {
    const p = await leer(c, AgregadoSemanal);
    if (!p.ok) return p.respuesta;
    const { visibles, suprimidas } = suprimir(p.datos.celdas);
    deps.agregados.reemplazar(p.datos.colegioId, p.datos.semana, visibles);
    return c.json({ aceptadas: visibles.length, suprimidas }, 202);
  });

  app.get('/agregados/ugel', (c) => {
    if (!deps.ugelToken) return c.json({ error: 'no_configurado' }, 503);
    if (c.req.header('x-rikuy-ugel-token') !== deps.ugelToken) return c.json({ error: 'no_autorizado' }, 401);
    const semana = c.req.query('semana') ?? '';
    if (!/^\d{4}-W\d{2}$/.test(semana)) return c.json({ error: 'semana_invalida' }, 400);
    // Suppression is applied again on read: the cloud never trusts what it stored.
    return c.json({ semana, colegios: deps.agregados.porSemana(semana).map((x) => ({ colegioId: x.colegioId, celdas: suprimir(x.celdas).visibles })) });
  });

  // ---------------------------------------------------------------- /reportes/*
  if (deps.reportes) {
    app.use('/reportes/*', lim(deps.limites.envio));
    app.route('/reportes', rutasReportes(deps.reportes, deps.reloj));
  }

  return app;
}

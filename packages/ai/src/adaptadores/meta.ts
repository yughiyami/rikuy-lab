/**
 * Meta Muse adapter (4.3): second reviewer (Muse Spark, `/v1/responses`) and pictograms (Muse Image, `/images/generations`).
 * Retry and budget logic adapted from the repo yughiyami/willay (`backend/willay/adapters/meta_model_api.py` and
 * `meta_usage.py`): 429/5xx and "referenced response not found" are retried twice (1 s, 2 s); the key is never
 * logged or echoed. There is no Llama API: Llama only runs locally (Ollama / WebLLM).
 * Node-only: the API key lives in `apps/cloud` (2.3.3).
 */
import type { Adaptador } from '../enrutador.ts';
import { SalidaRevision, type BorradorPractica, type RevisionIA } from '../esquemas.ts';
import { costoImagen, costoTexto } from '../presupuesto.ts';
import type { ContextoLlamada, FalloIA } from '../puertos.ts';
import { ErrorHttp, conReintentos, type OpcionesReintento } from '../reintentos.ts';
import { err, ok, type Result } from '../result.ts';
import { SalidaRevisionPista } from '../esquemas-tutor.ts';
import { INSTRUCCIONES_REVISOR_PISTA } from '../tutor-vivo.ts';
import { INSTRUCCIONES_REVISOR, contenidoRevision, esquemaJsonDe, mapearError, salidaEstructurada } from './comun.ts';

export const URL_META_POR_DEFECTO = 'https://api.meta.ai/v1';
export const MODELO_TEXTO_META = 'muse-spark-1.3';
export const MODELO_IMAGEN_META = 'muse-image-1.0';

export interface OpcionesMeta {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  dormir?: OpcionesReintento['dormir'];
  modeloTexto?: string;
  /** Willay verified `strict:false`; `strict:true` still has to be VERIFIED against the account (4.3). */
  estricto?: boolean;
}

function textoDeRespuesta(payload: unknown): string {
  const output = (payload as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output;
  if (!Array.isArray(output)) return '';
  return output
    .filter((i) => i.type === 'message')
    .flatMap((i) => i.content ?? [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text ?? '')
    .join('');
}

export function crearAdaptadorMeta(o: OpcionesMeta): Adaptador {
  const base = (o.baseUrl ?? URL_META_POR_DEFECTO).replace(/\/+$/, '');
  const f = o.fetch ?? fetch;
  const modeloTexto = o.modeloTexto ?? MODELO_TEXTO_META;
  const reintentos: OpcionesReintento = o.dormir ? { dormir: o.dormir } : {};
  const redactar = (t: string) => (o.apiKey ? t.split(o.apiKey).join('[redacted]') : t);

  async function post(path: string, cuerpo: unknown, senal?: AbortSignal): Promise<Record<string, unknown>> {
    let respuesta: Response;
    try {
      respuesta = await f(`${base}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${o.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        ...(senal ? { signal: senal } : {}),
      });
    } catch (e) {
      throw e instanceof Error && e.name === 'AbortError' ? e : new TypeError(redactar(`request to ${path} failed`));
    }
    if (respuesta.status >= 400) {
      const texto = await respuesta.text().catch(() => '');
      // The status drives behavior; the text only feeds the "referenced response not found" retry rule.
      throw new ErrorHttp(respuesta.status, redactar(texto).slice(0, 200));
    }
    const payload = (await respuesta.json().catch(() => undefined)) as Record<string, unknown> | undefined;
    if (!payload || typeof payload !== 'object') throw new ErrorHttp(502, 'non-JSON body');
    return payload;
  }

  async function revisar(b: BorradorPractica, ctx?: ContextoLlamada): Promise<Result<RevisionIA, FalloIA>> {
    const r = await salidaEstructurada({
      schema: SalidaRevision,
      reintentos,
      llamar: async (correccion) => {
        const payload = await post(
          '/responses',
          {
            model: modeloTexto,
            instructions: INSTRUCCIONES_REVISOR,
            input: [{ role: 'user', content: [{ type: 'input_text', text: correccion ? `${contenidoRevision(b)}\n\n${correccion}` : contenidoRevision(b) }] }],
            text: { format: { type: 'json_schema', name: 'revision_practica', schema: esquemaJsonDe(SalidaRevision), strict: o.estricto ?? false } },
            reasoning: { effort: 'low' },
            max_output_tokens: 1500,
          },
          ctx?.senal,
        );
        const u = (payload.usage ?? {}) as { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
        return {
          texto: textoDeRespuesta(payload),
          uso: { tokensEntrada: u.input_tokens ?? 0, tokensSalida: u.output_tokens ?? 0, tokensCache: u.input_tokens_details?.cached_tokens ?? 0 },
        };
      },
      alUsar: (u) =>
        ctx?.registrarUso({
          endpoint: '/responses',
          proposito: 'revisarPractica',
          ...u,
          costoUsd: costoTexto(modeloTexto, u.tokensEntrada ?? 0, u.tokensSalida ?? 0, u.tokensCache ?? 0),
        }),
    });
    return r.ok ? ok({ ...r.valor, modelo: modeloTexto }) : r;
  }

  async function revisarPista(pista: string, contexto: string, ctx?: ContextoLlamada): Promise<Result<SalidaRevisionPista, FalloIA>> {
    return salidaEstructurada({
      schema: SalidaRevisionPista,
      reintentos,
      llamar: async (correccion) => {
        const texto = `Contexto (pregunta guía y lo que NO se debe revelar): ${contexto}
Pista a revisar: ${pista}${correccion ? `

${correccion}` : ''}`;
        const payload = await post(
          '/responses',
          {
            model: modeloTexto,
            instructions: INSTRUCCIONES_REVISOR_PISTA,
            input: [{ role: 'user', content: [{ type: 'input_text', text: texto }] }],
            text: { format: { type: 'json_schema', name: 'revision_pista', schema: esquemaJsonDe(SalidaRevisionPista), strict: o.estricto ?? false } },
            reasoning: { effort: 'low' },
            max_output_tokens: 400,
          },
          ctx?.senal,
        );
        const u = (payload.usage ?? {}) as { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
        return { texto: textoDeRespuesta(payload), uso: { tokensEntrada: u.input_tokens ?? 0, tokensSalida: u.output_tokens ?? 0, tokensCache: u.input_tokens_details?.cached_tokens ?? 0 } };
      },
      alUsar: (u) =>
        ctx?.registrarUso({ endpoint: '/responses', proposito: 'revisarPista', ...u, costoUsd: costoTexto(modeloTexto, u.tokensEntrada ?? 0, u.tokensSalida ?? 0, u.tokensCache ?? 0) }),
    });
  }

  return {
    nombre: 'meta',
    fuente: 'ia-nube',
    modelo: modeloTexto,
    disponible: () => o.apiKey.length > 0,
    costoEstimadoUsd: (c) => (c === 'pictogramas' ? costoImagen(1) : 0.012),
    capacidades: {
      revisarPractica: { revisar },
      revisarPista: { revisar: revisarPista },
      pictogramas: {
        async generar(p, ctx) {
          try {
            const payload = await conReintentos(
              () =>
                post(
                  '/images/generations',
                  {
                    model: MODELO_IMAGEN_META,
                    prompt: `Pictograma escolar simple y claro de: ${p.descripcion}. Fondo liso, trazos gruesos, sin texto, sin letras ni números dentro de la imagen.`,
                    n: 1,
                    output_format: 'png',
                    response_format: 'b64_json',
                    size: '1024x1024',
                  },
                  ctx?.senal,
                ),
              reintentos,
            );
            const b64 = (payload.data as Array<{ b64_json?: string }> | undefined)?.[0]?.b64_json;
            if (!b64) return err({ tipo: 'esquema', detalle: 'La respuesta de imagen no trae datos.' });
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            ctx?.registrarUso({ endpoint: '/images/generations', proposito: 'pictogramas', imagenes: 1, costoUsd: costoImagen(1) });
            return ok(new Blob([bytes], { type: 'image/png' }));
          } catch (e) {
            return err(mapearError(e));
          }
        },
      },
    },
  };
}

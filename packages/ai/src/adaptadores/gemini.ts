/**
 * Gemini adapter (4.3): primary generator of the Creador, table-photo vision and draft translation.
 * Uses `@google/genai` with JSON-schema output built from Zod. Node-only: the API key lives in `apps/cloud` (2.3.3).
 * The model name is configurable and must be VERIFIED on the account (4.3).
 */
import { GoogleGenAI } from '@google/genai';
import type { Adaptador } from '../enrutador.ts';
import { BorradorPractica, SalidaTraduccion, SalidaVisionTabla, type SolicitudPractica } from '../esquemas.ts';
import { costoTexto } from '../presupuesto.ts';
import type { ContextoLlamada } from '../puertos.ts';
import { ErrorHttp, type OpcionesReintento } from '../reintentos.ts';
import { err, ok } from '../result.ts';
import type { z } from 'zod';
import { PlanExtraido } from '../plan/esquemas.ts';
import { INSTRUCCIONES_CREADOR, INSTRUCCIONES_PLAN, contenidoGeneracion, esquemaJsonDe, mapearError, salidaEstructurada, type UsoTokens } from './comun.ts';
import { SalidaJuezModelo, SalidaTranscripcion, SalidaTutorModelo } from '../esquemas-tutor.ts';

export { esquemaJsonDe };

export const MODELO_GEMINI_POR_DEFECTO = 'gemini-2.5-flash';

export interface PedidoGemini {
  modelo: string;
  instrucciones: string;
  contenido: Array<string | { mimeType: string; base64: string }>;
  esquemaJson: Record<string, unknown>;
  proposito: string;
  senal?: AbortSignal;
}
export interface ClienteGemini {
  generar(p: PedidoGemini): Promise<{ texto: string; uso: UsoTokens }>;
  /** Text to speech (raw PCM 16-bit mono, as Gemini TTS returns it). Optional: absent means no cloud voice. */
  hablar?(p: { modelo: string; texto: string; voz: string; senal?: AbortSignal }): Promise<{ pcmBase64: string; mime: string; uso: UsoTokens }>;
}

export const MODELO_TTS_POR_DEFECTO = 'gemini-2.5-flash-preview-tts';
export const VOZ_RIKUY = 'Kore';

/** Wraps 16-bit mono PCM in a WAV header so any browser can play it. */
export function pcmAWav(pcmBase64: string, frecuencia = 24_000): string {
  const pcm = Uint8Array.from(atob(pcmBase64), (c) => c.charCodeAt(0));
  const wav = new Uint8Array(44 + pcm.length);
  const v = new DataView(wav.buffer);
  const texto = (o: number, t: string) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  texto(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, frecuencia, true);
  v.setUint32(28, frecuencia * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, pcm.length, true);
  wav.set(pcm, 44);
  return base64(wav);
}

/** Real client over the SDK. SDK errors are turned into `ErrorHttp` so the retry helper understands them. */
export function clienteGeminiDesdeSdk(apiKey: string): ClienteGemini {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generar(p) {
      try {
        const partes = p.contenido.map((c) => (typeof c === 'string' ? { text: c } : { inlineData: { mimeType: c.mimeType, data: c.base64 } }));
        const r = await ai.models.generateContent({
          model: p.modelo,
          contents: [{ role: 'user', parts: partes }],
          config: {
            systemInstruction: p.instrucciones,
            responseMimeType: 'application/json',
            responseJsonSchema: p.esquemaJson,
            ...(p.senal ? { abortSignal: p.senal } : {}),
          },
        });
        const u = r.usageMetadata;
        return {
          texto: r.text ?? '',
          uso: { tokensEntrada: u?.promptTokenCount ?? 0, tokensSalida: u?.candidatesTokenCount ?? 0, tokensCache: u?.cachedContentTokenCount ?? 0 },
        };
      } catch (e) {
        const status = (e as { status?: unknown }).status;
        if (typeof status === 'number') throw new ErrorHttp(status, 'gemini');
        throw e;
      }
    },
    async hablar(p) {
      try {
        const r = await ai.models.generateContent({
          model: p.modelo,
          contents: [{ role: 'user', parts: [{ text: p.texto }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: p.voz } } },
            ...(p.senal ? { abortSignal: p.senal } : {}),
          },
        });
        const parte = r.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data);
        const u = r.usageMetadata;
        return {
          pcmBase64: parte?.inlineData?.data ?? '',
          mime: parte?.inlineData?.mimeType ?? 'audio/L16;rate=24000',
          uso: { tokensEntrada: u?.promptTokenCount ?? 0, tokensSalida: u?.candidatesTokenCount ?? 0 },
        };
      } catch (e) {
        const status = (e as { status?: unknown }).status;
        if (typeof status === 'number') throw new ErrorHttp(status, 'gemini-tts');
        throw e;
      }
    },
  };
}

export interface OpcionesGemini {
  cliente: ClienteGemini;
  modelo?: string;
  modeloTts?: string;
  dormir?: OpcionesReintento['dormir'];
}

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function crearAdaptadorGemini(o: OpcionesGemini): Adaptador {
  const modelo = o.modelo ?? MODELO_GEMINI_POR_DEFECTO;
  const reintentos: OpcionesReintento = o.dormir ? { dormir: o.dormir } : {};

  function ejecutar<T>(proposito: string, schema: z.ZodType<T>, instrucciones: string, contenido: PedidoGemini['contenido'], ctx?: ContextoLlamada) {
    return salidaEstructurada<T>({
      schema,
      reintentos,
      llamar: (correccion) =>
        o.cliente.generar({
          modelo,
          instrucciones,
          contenido: correccion ? [...contenido, correccion] : contenido,
          esquemaJson: esquemaJsonDe(schema),
          proposito,
          ...(ctx?.senal ? { senal: ctx.senal } : {}),
        }),
      alUsar: (u) =>
        ctx?.registrarUso({
          endpoint: 'models.generateContent',
          proposito,
          ...u,
          costoUsd: costoTexto(modelo, u.tokensEntrada ?? 0, u.tokensSalida ?? 0, u.tokensCache ?? 0),
        }),
    });
  }

  return {
    nombre: 'gemini',
    fuente: 'ia-nube',
    modelo,
    disponible: () => true,
    costoEstimadoUsd: (c) => (c === 'generarPractica' || c === 'extraerPlan' ? 0.02 : 0.005),
    capacidades: {
      generarPractica: {
        generar: (s: SolicitudPractica, ctx) => ejecutar('generarPractica', BorradorPractica, INSTRUCCIONES_CREADOR, [contenidoGeneracion(s)], ctx),
      },
      visionTabla: {
        async leer(img, ctx) {
          if (img.size > 8_000_000) return err({ tipo: 'politica', detalle: 'La imagen es demasiado grande.' });
          const bytes = new Uint8Array(await img.arrayBuffer());
          const r = await ejecutar(
            'visionTabla',
            SalidaVisionTabla,
            'Lee la tabla de mediciones de la foto. Devuelve solo JSON con las filas. No inventes valores ilegibles: omítelos.',
            [{ mimeType: img.type || 'image/jpeg', base64: base64(bytes) }, 'Extrae las filas de la tabla.'],
            ctx,
          );
          return r.ok ? ok(r.valor.filas) : r;
        },
      },
      extraerPlan: {
        // Native PDF and image understanding: the files go as inline parts, never stored by the gateway.
        extraer: (archivos, ctx) =>
          ejecutar('extraerPlan', PlanExtraido, INSTRUCCIONES_PLAN, [...archivos.map((a) => ({ mimeType: a.mime, base64: a.base64 })), 'Extrae la planificación de este documento.'], ctx),
      },
      tutorDialogo: {
        turno: (instrucciones, contenido, ctx) => ejecutar('tutorDialogo', SalidaTutorModelo, instrucciones, [contenido], ctx),
      },
      juzgarIndagacion: {
        juzgar: (instrucciones, contenido, ctx) => ejecutar('juzgarIndagacion', SalidaJuezModelo, instrucciones, [contenido], ctx),
      },
      transcribir: {
        async transcribir(audio, ctx) {
          const r = await ejecutar(
            'transcribir',
            SalidaTranscripcion,
            'Transcribe literalmente lo que dice el estudiante (castellano del Perú). No corrijas ni completes. Devuelve solo JSON {"texto": "..."}.',
            [{ mimeType: audio.mime, base64: audio.base64 }, 'Transcribe el audio.'],
            ctx,
          );
          return r.ok ? ok(r.valor.texto) : r;
        },
      },
      ...(o.cliente.hablar
        ? {
            voz: {
              async sintetizar(texto: string, ctx?: ContextoLlamada) {
                const modeloTts = o.modeloTts ?? MODELO_TTS_POR_DEFECTO;
                try {
                  const r = await o.cliente.hablar!({ modelo: modeloTts, texto: `Di con voz cálida y clara, como un tutor amable: ${texto}`, voz: VOZ_RIKUY, ...(ctx?.senal ? { senal: ctx.senal } : {}) });
                  ctx?.registrarUso({ endpoint: 'models.generateContent(tts)', proposito: 'voz', ...r.uso, costoUsd: costoTexto(modeloTts, r.uso.tokensEntrada ?? 0, r.uso.tokensSalida ?? 0) });
                  if (!r.pcmBase64) return err({ tipo: 'esquema' as const, detalle: 'La voz no trajo audio.' });
                  const rate = Number(/rate=(\d+)/.exec(r.mime)?.[1] ?? 24_000);
                  return ok({ mime: 'audio/wav', base64: pcmAWav(r.pcmBase64, rate) });
                } catch (e) {
                  return err(mapearError(e));
                }
              },
            },
          }
        : {}),
      traducir: {
        async traducir(texto, a, ctx) {
          const r = await ejecutar(
            'traducir',
            SalidaTraduccion,
            'Traduces textos escolares de ciencias al idioma pedido. Devuelve solo JSON {"texto": "..."}. Es un BORRADOR que revisará un hablante.',
            [`Idioma destino: ${a}.\nTexto:\n${texto}`],
            ctx,
          );
          return r.ok ? ok({ texto: r.valor.texto, lengua: a, revisado: false as const }) : r;
        },
      },
    },
  };
}

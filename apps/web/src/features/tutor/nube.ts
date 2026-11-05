/**
 * Live Rikuy over the cloud gateway (`/ia/tutor/*`, `/ia/voz`, `/ia/transcribir`, `/ia/pictogramas`).
 * No keys here. Every call has a short timeout; any failure returns null and the caller uses the rules agent.
 */
import type { EntradaTutorVivo } from '@rikuy/ai';
import { juzgarConReglas, type SolicitudJuez, type VeredictoJuez } from '@rikuy/tutor';
import { crearVozRikuy, type VozRikuy } from '../../platform/voz/vozRikuy.ts';
import { colegioPorDefecto, urlNubePorDefecto } from '../creador/clienteNube.ts';

export type EntradaTurno = Partial<EntradaTutorVivo> & { mensaje: string };

export interface TurnoNube {
  texto: string;
  modelo?: string;
  revisadoPor?: string;
  simulado: boolean;
  latenciaMs?: number;
}

export type EstadoIA = 'vivo' | 'reglas' | 'sin-red';

export interface UsoIA {
  gastadoUsd: number;
  restanteUsd: number;
  topeMensualUsd?: number;
  modo?: string;
  llamadas: number;
}

export interface ClienteTutorNube {
  turno(e: EntradaTurno, timeoutMs?: number): Promise<{ ok: true; valor: TurnoNube } | { ok: false; motivo: EstadoIA }>;
  juzgar(s: SolicitudJuez): Promise<VeredictoJuez>;
  voz(texto: string): Promise<{ mime: string; base64: string } | null>;
  transcribir(audio: Blob): Promise<string | null>;
  dibujo(descripcion: string): Promise<{ src: string } | { error: string }>;
  uso(): Promise<UsoIA | null>;
}

const enLinea = () => typeof navigator === 'undefined' || navigator.onLine !== false;

async function aBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function crearClienteTutorNube(o: { baseUrl?: string; colegioId?: string; fetch?: typeof fetch } = {}): ClienteTutorNube {
  const base = (o.baseUrl ?? urlNubePorDefecto()).replace(/\/+$/, '');
  const colegio = o.colegioId ?? colegioPorDefecto();
  const f = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function post(ruta: string, cuerpo: unknown, timeoutMs: number): Promise<{ status: number; json: Record<string, unknown> } | null> {
    if (!enLinea()) return null;
    const control = new AbortController();
    const t = setTimeout(() => control.abort(), timeoutMs);
    try {
      const r = await f(`${base}${ruta}`, {
        method: cuerpo === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', 'x-rikuy-colegio': colegio },
        ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
        signal: control.signal,
      });
      return { status: r.status, json: ((await r.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  return {
    async turno(e, timeoutMs = 4500) {
      const r = await post('/ia/tutor/turno', e, timeoutMs);
      if (!r) return { ok: false, motivo: 'sin-red' };
      if (r.status !== 200 || typeof r.json.texto !== 'string') return { ok: false, motivo: 'reglas' };
      return { ok: true, valor: r.json as unknown as TurnoNube };
    },
    async juzgar(s) {
      const r = await post('/ia/tutor/juzgar', s, 9000);
      const v = r?.status === 200 ? (r.json.veredicto as VeredictoJuez | undefined) : undefined;
      return v ?? { ...juzgarConReglas(s), respaldo: 'sin conexión con la nube' };
    },
    async voz(texto) {
      const r = await post('/ia/voz', { texto: texto.slice(0, 600) }, 9000);
      return r?.status === 200 && typeof r.json.base64 === 'string' ? { mime: String(r.json.mime), base64: r.json.base64 } : null;
    },
    async transcribir(audio) {
      const r = await post('/ia/transcribir', { mime: audio.type || 'audio/webm', base64: await aBase64(audio) }, 9000);
      return r?.status === 200 && typeof r.json.texto === 'string' ? r.json.texto : null;
    },
    async dibujo(descripcion) {
      const r = await post('/ia/pictogramas', { id: 'tutor', descripcion: descripcion.slice(0, 300) }, 30000);
      if (!r) return { error: 'Sin red: no puedo dibujar ahora.' };
      if (r.status === 429) return { error: 'Se acabó el presupuesto de IA de este mes: pídele a tu docente un dibujo en la pizarra.' };
      const img = r.json.imagen as { mime?: string; base64?: string } | undefined;
      if (r.status !== 200 || !img?.base64) return { error: 'No pude dibujar ahora.' };
      return { src: 'data:' + (img.mime ?? 'image/png') + ';base64,' + img.base64 };
    },
    async uso() {
      const [u, e] = await Promise.all([post('/ia/uso', undefined, 5000), post('/ia/estado', undefined, 5000)]);
      if (!u || u.status !== 200) return null;
      const entradas = (u.json.entradas as unknown[] | undefined) ?? [];
      return {
        gastadoUsd: Number(u.json.gastadoUsd ?? 0),
        restanteUsd: Number(u.json.restanteUsd ?? 0),
        ...(e?.status === 200 ? { topeMensualUsd: Number(e.json.topeMensualUsd), modo: String(e.json.modo) } : {}),
        llamadas: entradas.length,
      };
    },
  };
}

/** The live client the app uses; null in unit tests (they exercise the rules agent) or when the teacher turned it off. */
export function clienteTutorPorDefecto(): ClienteTutorNube | null {
  if (import.meta.env.MODE === 'test') return null;
  try {
    if (localStorage.getItem('rikuy.ia') === 'off') return null;
  } catch {
    /* storage can be blocked */
  }
  return crearClienteTutorNube();
}

let voz: VozRikuy | null = null;
/** Shared Rikuy voice: Gemini TTS through the gateway when online, Web Speech otherwise. */
export function vozRikuy(): VozRikuy {
  if (!voz) {
    const c = clienteTutorPorDefecto();
    voz = crearVozRikuy({ nube: c ? (t) => c.voz(t) : null });
  }
  return voz;
}

export const PIDE_DIBUJO = /\b(dib[uú]j\w*|mu[eé]str\w*me|ilustra\w*|imagen)\b/i;

/**
 * Rikuy's voice as one service any feature can use (tutor, museum, digestive hologram guide).
 * Order: cloud voice (Gemini TTS through the gateway, injected) -> local Web Speech voice -> text only.
 * Captions are always the caller's job: this service never replaces the text on screen.
 */
import { speak } from './speech.ts';

export type CanalVoz = 'nube' | 'navegador' | 'silencio';

export interface SintetizadorNube {
  (texto: string): Promise<{ mime: string; base64: string } | null>;
}

export interface VozRikuy {
  hablar(texto: string): Promise<CanalVoz>;
  detener(): void;
  silenciada(): boolean;
  silenciar(si: boolean): void;
  /** Lets a feature plug (or unplug) the cloud voice at runtime. */
  usarNube(s: SintetizadorNube | null): void;
}

const CLAVE = 'rikuy.voz.silencio';

export function crearVozRikuy(o: { nube?: SintetizadorNube | null } = {}): VozRikuy {
  let nube = o.nube ?? null;
  let audio: HTMLAudioElement | null = null;
  let silencio = (() => {
    try {
      return localStorage.getItem(CLAVE) === '1';
    } catch {
      return false;
    }
  })();

  function detener() {
    audio?.pause();
    audio = null;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  return {
    async hablar(texto) {
      if (silencio || !texto.trim()) return 'silencio';
      detener();
      const enLinea = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (nube && enLinea && typeof Audio !== 'undefined') {
        try {
          const r = await nube(texto);
          if (r && !silencio) {
            audio = new Audio(`data:${r.mime};base64,${r.base64}`);
            await audio.play();
            return 'nube';
          }
        } catch {
          /* fall through to the local voice */
        }
      }
      return speak(texto) ? 'navegador' : 'silencio';
    },
    detener,
    silenciada: () => silencio,
    silenciar(si) {
      silencio = si;
      if (si) detener();
      try {
        localStorage.setItem(CLAVE, si ? '1' : '0');
      } catch {
        /* storage can be blocked */
      }
    },
    usarNube(s) {
      nube = s;
    },
  };
}

/**
 * Rikuy, the spoken guide of the digestive hologram. For each depth level: narrate, ask ONE
 * question, let the group commit a prediction (tap, or voice where SpeechRecognition exists), reveal
 * it on the hologram, then explain and invite the group's own explanation (rules judge, offline).
 *
 * Voice: the shared narrator (recorded audio of content/audio/<lengua> first, then a local Spanish
 * voice es-PE > es-419 > es; Quechua is only ever played from recordings). Captions are always on.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Lengua } from '@rikuy/contracts';
import type { ViewerAction } from '@rikuy/holo';
import { crearNarrador } from '../../../shell/accesibilidad/narrador.ts';
import { buscarEnManifiesto, crearPuertoAudioNavegador, crearPuertoVozNavegador } from '../../../shell/accesibilidad/puertos-navegador.ts';
import { listenOnce, recognitionSupported } from '../../../platform/voz/speech.ts';
import { avanzarGuia, pasoDeNivel, reaccion, valorarExplicacion, type EstadoGuia, type ValoracionExplicacion } from './guion.ts';

const SILENCIO_KEY = 'rikuy.holo.guia.silencio';

function leerSilencio(): boolean {
  try {
    return localStorage.getItem(SILENCIO_KEY) === '1';
  } catch {
    return false;
  }
}

export interface GuiaRikuyProps {
  /** Current depth level of the hologram (0..3). */
  nivel: number;
  /** Sends the reveal actions to the hologram (local viewer or the projector). */
  enviar: (a: ViewerAction) => void;
  /** Light (control phone) or dark (on top of the hologram) look. */
  oscuro?: boolean;
}

export function GuiaRikuy({ nivel, enviar, oscuro = false }: GuiaRikuyProps) {
  const [lengua, setLengua] = useState<Lengua>('es');
  const [silencio, setSilencio] = useState(leerSilencio);
  // Live settings read by the narrator callbacks (never during render), updated after each render.
  const ajustes = useRef({ lengua, silencio });
  useEffect(() => {
    ajustes.current = { lengua, silencio };
  }, [lengua, silencio]);
  // The refs are only read inside the narrator callbacks, after render.
  // eslint-disable-next-line react-hooks/refs
  const [narrador] = useState(() =>
    crearNarrador({
      lengua: () => ajustes.current.lengua,
      voz: crearPuertoVozNavegador(),
      audio: crearPuertoAudioNavegador(),
      manifiesto: buscarEnManifiesto,
      soloLectorPantalla: () => ajustes.current.silencio,
    }),
  );
  const estadoVoz = useSyncExternalStore(narrador.suscribir, narrador.estado, narrador.estado);
  useEffect(() => () => narrador.detener(), [narrador]);

  const [guia, setGuia] = useState<EstadoGuia>({ nivel: 0, fase: 'narracion', prediccion: null });
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState('');
  const [valoracion, setValoracion] = useState<ValoracionExplicacion | null>(null);
  const paso = pasoDeNivel(guia.nivel);

  // The hologram level leads: diving (touch, pinch, gesture) restarts the guide at that level.
  if (pasoDeNivel(nivel).nivel !== guia.nivel) {
    setGuia(avanzarGuia(guia, { tipo: 'nivel', nivel }));
    setValoracion(null);
    setTexto('');
  }

  const decir = useCallback((id: string, t: string, clave?: string) => void narrador.narrar({ id, texto: t, ...(clave ? { clave } : {}) }), [narrador]);

  // Speak each phase once when it starts.
  useEffect(() => {
    if (guia.fase === 'narracion') decir(`n${paso.nivel}`, paso.narracion, paso.clave);
    if (guia.fase === 'pregunta') decir(`p${paso.nivel}`, paso.pregunta, `${paso.clave}.pregunta`);
    if (guia.fase === 'observacion') decir(`o${paso.nivel}`, reaccion(paso, guia.prediccion));
    if (guia.fase === 'explicacion') decir(`e${paso.nivel}`, paso.explicacion, `${paso.clave}.explicacion`);
  }, [guia.fase, guia.nivel, guia.prediccion, paso, decir]);

  const predecir = (opcion: string) => {
    const siguiente = avanzarGuia(guia, { tipo: 'predecir', opcion });
    if (siguiente === guia) return;
    setGuia(siguiente);
    paso.revelar.forEach(enviar);
  };

  async function responderConVoz() {
    setEscuchando(true);
    const dicho = await listenOnce().result;
    setEscuchando(false);
    if (!dicho) return;
    if (guia.fase === 'pregunta') {
      const n = dicho.toLowerCase();
      const op = paso.opciones.find((o) => o.texto.toLowerCase().split(' ').filter((w) => w.length > 4).some((w) => n.includes(w)));
      if (op) predecir(op.id);
      return;
    }
    setTexto(dicho);
    setValoracion(valorarExplicacion(dicho, paso));
  }

  const alternarSilencio = () => {
    const nuevo = !silencio;
    setSilencio(nuevo);
    try {
      localStorage.setItem(SILENCIO_KEY, nuevo ? '1' : '0');
    } catch {
      /* private mode: the toggle still works for this visit */
    }
    if (nuevo) narrador.detener();
  };

  const caja = oscuro ? 'border-[#5FE3FF] bg-black text-[#E6FBFF]' : 'border-[#00566A] bg-white text-[#0D2B33]';
  const boton = oscuro ? 'border-[#5FE3FF] text-[#5FE3FF]' : 'border-[#00566A] text-[#00566A] bg-white';
  const subtitulo = estadoVoz.subtitulo ?? (guia.fase === 'narracion' ? paso.narracion : guia.fase === 'pregunta' ? paso.pregunta : guia.fase === 'observacion' ? reaccion(paso, guia.prediccion) : paso.explicacion);
  const sinGrabacion = lengua !== 'es' && estadoVoz.aviso === 'sin-grabacion';

  return (
    <section aria-label="Guía de Rikuy" className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${caja}`}>
      <header className="flex items-center justify-between gap-2">
        <p className="text-lg font-extrabold">
          <span aria-hidden="true">🤖 </span>Rikuy · Nivel {paso.nivel + 1}
        </p>
        <div className="flex gap-2">
          <button type="button" aria-pressed={lengua === 'quy'} onClick={() => setLengua((l) => (l === 'es' ? 'quy' : 'es'))} className={`h-12 rounded-xl border-2 px-3 text-sm font-bold ${boton}`}>
            {lengua === 'es' ? 'Castellano' : 'Quechua'}
          </button>
          <button type="button" aria-pressed={silencio} onClick={alternarSilencio} className={`h-12 w-12 rounded-xl border-2 text-xl ${boton}`} aria-label={silencio ? 'Activar la voz de Rikuy' : 'Silenciar a Rikuy'}>
            {silencio ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* Captions are always visible (accessibility), with or without voice. */}
      <p aria-live="polite" className="text-[17px] leading-snug">
        {subtitulo}
      </p>
      {sinGrabacion && <p className="text-sm opacity-80">Aún no hay grabación en quechua para este texto: se muestra en castellano.</p>}

      {guia.fase === 'narracion' && (
        <button type="button" onClick={() => setGuia((g) => avanzarGuia(g, { tipo: 'siguiente' }))} className="h-12 rounded-xl bg-[#075E6C] font-bold text-white">
          Rikuy pregunta ›
        </button>
      )}

      {guia.fase === 'pregunta' && (
        <div role="group" aria-label="¿Qué predicen?" className="flex flex-col gap-2">
          <p className="text-sm font-bold">Predigan antes de ver:</p>
          {paso.opciones.map((o) => (
            <button key={o.id} type="button" onClick={() => predecir(o.id)} className={`min-h-12 rounded-xl border-2 px-3 py-2 text-left font-semibold ${boton}`}>
              {o.texto}
            </button>
          ))}
        </div>
      )}

      {guia.fase === 'observacion' && (
        <button type="button" onClick={() => setGuia((g) => avanzarGuia(g, { tipo: 'siguiente' }))} className="h-12 rounded-xl bg-[#075E6C] font-bold text-white">
          Ya observamos · ¿por qué pasa? ›
        </button>
      )}

      {guia.fase === 'explicacion' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setValoracion(valorarExplicacion(texto, paso));
          }}
        >
          <label className="text-sm font-bold" htmlFor="explicacion-grupo">
            Explíquenlo con sus palabras
          </label>
          <textarea id="explicacion-grupo" value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} className="rounded-xl border-2 border-[#6A7568] bg-white p-2 text-[#0D2B33]" placeholder="Pasa esto porque…" />
          <button type="submit" className="h-12 rounded-xl bg-[#075E6C] font-bold text-white">
            Revisar mi explicación
          </button>
          {valoracion && (
            <p role="status" className="rounded-xl border-2 border-[#F5B301] bg-[#FFF1CC] px-3 py-2 text-[#6B4300]">
              {valoracion.mensaje}
              {valoracion.cita && <span className="block text-sm">Rikuy leyó: “{valoracion.cita}”</span>}
            </p>
          )}
        </form>
      )}

      {recognitionSupported() && (guia.fase === 'pregunta' || guia.fase === 'explicacion') && (
        <button type="button" disabled={escuchando} onClick={() => void responderConVoz()} className={`h-12 rounded-xl border-2 font-semibold ${boton}`}>
          {escuchando ? 'Escuchando…' : '🎙 Responder con la voz'}
        </button>
      )}
    </section>
  );
}

import { Button, Mascot } from '@rikuy/ui';
import type { SolicitudJuez, VeredictoJuez } from '@rikuy/tutor';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { almacenDocente } from '../../features/docente/Proveedor.tsx';
import { clienteTutorPorDefecto, crearClienteTutorNube, vozRikuy } from '../../features/tutor/nube.ts';
import { useSesion } from '../sesion.ts';
import { APODOS } from '../unirse.ts';

/**
 * Audience join link for the pitch (`#/unirse/demo`): one nickname, auto-join the demo class 2.º B as a
 * group, answer the pendulum question by text or voice, get graded by the live judge and a Socratic follow-up.
 */
export const PREGUNTA_DEMO = 'Si alargas la cuerda, ¿el péndulo irá más rápido o más lento? ¿Por qué?';
export const CODIGO_DEMO = 'DEMO2B';

export function solicitudDemo(respuesta: string): SolicitudJuez {
  return {
    indicador: 'justificacion',
    respuesta,
    contexto: {
      variables: [{ id: 'longitud', etiqueta: 'Longitud de la cuerda', sinonimos: ['cuerda', 'largo', 'larga', 'longitud', 'hilo'] }],
      variableProbada: 'longitud',
      conceptos: ['tiempo', 'periodo', 'oscilación', 'oscila', 'recorrido', 'distancia', 'vuelta'],
    },
    datos: [],
  };
}

type Reconocedor = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void };

function crearReconocedor(): Reconocedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconocedor; webkitSpeechRecognition?: new () => Reconocedor };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export function UnirseDemo() {
  const navegar = useNavigate();
  const unirse = useSesion((s) => s.unirse);
  const elegirRol = useSesion((s) => s.elegirRol);
  const [apodo, setApodo] = useState('');
  const [unido, setUnido] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [veredicto, setVeredicto] = useState<VeredictoJuez | null>(null);
  const [seguimiento, setSeguimiento] = useState('');

  const entrar = (e: FormEvent) => {
    e.preventDefault();
    if (!apodo.trim()) return;
    try {
      if (almacenDocente().getState().eventos.length === 0) almacenDocente().getState().cargarDemo({ completa: true });
    } catch {
      /* the demo seed is optional on an audience phone */
    }
    const grupo = APODOS[Math.floor(Math.random() * APODOS.length)]!;
    elegirRol('grupo');
    unirse({ codigo: CODIGO_DEMO, apodo: grupo, nivel: 'normal' });
    setUnido(true);
  };

  const hablar = () => {
    const r = crearReconocedor();
    if (!r) return;
    r.lang = 'es-PE';
    r.interimResults = false;
    r.onresult = (e) => setRespuesta((prev) => `${prev} ${e.results[0]?.[0]?.transcript ?? ''}`.trim());
    r.onend = () => setEscuchando(false);
    setEscuchando(true);
    r.start();
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!respuesta.trim() || enviando) return;
    setEnviando(true);
    const c = clienteTutorPorDefecto() ?? crearClienteTutorNube();
    const v = await c.juzgar(solicitudDemo(respuesta.trim()));
    setVeredicto(v);
    const t = await c.turno({ mensaje: `Pregunta: ${PREGUNTA_DEMO}\nRespuesta del grupo ${apodo.trim()}: ${respuesta.trim()}` });
    const texto = t.ok ? t.valor.texto : 'Buena idea. ¿Cómo podrías comprobarlo midiendo el tiempo de 10 vueltas con dos cuerdas distintas?';
    setSeguimiento(texto);
    void vozRikuy().hablar(texto).catch(() => undefined);
    setEnviando(false);
  };

  const puedeHablar = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--rk-w-phone)] flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <Mascot estado="curiosa" size={56} />
        <h1 className="m-0 text-title font-extrabold">{unido ? 'Reto del péndulo' : 'Únete a 2.º B'}</h1>
      </header>

      {!unido && (
        <form onSubmit={entrar} className="flex flex-col gap-3">
          <label htmlFor="apodo-demo" className="text-body font-semibold">
            Tu apodo
          </label>
          <input
            id="apodo-demo"
            value={apodo}
            onChange={(e) => setApodo(e.target.value)}
            maxLength={20}
            autoComplete="off"
            className="h-14 rounded-xl border-2 border-[#6A7568] px-3 text-title"
          />
          <Button type="submit" size="lg" disabled={!apodo.trim()}>
            Entrar
          </Button>
        </form>
      )}

      {unido && (
        <form onSubmit={enviar} className="flex flex-col gap-3">
          <p className="m-0 text-body font-bold">{PREGUNTA_DEMO}</p>
          <label htmlFor="respuesta-demo" className="sr-only">
            Tu respuesta
          </label>
          <textarea
            id="respuesta-demo"
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            rows={3}
            className="rounded-xl border-2 border-[#6A7568] p-3 text-body"
          />
          <div className="flex gap-2">
            {puedeHablar && (
              <Button type="button" variant="ghost" onClick={hablar} disabled={escuchando}>
                {escuchando ? 'Escuchando…' : '🎤 Hablar'}
              </Button>
            )}
            <Button type="submit" size="lg" disabled={!respuesta.trim() || enviando}>
              {enviando ? 'Rikuy está pensando…' : 'Enviar'}
            </Button>
          </div>
        </form>
      )}

      {veredicto && (
        <section aria-label="Resultado" className="flex flex-col gap-2 rounded-2xl border-2 border-[#D3D9CC] bg-white p-4">
          <p className="m-0 text-title font-extrabold">Nivel: {veredicto.nivel}</p>
          {veredicto.cita && <blockquote className="m-0 border-l-4 border-[#075E6C] pl-3 italic">“{veredicto.cita}”</blockquote>}
          <p className="m-0 text-caption text-ink-2">Juez: {veredicto.fuente}{veredicto.respaldo ? ` (${veredicto.respaldo})` : ''}</p>
          {seguimiento && <p className="m-0 text-body">🦙 {seguimiento}</p>}
          <Button type="button" variant="ghost" onClick={() => navegar('/museo')}>
            Ir al museo
          </Button>
        </section>
      )}
    </main>
  );
}

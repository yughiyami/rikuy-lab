/**
 * "Sala del público": the Sala Física hall shared live by every phone that scanned the pitch QR. Real hub
 * presence only (no simulator): each phone sees the others walking, with their nickname over the head.
 * The exhibit "El péndulo" opens the question card; every graded answer is broadcast to the room so the
 * presenter's board shows it.
 */
import type { AvatarRender, Destino } from '@rikuy/campus';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { construirMuseo } from './catalogo.ts';
import { ControladorMundo } from './controlador.ts';
import { COLORES_GRUPO } from './grupo.ts';
import { Rikuy } from './Iconos.tsx';
import { conectarPublico, type ConexionPublico, type NivelPublico, type PosPublico } from './presencia/publico.ts';
import { VistaMundo } from './VistaMundo.tsx';
import './mundo.css';

export interface ResultadoPublico {
  nivel: NivelPublico;
  cita: string;
  fuente: string;
  respaldo?: string;
  seguimiento: string;
}

const SALA = 'sala-fisica';
const SILENCIO_MS = 7000;
const colorDe = (id: string) => COLORES_GRUPO[[...id].reduce((h, c) => h + c.charCodeAt(0), 0) % COLORES_GRUPO.length]!;

type Reconocedor = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror?: () => void; start: () => void };

function crearReconocedor(): Reconocedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconocedor; webkitSpeechRecognition?: new () => Reconocedor };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export function SalaPublico({ apodo, pregunta, responder }: { apodo: string; pregunta: string; responder: (texto: string) => Promise<ResultadoPublico> }) {
  const [abierta, setAbierta] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [enSala, setEnSala] = useState(1);
  const [respuesta, setRespuesta] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPublico | null>(null);
  const pares = useRef(new Map<string, PosPublico & { visto: number }>());
  const conexion = useRef<ConexionPublico | null>(null);
  const ultimoEnvio = useRef({ t: 0, x: -1, y: -1 });
  const tarjeta = useRef<HTMLElement>(null);
  useEffect(() => {
    if (abierta) tarjeta.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [abierta]);

  const escena = useMemo(() => construirMuseo({ rejasAbiertas: new Set() }).salas[SALA]!, []);
  // generated destination ids are `exh-<exhibit id>`; find the pendulum by its exhibit id
  const idPendulo = useMemo(() => escena.destinos.find((d) => d.exhibicionId === 'exh-pendulo')?.id ?? 'exh-exh-pendulo', [escena]);
  const alLlegar = useCallback((d: Destino) => {
    if (d.tipo === 'exhibicion') setAbierta(true);
  }, []);
  const controlador = useMemo(() => new ControladorMundo(escena, alLlegar), [escena, alLlegar]);

  useEffect(() => {
    const c = conectarPublico(
      'control',
      (m) => {
        if (m.tipo === 'pos' && m.pos.id !== c.id) pares.current.set(m.pos.id, { ...m.pos, visto: Date.now() });
      },
      setConectado,
    );
    conexion.current = c;
    const t = setInterval(() => {
      const ahora = Date.now();
      for (const [id, p] of pares.current) if (ahora - p.visto > SILENCIO_MS) pares.current.delete(id);
      setEnSala(pares.current.size + 1);
    }, 1000);
    return () => {
      clearInterval(t);
      c.cerrar();
      conexion.current = null;
    };
  }, []);

  const fuente = {
    jugador: (): AvatarRender => ({
      id: conexion.current?.id ?? 'yo',
      x: controlador.pos.x,
      y: controlador.pos.y,
      dir: controlador.dir,
      color: colorDe(apodo),
      etiqueta: apodo,
      integrantes: 1,
      propio: true,
    }),
    otros: (): AvatarRender[] =>
      [...pares.current.values()].map((p) => ({ id: p.id, x: p.x, y: p.y, dir: p.dir, color: colorDe(p.apodo), etiqueta: p.apodo, integrantes: 1 })),
    alPaso: () => {
      const ahora = Date.now();
      const u = ultimoEnvio.current;
      const { x, y } = controlador.pos;
      const movio = Math.abs(x - u.x) + Math.abs(y - u.y) > 0.05;
      if ((movio && ahora - u.t > 200) || ahora - u.t > 2000) {
        ultimoEnvio.current = { t: ahora, x, y };
        conexion.current?.enviarPos({ apodo, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, dir: controlador.dir });
      }
    },
    resaltado: () => idPendulo,
    sugerencia: () => [],
  };

  const hablar = () => {
    const r = crearReconocedor();
    if (!r) return;
    r.lang = 'es-PE';
    r.interimResults = false;
    r.onresult = (e) => setRespuesta((prev) => `${prev} ${e.results[0]?.[0]?.transcript ?? ''}`.trim());
    r.onend = () => setEscuchando(false);
    r.onerror = () => setEscuchando(false);
    setEscuchando(true);
    r.start();
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const texto = respuesta.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    try {
      const r = await responder(texto);
      setResultado(r);
      conexion.current?.enviarCalificacion({ apodo, nivel: r.nivel, cita: r.cita, fuente: r.fuente });
    } finally {
      setEnviando(false);
    }
  };

  const puedeHablar = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  return (
    <section className="rk-mundo min-h-dvh overflow-x-hidden" aria-labelledby="titulo-publico">
      <header className="rk-sign" style={{ background: '#075E6C' }}>
        <div>
          <h2 id="titulo-publico">Sala del público</h2>
          <small>
            <span data-testid="en-sala">{enSala}</span> {enSala === 1 ? 'persona' : 'personas'} en la sala · {conectado ? 'en vivo' : 'conectando…'}
          </small>
        </div>
      </header>

      <div className="rk-burbuja" role="status" aria-live="polite">
        <Rikuy expresion="curiosa" />
        <p>Hola, {apodo}. Toca “El péndulo” en el mapa (o el botón) y responde la pregunta. ¡Todos verán tu nivel en la pantalla!</p>
      </div>

      {!abierta && (
        <div className="px-3 pb-3">
          <button type="button" className="rk-btn w-full justify-center text-lg" style={{ minHeight: 56 }} data-primario="" onClick={() => setAbierta(true)}>
            Responder la pregunta del péndulo
          </button>
        </div>
      )}

      {abierta && (
        <section ref={tarjeta} aria-label="El péndulo" className="mx-3 my-3 flex scroll-mt-2 flex-col gap-3 rounded-2xl border-4 border-[#075E6C] bg-white p-4 text-[#0D2B33] shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 text-2xl font-extrabold">El péndulo</h3>
            <button type="button" className="rk-btn" onClick={() => setAbierta(false)} aria-label="Cerrar la pregunta">
              Ver mapa
            </button>
          </div>
          <form onSubmit={enviar} className="flex flex-col gap-3">
            <p className="m-0 text-lg font-bold leading-snug">{pregunta}</p>
            <label htmlFor="respuesta-publico" className="sr-only">
              Tu respuesta
            </label>
            <textarea
              id="respuesta-publico"
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              rows={4}
              placeholder="Escribe o dicta tu respuesta…"
              maxLength={400}
              className="min-h-32 w-full rounded-xl border-2 border-[#6A7568] p-3 text-lg"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {puedeHablar && (
                <button type="button" className="rk-btn w-full justify-center text-lg" style={{ minHeight: 56 }} onClick={hablar} disabled={escuchando}>
                  {escuchando ? 'Escuchando…' : '🎤 Hablar'}
                </button>
              )}
              <button type="submit" className="rk-btn w-full justify-center text-lg" style={{ minHeight: 56 }} data-primario="" disabled={!respuesta.trim() || enviando}>
                {enviando ? 'Rikuy está pensando…' : 'Enviar respuesta'}
              </button>
            </div>
          </form>
          {resultado && (
            <div aria-label="Resultado" className="flex flex-col gap-2 rounded-xl bg-[#E9ECE4] p-3">
              <p className="m-0 text-2xl font-extrabold">Nivel: {resultado.nivel === 'NO' ? 'No observable' : resultado.nivel}</p>
              {resultado.cita && <blockquote className="m-0 border-l-4 border-[#075E6C] pl-3 text-lg italic break-words">“{resultado.cita}”</blockquote>}
              <p className="m-0 text-xs">
                Juez: {resultado.fuente}
                {resultado.respaldo ? ` (${resultado.respaldo})` : ''}
              </p>
              {resultado.seguimiento && <p className="m-0 text-lg leading-snug break-words">🦙 {resultado.seguimiento}</p>}
            </div>
          )}
        </section>
      )}

      <div className="w-full overflow-hidden" style={{ height: 'clamp(320px, 75vw, 620px)' }}>
        <VistaMundo controlador={controlador} etiqueta="Mapa de la Sala del público" fuente={fuente} llenar zoomMinimo={0.3} abrirAlTocar />
      </div>

    </section>
  );
}

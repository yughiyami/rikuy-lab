import type { Comando, ConsultaMemoria, EstadoApoyo, FuenteIA, MemoriaEntrada } from '@rikuy/contracts';
import { indiceCurricular } from '@rikuy/curriculum-cneb';
import { fundamentoCurricular, insigniaFuente, tutorActivo, turnoReglas, type EventoInterruptor, type PracticaAgente, type ResultadoComando } from '@rikuy/tutor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listenOnce, recognitionSupported } from '../../platform/voz/speech.ts';
import { PIDE_DIBUJO, clienteTutorPorDefecto, vozRikuy, type ClienteTutorNube, type EntradaTurno, type EstadoIA } from './nube.ts';
import { ESCENAS_DEMO, type Visor } from './demo.ts';
import { TutorVista, type MensajeVista } from './TutorVista.tsx';

export interface DatosTurno {
  grupoId: string;
  fuente: FuenteIA;
  texto: string;
  comandos: Comando[];
}

interface Props {
  practica: PracticaAgente;
  visor: Visor;
  grupoId: string;
  /** `tutor.interruptor` events of the class (teacher authority). */
  eventosInterruptor: readonly EventoInterruptor[];
  /** `Clase.tutor.activo` when the class was created. Default true. */
  tutorActivoInicial?: boolean;
  escenas?: readonly string[];
  /** Memory port (local-first); the tutor receives at most 5 entries. */
  memoria?: ConsultaMemoria;
  estudianteId?: string;
  estadoApoyo?: EstadoApoyo;
  /** Called after each turn so the caller can append a `tutor.turno` event. */
  onTurno?(datos: DatosTurno): void;
  /** Live cloud tutor; `null` forces the rules agent. Default: the gateway client (null in unit tests). */
  nube?: ClienteTutorNube | null;
  /** The group's own measurements, cited by the live tutor. */
  datos?: readonly { x: number; y: number }[];
  /** Museum hall context (desktop panel, curators). */
  sala?: EntradaTurno['sala'];
  /** Optional grounding from the curriculum retrieval port. */
  contexto?: EntradaTurno['contexto'];
}

/** Rules turns the live model may phrase: dialogue and hints; viewer actions and honesty phrases stay with the rules. */
const KINDS_VIVOS = new Set(['pregunta', 'hipotesis', 'conclusion', 'pista']);

/** Commands the panel resolves by itself (the hint and the notes are part of this UI, not of the viewer). */
const INTERNOS = new Set<Comando['tool']>(['dar_pista', 'registrar_hipotesis', 'registrar_conclusion']);

/**
 * Container: connects the rules agent (@rikuy/tutor), the viewer port, the kill switch and the memory.
 * Honesty: the announcement is shown first; "Listo" / "No pude" is shown only after the viewer answered.
 */
export function TutorPanel({ practica, visor, grupoId, eventosInterruptor, tutorActivoInicial = true, escenas = ESCENAS_DEMO, memoria, estudianteId, estadoApoyo, onTurno, nube: nubeProp, datos = [], sala, contexto }: Props) {
  const nube = useMemo(() => (nubeProp === undefined ? clienteTutorPorDefecto() : nubeProp), [nubeProp]);
  const voz = useMemo(() => (nube ? vozRikuy() : null), [nube]);
  const [estadoIA, setEstadoIA] = useState<EstadoIA | null>(nube ? 'vivo' : null);
  const [silencio, setSilencio] = useState(() => voz?.silenciada() ?? true);
  const [escuchando, setEscuchando] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeVista[]>([]);
  const [valor, setValor] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [recuerdos, setRecuerdos] = useState<MemoriaEntrada[]>([]);
  const mostradas = useRef(0);
  const siguienteId = useRef(1);

  useEffect(() => {
    let vigente = true;
    if (memoria && estudianteId) {
      void memoria.recuperar({ estudianteId, limite: 5 }).then((r) => {
        if (vigente) setRecuerdos(r);
      });
    }
    return () => {
      vigente = false;
    };
  }, [memoria, estudianteId]);

  const activo = tutorActivo(eventosInterruptor, grupoId, tutorActivoInicial);

  const agregar = (m: Omit<MensajeVista, 'id'>) => setMensajes((prev) => [...prev, { ...m, id: siguienteId.current++ }]);
  const historial = () => mensajes.slice(-6).map((m) => ({ autor: m.autor, texto: m.texto.slice(0, 600) }));

  async function escuchar() {
    if (escuchando) return;
    setEscuchando(true);
    try {
      const texto = await listenOnce().result;
      if (texto) setValor(texto);
    } finally {
      setEscuchando(false);
    }
  }

  async function dibujar(texto: string) {
    if (!nube) return;
    agregar({ autor: 'tutor', texto: 'Voy a intentar hacer un dibujo…' });
    const r = await nube.dibujo(texto + '. Tema: ' + practica.preguntaGuia);
    if ('src' in r) agregar({ autor: 'tutor', texto: '¿Qué parte del dibujo se parece a lo que mediste?', imagen: r.src, insignia: insigniaFuente('ia-nube') });
    else agregar({ autor: 'tutor', texto: r.error, insignia: insigniaFuente('reglas') });
  }

  async function enviar() {
    const texto = valor.trim();
    if (!texto || ocupado || !activo) return;
    setValor('');
    setOcupado(true);
    agregar({ autor: 'alumno', texto });

    const r = turnoReglas(texto, {
      practica,
      escenas,
      escalera: { mostradas: mostradas.current },
      recuerdos,
      tutorActivo: activo,
      ...(estadoApoyo ? { estadoApoyo } : {}),
    });
    if (r.tipo === 'silencio') {
      setOcupado(false);
      return;
    }
    if (nube && PIDE_DIBUJO.test(texto)) {
      await dibujar(texto);
      setOcupado(false);
      return;
    }
    let dicho = r.texto;
    let fuente = r.fuente;
    if (nube && KINDS_VIVOS.has(r.kind)) {
      const pista = r.comandos.find((c) => c.tool === 'dar_pista');
      const vivo = await nube.turno(
        {
          mensaje: texto,
          modo: pista ? 'pista' : sala ? 'curador' : 'dialogo',
          ...(pista && pista.tool === 'dar_pista' ? { nivelPista: pista.args.nivel } : {}),
          historial: historial(),
          practica: { preguntaGuia: practica.preguntaGuia, limitaciones: [...practica.limitaciones], variables: practica.variables.map((v) => v.etiqueta) },
          datos: [...datos],
          reservados: { numeros: [...practica.reservados.numeros], frases: [...practica.reservados.frases] },
          ...(sala ? { sala } : {}),
          ...(contexto ? { contexto } : {}),
        },
        pista ? 9000 : 6000,
      );
      setEstadoIA(vivo.ok ? 'vivo' : vivo.motivo);
      if (vivo.ok) {
        dicho = pista ? 'Te doy una pista, no la respuesta: ' + vivo.valor.texto : vivo.valor.texto;
        fuente = 'ia-nube';
      }
    }
    const fundamento = fundamentoCurricular(texto, indiceCurricular());
    agregar({
      autor: 'tutor',
      texto: dicho,
      insignia: insigniaFuente(fuente),
      ...(fundamento ? { fundamento: { texto: fundamento.fragmento.texto, cita: fundamento.cita } } : {}),
    });
    void voz?.hablar(dicho);
    onTurno?.({ grupoId, fuente, texto: dicho, comandos: r.comandos });

    const resultados: ResultadoComando[] = [];
    for (const comando of r.comandos) {
      if (INTERNOS.has(comando.tool)) {
        if (comando.tool === 'dar_pista') mostradas.current = Math.max(mostradas.current, comando.args.nivel);
        resultados.push({ comando, ok: true });
        continue;
      }
      try {
        resultados.push({ comando, ...(await visor.ejecutar(comando)) });
      } catch {
        resultados.push({ comando, ok: false, motivo: 'el visor no respondió' });
      }
    }
    if (resultados.some((x) => x.comando.tool !== 'dar_pista')) {
      agregar({ autor: 'tutor', texto: r.confirmar(resultados.filter((x) => x.comando.tool !== 'dar_pista')), insignia: r.insignia });
    }
    setOcupado(false);
  }

  return (
    <TutorVista
      mensajes={mensajes}
      silenciado={!activo}
      preguntaGuia={practica.preguntaGuia}
      valor={valor}
      ocupado={ocupado}
      onCambiar={setValor}
      onEnviar={() => void enviar()}
      {...(estadoIA ? { estadoIA } : {})}
      {...(voz
        ? {
            silencioVoz: silencio,
            onSilencio: () => {
              voz.silenciar(!silencio);
              setSilencio(!silencio);
            },
          }
        : {})}
      {...(recognitionSupported() ? { escuchando, onEscuchar: () => void escuchar() } : {})}
    />
  );
}

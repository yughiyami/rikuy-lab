import type { Comando, ConsultaMemoria, EstadoApoyo, FuenteIA, MemoriaEntrada } from '@rikuy/contracts';
import { indiceCurricular } from '@rikuy/curriculum-cneb';
import { fundamentoCurricular, tutorActivo, turnoReglas, type EventoInterruptor, type PracticaAgente, type ResultadoComando } from '@rikuy/tutor';
import { useEffect, useRef, useState } from 'react';
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
}

/** Commands the panel resolves by itself (the hint and the notes are part of this UI, not of the viewer). */
const INTERNOS = new Set<Comando['tool']>(['dar_pista', 'registrar_hipotesis', 'registrar_conclusion']);

/**
 * Container: connects the rules agent (@rikuy/tutor), the viewer port, the kill switch and the memory.
 * Honesty: the announcement is shown first; "Listo" / "No pude" is shown only after the viewer answered.
 */
export function TutorPanel({ practica, visor, grupoId, eventosInterruptor, tutorActivoInicial = true, escenas = ESCENAS_DEMO, memoria, estudianteId, estadoApoyo, onTurno }: Props) {
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
    const fundamento = fundamentoCurricular(texto, indiceCurricular());
    agregar({
      autor: 'tutor',
      texto: r.texto,
      insignia: r.insignia,
      ...(fundamento ? { fundamento: { texto: fundamento.fragmento.texto, cita: fundamento.cita } } : {}),
    });
    onTurno?.({ grupoId, fuente: r.fuente, texto: r.texto, comandos: r.comandos });

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
    />
  );
}

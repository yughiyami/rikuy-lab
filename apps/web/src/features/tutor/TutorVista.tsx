import type { Insignia } from '@rikuy/tutor';

export interface MensajeVista {
  id: number;
  autor: 'alumno' | 'tutor';
  texto: string;
  insignia?: Insignia;
  /** Retrieved curriculum chunk that grounds the reply, with its citation (RAG). */
  fundamento?: { texto: string; cita: string };
  /** Optional illustration (Meta Muse Image) shown under the caption. */
  imagen?: string;
}

const ESTADO_IA = {
  vivo: 'IA en vivo',
  reglas: 'IA ocupada: modo reglas',
  'sin-red': 'Sin red: modo reglas',
} as const;

interface Props {
  mensajes: readonly MensajeVista[];
  silenciado: boolean;
  preguntaGuia: string;
  valor: string;
  ocupado: boolean;
  onCambiar(valor: string): void;
  onEnviar(): void;
  /** Live AI indicator; absent when the panel runs on rules only. */
  estadoIA?: keyof typeof ESTADO_IA;
  silencioVoz?: boolean;
  onSilencio?(): void;
  escuchando?: boolean;
  onEscuchar?(): void;
}

/** Presentational: props in, markup out. The container (TutorPanel) owns state, the tutor and the viewer. */
export function TutorVista({ mensajes, silenciado, preguntaGuia, valor, ocupado, onCambiar, onEnviar, estadoIA, silencioVoz, onSilencio, escuchando, onEscuchar }: Props) {
  if (silenciado) {
    return (
      <section aria-label="Cuaderno" className="rounded-lg border border-neutral-700 p-4">
        <p className="text-sm text-neutral-300">Modo cuaderno: tu docente apagó el tutor. Usa la pregunta guía, mide y escribe tu conclusión.</p>
        <p className="mt-3 text-lg font-medium">{preguntaGuia}</p>
      </section>
    );
  }
  return (
    <section aria-label="Tutor Rikuy" className="flex flex-col gap-3 rounded-lg border border-neutral-700 p-4">
      {estadoIA || onSilencio ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          {estadoIA ? (
            <span data-estado-ia={estadoIA} className={'rounded-full border px-2 py-0.5 ' + (estadoIA === 'vivo' ? 'border-emerald-500 text-emerald-300' : 'border-amber-500 text-amber-300')}>
              {ESTADO_IA[estadoIA]}
            </span>
          ) : (
            <span />
          )}
          {onSilencio ? (
            <button type="button" className="rounded-full border border-neutral-600 px-2 py-0.5" aria-pressed={!silencioVoz} onClick={onSilencio}>
              {silencioVoz ? 'Voz apagada' : 'Voz encendida'}
            </button>
          ) : null}
        </div>
      ) : null}
      <ol role="log" aria-live="polite" className="flex flex-col gap-2">
        {mensajes.map((m) => (
          <li key={m.id} className={m.autor === 'alumno' ? 'self-end rounded-lg bg-neutral-800 px-3 py-2' : 'self-start rounded-lg bg-indigo-950 px-3 py-2'}>
            <span className="block text-xs text-neutral-400">{m.autor === 'alumno' ? 'Tú' : 'Rikuy'}</span>
            <span>{m.texto}</span>
            {m.imagen ? <img src={m.imagen} alt={'Dibujo de Rikuy: ' + m.texto} className="mt-2 max-h-48 rounded" /> : null}
            {m.insignia ? (
              <span title={m.insignia.descripcion} className="mt-1 inline-block rounded-full border border-neutral-600 px-2 text-xs text-neutral-300">
                {m.insignia.etiqueta}
              </span>
            ) : null}
            {m.fundamento ? (
              <span className="mt-2 block border-l-2 border-indigo-400 pl-2 text-xs text-neutral-300">
                Del currículo: «{m.fundamento.texto.length > 220 ? `${m.fundamento.texto.slice(0, 220)}…` : m.fundamento.texto}»
                <cite className="block not-italic text-neutral-400">Fuente: {m.fundamento.cita}</cite>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onEnviar();
        }}
      >
        <label className="sr-only" htmlFor="tutor-entrada">
          Escribe a Rikuy
        </label>
        <input
          id="tutor-entrada"
          className="min-h-11 flex-1 rounded-lg border border-neutral-600 bg-neutral-900 px-3"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          placeholder="Escribe aquí"
          autoComplete="off"
        />
        {onEscuchar ? (
          <button type="button" onClick={onEscuchar} disabled={escuchando} aria-label="Hablar en lugar de escribir" className="min-h-11 rounded-lg border border-neutral-600 px-3 disabled:opacity-50">
            {escuchando ? 'Escuchando…' : 'Hablar'}
          </button>
        ) : null}
        <button type="submit" disabled={ocupado || valor.trim() === ''} className="min-h-11 rounded-lg bg-indigo-600 px-4 disabled:opacity-50">
          Enviar
        </button>
      </form>
    </section>
  );
}

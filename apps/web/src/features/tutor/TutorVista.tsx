import type { Insignia } from '@rikuy/tutor';

export interface MensajeVista {
  id: number;
  autor: 'alumno' | 'tutor';
  texto: string;
  insignia?: Insignia;
  /** Retrieved curriculum chunk that grounds the reply, with its citation (RAG). */
  fundamento?: { texto: string; cita: string };
}

interface Props {
  mensajes: readonly MensajeVista[];
  silenciado: boolean;
  preguntaGuia: string;
  valor: string;
  ocupado: boolean;
  onCambiar(valor: string): void;
  onEnviar(): void;
}

/** Presentational: props in, markup out. The container (TutorPanel) owns state, the tutor and the viewer. */
export function TutorVista({ mensajes, silenciado, preguntaGuia, valor, ocupado, onCambiar, onEnviar }: Props) {
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
      <ol role="log" aria-live="polite" className="flex flex-col gap-2">
        {mensajes.map((m) => (
          <li key={m.id} className={m.autor === 'alumno' ? 'self-end rounded-lg bg-neutral-800 px-3 py-2' : 'self-start rounded-lg bg-indigo-950 px-3 py-2'}>
            <span className="block text-xs text-neutral-400">{m.autor === 'alumno' ? 'Tú' : 'Rikuy'}</span>
            <span>{m.texto}</span>
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
        <button type="submit" disabled={ocupado || valor.trim() === ''} className="min-h-11 rounded-lg bg-indigo-600 px-4 disabled:opacity-50">
          Enviar
        </button>
      </form>
    </section>
  );
}

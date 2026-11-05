/** The room curator's question (no answer key). Any honest answer opens the back gallery. Free questions go to live Rikuy. */
import { preguntaDeSala, responderCurador } from '@rikuy/campus';
import { useMemo, useState } from 'react';
import { clienteTutorPorDefecto, vozRikuy } from '../tutor/nube.ts';

const RESPUESTA_REGLAS = 'Buena pregunta. Miren la placa de la exhibición y compárenla con lo que ven. ¿Qué detalle les llama la atención?';

export function CuradorPanel({ salaId, abierta, alResponder, alCerrar }: { salaId: string; abierta: boolean; alResponder: () => void; alCerrar: () => void }) {
  const pregunta = preguntaDeSala(salaId);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const nube = useMemo(() => clienteTutorPorDefecto(), []);
  const [libre, setLibre] = useState('');
  const [dicho, setDicho] = useState<{ texto: string; vivo: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  if (!pregunta) return null;

  async function preguntarLibre() {
    const mensaje = libre.trim();
    if (!mensaje || ocupado || !pregunta) return;
    setOcupado(true);
    const r = nube
      ? await nube.turno({ mensaje, modo: 'curador', sala: { nombre: salaId, descripcion: [pregunta.pregunta, ...pregunta.opciones.map((o) => o.texto)].join(' | ').slice(0, 800) } }, 6000)
      : null;
    const salida = r?.ok ? { texto: r.valor.texto, vivo: true } : { texto: RESPUESTA_REGLAS, vivo: false };
    setDicho(salida);
    if (nube) void vozRikuy().hablar(salida.texto);
    setOcupado(false);
  }

  return (
    <section className="rk-panel" aria-labelledby="titulo-curador" style={{ borderColor: 'var(--m-sol)' }}>
      <h2 id="titulo-curador">La curadora de la sala pregunta</h2>
      <p style={{ margin: 0 }}>{pregunta.pregunta}</p>
      <div className="rk-fila" role="group" aria-label="Respuestas">
        {pregunta.opciones.map((o, i) => (
          <button
            key={o.texto}
            type="button"
            className="rk-btn"
            onClick={() => {
              const r = responderCurador(salaId, i);
              if (!r) return;
              setRespuesta(r.mensaje);
              alResponder();
            }}
          >
            {o.texto}
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" style={{ margin: 0 }}>
        {respuesta ? `${respuesta} La reja de la galería ya está abierta.` : abierta ? 'La reja de la galería ya está abierta.' : ''}
      </p>
      {nube ? (
        <form
          className="rk-fila"
          onSubmit={(e) => {
            e.preventDefault();
            void preguntarLibre();
          }}
        >
          <label className="sr-only" htmlFor="curador-libre">
            Pregúntale algo a la curadora
          </label>
          <input id="curador-libre" className="rk-btn" value={libre} onChange={(e) => setLibre(e.target.value)} placeholder="Pregúntale algo a la curadora" autoComplete="off" />
          <button type="submit" className="rk-btn" disabled={ocupado || !libre.trim()}>
            Preguntar
          </button>
        </form>
      ) : null}
      {dicho ? (
        <p aria-live="polite" style={{ margin: 0 }}>
          {dicho.texto} <small>({dicho.vivo ? 'IA en vivo' : 'Sin red: modo reglas'})</small>
        </p>
      ) : null}
      <button type="button" className="rk-btn" onClick={alCerrar}>
        Seguir recorriendo
      </button>
    </section>
  );
}

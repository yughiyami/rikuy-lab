/**
 * A scanned real object in the hologram (single phone): turn it with gestures or the finger, tap its parts,
 * let Rikuy narrate it and ask the Socratic question, or send it to the projector. Works offline once saved.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ViewerChannel, VisorExhibicion, type ViewerAction } from '@rikuy/holo';
import { BotonesTactiles, CamaraActiva, EstadoCamara } from '../componentes.tsx';
import { DiscreteGate } from '../sala/room.ts';
import { useGestosMano } from '../useGestosMano.ts';
import { useObjetoHolograma } from './useObjetoHolograma.ts';

function hablar(texto: string): void {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-PE';
    s.speak(u);
  } catch {
    /* no voice on this device: the text is on screen */
  }
}

export function PaginaObjeto() {
  const id = useParams().id ?? null;
  const carga = useObjetoHolograma(id);
  const canal = useMemo(() => new ViewerChannel(), []);
  const gate = useRef(new DiscreteGate());
  const [parte, setParte] = useState<number | null>(null);
  const enviar = useCallback(
    (a: ViewerAction) => {
      if (!gate.current.allow(a, performance.now())) return;
      canal.send(a);
    },
    [canal],
  );
  const gestos = useGestosMano(enviar);
  const encendida = gestos.status === 'active' || gestos.status === 'slow' || gestos.status === 'loading';

  if (carga.estado === 'cargando') return <main className="mx-auto max-w-md p-4">Cargando el objeto…</main>;
  if (carga.estado === 'no_existe')
    return (
      <main className="mx-auto flex max-w-md flex-col gap-3 p-4">
        <p role="alert">Este objeto no está guardado en este celular.</p>
        <Link to="/holo/escanear" className="underline">
          Escanear un objeto
        </Link>
      </main>
    );
  const { objeto: o, heroeUrl } = carga;
  const ident = o.identificacion;
  const elegida = parte === null ? null : ident.partes[parte];
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-4 text-[#0D2B33]">
      <header className="flex items-center justify-between gap-2">
        <Link to="/holo" className="grid h-12 place-items-center underline">
          ‹ Volver
        </Link>
        {encendida && <CamaraActiva onApagar={gestos.stop} />}
      </header>
      <VisorExhibicion escena="objeto" modo="pantalla" canal={canal} etiqueta={`${ident.nombre}: vista 360° a partir del video`} />
      <p className="text-xs text-[#4D6368]" data-testid="motor-objeto">
        Vista 360° a partir del video (no es un modelo 3D reconstruido) · {o.motor.segmentacion === 'sam-3.1' ? 'fondo quitado con SAM 3.1 de Meta' : 'recorte simple'} · identificado con Gemini
      </p>
      <section aria-label="Partes" className="flex flex-col gap-2 rounded-2xl border-2 border-[#D3D9CC] bg-white p-3">
        <h1 className="text-2xl font-extrabold">{ident.nombre}</h1>
        <p className="text-sm">{ident.descripcion}</p>
        <div className="relative overflow-hidden rounded-xl bg-black">
          <img src={heroeUrl} alt={`Foto de ${ident.nombre} con sus partes marcadas`} className="block w-full" />
          {ident.partes.map((p, i) => (
            <button
              key={p.nombre}
              type="button"
              aria-label={p.nombre}
              aria-pressed={parte === i}
              onClick={() => setParte(i)}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              className={`absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-sm font-bold ${parte === i ? 'bg-[#FFC14D] text-black' : 'bg-[#075E6C] text-white'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <ol className="flex flex-wrap gap-2 text-sm">
          {ident.partes.map((p, i) => (
            <li key={p.nombre}>
              <button type="button" onClick={() => setParte(i)} className={`min-h-10 rounded-lg border-2 px-2 ${parte === i ? 'border-[#04474F] bg-[#075E6C] text-white' : 'border-[#6A7568] bg-white'}`}>
                {i + 1}. {p.nombre}
              </button>
            </li>
          ))}
        </ol>
        {elegida && (
          <p aria-live="polite" className="rounded-lg bg-[#E9ECE4] p-2 text-sm">
            <b>{elegida.nombre}:</b> {elegida.funcion}
          </p>
        )}
      </section>
      <section aria-label="Rikuy" className="flex flex-col gap-2 rounded-2xl border-2 border-[#D3D9CC] bg-white p-3">
        <p className="text-sm">{ident.narracion}</p>
        <p className="font-bold">🤔 {ident.pregunta}</p>
        <button type="button" onClick={() => hablar(`${ident.narracion} ${ident.pregunta}`)} className="h-12 rounded-xl border-2 border-[#075E6C] font-bold text-[#075E6C]">
          🔊 Rikuy lo explica
        </button>
        {o.competencia && (
          <p className="text-xs text-[#4D6368]">
            CNEB · {o.competencia.nombre} <span className="font-mono">({o.competencia.id})</span>
          </p>
        )}
      </section>
      <Link to={`/holo/proyector?objeto=${encodeURIComponent(o.id)}`} className="grid h-14 place-items-center rounded-xl bg-[#075E6C] text-lg font-bold text-white">
        Proyectar en la pirámide
      </Link>
      {!encendida && gestos.status !== 'blocked' && (
        <button type="button" onClick={() => void gestos.start()} className="h-14 rounded-xl border-2 border-[#075E6C] text-lg font-bold text-[#075E6C]">
          ✋ Activar cámara de manos
        </button>
      )}
      <EstadoCamara status={gestos.status} pose={gestos.pose} escena="objeto" />
      <BotonesTactiles enviar={enviar} escena="objeto" />
    </main>
  );
}

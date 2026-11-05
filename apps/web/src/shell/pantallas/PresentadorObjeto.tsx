/**
 * Presenter tab (`#/presentador/objeto`, desktop): the last scanned object full screen in the hologram
 * viewer (SAM 3D mesh when it has one; the demo Raspberry Pi otherwise), with Rikuy docked at the bottom:
 * push-to-talk (Web Speech es-PE, or record and transcribe in the cloud), a curator turn about the
 * object's parts, and the answer spoken with the realistic voice (Web Speech fallback) plus a caption.
 * The front camera can turn and zoom the model with hand gestures.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ViewerChannel, VisorExhibicion, type ViewerAction } from '@rikuy/holo';
import { CamaraActiva, EstadoCamara } from '../../features/holo/componentes.tsx';
import { ID_DEMO, listarObjetos } from '../../features/holo/objeto/almacen.ts';
import { useObjetoHolograma } from '../../features/holo/objeto/useObjetoHolograma.ts';
import { DiscreteGate } from '../../features/holo/sala/room.ts';
import { useGestosMano } from '../../features/holo/useGestosMano.ts';
import { VistaCamara } from '../../features/holo/VistaCamara.tsx';
import { clienteTutorPorDefecto, crearClienteTutorNube, vozRikuy } from '../../features/tutor/nube.ts';

type Reconocedor = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror?: () => void;
  start: () => void;
  stop: () => void;
};

function crearReconocedor(): Reconocedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconocedor; webkitSpeechRecognition?: new () => Reconocedor };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

interface Turno {
  autor: 'alumno' | 'tutor';
  texto: string;
}

export function PresentadorObjeto() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    void listarObjetos()
      .then((l) => setId(l[0]?.id ?? ID_DEMO))
      .catch(() => setId(ID_DEMO));
  }, []);
  const carga = useObjetoHolograma(id);
  const canal = useMemo(() => new ViewerChannel(), []);
  const gate = useRef(new DiscreteGate());
  const enviarAccion = useCallback(
    (a: ViewerAction) => {
      if (gate.current.allow(a, performance.now())) canal.send(a);
    },
    [canal],
  );
  const gestos = useGestosMano(enviarAccion);
  const camara = gestos.status === 'active' || gestos.status === 'slow' || gestos.status === 'loading';

  const [historial, setHistorial] = useState<Turno[]>([]);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'listo' | 'escuchando' | 'pensando'>('listo');
  const reconocedor = useRef<Reconocedor | null>(null);
  const grabador = useRef<MediaRecorder | null>(null);

  const objeto = carga.estado === 'listo' ? carga.objeto : null;

  const preguntar = async (pregunta: string) => {
    const q = pregunta.trim();
    if (!q || !objeto) return;
    setEstado('pensando');
    const ident = objeto.identificacion;
    const partes = ident.partes.map((p) => `${p.nombre}: ${p.funcion}`).join('; ');
    const c = clienteTutorPorDefecto() ?? crearClienteTutorNube();
    const r = await c.turno(
      {
        mensaje: q.slice(0, 600),
        modo: 'curador',
        historial: historial.slice(-8).map((h) => ({ autor: h.autor, texto: h.texto.slice(0, 600) })),
        sala: { nombre: ident.nombre.slice(0, 80), descripcion: `${ident.descripcion} Partes: ${partes}`.slice(0, 800) },
      },
      9000,
    );
    const respuesta = r.ok ? r.valor.texto : `${ident.narracion} ${ident.pregunta}`;
    setHistorial((h) => [...h, { autor: 'alumno' as const, texto: q }, { autor: 'tutor' as const, texto: respuesta }].slice(-8));
    setEstado('listo');
    void vozRikuy().hablar(respuesta).catch(() => undefined);
  };

  const empezar = async () => {
    if (estado !== 'listo') return;
    const r = crearReconocedor();
    if (r) {
      reconocedor.current = r;
      r.lang = 'es-PE';
      r.interimResults = false;
      let oido = '';
      r.onresult = (e) => (oido = `${oido} ${e.results[0]?.[0]?.transcript ?? ''}`.trim());
      r.onerror = () => setEstado('listo');
      r.onend = () => {
        reconocedor.current = null;
        setEstado('listo');
        if (oido) void preguntar(oido);
      };
      setEstado('escuchando');
      r.start();
      return;
    }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(flujo);
      const trozos: Blob[] = [];
      rec.ondataavailable = (e) => trozos.push(e.data);
      rec.onstop = async () => {
        flujo.getTracks().forEach((t) => t.stop());
        grabador.current = null;
        setEstado('pensando');
        const c = clienteTutorPorDefecto() ?? crearClienteTutorNube();
        const t = await c.transcribir(new Blob(trozos, { type: rec.mimeType || 'audio/webm' }));
        setEstado('listo');
        if (t) void preguntar(t);
      };
      grabador.current = rec;
      setEstado('escuchando');
      rec.start();
    } catch {
      setEstado('listo');
    }
  };

  const soltar = () => {
    reconocedor.current?.stop();
    if (grabador.current?.state === 'recording') grabador.current.stop();
  };

  const escrito = (e: FormEvent) => {
    e.preventDefault();
    const q = texto;
    setTexto('');
    void preguntar(q);
  };

  const ultima = [...historial].reverse().find((h) => h.autor === 'tutor');

  return (
    <main className="fixed inset-0 flex flex-col bg-black text-white">
      <VistaCamara gestos={gestos} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {carga.estado === 'listo' ? (
          <VisorExhibicion escena="objeto" modo="pantalla" canal={canal} sinMarco etiqueta={`${carga.objeto.identificacion.nombre} en holograma`} />
        ) : (
          <p role="status" className="p-8 text-2xl text-[#5FE3FF]">
            {carga.estado === 'cargando' ? 'Cargando el último objeto escaneado…' : 'No hay objeto escaneado.'}
          </p>
        )}
        {objeto && (
          <h1 className="absolute left-6 top-4 m-0 text-4xl font-extrabold text-[#5FE3FF]" style={{ textShadow: '0 0 12px #5FE3FF88' }}>
            {objeto.identificacion.nombre}
          </h1>
        )}
        <div className="absolute right-4 top-4 z-20 flex flex-col items-end gap-2">
          {camara ? (
            <CamaraActiva onApagar={gestos.stop} />
          ) : (
            gestos.status !== 'blocked' && (
              <button type="button" onClick={() => void gestos.start()} className="h-12 rounded-xl border-2 border-[#5FE3FF] bg-black/60 px-4 font-bold text-[#5FE3FF]">
                ✋ Control con gestos
              </button>
            )
          )}
          <div className="max-w-xs text-sm">
            <EstadoCamara status={gestos.status} pose={gestos.pose} escena="objeto" />
          </div>
        </div>
      </div>

      <section aria-label="Rikuy" className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 border-t-2 border-[#5FE3FF55] bg-[#0D2B33]/95 p-4">
        <p aria-live="polite" className="m-0 min-h-[3.5rem] text-2xl" data-testid="subtitulo-rikuy">
          🦙 {estado === 'pensando' ? 'Rikuy está pensando…' : (ultima?.texto ?? (objeto ? `${objeto.identificacion.narracion} ${objeto.identificacion.pregunta}` : 'Hola, soy Rikuy.'))}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onPointerDown={() => void empezar()}
            onPointerUp={soltar}
            onPointerLeave={soltar}
            disabled={!objeto || estado === 'pensando'}
            className="h-14 select-none rounded-xl px-6 text-xl font-bold"
            style={{ background: estado === 'escuchando' ? '#C2462E' : '#5FE3FF', color: '#0D2B33' }}
          >
            {estado === 'escuchando' ? '🎙️ Escuchando… suelta para preguntar' : '🎤 Mantén para hablar'}
          </button>
          <form onSubmit={escrito} className="flex min-w-[16rem] flex-1 gap-2">
            <label htmlFor="pregunta-presentador" className="sr-only">
              Pregunta a Rikuy
            </label>
            <input
              id="pregunta-presentador"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="O escribe una pregunta sobre el objeto…"
              className="h-14 flex-1 rounded-xl bg-white px-3 text-lg text-[#0D2B33]"
            />
            <button type="submit" disabled={!texto.trim() || !objeto || estado === 'pensando'} className="h-14 rounded-xl border-2 border-[#5FE3FF] px-4 font-bold">
              Preguntar
            </button>
          </form>
          {ultima && (
            <button type="button" onClick={() => void vozRikuy().hablar(ultima.texto).catch(() => undefined)} className="h-14 rounded-xl border-2 border-white/40 px-4">
              🔊 Repetir
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

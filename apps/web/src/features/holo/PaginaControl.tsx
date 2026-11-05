/**
 * CONTROL phone of the group (golden path of the pitch): its front camera reads hand gestures and
 * drives the projector under the pyramid. Every gesture or button becomes a BusMessage; the
 * projector acknowledges it and this phone shows "El proyector hizo: …" with the round trip.
 * If the camera fails, is slow or the teacher turns it off, touch and voice do the same.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { DisplayState } from '@rikuy/contracts';
import { ControlesDigestivo } from './digestivo/ControlesDigestivo.tsx';
import { GuiaRikuy } from './digestivo/GuiaRikuy.tsx';
import { actionLabel, actionToMessage, type ViewerAction } from '@rikuy/holo';
import { listenOnce, recognitionSupported } from '../../platform/voz/speech.ts';
import { parseVoiceCommand } from '../../platform/voz/parse.ts';
import { BotonesTactiles, CamaraActiva, ControlesPendulo, EstadoCamara, GestoReconocido, GuiaGestos, PadTactil } from './componentes.tsx';
import { ACK_PREFIX, ActionCoalescer, ConfirmationTracker, DiscreteGate, normalizeRoomCode, type Confirmation } from './sala/room.ts';
import { RoomChannel } from './sala/RoomChannel.ts';
import { useGestosMano, type GestosMano } from './useGestosMano.ts';
import { VistaCamara } from './VistaCamara.tsx';

export interface PaginaControlProps {
  crearCanal?: (sala: string, rol: 'control') => RoomChannel;
  usarGestos?: (onAction: (a: ViewerAction) => void) => GestosMano;
}

const defaultCanal = (sala: string) => new RoomChannel(sala, 'control');

export function PaginaControl({ crearCanal = defaultCanal, usarGestos = useGestosMano }: PaginaControlProps) {
  const sala = normalizeRoomCode(useParams().sala ?? '') ?? '';
  const escenaPedida = useSearchParams()[0].get('escena');
  const [conectado, setConectado] = useState(false);
  const [enLinea, setEnLinea] = useState(false);
  const [confirmacion, setConfirmacion] = useState<Confirmation | null>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [voz, setVoz] = useState<string | null>(null);
  const tracker = useRef(new ConfirmationTracker());
  const coalescer = useRef<ActionCoalescer | null>(null);
  const gate = useRef(new DiscreteGate());
  const [disparo, setDisparo] = useState<{ texto: string; n: number } | null>(null);
  const [longitud, setLongitud] = useState(0.5);
  const [amortiguacion, setAmortiguacion] = useState(false);
  const [escena, setEscena] = useState(() => (escenaPedida === 'digestivo' ? 'digestivo' : 'pendulo'));
  const [remoto, setRemoto] = useState<DisplayState | null>(null);

  useEffect(() => {
    if (!sala) return;
    const c = crearCanal(sala, 'control');
    // Continuous gestures are merged once per frame: low latency without flooding the relay.
    const merge = new ActionCoalescer((a) => {
      tracker.current.sent(a, performance.now());
      c.send(actionToMessage(a, 'control'));
    });
    coalescer.current = merge;
    let raf = requestAnimationFrame(function loop() {
      merge.flush();
      raf = requestAnimationFrame(loop);
    });
    c.onStatus = (s) => setEnLinea(s === 'online');
    const off = c.on((m) => {
      if (m.type === 'hello' && m.role === 'display') setConectado(true);
      if (m.type === 'peers') setConectado(m.roles.includes('display'));
      if (m.type === 'state') {
        setConectado(true);
        setRemoto(m.state);
        if (m.state.scene === 'digestivo' || m.state.scene === 'pendulo') setEscena(m.state.scene);
      }
      if (m.type === 'say' && m.text.startsWith(ACK_PREFIX)) {
        setConectado(true);
        const ok = tracker.current.confirm(m.text.slice(ACK_PREFIX.length), performance.now());
        if (ok) setConfirmacion(ok);
      }
    });
    c.hello();
    return () => {
      cancelAnimationFrame(raf);
      coalescer.current = null;
      off();
      c.close();
    };
  }, [sala, crearCanal]);

  const enviar = useCallback(
    (a: ViewerAction) => {
      if (!gate.current.allow(a, performance.now())) return;
      setUltimo(actionLabel(a));
      if (a.type === 'variable' && a.variable === 'longitud') setLongitud(a.value);
      if (a.type === 'variable' && a.variable === 'amortiguacion') setAmortiguacion(a.value >= 0.5);
      coalescer.current?.push(a);
    },
    [],
  );

  // Orders fired by a hand gesture are also announced big on this phone.
  const desdeGesto = useCallback(
    (a: ViewerAction) => {
      if (a.type !== 'rotate' && a.type !== 'zoom') setDisparo((d) => ({ texto: actionLabel(a), n: (d?.n ?? 0) + 1 }));
      enviar(a);
    },
    [enviar],
  );

  const gestos = usarGestos(desdeGesto);
  const camaraEncendida = gestos.status === 'active' || gestos.status === 'slow' || gestos.status === 'loading';

  async function hablar() {
    setVoz('Escuchando…');
    const texto = await listenOnce().result;
    const accion = texto ? parseVoiceCommand(texto) : null;
    if (accion) enviar(accion);
    setVoz(texto ? (accion ? `“${texto}”` : `No entendí “${texto}”. Prueba: gira, acerca, pausa, suelta.`) : 'No te escuché. Usa los botones.');
  }

  if (!sala) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p role="alert">Ese código de sala no es válido.</p>
        <Link to="/holo/unirse" className="text-[#075E6C] underline">Escribir otro código</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 bg-[#F5F6F1] p-4 text-[#0D2B33]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[19px] font-extrabold">Control del holograma</h1>
          <p className="text-sm text-[#33494F]">
            Sala <b className="tracking-widest">{sala.toUpperCase()}</b> ·{' '}
            <span className={conectado ? 'text-[#14592D]' : 'text-[#96102F]'}>{conectado ? '● Proyector conectado' : '○ Buscando el proyector…'}</span>
            {!enLinea && <span className="text-[#4D6368]"> · sin servidor del aula</span>}
          </p>
        </div>
        {camaraEncendida && <CamaraActiva onApagar={gestos.stop} />}
      </header>
      <VistaCamara gestos={gestos} />

      <output aria-live="polite" className="flex min-h-12 items-center rounded-xl border-2 border-[#14592D] bg-[#E3F2E6] px-3 font-semibold text-[#14592D]">
        {confirmacion ? `✓ El proyector hizo: ${confirmacion.label} · ${confirmacion.latencyMs} ms` : ultimo ? `Enviado: ${ultimo}` : 'Aún no envías órdenes.'}
      </output>

      {!camaraEncendida && gestos.status !== 'blocked' && (
        <button type="button" onClick={() => void gestos.start()} className="h-14 rounded-xl border-2 border-[#04474F] bg-[#075E6C] text-lg font-bold text-white">
          ✋ Activar cámara de manos
        </button>
      )}
      {(gestos.status === 'active' || gestos.status === 'slow') && <GestoReconocido pose={gestos.pose} escena={escena} disparo={disparo} />}
      <EstadoCamara status={gestos.status} pose={gestos.pose} escena={escena} />
      {gestos.status === 'active' && <GuiaGestos escena={escena} />}

      <div role="group" aria-label="Escena del holograma" className="grid grid-cols-2 gap-2">
        {(['pendulo', 'digestivo'] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={escena === id}
            onClick={() => {
              setEscena(id);
              enviar({ type: 'scene', scene: id });
            }}
            className={`h-12 rounded-xl border-2 font-semibold ${escena === id ? 'border-[#04474F] bg-[#075E6C] text-white' : 'border-[#6A7568] bg-white'}`}
          >
            {id === 'pendulo' ? 'Péndulo' : 'Sistema digestivo'}
          </button>
        ))}
      </div>
      <BotonesTactiles enviar={enviar} escena={escena} />
      {escena === 'pendulo' && <ControlesPendulo enviar={enviar} longitud={longitud} amortiguacion={amortiguacion} />}
      {escena === 'digestivo' && (
        <>
          <ControlesDigestivo enviar={enviar} nivel={remoto?.variables.nivel ?? 0} conLactasa={(remoto?.variables.lactasa ?? 1) >= 0.5} velocidad={remoto?.variables.velocidad ?? 1} />
          <GuiaRikuy nivel={remoto?.variables.nivel ?? 0} enviar={enviar} />
        </>
      )}
      <PadTactil enviar={enviar} />

      {recognitionSupported() && (
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => void hablar()} className="h-12 rounded-xl border-2 border-[#6A7568] bg-white font-semibold">
            🎙 Decir una orden
          </button>
          <p className="text-xs text-[#4D6368]">La voz del navegador puede usar internet. {voz}</p>
        </div>
      )}
    </main>
  );
}

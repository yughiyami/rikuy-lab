/**
 * PROYECTOR phone, under the pyramid (or the 45° box). Absolute black, the hologram in a cross of
 * four views, no text near the center (DESIGN 7.5). Before a control joins it shows the room code
 * and a QR; afterwards only short amber labels at the edge confirm each order received.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { isSceneId } from '@rikuy/core';
import { actionLabel, messageToActions, ViewerChannel, VisorExhibicion, type ModoVisor } from '@rikuy/holo';
import { QrSvg } from './componentes.tsx';
import { CHROME_IDLE_MS, proyectarPantallaCompleta, type WakeLockNav } from './sala/proyeccion.ts';
import { ACK_PREFIX, controlUrl, newRoomCode, normalizeRoomCode } from './sala/room.ts';
import { RoomChannel } from './sala/RoomChannel.ts';

export interface PaginaProyectorProps {
  crearCanal?: (sala: string, rol: 'display') => RoomChannel;
}

const defaultCanal = (sala: string) => new RoomChannel(sala, 'display');
const ACK_THROTTLE_MS = 200;
export function PaginaProyector({ crearCanal = defaultCanal }: PaginaProyectorProps) {
  const params = useParams();
  const navigate = useNavigate();
  const sala = normalizeRoomCode(params.sala ?? '');
  // `?escena=digestivo` opens the projector on another registered scene (the control can change it later).
  const [busqueda] = useSearchParams();
  const { search } = useLocation();
  const pedida = busqueda.get('escena') ?? '';
  const escenaInicial = isSceneId(pedida) ? pedida : 'pendulo';
  const nivelPedido = busqueda.get('nivel');
  const variablesIniciales = useMemo(() => (nivelPedido && /^[0-3]$/.test(nivelPedido) ? { nivel: Number(nivelPedido) } : undefined), [nivelPedido]);
  const canalVisor = useMemo(() => new ViewerChannel(), []);
  const [modo, setModo] = useState<Extract<ModoVisor, 'piramide' | 'cajita'>>('piramide');
  const [espejo, setEspejo] = useState(false);
  const [unido, setUnido] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [guias, setGuias] = useState(false);
  const [tamano, setTamano] = useState(1);
  const [chrome, setChrome] = useState(true);
  const lastAck = useRef<Record<string, number>>({});
  const canalSala = useRef<RoomChannel | null>(null);

  useEffect(() => {
    if (!sala) navigate(`/holo/proyector/${newRoomCode()}${search}`, { replace: true });
  }, [sala, navigate, search]);

  useEffect(() => {
    if (!sala) return;
    const canal = crearCanal(sala, 'display');
    canalSala.current = canal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = canal.on((m) => {
      if (m.type === 'hello' && m.role === 'control') {
        setUnido(true);
        canal.hello(); // let a late control know the projector is here
        return;
      }
      if (m.type === 'peers' && m.roles.includes('control')) setUnido(true);
      for (const a of messageToActions(m, 'display')) {
        setUnido(true);
        canalVisor.send(a);
        const label = actionLabel(a);
        const now = performance.now();
        if (now - (lastAck.current[label] ?? -Infinity) >= ACK_THROTTLE_MS || (a.type !== 'rotate' && a.type !== 'zoom')) {
          lastAck.current[label] = now;
          canal.send({ type: 'say', speaker: 'agente', text: ACK_PREFIX + label });
        }
        setEtiqueta(label);
        clearTimeout(timer);
        timer = setTimeout(() => setEtiqueta(null), 1200);
      }
    });
    canal.hello();
    return () => {
      clearTimeout(timer);
      off();
      canalSala.current = null;
      canal.close();
    };
  }, [sala, crearCanal, canalVisor]);

  useEffect(() => {
    // Keep the screen on while projecting; the lock is lost when the tab hides, so take it again.
    const nav = navigator as WakeLockNav;
    let lock: { release(): Promise<void> } | undefined;
    const pedir = () => {
      if (document.visibilityState === 'visible') nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      document.removeEventListener('visibilitychange', pedir);
      void lock?.release().catch(() => {});
    };
  }, []);

  // While projecting, the settings button hides after a few seconds; any touch brings it back.
  useEffect(() => {
    if (!unido || ajustes) return;
    let t = setTimeout(() => setChrome(false), CHROME_IDLE_MS);
    const despertar = () => {
      setChrome(true);
      clearTimeout(t);
      t = setTimeout(() => setChrome(false), CHROME_IDLE_MS);
    };
    window.addEventListener('pointerdown', despertar);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', despertar);
    };
  }, [unido, ajustes]);

  const proyectar = useCallback(() => {
    setUnido(true);
    void proyectarPantallaCompleta();
  }, []);

  if (!sala) return null;
  const enlace = controlUrl(sala, location.href);

  return (
    <main data-theme="holo" className="fixed inset-0 overflow-hidden bg-black text-[#5FE3FF]">
      <VisorExhibicion escena={escenaInicial} variables={variablesIniciales} onEstado={(state) => canalSala.current?.send({ type: 'state', state })} modo={modo} espejo={espejo} guias={guias} tamanoVista={tamano / 3} sinMarco canal={canalVisor} etiqueta="Holograma para la pirámide" />

      {etiqueta && (
        <p aria-live="polite" className="absolute left-3 top-3 rounded-lg border-2 border-[#FFC14D] px-3 py-1 text-lg font-bold text-[#FFC14D]">
          {etiqueta}
        </p>
      )}

      {!unido && (
        <section aria-label="Unir el celular de control" className="absolute inset-x-4 bottom-4 mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border-2 border-[#5FE3FF] bg-black p-4 text-center">
          <p className="text-lg font-bold">Abre el control en otro celular</p>
          <p className="text-sm text-[#BFE9F5]">Código de sala</p>
          <p className="text-5xl font-extrabold tracking-[0.3em] text-[#FFC14D]">{sala.toUpperCase()}</p>
          <QrSvg texto={enlace} etiqueta={`QR para unirse a la sala ${sala.toUpperCase()}`} tam={176} />
          <button type="button" onClick={proyectar} className="h-14 w-full rounded-xl bg-[#19CBEE] text-lg font-extrabold text-black">
            ⛶ Proyectar en pantalla completa
          </button>
          <button type="button" onClick={() => setUnido(true)} className="h-10 w-full rounded-xl text-sm text-[#BFE9F5] underline">
            Ocultar sin pantalla completa
          </button>
        </section>
      )}

      <button
        type="button"
        aria-label="Ajustes del proyector"
        onClick={() => setAjustes((v) => !v)}
        className={`absolute bottom-2 right-2 grid h-12 w-12 place-items-center rounded-full border-2 border-[#2A7587] text-xl transition-opacity duration-700 ${chrome || !unido || ajustes ? 'opacity-100' : 'opacity-0'}`}
      >
        ⚙
      </button>
      {ajustes && (
        <section aria-label="Ajustes del proyector" className="absolute bottom-16 right-2 flex w-64 flex-col gap-2 rounded-2xl border-2 border-[#5FE3FF] bg-black p-3">
          <p className="font-bold">Tipo de proyector</p>
          <div className="grid grid-cols-2 gap-2">
            {(['piramide', 'cajita'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)} className={`h-12 rounded-xl border-2 ${modo === m ? 'border-[#FFC14D] text-[#FFC14D]' : 'border-[#2A7587]'}`}>
                {m === 'piramide' ? 'Pirámide' : 'Cajita'}
              </button>
            ))}
          </div>
          <button type="button" aria-pressed={espejo} onClick={() => setEspejo((v) => !v)} className="h-12 rounded-xl border-2 border-[#2A7587]">
            ⇋ Espejo {espejo ? '(activo)' : ''}
          </button>
          <p className="mt-1 font-bold">Calibrar con la pirámide</p>
          <button type="button" role="switch" aria-checked={guias} onClick={() => setGuias((v) => !v)} className={`h-12 rounded-xl border-2 ${guias ? 'border-[#FFC14D] text-[#FFC14D]' : 'border-[#2A7587]'}`}>
            ✛ Cruz central {guias ? '(visible)' : ''}
          </button>
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Tamaño de las vistas: <b>{Math.round(tamano * 100)} %</b>
            </span>
            <input type="range" min={0.6} max={1} step={0.02} value={tamano} onChange={(e) => setTamano(Number(e.target.value))} className="h-8 accent-[#19CBEE]" />
          </label>
          <p className="text-xs text-[#BFE9F5]">Centra la punta de la pirámide en la cruz y ajusta hasta que cada vista llene su cara.</p>
          <button type="button" onClick={() => void proyectarPantallaCompleta()} className="h-12 rounded-xl border-2 border-[#2A7587]">
            ⛶ Pantalla completa
          </button>
          <button type="button" onClick={() => setUnido(false)} className="h-12 rounded-xl border-2 border-[#2A7587]">
            Mostrar código y QR
          </button>
        </section>
      )}
    </main>
  );
}

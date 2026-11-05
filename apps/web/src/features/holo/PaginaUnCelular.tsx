/** Single-phone mode (secondary): the hologram on screen, driven by this phone's hand gestures or touch. */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import type { DisplayState } from '@rikuy/contracts';
import { actionLabel, ViewerChannel, VisorExhibicion, type ViewerAction } from '@rikuy/holo';
import { practicaDeEscena } from '../mundo/catalogo.ts';
import { BotonesTactiles, CamaraActiva, ControlesPendulo, EstadoCamara, GestoReconocido, GuiaGestos } from './componentes.tsx';
import { ControlesDigestivo } from './digestivo/ControlesDigestivo.tsx';
import { GuiaRikuy } from './digestivo/GuiaRikuy.tsx';
import { DiscreteGate } from './sala/room.ts';
import { useGestosMano } from './useGestosMano.ts';
import { VistaCamara } from './VistaCamara.tsx';

export function PaginaUnCelular() {
  const escena = useParams().escena ?? 'digestivo';
  // An exhibit of the museum comes back to the museum; the hologram hub is the default way back.
  const desdeMuseo = (useLocation().state as { volverA?: string } | null)?.volverA === '/museo';
  const canal = useMemo(() => new ViewerChannel(), []);
  const gate = useRef(new DiscreteGate());
  const [disparo, setDisparo] = useState<{ texto: string; n: number } | null>(null);
  const [longitud, setLongitud] = useState<number | undefined>();
  const [amortiguacion, setAmortiguacion] = useState(false);
  const [estado, setEstado] = useState<DisplayState | null>(null);
  // `?nivel=2` (from a plan topic) opens a scene with depth levels at that level.
  const nivelPedido = useSearchParams()[0].get('nivel');
  const variablesIniciales = useMemo(() => (nivelPedido && /^[0-3]$/.test(nivelPedido) ? { nivel: Number(nivelPedido) } : undefined), [nivelPedido]);
  const enviar = useCallback(
    (a: ViewerAction) => {
      if (!gate.current.allow(a, performance.now())) return;
      if (a.type === 'variable' && a.variable === 'longitud') setLongitud(a.value);
      if (a.type === 'variable' && a.variable === 'amortiguacion') setAmortiguacion(a.value >= 0.5);
      canal.send(a);
    },
    [canal],
  );
  const gestos = useGestosMano((a) => {
    if (a.type !== 'rotate' && a.type !== 'zoom') setDisparo((d) => ({ texto: actionLabel(a), n: (d?.n ?? 0) + 1 }));
    enviar(a);
  });
  const practica = practicaDeEscena(escena);
  const longitudInicial = practica?.variables.find((v) => v.id === 'longitud')?.porDefecto ?? 0.5;
  const encendida = gestos.status === 'active' || gestos.status === 'slow' || gestos.status === 'loading';
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <header className="flex items-center justify-between gap-2">
        <Link to={desdeMuseo ? '/museo' : '/holo'} className="grid h-12 place-items-center underline">
          {desdeMuseo ? '‹ Volver al museo' : '‹ Volver'}
        </Link>
        {encendida && <CamaraActiva onApagar={gestos.stop} />}
      </header>
      <VistaCamara gestos={gestos} />
      <VisorExhibicion escena={escena} modo="pantalla" canal={canal} practica={practica} variables={variablesIniciales} onEstado={setEstado} />
      {escena === 'digestivo' && (
        <ControlesDigestivo
          enviar={enviar}
          nivel={estado?.variables.nivel ?? variablesIniciales?.nivel ?? 0}
          conLactasa={(estado?.variables.lactasa ?? 1) >= 0.5}
          velocidad={estado?.variables.velocidad ?? 1}
        />
      )}
      {escena === 'digestivo' && <GuiaRikuy nivel={estado?.variables.nivel ?? variablesIniciales?.nivel ?? 0} enviar={enviar} />}
      {!encendida && gestos.status !== 'blocked' && (
        <button type="button" onClick={() => void gestos.start()} className="h-14 rounded-xl bg-[#075E6C] text-lg font-bold text-white">
          ✋ Controlar con la cámara
        </button>
      )}
      {(gestos.status === 'active' || gestos.status === 'slow') && <GestoReconocido pose={gestos.pose} escena={escena} disparo={disparo} />}
      <EstadoCamara status={gestos.status} pose={gestos.pose} escena={escena} />
      {gestos.status === 'active' && <GuiaGestos escena={escena} />}
      <BotonesTactiles enviar={enviar} escena={escena} />
      {escena === 'pendulo' && <ControlesPendulo enviar={enviar} longitud={longitud ?? longitudInicial} amortiguacion={amortiguacion} />}
    </main>
  );
}

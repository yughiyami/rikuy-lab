/** Scene variables of the digestive hologram: depth level, with / without lactase, speed. */
import type { ViewerAction } from '@rikuy/holo';

const NOMBRES = ['Tubo digestivo', 'Pared', 'Vellosidades', 'Lactasa'];
const VELOCIDADES = [0.5, 1, 2];

export interface ControlesDigestivoProps {
  enviar: (a: ViewerAction) => void;
  nivel: number;
  conLactasa: boolean;
  velocidad: number;
  oscuro?: boolean;
}

export function ControlesDigestivo({ enviar, nivel, conLactasa, velocidad, oscuro = false }: ControlesDigestivoProps) {
  const base = oscuro ? 'border-[#5FE3FF] text-[#5FE3FF] bg-black' : 'border-[#6A7568] text-[#0D2B33] bg-white';
  const activo = oscuro ? 'border-[#FFC14D] text-[#FFC14D] bg-black' : 'border-[#04474F] bg-[#075E6C] text-white';
  return (
    <section aria-label="Controles del sistema digestivo" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={nivel <= 0} onClick={() => enviar({ type: 'level', delta: -1 })} className={`h-14 rounded-xl border-2 text-lg font-bold disabled:opacity-40 ${base}`}>
          ‹ Volver
        </button>
        <button type="button" disabled={nivel >= 3} onClick={() => enviar({ type: 'level', delta: 1 })} className={`h-14 rounded-xl border-2 text-lg font-bold disabled:opacity-40 ${activo}`}>
          Profundizar ›
        </button>
      </div>
      <div role="group" aria-label="Nivel" className="grid grid-cols-4 gap-1">
        {NOMBRES.map((n, i) => (
          <button key={n} type="button" aria-pressed={nivel === i} onClick={() => enviar({ type: 'variable', variable: 'nivel', value: i })} className={`min-h-12 rounded-lg border-2 px-1 text-xs font-semibold ${nivel === i ? activo : base}`}>
            {i + 1}. {n}
          </button>
        ))}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={conLactasa}
        onClick={() => enviar({ type: 'variable', variable: 'lactasa', value: conLactasa ? 0 : 1 })}
        className={`h-14 rounded-xl border-2 text-base font-bold ${conLactasa ? base : 'border-[#F5B301] bg-[#FFF1CC] text-[#6B4300]'}`}
      >
        {conLactasa ? '🥛 Con lactasa · tocar para quitarla' : '⚠ Sin lactasa (intolerancia) · tocar para devolverla'}
      </button>
      <div role="group" aria-label="Velocidad" className="grid grid-cols-3 gap-2">
        {VELOCIDADES.map((v) => (
          <button key={v} type="button" aria-pressed={velocidad === v} onClick={() => enviar({ type: 'variable', variable: 'velocidad', value: v })} className={`h-12 rounded-xl border-2 text-sm font-semibold ${velocidad === v ? activo : base}`}>
            {v === 0.5 ? 'Lento' : v === 1 ? 'Normal' : 'Rápido'}
          </button>
        ))}
      </div>
    </section>
  );
}

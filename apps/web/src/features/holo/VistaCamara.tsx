/**
 * Picture-in-picture camera preview for hand gestures: the same MediaStream the detector uses
 * (no second camera), mirrored, with the 21 hand landmarks drawn on top, a detection chip,
 * the recognized gesture and the detector fps. Everything stays on the device.
 */
import { useEffect, useRef, useState } from 'react';
import type { GestosMano, Puntos } from './useGestosMano.ts';

const CIAN = '#19CBEE';
const CONEXIONES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const NOMBRES: Record<string, string> = {
  palm: '✋ Mano abierta',
  fist: '✊ Puño',
  pinch: '🤏 Pellizco',
  thumbs_up: '👍 Pulgar arriba',
};

export function VistaCamara({ gestos, grande = false }: { gestos: GestosMano; grande?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [mano, setMano] = useState(false);
  const [fps, setFps] = useState(0);
  const [oculta, setOculta] = useState(false);
  const activa = gestos.status === 'active' || gestos.status === 'slow' || gestos.status === 'loading';
  const stream = gestos.stream ?? null;

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    if (stream) void v.play().catch(() => {});
  }, [stream, oculta]);

  useEffect(() => {
    if (!gestos.subscribeLandmarks) return;
    const marcas: number[] = [];
    let hayMano = false;
    let ultimoFps = 0;
    return gestos.subscribeLandmarks((l: Puntos | null) => {
      const t = performance.now();
      marcas.push(t);
      while (marcas.length && t - marcas[0] > 1000) marcas.shift();
      if (marcas.length !== ultimoFps) {
        ultimoFps = marcas.length;
        setFps(marcas.length);
      }
      const ahora = !!l && l.length >= 21;
      if (ahora !== hayMano) {
        hayMano = ahora;
        setMano(ahora);
      }
      const c = lienzo.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      if (!l || !ahora) return;
      // Mirrored like the video.
      const px = (i: number) => [(1 - l[i].x) * w, l[i].y * h] as const;
      ctx.strokeStyle = CIAN;
      ctx.lineWidth = grande ? 4 : 2;
      ctx.beginPath();
      for (const [a, b] of CONEXIONES) {
        const [ax, ay] = px(a);
        const [bx, by] = px(b);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      ctx.stroke();
      ctx.fillStyle = CIAN;
      for (let i = 0; i < 21; i++) {
        const [x, y] = px(i);
        ctx.beginPath();
        ctx.arc(x, y, grande ? 6 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [gestos.subscribeLandmarks, grande, oculta]);

  if (!activa) return null;
  if (oculta)
    return (
      <button
        type="button"
        onClick={() => setOculta(false)}
        className="fixed bottom-3 left-3 z-50 rounded-full bg-[#0D2B33] px-4 py-2 text-sm font-bold text-white shadow-lg"
      >
        📷 Ver cámara
      </button>
    );

  const gesto = gestos.pose ? NOMBRES[gestos.pose] ?? gestos.pose : '—';
  const caja = grande
    ? 'relative w-full max-w-4xl aspect-[4/3]'
    : 'fixed bottom-3 left-3 z-50 w-[160px] h-[120px] md:w-[240px] md:h-[180px]';
  return (
    <div className={grande ? 'flex flex-col items-center gap-3' : ''} data-testid="vista-camara">
      <div className={`${caja} overflow-hidden rounded-2xl border-2 border-[#19CBEE] bg-black shadow-2xl`}>
        <video ref={video} muted playsInline autoPlay className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <canvas ref={lienzo} className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="absolute left-1 top-1 flex flex-wrap gap-1">
          <span
            className={`rounded-full px-2 py-0.5 font-bold text-white ${grande ? 'text-lg' : 'text-[10px] md:text-xs'} ${mano ? 'bg-[#14892D]' : 'bg-[#C77700]'}`}
          >
            {mano ? 'Mano detectada ✓' : 'Buscando la mano…'}
          </span>
          <span className={`rounded-full bg-black/60 px-2 py-0.5 text-white ${grande ? 'text-base' : 'text-[10px]'}`}>{fps} fps</span>
        </div>
        <div className={`absolute inset-x-0 bottom-0 bg-black/55 text-center font-extrabold text-white ${grande ? 'py-2 text-4xl' : 'py-0.5 text-sm md:text-lg'}`}>
          {gesto}
        </div>
        {!grande && (
          <button
            type="button"
            onClick={() => setOculta(true)}
            className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-[10px] font-bold text-white md:text-xs"
          >
            Ocultar cámara
          </button>
        )}
      </div>
      {grande && (
        <button type="button" onClick={() => setOculta(true)} className="rounded-full bg-[#0D2B33] px-4 py-2 font-bold text-white">
          Ocultar cámara
        </button>
      )}
    </div>
  );
}

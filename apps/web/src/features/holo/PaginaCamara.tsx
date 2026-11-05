/** `#/camara`: quick check of the camera + hand detector + landmark preview, full screen. */
import { useGestosMano } from './useGestosMano.ts';
import { VistaCamara } from './VistaCamara.tsx';

export function PaginaCamara() {
  const gestos = useGestosMano(() => {});
  const encendida = gestos.status === 'active' || gestos.status === 'slow' || gestos.status === 'loading';
  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-[#071A1F] p-4 text-white">
      <h1 className="text-2xl font-extrabold">Prueba de cámara y mano</h1>
      {!encendida && (
        <button type="button" onClick={() => void gestos.start()} className="h-14 rounded-xl bg-[#075E6C] px-6 text-lg font-bold">
          ✋ Encender cámara
        </button>
      )}
      {encendida && (
        <button type="button" onClick={gestos.stop} className="rounded-xl border border-white/40 px-4 py-2">
          Apagar cámara
        </button>
      )}
      <p className="text-sm text-white/70">
        Estado: {gestos.status}
        {gestos.detail ? ` · ${gestos.detail}` : ''}
      </p>
      <VistaCamara gestos={gestos} grande />
    </main>
  );
}

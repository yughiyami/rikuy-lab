/**
 * "Escanear un objeto": film one slow turn around a real object (≤30 s) or take 3 to 8 photos. The phone
 * extracts the keyframes; the cloud identifies the object (Gemini) and removes the background (SAM 3.1);
 * the phone builds the 360° hologram view and keeps it offline.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ID_DEMO, guardarObjeto, listarObjetos } from './almacen.ts';
import { aBlob, aJpeg, atlasDeVistas, fotogramasDeFotos, fotogramasDeVideo, hojaDeContacto } from './captura.ts';
import { pedirObjeto3d } from './cliente.ts';
import type { ObjetoEscaneado } from './tipos.ts';

type Paso = { tipo: 'inicio' } | { tipo: 'trabajando'; texto: string } | { tipo: 'error'; texto: string };

function nuevoId(): string {
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function PaginaEscanear() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState<Paso>({ tipo: 'inicio' });
  const [pista, setPista] = useState('');
  const [guardados, setGuardados] = useState<ObjetoEscaneado[]>([]);
  useEffect(() => {
    void listarObjetos()
      .then(setGuardados)
      .catch(() => undefined);
  }, []);

  async function procesar(archivos: File[]) {
    if (archivos.length === 0) return;
    try {
      const esVideo = archivos.length === 1 && archivos[0]!.type.startsWith('video/');
      setPaso({ tipo: 'trabajando', texto: '1/4 · Sacando fotogramas del video…' });
      const fotogramas = esVideo
        ? await fotogramasDeVideo(archivos[0]!, (i, n) => setPaso({ tipo: 'trabajando', texto: `1/4 · Sacando fotogramas del video… ${i}/${n}` }))
        : await fotogramasDeFotos(archivos);
      setPaso({ tipo: 'trabajando', texto: '2/4 · Rikuy reconoce el objeto y SAM le quita el fondo…' });
      const { hoja, celdas, escala } = hojaDeContacto(fotogramas);
      const heroe = aJpeg(fotogramas[0]!);
      const r = await pedirObjeto3d({ heroe, hoja, celdas, ...(pista.trim() ? { pista: pista.trim() } : {}) });
      setPaso({ tipo: 'trabajando', texto: '3/4 · Armando la vista 360°…' });
      const { atlas, columnas, filas } = await atlasDeVistas(fotogramas, r.mascaras, escala);
      setPaso({ tipo: 'trabajando', texto: '4/4 · Guardando en este celular…' });
      const id = nuevoId();
      await guardarObjeto({
        id,
        creado: new Date().toISOString(),
        identificacion: r.identificacion,
        competencia: r.competencia,
        motor: r.motor,
        ...(r.aviso ? { aviso: r.aviso } : {}),
        heroe: await aBlob(heroe),
        atlas,
        columnas,
        filas,
        vistas: fotogramas.length,
      });
      navigate(`/holo/ver/objeto/${id}`);
    } catch (e) {
      setPaso({ tipo: 'error', texto: (e as Error).message || 'Algo falló. Intenta de nuevo.' });
    }
  }

  const tarjeta = 'flex min-h-14 flex-col justify-center gap-1 rounded-2xl border-2 border-[#D3D9CC] bg-white p-4';
  const ocupado = paso.tipo === 'trabajando';
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 bg-[#F5F6F1] p-4 text-[#0D2B33]">
      <Link to="/holo" className="underline">
        ‹ Volver
      </Link>
      <h1 className="text-3xl font-extrabold">Escanear un objeto</h1>
      <p className="text-sm text-[#33494F]">
        Filma una vuelta lenta alrededor de un objeto real (hasta 30 s), o toma de 3 a 8 fotos rodeándolo. Rikuy lo convierte en un holograma que la clase puede girar, y te cuenta sus partes.
      </p>
      <label className={`${tarjeta} cursor-pointer`}>
        <b className="text-lg">🎥 Video o fotos</b>
        <span className="text-sm text-[#33494F]">Solo salen del celular 12 fotogramas, nunca el video.</span>
        <input
          type="file"
          accept="video/*,image/*"
          multiple
          disabled={ocupado}
          data-testid="archivo-objeto"
          onChange={(e) => void procesar([...(e.target.files ?? [])])}
          className="mt-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ¿Qué es? (opcional, ayuda a reconocerlo)
        <input value={pista} onChange={(e) => setPista(e.target.value)} maxLength={80} className="h-12 rounded-xl border-2 border-[#6A7568] px-3" />
      </label>
      {paso.tipo === 'trabajando' && (
        <p role="status" className="rounded-xl bg-[#E9ECE4] p-3 font-bold">
          {paso.texto}
        </p>
      )}
      {paso.tipo === 'error' && (
        <p role="alert" className="rounded-xl bg-[#FBE3E8] p-3 text-[#96102F]">
          {paso.texto}
        </p>
      )}
      <Link to={`/holo/ver/objeto/${ID_DEMO}`} className={tarjeta}>
        <b className="text-lg">Ejemplo: Raspberry Pi 4</b>
        <span className="text-sm text-[#33494F]">Escaneado de un video real. Funciona sin internet.</span>
      </Link>
      {guardados.length > 0 && (
        <section aria-label="Objetos guardados" className="flex flex-col gap-2">
          <h2 className="font-bold">Guardados en este celular</h2>
          {guardados.map((o) => (
            <Link key={o.id} to={`/holo/ver/objeto/${o.id}`} className={tarjeta}>
              <b>{o.identificacion.nombre}</b>
              <span className="text-xs text-[#4D6368]">{new Date(o.creado).toLocaleString('es-PE')}</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

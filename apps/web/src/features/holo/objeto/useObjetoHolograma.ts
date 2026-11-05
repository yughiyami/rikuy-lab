/** Loads a scanned object from this device and hands its atlas to the `objeto` hologram scene. */
import { useEffect, useState } from 'react';
import { fijarObjetoHolograma } from '@rikuy/holo';
import { cargarObjeto } from './almacen.ts';
import type { ObjetoEscaneado } from './tipos.ts';

/** The demo object always ships its SAM 3D mesh next to its JSON; scanned objects carry it if the cloud made one. */
function modeloDe(o: ObjetoEscaneado): string | undefined {
  const raiz = `${import.meta.env.BASE_URL ?? '/'}objetos/${o.id}/`;
  if (o.modelo) return /^(https?:|blob:|data:|\/)/.test(o.modelo) ? o.modelo : raiz + o.modelo;
  return o.id === 'demo-raspberry' ? `${raiz}modelo.glb` : undefined;
}

export type EstadoCarga = { estado: 'cargando' } | { estado: 'listo'; objeto: ObjetoEscaneado; heroeUrl: string } | { estado: 'no_existe' };

export function useObjetoHolograma(id: string | null): EstadoCarga {
  const [carga, setCarga] = useState<EstadoCarga>({ estado: 'cargando' });
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    let heroeUrl: string | undefined;
    void (async () => {
      const o = await cargarObjeto(id).catch(() => undefined);
      if (!vivo) return;
      if (!o) return setCarga({ estado: 'no_existe' });
      const atlas = await createImageBitmap(o.atlas, { imageOrientation: 'flipY' }).catch(() => createImageBitmap(o.atlas));
      if (!vivo) return;
      fijarObjetoHolograma({ id: o.id, nombre: o.identificacion.nombre, atlas, columnas: o.columnas, filas: o.filas, vistas: o.vistas, aspecto: 1, ...(modeloDe(o) ? { modelo: modeloDe(o) } : {}) });
      heroeUrl = URL.createObjectURL(o.heroe);
      setCarga({ estado: 'listo', objeto: o, heroeUrl });
    })();
    return () => {
      vivo = false;
      if (heroeUrl) URL.revokeObjectURL(heroeUrl);
    };
  }, [id]);
  return id ? carga : { estado: 'no_existe' };
}

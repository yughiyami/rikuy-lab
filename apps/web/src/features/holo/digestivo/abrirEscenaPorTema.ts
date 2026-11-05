/**
 * Public hook for the plan feature (teacher document -> CNEB topics): opens the hologram scene of a
 * topic at the right depth level. Only the digestive scene is mapped for now; other scenes can add
 * their own `rutaParaTema` here.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { rutaParaTema, type DestinoTema } from './cneb.ts';

export type TemaCneb = Parameters<typeof rutaParaTema>[0];

/** Pure: the route to open for a topic, or null if no hologram covers it. */
export function destinoDeTema(tema: TemaCneb): DestinoTema | null {
  return rutaParaTema(tema);
}

/** React hook: `abrirEscenaPorTema(tema)` navigates to the scene and returns whether it could. */
export function useAbrirEscenaPorTema(): (tema: TemaCneb) => boolean {
  const navigate = useNavigate();
  return useCallback(
    (tema: TemaCneb) => {
      const d = destinoDeTema(tema);
      if (!d) return false;
      navigate(d.ruta);
      return true;
    },
    [navigate],
  );
}

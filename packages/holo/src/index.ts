/**
 * @rikuy/holo: the exhibit viewer (1.4). Owned by F3.
 *
 * This entry is light on purpose: it never imports Three.js. `<VisorExhibicion>` is a
 * `React.lazy` wrapper, so the renderer, the scenes and Three.js are downloaded only when a
 * hologram is opened. The engine itself is available at `@rikuy/holo/engine`.
 */
import { createElement, lazy, Suspense } from 'react';
import type { VisorExhibicionProps } from './visor/types.ts';

export const packageName = '@rikuy/holo' as const;

export { ViewerChannel, type ViewerListener } from './channel.ts';
export { actionLabel, actionToMessage, messageToActions, type ViewerAction } from './control/protocol.ts';

export { fijarObjetoHolograma, objetoHolograma, vistaParaAngulo, type ObjetoHolograma } from './scenes/objetoDatos.ts';
export { rendererModeFor, type ModoVisor, type VisorExhibicionProps } from './visor/types.ts';

const VisorExhibicion3D = lazy(() => import('./visor/VisorExhibicion3D.tsx'));

export function VisorExhibicion(props: VisorExhibicionProps) {
  return createElement(
    Suspense,
    {
      fallback: createElement(
        'p',
        { role: 'status', style: { background: '#000', color: '#5FE3FF', padding: 16, margin: 0, minHeight: 200 } },
        'Cargando holograma…',
      ),
    },
    createElement(VisorExhibicion3D, props),
  );
}

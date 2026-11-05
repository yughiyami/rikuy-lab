/**
 * Ports of the museum domain (2.2): render, input and realtime presence. Adapters live in
 * `campus/src/canvas` (render) and `apps/web` (presence mock now; F8 provides the hub).
 */
import type { MensajeRtCliente, MensajeRtHub } from '@rikuy/contracts';
import type { Escena } from './generador.ts';
import type { Punto } from './grilla.ts';

export interface AvatarRender {
  id: string;
  x: number;
  y: number;
  dir: number;
  /** Group colour (CSS colour). */
  color: string;
  /** Short label drawn under the avatar (group nickname or stone name). */
  etiqueta: string;
  integrantes: number;
  propio?: boolean;
  /** Customisable stone (MyLEA mascot echo): cord and frame colours. */
  cordon?: string;
  marco?: string;
  /** A help flag raised by this group. */
  pideAyuda?: boolean;
}

export interface EstadoRender {
  escena: Escena;
  camara: Punto;
  jugador: AvatarRender;
  otros: readonly AvatarRender[];
  /** Path Rikuy draws on the floor (BFS). */
  camino: readonly Punto[];
  /** Destination id highlighted by the director. */
  resaltado?: string | undefined;
  /** Destination id within reach of the group (glow and "E" prompt). */
  cercano?: string | undefined;
  /** Seconds since start, for the gentle pendulum swing (0 under reduced motion). */
  t: number;
}

export interface RenderizadorMundo {
  dibujar(estado: EstadoRender): void;
  /**
   * CSS size of the viewport; returns the view size in tiles. `zoom` (default 1) scales the tiles, so a
   * desktop stage can frame a whole hall; `encajar` snaps the pixel scale down so it never crops.
   */
  redimensionar(anchoCss: number, altoCss: number, zoom?: number, encajar?: boolean): { ancho: number; alto: number };
  destruir(): void;
}

/** Realtime presence channel (`rt` of 3.9). No chat: only the closed reaction list of the contract. */
export interface PuertoPresencia {
  enviar(mensaje: MensajeRtCliente): void;
  suscribir(alRecibir: (mensaje: MensajeRtHub) => void): () => void;
}

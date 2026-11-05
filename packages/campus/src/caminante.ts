/** Path following, camera framing and chunk visibility. Pure, so the Canvas adapter stays thin. */
import type { Punto } from './grilla.ts';

export const TAM_CHUNK = 16;

/** 0 east, 2 south, 4 west, 6 north (same 0-7 scale as the realtime `dir`). */
export function direccion(dx: number, dy: number): number {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 4;
  return dy >= 0 ? 2 : 6;
}

export function avanzar(
  pos: Punto,
  camino: readonly Punto[],
  velocidad: number,
  dt: number,
): { pos: Punto; camino: Punto[]; dir: number | undefined } {
  let resto = velocidad * dt;
  let p = { ...pos };
  const pendiente = [...camino];
  let dir: number | undefined;
  while (resto > 0 && pendiente.length) {
    const meta = pendiente[0]!;
    const dx = meta.x - p.x;
    const dy = meta.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 0) dir = direccion(dx, dy);
    if (d <= resto) {
      p = { ...meta };
      pendiente.shift();
      resto -= d;
    } else {
      p = { x: p.x + (dx / d) * resto, y: p.y + (dy / d) * resto };
      resto = 0;
    }
  }
  return { pos: p, camino: pendiente, dir };
}

interface Tam {
  ancho: number;
  alto: number;
}

/** Top-left of the camera in tiles. The map crops, it does not scale (DESIGN.md 7.4). */
export function encuadrar(jugador: Punto, mapa: Tam, vista: Tam): Punto {
  const eje = (c: number, total: number, v: number) =>
    total <= v ? (total - v) / 2 : Math.min(Math.max(c - v / 2, 0), total - v);
  return { x: eje(jugador.x, mapa.ancho, vista.ancho), y: eje(jugador.y, mapa.alto, vista.alto) };
}

export function chunksVisibles(camara: Punto, vista: Tam, mapa: Tam): [number, number][] {
  const maxCx = Math.ceil(mapa.ancho / TAM_CHUNK) - 1;
  const maxCy = Math.ceil(mapa.alto / TAM_CHUNK) - 1;
  const cx0 = Math.max(0, Math.floor(camara.x / TAM_CHUNK));
  const cy0 = Math.max(0, Math.floor(camara.y / TAM_CHUNK));
  const cx1 = Math.min(maxCx, Math.floor((camara.x + vista.ancho - 1e-9) / TAM_CHUNK));
  const cy1 = Math.min(maxCy, Math.floor((camara.y + vista.alto - 1e-9) / TAM_CHUNK));
  const out: [number, number][] = [];
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) out.push([cx, cy]);
  return out;
}

/**
 * Zoom that frames the whole map in a CSS viewport (desktop stage), clamped so small halls do not turn
 * into giant tiles and big halls stay readable. `tileCss` is the renderer's tile size at zoom 1.
 */
export function zoomQueEncuadra(mapa: Tam, vistaCss: Tam, tileCss: number, min = 1, max = 2.5): number {
  if (mapa.ancho <= 0 || mapa.alto <= 0 || vistaCss.ancho <= 0 || vistaCss.alto <= 0) return 1;
  const z = Math.min(vistaCss.ancho / (mapa.ancho * tileCss), vistaCss.alto / (mapa.alto * tileCss));
  return Math.round(Math.min(max, Math.max(min, z)) * 100) / 100;
}

/** Zoom that fills the viewport with the map (no empty bands; the camera follows the group). */
export function zoomQueCubre(mapa: Tam, vistaCss: Tam, tileCss: number, min = 1, max = 3): number {
  if (mapa.ancho <= 0 || mapa.alto <= 0 || vistaCss.ancho <= 0 || vistaCss.alto <= 0) return 1;
  const z = Math.max(vistaCss.ancho / (mapa.ancho * tileCss), vistaCss.alto / (mapa.alto * tileCss));
  return Math.round(Math.min(max, Math.max(min, z)) * 100) / 100;
}

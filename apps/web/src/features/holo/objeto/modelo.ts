/**
 * Pure geometry of the scan: when to sample keyframes, how they are tiled into the contact sheet SAM
 * segments in one call, how a packed SAM mask is unpacked, and the crop of each cut-out in the atlas.
 */
export const MAX_VIDEO_S = 30;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
export const MIN_FOTOS = 3;
export const MAX_FOTOS = 8;
export const VISTAS_VIDEO = 12;
export const MEDIANIL = 24;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Evenly spaced sample times, away from the very first and last frames (black or blurred). */
export function tiemposFotogramas(duracion: number, n = VISTAS_VIDEO): number[] {
  const d = Math.max(0, Math.min(duracion, MAX_VIDEO_S));
  return Array.from({ length: n }, (_, i) => +(d * (0.03 + (0.94 * i) / Math.max(1, n - 1))).toFixed(3));
}

/** Cells of the contact sheet: white gutters keep neighbouring views from merging into one mask. */
export function disponerHoja(n: number, celdaW: number, celdaH: number, medianil = MEDIANIL): { ancho: number; alto: number; columnas: number; celdas: Rect[] } {
  const columnas = Math.min(n, 6);
  const filas = Math.ceil(n / columnas);
  const celdas = Array.from({ length: n }, (_, i) => ({
    x: medianil + (i % columnas) * (celdaW + medianil),
    y: medianil + Math.floor(i / columnas) * (celdaH + medianil),
    w: celdaW,
    h: celdaH,
  }));
  return { ancho: medianil + columnas * (celdaW + medianil), alto: medianil + filas * (celdaH + medianil), columnas, celdas };
}

/** base64 of packed bits (MSB first, row-major) -> 0/1 raster of `ancho * alto`. */
export function desempacarBits(b64: string, ancho: number, alto: number): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(ancho * alto);
  for (let i = 0; i < out.length; i++) out[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  return out;
}

/** Atlas layout for `n` square cells. */
export function disponerAtlas(n: number): { columnas: number; filas: number } {
  const columnas = Math.ceil(Math.sqrt(n));
  return { columnas, filas: Math.ceil(n / columnas) };
}

/**
 * Square crop around the object's box (padded), so every view is centered and the object keeps a
 * steady size while the hologram turns. Without a box: the centered square of the frame.
 */
export function recorteCuadrado(caja: Rect | null, ancho: number, alto: number, margen = 0.12): Rect {
  if (!caja) {
    const lado = Math.min(ancho, alto) * 0.9;
    return { x: (ancho - lado) / 2, y: (alto - lado) / 2, w: lado, h: lado };
  }
  const lado = Math.max(caja.w, caja.h) * (1 + 2 * margen);
  return { x: caja.x + caja.w / 2 - lado / 2, y: caja.y + caja.h / 2 - lado / 2, w: lado, h: lado };
}

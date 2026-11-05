/**
 * Browser half of the scan: keyframes come out of the video with <video> + canvas (only frames leave the
 * phone, never the video), are tiled into the contact sheet for SAM, and are cut out into the atlas the
 * hologram turns through. Without a SAM mask a view keeps a soft oval vignette instead (simple cut-out).
 */
import { MAX_FOTOS, MAX_VIDEO_BYTES, MAX_VIDEO_S, MIN_FOTOS, desempacarBits, disponerAtlas, disponerHoja, recorteCuadrado, tiemposFotogramas, type Rect } from './modelo.ts';
import type { MascaraCelda } from './tipos.ts';

/** Height of a keyframe kept on the phone; the sheet tiles are half of it. */
const ALTO_FOTOGRAMA = 720;
const ESCALA_HOJA = 0.5;
const LADO_CELDA_ATLAS = 320;

export class ErrorCaptura extends Error {}

function lienzo(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

function aFotograma(fuente: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const k = Math.min(1, ALTO_FOTOGRAMA / h);
  const c = lienzo(w * k, h * k);
  c.getContext('2d')!.drawImage(fuente, 0, 0, c.width, c.height);
  return c;
}

function esperar(v: HTMLVideoElement, evento: string): Promise<void> {
  return new Promise((ok, mal) => {
    const error = () => mal(new ErrorCaptura('No se pudo leer el video en este celular.'));
    v.addEventListener(
      evento,
      () => {
        v.removeEventListener('error', error);
        ok();
      },
      { once: true },
    );
    v.addEventListener('error', error, { once: true });
  });
}

export async function fotogramasDeVideo(archivo: File, alAvanzar?: (i: number, n: number) => void): Promise<HTMLCanvasElement[]> {
  if (archivo.size > MAX_VIDEO_BYTES) throw new ErrorCaptura('El video pesa más de 40 MB. Graba uno más corto.');
  const url = URL.createObjectURL(archivo);
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  const listo = esperar(v, 'loadeddata');
  v.src = url;
  try {
    await listo;
    if (!Number.isFinite(v.duration) || v.duration <= 0) throw new ErrorCaptura('El video no tiene duración legible.');
    if (v.duration > MAX_VIDEO_S + 0.5) throw new ErrorCaptura('El video dura más de 30 segundos. Graba una vuelta más corta.');
    const tiempos = tiemposFotogramas(v.duration);
    const salida: HTMLCanvasElement[] = [];
    for (const [i, t] of tiempos.entries()) {
      const buscado = esperar(v, 'seeked');
      v.currentTime = t;
      await buscado;
      salida.push(aFotograma(v, v.videoWidth, v.videoHeight));
      alAvanzar?.(i + 1, tiempos.length);
    }
    return salida;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fotogramasDeFotos(archivos: File[]): Promise<HTMLCanvasElement[]> {
  if (archivos.length < MIN_FOTOS || archivos.length > MAX_FOTOS) throw new ErrorCaptura(`Elige entre ${MIN_FOTOS} y ${MAX_FOTOS} fotos, dando la vuelta al objeto.`);
  return Promise.all(
    archivos.map(async (f) => {
      const b = await createImageBitmap(f);
      const c = aFotograma(b, b.width, b.height);
      b.close();
      return c;
    }),
  );
}

/** Contact sheet (JPEG data URL) and its cells, in sheet pixels; `escala` maps sheet pixels back to keyframe pixels. */
export function hojaDeContacto(fotogramas: HTMLCanvasElement[]): { hoja: string; celdas: Rect[]; escala: number } {
  const f0 = fotogramas[0]!;
  const w = Math.round(f0.width * ESCALA_HOJA);
  const h = Math.round(f0.height * ESCALA_HOJA);
  const d = disponerHoja(fotogramas.length, w, h);
  const c = lienzo(d.ancho, d.alto);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  fotogramas.forEach((f, i) => ctx.drawImage(f, d.celdas[i]!.x, d.celdas[i]!.y, w, h));
  return { hoja: c.toDataURL('image/jpeg', 0.85), celdas: d.celdas, escala: f0.width / w };
}

function recortar(f: HTMLCanvasElement, m: MascaraCelda | null, escala: number): HTMLCanvasElement {
  const capa = lienzo(f.width, f.height);
  const ctx = capa.getContext('2d')!;
  let caja: Rect | null = null;
  if (m) {
    const raster = desempacarBits(m.bits, m.ancho, m.alto);
    const chico = lienzo(m.ancho, m.alto);
    const cctx = chico.getContext('2d')!;
    const img = cctx.createImageData(m.ancho, m.alto);
    for (let i = 0; i < raster.length; i++) img.data[i * 4 + 3] = raster[i] ? 255 : 0;
    cctx.putImageData(img, 0, 0);
    caja = { x: m.x * escala, y: m.y * escala, w: m.ancho * escala, h: m.alto * escala };
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(chico, caja.x, caja.y, caja.w, caja.h);
  } else {
    const r = Math.min(f.width, f.height);
    const g = ctx.createRadialGradient(f.width / 2, f.height / 2, r * 0.25, f.width / 2, f.height / 2, r * 0.45);
    g.addColorStop(0, '#000');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, f.width, f.height);
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(f, 0, 0);
  const r = recorteCuadrado(caja, f.width, f.height);
  const celda = lienzo(LADO_CELDA_ATLAS, LADO_CELDA_ATLAS);
  celda.getContext('2d')!.drawImage(capa, r.x, r.y, r.w, r.h, 0, 0, celda.width, celda.height);
  return celda;
}

/** Atlas PNG of the cut-out views; the hologram picks a cell per viewing angle. */
export async function atlasDeVistas(fotogramas: HTMLCanvasElement[], mascaras: Array<MascaraCelda | null>, escala: number): Promise<{ atlas: Blob; columnas: number; filas: number }> {
  const { columnas, filas } = disponerAtlas(fotogramas.length);
  const c = lienzo(columnas * LADO_CELDA_ATLAS, filas * LADO_CELDA_ATLAS);
  const ctx = c.getContext('2d')!;
  fotogramas.forEach((f, i) => ctx.drawImage(recortar(f, mascaras[i] ?? null, escala), (i % columnas) * LADO_CELDA_ATLAS, Math.floor(i / columnas) * LADO_CELDA_ATLAS));
  const atlas = await new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new ErrorCaptura('No se pudo armar el holograma.'))), 'image/png'));
  return { atlas, columnas, filas };
}

export function aJpeg(f: HTMLCanvasElement, calidad = 0.85): string {
  return f.toDataURL('image/jpeg', calidad);
}

export async function aBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

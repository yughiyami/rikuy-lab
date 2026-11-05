/**
 * SAM 3.1 (Meta Model API, `POST /v1/responses`, model `sam-3.1`): one concept-prompt call segments every
 * keyframe at once, because the client sends the keyframes tiled into one contact sheet with white gutters.
 * The output is special-token text (one line per frame; an image is frame `<0f>`); masks are decoded with
 * Meta's own `@meta-sam/parser` codec and re-packed as plain row-major bits for the browser.
 */
import { decodeMaskToRaster } from '@meta-sam/parser';

export interface RegistroSam {
  objeto: number;
  /** Box corners in sheet pixels, inclusive (x2,y2 are the last covered pixel). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Mask raster size (rows x columns); it covers the box. */
  alto: number;
  ancho: number;
  payload: string;
}

const RE_REGISTRO = /(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=\d+;h=\d+[^|]*\|><\|mask;x=0;y=0(?:;c=[0-9.]+)?;data=(\d+),(\d+),([^|]+)\|>/g;

/** Parses the records of an image response (frame `<0f>`). Zero records is a valid empty match. */
export function leerRegistrosSam(texto: string): RegistroSam[] {
  const salida: RegistroSam[] = [];
  for (const m of texto.matchAll(RE_REGISTRO)) {
    salida.push({ objeto: +m[1]!, x1: +m[2]!, y1: +m[3]!, x2: +m[4]!, y2: +m[5]!, alto: +m[6]!, ancho: +m[7]!, payload: m[8]! });
  }
  return salida;
}

/** Decodes a mask with the official codec (`~` lossless or `!` one_bit). */
export function decodificarMascara(r: RegistroSam): Uint8Array {
  return decodeMaskToRaster({ encoding: r.payload.startsWith('!') ? 'one_bit' : 'lossless', payload: r.payload, width: r.ancho, height: r.alto });
}

/** Row-major 0/1 raster -> base64 of packed bits (MSB first), the compact wire form for the browser. */
export function empacarBits(raster: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(raster.length / 8));
  for (let i = 0; i < raster.length; i++) if (raster[i]) bytes[i >> 3]! |= 0x80 >> (i & 7);
  return Buffer.from(bytes).toString('base64');
}

export interface Celda {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MascaraCelda {
  /** Box relative to the cell, in cell pixels. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  bits: string;
}

/**
 * Assigns each record to the cell that contains its box center and keeps the largest one per cell
 * (the object, not a stray reflection). Cells with no match get `null`.
 */
export function asignarACeldas(registros: readonly RegistroSam[], celdas: readonly Celda[]): Array<RegistroSam | null> {
  const mejor: Array<RegistroSam | null> = celdas.map(() => null);
  for (const r of registros) {
    const cx = (r.x1 + r.x2) / 2;
    const cy = (r.y1 + r.y2) / 2;
    const i = celdas.findIndex((c) => cx >= c.x && cx < c.x + c.w && cy >= c.y && cy < c.y + c.h);
    if (i < 0) continue;
    const area = (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1);
    const actual = mejor[i];
    if (!actual || area > (actual.x2 - actual.x1 + 1) * (actual.y2 - actual.y1 + 1)) mejor[i] = r;
  }
  return mejor;
}

export interface OpcionesSam {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** One SAM 3.1 call over the contact sheet. Throws on HTTP or protocol errors. */
export async function segmentarHoja(o: OpcionesSam, hojaDataUrl: string, concepto: string): Promise<RegistroSam[]> {
  const f = o.fetch ?? fetch;
  const r = await f(`${o.baseUrl.replace(/\/+$/, '')}/responses`, {
    method: 'POST',
    headers: { authorization: `Bearer ${o.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'sam-3.1',
      stream: false,
      input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: concepto }, { type: 'input_image', image_url: hojaDataUrl }] }],
    }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 45_000),
  });
  if (!r.ok) throw new Error(`sam_http_${r.status}`);
  const j = (await r.json()) as { status?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (j.status && j.status !== 'completed') throw new Error(`sam_${j.status}`);
  const texto = (j.output ?? []).flatMap((o2) => o2.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text ?? '').join('');
  return leerRegistrosSam(texto);
}

/** Masks per cell, relative to each cell, ready for the browser compositor. */
export function mascarasPorCelda(registros: readonly RegistroSam[], celdas: readonly Celda[]): Array<MascaraCelda | null> {
  return asignarACeldas(registros, celdas).map((r, i) => {
    if (!r) return null;
    const c = celdas[i]!;
    return { x: r.x1 - c.x, y: r.y1 - c.y, ancho: r.ancho, alto: r.alto, bits: empacarBits(decodificarMascara(r)) };
  });
}

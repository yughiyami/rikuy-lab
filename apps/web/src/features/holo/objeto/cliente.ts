/** Client of POST /ia/objeto3d (the cloud holds the keys; this sends keyframes only, never the video). */
import { colegioPorDefecto, urlNubePorDefecto } from '../../creador/clienteNube.ts';
import type { Rect } from './modelo.ts';
import type { RespuestaObjeto3d } from './tipos.ts';

export class ErrorObjeto3d extends Error {}

export async function pedirObjeto3d(
  cuerpo: { heroe: string; hoja: string; celdas: Rect[]; grado?: string; pista?: string },
  o: { baseUrl?: string; fetch?: typeof fetch } = {},
): Promise<RespuestaObjeto3d> {
  const base = (o.baseUrl ?? urlNubePorDefecto()).replace(/\/+$/, '');
  const f = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  let r: Response;
  try {
    r = await f(`${base}/ia/objeto3d`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-rikuy-colegio': colegioPorDefecto() },
      body: JSON.stringify({ ...cuerpo, celdas: cuerpo.celdas.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h) })) }),
    });
  } catch {
    throw new ErrorObjeto3d('Sin conexión con la nube. El escaneo necesita internet una vez; luego el holograma queda guardado.');
  }
  const j = (await r.json().catch(() => ({}))) as RespuestaObjeto3d & { detalle?: string | string[] };
  if (!r.ok) throw new ErrorObjeto3d(`La nube no pudo procesar el objeto (${r.status}). ${[j.detalle ?? ''].flat().join(' ')}`.trim());
  return j;
}

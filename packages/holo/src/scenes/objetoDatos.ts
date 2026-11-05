/**
 * The scanned real object currently shown by the `objeto` scene. Three-free so pages can set it before
 * the lazy engine loads. It is a 360° view built from the video keyframes (a sprite atlas keyed to the
 * viewing angle), never a mesh.
 */
export interface ObjetoHolograma {
  id: string;
  nombre: string;
  /** Atlas of the cut-out keyframes, `columnas` x `filas` cells, in capture order around the object. */
  atlas: TexImageSource;
  columnas: number;
  filas: number;
  /** Number of used cells (keyframes). */
  vistas: number;
  /** Cell width / height. */
  aspecto: number;
}

let actual: ObjetoHolograma | null = null;

export function fijarObjetoHolograma(o: ObjetoHolograma | null): void {
  actual = o;
}

export function objetoHolograma(): ObjetoHolograma | null {
  return actual;
}

/**
 * Which keyframe a camera sees: the viewing angle around the vertical axis (object space, radians,
 * 0 = the hero view) mapped to the nearest captured view. Pure, mirrored in the shader.
 */
export function vistaParaAngulo(angulo: number, vistas: number): number {
  const vuelta = angulo / (2 * Math.PI);
  const f = vuelta - Math.floor(vuelta);
  return Math.round(f * vistas) % vistas;
}

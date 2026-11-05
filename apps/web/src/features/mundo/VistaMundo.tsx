/**
 * Canvas host for the museum world. The canvas is decoration plus pointer/arrow-key input; every
 * destination is ALSO a real DOM button outside the canvas (keyboard and screen readers, 1.3).
 */
import { type AvatarRender, type Destino, type Punto, encuadrar, zoomQueCubre, zoomQueEncuadra } from '@rikuy/campus';
import { type Bucle, type RenderizadorCanvas, TILE_CSS, crearRenderizadorCanvas, iniciarBucle } from '@rikuy/campus/canvas';
import { useEffect, useRef } from 'react';
import type { ControladorMundo } from './controlador.ts';
import { paletaDe } from './paleta.ts';

export interface FuenteEscena {
  jugador: () => AvatarRender;
  otros: () => readonly AvatarRender[];
  resaltado: () => string | undefined;
  /** Path to draw when the group is not walking (director's suggestion). */
  sugerencia: () => readonly Punto[];
  /** Called every frame with dt (presence interpolation, sending positions...). */
  alPaso?: (dt: number) => void;
}

declare global {
  interface Window {
    __rikuyMundo?: { fps: () => number; avatares: () => number };
  }
}

const TECLAS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export function VistaMundo({
  controlador,
  fuente,
  etiqueta,
  alActivar,
  llenar = false,
  zoomMinimo = 1,
  alCercano,
}: {
  controlador: ControladorMundo;
  fuente: FuenteEscena;
  etiqueta: string;
  /** Tells the container whether the animated world is running (otherwise doors open directly). */
  alActivar?: (activo: boolean) => void;
  /** Desktop: the canvas fills its container (height included) instead of the phone aspect. */
  llenar?: boolean;
  /** With `llenar`, the smallest zoom used to frame the whole hall (the teacher sees it all). */
  zoomMinimo?: number;
  /** Called when the nearby destination changes (desktop HUD "press E"). */
  alCercano?: (d: Destino | undefined) => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const fuenteRef = useRef(fuente);
  const cercanoRef = useRef(alCercano);
  useEffect(() => {
    fuenteRef.current = fuente;
    cercanoRef.current = alCercano;
  });

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    let render: RenderizadorCanvas;
    try {
      render = crearRenderizadorCanvas(canvas, { paleta: paletaDe });
    } catch {
      alActivar?.(false);
      return; // no Canvas 2D (old device or test DOM): the DOM buttons and the list mode still work
    }
    // Kenney "Roguelike Indoor" sheet (CC0); the world draws its own fallback art until it loads
    const hoja = new Image();
    hoja.onload = () => render.ponerAtlas(hoja);
    hoja.src = `${import.meta.env.BASE_URL}arte/kenney/roguelike-indoor/roguelikeIndoor_transparent.png`;
    const reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let vista = { ancho: 11, alto: 14 };
    const ajustar = () => {
      const ancho = canvas.parentElement?.clientWidth || 360;
      const alto = llenar ? Math.max(canvas.parentElement?.clientHeight || 0, 320) : Math.min(Math.round(ancho * 1.1), 480);
      // the teacher (zoomMinimo < 1) frames the whole hall; a group fills the stage and the camera follows it
      const mapa = controlador.escena.mapa;
      const todo = llenar && zoomMinimo < 1;
      const zoom = !llenar ? 1 : todo ? zoomQueEncuadra(mapa, { ancho, alto }, TILE_CSS, zoomMinimo) : zoomQueCubre(mapa, { ancho, alto }, TILE_CSS, 1, 1.75);
      vista = render.redimensionar(ancho, alto, zoom, todo);
    };
    ajustar();
    const teclas = new Set<string>();
    const abajo = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
        if (controlador.interactuar()) e.preventDefault();
        return;
      }
      if (TECLAS[e.key]) {
        teclas.add(e.key);
        e.preventDefault();
      }
    };
    const arriba = (e: KeyboardEvent) => teclas.delete(e.key);
    const toque = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const cam = encuadrar(controlador.pos, controlador.escena.mapa, vista);
      controlador.caminarAPunto(cam.x + ((e.clientX - r.left) / r.width) * vista.ancho, cam.y + ((e.clientY - r.top) / r.height) * vista.alto);
    };
    canvas.addEventListener('keydown', abajo);
    canvas.addEventListener('keyup', arriba);
    canvas.addEventListener('blur', () => teclas.clear());
    canvas.addEventListener('pointerdown', toque);
    window.addEventListener('resize', ajustar);
    const observador = llenar && typeof ResizeObserver === 'function' ? new ResizeObserver(ajustar) : null;
    if (observador && canvas.parentElement) observador.observe(canvas.parentElement);
    let ultimoCercano: string | undefined;

    const bucle: Bucle = iniciarBucle((dt, t) => {
      const f = fuenteRef.current;
      let dx = 0;
      let dy = 0;
      for (const k of teclas) {
        dx += TECLAS[k]![0];
        dy += TECLAS[k]![1];
      }
      if (dx || dy) controlador.mover(dx, dy, dt);
      else controlador.paso(dt);
      f.alPaso?.(dt);
      const cerca = controlador.cercano();
      if (cerca?.id !== ultimoCercano) {
        ultimoCercano = cerca?.id;
        cercanoRef.current?.(cerca);
      }
      const otros = f.otros();
      render.dibujar({
        escena: controlador.escena,
        camara: encuadrar(controlador.pos, controlador.escena.mapa, vista),
        jugador: f.jugador(),
        otros,
        camino: controlador.camino.length ? controlador.camino : f.sugerencia(),
        resaltado: f.resaltado(),
        cercano: cerca?.id,
        t: reducido ? 0 : t,
      });
    }, 60);
    alActivar?.(true);
    window.__rikuyMundo = { fps: () => bucle.fps(), avatares: () => fuenteRef.current.otros().length + 1 };
    return () => {
      bucle.detener();
      render.destruir();
      canvas.removeEventListener('keydown', abajo);
      canvas.removeEventListener('keyup', arriba);
      canvas.removeEventListener('pointerdown', toque);
      window.removeEventListener('resize', ajustar);
      observador?.disconnect();
      delete window.__rikuyMundo;
      alActivar?.(false);
    };
  }, [controlador, alActivar, llenar, zoomMinimo]);

  return (
    <canvas
      ref={lienzo}
      className="rk-lienzo"
      tabIndex={0}
      role="img"
      aria-label={`${etiqueta}. Usa las flechas para caminar, E para abrir lo que está cerca, o los botones de destinos.`}
    />
  );
}

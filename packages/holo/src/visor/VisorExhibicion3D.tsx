/**
 * Heavy half of `<VisorExhibicion>`: mounts the moved Three.js engine on a canvas.
 * Hologram frame of DESIGN 7.5: absolute black, Fotón corner brackets, Sol title plaque,
 * readout chip. With `sinMarco` it is the bare display for the pyramid or the box.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import type { DisplayState } from '@rikuy/contracts';
import { applyViewerAction } from '../engine/applyAction.ts';
import { HoloRenderer } from '../engine/HoloRenderer.ts';
import { SceneManager } from '../engine/SceneManager.ts';
import { attachTouchpad } from '../engine/touch.ts';
import { ViewController } from '../engine/ViewController.ts';
import { rendererModeFor, type VisorExhibicionProps } from './types.ts';

const FOTON = '#5FE3FF';
const SOL = '#FFC14D';

export default function VisorExhibicion3D({
  practica,
  escena,
  modo = 'pantalla',
  canal,
  variables,
  onEstado,
  espejo = false,
  guias = false,
  tamanoVista,
  sinMarco = false,
  etiqueta,
}: VisorExhibicionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<{ holo: HoloRenderer; view: ViewController; scenes: SceneManager } | null>(null);
  const [failed, setFailed] = useState(false);
  const [readout, setReadout] = useState<DisplayState['readout']>();
  const onEstadoRef = useRef(onEstado);
  onEstadoRef.current = onEstado;
  const sinMarcoRef = useRef(sinMarco);
  sinMarcoRef.current = sinMarco;

  // Mount the engine once per canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let holo: HoloRenderer;
    try {
      holo = new HoloRenderer(canvas, { mode: rendererModeFor(modo), mirror: espejo, aspect: sinMarco ? '9:16' : 'libre' });
    } catch {
      setFailed(true);
      return;
    }
    const view = new ViewController(holo.pivot);
    const defaults = Object.fromEntries((practica?.variables ?? []).map((v) => [v.id, v.porDefecto]));
    const scenes = new SceneManager(holo.pivot, view, {
      catalog: { defaults, hints: () => practica?.pistas ?? [] },
      modelsBaseUrl: './',
    });
    scenes.onChange = (s) => {
      setReadout(s.readout);
      onEstadoRef.current?.(s);
    };
    engineRef.current = { holo, view, scenes };
    // Listeners live on the canvas and go away with it.
    attachTouchpad(canvas, (dx, dy, dz) => {
      if (dx !== 0 || dy !== 0) view.nudge(dx, dy);
      if (dz !== 1) scenes.zoom(dz); // semantic zoom on scenes with depth levels
    });
    // Tap (no drag) on a scene with depth levels dives one level deeper ("profundizar").
    let toque: { x: number; y: number; t: number } | null = null;
    const abajo = (e: PointerEvent) => (toque = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null);
    const arriba = (e: PointerEvent) => {
      const t = toque;
      toque = null;
      if (!t || sinMarcoRef.current || !scenes.current?.niveles) return;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 8 && performance.now() - t.t < 350) scenes.profundizar(1);
    };
    canvas.addEventListener('pointerdown', abajo);
    canvas.addEventListener('pointerup', arriba);

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      view.update(dt);
      scenes.update(dt);
      holo.render();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const tick = window.setInterval(() => scenes.emit(), 1000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(tick);
      engineRef.current = null;
      holo.dispose();
    };
    // The engine is rebuilt only when the canvas remounts; mode and scene changes are applied below.
  }, []);

  useEffect(() => {
    engineRef.current?.holo.setOptions({ mode: rendererModeFor(modo), mirror: espejo, guides: guias, ...(tamanoVista ? { viewSize: tamanoVista } : {}) });
  }, [modo, espejo, guias, tamanoVista]);

  useEffect(() => {
    void engineRef.current?.scenes.goTo(escena);
  }, [escena]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e || !variables) return;
    e.scenes.apply(Object.entries(variables).map(([variable, valor]) => ({ tool: 'fijar_variable' as const, args: { variable, valor } })));
  }, [variables]);

  useEffect(() => {
    if (!canal) return;
    return canal.subscribe((action) => {
      const e = engineRef.current;
      if (e) applyViewerAction(action, e.view, e.scenes);
    });
  }, [canal]);

  if (failed) {
    return (
      <div role="alert" data-theme="holo" style={{ ...frame, color: FOTON, padding: 24, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        Este celular no puede dibujar el holograma. Usa el diagrama o pide el celular proyector.
      </div>
    );
  }

  return (
    <figure data-theme="holo" data-modo={modo} style={sinMarco ? bare : frame} aria-label={etiqueta ?? `Holograma: ${practica?.titulo ?? escena}`}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
      {!sinMarco && (
        <>
          {corners.map((c, i) => (
            <span key={i} aria-hidden="true" style={{ position: 'absolute', width: 22, height: 22, borderColor: FOTON, borderStyle: 'solid', borderWidth: 0, ...c }} />
          ))}
          {practica?.titulo && (
            <figcaption style={{ position: 'absolute', top: 12, left: 16, border: `2px solid ${SOL}`, color: SOL, padding: '4px 10px', borderRadius: 8, fontSize: 18, fontWeight: 700, maxWidth: '75%' }}>
              {practica.titulo}
            </figcaption>
          )}
          {readout && (
            <output style={{ position: 'absolute', bottom: 12, left: 16, border: `2px solid ${FOTON}`, color: FOTON, padding: '4px 12px', borderRadius: 999, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
              {readout.label}: {readout.value}
            </output>
          )}
        </>
      )}
    </figure>
  );
}

const frame: CSSProperties = { position: 'relative', margin: 0, background: '#000', borderRadius: 16, overflow: 'hidden', aspectRatio: '4 / 5', width: '100%' };
const bare: CSSProperties = { position: 'fixed', inset: 0, margin: 0, background: '#000' };
const corners: CSSProperties[] = [
  { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 },
  { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 },
  { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 },
  { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 },
];

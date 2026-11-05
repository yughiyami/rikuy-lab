import type * as THREE from 'three';

/**
 * Contrato de una escena. Agregar contenido nuevo = escribir un módulo
 * que cumpla esta interfaz y registrarlo en registry.ts.
 */
export interface SceneModule {
  id: string;
  label: string;
  /** Práctica a la que pertenece (para variables y pistas). */
  practice: string;
  /** Construye el modelo 3D. Se llama una vez por visita. */
  build(): THREE.Group;
  /** Avance de la animación o simulación. */
  update?(dt: number, ctx: SceneContext): void;
  /** Valor que se muestra y se envía al panel (actividad, periodo...). */
  readout?(ctx: SceneContext): { label: string; value: string } | undefined;
  /** Resalta una parte por nombre (sitio_activo, enlace, cuerda...). */
  highlight?(part: string): boolean;
  /** Vista explosionada. */
  explode?(on: boolean): void;
  /** Libera recursos al salir. */
  dispose?(): void;
  /**
   * Semantic zoom: number of depth levels (variable `nivel`). Pinching past the zoom edges dives
   * one level deeper or back instead of only scaling the model.
   */
  niveles?: number;
}

export interface SceneContext {
  running: boolean;
  time: number;
  variables: Record<string, number>;
  /** Counts "soltar" orders: a scene with a starting pose (the pendulum) restarts from it. */
  releases?: number;
}

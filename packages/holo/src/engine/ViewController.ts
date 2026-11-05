/**
 * Estado de la vista del holograma: giro, inclinación y zoom con suavizado.
 * Recibe deltas de cualquier fuente (toque, mouse, gestos de mano, agente).
 */
import * as THREE from 'three';

export class ViewController {
  yaw = 0;
  pitch = 0;
  zoom = 1;
  autoRotate = true;
  private tYaw = 0;
  private tPitch = 0;
  private tZoom = 1;
  private idle = 0;

  constructor(private readonly pivot: THREE.Object3D) {}

  /** dx, dy en radianes; dz como factor multiplicativo de zoom. */
  nudge(dx: number, dy: number, dz = 1) {
    this.tYaw += dx;
    this.tPitch = THREE.MathUtils.clamp(this.tPitch + dy, -1.2, 1.2);
    this.tZoom = THREE.MathUtils.clamp(this.tZoom * dz, 0.35, 3.5);
    this.idle = 0;
  }

  rotateDeg(yaw = 0, pitch = 0) {
    this.nudge(THREE.MathUtils.degToRad(yaw), THREE.MathUtils.degToRad(pitch));
  }

  /** Target zoom (before smoothing). */
  get targetZoom(): number {
    return this.tZoom;
  }

  /** Jumps the zoom without smoothing (a semantic-zoom level change takes over the motion). */
  snapZoom(z: number) {
    this.tZoom = z;
    this.zoom = z;
  }

  reset() {
    this.tYaw = 0;
    this.tPitch = 0;
    this.tZoom = 1;
  }

  update(dt: number) {
    this.idle += dt;
    // Tras 6 s sin interacción vuelve el giro lento: el holograma "vive".
    if (this.autoRotate && this.idle > 6) this.tYaw += dt * 0.35;
    const k = 1 - Math.exp(-dt * 8);
    this.yaw += (this.tYaw - this.yaw) * k;
    this.pitch += (this.tPitch - this.pitch) * k;
    this.zoom += (this.tZoom - this.zoom) * k;
    this.pivot.rotation.set(this.pitch, this.yaw, 0);
    this.pivot.scale.setScalar(this.zoom);
  }
}

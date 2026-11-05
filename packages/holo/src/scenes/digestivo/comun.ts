/** Shared types and small builders of the digestive hologram levels. */
import * as THREE from 'three';
import { HoloLabel } from '../label.ts';

export interface EstadoNivel {
  /** Scene time (s). */
  t: number;
  dt: number;
  conLactasa: boolean;
  /** Animation speed multiplier (scene variable `velocidad`). */
  velocidad: number;
  running: boolean;
  /** Increments on every "soltar lactosa" order: the journey restarts. */
  liberaciones: number;
  /** Lactase activity 0..1 (temperature and pH of the lactasa practice). */
  actividad: number;
}

export interface Nivel {
  grupo: THREE.Group;
  /** Point the camera dives into when going one level deeper (in level coordinates). */
  foco: THREE.Vector3;
  /**
   * Parts that must not count for the size fit of the scene (labels at the edge, the head): the
   * scene adds them right after the fit.
   */
  tardio?: THREE.Group;
  update(e: EstadoNivel): void;
  /** Names of highlightable parts -> pulse them. */
  resaltar?(parte: string): boolean;
  /** Extra resources not owned by meshes (label canvases). */
  dispose(): void;
}

/** A label with a thin leader line from the text to the part it names. */
export function rotulo(texto: string, color: string, en: THREE.Vector3, ancla: THREE.Vector3, ancho = 0.62, sub?: string): { grupo: THREE.Group; label: HoloLabel } {
  const g = new THREE.Group();
  const label = new HoloLabel(ancho);
  label.set(sub ? [{ text: texto, color, size: 64 }, { text: sub, color: '#BFE9F5', size: 40 }] : [{ text: texto, color, size: 68 }]);
  label.sprite.position.copy(en);
  const linea = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([ancla, en.clone().lerp(ancla, 0.18)]),
    new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.75 }),
  );
  const punto = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }));
  punto.position.copy(ancla);
  g.add(linea, punto, label.sprite);
  return { grupo: g, label };
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

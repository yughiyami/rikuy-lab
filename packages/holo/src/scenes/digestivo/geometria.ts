/**
 * Organic geometry for the digestive hologram: tubes with a variable radius along a smooth curve,
 * low-frequency noise so nothing looks machined, and a peristalsis wave done in the vertex shader
 * (one uniform per material, zero CPU work per frame).
 */
import * as THREE from 'three';
import { withFresnel } from '../materials.ts';

/** Cheap deterministic 3D value noise (no tables): enough for organic wobble. */
export function ruido(x: number, y: number, z: number): number {
  const s = Math.sin(x * 1.7 + y * 3.1) * Math.cos(y * 2.3 - z * 1.3) + Math.sin(z * 2.9 + x * 0.7) * 0.5;
  return s / 1.5;
}

export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface OpcionesTubo {
  segmentos?: number;
  radiales?: number;
  /** Radius at s (0..1 along the curve). */
  radio: (s: number) => number;
  /** Organic noise amplitude as a fraction of the radius. */
  ruido?: number;
  /** Close the ends with a rounded cap. */
  tapas?: boolean;
}

/**
 * Tube along a curve with a radius function. Adds `aS` (0..1 along the curve) and `aR` (radius)
 * attributes for the peristalsis shader.
 */
export function tuboOrganico(curva: THREE.Curve<THREE.Vector3>, o: OpcionesTubo): THREE.BufferGeometry {
  const seg = o.segmentos ?? 200;
  const rad = o.radiales ?? 14;
  const frames = curva.computeFrenetFrames(seg, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const as: number[] = [];
  const ar: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const amp = o.ruido ?? 0.08;
  for (let i = 0; i <= seg; i++) {
    const s = i / seg;
    curva.getPointAt(s, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    let r = o.radio(s);
    if (o.tapas) r *= Math.sqrt(Math.max(0, Math.sin(Math.min(1, Math.min(s, 1 - s) * 40) * (Math.PI / 2))));
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      n.set(0, 0, 0).addScaledVector(N, Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize();
      const w = 1 + amp * ruido(p.x * 9 + Math.cos(a), p.y * 9 + Math.sin(a), p.z * 9);
      pos.push(p.x + n.x * r * w, p.y + n.y * r * w, p.z + n.z * r * w);
      nor.push(n.x, n.y, n.z);
      as.push(s);
      ar.push(r);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j;
      const b = a + rad + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(as, 1));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(ar, 1));
  g.setIndex(idx);
  return g;
}

/** Shared time uniform of every peristaltic material in the scene. */
export interface Peristalsis {
  tiempo: { value: number };
  /** Where the contraction wave is (0..1 along each tube), driven by the bolus. */
  onda: { value: number };
}

/**
 * Hologram material whose vertices squeeze in a travelling ring (peristalsis) plus a slow
 * standing wave. Based on the shared Fresnel holo look.
 */
export function materialPeristaltico(color: number, per: Peristalsis, opts: { opacity?: number; emissive?: number; fuerza?: number } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: opts.emissive ?? 0.4,
    roughness: 0.4,
    metalness: 0.05,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    depthWrite: (opts.opacity ?? 1) >= 1,
    side: THREE.DoubleSide,
  });
  withFresnel(m);
  const fresnel = m.onBeforeCompile;
  const fuerza = (opts.fuerza ?? 0.22).toFixed(3);
  m.onBeforeCompile = (shader, renderer) => {
    fresnel.call(m, shader, renderer);
    shader.uniforms.uTiempo = per.tiempo;
    shader.uniforms.uOnda = per.onda;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aS;\nattribute float aR;\nuniform float uTiempo;\nuniform float uOnda;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float d = aS - uOnda;
          float anillo = exp(-d * d * 900.0);
          float lenta = sin(aS * 60.0 - uTiempo * 3.0) * 0.06;
          transformed -= normal * aR * (${fuerza} * anillo - lenta);
        }`,
      );
  };
  m.customProgramCacheKey = () => `rikuy-peristalsis-${fuerza}`;
  return m;
}

/** Deformed sphere (liver, stomach, pancreas lobes): ellipsoid with organic noise. */
export function organoBlando(radios: [number, number, number], forma: (v: THREE.Vector3) => void, detalle = 48): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, detalle, Math.round(detalle * 0.75));
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const w = 1 + 0.05 * ruido(v.x * 3, v.y * 3, v.z * 3);
    v.set(v.x * radios[0] * w, v.y * radios[1] * w, v.z * radios[2] * w);
    forma(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Sets the opacity of every material in a subtree, remembering the authored opacity. */
export function fundir(o: THREE.Object3D, k: number): void {
  o.traverse((x) => {
    const mats = (x as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      m.userData.base ??= m.opacity;
      m.userData.transparente ??= m.transparent;
      m.opacity = (m.userData.base as number) * k;
      const debe = k < 0.999 || (m.userData.transparente as boolean);
      if (m.transparent !== debe) {
        m.transparent = debe;
        m.needsUpdate = true;
      }
    }
  });
}

/**
 * Escenas anatómicas procedurales (sin archivos externos, funcionan sin red).
 * Son esquemas didácticos; registry.ts puede reemplazarlas por modelos glTF
 * reales (por ejemplo derivados de Z-Anatomy) cuando estén disponibles.
 */
import * as THREE from 'three';
import { breathingRate } from './physics.ts';
import type { SceneModule } from './types.ts';
import { PALETTE, at, holo, pulse, tube, glowLine } from './materials.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// --------------------------------------------------------------------------
export function intestino(): SceneModule {
  return {
    id: 'intestino',
    label: 'Intestino delgado (corte)',
    practice: 'lactasa',
    build() {
      const g = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 48, 1, true), holo(PALETTE.coral, { opacity: 0.45 }));
      g.add(wall);
      // Vellosidades hacia el interior (instanciadas: miles sin costo).
      const villus = new THREE.CapsuleGeometry(0.05, 0.28, 4, 8);
      const inst = new THREE.InstancedMesh(villus, holo(PALETTE.amber, { emissive: 0.55 }), 360);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      let k = 0;
      for (let row = 0; row < 12; row++) {
        for (let col = 0; col < 30; col++) {
          const a = (col / 30) * Math.PI * 2 + row * 0.1;
          const y = -0.7 + row * 0.13;
          const pos = v(Math.cos(a) * 0.72, y, Math.sin(a) * 0.72);
          q.setFromUnitVectors(v(0, 1, 0), v(-Math.cos(a), 0, -Math.sin(a)));
          m.compose(pos, q, v(1, 1, 1));
          inst.setMatrixAt(k++, m);
        }
      }
      g.add(inst);
      g.rotation.x = 0.35;
      return g;
    },
  };
}

// --------------------------------------------------------------------------
export function vellosidad(): SceneModule {
  let capillaries: THREE.LineSegments;
  return {
    id: 'vellosidad',
    label: 'Vellosidad intestinal',
    practice: 'lactasa',
    build() {
      const g = new THREE.Group();
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.5, 8, 24), holo(PALETTE.amber, { opacity: 0.5 }));
      g.add(finger);
      // Red de capilares: líneas que suben y bajan dentro del dedo.
      const pts: number[] = [];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        for (let j = 0; j < 20; j++) {
          const y0 = -0.9 + (j / 20) * 1.8;
          const y1 = y0 + 0.09;
          const r = 0.25 + Math.sin(j + i) * 0.03;
          pts.push(Math.cos(a) * r, y0, Math.sin(a) * r, Math.cos(a + 0.15) * r, y1, Math.sin(a + 0.15) * r);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      capillaries = new THREE.LineSegments(geo, glowLine(PALETTE.coral));
      g.add(capillaries);
      // Vaso linfático central (quilífero).
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 12), holo(PALETTE.lime, { emissive: 0.6 })));
      // Enterocitos como pequeñas teselas en la superficie.
      const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.12, 0.04), holo(PALETTE.cyan, { emissive: 0.5 }), 240);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      for (let i = 0; i < 240; i++) {
        const a = (i % 20) / 20 * Math.PI * 2;
        const y = -0.7 + Math.floor(i / 20) * 0.12;
        q.setFromAxisAngle(v(0, 1, 0), -a);
        m.compose(v(Math.cos(a) * 0.37, y, Math.sin(a) * 0.37), q, v(1, 1, 1));
        cells.setMatrixAt(i, m);
      }
      g.add(cells);
      return g;
    },
    update(_dt, ctx) {
      (capillaries.material as THREE.LineBasicMaterial).opacity = 0.6 + Math.sin(ctx.time * 3) * 0.3;
    },
  };
}

// --------------------------------------------------------------------------
export function enterocito(): SceneModule {
  let brush: THREE.InstancedMesh;
  let brushMat: THREE.MeshStandardMaterial;
  let highlightOn = false;
  return {
    id: 'enterocito',
    label: 'Enterocito y borde en cepillo',
    practice: 'lactasa',
    build() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.9, 4, 8, 4), holo(PALETTE.cyan, { opacity: 0.35 }));
      g.add(body);
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), holo(PALETTE.violet, { emissive: 0.6 })), v(0, -0.35, 0)));
      // Microvellosidades: aquí vive la lactasa.
      brushMat = holo(PALETTE.amber, { emissive: 0.5 });
      brush = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), brushMat, 100);
      const m = new THREE.Matrix4();
      let k = 0;
      for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) {
        m.makeTranslation(-0.4 + x * 0.09, 0.95, -0.4 + z * 0.09);
        brush.setMatrixAt(k++, m);
      }
      g.add(brush);
      g.position.y = -0.1;
      return g;
    },
    update(_dt, ctx) {
      if (highlightOn) pulse(brushMat, ctx.time);
    },
    highlight(part) {
      highlightOn = /borde|cepillo|microvell|lactasa/.test(part);
      return highlightOn;
    },
  };
}

// --------------------------------------------------------------------------
export function respiratorio(): SceneModule {
  let lungs: THREE.Mesh[] = [];
  let diaphragm: THREE.Mesh;
  let phase = 0;
  return {
    id: 'respiratorio',
    label: 'Sistema respiratorio',
    practice: 'respiratorio',
    build() {
      const g = new THREE.Group();
      const airway = holo(PALETTE.cyan, { emissive: 0.6 });
      g.add(tube([v(0, 1.3, 0), v(0, 0.75, 0), v(0, 0.45, 0)], 0.07, airway));
      // Árbol bronquial recursivo.
      const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
        const to = from.clone().addScaledVector(dir, len);
        g.add(tube([from, from.clone().lerp(to, 0.5), to], r, airway, 8, 6));
        if (depth === 0) return;
        for (const s of [-1, 1]) {
          const d = dir.clone().applyAxisAngle(v(0, 0, 1), s * 0.55).applyAxisAngle(v(0, 1, 0), s * 0.4).normalize();
          branch(to, d, len * 0.72, r * 0.7, depth - 1);
        }
      };
      branch(v(0, 0.45, 0), v(-0.6, -0.8, 0).normalize(), 0.32, 0.05, 4);
      branch(v(0, 0.45, 0), v(0.6, -0.8, 0).normalize(), 0.32, 0.05, 4);
      lungs = [-1, 1].map((s) => {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 24), holo(PALETTE.pink, { opacity: 0.35 }));
        l.scale.set(0.9, 1.35, 0.75);
        l.position.set(s * 0.5, 0.05, 0);
        return l;
      });
      g.add(...lungs);
      diaphragm = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), holo(PALETTE.coral, { opacity: 0.55 }));
      diaphragm.position.y = -0.95;
      g.add(diaphragm);
      return g;
    },
    update(dt, ctx) {
      const rpm = breathingRate(ctx.variables.altitud ?? 2335);
      if (ctx.running) phase += dt * (rpm / 60) * Math.PI * 2;
      const s = 1 + Math.sin(phase) * 0.08;
      lungs.forEach((l) => l.scale.set(0.9 * s, 1.35 * s, 0.75 * s));
      diaphragm.position.y = -0.95 - Math.sin(phase) * 0.08;
    },
    readout(ctx) {
      return { label: 'Respiraciones/min', value: String(breathingRate(ctx.variables.altitud ?? 2335)) };
    },
    highlight(part) {
      if (/diafragma/.test(part)) {
        (diaphragm.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4;
        return true;
      }
      return false;
    },
  };
}

// --------------------------------------------------------------------------
export function higado(): SceneModule {
  return {
    id: 'higado',
    label: 'Hígado',
    practice: 'lactasa',
    build() {
      const g = new THREE.Group();
      // Forma de cuña: esfera deformada por vértice.
      const geo = new THREE.SphereGeometry(0.8, 64, 48);
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const wedge = 0.55 + 0.45 * ((x + 0.8) / 1.6);
        p.setXYZ(i, x * 1.5, y * 0.75 * wedge - (x < -0.2 ? 0.1 : 0), z * 0.75);
      }
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, holo(PALETTE.liver, { opacity: 0.85 })));
      // Vesícula biliar y vena porta.
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), holo(PALETTE.lime, { emissive: 0.6 })), v(0.35, -0.42, 0.35)));
      g.add(tube([v(0, -1.1, 0), v(0.05, -0.7, 0.1), v(0, -0.35, 0.2)], 0.06, holo(PALETTE.violet, { emissive: 0.6 })));
      return g;
    },
  };
}

// --------------------------------------------------------------------------
export function lobulillo(): SceneModule {
  let plates: THREE.LineSegments;
  return {
    id: 'lobulillo',
    label: 'Lobulillo hepático',
    practice: 'lactasa',
    build() {
      const g = new THREE.Group();
      const hex = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 6, 1, true), holo(PALETTE.liver, { opacity: 0.35 }));
      g.add(hex);
      // Vena central.
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 16), holo(PALETTE.violet, { emissive: 0.7 })));
      // Tríadas portales en las esquinas: arteria, vena porta y conducto biliar.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const c = v(Math.cos(a), 0, Math.sin(a));
        [[PALETTE.coral, 0], [PALETTE.violet, 0.07], [PALETTE.lime, -0.07]].forEach(([color, off]) => {
          const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), holo(color as number, { emissive: 0.7 }));
          vessel.position.copy(c).add(v(-Math.sin(a) * (off as number), 0, Math.cos(a) * (off as number)));
          g.add(vessel);
        });
      }
      // Placas de hepatocitos: radios desde la vena central.
      const pts: number[] = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        for (let y = -0.2; y <= 0.2; y += 0.1) pts.push(Math.cos(a) * 0.12, y, Math.sin(a) * 0.12, Math.cos(a) * 0.9, y, Math.sin(a) * 0.9);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      plates = new THREE.LineSegments(geo, glowLine(PALETTE.amber));
      g.add(plates);
      g.rotation.x = 0.7;
      return g;
    },
    update(_dt, ctx) {
      (plates.material as THREE.LineBasicMaterial).opacity = 0.55 + Math.sin(ctx.time * 2) * 0.25;
    },
  };
}

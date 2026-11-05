/**
 * L1: a section of the small intestine wall, opened lengthwise. Layers from outside in: serosa,
 * longitudinal and circular muscle, submucosa with blood vessels, mucosa with circular folds
 * (plicae) carpeted with villi. Chyme with lactose flows through the lumen.
 */
import * as THREE from 'three';
import { PALETTE, holo } from '../materials.ts';
import type { HoloLabel } from '../label.ts';
import { materialPeristaltico, rng, tuboOrganico, type Peristalsis } from './geometria.ts';
import { rotulo, v3, type EstadoNivel, type Nivel } from './comun.ts';

const LARGO = 2.2;
const R_MUCOSA = 0.78;

/** Point on the back half wall (z <= 0 for a in [PI/2, 3PI/2]) at axial position x. */
function pared(x: number, r: number, a: number): THREE.Vector3 {
  return v3(x, r * Math.sin(a), r * Math.cos(a));
}

/** Half cylinder (the back half, z < 0) around the X axis. */
function mediaCapa(r: number, color: number, opacity: number, emissive = 0.35): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, LARGO, 72, 1, true, Math.PI / 2, Math.PI);
  geo.rotateZ(Math.PI / 2);
  const m = holo(color, { opacity, emissive });
  m.depthWrite = opacity >= 1;
  return new THREE.Mesh(geo, m);
}

export function construirNivel1(): Nivel {
  const g = new THREE.Group();
  const labels: HoloLabel[] = [];
  const azar = rng(11);
  const tiempo = { value: 0 };

  g.add(mediaCapa(1.0, PALETTE.pink, 0.22));
  g.add(mediaCapa(0.95, PALETTE.coral, 0.35, 0.4));
  g.add(mediaCapa(0.88, PALETTE.coral, 0.3, 0.3));
  g.add(mediaCapa(0.83, PALETTE.amber, 0.18));

  // Muscle fibres: longitudinal lines on the outer layer, circular rings on the inner one.
  const matFibra = new THREE.LineBasicMaterial({ color: PALETTE.coral, transparent: true, opacity: 0.6 });
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI / 2 + (i / 24) * Math.PI;
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pared(-LARGO / 2, 0.97, a), pared(LARGO / 2, 0.97, a)]), matFibra));
  }
  for (let i = 0; i < 22; i++) {
    const x = -LARGO / 2 + (i / 21) * LARGO;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 40; k++) pts.push(pared(x, 0.9, Math.PI / 2 + (k / 40) * Math.PI));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matFibra));
  }

  // Blood vessels in the submucosa: an artery (coral) and a vein (violet) running along the wall.
  const per: Peristalsis = { tiempo, onda: { value: -1 } };
  for (const [a, color] of [[Math.PI * 0.8, PALETTE.coral], [Math.PI * 1.2, PALETTE.violet]] as const) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 16; k++) pts.push(pared(-LARGO / 2 + (k / 16) * LARGO, 0.855, a + Math.sin(k * 0.9) * 0.05));
    g.add(new THREE.Mesh(tuboOrganico(new THREE.CatmullRomCurve3(pts), { radio: () => 0.025, segmentos: 80, radiales: 8 }), materialPeristaltico(color, per, { emissive: 0.7, fuerza: 0 })));
  }

  // Mucosa surface with the circular folds (plicae circulares).
  g.add(mediaCapa(R_MUCOSA, PALETTE.pink, 0.55, 0.45));
  const matPliegue = holo(PALETTE.pink, { emissive: 0.5, opacity: 0.9 });
  for (let i = 0; i < 7; i++) {
    const pliegue = new THREE.Mesh(new THREE.TorusGeometry(R_MUCOSA - 0.04, 0.05, 10, 64, Math.PI), matPliegue);
    pliegue.rotation.set(0, Math.PI / 2, -Math.PI / 2);
    pliegue.position.x = -LARGO / 2 + 0.16 + i * 0.31;
    g.add(pliegue);
  }

  // Villi: thousands of small fingers pointing to the lumen (one instanced draw call).
  const N = 2400;
  const vell = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.018, 0.075, 3, 6), holo(PALETTE.amber, { emissive: 0.55 }), N);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const up = v3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const a = Math.PI / 2 + 0.06 + azar() * (Math.PI - 0.12);
    const x = -LARGO / 2 + 0.04 + azar() * (LARGO - 0.08);
    const pliegue = Math.max(0, 1 - Math.abs(((x + LARGO / 2 - 0.16 + 0.155) % 0.31) - 0.155) / 0.05);
    const r = R_MUCOSA - 0.05 - pliegue * 0.05;
    p.copy(pared(x, r, a));
    const dir = v3(0, -p.y, -p.z).normalize();
    q.setFromUnitVectors(up, dir);
    const k = 0.8 + azar() * 0.5;
    m4.compose(p, q, v3(k, k, k));
    vell.setMatrixAt(i, m4);
  }
  g.add(vell);

  // Chyme in the lumen: lime dots = lactose travelling along the intestine.
  const NQ = 260;
  const qpos = new Float32Array(NQ * 3);
  const semillas = Array.from({ length: NQ }, () => ({ x: azar(), r: azar() * 0.55, a: azar() * Math.PI * 2, v: 0.6 + azar() * 0.8 }));
  const quimo = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(qpos, 3)),
    new THREE.PointsMaterial({ color: PALETTE.lime, size: 0.035, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  quimo.frustumCulled = false;
  g.add(quimo);

  const R = (t: string, en: THREE.Vector3, ancla: THREE.Vector3, color: string, sub?: string) => {
    const r = rotulo(t, color, en, ancla, 0.75, sub);
    labels.push(r.label);
    g.add(r.grupo);
  };
  R('Vellosidades', v3(-0.55, 1.15, 0.2), v3(-0.3, 0.3, -0.62), '#FFC14D', 'miles por cm²');
  R('Pliegue circular', v3(0.75, 1.15, 0.2), v3(0.47, 0.6, -0.3), '#FF6FB5');
  R('Capa muscular', v3(-0.85, -1.15, 0.2), v3(-0.6, -0.55, -0.7), '#FF7A6B', 'mueve el alimento');
  R('Vasos sanguíneos', v3(0.8, -1.15, 0.2), v3(0.4, -0.45, -0.72), '#B48CFF');

  return {
    grupo: g,
    foco: v3(0.05, -0.05, -0.6),
    update(e: EstadoNivel) {
      tiempo.value = e.t;
      const pos = quimo.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < NQ; i++) {
        const s = semillas[i];
        if (e.running) s.x = (s.x + e.dt * 0.06 * s.v * e.velocidad) % 1;
        const a = s.a + e.t * 0.3;
        pos.setXYZ(i, -LARGO / 2 + s.x * LARGO, Math.cos(a) * s.r, Math.sin(a) * s.r * 0.6 - 0.15);
      }
      pos.needsUpdate = true;
      // With lactase the lime lactose fades along the intestine (it is split near the wall).
      (quimo.material as THREE.PointsMaterial).opacity = e.conLactasa ? 0.65 : 0.95;
    },
    dispose() {
      labels.forEach((l) => l.dispose());
    },
  };
}

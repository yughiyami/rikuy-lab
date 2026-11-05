/**
 * L2: villi up close. Each villus has a capillary network (artery coral, vein violet) around a
 * central lacteal. In front, a magnified strip of enterocytes shows the brush border
 * (microvilli) where lactase sits; lactose (lime) is split there and glucose + galactose (pink,
 * amber) enter the cell and the blood. Without lactase, lactose drifts past untouched.
 */
import * as THREE from 'three';
import { PALETTE, halo, holo } from '../materials.ts';
import type { HoloLabel } from '../label.ts';
import { organoBlando, rng, tuboOrganico } from './geometria.ts';
import { rotulo, v3, type EstadoNivel, type Nivel } from './comun.ts';

function vellosidad(x: number, z: number, alto: number, azar: () => number): THREE.Group {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(
    organoBlando([0.17, alto / 2, 0.15], (v) => {
      v.y += alto / 2;
      const k = 1 - Math.max(0, (v.y - alto * 0.7) / (alto * 0.6));
      v.x *= 0.85 + 0.15 * k;
      v.z *= 0.85 + 0.15 * k;
    }, 28),
    holo(PALETTE.pink, { opacity: 0.32, emissive: 0.35 }),
  );
  (cuerpo.material as THREE.MeshStandardMaterial).depthWrite = false;
  g.add(cuerpo);
  // Central lacteal (lymph).
  g.add(new THREE.Mesh(tuboOrganico(new THREE.CatmullRomCurve3([v3(0, 0, 0), v3(0.01, alto * 0.5, 0), v3(0, alto * 0.85, 0)]), { radio: () => 0.025, segmentos: 24, radiales: 8, tapas: true }), holo(PALETTE.white, { emissive: 0.6, opacity: 0.85 })));
  // Capillary network: a rising arteriole and a descending venule spiralling around the lacteal.
  for (const [fase, color] of [[0, PALETTE.coral], [Math.PI, PALETTE.violet]] as const) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      const a = fase + t * Math.PI * 5 + azar() * 0.2;
      pts.push(v3(Math.cos(a) * 0.105, t * alto * 0.9, Math.sin(a) * 0.095));
    }
    g.add(new THREE.Mesh(tuboOrganico(new THREE.CatmullRomCurve3(pts), { radio: () => 0.011, segmentos: 120, radiales: 5 }), holo(color, { emissive: 0.9 })));
  }
  g.position.set(x, -0.95, z);
  return g;
}

export function construirNivel2(): Nivel {
  const g = new THREE.Group();
  const labels: HoloLabel[] = [];
  const azar = rng(23);

  // Mucosa floor.
  const base = new THREE.Mesh(organoBlando([1.25, 0.08, 0.55], () => {}, 40), holo(PALETTE.pink, { opacity: 0.5, emissive: 0.35 }));
  base.position.set(0, -0.98, -0.25);
  g.add(base);
  const posiciones: [number, number, number][] = [[-0.95, -0.55, 1.15], [-0.55, -0.35, 1.3], [-0.15, -0.6, 1.2], [0.25, -0.4, 1.35], [0.65, -0.55, 1.2], [1.0, -0.3, 1.1], [-0.8, 0.05, 1.0], [0.85, 0.1, 1.0]];
  for (const [x, z, h] of posiciones) g.add(vellosidad(x, z, h, azar));

  // Magnified strip of enterocytes (the "lens"): 5 columnar cells with their brush border.
  const tira = new THREE.Group();
  const celdas = 5;
  const ancho = 0.3;
  const matCel = holo(PALETTE.cyan, { opacity: 0.28, emissive: 0.4 });
  matCel.depthWrite = false;
  const matNuc = holo(PALETTE.violet, { emissive: 0.6 });
  for (let i = 0; i < celdas; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(ancho * 0.96, 0.55, 0.3, 1, 1, 1), matCel);
    c.position.set((i - (celdas - 1) / 2) * ancho, 0, 0);
    tira.add(c);
    const nucleo = new THREE.Mesh(organoBlando([0.07, 0.11, 0.07], () => {}, 16), matNuc);
    nucleo.position.set(c.position.x, -0.12, 0);
    tira.add(nucleo);
  }
  // Microvilli: ~1000 finger-like projections (instanced) on top of the cells.
  const NM = 25 * 8 * celdas;
  const micro = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.0085, 0.07, 2, 6), holo(PALETTE.amber, { emissive: 0.6 }), NM);
  const NL = 220;
  const lactasas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 8, 6), holo(PALETTE.lime, { emissive: 1.2 }), NL);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  let k = 0;
  let l = 0;
  const puntas: THREE.Vector3[] = [];
  for (let i = 0; i < celdas; i++) {
    for (let a = 0; a < 25; a++) {
      for (let b = 0; b < 8; b++) {
        const x = (i - (celdas - 1) / 2) * ancho - ancho * 0.45 + (a / 24) * ancho * 0.9;
        const z = -0.12 + (b / 7) * 0.24;
        const h = 0.9 + azar() * 0.25;
        p.set(x, 0.275 + 0.045 * h, z);
        m4.compose(p, q.identity(), v3(1, h, 1));
        micro.setMatrixAt(k++, m4);
        if ((a + b * 3) % 4 === 0 && l < NL) {
          p.set(x + 0.01, 0.275 + 0.03 + azar() * 0.05, z);
          puntas.push(p.clone());
          m4.compose(p, q, v3(1, 1, 1));
          lactasas.setMatrixAt(l++, m4);
        }
      }
    }
  }
  lactasas.count = l;
  tira.add(micro, lactasas);
  tira.position.set(0, 0.62, 0.55);
  tira.rotation.x = 0.35;
  g.add(tira);
  // A lens frame links the strip to the villus it magnifies.
  const lupa = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(celdas * ancho + 0.08, 0.85, 0.4)),
    new THREE.LineBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.5 }),
  );
  lupa.position.copy(tira.position).add(v3(0, 0.12, 0));
  lupa.rotation.copy(tira.rotation);
  g.add(lupa);
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(-0.15, 0.3, 0.45), v3(-0.2, 0.2, -0.3)]), new THREE.LineBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.4 })));

  // Sugars above the brush border: lactose (lime pairs) -> glucose (pink) + galactose (amber).
  const NS = 24;
  const geoS = new THREE.SphereGeometry(0.022, 10, 8);
  const mLac = holo(PALETTE.lime, { emissive: 1 });
  const mGlu = holo(PALETTE.pink, { emissive: 1 });
  const mGal = holo(PALETTE.amber, { emissive: 1 });
  const azucares = Array.from({ length: NS }, (_, i) => {
    const a = new THREE.Mesh(geoS, mLac);
    const b = new THREE.Mesh(geoS, mLac);
    tira.add(a, b);
    return { a, b, x: -0.75 + azar() * 1.5, z: -0.12 + azar() * 0.24, fase: i / NS, objetivo: puntas[Math.floor(azar() * puntas.length)] ?? v3(0, 0.3, 0) };
  });
  const brillo = halo(PALETTE.lime, 0.45, 0.5);
  brillo.position.set(0, 0.36, 0);
  tira.add(brillo);

  const R = (t: string, en: THREE.Vector3, ancla: THREE.Vector3, color: string, sub?: string) => {
    const r = rotulo(t, color, en, ancla, 0.8, sub);
    labels.push(r.label);
    g.add(r.grupo);
  };
  R('Microvellosidades', v3(-0.95, 1.35, 0.4), v3(-0.5, 0.95, 0.6), '#FFC14D', 'borde en cepillo');
  R('Lactasa', v3(0.95, 1.35, 0.4), v3(0.4, 0.95, 0.6), '#C6FF5C', 'en la membrana');
  R('Capilares', v3(-1.05, -0.2, 0.3), v3(-0.62, -0.45, -0.3), '#FF7A6B', 'llevan azúcares a la sangre');
  R('Vaso quilífero', v3(1.05, -0.2, 0.3), v3(0.26, -0.3, -0.4), '#F4FBFF');

  return {
    grupo: g,
    foco: v3(0.1, 0.95, 0.65),
    update(e: EstadoNivel) {
      lactasas.visible = e.conLactasa;
      brillo.visible = e.conLactasa;
      const parte = e.conLactasa && e.actividad > 0.25;
      for (const s of azucares) {
        const c = (s.fase + e.t * 0.12 * e.velocidad) % 1;
        if (parte) {
          // Fall onto the brush border, split, then both sugars sink into the cell.
          const caer = Math.min(1, c / 0.45);
          const top = v3(s.x, 0.75, s.z);
          const pos = top.lerp(s.objetivo, caer);
          if (c < 0.5) {
            s.a.material = mLac;
            s.b.material = mLac;
            s.a.position.copy(pos).add(v3(-0.021, 0, 0));
            s.b.position.copy(pos).add(v3(0.021, 0, 0));
          } else {
            const d = (c - 0.5) / 0.5;
            s.a.material = mGlu;
            s.b.material = mGal;
            s.a.position.copy(s.objetivo).add(v3(-0.03 - d * 0.04, -d * 0.45, 0.02));
            s.b.position.copy(s.objetivo).add(v3(0.03 + d * 0.04, -d * 0.45, -0.02));
          }
        } else {
          // No lactase: lactose stays whole and drifts along, out toward the large intestine.
          const x = -0.8 + ((s.x + 0.8 + e.t * 0.08 * e.velocidad) % 1.6);
          s.a.material = mLac;
          s.b.material = mLac;
          s.a.position.set(x - 0.021, 0.45 + Math.sin(e.t + s.fase * 9) * 0.06, s.z);
          s.b.position.set(x + 0.021, s.a.position.y, s.z);
        }
      }
    },
    dispose() {
      labels.forEach((x) => x.dispose());
    },
  };
}

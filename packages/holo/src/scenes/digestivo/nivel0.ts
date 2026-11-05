/**
 * L0: the whole digestive tract inside a translucent body silhouette. Anatomically proportioned
 * (front view: the liver on the person's right = viewer's left, the stomach on the left), organic
 * tubes along smooth curves, peristalsis waves and a glass of milk (bolus) travelling the tract.
 */
import * as THREE from 'three';
import { PALETTE, halo, holo } from '../materials.ts';
import type { HoloLabel } from '../label.ts';
import { faseLactosa, TRAMOS, type Organo } from './modelo.ts';
import { materialPeristaltico, organoBlando, rng, tuboOrganico, type Peristalsis } from './geometria.ts';
import { rotulo, v3, type EstadoNivel, type Nivel } from './comun.ts';

const curva = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, 'centripetal');

function silueta(): THREE.Group {
  const g = new THREE.Group();
  const perfil = [
    [0.001, -1.2], [0.2, -1.17], [0.4, -1.08], [0.5, -0.82], [0.49, -0.5], [0.41, -0.1], [0.43, 0.25], [0.48, 0.6],
    [0.55, 0.86], [0.5, 0.98], [0.3, 1.06], [0.15, 1.1], [0.13, 1.22], [0.001, 1.25],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.LatheGeometry(perfil, 48);
  torso.scale(1, 1, 0.55);
  const mat = holo(PALETTE.cyan, { opacity: 0.07, emissive: 0.25 });
  mat.depthWrite = false;
  const cuerpo = new THREE.Mesh(torso, mat);
  cuerpo.renderOrder = -1;
  const cabeza = new THREE.Mesh(organoBlando([0.24, 0.3, 0.27], () => {}, 32), mat);
  cabeza.position.set(0, 1.52, 0.02);
  g.add(cuerpo, cabeza);
  // Contour rings make the volume readable from all four pyramid sides.
  for (const y of [-0.8, -0.3, 0.2, 0.7]) {
    const r = y < -0.5 ? 0.49 : y < 0 ? 0.42 : y < 0.5 ? 0.45 : 0.52;
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(r, 0.003, 4, 72), new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.35 }));
    anillo.rotation.x = Math.PI / 2;
    anillo.scale.set(1, 0.55, 1);
    anillo.position.y = y;
    g.add(anillo);
  }
  return g;
}

interface Tramo {
  curva: THREE.CatmullRomCurve3;
  per: Peristalsis;
  /** Journey range covered by this tube and the matching range of its curve. */
  desde: number;
  hasta: number;
}

export function construirNivel0(): Nivel {
  const g = new THREE.Group();
  const tardio = new THREE.Group();
  const tiempo = { value: 0 };
  const labels: HoloLabel[] = [];
  const marcas = new Map<string, THREE.MeshStandardMaterial[]>();
  const nuevaPer = (): Peristalsis => ({ tiempo, onda: { value: -1 } });

  g.add(silueta());

  // Mouth, pharynx and esophagus: one tube down the midline, behind the trachea.
  const esofagoCurva = curva([v3(0, 1.39, 0.2), v3(0, 1.33, 0.08), v3(0, 1.2, -0.02), v3(0, 1.0, -0.06), v3(0.02, 0.75, -0.06), v3(0.05, 0.52, -0.03), v3(0.11, 0.4, 0)]);
  const perEso = nuevaPer();
  const matEso = materialPeristaltico(PALETTE.pink, perEso, { emissive: 0.45, fuerza: 0.35 });
  g.add(new THREE.Mesh(tuboOrganico(esofagoCurva, { radio: (s) => (s < 0.15 ? 0.05 : 0.028), segmentos: 120, radiales: 12, ruido: 0.1 }), matEso));

  // Stomach: J shape, wide fundus and body, narrow antrum and pylorus.
  const estCurva = curva([v3(0.11, 0.4, 0), v3(0.24, 0.47, 0), v3(0.34, 0.36, 0.02), v3(0.35, 0.18, 0.04), v3(0.27, 0.04, 0.06), v3(0.12, 0.0, 0.07), v3(0.0, 0.05, 0.06), v3(-0.07, 0.11, 0.05)]);
  const perEst = nuevaPer();
  const matEst = materialPeristaltico(PALETTE.coral, perEst, { emissive: 0.4, opacity: 0.88, fuerza: 0.18 });
  const radioEst = (s: number) => 0.035 + 0.13 * Math.sin(Math.min(1, s * 1.15) * Math.PI) ** 0.8 * (1 - 0.55 * s);
  g.add(new THREE.Mesh(tuboOrganico(estCurva, { radio: radioEst, segmentos: 160, radiales: 28, ruido: 0.07, tapas: false }), matEst));

  // Liver: large wedge on the person's right, thinning toward the left lobe.
  const matHig = holo(PALETTE.liver, { emissive: 0.35, opacity: 0.8 });
  const higado = new THREE.Mesh(
    organoBlando([0.4, 0.2, 0.22], (v) => {
      const k = THREE.MathUtils.smoothstep(v.x, -0.35, 0.4);
      v.y *= 1.25 - 0.7 * k;
      v.z *= 1.15 - 0.45 * k;
      if (v.y < 0) v.y *= 0.7; // flatter visceral face
      v.y += 0.06 * (1 - k);
    }),
    matHig,
  );
  higado.position.set(-0.17, 0.5, 0.03);
  higado.rotation.z = -0.12;
  g.add(higado);
  const vesicula = new THREE.Mesh(organoBlando([0.045, 0.075, 0.04], () => {}, 16), holo(PALETTE.lime, { emissive: 0.5 }));
  vesicula.position.set(-0.13, 0.33, 0.14);
  vesicula.rotation.z = 0.5;
  g.add(vesicula);

  // Pancreas: lobulated, from the head in the duodenal C to the tail behind the stomach.
  const panCurva = curva([v3(-0.1, -0.02, -0.04), v3(0.02, 0.06, -0.08), v3(0.18, 0.12, -0.1), v3(0.33, 0.18, -0.08)]);
  const matPan = holo(PALETTE.amber, { emissive: 0.45 });
  g.add(new THREE.Mesh(tuboOrganico(panCurva, { radio: (s) => 0.055 - 0.03 * s, segmentos: 60, radiales: 12, ruido: 0.35 }), matPan));

  // Small intestine: duodenal C around the pancreatic head, then jejunum and ileum coiled in the
  // centre of the abdomen, ending at the ileocecal valve (lower right).
  const azar = rng(7);
  const pts = [v3(-0.07, 0.11, 0.05), v3(-0.16, 0.06, 0.03), v3(-0.19, -0.07, 0.01), v3(-0.1, -0.15, 0.0), v3(0.05, -0.13, -0.01), v3(0.13, -0.09, 0.02)];
  const filas = 7;
  for (let f = 0; f < filas; f++) {
    const y0 = -0.17 - f * 0.065;
    const dir = f % 2 === 0 ? -1 : 1;
    for (let k = 0; k <= 7; k++) {
      const x = dir * (0.24 - (k / 7) * 0.48) + (azar() - 0.5) * 0.05;
      const y = y0 + Math.sin(k * 2.1 + f * 1.7) * 0.035;
      const z = 0.05 + Math.sin(k * 1.3 + f) * 0.09;
      pts.push(v3(x, y, z));
    }
  }
  pts.push(v3(-0.26, -0.56, 0.05), v3(-0.34, -0.52, 0.06));
  const delgadoCurva = curva(pts);
  const perDel = nuevaPer();
  const matDel = materialPeristaltico(PALETTE.amber, perDel, { emissive: 0.5, fuerza: 0.4 });
  const delgado = new THREE.Mesh(tuboOrganico(delgadoCurva, { radio: () => 0.03, segmentos: 1100, radiales: 9, ruido: 0.1 }), matDel);
  g.add(delgado);
  marcas.set('intestino_delgado', [matDel]);

  // Large intestine: cecum, ascending, sagging transverse, descending, sigmoid and rectum,
  // with haustra (the pouches) modulating the radius.
  const gruesoCurva = curva([
    v3(-0.34, -0.52, 0.06), v3(-0.39, -0.4, 0.05), v3(-0.4, -0.1, 0.04), v3(-0.36, 0.12, 0.06), v3(-0.18, 0.02, 0.15), v3(0.05, -0.04, 0.17),
    v3(0.25, 0.05, 0.13), v3(0.41, 0.2, 0.04), v3(0.43, -0.1, 0.0), v3(0.41, -0.42, 0.02), v3(0.3, -0.62, 0.06), v3(0.12, -0.64, 0.02),
    v3(0.03, -0.75, -0.04), v3(0.0, -0.98, -0.05),
  ]);
  const perGru = nuevaPer();
  const matGru = materialPeristaltico(PALETTE.violet, perGru, { emissive: 0.45, opacity: 0.82, fuerza: 0.15 });
  const radioGru = (s: number) => (s < 0.06 ? 0.065 + 0.03 * (1 - s / 0.06) : 0.058) * (1 + 0.22 * Math.sin(s * Math.PI * 44) ** 2) * (s > 0.9 ? 0.75 : 1);
  g.add(new THREE.Mesh(tuboOrganico(gruesoCurva, { radio: radioGru, segmentos: 420, radiales: 16, ruido: 0.06 }), matGru));
  marcas.set('intestino_grueso', [matGru]);
  marcas.set('estomago', [matEst]);
  marcas.set('esofago', [matEso]);
  marcas.set('higado', [matHig]);
  marcas.set('pancreas', [matPan]);

  const tramos: Tramo[] = [
    { curva: esofagoCurva, per: perEso, desde: TRAMOS[0].desde, hasta: TRAMOS[1].hasta },
    { curva: estCurva, per: perEst, desde: TRAMOS[2].desde, hasta: TRAMOS[2].hasta },
    { curva: delgadoCurva, per: perDel, desde: TRAMOS[3].desde, hasta: TRAMOS[3].hasta },
    { curva: gruesoCurva, per: perGru, desde: TRAMOS[4].desde, hasta: TRAMOS[4].hasta },
  ];

  // The bolus (a sip of milk): lime = lactose; it turns pink as glucose and galactose are absorbed.
  const bolo = new THREE.Group();
  const matBolo = holo(PALETTE.lime, { emissive: 1.1 });
  bolo.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), matBolo));
  const haloBolo = halo(PALETTE.lime, 0.32, 0.9);
  bolo.add(haloBolo);
  g.add(bolo);

  // Gas bubbles and bacteria in the large intestine (only seen when lactose is fermented).
  const N_BURBUJAS = 70;
  const burbujas = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), holo(PALETTE.white, { emissive: 0.7, opacity: 0.55 }), N_BURBUJAS);
  const semillas = Array.from({ length: N_BURBUJAS }, () => ({ s: 0.74 + azar() * 0.26, fase: azar(), r: 0.008 + azar() * 0.018, a: azar() * Math.PI * 2 }));
  const cero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < N_BURBUJAS; i++) burbujas.setMatrixAt(i, cero);
  burbujas.visible = false;
  burbujas.frustumCulled = false;
  g.add(burbujas);
  const N_BACT = 90;
  const bacterias = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.006, 0.018, 2, 6), holo(PALETTE.teal, { emissive: 0.8 }), N_BACT);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  for (let i = 0; i < N_BACT; i++) {
    gruesoCurva.getPointAt(0.03 + (i / N_BACT) * 0.85, p);
    tmp.set(azar() - 0.5, azar() - 0.5, azar() - 0.5).normalize();
    p.addScaledVector(tmp, 0.045);
    q.setFromUnitVectors(v3(0, 1, 0), tmp);
    m4.compose(p, q, v3(1, 1, 1));
    bacterias.setMatrixAt(i, m4);
  }
  g.add(bacterias);

  // Hotspots: organ labels at the edge, leader lines to the organ.
  const R = (texto: string, en: THREE.Vector3, ancla: THREE.Vector3, color: string) => {
    const r = rotulo(texto, color, en, ancla, 0.95);
    labels.push(r.label);
    tardio.add(r.grupo);
  };
  R('Boca', v3(-0.5, 1.4, 0.2), v3(0, 1.38, 0.2), '#FF6FB5');
  R('Esófago', v3(0.5, 0.95, 0), v3(0.0, 0.95, -0.06), '#FF6FB5');
  R('Hígado', v3(-0.72, 0.62, 0.1), v3(-0.3, 0.52, 0.1), '#FF8A5C');
  R('Estómago', v3(0.75, 0.42, 0.1), v3(0.33, 0.3, 0.08), '#FF7A6B');
  R('Páncreas', v3(0.75, 0.08, -0.05), v3(0.26, 0.15, -0.09), '#FFC14D');
  R('Intestino delgado', v3(-0.72, -0.28, 0.15), v3(-0.12, -0.3, 0.1), '#C6FF5C');
  R('Intestino grueso', v3(0.74, -0.5, 0.1), v3(0.41, -0.35, 0.03), '#B48CFF');

  let s = 0;
  let ultimaLiberacion = -1;
  let resaltado: Organo | 'higado' | 'pancreas' | null = null;

  return {
    grupo: g,
    tardio,
    foco: v3(-0.02, -0.33, 0.1),
    update(e: EstadoNivel) {
      tiempo.value = e.t;
      if (e.liberaciones !== ultimaLiberacion) {
        ultimaLiberacion = e.liberaciones;
        s = 0;
      }
      if (e.running) s += e.dt * 0.045 * e.velocidad;
      if (s > 1.08) s = 0; // a short pause after the rectum, then a new sip
      const sj = Math.min(1, s);
      const fase = faseLactosa(sj, e.conLactasa);
      for (const tr of tramos) {
        const dentro = sj >= tr.desde && sj <= tr.hasta;
        const local = (sj - tr.desde) / (tr.hasta - tr.desde);
        tr.per.onda.value = dentro ? local : -1;
        if (dentro) tr.curva.getPointAt(Math.min(1, Math.max(0, local)), bolo.position);
      }
      bolo.visible = s <= 1;
      const c = new THREE.Color(PALETTE.lime).lerp(new THREE.Color(PALETTE.pink), fase.absorbido);
      matBolo.color.copy(c);
      matBolo.emissive.copy(c);
      (haloBolo.material as THREE.SpriteMaterial).color.copy(c);
      bolo.scale.setScalar(0.6 + 0.4 * Math.max(fase.lactosa, 1 - fase.absorbido * 0.6));

      // Fermentation: bubbles grow and rise along the colon; bacteria glow while they feed.
      const gas = fase.gas;
      burbujas.visible = gas > 0.01;
      bacterias.visible = !e.conLactasa || sj < TRAMOS[4].desde;
      (bacterias.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + 1.5 * gas;
      if (burbujas.visible) {
        for (let i = 0; i < N_BURBUJAS; i++) {
          const b = semillas[i];
          const ciclo = (b.fase + e.t * 0.25) % 1;
          gruesoCurva.getPointAt(Math.min(1, (b.s - 0.72) / 0.28), p);
          p.x += Math.cos(b.a) * 0.05;
          p.z += Math.sin(b.a) * 0.05;
          p.y += ciclo * 0.12;
          const r = b.r * gas * (0.5 + ciclo);
          m4.compose(p, q.identity(), tmp.set(r, r, r));
          burbujas.setMatrixAt(i, m4);
        }
        burbujas.instanceMatrix.needsUpdate = true;
      }
      if (resaltado) {
        const k = 0.6 + (Math.sin(e.t * 6) * 0.5 + 0.5) * 1.2;
        for (const m of marcas.get(resaltado) ?? []) m.emissiveIntensity = k;
      }
    },
    resaltar(parte: string) {
      const clave = /delgado/.test(parte) ? 'intestino_delgado' : /grueso|colon/.test(parte) ? 'intestino_grueso' : /est[oó]mago/.test(parte) ? 'estomago' : /es[oó]fago/.test(parte) ? 'esofago' : /h[ií]gado/.test(parte) ? 'higado' : /p[aá]ncreas/.test(parte) ? 'pancreas' : null;
      for (const mats of marcas.values()) for (const m of mats) m.emissiveIntensity = 0.45;
      resaltado = clave;
      return clave !== null;
    },
    dispose() {
      labels.forEach((l) => l.dispose());
    },
  };
}

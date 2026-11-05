/**
 * L3: molecular level. A real protein backbone (C-alpha trace of PDB 1JZ7, E. coli
 * beta-galactosidase, the bacterial analog of human lactase: same reaction) on a membrane patch.
 * Lactose, glucose and galactose are ball-and-stick models from PubChem 3D coordinates.
 * With lactase, lactose docks at the real active site (where 1JZ7 has galactose bound), the
 * beta(1->4) bond breaks and both sugars cross the membrane through a transporter.
 */
import * as THREE from 'three';
import { PALETTE, halo, holo } from '../materials.ts';
import type { HoloLabel } from '../label.ts';
import { GALACTOSA, GLUCOSA, LACTOSA, PROTEINA_CA, SITIO_ACTIVO, type Molecula } from './estructuras.ts';
import { suavizar } from './modelo.ts';
import { rotulo, v3, type EstadoNivel, type Nivel } from './comun.ts';

/** Angstrom -> scene units for the protein. */
const ESCALA = 1 / 38;
/** Sugars are drawn 2.2x larger than true scale so the atoms can be seen. */
const ESCALA_AZUCAR = ESCALA * 2.2;
const MEMBRANA_Y = -1.05;

function puntosProteina(): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < PROTEINA_CA.length; i += 3) pts.push(v3(PROTEINA_CA[i], PROTEINA_CA[i + 1], PROTEINA_CA[i + 2]).multiplyScalar(ESCALA));
  return pts;
}

const GRADIENTE = [PALETTE.cyan, PALETTE.teal, PALETTE.violet, PALETTE.pink];
function colorEn(t: number, out: THREE.Color): THREE.Color {
  const x = Math.min(0.999, Math.max(0, t)) * (GRADIENTE.length - 1);
  const i = Math.floor(x);
  return out.setHex(GRADIENTE[i]).lerp(new THREE.Color(GRADIENTE[i + 1]), x - i);
}

/** Ball-and-stick molecule: carbon white-cyan, oxygen coral, sticks thin. */
function molecula(m: Molecula, escala: number): THREE.Group {
  const g = new THREE.Group();
  const pos: THREE.Vector3[] = [];
  for (let i = 0; i < m.elementos.length; i++) pos.push(v3(m.xyz[i * 3], m.xyz[i * 3 + 1], m.xyz[i * 3 + 2]).multiplyScalar(escala));
  const geoA = new THREE.SphereGeometry(1, 12, 10);
  const mC = holo(PALETTE.white, { emissive: 0.7 });
  const mO = holo(PALETTE.coral, { emissive: 0.9 });
  const nC = [...m.elementos].filter((e) => e === 'C').length;
  const atC = new THREE.InstancedMesh(geoA, mC, nC);
  const atO = new THREE.InstancedMesh(geoA, mO, m.elementos.length - nC);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let c = 0;
  let o = 0;
  pos.forEach((p, i) => {
    const r = (m.elementos[i] === 'O' ? 0.55 : 0.5) * escala;
    m4.compose(p, q, v3(r, r, r));
    if (m.elementos[i] === 'C') atC.setMatrixAt(c++, m4);
    else atO.setMatrixAt(o++, m4);
  });
  const enlaces = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), holo(PALETTE.cyan, { emissive: 0.6 }), m.enlaces.length / 2);
  const up = v3(0, 1, 0);
  for (let i = 0; i < m.enlaces.length; i += 2) {
    const a = pos[m.enlaces[i]];
    const b = pos[m.enlaces[i + 1]];
    const d = b.clone().sub(a);
    q.setFromUnitVectors(up, d.clone().normalize());
    m4.compose(a.clone().add(b).multiplyScalar(0.5), q, v3(0.13 * escala, d.length(), 0.13 * escala));
    enlaces.setMatrixAt(i / 2, m4);
  }
  g.add(atC, atO, enlaces);
  return g;
}

export function construirNivel3(): Nivel {
  const g = new THREE.Group();
  const labels: HoloLabel[] = [];
  const proteina = new THREE.Group();

  // Orient the protein so the active site faces up and toward the viewer.
  const sitio = v3(SITIO_ACTIVO[0], SITIO_ACTIVO[1], SITIO_ACTIVO[2]).multiplyScalar(ESCALA);
  const giro = new THREE.Quaternion().setFromUnitVectors(sitio.clone().normalize(), v3(0.25, 0.75, 0.6).normalize());
  const pts = puntosProteina().map((p) => p.applyQuaternion(giro));
  sitio.applyQuaternion(giro);
  const minY = pts.reduce((m, p) => Math.min(m, p.y), Infinity);
  const subir = MEMBRANA_Y + 0.12 - minY;
  pts.forEach((p) => (p.y += subir));
  sitio.y += subir;

  // Backbone ribbon (tube along the C-alpha trace) with a rainbow from N to C terminus.
  const curva = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const radial = 5;
  const segs = pts.length * 3;
  const tubo = new THREE.TubeGeometry(curva, segs, 0.014, radial, false);
  const colores = new Float32Array(tubo.attributes.position.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < tubo.attributes.position.count; i++) {
    colorEn(Math.floor(i / (radial + 1)) / segs, c);
    colores.set([c.r, c.g, c.b], i * 3);
  }
  tubo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  const matCinta = holo(0xffffff, { emissive: 0.25 });
  matCinta.vertexColors = true;
  matCinta.emissive.setHex(0x335566);
  proteina.add(new THREE.Mesh(tubo, matCinta));
  // C-alpha atoms as instanced spheres (one draw call for ~1000 residues).
  const matAt = holo(0xffffff, { emissive: 0.6, opacity: 0.6 });
  matAt.emissive.setHex(0x2a4a5a);
  const atomos = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), matAt, pts.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  pts.forEach((p, i) => {
    m4.compose(p, q, v3(0.02, 0.02, 0.02));
    atomos.setMatrixAt(i, m4);
    atomos.setColorAt(i, colorEn(i / pts.length, c));
  });
  proteina.add(atomos);
  // Ghost envelope: what is left when there is no lactase (intolerance).
  const sombra = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(pts.filter((_, i) => i % 2 === 0)),
    new THREE.PointsMaterial({ color: PALETTE.cyan, size: 0.02, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  sombra.visible = false;
  g.add(proteina, sombra);

  const marcaSitio = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), holo(PALETTE.lime, { emissive: 1, opacity: 0.4 }));
  marcaSitio.position.copy(sitio);
  const haloSitio = halo(PALETTE.lime, 0.5, 0.7);
  haloSitio.position.copy(sitio);
  g.add(marcaSitio, haloSitio);

  // Membrane patch (lipid bilayer): two leaflets of instanced heads with short tails.
  const NX = 34;
  const NZ = 18;
  const cabezas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 8, 6), holo(PALETTE.amber, { emissive: 0.45 }), NX * NZ * 2);
  const colas = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 4), holo(PALETTE.amber, { emissive: 0.25, opacity: 0.6 }), NX * NZ * 2);
  let k = 0;
  for (const capa of [1, -1]) {
    for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NZ; j++) {
        const x = -1.25 + (i / (NX - 1)) * 2.5;
        const z = -0.7 + (j / (NZ - 1)) * 1.4;
        const ond = Math.sin(x * 3 + z * 2) * 0.015;
        m4.makeTranslation(x, MEMBRANA_Y + capa * 0.11 + ond, z);
        cabezas.setMatrixAt(k, m4);
        m4.makeTranslation(x, MEMBRANA_Y + capa * 0.05 + ond, z);
        colas.setMatrixAt(k, m4);
        k++;
      }
    }
  }
  g.add(cabezas, colas);
  // Sugar transporter (SGLT1-like channel) through the membrane, near the enzyme.
  const transportador = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.34, 16, 1, true), holo(PALETTE.violet, { emissive: 0.7, opacity: 0.7 }));
  const poro = v3(sitio.x + 0.55, MEMBRANA_Y, sitio.z + 0.1);
  transportador.position.copy(poro);
  g.add(transportador);

  const lactosa = molecula(LACTOSA, ESCALA_AZUCAR);
  const glucosa = molecula(GLUCOSA, ESCALA_AZUCAR);
  const galactosa = molecula(GALACTOSA, ESCALA_AZUCAR);
  g.add(lactosa, glucosa, galactosa);
  const haloLac = halo(PALETTE.lime, 0.5, 0.55);
  lactosa.add(haloLac);

  const R = (t: string, en: THREE.Vector3, ancla: THREE.Vector3, color: string, sub?: string) => {
    const r = rotulo(t, color, en, ancla, 0.85, sub);
    labels.push(r.label);
    g.add(r.grupo);
    return r;
  };
  R('Lactasa', v3(-1.0, 1.25, 0.3), v3(-0.35, 0.4, 0.2), '#5FE3FF', 'β-galactosidasa · PDB 1JZ7');
  R('Sitio activo', v3(1.0, 1.3, 0.3), sitio.clone(), '#C6FF5C');
  R('Membrana', v3(-1.1, -1.4, 0.3), v3(-0.8, MEMBRANA_Y + 0.1, 0.4), '#FFC14D', 'microvellosidad');
  const rotuloAzucar = R('Lactosa', v3(1.05, -0.2, 0.3), v3(0.6, 0.3, 0.3), '#C6FF5C');

  const inicio = sitio.clone().add(v3(0.9, 0.9, 0.5));
  const fuera = v3(1.6, sitio.y + 0.3, sitio.z);
  let ciclo = 0;
  let ultimaLiberacion = -1;

  return {
    grupo: g,
    foco: sitio.clone(),
    update(e: EstadoNivel) {
      if (e.liberaciones !== ultimaLiberacion) {
        ultimaLiberacion = e.liberaciones;
        ciclo = 0;
      }
      const activa = e.conLactasa && e.actividad > 0.25;
      proteina.visible = e.conLactasa;
      sombra.visible = !e.conLactasa;
      marcaSitio.visible = e.conLactasa;
      haloSitio.visible = e.conLactasa;
      (marcaSitio.material as THREE.MeshStandardMaterial).opacity = 0.2 + 0.4 * e.actividad;
      if (e.running) ciclo = (ciclo + e.dt * 0.55 * e.velocidad) % 6;
      lactosa.rotation.set(e.t * 0.5, e.t * 0.7, 0);
      glucosa.rotation.set(e.t * 0.4, -e.t * 0.6, 0);
      galactosa.rotation.set(-e.t * 0.5, e.t * 0.5, 0);
      if (activa) {
        // 0-2 approach, 2-3 bound (bond glows), 3-4.2 split, 4.2-6 cross the membrane.
        const llegar = suavizar(ciclo / 2);
        const romper = ciclo >= 3;
        lactosa.visible = !romper;
        glucosa.visible = romper;
        galactosa.visible = romper;
        lactosa.position.lerpVectors(inicio, sitio, llegar);
        haloLac.visible = ciclo > 2 && ciclo < 3;
        if (romper) {
          const sep = suavizar((ciclo - 3) / 1.2);
          const baja = suavizar((ciclo - 4.2) / 1.8);
          glucosa.position.copy(sitio).add(v3(0.25 * sep, 0.12 * sep, 0.2 * sep)).lerp(poro.clone().add(v3(-0.03, -0.45, 0)), baja);
          galactosa.position.copy(sitio).add(v3(-0.22 * sep, 0.18 * sep, 0.1 * sep)).lerp(poro.clone().add(v3(0.03, -0.6, 0)), baja);
        }
        labels[3].set(romper ? [{ text: 'Glucosa + galactosa', color: '#FF6FB5', size: 58 }] : [{ text: 'Lactosa', color: '#C6FF5C', size: 68 }]);
      } else {
        // Without (working) lactase the lactose bumps around and leaves intact.
        lactosa.visible = true;
        glucosa.visible = false;
        galactosa.visible = false;
        haloLac.visible = true;
        const t = ciclo / 6;
        lactosa.position.lerpVectors(inicio, fuera, t).add(v3(0, Math.sin(t * Math.PI) * -0.5, 0));
        labels[3].set([{ text: 'Lactosa sin romper', color: '#C6FF5C', size: 58 }]);
      }
      rotuloAzucar.grupo.visible = true;
    },
    resaltar(parte: string) {
      if (/sitio|activo/.test(parte)) {
        haloSitio.scale.setScalar(0.8);
        return true;
      }
      return false;
    },
    dispose() {
      labels.forEach((l) => l.dispose());
    },
  };
}

/**
 * "digestivo": the hero biology hologram. Four semantic zoom levels (tract -> intestinal wall ->
 * villi and brush border -> lactase and lactose) with a smooth dive between them. Only the
 * visible level (and, during a dive, the one leaving) is in memory: the other levels are built on
 * demand and disposed when left (LOD by level).
 *
 * Scene variables: `nivel` 0..3, `lactasa` 1 = with lactase, 0 = without (intolerance),
 * `velocidad` 0.25..3. `temperatura` and `ph` of the lactasa practice modulate the enzyme.
 */
import * as THREE from 'three';
import { lactaseActivity } from '../physics.ts';
import type { SceneContext, SceneModule } from '../types.ts';
import { disposeGroup } from '../materials.ts';
import { fundir } from './geometria.ts';
import { NIVELES, NIVEL_MAX, nivelValido, suavizar } from './modelo.ts';
import type { EstadoNivel, Nivel } from './comun.ts';
import { construirNivel0 } from './nivel0.ts';
import { construirNivel1 } from './nivel1.ts';
import { construirNivel2 } from './nivel2.ts';
import { construirNivel3 } from './nivel3.ts';

const CONSTRUCTORES = [construirNivel0, construirNivel1, construirNivel2, construirNivel3];
const DURACION_BUCEO = 1.5;

interface Activo {
  n: number;
  nivel: Nivel;
  /** Wrapper that carries the dive transform. */
  envoltura: THREE.Group;
}

export function digestivo(): SceneModule & { niveles: number } {
  let raiz: THREE.Group;
  let actual: Activo;
  let saliente: { activo: Activo; haciaDentro: boolean } | null = null;
  let progreso = 1;
  let centro = new THREE.Vector3();
  let pendienteTardio: THREE.Group | null = null;

  const montar = (n: number): Activo => {
    const nivel = CONSTRUCTORES[n]();
    if (nivel.tardio) nivel.grupo.add(nivel.tardio);
    const envoltura = new THREE.Group();
    nivel.grupo.position.sub(centro);
    envoltura.add(nivel.grupo);
    raiz.add(envoltura);
    return { n, nivel, envoltura };
  };

  const desmontar = (a: Activo) => {
    raiz.remove(a.envoltura);
    disposeGroup(a.envoltura);
    a.nivel.dispose();
  };

  const irA = (n: number) => {
    if (n === actual.n) return;
    if (saliente) desmontar(saliente.activo);
    const haciaDentro = n > actual.n;
    saliente = { activo: actual, haciaDentro };
    actual = montar(n);
    progreso = 0;
  };

  const estado = (dt: number, ctx: SceneContext): EstadoNivel => ({
    t: ctx.time,
    dt,
    conLactasa: (ctx.variables.lactasa ?? 1) >= 0.5,
    velocidad: Math.min(3, Math.max(0.25, ctx.variables.velocidad ?? 1)),
    running: ctx.running,
    liberaciones: ctx.releases ?? 0,
    actividad: lactaseActivity(ctx.variables.temperatura ?? 37, ctx.variables.ph ?? 6.5),
  });

  return {
    id: 'digestivo',
    label: 'Sistema digestivo y lactasa',
    practice: 'lactasa',
    niveles: NIVEL_MAX + 1,
    build() {
      raiz = new THREE.Group();
      // Level 0 defines the frame: centre it so every level shares the same origin.
      const n0 = CONSTRUCTORES[0]();
      n0.grupo.updateMatrixWorld(true);
      centro = new THREE.Box3().setFromObject(n0.grupo).getCenter(new THREE.Vector3());
      n0.grupo.position.sub(centro);
      pendienteTardio = n0.tardio ?? null;
      const envoltura = new THREE.Group();
      envoltura.add(n0.grupo);
      raiz.add(envoltura);
      actual = { n: 0, nivel: n0, envoltura };
      return raiz;
    },
    update(dt, ctx) {
      if (pendienteTardio) {
        actual.nivel.grupo.add(pendienteTardio);
        pendienteTardio = null;
      }
      const pedido = nivelValido(ctx.variables.nivel);
      if (pedido !== actual.n) irA(pedido);
      const e = estado(dt, ctx);
      if (progreso < 1) {
        progreso = Math.min(1, progreso + dt / DURACION_BUCEO);
        const k = suavizar(progreso);
        if (saliente) {
          const { activo, haciaDentro } = saliente;
          // Diving in: the old level grows around its focus point and fades; going back: it shrinks.
          const escala = haciaDentro ? 1 + k * 5 : 1 - k * 0.8;
          const foco = (haciaDentro ? activo.nivel.foco : actual.nivel.foco).clone().sub(centro);
          activo.envoltura.scale.setScalar(escala);
          activo.envoltura.position.copy(foco).multiplyScalar(haciaDentro ? -(escala - 1) : 0);
          fundir(activo.envoltura, 1 - Math.min(1, k * 1.4));
          const entra = haciaDentro ? 0.15 + 0.85 * k : 1 + (1 - k) * 4;
          actual.envoltura.scale.setScalar(entra);
          fundir(actual.envoltura, Math.min(1, k * 1.3));
          activo.nivel.update(e);
        }
        if (progreso >= 1 && saliente) {
          desmontar(saliente.activo);
          saliente = null;
          actual.envoltura.scale.setScalar(1);
          actual.envoltura.position.set(0, 0, 0);
          fundir(actual.envoltura, 1);
        }
      }
      actual.nivel.update(e);
    },
    readout(ctx) {
      const n = nivelValido(ctx.variables.nivel);
      const con = (ctx.variables.lactasa ?? 1) >= 0.5;
      return { label: `Nivel ${n + 1} · ${NIVELES[n].nombre}`, value: con ? 'con lactasa' : 'sin lactasa (intolerancia)' };
    },
    highlight(part) {
      return actual?.nivel.resaltar?.(part) ?? false;
    },
    dispose() {
      if (saliente) desmontar(saliente.activo);
      saliente = null;
      actual?.nivel.dispose();
    },
  };
}

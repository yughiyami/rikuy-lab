/**
 * Orquesta la escena activa, la transformación entre escenas y la
 * ejecución de los comandos del agente.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Comando, DisplayState } from '@rikuy/contracts';
import { SCENES } from '../scenes/registry.ts';
import type { SceneContext, SceneModule } from '../scenes/types.ts';
import { zoomSemantico } from '../scenes/digestivo/modelo.ts';
import { disposeGroup } from '../scenes/materials.ts';
import { Morph } from './Morph.ts';
import type { ViewController } from './ViewController.ts';

/**
 * Envuelve el modelo y lo escala para que quepa en cada vista sin cortarse,
 * sea cual sea su tamaño original (procedural o .glb).
 */
const FIT_RADIUS = 1.05;
function fit(model: THREE.Group): THREE.Group {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const wrapper = new THREE.Group();
  wrapper.add(model);
  if (box.isEmpty()) return wrapper;
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
  const k = FIT_RADIUS / radius;
  wrapper.scale.setScalar(k);
  wrapper.position.copy(center).multiplyScalar(-k);
  return wrapper;
}

type Command = Comando;

/**
 * Practice data the scenes need: default variable values and the hint ladder.
 * Injected (it used to come from @rikuy/core, which @rikuy/holo may not import, 2.3).
 */
export interface SceneCatalog {
  defaults: Record<string, number>;
  hints(practice: string): readonly string[];
}

export interface SceneManagerOptions {
  catalog?: SceneCatalog;
  /** Base URL of `models/<id>.glb` overrides (Vite BASE_URL). */
  modelsBaseUrl?: string;
}

export class SceneManager {
  current: SceneModule | null = null;
  private root: THREE.Group | null = null;
  private readonly morph = new Morph();
  readonly ctx: SceneContext = { running: true, time: 0, variables: {}, releases: 0 };
  private busy = Promise.resolve();
  onChange: (state: DisplayState) => void = () => {};
  onHint: (text: string, level: number) => void = () => {};

  private readonly catalog: SceneCatalog;
  private readonly modelsBaseUrl: string;

  constructor(private readonly pivot: THREE.Group, private readonly view: ViewController, options: SceneManagerOptions = {}) {
    this.catalog = options.catalog ?? { defaults: {}, hints: () => [] };
    this.modelsBaseUrl = options.modelsBaseUrl ?? './';
    pivot.add(this.morph.points);
    // Valores por defecto de todas las variables de todas las prácticas.
    Object.assign(this.ctx.variables, this.catalog.defaults);
  }

  /** Cambia de escena con la transformación de partículas. */
  goTo(id: string): Promise<void> {
    this.busy = this.busy.then(() => this.transition(id));
    return this.busy;
  }

  private async transition(id: string) {
    const factory = SCENES[id];
    if (!factory || this.current?.id === id) return;
    const next = factory();
    const group = next.build();
    const override = await this.loadOverride(id);
    const nextRoot = fit(override ?? group);
    nextRoot.visible = false;
    this.pivot.add(nextRoot);

    const prevRoot = this.root;
    const prev = this.current;
    const morphing = this.morph.run(prevRoot, nextRoot);
    if (prevRoot) prevRoot.visible = false;
    await morphing;
    if (prevRoot) {
      this.pivot.remove(prevRoot);
      disposeGroup(prevRoot);
      prev?.dispose?.();
    }
    nextRoot.visible = true;
    this.root = nextRoot;
    this.current = next;
    this.view.reset();
    this.emit();
  }

  /** Si existe public/models/<id>.glb, se usa en lugar del modelo procedural. */
  private async loadOverride(id: string): Promise<THREE.Group | null> {
    try {
      const url = `${this.modelsBaseUrl}models/${id}.glb`;
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok || !(head.headers.get('content-type') ?? '').includes('model')) return null;
      const gltf = await new GLTFLoader().loadAsync(url);
      const g = new THREE.Group();
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3()).length();
      gltf.scene.position.sub(box.getCenter(new THREE.Vector3()));
      g.scale.setScalar(2.4 / size);
      g.add(gltf.scene);
      return g;
    } catch {
      return null;
    }
  }

  apply(commands: Command[]) {
    for (const c of commands) {
      switch (c.tool) {
        case 'ir_a':
          void this.goTo(c.args.escena);
          break;
        case 'fijar_variable':
          if (c.args.variable === 'profundizar') this.profundizar(c.args.valor >= 0 ? 1 : -1);
          else this.ctx.variables[c.args.variable] = Number(c.args.valor);
          break;
        case 'correr':
          this.ctx.running = true;
          this.ctx.releases = (this.ctx.releases ?? 0) + 1;
          break;
        case 'pausar':
          this.ctx.running = false;
          break;
        case 'resaltar':
          this.current?.highlight?.(c.args.parte);
          break;
        case 'rotar':
          this.view.rotateDeg(c.args.yaw ?? 0, c.args.pitch ?? 0);
          break;
        case 'zoom':
          this.zoom(c.args.factor);
          break;
        case 'separar_partes':
          this.current?.explode?.(c.args.activo);
          break;
        case 'reiniciar_vista':
          this.view.reset();
          break;
        case 'dar_pista': {
          const hints = this.catalog.hints(this.current?.practice ?? 'lactasa');
          const level = Math.max(1, Math.min(hints.length || 1, c.args.nivel));
          const hint = hints[level - 1];
          if (hint) this.onHint(hint, level);
          break;
        }
        default:
          break; // registrar_* lo maneja la analítica
      }
    }
    this.emit();
  }

  /**
   * Zoom from touch, wheel, buttons or the pinch gesture. On a scene with depth levels the zoom
   * edges change the level (semantic zoom) and the view zoom snaps back to 1.
   */
  zoom(factor: number) {
    this.view.nudge(0, 0, factor);
    if (!this.current?.niveles) return;
    const { nivel, reiniciarZoom } = zoomSemantico(this.ctx.variables.nivel ?? 0, this.view.targetZoom);
    if (!reiniciarZoom) return;
    this.ctx.variables.nivel = nivel;
    this.view.snapZoom(1);
    this.emit();
  }

  /** Dive one level deeper (+1) or back (-1) on a scene with depth levels. */
  profundizar(delta: 1 | -1) {
    const max = (this.current?.niveles ?? 1) - 1;
    if (max <= 0) return;
    const n = Math.min(max, Math.max(0, Math.round(this.ctx.variables.nivel ?? 0) + delta));
    this.ctx.variables.nivel = n;
    this.view.snapZoom(1);
    this.emit();
  }

  update(dt: number) {
    this.ctx.time += dt;
    this.morph.update(dt);
    this.current?.update?.(dt, this.ctx);
  }

  state(): DisplayState {
    return {
      scene: this.current?.id ?? '',
      running: this.ctx.running,
      variables: { ...this.ctx.variables },
      readout: this.current?.readout?.(this.ctx),
    };
  }

  emit() {
    this.onChange(this.state());
  }
}

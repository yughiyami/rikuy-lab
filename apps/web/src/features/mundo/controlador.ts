/** Own group's movement in a scene: tap/door-to-walk along a BFS path, arrow keys, arrival detection. */
import {
  type Destino,
  type Escena,
  type Punto,
  avanzar,
  caminoHacia,
  direccion,
  distanciaARect,
  moverConColision,
} from '@rikuy/campus';

const VELOCIDAD = 5; // tiles per second
export const ALCANCE = 1.5; // "near" is about 2 tiles (DESIGN.md 7.4)

export class ControladorMundo {
  pos: Punto;
  dir = 6;
  camino: Punto[] = [];
  private objetivo: Destino | null = null;
  private abrirAlLlegar = true;

  constructor(
    readonly escena: Escena,
    private readonly alLlegar: (d: Destino) => void,
    inicio?: Punto,
  ) {
    this.pos = inicio ?? { ...escena.aparicion };
  }

  /** Walks to a destination; with `abrir: false` the group only meets there (Ayudante del museo). */
  irA(destinoId: string, { abrir = true }: { abrir?: boolean } = {}): boolean {
    const d = this.escena.destinos.find((x) => x.id === destinoId);
    if (!d) return false;
    const camino = caminoHacia(this.escena.grilla, this.pos, d.rect, ALCANCE);
    if (!camino) return false;
    this.camino = camino;
    this.objetivo = d;
    this.abrirAlLlegar = abrir;
    if (camino.length === 0) this.llegar();
    return true;
  }

  /** Stops a walk without opening anything (the guide's "Cancelar"). */
  detener(): void {
    this.camino = [];
    this.objetivo = null;
  }

  /** Path for the director's highlight without walking. */
  caminoA(destinoId: string): Punto[] {
    const d = this.escena.destinos.find((x) => x.id === destinoId);
    return d ? (caminoHacia(this.escena.grilla, this.pos, d.rect, ALCANCE) ?? []) : [];
  }

  caminarAPunto(x: number, y: number): void {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const camino = caminoHacia(this.escena.grilla, this.pos, { x: tx, y: ty, ancho: 1, alto: 1 }, 0.5);
    this.objetivo = null;
    this.camino = camino ?? [];
  }

  mover(dx: number, dy: number, dt: number): void {
    this.camino = [];
    this.objetivo = null;
    this.pos = moverConColision(this.escena.grilla, this.pos, dx * VELOCIDAD * dt, dy * VELOCIDAD * dt);
    this.dir = direccion(dx, dy);
  }

  paso(dt: number): boolean {
    if (!this.camino.length) return false;
    const r = avanzar(this.pos, this.camino, VELOCIDAD, dt);
    this.pos = r.pos;
    this.camino = r.camino;
    if (r.dir !== undefined) this.dir = r.dir;
    if (!this.camino.length && this.objetivo) this.llegar();
    return true;
  }

  cercano(): Destino | undefined {
    let mejor: Destino | undefined;
    let dist = ALCANCE;
    for (const d of this.escena.destinos) {
      const dd = distanciaARect(this.pos.x, this.pos.y, d.rect);
      if (dd <= dist) {
        dist = dd;
        mejor = d;
      }
    }
    return mejor;
  }

  /**
   * Opens what is near the group (E / Enter on desktop). Ported idea from AulaQuipu's `interactRef`
   * (`apps/web-app/components/campus/world.tsx`, paoloose). Locked exhibits do not open.
   */
  interactuar(): Destino | undefined {
    const d = this.cercano();
    if (!d || d.bloqueada || d.trasReja) return undefined;
    this.camino = [];
    this.objetivo = null;
    this.alLlegar(d);
    return d;
  }

  /** Opens a given exhibit right away (a tap on it when no path reaches it). */
  interactuarCon(destinoId: string): Destino | undefined {
    const d = this.escena.destinos.find((x) => x.id === destinoId);
    if (!d || d.bloqueada || d.trasReja) return undefined;
    this.camino = [];
    this.objetivo = null;
    this.alLlegar(d);
    return d;
  }

  private llegar() {
    const d = this.objetivo;
    this.objetivo = null;
    if (d && this.abrirAlLlegar) this.alLlegar(d);
  }
}

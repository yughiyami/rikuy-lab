/**
 * Viewer actions and their wire format. The two-phone hologram (a "proyector" under the pyramid
 * and a group "control" phone) talks with the contract `BusMessage` (3.8), the same wire format
 * as the classic control.html, so the existing WebSocket relay keeps working unchanged.
 *
 * Messages from the network are untrusted: they are validated with the contract schema and
 * deltas are clamped before they reach the renderer.
 */
import { BusMessage, type Comando, type Role } from '@rikuy/contracts';

export type ViewerAction =
  | { type: 'rotate'; dx: number; dy: number } // radians
  | { type: 'zoom'; factor: number } // multiplicative
  | { type: 'pause' }
  | { type: 'release' } // let the pendulum go (run the simulation)
  | { type: 'center' }
  | { type: 'scene'; scene: string }
  | { type: 'variable'; variable: string; value: number } // e.g. the pendulum length from the control
  | { type: 'level'; delta: 1 | -1 }; // semantic zoom: dive one level deeper (1) or back (-1)

/** Scene variables a peer may set, with their lab range (anything else from the network is dropped). */
const VARIABLES: Record<string, [number, number]> = {
  longitud: [0.1, 2.5],
  amortiguacion: [0, 1],
  masa: [0.05, 5],
  gravedad: [1, 25],
  temperatura: [0, 90],
  ph: [1, 12],
  altitud: [0, 6000],
  nivel: [0, 3],
  lactasa: [0, 1],
  velocidad: [0.25, 3],
};

/** Wire name of the relative level change (a `fijar_variable` with value +1 / -1). */
export const VARIABLE_PROFUNDIZAR = 'profundizar';

const MAX_ROTATE = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function actionToMessage(action: ViewerAction, from: Role): BusMessage {
  switch (action.type) {
    case 'rotate':
      return { type: 'gesture', dx: action.dx, dy: action.dy, dz: 1, from };
    case 'zoom':
      return { type: 'gesture', dx: 0, dy: 0, dz: action.factor, from };
    case 'pause':
      return { type: 'command', commands: [{ tool: 'pausar', args: {} }], from };
    case 'release':
      return { type: 'command', commands: [{ tool: 'correr', args: {} }], from };
    case 'center':
      return { type: 'command', commands: [{ tool: 'reiniciar_vista', args: {} }], from };
    case 'scene':
      return { type: 'command', commands: [{ tool: 'ir_a', args: { escena: action.scene } }], from };
    case 'variable':
      return { type: 'command', commands: [{ tool: 'fijar_variable', args: { variable: action.variable, valor: action.value } }], from };
    case 'level':
      return { type: 'command', commands: [{ tool: 'fijar_variable', args: { variable: VARIABLE_PROFUNDIZAR, valor: action.delta } }], from };
  }
}

/** Decodes a raw message into viewer actions; anything invalid or sent by `self` yields []. */
export function messageToActions(raw: unknown, self: Role): ViewerAction[] {
  const parsed = BusMessage.safeParse(raw);
  if (!parsed.success) return [];
  const msg = parsed.data;
  if ('from' in msg && msg.from === self) return [];
  if (msg.type === 'gesture') {
    const out: ViewerAction[] = [];
    if (msg.dx !== 0 || msg.dy !== 0) out.push({ type: 'rotate', dx: clamp(msg.dx, -MAX_ROTATE, MAX_ROTATE), dy: clamp(msg.dy, -MAX_ROTATE, MAX_ROTATE) });
    if (msg.dz !== 1 && msg.dz > 0) out.push({ type: 'zoom', factor: clamp(msg.dz, MIN_ZOOM, MAX_ZOOM) });
    return out;
  }
  if (msg.type === 'command') return msg.commands.flatMap(commandToAction);
  return [];
}

function commandToAction(c: Comando): ViewerAction[] {
  switch (c.tool) {
    case 'pausar':
      return [{ type: 'pause' }];
    case 'correr':
      return [{ type: 'release' }];
    case 'reiniciar_vista':
      return [{ type: 'center' }];
    case 'ir_a':
      return [{ type: 'scene', scene: c.args.escena }];
    case 'rotar':
      return [{ type: 'rotate', dx: clamp(((c.args.yaw ?? 0) * Math.PI) / 180, -MAX_ROTATE, MAX_ROTATE), dy: clamp(((c.args.pitch ?? 0) * Math.PI) / 180, -MAX_ROTATE, MAX_ROTATE) }];
    case 'zoom':
      return [{ type: 'zoom', factor: clamp(c.args.factor, MIN_ZOOM, MAX_ZOOM) }];
    case 'fijar_variable': {
      if (c.args.variable === VARIABLE_PROFUNDIZAR) return Number.isFinite(c.args.valor) && c.args.valor !== 0 ? [{ type: 'level', delta: c.args.valor > 0 ? 1 : -1 }] : [];
      const range = Object.hasOwn(VARIABLES, c.args.variable) ? VARIABLES[c.args.variable] : undefined;
      if (!range || !Number.isFinite(c.args.valor)) return [];
      return [{ type: 'variable', variable: c.args.variable, value: clamp(c.args.valor, range[0], range[1]) }];
    }
    default:
      return [];
  }
}

/** Short Spanish label shown in the confirmation chips on both phones. */
export function actionLabel(action: ViewerAction): string {
  switch (action.type) {
    case 'rotate':
      return 'Girar';
    case 'zoom':
      return action.factor >= 1 ? 'Acercar' : 'Alejar';
    case 'pause':
      return 'Pausa';
    case 'release':
      return 'Soltar el péndulo';
    case 'center':
      return 'Centrar';
    case 'scene':
      return 'Cambiar escena';
    case 'level':
      return action.delta > 0 ? 'Profundizar' : 'Volver un nivel';
    case 'variable':
      if (action.variable === 'longitud') return `Longitud ${action.value.toFixed(2)} m`;
      if (action.variable === 'amortiguacion') return action.value >= 0.5 ? 'Con rozamiento' : 'Sin rozamiento';
      if (action.variable === 'lactasa') return action.value >= 0.5 ? 'Con lactasa' : 'Sin lactasa';
      if (action.variable === 'nivel') return `Nivel ${Math.round(action.value) + 1}`;
      if (action.variable === 'velocidad') return `Velocidad ×${action.value.toFixed(2).replace(/\.?0+$/, '')}`;
      return `Cambiar ${action.variable}`;
  }
}

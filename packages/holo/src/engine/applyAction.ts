/** Applies a viewer action (touch, buttons, hand gestures or the remote control) to the engine. */
import type { ViewerAction } from '../control/protocol.ts';
import type { SceneManager } from './SceneManager.ts';
import type { ViewController } from './ViewController.ts';

export function applyViewerAction(action: ViewerAction, view: ViewController, scenes: SceneManager): void {
  switch (action.type) {
    case 'rotate':
      view.nudge(action.dx, action.dy);
      break;
    case 'zoom':
      scenes.zoom(action.factor);
      break;
    case 'level':
      scenes.profundizar(action.delta);
      break;
    case 'pause':
      scenes.apply([{ tool: 'pausar', args: {} }]);
      break;
    case 'release':
      scenes.apply([{ tool: 'correr', args: {} }]);
      break;
    case 'center':
      view.reset();
      break;
    case 'scene':
      void scenes.goTo(action.scene);
      break;
    case 'variable':
      scenes.apply([{ tool: 'fijar_variable', args: { variable: action.variable, valor: action.value } }]);
      break;
  }
}

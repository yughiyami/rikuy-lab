/// <reference lib="webworker" />
/**
 * Gesture worker: MediaPipe HandLandmarker (bundled in public/mediapipe/, never a CDN) runs here.
 * Each frame arrives as a transferred ImageBitmap and is closed right after inference.
 * Only viewer actions and the pose name are posted back (1.4).
 */
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureInterpreter } from './interpreter.ts';
import type { FromWorker, ToWorker } from './messages.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let landmarker: HandLandmarker | null = null;
let interpreter = new GestureInterpreter();

const post = (msg: FromWorker) => scope.postMessage(msg);

scope.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      // useModule = true: module workers cannot importScripts the classic loader.
      const files = await FilesetResolver.forVisionTasks(msg.wasmBase, true);
      const create = (delegate: 'GPU' | 'CPU') =>
        HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: msg.modelUrl, delegate }, runningMode: 'VIDEO', numHands: 1 });
      landmarker = await create('GPU').catch(() => create('CPU'));
      interpreter = new GestureInterpreter();
      post({ type: 'ready' });
    } catch (err) {
      post({ type: 'error', message: (err as Error).message });
    }
    return;
  }
  if (msg.type === 'frame') {
    try {
      const res = landmarker?.detectForVideo(msg.bitmap, msg.t);
      const lm = res?.landmarks?.[0] ?? null;
      const actions = interpreter.feed(lm, msg.t);
      // Normalized 2D points only, for the on-device camera preview (never stored or sent).
      post({ type: 'result', actions, pose: interpreter.pose, landmarks: lm ? lm.map((p) => ({ x: p.x, y: p.y })) : null });
    } catch (err) {
      post({ type: 'error', message: (err as Error).message });
    } finally {
      msg.bitmap.close();
    }
    return;
  }
  landmarker?.close();
  landmarker = null;
};

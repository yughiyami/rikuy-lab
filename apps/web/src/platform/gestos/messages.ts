/**
 * Messages between the page and the gesture worker. Frames go in (transferred ImageBitmaps,
 * closed right after inference); only viewer actions and a pose name come out. Landmarks,
 * pixels and timestamps of the user's face or hand never leave the worker (1.4).
 */
import type { ViewerAction } from '@rikuy/holo';
import type { HandPose } from './classifier.ts';

export type ToWorker =
  | { type: 'init'; wasmBase: string; modelUrl: string }
  | { type: 'frame'; bitmap: ImageBitmap; t: number }
  | { type: 'stop' };

export type FromWorker =
  | { type: 'ready' }
  | { type: 'result'; actions: ViewerAction[]; pose: HandPose | null; landmarks?: Array<{ x: number; y: number }> | null }
  | { type: 'error'; message: string };

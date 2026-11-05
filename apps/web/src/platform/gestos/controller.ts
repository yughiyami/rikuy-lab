/**
 * Camera side of hand gestures. Opens the front camera only if the teacher switch allows it,
 * keeps the video in an off-DOM element, and hands one frame at a time to the worker (no queue:
 * when the worker is busy the frame is skipped, which keeps latency low on cheap phones).
 * Nothing is stored or sent: frames are transferred to the worker and closed there.
 */
import type { ViewerAction } from '@rikuy/holo';
import type { HandPose } from './classifier.ts';
import type { FromWorker, ToWorker } from './messages.ts';
import type { GestureSwitch } from './teacherSwitch.ts';

export type GestureStatus = 'off' | 'loading' | 'active' | 'blocked' | 'error' | 'slow';

export interface WorkerLike {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(msg: ToWorker, transfer?: Transferable[]): void;
  terminate(): void;
}

export interface ControllerDeps {
  gestureSwitch: GestureSwitch;
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
  createWorker: () => WorkerLike;
  video: HTMLVideoElement;
  grabFrame: (video: HTMLVideoElement) => Promise<ImageBitmap>;
  /** Next-frame scheduler (requestAnimationFrame on the web). */
  schedule: (cb: () => void) => void;
  assets: { wasmBase: string; modelUrl: string };
  now?: () => number;
}

const MIN_FPS = 12;

export class HandGestureController {
  onAction: (a: ViewerAction) => void = () => {};
  onPose: (p: HandPose | null) => void = () => {};
  /** Normalized hand landmarks for the local preview (null when no hand). */
  onLandmarks: (l: Array<{ x: number; y: number }> | null) => void = () => {};
  /** The live camera stream, so a preview can attach to it without opening a second one. */
  get currentStream(): MediaStream | null {
    return this.stream;
  }
  onStatus: (s: GestureStatus, detail?: string) => void = () => {};
  status: GestureStatus = 'off';

  private worker: WorkerLike | null = null;
  private stream: MediaStream | null = null;
  private busy = false;
  private running = false;
  private frames: number[] = [];
  private readonly unsubscribe: () => void;
  private readonly now: () => number;

  constructor(private readonly deps: ControllerDeps) {
    this.now = deps.now ?? (() => performance.now());
    this.unsubscribe = deps.gestureSwitch.subscribe((enabled) => {
      if (!enabled) this.stop('blocked');
    });
  }

  async start(): Promise<boolean> {
    if (!this.deps.gestureSwitch.enabled) {
      this.setStatus('blocked');
      return false;
    }
    if (this.running) return true;
    this.setStatus('loading');
    try {
      const worker = this.deps.createWorker();
      this.worker = worker;
      await new Promise<void>((resolve, reject) => {
        worker.onmessage = (e) => {
          const msg = e.data as FromWorker;
          if (msg.type === 'ready') resolve();
          else if (msg.type === 'error') reject(new Error(msg.message));
        };
        worker.postMessage({ type: 'init', ...this.deps.assets });
      });
      worker.onmessage = (e) => this.onWorkerMessage(e.data as FromWorker);
      if (!this.deps.gestureSwitch.enabled) throw new Error('switched off while loading');
      this.stream = await this.deps.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false });
      if (!this.deps.gestureSwitch.enabled) throw new Error('switched off while opening the camera');
      this.deps.video.srcObject = this.stream;
      await this.deps.video.play();
      this.running = true;
      this.setStatus('active');
      this.deps.schedule(this.loop);
      return true;
    } catch (e) {
      this.stop(this.deps.gestureSwitch.enabled ? 'error' : 'blocked', (e as Error).message);
      return false;
    }
  }

  stop(status: GestureStatus = 'off', detail?: string): void {
    this.running = false;
    this.busy = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.deps.video.srcObject = null;
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
      this.worker.terminate();
      this.worker = null;
    }
    this.frames = [];
    this.setStatus(status, detail);
  }

  dispose(): void {
    this.unsubscribe();
    this.stop();
  }

  /** Sends the current frame if the worker is free. Exposed for tests; the loop calls it. */
  async pump(): Promise<void> {
    if (!this.running || this.busy || !this.worker || this.deps.video.readyState < 2) return;
    this.busy = true;
    try {
      const bitmap = await this.deps.grabFrame(this.deps.video);
      if (!this.running || !this.worker) {
        bitmap.close();
        return;
      }
      this.worker.postMessage({ type: 'frame', bitmap, t: this.now() }, [bitmap]);
    } catch {
      this.busy = false;
    }
  }

  private readonly loop = () => {
    if (!this.running) return;
    void this.pump();
    this.deps.schedule(this.loop);
  };

  private onWorkerMessage(msg: FromWorker) {
    if (msg.type === 'error') {
      this.stop('error', msg.message);
      return;
    }
    if (msg.type !== 'result') return;
    this.busy = false;
    this.trackFps();
    this.onPose(msg.pose);
    this.onLandmarks(msg.landmarks ?? null);
    for (const a of msg.actions) this.onAction(a);
  }

  /** On very slow phones, say so: the UI then offers the touch controls (E-05b). */
  private trackFps() {
    const t = this.now();
    this.frames.push(t);
    while (this.frames.length && t - this.frames[0] > 3000) this.frames.shift();
    const fps = this.frames.length / 3;
    if (this.frames.length > 5 && t - this.frames[0] > 2500) {
      if (fps < MIN_FPS && this.status === 'active') this.setStatus('slow');
      else if (fps >= MIN_FPS && this.status === 'slow') this.setStatus('active');
    }
  }

  private setStatus(s: GestureStatus, detail?: string) {
    this.status = s;
    this.onStatus(s, detail);
  }
}

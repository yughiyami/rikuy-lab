/**
 * React hook over the hand-gesture controller. MediaPipe and the worker are imported only when
 * the group presses "Activar cámara de manos" (load on demand, 5.4).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewerAction } from '@rikuy/holo';
import type { GestureStatus, HandGestureController, HandPose } from '../../platform/gestos/index.ts';
import { gestureSwitch } from '../../platform/gestos/teacherSwitch.ts';

export interface GestosMano {
  status: GestureStatus;
  pose: HandPose | null;
  detail: string | undefined;
  start: () => Promise<boolean>;
  stop: () => void;
  /** Live camera stream (for the preview); undefined in fakes. */
  stream?: MediaStream | null;
  /** Subscribe to per-frame landmarks (normalized x/y). Returns an unsubscribe. */
  subscribeLandmarks?: (fn: (l: Puntos | null) => void) => () => void;
}

export type Puntos = Array<{ x: number; y: number }>;

export function useGestosMano(onAction: (a: ViewerAction) => void): GestosMano {
  const [status, setStatus] = useState<GestureStatus>(() => (gestureSwitch().enabled ? 'off' : 'blocked'));
  const [detail, setDetail] = useState<string>();
  const [pose, setPose] = useState<HandPose | null>(null);
  const ctl = useRef<HandGestureController | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const oyentes = useRef(new Set<(l: Puntos | null) => void>());
  const subscribeLandmarks = useCallback((fn: (l: Puntos | null) => void) => {
    oyentes.current.add(fn);
    return () => {
      oyentes.current.delete(fn);
    };
  }, []);
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => () => ctl.current?.dispose(), []);

  // The teacher switch can change at any time (this tab, another tab, or a class event).
  useEffect(
    () =>
      gestureSwitch().subscribe((on) => {
        if (!ctl.current) setStatus(on ? 'off' : 'blocked');
      }),
    [],
  );

  const start = useCallback(async () => {
    if (!ctl.current) {
      const { createHandGestures } = await import('../../platform/gestos/index.ts');
      const c = createHandGestures();
      c.onStatus = (s, d) => {
        setStatus(s);
        setDetail(d);
        setStream(c.currentStream);
      };
      c.onLandmarks = (l) => oyentes.current.forEach((fn) => fn(l));
      c.onPose = setPose;
      c.onAction = (a) => onActionRef.current(a);
      ctl.current = c;
    }
    return ctl.current.start();
  }, []);

  const stop = useCallback(() => {
    ctl.current?.stop();
    setPose(null);
    setStream(null);
  }, []);

  return { status, pose, detail, start, stop, stream, subscribeLandmarks };
}

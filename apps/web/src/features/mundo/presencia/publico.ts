/**
 * "Sala del público": the shared live hall of the pitch QR (`#/unirse/demo`). It rides the hub's room
 * relay (`/ws`, `{ type }` bus channel) in the fixed room `publico`: phones say `hello` as `control`, the
 * presenter screens as `panel`. Legacy `{ type: 'event' }` frames are relayed as-is to the rest of the
 * room, so the hall needs no hub change. Payloads are minimal: a nickname, a position, a grade.
 * Nicknames and quotes are cleaned with the hall chat rules on send AND on receipt.
 */
import { enmascarar, prepararMensaje } from '@rikuy/campus';
import { hubDeEstaPagina } from '../../../platform/hub.ts';

export const SALA_PUBLICO = 'publico';
export const APODO_MAX = 16;
const CITA_MAX = 220;

export type NivelPublico = 0 | 1 | 2 | 3 | 'NO';

export interface PosPublico {
  id: string;
  apodo: string;
  x: number;
  y: number;
  dir: number;
  ts: number;
}

export interface CalificacionPublico {
  apodo: string;
  nivel: NivelPublico;
  cita: string;
  fuente: string;
  ts: number;
}

export type MensajePublico =
  | { tipo: 'pares'; roles: string[] }
  | { tipo: 'pos'; pos: PosPublico }
  | { tipo: 'calificacion'; calificacion: CalificacionPublico };

/** A free nickname for the public hall: chat rules (no links, phones, bad words), at most 16 characters. */
export function sanitizarApodo(crudo: unknown): string | null {
  const p = prepararMensaje(crudo);
  if (!p.ok) return null;
  const t = p.texto.slice(0, APODO_MAX).trim();
  return t || null;
}

const NIVELES: readonly NivelPublico[] = [0, 1, 2, 3, 'NO'];
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Parses one relayed frame of the public room; anything unexpected is dropped. */
export function leerMensajePublico(m: unknown): MensajePublico | null {
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  if (o.type === 'peers' && Array.isArray(o.roles)) return { tipo: 'pares', roles: o.roles.filter((r): r is string => typeof r === 'string') };
  if (o.type !== 'event') return null;
  const apodo = sanitizarApodo(o.apodo);
  if (!apodo) return null;
  if (o.event === 'publico.pos' && typeof o.id === 'string' && num(o.x) && num(o.y) && num(o.dir) && num(o.ts))
    return { tipo: 'pos', pos: { id: o.id.slice(0, 40), apodo, x: o.x, y: o.y, dir: Math.max(0, Math.min(7, Math.round(o.dir))), ts: o.ts } };
  if (o.event === 'publico.calificacion' && NIVELES.includes(o.nivel as NivelPublico) && typeof o.cita === 'string' && typeof o.fuente === 'string' && num(o.ts))
    return {
      tipo: 'calificacion',
      calificacion: { apodo, nivel: o.nivel as NivelPublico, cita: enmascarar(o.cita.slice(0, CITA_MAX)), fuente: o.fuente.slice(0, 40), ts: o.ts },
    };
  return null;
}

function idCliente(): string {
  const nuevo = `pub-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const k = 'rk-publico-id';
    const v = sessionStorage.getItem(k);
    if (v) return v;
    sessionStorage.setItem(k, nuevo);
  } catch {
    /* storage blocked: a fresh id per page */
  }
  return nuevo;
}

export interface ConexionPublico {
  readonly id: string;
  enviarPos(p: Omit<PosPublico, 'id' | 'ts'>): void;
  enviarCalificacion(c: Omit<CalificacionPublico, 'ts'>): void;
  cerrar(): void;
}

/** Opens (and keeps reopening) the public room socket. `alEstado` reports whether the hub answered. */
export function conectarPublico(rol: 'control' | 'panel', alMensaje: (m: MensajePublico) => void, alEstado?: (conectado: boolean) => void): ConexionPublico {
  const id = rol === 'control' ? idCliente() : `panel-${Math.random().toString(36).slice(2, 10)}`;
  let ws: WebSocket | null = null;
  let cerrado = false;
  let espera = 1000;
  let latido: ReturnType<typeof setInterval> | undefined;
  let reintento: ReturnType<typeof setTimeout> | undefined;

  const enviar = (m: unknown) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
  };

  const abrir = async () => {
    const info = await hubDeEstaPagina();
    if (cerrado) return;
    const url = new URL((info?.ws ?? '/ws').replace(/^\//, ''), location.href.split('#')[0]);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    let s: WebSocket;
    try {
      s = new WebSocket(url.href);
    } catch {
      return programar();
    }
    ws = s;
    s.onopen = () => {
      espera = 1000;
      s.send(JSON.stringify({ type: 'hello', role: rol, room: SALA_PUBLICO, clientId: id }));
      alEstado?.(true);
      // the hub ignores client `peers` frames: a cheap keep-alive through proxies
      latido = setInterval(() => enviar({ type: 'peers', roles: [] }), 25_000);
    };
    s.onmessage = (e) => {
      try {
        const m = leerMensajePublico(JSON.parse(String(e.data)));
        if (m) alMensaje(m);
      } catch {
        /* not JSON */
      }
    };
    s.onclose = () => {
      clearInterval(latido);
      alEstado?.(false);
      if (ws === s) ws = null;
      programar();
    };
  };

  const programar = () => {
    if (cerrado) return;
    reintento = setTimeout(() => void abrir(), espera);
    espera = Math.min(espera * 2, 15_000);
  };

  void abrir();

  return {
    id,
    enviarPos: (p) => enviar({ type: 'event', event: 'publico.pos', id, ...p, ts: Date.now() }),
    enviarCalificacion: (c) => enviar({ type: 'event', event: 'publico.calificacion', ...c, ts: Date.now() }),
    cerrar: () => {
      cerrado = true;
      clearTimeout(reintento);
      clearInterval(latido);
      ws?.close();
      ws = null;
    },
  };
}

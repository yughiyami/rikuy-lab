/**
 * The local hub (T2 / T2b, 3.7): Hono over @hono/node-server.
 *
 *   /ws                       one WebSocket per device, multiplexing three channels by shape:
 *                               { type }          -> bus: hologram room relay (3.8, legacy-compatible)
 *                               { t: 'rt.*' }     -> rt: museum presence (3.9)
 *                               { t: hola|delta|ack } -> sync: event log session (3.5)
 *   /api/hub, /descubrir      discovery (URLs + QR)
 *   /holo, /api/holo/salas    hologram rooms by code/QR for the two-phone demo
 *   /api/tutor, /api/ia/*     tutor (Ollama via injected adapter, rules fallback)
 *   /api/clases/*             panel snapshot + live SSE feed, JSONL export (teacher token)
 *   /api/rt/:claseId/orden    teacher orders and switches (teacher token)
 *   /sync                     the same sync session over plain HTTP
 *   /*                        apps/web/dist
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { serve, type ServerType } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { WSContext } from 'hono/ws';
import { MensajeRtHub, MensajeSync, RT_TICK_MS } from '@rikuy/contracts';
import { PresenceServer, type Outbound } from '@rikuy/presencia';
import { HoloRelay, normalizeRoom, type RelayOut } from './bus/holo-relay.ts';
import { lanUrls, macAuthorizer, qrSvg, type NetIf } from './discovery.ts';
import { TutorService, type LocalModel } from './ia/tutor.ts';
import { SqliteEventLog } from './log/sqlite-log.ts';
import { holoRoomPage, discoveryPage } from './pages.ts';
import { SyncHub, type SyncOut } from './sync/sync-hub.ts';

export interface HubOptions {
  /** SQLite file (or ':memory:'). */
  dbPath: string;
  /** Built web app to serve (apps/web/dist). Skipped when missing. */
  webDist?: string;
  /** Local model adapter (Ollama). `null` = rules only. */
  model?: LocalModel | null;
  /** Teacher token for panel, export, orders and class keys. Random when omitted. */
  adminToken?: string;
  /** Admit `rt.hola` of classes without a registered key (demo mode). */
  open?: boolean;
  /** Tutor timing (see TutorService). */
  tutor?: ConstructorParameters<typeof TutorService>[1];
  /** URL the phones should use (HUB_PUBLIC_URL), when the interface guess is wrong. */
  publicUrl?: string;
  /** Network interfaces for discovery (defaults to os.networkInterfaces()). */
  interfaces?: () => Record<string, NetIf[] | undefined>;
  /** Server-side WebSocket liveness ping. */
  pingIntervalMs?: number;
  now?(): number;
  log?(line: string): void;
}

export interface RunningHub {
  port: number;
  urls: string[];
  adminToken: string;
  nonce: string;
  close(): Promise<void>;
}

const MAX_WS_MESSAGE = 512 * 1024;
const SYNC_TYPES = new Set(['hola', 'delta', 'ack']);

type Channel = 'bus' | 'rt' | 'sync';

export function channelOf(msg: unknown): Channel | null {
  if (typeof msg !== 'object' || msg === null) return null;
  const m = msg as { type?: unknown; t?: unknown };
  if (typeof m.type === 'string') return 'bus';
  if (typeof m.t !== 'string') return null;
  if (m.t.startsWith('rt.')) return 'rt';
  return SYNC_TYPES.has(m.t) ? 'sync' : null;
}

export function createHub(options: HubOptions) {
  const now = options.now ?? Date.now;
  const say = options.log ?? (() => {});
  const adminToken = options.adminToken ?? randomBytes(9).toString('base64url');
  const nonce = randomBytes(12).toString('base64url');
  const classKeys = new Map<string, string>();
  const log = new SqliteEventLog(options.dbPath);
  const sync = new SyncHub(log);
  const relay = new HoloRelay();
  const presence = new PresenceServer({ authorize: macAuthorizer({ keys: classKeys, nonce, open: options.open ?? false }) });
  const tutor = new TutorService(options.model ?? null, options.tutor);
  const sockets = new Map<string, WSContext>();
  const rtConns = new Set<string>();
  const panelListeners = new Set<(claseId: string) => void>();
  let port = 0;
  let nextConn = 1;

  const interfaces = options.interfaces ?? (() => ({}));
  const urls = () => lanUrls(port, interfaces(), options.publicUrl);

  sync.onAccepted((claseId) => {
    for (const l of panelListeners) l(claseId);
  });

  // ---- WebSocket glue ------------------------------------------------------

  const sendRaw = (conn: string, msg: unknown) => {
    const ws = sockets.get(conn);
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  };
  const closeConn = (conn: string) => {
    const ws = sockets.get(conn);
    sockets.delete(conn);
    try {
      ws?.close();
    } catch {
      /* already closed */
    }
  };
  const applyRelay = (out: RelayOut[]) => {
    for (const o of out) if (o.kind === 'send') sendRaw(o.to, o.msg);
    for (const o of out) if (o.kind === 'close') closeConn(o.to);
  };
  const applyPresence = (out: Outbound[]) => {
    for (const o of out) if (o.kind === 'send') sendRaw(o.to, o.msg);
    for (const o of out) if (o.kind === 'close') closeConn(o.to);
  };
  const applySync = (out: SyncOut[]) => {
    for (const o of out) sendRaw(o.to, o.msg);
  };
  const leave = (conn: string) => {
    sockets.delete(conn);
    rtConns.delete(conn);
    applyRelay(relay.leave(conn));
    presence.disconnect(conn);
    sync.leave(conn);
  };

  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({ app });

  app.get(
    '/ws',
    upgradeWebSocket(() => {
      const conn = `c${nextConn++}`;
      return {
        onOpen(_e, ws) {
          sockets.set(conn, ws);
          const raw = ws.raw as { on?(ev: 'pong', fn: () => void): void; isAlive?: boolean } | undefined;
          if (raw?.on) {
            raw.isAlive = true;
            raw.on('pong', () => (raw.isAlive = true));
          }
        },
        onMessage(e) {
          const data = typeof e.data === 'string' ? e.data : String(e.data);
          if (data.length > MAX_WS_MESSAGE) return;
          let msg: unknown;
          try {
            msg = JSON.parse(data);
          } catch {
            return;
          }
          switch (channelOf(msg)) {
            case 'bus':
              return applyRelay(relay.receive(conn, msg));
            case 'rt':
              // Presence tracks a connection from its first rt frame: bus-only sockets (hologram rooms,
              // the public hall) must not be closed by the presence silence timeout.
              if (!rtConns.has(conn)) {
                rtConns.add(conn);
                presence.connect(conn, now());
              }
              return applyPresence(presence.receive(conn, msg, now()));
            case 'sync':
              return applySync(sync.receive(conn, msg));
          }
        },
        onClose() {
          leave(conn);
        },
        onError() {
          leave(conn);
        },
      };
    }),
  );

  // ---- HTTP API --------------------------------------------------------------

  const isTeacher = (c: Context) => {
    const header = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const given = Buffer.from(header ?? c.req.query('token') ?? '');
    const want = Buffer.from(adminToken);
    return given.length === want.length && timingSafeEqual(given, want);
  };
  const publicOrigin = (): string | null => {
    try {
      return options.publicUrl ? new URL(options.publicUrl).origin : null;
    } catch {
      return null;
    }
  };
  /** Origin for links shown as QR: the request host, unless it is loopback (useless on a phone). */
  const origin = (c: Context) => {
    const host = c.req.header('host') ?? '';
    const loopback = /^(localhost|127\.|\[::1\])/i.test(host);
    if (!host || loopback) return urls()[0]!.replace(/\/$/, '');
    const publico = publicOrigin();
    if (publico && new URL(publico).host === host) return publico;
    // Behind a TLS proxy (Traefik, Cloudflare) keep the scheme the phone used; only http/https are accepted.
    const proto = (c.req.header('x-forwarded-proto') ?? '').split(',')[0]!.trim().toLowerCase();
    return `${proto === 'https' ? 'https' : 'http'}://${host}`;
  };

  app.get('/api/health', (c) => c.json({ ok: true, ia: tutor.modelAvailable ? 'ia-local' : 'reglas' }));

  app.get('/api/hub', (c) =>
    c.json({ nombre: 'Rikuy hub', urls: urls(), nonce, ws: '/ws', ia: tutor.modelAvailable ? 'ia-local' : 'reglas' }),
  );
  app.get('/api/hub/qr.svg', async (c) => c.body(await qrSvg(c.req.query('url') ?? urls()[0]!), 200, { 'content-type': 'image/svg+xml' }));
  app.get('/descubrir', async (c) => {
    const list = urls();
    return c.html(discoveryPage(list, await qrSvg(list[0]!)));
  });

  // Hologram rooms (two-phone demo)
  const roomLinks = async (c: Context, codigo: string) => {
    const base = origin(c);
    const proyector = `${base}/display.html?sala=${codigo}`;
    const control = `${base}/control.html?sala=${codigo}`;
    return { codigo, proyector, control, qr: { proyector: await qrSvg(proyector), control: await qrSvg(control) } };
  };
  app.post('/api/holo/salas', async (c) => c.json(await roomLinks(c, relay.createRoom()), 201));
  app.get('/api/holo/salas', (c) => c.json(relay.rooms()));
  app.get('/api/holo/salas/:codigo', (c) => c.json(relay.room(c.req.param('codigo'))));
  app.get('/holo', (c) => c.redirect(`/holo/${relay.createRoom()}`));
  app.get('/holo/:codigo', async (c) => c.html(holoRoomPage(await roomLinks(c, normalizeRoom(c.req.param('codigo'))))));

  // Tutor and local AI
  app.post('/api/tutor', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { texto?: unknown; contexto?: Record<string, unknown> } | null;
    if (!body || typeof body.texto !== 'string' || !body.texto.trim()) return c.json({ error: 'texto requerido' }, 400);
    const ctx = body.contexto ?? {};
    return c.json(
      await tutor.answer({
        texto: body.texto,
        contexto: {
          practica: String(ctx.practica ?? 'pendulo'),
          escena: String(ctx.escena ?? 'pendulo'),
          pistasUsadas: Number(ctx.pistasUsadas ?? 0) || 0,
          variables: typeof ctx.variables === 'object' && ctx.variables ? (ctx.variables as Record<string, number>) : {},
        },
      }),
    );
  });
  app.post('/api/ia/embeddings', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { textos?: unknown } | null;
    const textos = Array.isArray(body?.textos) ? body.textos.filter((t): t is string => typeof t === 'string').slice(0, 64) : [];
    if (!textos.length) return c.json({ error: 'textos requerido' }, 400);
    const vectores = await tutor.embed(textos);
    return vectores ? c.json({ vectores, modelo: 'nomic-embed-text' }) : c.json({ error: 'sin modelo local' }, 503);
  });

  // Teacher: class keys, panel, export, orders
  app.post('/api/clases/:claseId/clave', async (c) => {
    if (!isTeacher(c)) return c.json({ error: 'token' }, 401);
    const body = (await c.req.json().catch(() => null)) as { claveMac?: unknown } | null;
    if (typeof body?.claveMac !== 'string' || body.claveMac.length < 16) return c.json({ error: 'claveMac' }, 400);
    classKeys.set(c.req.param('claseId'), body.claveMac);
    return c.json({ ok: true });
  });

  const panel = (claseId: string) => ({
    claseId,
    eventos: log.count(claseId),
    vv: log.versionVector(claseId),
    grupos: log.groups(claseId),
    presencia: { salas: presence.occupancy(claseId), dispositivos: presence.roster(claseId) },
    sync: sync.stats(),
  });
  app.get('/api/clases', (c) => (isTeacher(c) ? c.json(log.classes()) : c.json({ error: 'token' }, 401)));
  app.get('/api/clases/:claseId/panel', (c) => (isTeacher(c) ? c.json(panel(c.req.param('claseId'))) : c.json({ error: 'token' }, 401)));
  app.get('/api/clases/:claseId/panel/stream', (c) => {
    if (!isTeacher(c)) return c.json({ error: 'token' }, 401);
    const claseId = c.req.param('claseId');
    return streamSSE(c, async (stream) => {
      let last = '';
      let wake: (() => void) | null = null;
      const listener = (id: string) => {
        if (id === claseId) wake?.();
      };
      panelListeners.add(listener);
      stream.onAbort(() => {
        panelListeners.delete(listener);
        wake?.();
      });
      while (!stream.aborted) {
        const data = JSON.stringify(panel(claseId));
        if (data !== last) {
          last = data;
          await stream.writeSSE({ event: 'panel', data });
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 1000); // presence changes are polled once per second
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        wake = null;
      }
    });
  });
  app.get('/api/clases/:claseId/export.jsonl', (c) => {
    if (!isTeacher(c)) return c.json({ error: 'token' }, 401);
    const claseId = c.req.param('claseId');
    const lines: string[] = [];
    for (const e of log.inOrder(claseId)) lines.push(JSON.stringify(e));
    return c.body(lines.length ? `${lines.join('\n')}\n` : '', 200, {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'content-disposition': `attachment; filename="rikuy-${claseId}.jsonl"`,
    });
  });
  app.post('/api/rt/:claseId/orden', async (c) => {
    if (!isTeacher(c)) return c.json({ error: 'token' }, 401);
    const parsed = MensajeRtHub.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success || (parsed.data.t !== 'rt.orden' && parsed.data.t !== 'rt.interruptor')) return c.json({ error: 'orden' }, 400);
    const out = presence.order(c.req.param('claseId'), parsed.data);
    applyPresence(out);
    return c.json({ entregados: out.length });
  });

  // Same sync session over HTTP (T2 without WebSocket, or T3 parity)
  app.post('/sync', async (c) => {
    const parsed = MensajeSync.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'MensajeSync' }, 400);
    const m = parsed.data;
    if (m.t === 'delta') {
      sync.ingest(m.claseId, m.eventos);
      for (const l of panelListeners) l(m.claseId);
      return c.json([{ t: 'ack', claseId: m.claseId, vv: log.versionVector(m.claseId) }]);
    }
    const conn = `http-${nextConn++}`;
    const out = sync.receive(conn, m).map((o) => o.msg);
    sync.leave(conn);
    return c.json(out);
  });

  // Built web app
  const dist = options.webDist;
  if (dist && existsSync(join(dist, 'index.html'))) {
    // Static pitch site (apps/web/public/pitch): its relative assets need the trailing slash
    app.get('/pitch', (c) => c.redirect('/pitch/', 301));
    app.use('/*', serveStatic({ root: dist }));
    const index = readFileSync(join(dist, 'index.html'), 'utf8');
    app.get('/', (c) => c.html(index));
  } else {
    app.get('/', (c) => c.redirect('/descubrir'));
  }

  // ---- lifecycle ---------------------------------------------------------------

  async function listen(listenPort = 8787, hostname = '0.0.0.0'): Promise<RunningHub> {
    const server: ServerType = await new Promise((resolve) => {
      const s = serve({ fetch: app.fetch, port: listenPort, hostname }, () => resolve(s));
    });
    injectWebSocket(server);
    port = (server.address() as AddressInfo).port;
    const tick = setInterval(() => applyPresence(presence.tick(now())), RT_TICK_MS);
    const ping = setInterval(() => {
      for (const client of wss.clients) {
        const c = client as typeof client & { isAlive?: boolean };
        if (c.isAlive === false) {
          c.terminate();
          continue;
        }
        c.isAlive = false;
        c.ping();
      }
    }, options.pingIntervalMs ?? 10_000);
    say(`Rikuy hub on ${urls().join('  ')}`);
    return {
      port,
      urls: urls(),
      adminToken,
      nonce,
      close: () =>
        new Promise<void>((resolve) => {
          clearInterval(tick);
          clearInterval(ping);
          for (const client of wss.clients) client.terminate();
          server.close(() => {
            log.close();
            resolve();
          });
        }),
    };
  }

  return { app, listen, log, adminToken, nonce };
}

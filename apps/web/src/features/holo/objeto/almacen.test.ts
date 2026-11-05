import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ID_DEMO, cargarObjeto, guardarObjeto, listarObjetos } from './almacen.ts';
import type { ObjetoEscaneado } from './tipos.ts';

const meta = {
  creado: '2026-11-05T17:57:00.681Z',
  identificacion: { nombre: 'Raspberry Pi', conceptoSam: 'circuit board', descripcion: 'd', partes: [], narracion: 'n', pregunta: 'p' },
  competencia: { id: 'secundaria-1:cyt:c3', nombre: 'Diseña y construye soluciones tecnológicas para resolver problemas de su entorno' },
  motor: { identificacion: 'gemini', segmentacion: 'sam-3.1', modelo3d: 'vista360' },
  columnas: 4,
  filas: 3,
  vistas: 12,
};

describe('scanned objects on this device', () => {
  it('copies the bundled demo in on first use and serves it from IndexedDB afterwards', async () => {
    const f = vi.fn(async (u: string | URL | Request) => (String(u).endsWith('.json') ? new Response(JSON.stringify({ ...meta, id: ID_DEMO })) : new Response(new Blob(['x'])))) as unknown as typeof fetch;
    const o = await cargarObjeto(ID_DEMO, f);
    expect(o?.identificacion.nombre).toBe('Raspberry Pi');
    expect(f).toHaveBeenCalledTimes(3);
    const offline = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect((await cargarObjeto(ID_DEMO, offline))?.vistas).toBe(12);
    expect(offline).not.toHaveBeenCalled();
  });

  it('lists the class scans (not the demo), newest first, and misses unknown ids', async () => {
    const base = { ...meta, heroe: new Blob(['h']), atlas: new Blob(['a']) } as unknown as ObjetoEscaneado;
    await guardarObjeto({ ...base, id: 'a', creado: '2026-11-05T10:00:00Z' });
    await guardarObjeto({ ...base, id: 'b', creado: '2026-11-05T11:00:00Z' });
    expect((await listarObjetos()).map((o) => o.id)).toEqual(['b', 'a']);
    expect(await cargarObjeto('nada')).toBeUndefined();
  });
});

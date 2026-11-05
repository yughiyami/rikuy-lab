/**
 * Scanned objects on this device (IndexedDB via Dexie): once scanned, the exhibit opens offline.
 * The demo object ships as static files (public/objetos/demo-raspberry, PNG + JSON so the PWA precaches it) and is copied in on first use.
 */
import Dexie, { type Table } from 'dexie';
import type { ObjetoEscaneado } from './tipos.ts';

export const ID_DEMO = 'demo-raspberry';

class DbObjetos extends Dexie {
  objetos!: Table<ObjetoEscaneado, string>;
  constructor(nombre: string) {
    super(nombre);
    this.version(1).stores({ objetos: 'id, creado' });
  }
}

let db: DbObjetos | null = null;
const base = () => (db ??= new DbObjetos('rikuy-objetos'));

export async function guardarObjeto(o: ObjetoEscaneado): Promise<void> {
  await base().objetos.put(o);
}

export async function listarObjetos(): Promise<ObjetoEscaneado[]> {
  return (await base().objetos.orderBy('creado').reverse().toArray()).filter((o) => o.id !== ID_DEMO);
}

async function cargarDemo(f: typeof fetch): Promise<ObjetoEscaneado | undefined> {
  const raiz = `${import.meta.env.BASE_URL ?? '/'}objetos/${ID_DEMO}/`;
  const r = await f(`${raiz}objeto.json`);
  if (!r.ok) return undefined;
  const meta = (await r.json()) as Omit<ObjetoEscaneado, 'heroe' | 'atlas'>;
  const [heroe, atlas] = await Promise.all([f(`${raiz}heroe.png`).then((x) => x.blob()), f(`${raiz}atlas.png`).then((x) => x.blob())]);
  return { ...meta, heroe, atlas };
}

export async function cargarObjeto(id: string, f: typeof fetch = (...a) => fetch(...a)): Promise<ObjetoEscaneado | undefined> {
  const guardado = await base()
    .objetos.get(id)
    .catch(() => undefined);
  if (guardado || id !== ID_DEMO) return guardado;
  const demo = await cargarDemo(f).catch(() => undefined);
  if (demo) await guardarObjeto(demo).catch(() => undefined);
  return demo;
}

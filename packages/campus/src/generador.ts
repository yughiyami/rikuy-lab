/**
 * Museum generated from content (1.3): one Tiled template per hall type plus the hall catalog and the
 * approved exhibits, placed on free pedestals. A new approved practice shows up as an exhibit without
 * editing any map.
 */
import type { Exhibicion, Sala } from '@rikuy/contracts';
import { RUTAS } from '@rikuy/contracts';
import { type Decor, bloqueosDecor, decoracionDe } from './decoracion.ts';
import { type Grilla, type Punto, type Rect, crearGrilla } from './grilla.ts';
import { estiloSala, rutaDeExhibicion, rutaDeReto, rutaDeSala } from './salas.ts';
import type { MapaMundo, ObjetoMapa } from './tiled.ts';

/** `curador`: the room curator NPC; arriving opens its question instead of a route. */
export type TipoDestino = 'puerta' | 'exhibicion' | 'reto' | 'interactivo' | 'curador';

/** Anything the group can walk to and open. Every destination is also a focusable DOM button. */
export interface Destino {
  id: string;
  tipo: TipoDestino;
  etiqueta: string;
  /** App route opened on arrival. */
  destino: string;
  rect: Rect;
  salaId?: string;
  exhibicionId?: string;
  practicaId?: string;
  retoId?: string;
  /** Unlock condition (e.g. `quipu:5`) while the exhibit is still closed. */
  bloqueada?: string;
  /** Behind the curator's gate (back gallery) while it is closed. */
  trasReja?: boolean;
}

export interface Escena {
  /** `vestibulo` or the hall id. */
  id: string;
  titulo: string;
  mapa: MapaMundo;
  grilla: Grilla;
  destinos: Destino[];
  aparicion: Punto;
  rikuy: Punto | null;
  curador: Punto | null;
  /** The curator's gate (thematic halls only). */
  reja: Rect | null;
  rejaAbierta: boolean;
  /** Exhibits that did not fit on a pedestal: still reachable from the list mode. */
  sinPedestal: Exhibicion[];
  /** Props, rugs and wall hangings (floor pieces also block in `grilla`). */
  decoracion: Decor[];
}

export interface Museo {
  vestibulo: Escena;
  salas: Record<string, Escena>;
  salasOrden: Sala[];
}

export interface EntradaMuseo {
  salas: Sala[];
  exhibiciones: Exhibicion[];
  plantillas: Record<string, MapaMundo>;
  retos?: { id: string; titulo: string }[];
  /** Exhibit titles (from the practices catalog). Falls back to the exhibit id. */
  titulos?: Record<string, string>;
  /** Quipu unlock resolver (F10). Without it, any `bloqueadaHasta` exhibit stays closed. */
  desbloqueada?: (exhibicion: Exhibicion) => boolean;
  /** Halls whose curator question was already answered. */
  rejasAbiertas?: ReadonlySet<string>;
}

const rectDe = (o: ObjetoMapa): Rect => ({ x: o.x, y: o.y, ancho: o.ancho, alto: o.alto });
const centro = (o: ObjetoMapa): Punto => ({ x: o.x + o.ancho / 2, y: o.y + o.alto / 2 });

function clonar(m: MapaMundo): MapaMundo {
  return { ...m, suelo: [...m.suelo], muros: [...m.muros], objetos: m.objetos.map((o) => ({ ...o, props: { ...o.props } })) };
}

function puntoDe(mapa: MapaMundo, tipo: string, nombre?: string): Punto | null {
  const o = mapa.objetos.find((x) => x.tipo === tipo && (nombre === undefined || x.nombre === nombre));
  return o ? centro(o) : null;
}

function cerrar(mapa: MapaMundo, o: ObjetoMapa) {
  for (let y = o.y; y < o.y + o.alto; y++) for (let x = o.x; x < o.x + o.ancho; x++) mapa.muros[y * mapa.ancho + x] = 5;
}

function escenaBase(
  id: string,
  titulo: string,
  plantilla: string,
  mapa: MapaMundo,
  destinos: Destino[],
  sinPedestal: Exhibicion[],
  rejaAbierta: boolean,
): Escena {
  const decoracion = decoracionDe(id, plantilla);
  const reja = mapa.objetos.find((o) => o.tipo === 'reja');
  if (reja) reja.props.bloquea = !rejaAbierta;
  return {
    id,
    titulo,
    mapa,
    grilla: crearGrilla(mapa, bloqueosDecor(decoracion)),
    destinos,
    aparicion: puntoDe(mapa, 'aparicion') ?? { x: 1.5, y: 1.5 },
    rikuy: puntoDe(mapa, 'npc', 'rikuy'),
    curador: puntoDe(mapa, 'npc', 'curador'),
    reja: reja ? rectDe(reja) : null,
    rejaAbierta: reja ? rejaAbierta : true,
    sinPedestal,
    decoracion,
  };
}

function generarVestibulo(entrada: EntradaMuseo): Escena {
  const plantilla = entrada.plantillas.vestibulo;
  if (!plantilla) throw new Error('missing template "vestibulo"');
  const mapa = clonar(plantilla);
  const slots = mapa.objetos
    .filter((o) => o.tipo === 'puerta')
    .sort((a, b) => Number(a.props.slot ?? 0) - Number(b.props.slot ?? 0));
  const destinos: Destino[] = [];
  slots.forEach((o, i) => {
    const sala = entrada.salas[i];
    if (!sala) {
      cerrar(mapa, o);
      return;
    }
    o.props.destino = rutaDeSala(sala.id);
    o.props.salaId = sala.id;
    destinos.push({
      id: `puerta-${sala.id}`,
      tipo: 'puerta',
      etiqueta: estiloSala(sala).nombre,
      destino: rutaDeSala(sala.id),
      rect: rectDe(o),
      salaId: sala.id,
    });
  });
  return escenaBase('vestibulo', 'Vestíbulo', 'vestibulo', mapa, destinos, [], true);
}

function generarSala(sala: Sala, entrada: EntradaMuseo): Escena {
  const plantilla = entrada.plantillas[sala.plantilla];
  if (!plantilla) throw new Error(`missing template "${sala.plantilla}" for hall ${sala.id}`);
  const mapa = clonar(plantilla);
  const rejaAbierta = entrada.rejasAbiertas?.has(sala.id) ?? false;
  const destinos: Destino[] = [];
  const zona = mapa.objetos.find((o) => o.tipo === 'zona');
  if (zona) zona.props.salaId = sala.id;

  const reja = mapa.objetos.find((o) => o.tipo === 'reja');
  const trasReja = (o: ObjetoMapa) => !!reja && !rejaAbierta && o.y + o.alto <= reja.y;

  for (const o of mapa.objetos) {
    if (o.tipo === 'puerta') {
      destinos.push({ id: `salida-${sala.id}`, tipo: 'puerta', etiqueta: 'Volver al vestíbulo', destino: RUTAS.museo, rect: rectDe(o), salaId: sala.id });
    } else if (o.tipo === 'npc' && o.props.rol === 'curador') {
      destinos.push({ id: `curador-${sala.id}`, tipo: 'curador', etiqueta: 'la curadora de la sala', destino: '', rect: rectDe(o), salaId: sala.id });
    } else if (o.tipo === 'interactivo' && typeof o.props.destino === 'string') {
      destinos.push({
        id: `${sala.id}-${o.nombre}`,
        tipo: 'interactivo',
        etiqueta: String(o.props.etiqueta ?? o.nombre),
        destino: o.props.destino,
        rect: rectDe(o),
        salaId: sala.id,
      });
    }
  }

  const pedestales = mapa.objetos.filter((o) => o.tipo === 'pedestal');
  const libres = new Set(pedestales.map((p) => p.nombre));
  const sinPedestal: Exhibicion[] = [];
  const colocar = (preferido: string | undefined): ObjetoMapa | undefined => {
    const nombre = preferido && libres.has(preferido) ? preferido : pedestales.find((p) => libres.has(p.nombre))?.nombre;
    if (!nombre) return undefined;
    libres.delete(nombre);
    return pedestales.find((p) => p.nombre === nombre);
  };

  if (sala.plantilla === 'patio') {
    for (const reto of entrada.retos ?? []) {
      const p = colocar(undefined);
      if (!p) break;
      p.props.retoId = reto.id;
      p.props.destino = rutaDeReto(reto.id);
      destinos.push({ id: `reto-${reto.id}`, tipo: 'reto', etiqueta: reto.titulo, destino: rutaDeReto(reto.id), rect: rectDe(p), salaId: sala.id, retoId: reto.id });
    }
  } else {
    for (const e of entrada.exhibiciones.filter((x) => x.salaId === sala.id)) {
      const p = colocar(e.pedestal);
      if (!p) {
        sinPedestal.push(e);
        continue;
      }
      p.props.exhibicionId = e.id;
      p.props.practicaId = e.practicaId;
      p.props.destino = rutaDeExhibicion(e.id);
      const cerrada = e.bloqueadaHasta && !(entrada.desbloqueada?.(e) ?? false) ? e.bloqueadaHasta : undefined;
      destinos.push({
        id: `exh-${e.id}`,
        tipo: 'exhibicion',
        etiqueta: entrada.titulos?.[e.id] ?? e.id,
        destino: rutaDeExhibicion(e.id),
        rect: rectDe(p),
        salaId: sala.id,
        exhibicionId: e.id,
        practicaId: e.practicaId,
        ...(cerrada ? { bloqueada: cerrada } : {}),
        ...(trasReja(p) ? { trasReja: true } : {}),
      });
    }
  }
  return escenaBase(sala.id, estiloSala(sala).nombre, sala.plantilla, mapa, destinos, sinPedestal, rejaAbierta);
}

export function generarMuseo(entrada: EntradaMuseo): Museo {
  const salas: Record<string, Escena> = {};
  for (const s of entrada.salas) salas[s.id] = generarSala(s, entrada);
  return { vestibulo: generarVestibulo(entrada), salas, salasOrden: entrada.salas };
}

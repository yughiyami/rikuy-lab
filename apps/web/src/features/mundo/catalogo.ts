/**
 * Exhibit catalog of the museum, built from the practices of `content/practicas/` (F9). Exhibits follow
 * the `Exhibicion` contract; the museum map is generated from them.
 */
import type { Exhibicion } from '@rikuy/contracts';
import { PLANTILLAS, SALAS_CONTENIDO, generarMuseo, type Museo } from '@rikuy/campus';
import { PRACTICAS, textosParaEstudiantes } from '@rikuy/curriculum-cneb';
import { RETOS } from '@rikuy/retos';

/** Where each F9 practice stands in the museum and its short plaque name (presentation only). */
const UBICACION: Record<string, { id: string; salaId: string; pedestal: string; nombre: string }> = {
  pendulo: { id: 'exh-pendulo', salaId: 'sala-fisica', pedestal: 'p1', nombre: 'El péndulo' },
  lactasa: { id: 'exh-lactasa', salaId: 'sala-biologia', pedestal: 'p1', nombre: 'Lactasa: de la leche a la molécula' },
  respiratorio: { id: 'exh-respiracion', salaId: 'sala-biologia', pedestal: 'p2', nombre: 'Respiración en altura' },
};

/**
 * Hologram that an exhibit opens when it is richer than the practice's own scene: the lactase
 * exhibit of Sala Biología opens the digestive journey (tract -> wall -> villi -> lactase).
 */
const ESCENA_DE_EXHIBICION: Record<string, string> = { lactasa: 'digestivo' };

const UBICADAS = Object.entries(UBICACION).flatMap(([slug, u]) => {
  const practica = PRACTICAS[slug];
  return practica ? [{ slug, u, practica }] : [];
});

/** Exhibits = the approved practices of content/practicas (F9, via @rikuy/curriculum-cneb). */
export const EXHIBICIONES_DEMO: Exhibicion[] = UBICADAS.map(({ u, practica }) => ({ id: u.id, salaId: u.salaId, practicaId: practica.id, pedestal: u.pedestal, recursos: [] }));

export const TITULOS_DEMO: Record<string, string> = Object.fromEntries(UBICADAS.map(({ u }) => [u.id, u.nombre]));

/** Plaque question per exhibit: the reviewed Spanish guiding question of the practice (never an unreviewed text). */
export const PREGUNTAS_DEMO: Record<string, string> = Object.fromEntries(
  UBICADAS.flatMap(({ u, practica }) => {
    const textos = textosParaEstudiantes(practica);
    return textos ? [[u.id, textos.preguntaGuia]] : [];
  }),
);

/** Exhibit id -> slug of its practice (`/lab/<slug>`). */
export const SLUG_DE_EXHIBICION: Record<string, string> = Object.fromEntries(UBICADAS.map(({ slug, u }) => [u.id, slug]));

export const EXHIBICION_DEL_DIA = 'exh-pendulo';

export interface RetoResumen {
  id: string;
  titulo: string;
}

export function construirMuseo(opciones: { retos?: RetoResumen[]; rejasAbiertas?: ReadonlySet<string> } = {}): Museo {
  return generarMuseo({
    salas: SALAS_CONTENIDO,
    exhibiciones: EXHIBICIONES_DEMO,
    plantillas: PLANTILLAS,
    titulos: TITULOS_DEMO,
    retos: opciones.retos ?? RETOS.map((r) => ({ id: r.id, titulo: r.titulo })),
    ...(opciones.rejasAbiertas ? { rejasAbiertas: opciones.rejasAbiertas } : {}),
  });
}

/** Scene id the exhibit opens at `/holo/ver/<escena>`: the one its practice declares, else its slug. */
export function escenaHoloDeExhibicion(exhibicionId: string): string | undefined {
  const slug = SLUG_DE_EXHIBICION[exhibicionId];
  const practica = slug ? PRACTICAS[slug] : undefined;
  return practica && slug ? (ESCENA_DE_EXHIBICION[slug] ?? practica.escenaHolo ?? slug) : undefined;
}

/** The practice a hologram scene belongs to (its title and hints go to the viewer), if any. */
export function practicaDeEscena(escena: string) {
  return Object.entries(PRACTICAS).find(([slug, p]) => (ESCENA_DE_EXHIBICION[slug] ?? p.escenaHolo ?? slug) === escena || (p.escenaHolo ?? slug) === escena)?.[1];
}

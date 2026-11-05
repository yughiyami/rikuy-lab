/**
 * Rikuy's spoken guide for the digestive hologram: per level, a short narration and ONE Socratic
 * question asked before the reveal (predict -> observe -> explain). Pure data + a tiny state
 * machine; the UI speaks it and drives the hologram with the `revelar` actions.
 */
import type { ViewerAction } from '@rikuy/holo';
import { juzgarConReglas } from '@rikuy/tutor';

export interface Opcion {
  id: string;
  texto: string;
  correcta: boolean;
}

export interface PasoGuia {
  nivel: 0 | 1 | 2 | 3;
  /** Key of the recorded audio (content/audio/<lengua>/...) for each spoken block. */
  clave: string;
  narracion: string;
  pregunta: string;
  opciones: readonly Opcion[];
  /** What the hologram does when the students lock their prediction. */
  revelar: readonly ViewerAction[];
  explicacion: string;
  /** Concept words that make a student's explanation scientific (rules judge). */
  conceptos: readonly string[];
}

export const GUION: readonly PasoGuia[] = [
  {
    nivel: 0,
    clave: 'holo.digestivo.n0',
    narracion:
      'Hola, soy Rikuy. Este es el sistema digestivo: boca, esófago, estómago, intestino delgado e intestino grueso. El hígado y el páncreas ayudan con sus jugos. Mira el sorbo de leche que baja por el tubo.',
    pregunta: '¿En qué órgano crees que se digiere la lactosa, el azúcar de la leche?',
    opciones: [
      { id: 'a', texto: 'En el estómago', correcta: false },
      { id: 'b', texto: 'En el intestino delgado', correcta: true },
      { id: 'c', texto: 'En el intestino grueso', correcta: false },
    ],
    revelar: [{ type: 'release' }],
    explicacion:
      'En el intestino delgado. Ahí una enzima, la lactasa, rompe la lactosa en dos azúcares más pequeños que pasan a la sangre. Mira cómo el sorbo cambia de color en el intestino delgado. Pellizca o toca para profundizar.',
    conceptos: ['intestino', 'delgado', 'enzima', 'lactasa', 'absorbe', 'sangre'],
  },
  {
    nivel: 1,
    clave: 'holo.digestivo.n1',
    narracion:
      'Entramos a la pared del intestino delgado. Por fuera hay músculo que empuja el alimento. Por dentro hay pliegues cubiertos de millones de vellosidades.',
    pregunta: 'El intestino delgado mide unos seis metros y además tiene pliegues y vellosidades. ¿Para qué crees que sirven?',
    opciones: [
      { id: 'a', texto: 'Para tener más superficie y absorber más', correcta: true },
      { id: 'b', texto: 'Para proteger del frío', correcta: false },
      { id: 'c', texto: 'Para producir saliva', correcta: false },
    ],
    revelar: [{ type: 'release' }],
    explicacion:
      'Para aumentar la superficie. Los pliegues, las vellosidades y las microvellosidades multiplican el área donde los nutrientes pasan a la sangre. Profundicemos en una vellosidad.',
    conceptos: ['superficie', 'area', 'absorber', 'absorcion', 'nutrientes', 'sangre'],
  },
  {
    nivel: 2,
    clave: 'holo.digestivo.n2',
    narracion:
      'Esta es una vellosidad, con capilares y un vaso quilífero. Arriba ves las células del intestino con su borde en cepillo: las microvellosidades. Ahí está anclada la lactasa, los puntos verdes.',
    pregunta: 'Si una persona no produce lactasa, ¿qué crees que le pasa a la lactosa?',
    opciones: [
      { id: 'a', texto: 'Se absorbe igual', correcta: false },
      { id: 'b', texto: 'Sigue de largo hasta el intestino grueso', correcta: true },
      { id: 'c', texto: 'Se convierte en proteína', correcta: false },
    ],
    revelar: [{ type: 'variable', variable: 'lactasa', value: 0 }, { type: 'release' }],
    explicacion:
      'Sin lactasa, la lactosa no se rompe y no puede absorberse: sigue de largo. En el intestino grueso las bacterias la fermentan y producen gases. Eso es la intolerancia a la lactosa, muy común en el Perú. Vuelve al nivel 1 para ver las burbujas de gas.',
    conceptos: ['lactasa', 'enzima', 'romper', 'absorber', 'bacterias', 'fermentan', 'gas', 'intestino grueso'],
  },
  {
    nivel: 3,
    clave: 'holo.digestivo.n3',
    narracion:
      'Este es el nivel de las moléculas. La cinta es el esqueleto real de una enzima de la familia de la lactasa, medida en un laboratorio. La lactosa encaja en el sitio activo y se rompe en glucosa y galactosa, que cruzan la membrana.',
    pregunta: 'La lactasa es una proteína. ¿Qué crees que le pasaría si la calentamos a 70 grados?',
    opciones: [
      { id: 'a', texto: 'Trabajaría más rápido', correcta: false },
      { id: 'b', texto: 'Perdería su forma y dejaría de funcionar', correcta: true },
      { id: 'c', texto: 'Se convertiría en lactosa', correcta: false },
    ],
    revelar: [{ type: 'variable', variable: 'temperatura', value: 70 }, { type: 'release' }],
    explicacion:
      'Con mucho calor la proteína pierde su forma: se desnaturaliza. Si el sitio activo cambia de forma, la lactosa ya no encaja y no se rompe. Forma y función van juntas.',
    conceptos: ['forma', 'proteina', 'enzima', 'sitio activo', 'encaja', 'desnaturaliza', 'calor', 'temperatura'],
  },
];

export function pasoDeNivel(nivel: number): PasoGuia {
  return GUION[Math.min(GUION.length - 1, Math.max(0, Math.round(nivel)))];
}

export type Fase = 'narracion' | 'pregunta' | 'observacion' | 'explicacion';

export interface EstadoGuia {
  nivel: 0 | 1 | 2 | 3;
  fase: Fase;
  /** Prediction chosen before the reveal (null until the students commit). */
  prediccion: string | null;
}

export type EventoGuia = { tipo: 'siguiente' } | { tipo: 'predecir'; opcion: string } | { tipo: 'nivel'; nivel: number };

/** predict -> observe -> explain. A prediction must be locked before the reveal (no skipping). */
export function avanzarGuia(e: EstadoGuia, ev: EventoGuia): EstadoGuia {
  if (ev.tipo === 'nivel') {
    const nivel = pasoDeNivel(ev.nivel).nivel;
    return nivel === e.nivel ? e : { nivel, fase: 'narracion', prediccion: null };
  }
  if (ev.tipo === 'predecir') {
    if (e.fase !== 'pregunta') return e;
    const paso = pasoDeNivel(e.nivel);
    return paso.opciones.some((o) => o.id === ev.opcion) ? { ...e, fase: 'observacion', prediccion: ev.opcion } : e;
  }
  const orden: Fase[] = ['narracion', 'pregunta', 'observacion', 'explicacion'];
  if (e.fase === 'pregunta') return e; // needs a prediction
  const i = orden.indexOf(e.fase);
  return i < orden.length - 1 ? { ...e, fase: orden[i + 1] } : e;
}

/** Spoken feedback on the prediction, never a score: it invites to compare with what happened. */
export function reaccion(paso: PasoGuia, opcion: string | null): string {
  const elegida = paso.opciones.find((o) => o.id === opcion);
  if (!elegida) return '';
  return elegida.correcta ? 'Tu predicción coincide con lo que se ve. ¿Por qué crees que pasa?' : 'Mira bien el holograma: ¿pasó lo que predijiste? Compara y busca la causa.';
}

export interface ValoracionExplicacion {
  nivel: 0 | 1 | 2 | 3 | null;
  cita: string;
  mensaje: string;
}

/**
 * The students' own explanation, judged by the F4 rules judge (indicator `justificacion`,
 * level + literal quote, "NO" when it cannot be assessed). Runs offline.
 */
export function valorarExplicacion(texto: string, paso: PasoGuia): ValoracionExplicacion {
  const v = juzgarConReglas({
    indicador: 'justificacion',
    respuesta: texto,
    contexto: { variables: [], variableProbada: '', conceptos: paso.conceptos },
    datos: [],
  });
  if (v.estado === 'no_observable') return { nivel: null, cita: '', mensaje: 'Aún no puedo valorar tu explicación. Usa una frase con “porque”.' };
  const nivel = v.nivel as 0 | 1 | 2 | 3;
  const mensaje =
    nivel >= 3
      ? 'Explicas la causa con ideas científicas. ¡Bien!'
      : nivel === 2
        ? 'Das una razón. ¿Puedes usar una idea de ciencia, como enzima, superficie o forma?'
        : 'Agrega el porqué: ¿qué causa lo que viste?';
  return { nivel, cita: v.cita, mensaje };
}

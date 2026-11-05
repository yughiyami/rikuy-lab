/**
 * Mock mode (4.5): deterministic fixtures standing in for Gemini and Muse. No keys, no network, no cost.
 * Demos and tests never depend on credits.
 */
import type { Adaptador } from '../enrutador.ts';
import type { BorradorPractica, SolicitudPractica } from '../esquemas.ts';
import { ok } from '../result.ts';
import { planSimulado } from '../plan/muestra.ts';

/** A complete, valid pendulum draft quoting `cita`. */
export function borradorSimulado(cita: string): BorradorPractica {
  return {
    titulo: 'El péndulo: ¿qué cambia el periodo?',
    preguntaGuia: '¿De qué depende el tiempo que tarda un péndulo en ir y volver?',
    citaDesempeno: cita,
    materiales: [
      { nombre: 'Cuerda', casero: true },
      { nombre: 'Tuerca o piedra pequeña', casero: true },
      { nombre: 'Reloj o cronómetro del celular', casero: true },
    ],
    variables: [{ id: 'longitud', etiqueta: 'Longitud de la cuerda', unidad: 'm', min: 0.2, max: 1.5, paso: 0.1, porDefecto: 0.5 }],
    protocolo: { repeticiones: 10, valoresIndependiente: [0.3, 0.6, 0.9], magnitud: 'periodo', unidad: 's' },
    modeloId: 'pendulo',
    pistas: [
      '¿Qué podrías cambiar en el péndulo para que vaya y vuelva más rápido?',
      'Prueba con dos cuerdas de distinto largo y la misma tuerca.',
      'Cuenta 10 vueltas con cada largo y divide el tiempo entre 10.',
    ],
    limitaciones: ['El modelo supone oscilaciones pequeñas y sin rozamiento del aire.'],
    resultadoEsperado: {
      valores: [1.1, 1.55, 1.9],
      unidad: 's',
      conclusion: 'El periodo aumenta cuando aumenta la longitud de la cuerda y no depende de la masa.',
    },
    quiz: [
      {
        enunciado: 'Si acortas la cuerda del péndulo, ¿qué pasa con el tiempo de cada vuelta?',
        opciones: ['Aumenta', 'Disminuye', 'No cambia'],
        correcta: 1,
        retro: ['Mide otra vez con una cuerda más corta y compara con tu tabla.'],
      },
    ],
    diagrama: {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><line x1="50" y1="5" x2="50" y2="70" stroke="#333" stroke-width="2"/><circle cx="50" cy="76" r="7" fill="#c97b2a"/></svg>',
      etiquetas: { cuerda: 'Cuerda', masa: 'Tuerca' },
    },
    guionVideo: ['Muestra un péndulo en reposo.', 'Suéltalo y cuenta una vuelta completa.', 'Repite con una cuerda más larga.'],
    pictogramas: [{ id: 'cuerda', descripcion: 'Una cuerda atada a una tuerca' }],
  };
}

const PICTOGRAMA_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f6efe2"/><line x1="32" y1="6" x2="32" y2="40" stroke="#333" stroke-width="3"/><circle cx="32" cy="46" r="8" fill="#c97b2a"/></svg>';

export interface OpcionesSimulado {
  /** Override the draft (tests inject bad drafts to exercise the verifier). */
  borrador?: (s: SolicitudPractica) => BorradorPractica;
}

/** Returns the stand-ins for Gemini (generation, table vision, translation) and Meta (review, pictograms). */
export function crearAdaptadoresSimulados(opciones: OpcionesSimulado = {}): Adaptador[] {
  const gemini: Adaptador = {
    nombre: 'gemini',
    fuente: 'ia-nube',
    modelo: 'simulado-gemini',
    simulado: true,
    disponible: () => true,
    costoEstimadoUsd: () => 0.01, // lets the demo exercise the quota path
    capacidades: {
      generarPractica: {
        generar: async (s, ctx) => {
          ctx?.registrarUso({ endpoint: 'simulado/generar', proposito: 'generarPractica', tokensEntrada: 0, tokensSalida: 0, costoUsd: 0 });
          return ok(opciones.borrador ? opciones.borrador(s) : borradorSimulado(s.desempeno.cita));
        },
      },
      visionTabla: {
        leer: async () => ok([{ etiqueta: '0,3 m', valor: 1.1, unidad: 's' }, { etiqueta: '0,6 m', valor: 1.55, unidad: 's' }]),
      },
      traducir: {
        traducir: async (texto, a) => ok({ texto: `[borrador ${a}] ${texto}`, lengua: a, revisado: false as const }),
      },
      tutorDialogo: {
        turno: async (_i, _c, ctx) => {
          ctx?.registrarUso({ endpoint: 'simulado/tutor', proposito: 'tutorDialogo', costoUsd: 0 });
          return ok({ texto: '¿Qué cambió en tus mediciones cuando cambiaste una sola cosa?' });
        },
      },
      extraerPlan: {
        extraer: async (_archivos, ctx) => {
          ctx?.registrarUso({ endpoint: 'simulado/extraer-plan', proposito: 'extraerPlan', tokensEntrada: 0, tokensSalida: 0, costoUsd: 0 });
          return ok(planSimulado());
        },
      },
    },
  };
  const meta: Adaptador = {
    nombre: 'meta',
    fuente: 'ia-nube',
    modelo: 'simulado-muse',
    simulado: true,
    disponible: () => true,
    costoEstimadoUsd: () => 0.01, // lets the demo exercise the quota path
    capacidades: {
      revisarPractica: {
        revisar: async (_b, ctx) => {
          ctx?.registrarUso({ endpoint: 'simulado/responses', proposito: 'revisarPractica', costoUsd: 0 });
          return ok({ veredicto: 'ok' as const, observaciones: [], modelo: 'simulado-muse' });
        },
      },
      revisarPista: {
        revisar: async () => ok({ veredicto: 'ok' as const, motivo: '' }),
      },
      pictogramas: {
        generar: async (_p, ctx) => {
          ctx?.registrarUso({ endpoint: 'simulado/images', proposito: 'pictogramas', imagenes: 1, costoUsd: 0 });
          return ok(new Blob([PICTOGRAMA_SVG], { type: 'image/svg+xml' }));
        },
      },
    },
  };
  return [gemini, meta];
}

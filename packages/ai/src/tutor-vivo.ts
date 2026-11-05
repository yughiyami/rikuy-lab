/**
 * Live tutor (Rikuy with a cloud model): Socratic dialogue turns, hint review, inquiry judge and voice.
 * The model only PROPOSES; deterministic code decides what reaches the student:
 *  - `pistaNoRevela` (@rikuy/tutor) rejects any reply that leaks the expected result or conclusion;
 *  - only the first question is kept (one question at a time);
 *  - hints get a second reviewer (Meta Muse) when available;
 *  - the judge keeps the literal-quote rule and falls back to the rules judge (`juzgarConModelo`).
 * On any failure the caller (web) falls back to the rules agent, which works offline.
 */
import { construirPromptJuez, juzgarConModelo, pistaNoRevela, type CorridaModelo, type ModeloJuez, type SolicitudJuez, type VeredictoJuez } from '@rikuy/tutor';
import { type EntradaTutorVivo } from './esquemas-tutor.ts';
import type { Enrutador, Peticion } from './enrutador.ts';
import type { FalloIA } from './puertos.ts';
import { err, ok, type Result } from './result.ts';

// ------------------------------------------------------------------ prompts

export const INSTRUCCIONES_TUTOR = [
  'Eres Rikuy, un tutor socrático de ciencia y tecnología para estudiantes de 2.º de secundaria del Perú (CNEB, competencia "Indaga mediante métodos científicos").',
  'Hablas en castellano claro, cálido y breve (máximo 3 oraciones cortas). Tuteas.',
  'NUNCA das la respuesta, el resultado numérico ni la conclusión esperada. Ayudas a pensar con UNA sola pregunta por turno, al final.',
  'Cuando el grupo tiene mediciones, cítalas con sus valores ("con 0,3 m midieron 1,1 s") para que razonen sobre SUS datos.',
  'Si te piden la respuesta, di que no la darás y ofrece una pregunta que los acerque.',
  'No hables de emociones ni del estado de ánimo. No pidas datos personales. Eres un programa, no una persona.',
  'Si te dan fragmentos del currículo o de fuentes, básate en ellos y nombra la fuente entre paréntesis.',
  'Responde SOLO con JSON: {"texto": "..."}.',
].join('\n');

const MODO: Record<EntradaTutorVivo['modo'], string> = {
  dialogo: 'Responde al estudiante con una pregunta que lo haga pensar.',
  pista: 'Da una PISTA del nivel indicado (1 = general, 2 = qué comparar, 3 = mira tus datos). Una pista no es la respuesta.',
  curador: 'Eres la curadora o el curador de esta sala del museo. Responde la pregunta libre con lo que muestra la sala, sin dar conclusiones de la práctica, y termina con una pregunta.',
};

export function construirPromptTutor(e: EntradaTutorVivo): string {
  const p = e.practica;
  return [
    `<modo>${MODO[e.modo]}${e.modo === 'pista' && e.nivelPista ? ` Nivel de pista: ${e.nivelPista}.` : ''}</modo>`,
    p ? `<pregunta_guia>${p.preguntaGuia}</pregunta_guia>` : '',
    p?.variables.length ? `<variables>${p.variables.join(', ')}</variables>` : '',
    p?.limitaciones.length ? `<limitaciones_del_modelo>${p.limitaciones.join(' | ')}</limitaciones_del_modelo>` : '',
    e.datos.length ? `<datos_medidos_por_el_grupo>${e.datos.map((d) => `${d.x} → ${d.y}`).join('; ')}</datos_medidos_por_el_grupo>` : '<datos_medidos_por_el_grupo>todavía no midieron</datos_medidos_por_el_grupo>',
    e.sala ? `<sala nombre="${e.sala.nombre}">${e.sala.descripcion}</sala>` : '',
    e.contexto?.fragmentos.length ? `<fragmentos>${e.contexto.fragmentos.map((f, i) => `[${e.contexto!.fuentes[i] ?? `fuente ${i + 1}`}] ${f}`).join('\n')}</fragmentos>` : '',
    e.historial.length ? `<conversacion>${e.historial.map((h) => `${h.autor === 'alumno' ? 'Estudiante' : 'Rikuy'}: ${h.texto}`).join('\n')}</conversacion>` : '',
    `<mensaje_del_estudiante>${e.mensaje}</mensaje_del_estudiante>`,
  ]
    .filter(Boolean)
    .join('\n');
}

export const INSTRUCCIONES_REVISOR_PISTA = [
  'Eres un segundo revisor de pistas de un tutor escolar de ciencias. Responde SOLO con JSON {"veredicto": "ok"|"revela", "motivo": "..."}.',
  'Marca "revela" si la pista da el resultado numérico, la conclusión esperada o la respuesta a la pregunta guía; o si no es apropiada para 2.º de secundaria.',
].join(' ');

// ------------------------------------------------------------------ deterministic guards

/** One question at a time: keeps the text up to the first question mark. */
export function unaPregunta(texto: string): string {
  const t = texto.trim();
  const i = t.indexOf('?');
  if (i < 0) return t;
  const resto = t.slice(i + 1);
  return resto.includes('?') ? t.slice(0, i + 1).trim() : t;
}

export type FalloTutor = FalloIA | { tipo: 'revela'; detalle: string };

export interface TurnoVivo {
  texto: string;
  modelo?: string;
  revisadoPor?: string;
  simulado: boolean;
}

export async function turnoTutorVivo(enrutador: Enrutador, peticion: Peticion, e: EntradaTutorVivo): Promise<Result<TurnoVivo, FalloTutor>> {
  const r = await enrutador.ejecutar('tutorDialogo', peticion, (impl, ctx) => impl.turno(INSTRUCCIONES_TUTOR, construirPromptTutor(e), ctx));
  if (!r.resultado.ok) return err(r.resultado.error);
  const texto = unaPregunta(r.resultado.valor.texto);
  const guardia = pistaNoRevela(texto, { numeros: e.reservados.numeros, frases: e.reservados.frases });
  if (!guardia.ok) return err({ tipo: 'revela', detalle: `El verificador rechazó la respuesta (${guardia.motivo}).` });

  let revisadoPor: string | undefined;
  if (e.modo === 'pista') {
    const contexto = [e.practica?.preguntaGuia ?? '', ...e.reservados.frases].join(' | ');
    const rev = await enrutador.ejecutar('revisarPista', peticion, (impl, ctx) => impl.revisar(texto, contexto, ctx));
    if (rev.resultado.ok) {
      if (rev.resultado.valor.veredicto === 'revela') return err({ tipo: 'revela', detalle: 'El segundo revisor marcó que la pista revela la respuesta.' });
      revisadoPor = rev.modelo;
    }
    // A missing second reviewer does not block: the deterministic verifier already passed.
  }
  return ok({ texto, simulado: r.simulado ?? false, ...(r.modelo ? { modelo: r.modelo } : {}), ...(revisadoPor ? { revisadoPor } : {}) });
}

/** Judge over the router: 3 runs, literal quote, rules fallback (all inside `juzgarConModelo`). */
export async function juzgarConIA(enrutador: Enrutador, peticion: Peticion, s: SolicitudJuez, corridas = 3): Promise<VeredictoJuez> {
  const { system, user } = construirPromptJuez(s);
  const modelo: ModeloJuez = {
    fuente: 'ia-nube',
    async juzgar(): Promise<Result<CorridaModelo, FalloIA>> {
      const r = await enrutador.ejecutar('juzgarIndagacion', peticion, (impl, ctx) => impl.juzgar(system, user, ctx));
      if (!r.resultado.ok) return err(r.resultado.error);
      const n = r.resultado.valor.nivel;
      return ok({ nivel: n === 'NO' ? 'NO' : (Number(n) as 0 | 1 | 2 | 3), cita: r.resultado.valor.cita });
    },
  };
  return juzgarConModelo(modelo, s, { corridas });
}

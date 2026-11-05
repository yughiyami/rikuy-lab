/**
 * Curriculum grounding for the tutor (RAG): answers and hints may cite only retrieved CNEB chunks,
 * and any CNEB claim must be literally inside one of them.
 */
import { citarFuente, type Fragmento, type IndiceCurricular } from '@rikuy/curriculum-cneb';

export interface Fundamento {
  fragmento: Fragmento;
  cita: string;
}

/** Best retrieved chunk for the student's message, with its citation; undefined when nothing matches. */
export function fundamentoCurricular(consulta: string, indice: IndiceCurricular): Fundamento | undefined {
  const [mejor] = indice.buscar(consulta, 1);
  return mejor ? { fragmento: mejor.fragmento, cita: citarFuente(mejor.fragmento.fuente) } : undefined;
}

const normalizar = (s: string): string => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();

/** Rejects ungrounded CNEB claims: the quoted text must appear in a retrieved chunk. */
export function afirmacionFundamentada(cita: string, recuperados: readonly Fragmento[]): boolean {
  const c = normalizar(cita);
  return c.length > 0 && recuperados.some((f) => normalizar(f.texto).includes(c));
}

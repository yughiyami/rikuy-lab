/**
 * Offline curriculum retrieval (RAG, retrieval half): BM25 over chunks of the CNEB with the exact
 * source of each chunk (document, section, page). Runs on the phone with no network and no model.
 * Hubs or the cloud may add embeddings through memoria's optional IndiceVectorial; this lexical
 * index is the floor every device has.
 */
import oficial from '../../data/cneb-oficial.json';
import { subconjunto } from '../datos.ts';

export interface FuenteFragmento {
  documento: string;
  seccion: string;
  /** PDF page of the official document, or null when the text has no verified page. */
  pagina: number | null;
  /** true only when the text was checked literally against the official PDF text layer. */
  verificado: boolean;
  url?: string;
}

export interface Fragmento {
  id: string;
  texto: string;
  fuente: FuenteFragmento;
}

export interface ResultadoBusqueda {
  fragmento: Fragmento;
  puntaje: number;
}

export interface IndiceCurricular {
  readonly tamano: number;
  buscar(consulta: string, limite?: number): ResultadoBusqueda[];
}

const STOPWORDS = new Set(
  'a al algo ante con contra cual cuando de del desde donde e el ella ellas ellos en entre era es esa ese eso esta este esto fue ha hay la las le les lo los mas me mi muy no o os para pero por que quien se sea segun ser si sin sobre son su sus tambien te tiene u un una uno unos unas y ya yo como cada otro otra otros otras'.split(' '),
);

/** Longest first; applied once, only when at least 4 letters remain (stemming-lite, not Snowball). */
const SUFIJOS = [
  'amientos', 'imientos', 'amiento', 'imiento', 'aciones', 'iciones', 'idades', 'ancias', 'encias', 'acion', 'icion', 'mente', 'ables', 'ibles', 'idad',
  'ancia', 'encia', 'able', 'ible', 'icos', 'icas', 'ivos', 'ivas', 'ados', 'idos', 'adas', 'idas', 'ando', 'iendo', 'ores', 'ico', 'ica', 'ivo', 'iva',
  'ado', 'ido', 'ada', 'ida', 'or', 'es', 'os', 'as', 's', 'o', 'a', 'e',
];

const sinAcentos = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function raiz(palabra: string): string {
  const p = sinAcentos(palabra);
  for (const suf of SUFIJOS) if (p.endsWith(suf) && p.length - suf.length >= 4) return p.slice(0, -suf.length);
  return p;
}

export function tokenizar(texto: string): string[] {
  return (sinAcentos(texto).match(/[a-z0-9ñ]+/g) ?? []).filter((t) => t.length > 1 && !STOPWORDS.has(t)).map(raiz);
}

const K1 = 1.2;
const B = 0.75;

export function construirIndice(fragmentos: readonly Fragmento[]): IndiceCurricular {
  const docs = fragmentos.map((f) => {
    const tf = new Map<string, number>();
    const tokens = tokenizar(`${f.texto} ${f.fuente.seccion}`);
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { f, tf, largo: tokens.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const promedio = docs.reduce((s, d) => s + d.largo, 0) / Math.max(1, n);
  const idf = (t: string): number => {
    const k = df.get(t) ?? 0;
    return Math.log(1 + (n - k + 0.5) / (k + 0.5));
  };

  return {
    tamano: n,
    buscar(consulta, limite = 5) {
      const terminos = [...new Set(tokenizar(consulta))];
      if (terminos.length === 0) return [];
      const resultados: ResultadoBusqueda[] = [];
      for (const d of docs) {
        let puntaje = 0;
        for (const t of terminos) {
          const f = d.tf.get(t);
          if (!f) continue;
          puntaje += idf(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.largo) / promedio)));
        }
        if (puntaje > 0) resultados.push({ fragmento: d.f, puntaje });
      }
      return resultados.sort((a, b) => b.puntaje - a.puntaje || a.fragmento.id.localeCompare(b.fragmento.id)).slice(0, limite);
    },
  };
}

interface CnebOficial {
  documento: { titulo: string; url: string; norma: string };
  fragmentos: { id: string; seccion: string; paginaPdf: number; texto: string }[];
  verificacionSecundaria: { estandares: { ciclo: string; competencia: number; competenciaCneb: number; paginaPdf: number; verificado: boolean }[] };
}

const CNEB = oficial as CnebOficial;
const DOC_CNEB = `${CNEB.documento.titulo} (MINEDU, ${CNEB.documento.norma})`;
const DOC_PROGRAMA = 'Programa Curricular de Educación Secundaria (MINEDU, 2016)';
const URL_PROGRAMA = 'https://www.minedu.gob.pe/curriculo/pdf/programa-curricular-educacion-secundaria.pdf';

/** The CNEB chunks: official paragraphs, secondary standards (cycles VI and VII) and per-grade performances. */
export function corpusCneb(): Fragmento[] {
  const salida: Fragmento[] = CNEB.fragmentos.map((f) => ({
    id: f.id,
    texto: f.texto,
    fuente: { documento: DOC_CNEB, seccion: f.seccion, pagina: f.paginaPdf, verificado: true, url: CNEB.documento.url },
  }));
  const vistos = new Set<string>();
  for (const g of subconjunto.grados.filter((x) => x.nivel === 'secundaria')) {
    for (const c of g.competencias) {
      const clave = `estandar:${g.ciclo}:${c.numero}`;
      const v = CNEB.verificacionSecundaria.estandares.find((e) => e.ciclo === g.ciclo && e.competencia === c.numero);
      if (!vistos.has(clave)) {
        vistos.add(clave);
        salida.push({
          id: clave,
          texto: c.estandar,
          fuente: {
            documento: DOC_CNEB,
            seccion: `Estándar de la competencia ${v?.competenciaCneb ?? c.numero} (${c.nombre}), nivel esperado al final del ciclo ${g.ciclo}`,
            pagina: v?.verificado ? v.paginaPdf : null,
            verificado: v?.verificado ?? false,
            url: CNEB.documento.url,
          },
        });
      }
      c.desempenos.forEach((texto, i) => {
        salida.push({
          id: `desempeno:${g.id}:c${c.numero}:d${i + 1}`,
          texto,
          fuente: { documento: DOC_PROGRAMA, seccion: `${g.nombre} · Competencia ${c.numero}: ${c.nombre} · desempeño ${i + 1}`, pagina: null, verificado: false, url: URL_PROGRAMA },
        });
      });
    }
  }
  return salida;
}

/** One-line human citation: "documento, sección, pág. N del PDF" or "(texto por verificar)". */
export function citarFuente(f: FuenteFragmento): string {
  const pagina = f.pagina === null ? '' : `, pág. ${f.pagina} del PDF`;
  return `${f.documento}. ${f.seccion}${pagina}${f.verificado ? '' : ' (texto por verificar contra el PDF oficial)'}`;
}

let indiceCneb: IndiceCurricular | undefined;
/** Lazily built CNEB index (shared). */
export function indiceCurricular(): IndiceCurricular {
  indiceCneb ??= construirIndice(corpusCneb());
  return indiceCneb;
}

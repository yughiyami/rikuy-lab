/**
 * Builds data/cneb-oficial.json from the official MINEDU CNEB PDF (text layer, not OCR).
 *
 * Usage (from packages/curriculum-cneb):
 *   curl -o cneb.pdf https://www.minedu.gob.pe/curriculo/pdf/curriculo-nacional-de-la-educacion-basica.pdf
 *   for p in $(seq 1 224); do pdftotext -enc UTF-8 -f $p -l $p cneb.pdf <dir>/p$p.txt; done
 *   node scripts/construir-cneb-oficial.mjs <dir> cneb.pdf
 *
 * Output: page-anchored paragraphs of the transversal approaches and of the three science and
 * technology competencies, plus a literal check of every secondary standard and capacity in
 * data/cneb-cyt.json against the official text (same normalization as the check below).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const [dir, pdf] = process.argv.slice(2);
if (!dir || !pdf) {
  console.error('Uso: node scripts/construir-cneb-oficial.mjs <directorio con p<N>.txt> <cneb.pdf>');
  process.exit(2);
}

const URL = 'https://www.minedu.gob.pe/curriculo/pdf/curriculo-nacional-de-la-educacion-basica.pdf';
/** The printed page number is the PDF page minus 2 (PDF page 122 prints "120"). */
const DESFASE_IMPRESA = 2;

const SECCIONES = [
  { paginas: [21, 22, 23, 24, 25, 26, 27, 28, 29], seccion: 'II. Enfoques transversales para el desarrollo del Perfil de egreso' },
  { paginas: [122], seccion: 'Competencia 20: Indaga mediante métodos científicos para construir sus conocimientos' },
  { paginas: [127], seccion: 'Competencia 21: Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo' },
  { paginas: [130], seccion: 'Competencia 22: Diseña y construye soluciones tecnológicas para resolver problemas de su entorno' },
];
/** Pages holding the level descriptions (standards) of each competency (1 = C20, 2 = C21, 3 = C22). */
const PAGINA_ESTANDARES = { 1: 125, 2: 129, 3: 133 };
const NUMERO_CNEB = { 1: 20, 2: 21, 3: 22 };

const CABECERAS = [/^cn Currículo Nacional$/, /^Ministerio de Educación$/, /^IV\. Competencias, capacidades/, /^II\. Enfoques transversales para el desarrollo del Perfil de egreso$/, /^\d{1,3}$/, /^C2\d$/, /^D$/];

const leer = (p) => readFileSync(join(dir, `p${p}.txt`), 'utf8').normalize('NFC');
const limpiarLineas = (texto) =>
  texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !CABECERAS.some((re) => re.test(l)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/(\p{L})- (\p{Ll})/gu, '$1$2')
    .trim();
const norm = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase().replace(/\.$/, '');

/** Splits on sentence ends and bullets, then packs sentences into paragraphs of at most ~600 chars. */
function parrafos(texto) {
  const frases = texto.split(/(?<=[.:;])\s+(?=[•A-ZÁÉÍÓÚÑ0-9])|\s(?=•)/u).map((f) => f.trim()).filter(Boolean);
  const salida = [];
  let actual = '';
  for (const f of frases) {
    if (actual && actual.length + f.length > 600) {
      salida.push(actual);
      actual = f;
    } else actual = actual ? `${actual} ${f}` : f;
  }
  if (actual) salida.push(actual);
  return salida.filter((p) => p.length >= 40);
}

const fragmentos = [];
for (const { paginas, seccion } of SECCIONES) {
  for (const p of paginas) {
    parrafos(limpiarLineas(leer(p))).forEach((texto, i) => {
      fragmentos.push({ id: `cneb-p${p}-${i + 1}`, seccion, paginaPdf: p, paginaImpresa: p - DESFASE_IMPRESA, texto });
    });
  }
}

// Literal check of the secondary subset (cycles VI and VII) against the official pages.
const paginasNorm = Object.fromEntries(
  Array.from({ length: 224 }, (_, i) => i + 1).map((p) => [p, norm(leer(p).split(/\r?\n/).filter((l) => !/^\s*(\d{1,3}|D)\s*$/.test(l)).join(' '))]),
);
const ubicar = (texto) => Object.keys(paginasNorm).filter((p) => paginasNorm[p].includes(norm(texto))).map(Number);

const subconjunto = JSON.parse(readFileSync(join(aqui, '..', 'data', 'cneb-cyt.json'), 'utf8'));
const estandares = [];
const capacidades = [];
const vistos = new Set();
for (const g of subconjunto.grados.filter((x) => x.nivel === 'secundaria')) {
  for (const c of g.competencias) {
    const clave = `${g.ciclo}:${c.numero}`;
    if (!vistos.has(clave)) {
      vistos.add(clave);
      const pagina = PAGINA_ESTANDARES[c.numero];
      const verificado = paginasNorm[pagina]?.includes(norm(c.estandar)) ?? false;
      estandares.push({ ciclo: g.ciclo, competencia: c.numero, competenciaCneb: NUMERO_CNEB[c.numero], paginaPdf: pagina, paginaImpresa: pagina - DESFASE_IMPRESA, verificado });
    }
    for (const cap of c.capacidades) {
      const k = `${c.numero}:${cap}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      const paginas = ubicar(cap);
      capacidades.push({ competencia: c.numero, texto: cap, verificado: paginas.length > 0, paginasPdf: paginas });
    }
  }
}

const bytes = readFileSync(pdf);
const salida = {
  version: 1,
  documento: {
    titulo: 'Currículo Nacional de la Educación Básica',
    institucion: 'Ministerio de Educación del Perú (MINEDU)',
    norma: 'RM N.º 281-2016-MINEDU',
    url: URL,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    paginas: 224,
    extraccion: 'Capa de texto del PDF (pdftotext, poppler), sin OCR. Párrafos reagrupados por oraciones.',
    fechaDescarga: '2026-11-05',
  },
  fragmentos,
  verificacionSecundaria: { estandares, capacidades },
};
const destino = join(aqui, '..', 'data', 'cneb-oficial.json');
writeFileSync(destino, `${JSON.stringify(salida, null, 1)}\n`, 'utf8');
console.log(`Escrito ${destino}: ${fragmentos.length} fragmentos; estándares verificados ${estandares.filter((e) => e.verificado).length}/${estandares.length}; capacidades verificadas ${capacidades.filter((c) => c.verificado).length}/${capacidades.length}.`);

/**
 * "Buscar en el currículo": offline BM25 search over the CNEB (official text with PDF page,
 * secondary performances flagged as unverified) and the approved teacher plan.
 */
import { citarFuente, construirIndice, corpusCneb, type Fragmento, type ResultadoBusqueda } from '@rikuy/curriculum-cneb';
import { useMemo, useState } from 'react';
import { usePlanClase } from '../plan/usePlanClase.ts';

function fragmentosDelPlan(plan: unknown): Fragmento[] {
  if (!plan || typeof plan !== 'object') return [];
  const texto = JSON.stringify(plan)
    .replace(/[{}[\]"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return texto ? [{ id: 'plan:aprobado', texto: texto.slice(0, 2000), fuente: { documento: 'Mi plan (plan docente aprobado)', seccion: 'Plan de la clase', pagina: null, verificado: true } }] : [];
}

export function BuscarCurriculoVista({ buscar }: { buscar(consulta: string): ResultadoBusqueda[] }) {
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusqueda[] | undefined>();
  return (
    <section aria-labelledby="buscar-curriculo" className="flex flex-col gap-3 p-4">
      <h2 id="buscar-curriculo" className="text-lg font-semibold">
        Buscar en el currículo
      </h2>
      <p className="text-sm text-[#4D6368]">Búsqueda sin conexión en el CNEB de Ciencia y Tecnología y en tu plan aprobado. Cada resultado indica su fuente exacta.</p>
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setResultados(buscar(consulta));
        }}
      >
        <label htmlFor="consulta-curriculo" className="sr-only">
          Qué buscas en el currículo
        </label>
        <input
          id="consulta-curriculo"
          className="dc-input min-h-11 flex-1"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Por ejemplo: hipótesis y variables"
        />
        <button type="submit" disabled={consulta.trim() === ''} className="dc-btn dc-btn--primary min-h-11 disabled:opacity-50">
          Buscar
        </button>
      </form>
      {resultados === undefined ? null : resultados.length === 0 ? (
        <p role="status">No encontramos fragmentos con esas palabras.</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Resultados">
          {resultados.map(({ fragmento }) => (
            <li key={fragmento.id} className="rounded-lg border border-neutral-700 p-3">
              <p>{fragmento.texto}</p>
              <p className="mt-2 text-xs text-[#4D6368]">
                Fuente: {citarFuente(fragmento.fuente)}
                {fragmento.fuente.url ? (
                  <>
                    {' '}
                    <a href={fragmento.fuente.url} target="_blank" rel="noreferrer" className="underline">
                      Abrir PDF
                    </a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function BuscarCurriculo() {
  const plan = usePlanClase();
  const indice = useMemo(() => construirIndice([...corpusCneb(), ...fragmentosDelPlan(plan)]), [plan]);
  return <BuscarCurriculoVista buscar={(c) => indice.buscar(c, 8)} />;
}

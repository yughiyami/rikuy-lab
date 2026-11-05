/**
 * Item bank with provenance for the teacher: every item shows its source, licence and whether it is
 * an official released item or a team practice item. Results are item-level and per capacity (no ranking).
 */
import { ITEMS, etiquetaProcedencia, type ItemEvaluacion } from '@rikuy/curriculum-cneb';

const TEMAS: Record<ItemEvaluacion['tema'], string> = { pendulo: 'Péndulo y movimiento', lactasa: 'Digestión y enzimas', respiratorio: 'Respiración', materiales: 'Materiales' };

export function BancoItemsVista({ items }: { items: readonly ItemEvaluacion[] }) {
  return (
    <section aria-labelledby="banco-items" className="flex flex-col gap-3 p-4">
      <h2 id="banco-items" className="text-lg font-semibold">
        Banco de ítems
      </h2>
      <p className="text-sm text-neutral-400">Preguntas para el antes y después de cada práctica y para el Reto. Se informa el porcentaje de aciertos por ítem y por capacidad, sin ranking de estudiantes.</p>
      {items.length === 0 ? <p role="status">Aún no hay ítems con fuente verificada.</p> : null}
      {Object.entries(TEMAS).map(([tema, titulo]) => {
        const delTema = items.filter((i) => i.tema === tema);
        if (delTema.length === 0) return null;
        return (
          <section key={tema} aria-label={titulo}>
            <h3 className="font-medium">{titulo}</h3>
            <ul className="flex flex-col gap-2">
              {delTema.map((i) => (
                <li key={i.id} className="rounded-lg border border-neutral-700 p-3">
                  <p>{i.enunciado}</p>
                  {i.opciones ? (
                    <ol className="ml-4 list-[upper-alpha] text-sm">
                      {i.opciones.map((o) => (
                        <li key={o.clave}>{o.texto}</li>
                      ))}
                    </ol>
                  ) : null}
                  <p className="mt-1 text-xs text-neutral-400">
                    {etiquetaProcedencia(i)} · Competencia {i.competencia}, {i.capacidad} · {i.grado}.º de secundaria · Licencia: {i.licencia.nombre}{' '}
                    <a href={i.fuente.url} target="_blank" rel="noreferrer" className="underline">
                      Ver fuente
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}

export function BancoItems() {
  return <BancoItemsVista items={ITEMS} />;
}

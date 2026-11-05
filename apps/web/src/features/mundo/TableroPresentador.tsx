/**
 * Presenter grading board (`#/presentador/tablero`, projector): the audience answers of the "Sala del
 * público" as they arrive over the hub, newest on top, with live counters and the level distribution.
 * It listens as a `panel` member of the room, so it never counts itself as a person in the hall.
 */
import { useEffect, useState } from 'react';
import { conectarPublico, type CalificacionPublico, type NivelPublico } from './presencia/publico.ts';

const NIVELES: NivelPublico[] = [3, 2, 1, 0, 'NO'];
const COLOR: Record<string, string> = { '3': '#1F8A4C', '2': '#2F7FC1', '1': '#E0A100', '0': '#C2462E', NO: '#6A7568' };
const NOMBRE: Record<string, string> = { '3': 'Nivel 3', '2': 'Nivel 2', '1': 'Nivel 1', '0': 'Nivel 0', NO: 'No observable' };

export function TableroPresentador() {
  const [lista, setLista] = useState<(CalificacionPublico & { k: number })[]>([]);
  const [enSala, setEnSala] = useState(0);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    let k = 0;
    const c = conectarPublico(
      'panel',
      (m) => {
        if (m.tipo === 'pares') setEnSala(m.roles.filter((r) => r === 'control').length);
        if (m.tipo === 'calificacion') setLista((l) => [{ ...m.calificacion, k: ++k }, ...l].slice(0, 60));
      },
      setConectado,
    );
    return () => c.cerrar();
  }, []);

  const conteo = NIVELES.map((n) => ({ n, total: lista.filter((c) => c.nivel === n).length }));
  const maximo = Math.max(1, ...conteo.map((c) => c.total));

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#0D2B33] p-4 text-white md:p-8" style={{ fontSize: 22 }}>
      <style>{`@keyframes rk-entra{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}.rk-entra{animation:rk-entra .5s ease-out}@media (prefers-reduced-motion:reduce){.rk-entra{animation:none}}`}</style>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl font-extrabold md:text-5xl">Tablero del péndulo</h1>
          <p className="m-0 mt-2 text-lg opacity-80 md:text-2xl">Si alargas la cuerda, ¿el péndulo irá más rápido o más lento? ¿Por qué?</p>
        </div>
        <span className="rounded-full px-4 py-1 text-lg font-bold" style={{ background: conectado ? '#1F8A4C' : '#6A7568' }}>
          {conectado ? '● En vivo' : 'Conectando…'}
        </span>
      </header>

      <section aria-label="Contadores" className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px,100%),1fr))' }}>
        <div className="rounded-2xl bg-white/10 p-5">
          <p className="m-0 text-lg opacity-80">En la Sala del público</p>
          <p className="m-0 text-6xl font-extrabold" data-testid="tablero-en-sala">
            {enSala}
          </p>
        </div>
        <div className="rounded-2xl bg-white/10 p-5">
          <p className="m-0 text-lg opacity-80">Respuestas</p>
          <p className="m-0 text-6xl font-extrabold" data-testid="tablero-respuestas">
            {lista.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/10 p-5 lg:col-span-2">
          <p className="m-0 mb-3 text-lg opacity-80">Distribución por nivel</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {conteo.map(({ n, total }) => (
              <li key={String(n)} className="flex min-w-0 items-center gap-3">
                <span className="w-36 shrink-0 text-base md:text-xl">{NOMBRE[String(n)]}</span>
                <span className="h-6 min-w-0 rounded" style={{ width: `${(total / maximo) * 60}%`, minWidth: 6, background: COLOR[String(n)], transition: 'width .4s' }} />
                <b className="text-2xl">{total}</b>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Respuestas del público">
        {lista.length === 0 && <p className="text-2xl opacity-70 md:text-3xl">Esperando respuestas… escanea el QR y entra a la Sala del público.</p>}
        <ol className="m-0 grid list-none gap-4 p-0" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(560px,100%),1fr))' }}>
          {lista.map((c) => (
            <li key={c.k} className="rk-entra flex min-w-0 items-start gap-4 rounded-2xl bg-white p-4 text-[#0D2B33] md:p-5">
              <span className="shrink-0 rounded-xl px-4 py-2 text-3xl font-extrabold text-white" style={{ background: COLOR[String(c.nivel)] }}>
                {c.nivel === 'NO' ? 'NO' : `N${c.nivel}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 break-words text-2xl font-extrabold md:text-3xl">{c.apodo}</p>
                {c.cita ? <blockquote className="m-0 mt-1 border-l-4 border-[#075E6C] pl-3 text-xl italic break-words md:text-2xl">“{c.cita}”</blockquote> : <p className="m-0 mt-1 text-xl opacity-70">Sin cita evaluable</p>}
                <p className="m-0 mt-1 text-base opacity-70">
                  Juez: {c.fuente} · {new Date(c.ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

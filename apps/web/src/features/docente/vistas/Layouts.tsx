import { Outlet } from 'react-router';
import { Segmentos } from '../PanelDocente.tsx';
import { ResumenPlanClase } from '../plan/MiPlan.tsx';
import { usePlanClase } from '../plan/usePlanClase.ts';
import { useAcciones, useProyeccion } from '../Proveedor.tsx';

export function LayoutClase() {
  return (
    <>
      <Segmentos
        items={[
          { a: '/docente/clase', t: 'Preparar', fin: true },
          { a: '/docente/clase/museo', t: 'Museo' },
          { a: '/docente/clase/ayudas', t: 'Ayudas' },
          { a: '/docente/clase/acercarse', t: 'Acercarse' },
          { a: '/docente/clase/llevar', t: 'Para llevar' },
          { a: '/docente/clase/plan', t: 'Mi plan' },
          { a: '/docente/clase/curriculo', t: 'Buscar en el currículo' },
        ]}
      />
      <Outlet />
    </>
  );
}

export function LayoutEvidencia() {
  return (
    <>
      <Segmentos
        items={[
          { a: '/docente/evidencia', t: 'Recibir', fin: true },
          { a: '/docente/evidencia/evidencias', t: 'Evidencias' },
          { a: '/docente/evidencia/resumen', t: 'Resumen' },
        ]}
      />
      <Outlet />
    </>
  );
}

export function LayoutReportes() {
  return (
    <>
      <Segmentos
        items={[
          { a: '/docente/reportes', t: 'Competencia', fin: true },
          { a: '/docente/reportes/dudas', t: 'Dudas' },
          { a: '/docente/reportes/curso', t: 'Del curso' },
          { a: '/docente/reportes/envios', t: 'Envíos' },
          { a: '/docente/reportes/items', t: 'Banco de ítems' },
        ]}
      />
      <Outlet />
    </>
  );
}

/** T-02 simplified: the approved practice of the day. The library and the creator belong to F7/F9. */
export function Preparar() {
  const practica = useAcciones().practica;
  const { p } = useProyeccion();
  const plan = usePlanClase();
  if (!p.clase || !practica) return <p className="dc-card">Primero crea una clase en «Hoy».</p>;
  return (
    <>
      {plan ? <ResumenPlanClase plan={plan} compacto /> : null}
      <section className="dc-card" aria-labelledby="prep">
        <h2 id="prep">{practica.titulo}</h2>
        <span className="dc-chip dc-chip--ok">Aprobada · {practica.procedencia.generadoPor === 'catalogo' ? 'catálogo' : 'revisada por la docente'}</span>
        <p style={{ margin: 0 }}>{practica.preguntaGuia}</p>
        <p className="dc-muted" style={{ margin: 0 }}>
          Materiales: {practica.materiales.map((m) => m.nombre).join(', ')}.
        </p>
        <p className="dc-muted" style={{ margin: 0 }}>
          Límites del modelo: {practica.limitaciones.join(' ')}
        </p>
      </section>
    </>
  );
}

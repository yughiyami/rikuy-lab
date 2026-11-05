import type { RouteObject } from 'react-router';
import { ParaLlevar } from '../familia/ParaLlevar.tsx';
import { DelCursoPagina, ParaAcercarsePagina } from '../guardian/paginas.tsx';
import { DudasDocentePagina } from '../reportes/paginas.tsx';
import { PanelDocente } from './PanelDocente.tsx';
import { MiPlan } from './plan/MiPlan.tsx';
import { Ajustes } from './vistas/Ajustes.tsx';
import { Ayudas } from './vistas/Ayudas.tsx';
import { BuscarCurriculo } from './vistas/BuscarCurriculo.tsx';
import { CrearClase } from './vistas/CrearClase.tsx';
import { Envios } from './vistas/Envios.tsx';
import { Evidencias } from './vistas/Evidencias.tsx';
import { Hoy } from './vistas/Hoy.tsx';
import { LayoutClase, LayoutEvidencia, LayoutReportes, Preparar } from './vistas/Layouts.tsx';
import { Museo } from './vistas/Museo.tsx';
import { Recibir } from './vistas/Recibir.tsx';
import { ReporteCompetencia } from './vistas/ReporteCompetencia.tsx';
import { ResumenClase } from './vistas/ResumenClase.tsx';

/** Routes of the "docente" feature. Only its owning front edits this file (5.5). */
export const rutas: RouteObject[] = [
  {
    path: 'docente',
    Component: PanelDocente,
    children: [
      { index: true, Component: Hoy },
      { path: 'nueva', Component: CrearClase },
      {
        path: 'clase',
        Component: LayoutClase,
        children: [
          { index: true, Component: Preparar },
          { path: 'museo', Component: Museo },
          { path: 'ayudas', Component: Ayudas },
          { path: 'acercarse', Component: ParaAcercarsePagina },
          { path: 'llevar', Component: ParaLlevar },
          { path: 'plan', Component: MiPlan },
          { path: 'curriculo', Component: BuscarCurriculo },
        ],
      },
      {
        path: 'evidencia',
        Component: LayoutEvidencia,
        children: [
          { index: true, Component: Recibir },
          { path: 'evidencias', Component: Evidencias },
          { path: 'resumen', Component: ResumenClase },
        ],
      },
      {
        path: 'reportes',
        Component: LayoutReportes,
        children: [
          { index: true, Component: ReporteCompetencia },
          { path: 'dudas', Component: DudasDocentePagina },
          { path: 'curso', Component: DelCursoPagina },
          { path: 'envios', Component: Envios },
        ],
      },
      { path: 'ajustes', Component: Ajustes },
    ],
  },
];

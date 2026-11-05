/**
 * App route table: the composition root. Fronts edit only `features/<feature>/rutas.ts` (5.5); this file
 * puts every feature under the shell, wires the tab roots to the real screens and passes what only the
 * shell knows (the group identity, the feature flags, the general settings) into the feature screens.
 *
 * Student tabs: Museo (/museo), Lab (/lab/pendulo), Cerebro (/cerebro), Quipu (/quipu), Yo (/yo, with the
 * Guardián check-in, the Caja de dudas and accessibility). Teacher tabs open the F6 panel (/docente/...).
 */
import { Navigate, type RouteObject } from 'react-router';
import { UnirseDemo } from '../shell/pantallas/UnirseDemo.tsx';
import { TableroPresentador } from '../features/mundo/TableroPresentador.tsx';
import { rutas as cerebro } from '../features/cerebro/rutas.ts';
import { rutas as creador } from '../features/creador/rutas.ts';
import { rutas as docente } from '../features/docente/rutas.ts';
import { rutas as familia } from '../features/familia/rutas.ts';
import { rutas as grupo } from '../features/grupo/rutas.ts';
import { CheckInPagina, ParaAcercarsePagina } from '../features/guardian/paginas.tsx';
import { rutas as guardian } from '../features/guardian/rutas.ts';
import { rutas as holo } from '../features/holo/rutas.ts';
import { rutas as lab } from '../features/lab/rutas.ts';
import { rutas as mundo } from '../features/mundo/rutas.ts';
import { CajaDeDudasPagina } from '../features/reportes/paginas.tsx';
import { rutas as relevo } from '../features/relevo/rutas.ts';
import { rutas as retos } from '../features/retos/rutas.ts';
import { rutas as tutor } from '../features/tutor/rutas.ts';
import { PanelAccesibilidad } from '../shell/accesibilidad/PanelAccesibilidad.tsx';
import { ALIAS_DOCENTE } from '../shell/navegacion.ts';
import { Lab, Yo } from '../shell/pantallas/Estudiante.tsx';
import { Unirse } from '../shell/pantallas/Unirse.tsx';
import { flagsActuales } from './flags.ts';
import './grupoMuseo.ts';
import { AjustesCompletos, ConIdentidad, RedirigirUrlVieja } from './piezas.tsx';
import { Inicio } from './Inicio.tsx';
import { Shell } from './Shell.tsx';

export const rutasDeFeatures: Record<string, RouteObject[]> = {
  relevo,
  lab,
  holo,
  tutor,
  mundo,
  retos,
  docente,
  familia,
  creador,
  grupo,
  cerebro,
  guardian,
};

/** The F6 panel with the app-level pieces plugged into its children. */
function componerDocente(r: RouteObject): RouteObject {
  const hijos = r.children?.map((h): RouteObject => {
    if (h.path === 'ajustes') return { path: 'ajustes', element: <AjustesCompletos /> };
    if (h.path === 'clase')
      return { ...h, children: h.children?.map((c) => (c.path === 'acercarse' ? { path: 'acercarse', element: <ParaAcercarsePagina nivel2={flagsActuales().guardianNivel2} /> } : c)) } as RouteObject;
    return h;
  });
  return { ...r, children: hijos } as RouteObject;
}

const deFeatures: RouteObject[] = Object.entries(rutasDeFeatures).flatMap(([nombre, lista]) => (nombre === 'docente' ? lista.map(componerDocente) : lista));

const delShell: RouteObject[] = [
  { index: true, element: <Inicio /> },
  { path: 'entrar', element: <Unirse /> },
  { path: 'unirse/demo', element: <UnirseDemo /> },
  // Presenter tabs of the pitch (desktop/projector): last scanned object with Rikuy, and the audience grading board
  { path: 'presentador/objeto', lazy: async () => ({ Component: (await import('../shell/pantallas/PresentadorObjeto.tsx')).PresentadorObjeto }) },
  { path: 'presentador/tablero', element: <TableroPresentador /> },
  // Student tabs (Museo and Cerebro are registered by their features)
  { path: 'lab', element: <Navigate to="/lab/pendulo" replace /> },
  { path: 'lab/inicio', element: <Lab /> },
  // The Quipu tab (/quipu) is registered by the mundo feature: it reads the class quipu ledger
  { path: 'yo', element: <Yo /> },
  { path: 'yo/checkin', element: <ConIdentidad hijo={(id) => <CheckInPagina identidad={id} />} /> },
  { path: 'yo/dudas', element: <ConIdentidad hijo={(id) => <CajaDeDudasPagina identidad={id} />} /> },
  { path: 'yo/accesibilidad', element: <PanelAccesibilidad /> },
  // Short teacher paths (and the contract paths /clase, /ajustes) open the F6 panel
  ...Object.entries(ALIAS_DOCENTE).map(([corta, destino]): RouteObject => ({ path: corta, element: <Navigate to={destino} replace /> })),
  // Old multi-page URLs
  ...['display.html', 'control.html', 'panel.html', 'clasico.html'].map((p): RouteObject => ({ path: p, element: <RedirigirUrlVieja /> })),
  { path: '*', element: <Navigate to="/" replace /> },
];

export const rutas: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [...deFeatures, ...delShell],
  },
];

/**
 * Navigation of the shell: which tabs each role sees and which tab owns a route.
 * Paths that exist in the shared route table of contracts are taken from it; the others (hoy,
 * evidencia, reportes, lab home, quipu, yo) are proposed in PROPUESTAS_CONTRATOS.md.
 */
import { RUTAS } from '@rikuy/contracts/rutas';

export type Rol = 'docente' | 'grupo';
export type TabEstudiante = 'museo' | 'lab' | 'cerebro' | 'quipu' | 'yo';
export type TabDocente = 'hoy' | 'clase' | 'evidencia' | 'reportes' | 'ajustes';

export interface TabDef<T extends string> {
  id: T;
  ruta: string;
  /** i18n key of the label. */
  clave: `tabs.${T}`;
}

export const TABS_ESTUDIANTE: TabDef<TabEstudiante>[] = [
  { id: 'museo', ruta: RUTAS.museo, clave: 'tabs.museo' },
  { id: 'lab', ruta: '/lab/pendulo', clave: 'tabs.lab' },
  { id: 'cerebro', ruta: RUTAS.cerebro, clave: 'tabs.cerebro' },
  { id: 'quipu', ruta: '/quipu', clave: 'tabs.quipu' },
  { id: 'yo', ruta: '/yo', clave: 'tabs.yo' },
];

/** The teacher tabs open the F6 panel (`/docente/...`); the short paths (/hoy, /clase...) redirect there. */
export const TABS_DOCENTE: TabDef<TabDocente>[] = [
  { id: 'hoy', ruta: '/docente', clave: 'tabs.hoy' },
  { id: 'clase', ruta: '/docente/clase', clave: 'tabs.clase' },
  { id: 'evidencia', ruta: '/docente/evidencia', clave: 'tabs.evidencia' },
  { id: 'reportes', ruta: '/docente/reportes', clave: 'tabs.reportes' },
  { id: 'ajustes', ruta: '/docente/ajustes', clave: 'tabs.ajustes' },
];

/** Short teacher paths of the shell and the F6 panel route each one opens. */
export const ALIAS_DOCENTE: Record<string, string> = {
  hoy: '/docente',
  clase: '/docente/clase',
  evidencia: '/docente/evidencia',
  reportes: '/docente/reportes',
  ajustes: '/docente/ajustes',
};

/** First match wins, so longer prefixes come first. Routes owned by other fronts map to a tab. */
const PREFIJOS: Record<Rol, [string, string][]> = {
  grupo: [
    ['/museo', 'museo'],
    ['/retos', 'museo'],
    ['/lab', 'lab'],
    ['/exhibicion', 'lab'],
    ['/cerebro', 'cerebro'],
    ['/quipu', 'quipu'],
    ['/yo', 'yo'],
    ['/relevo', 'yo'],
    ['/tutor', 'lab'],
  ],
  docente: [
    ['/hoy', 'hoy'],
    ['/clase', 'clase'],
    ['/creador', 'clase'],
    ['/docente/clase', 'clase'],
    ['/docente/evidencias', 'evidencia'],
    ['/docente/evidencia', 'evidencia'],
    ['/docente/reportes', 'reportes'],
    ['/docente/ajustes', 'ajustes'],
    ['/evidencia', 'evidencia'],
    ['/relevo', 'evidencia'],
    ['/docente', 'hoy'],
    ['/reportes', 'reportes'],
    ['/ajustes', 'ajustes'],
  ],
};

const coincide = (ruta: string, prefijo: string) => ruta === prefijo || ruta.startsWith(`${prefijo}/`);

export function tabActivo(ruta: string, rol: Rol): string | null {
  return PREFIJOS[rol].find(([prefijo]) => coincide(ruta, prefijo))?.[1] ?? null;
}

/** Old multi-page URLs: they only redirect, so they never need a role. */
const RUTAS_VIEJAS = ['/display.html', '/control.html', '/panel.html', '/clasico.html'];

/** Entry screens, the family page (no install, no role) and the display phone have no chrome. */
export function rutaSinMarco(ruta: string): boolean {
  return ruta === '/' || ruta === '/entrar' || ruta === '/unirse/demo' || coincide(ruta, '/presentador') || coincide(ruta, '/p') || coincide(ruta, '/holo') || RUTAS_VIEJAS.includes(ruta);
}

export const INICIO_POR_ROL: Record<Rol, string> = { docente: '/docente', grupo: '/museo' };

/** Routes that fill the desktop width edge to edge (the walkable museum). */
export function rutaAPantallaCompleta(pathname: string): boolean {
  return /^\/museo(\/sala-[\w-]+)?\/?$/.test(pathname);
}

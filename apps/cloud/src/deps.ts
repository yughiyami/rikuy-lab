/**
 * Dependencies of the cloud gateway and their builders. Keys come ONLY from environment variables (2.3.3):
 * with no keys every provider is replaced by its deterministic stand-in (mock mode, 4.5).
 */
import {
  Presupuesto,
  RegistroUsoMemoria,
  TOPE_MENSUAL_POR_DEFECTO_USD,
  crearAdaptadorOpenAICompat,
  crearAdaptadoresSimulados,
  crearCatalogoCneb,
  crearCatalogoPracticas,
  crearEnrutador,
  type Adaptador,
  type CatalogoDesempenos,
  type CatalogoPracticas,
  type DepsCreador,
  type DepsPlan,
  curriculoCneb,
  type Enrutador,
  type EntradaUso,
  type Politica,
} from '@rikuy/ai';
import { crearAdaptadorGemini, clienteGeminiDesdeSdk } from '@rikuy/ai/adaptadores/gemini';
import { crearAdaptadorMeta } from '@rikuy/ai/adaptadores/meta';
import { Practica } from '@rikuy/contracts';
import { depsObjeto3dDesdeEntorno, type DepsObjeto3d } from './objeto3d/rutas.ts';
import { ejemplos } from '@rikuy/contracts/fixtures';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RepositorioAgregadosMemoria, RepositorioPaquetesMemoria, type RepositorioAgregados, type RepositorioPaquetes } from './almacen.ts';
import type { Limite } from './limites.ts';
import type { DepsReportes } from './reportes/deps.ts';
import { nuevoUlid } from './ulid.ts';

export interface LimitesNube {
  ia: Limite;
  escritura: Limite;
  envio: Limite;
}

export interface DepsNube {
  modo: 'simulado' | 'real' | 'mixto';
  creador: DepsCreador;
  plan: DepsPlan;
  enrutador: Enrutador;
  registro: RegistroUsoMemoria;
  presupuesto: Presupuesto;
  catalogo: CatalogoDesempenos;
  practicas: CatalogoPracticas;
  paquetes: RepositorioPaquetes;
  agregados: RepositorioAgregados;
  limites: LimitesNube;
  confiarProxy: boolean;
  origenesPermitidos: string[];
  ugelToken?: string;
  topeMensualUsd: number;
  reloj: () => Date;
  reportes?: DepsReportes;
  objeto3d?: DepsObjeto3d;
}

export const LIMITES_POR_DEFECTO: LimitesNube = {
  ia: { max: 30, ventanaMs: 60_000 },
  escritura: { max: 20, ventanaMs: 60_000 },
  envio: { max: 10, ventanaMs: 60_000 },
};

const GENERACION_MS = 30_000;
const politica = (orden: Politica['orden']): Politica => ({ orden, timeoutMs: GENERACION_MS, privacidad: 'solo-docente' });
export const POLITICAS = {
  generarPractica: politica(['gemini', 'ollama']),
  revisarPractica: politica(['meta', 'ollama']),
  pictogramas: politica(['meta']),
  visionTabla: politica(['gemini']),
  traducir: politica(['gemini']),
  // Reading a whole PDF takes longer than a draft.
  extraerPlan: { ...politica(['gemini']), timeoutMs: 90_000 },
  // Live tutor: short timeouts so the classroom falls back to the rules agent quickly.
  tutorDialogo: { orden: ['gemini'], timeoutMs: 5_000, privacidad: 'anonimizado' },
  revisarPista: { orden: ['meta'], timeoutMs: 3_500, privacidad: 'anonimizado' },
  juzgarIndagacion: { orden: ['gemini'], timeoutMs: 6_000, privacidad: 'anonimizado' },
  voz: { orden: ['gemini'], timeoutMs: 10_000, privacidad: 'anonimizado' },
  transcribir: { orden: ['gemini'], timeoutMs: 8_000, privacidad: 'anonimizado' },
} satisfies Record<string, Politica>;

function crearNucleo(adaptadores: Adaptador[], tope: number, reloj: () => Date, alRegistrar?: (e: EntradaUso) => void) {
  const registro = new RegistroUsoMemoria(alRegistrar);
  const presupuesto = new Presupuesto({ registro, topeMensualUsd: tope, reloj });
  const enrutador = crearEnrutador({ adaptadores, politicas: POLITICAS, presupuesto, registro, reloj });
  return { registro, presupuesto, enrutador };
}

/** Approved practices from `content/practicas/*.json` (F9), validated; otherwise the contract fixture (demo only). */
export function cargarCatalogoPracticas(dir: string | undefined): CatalogoPracticas {
  const lista: Practica[] = [];
  if (dir && existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      try {
        const p = Practica.safeParse(JSON.parse(readFileSync(join(dir, f), 'utf8')));
        if (p.success) lista.push(p.data);
      } catch {
        /* a malformed file is skipped, never served */
      }
    }
  }
  if (lista.length === 0) lista.push(Practica.parse(ejemplos.practica));
  return crearCatalogoPracticas(lista);
}

export function crearDepsSimuladas(p: Partial<DepsNube> = {}): DepsNube {
  const reloj = p.reloj ?? (() => new Date());
  const tope = p.topeMensualUsd ?? TOPE_MENSUAL_POR_DEFECTO_USD;
  const catalogo = p.catalogo ?? crearCatalogoCneb();
  const practicas = p.practicas ?? cargarCatalogoPracticas(undefined);
  const nucleo = crearNucleo(crearAdaptadoresSimulados(), tope, reloj);
  return {
    modo: 'simulado',
    creador: { enrutador: nucleo.enrutador, catalogo, practicas, nuevoId: nuevoUlid },
    plan: { enrutador: nucleo.enrutador, curriculo: curriculoCneb() },
    enrutador: nucleo.enrutador,
    registro: nucleo.registro,
    presupuesto: nucleo.presupuesto,
    catalogo,
    practicas,
    paquetes: new RepositorioPaquetesMemoria(),
    agregados: new RepositorioAgregadosMemoria(),
    limites: LIMITES_POR_DEFECTO,
    confiarProxy: false,
    origenesPermitidos: [],
    topeMensualUsd: tope,
    reloj,
    ...p,
  };
}

type Env = Record<string, string | undefined>;

/** Builds the gateway from environment variables. A missing key means the stand-in for that provider. */
export function crearDepsDesdeEntorno(env: Env, reportes?: DepsReportes): DepsNube {
  const reloj = () => new Date();
  const tope = Number(env.TOPE_MENSUAL_USD ?? TOPE_MENSUAL_POR_DEFECTO_USD);
  const simulados = crearAdaptadoresSimulados();
  const forzarSimulado = env.RIKUY_AI_MODE === 'mock';
  const adaptadores: Adaptador[] = [];
  const usaGemini = !forzarSimulado && !!env.GEMINI_API_KEY;
  const usaMeta = !forzarSimulado && !!env.META_API_KEY;
  adaptadores.push(
    usaGemini
      ? crearAdaptadorGemini({
          cliente: clienteGeminiDesdeSdk(env.GEMINI_API_KEY!),
          ...(env.GEMINI_MODEL ? { modelo: env.GEMINI_MODEL } : {}),
          ...(env.GEMINI_PLAN_MODEL ? { modeloPlan: env.GEMINI_PLAN_MODEL } : {}),
          ...(env.GEMINI_TTS_MODEL ? { modeloTts: env.GEMINI_TTS_MODEL } : {}),
        })
      : simulados.find((a) => a.nombre === 'gemini')!,
  );
  adaptadores.push(
    usaMeta
      ? crearAdaptadorMeta({ apiKey: env.META_API_KEY!, ...(env.META_API_BASE_URL ? { baseUrl: env.META_API_BASE_URL } : {}) })
      : simulados.find((a) => a.nombre === 'meta')!,
  );
  if (!forzarSimulado && env.OLLAMA_BASE_URL) adaptadores.push(crearAdaptadorOpenAICompat({ baseUrl: env.OLLAMA_BASE_URL, modelo: env.OLLAMA_MODEL ?? 'llama3.2:3b' }));

  const alRegistrar = env.USO_LOG_PATH ? (e: EntradaUso) => appendFileSync(env.USO_LOG_PATH!, `${JSON.stringify(e)}\n`) : undefined;
  const nucleo = crearNucleo(adaptadores, tope, reloj, alRegistrar);
  const catalogo = crearCatalogoCneb();
  const practicas = cargarCatalogoPracticas(env.CATALOGO_DIR ?? join(process.cwd(), 'content', 'practicas'));
  const reales = Number(usaGemini) + Number(usaMeta);
  return {
    modo: reales === 0 ? 'simulado' : reales === 2 ? 'real' : 'mixto',
    creador: { enrutador: nucleo.enrutador, catalogo, practicas, nuevoId: nuevoUlid },
    plan: { enrutador: nucleo.enrutador, curriculo: curriculoCneb() },
    enrutador: nucleo.enrutador,
    registro: nucleo.registro,
    presupuesto: nucleo.presupuesto,
    catalogo,
    practicas,
    paquetes: new RepositorioPaquetesMemoria(),
    agregados: new RepositorioAgregadosMemoria(),
    limites: LIMITES_POR_DEFECTO,
    confiarProxy: env.CONFIAR_PROXY === '1',
    origenesPermitidos: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    ...(env.UGEL_TOKEN ? { ugelToken: env.UGEL_TOKEN } : {}),
    topeMensualUsd: tope,
    reloj,
    ...(reportes ? { reportes } : {}),
    objeto3d: depsObjeto3dDesdeEntorno(env),
  };
}

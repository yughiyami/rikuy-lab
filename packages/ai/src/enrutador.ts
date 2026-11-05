/**
 * Router by capability (4.5): ordered adapters, privacy policy, budget per school, timeout and fallback.
 * The floor (rules or catalog) is part of the order, so the lab keeps working without AI.
 */
import type { FuenteIA } from '@rikuy/contracts';
import type { Presupuesto, RegistroUso } from './presupuesto.ts';
import type { Capacidad, Capacidades, ContextoLlamada, FalloIA, UsoLlamada } from './puertos.ts';
import { err, type Result } from './result.ts';

export type NombreAdaptador = 'gemini' | 'meta' | 'ollama' | 'webllm' | 'reglas';

export interface Politica {
  orden: NombreAdaptador[];
  timeoutMs: number; // tutor 6 s, generation 30 s
  privacidad: 'solo-docente' | 'anonimizado' | 'local'; // what may leave the device
  requiereInterruptor?: 'iaLocal' | 'iaNube';
}

export interface Adaptador {
  nombre: NombreAdaptador;
  fuente: FuenteIA;
  modelo: string;
  /** True for fixtures that stand in for a provider (mock mode). */
  simulado?: boolean;
  capacidades: Partial<Capacidades>;
  disponible(): boolean;
  /** Estimated cost of one call, checked against the school budget before the call. */
  costoEstimadoUsd?(c: Capacidad): number;
}

export interface Interruptores {
  iaLocal?: boolean;
  iaNube?: boolean;
}
export interface Peticion {
  colegioId: string;
  interruptores: Interruptores;
}
export interface Intento {
  adaptador: NombreAdaptador;
  fallo?: FalloIA;
}
export interface Resultado<T> {
  resultado: Result<T, FalloIA>;
  adaptador?: NombreAdaptador;
  fuente?: FuenteIA;
  modelo?: string;
  simulado?: boolean;
  intentos: Intento[];
}

export interface ConfigEnrutador {
  adaptadores: Adaptador[];
  politicas: Partial<Record<Capacidad, Politica>>;
  presupuesto: Presupuesto;
  registro: RegistroUso;
  reloj?: () => Date;
}

export interface Enrutador {
  ejecutar<C extends Capacidad, T>(
    capacidad: C,
    peticion: Peticion,
    fn: (impl: Capacidades[C], ctx: ContextoLlamada) => Promise<Result<T, FalloIA>>,
  ): Promise<Resultado<T>>;
  adaptadores(): readonly Adaptador[];
}

class TiempoAgotado extends Error {}

function conTiempo<T>(p: Promise<T>, ms: number, abortar: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      abortar();
      reject(new TiempoAgotado());
    }, ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

function elegirFallo(intentos: Intento[]): FalloIA {
  const fallos = intentos.flatMap((i) => (i.fallo ? [i.fallo] : []));
  if (fallos.length === 0) return { tipo: 'proveedor', detalle: 'Ningún adaptador disponible para esta capacidad.' };
  const cuota = fallos.find((f) => f.tipo === 'cuota');
  if (cuota) return cuota;
  const reales = fallos.filter((f) => f.tipo !== 'politica');
  return reales.length > 0 ? reales[reales.length - 1]! : fallos[0]!;
}

export function crearEnrutador(config: ConfigEnrutador): Enrutador {
  const reloj = config.reloj ?? (() => new Date());
  return {
    adaptadores: () => config.adaptadores,
    async ejecutar(capacidad, peticion, fn) {
      const politica = config.politicas[capacidad];
      const intentos: Intento[] = [];
      if (!politica) return { resultado: err({ tipo: 'politica', detalle: `Sin política para ${capacidad}.` }), intentos };
      for (const nombre of politica.orden) {
        const a = config.adaptadores.find((x) => x.nombre === nombre);
        const impl = a?.capacidades[capacidad];
        if (!a || !impl || !a.disponible()) continue;

        // Privacy: what may leave the device, and the teacher switches.
        if (politica.privacidad === 'local' && a.fuente === 'ia-nube') {
          intentos.push({ adaptador: nombre, fallo: { tipo: 'politica', detalle: 'La política es local: no sale nada a la nube.' } });
          continue;
        }
        const interruptor = politica.requiereInterruptor;
        if (interruptor && ((interruptor === 'iaNube' && a.fuente === 'ia-nube') || (interruptor === 'iaLocal' && a.fuente === 'ia-local')) && !peticion.interruptores[interruptor]) {
          intentos.push({ adaptador: nombre, fallo: { tipo: 'politica', detalle: `Falta el interruptor ${interruptor} de la docente.` } });
          continue;
        }

        // Budget: only paid (cloud) calls, checked before the call.
        if (a.fuente === 'ia-nube') {
          const sinCupo = config.presupuesto.asegurar(peticion.colegioId, a.costoEstimadoUsd?.(capacidad) ?? 0);
          if (sinCupo) {
            intentos.push({ adaptador: nombre, fallo: sinCupo });
            config.registro.agregar({
              ts: reloj().toISOString(), colegioId: peticion.colegioId, adaptador: nombre, modelo: a.modelo, endpoint: '(rechazada)',
              proposito: capacidad, costoUsd: 0, latenciaMs: 0, estado: 'cuota',
            });
            continue;
          }
        }

        const usos: UsoLlamada[] = [];
        const control = new AbortController();
        const ctx: ContextoLlamada = { colegioId: peticion.colegioId, registrarUso: (u) => void usos.push(u), senal: control.signal };
        const inicio = Date.now();
        let resultado: Result<unknown, FalloIA>;
        try {
          resultado = await conTiempo(fn(impl as Capacidades[typeof capacidad], ctx), politica.timeoutMs, () => control.abort());
        } catch (e) {
          resultado = err<FalloIA>(
            e instanceof TiempoAgotado
              ? { tipo: 'timeout', detalle: `El adaptador ${nombre} superó ${politica.timeoutMs} ms.` }
              : { tipo: 'proveedor', detalle: `El adaptador ${nombre} falló.` }, // never echo provider messages: they may carry content
          );
        }
        const latenciaMs = Date.now() - inicio;
        const estado = resultado.ok ? 'ok' : resultado.error.tipo === 'cuota' ? 'cuota' : 'error';
        const base = { ts: reloj().toISOString(), colegioId: peticion.colegioId, adaptador: nombre, modelo: a.modelo, latenciaMs, estado } as const;
        if (usos.length === 0) config.registro.agregar({ ...base, endpoint: '(sin reporte)', proposito: capacidad, costoUsd: 0 });
        for (const u of usos) config.registro.agregar({ ...base, ...u });

        if (resultado.ok) {
          intentos.push({ adaptador: nombre });
          return { resultado: resultado as Result<never, FalloIA>, adaptador: nombre, fuente: a.fuente, modelo: a.modelo, simulado: a.simulado ?? false, intentos };
        }
        intentos.push({ adaptador: nombre, fallo: resultado.error });
      }
      return { resultado: err(elegirFallo(intentos)), intentos };
    },
  };
}

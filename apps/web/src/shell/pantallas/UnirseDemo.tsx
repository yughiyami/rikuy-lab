import { Button, Mascot } from '@rikuy/ui';
import type { SolicitudJuez, VeredictoJuez } from '@rikuy/tutor';
import { useState, type FormEvent } from 'react';
import { almacenDocente } from '../../features/docente/Proveedor.tsx';
import { clienteTutorPorDefecto, crearClienteTutorNube, vozRikuy } from '../../features/tutor/nube.ts';
import { SalaPublico, type ResultadoPublico } from '../../features/mundo/SalaPublico.tsx';
import { APODO_MAX, sanitizarApodo } from '../../features/mundo/presencia/publico.ts';
import { useSesion } from '../sesion.ts';
import { APODOS } from '../unirse.ts';

/**
 * Audience join link for the pitch (`#/unirse/demo`, printed QR): one free nickname, then straight into the
 * shared live "Sala del público" with the pendulum question graded by the live judge.
 */
export const PREGUNTA_DEMO = 'Si alargas la cuerda, ¿el péndulo irá más rápido o más lento? ¿Por qué?';
export const CODIGO_DEMO = 'DEMO2B';

export function solicitudDemo(respuesta: string): SolicitudJuez {
  return {
    indicador: 'justificacion',
    respuesta,
    contexto: {
      variables: [{ id: 'longitud', etiqueta: 'Longitud de la cuerda', sinonimos: ['cuerda', 'largo', 'larga', 'longitud', 'hilo'] }],
      variableProbada: 'longitud',
      conceptos: ['tiempo', 'periodo', 'oscilación', 'oscila', 'recorrido', 'distancia', 'vuelta'],
    },
    datos: [],
  };
}

export function UnirseDemo() {
  const unirse = useSesion((s) => s.unirse);
  const elegirRol = useSesion((s) => s.elegirRol);
  const [apodo, setApodo] = useState('');
  const [unido, setUnido] = useState<string | null>(null);
  const limpio = sanitizarApodo(apodo);

  const entrar = (e: FormEvent) => {
    e.preventDefault();
    if (!limpio) return;
    try {
      if (almacenDocente().getState().eventos.length === 0) almacenDocente().getState().cargarDemo({ completa: true });
    } catch {
      /* the demo seed is optional on an audience phone */
    }
    const grupo = APODOS[Math.floor(Math.random() * APODOS.length)]!;
    elegirRol('grupo');
    unirse({ codigo: CODIGO_DEMO, apodo: grupo, nivel: 'normal' });
    setUnido(limpio);
  };

  const responder = async (texto: string): Promise<ResultadoPublico> => {
    const c = clienteTutorPorDefecto() ?? crearClienteTutorNube();
    const v: VeredictoJuez = await c.juzgar(solicitudDemo(texto));
    const t = await c.turno({ mensaje: `Pregunta: ${PREGUNTA_DEMO}
Respuesta de ${unido ?? 'alguien del público'}: ${texto}` });
    const seguimiento = t.ok ? t.valor.texto : 'Buena idea. ¿Cómo podrías comprobarlo midiendo el tiempo de 10 vueltas con dos cuerdas distintas?';
    void vozRikuy().hablar(seguimiento).catch(() => undefined);
    return { nivel: v.nivel, cita: v.cita, fuente: v.fuente, ...(v.respaldo ? { respaldo: v.respaldo } : {}), seguimiento };
  };

  if (unido) return <SalaPublico apodo={unido} pregunta={PREGUNTA_DEMO} responder={responder} />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--rk-w-phone)] flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <Mascot estado="curiosa" size={56} />
        <h1 className="m-0 text-title font-extrabold">Entra a la Sala del público</h1>
      </header>
      <form onSubmit={entrar} className="flex flex-col gap-3">
        <label htmlFor="apodo-demo" className="text-body font-semibold">
          Tu apodo
        </label>
        <input
          id="apodo-demo"
          value={apodo}
          onChange={(e) => setApodo(e.target.value)}
          maxLength={APODO_MAX}
          autoComplete="off"
          className="h-14 rounded-xl border-2 border-[#6A7568] px-3 text-title"
        />
        {apodo.trim() && !limpio && <p className="m-0 text-caption text-ink-2">Usa un apodo sin enlaces, teléfonos ni groserías.</p>}
        <Button type="submit" size="lg" disabled={!limpio}>
          Entrar
        </Button>
      </form>
    </main>
  );
}

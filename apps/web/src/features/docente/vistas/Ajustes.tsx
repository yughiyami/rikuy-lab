import { Link } from 'react-router';
import { useAcciones, useClase, useProyeccion } from '../Proveedor.tsx';
import { InterruptorTutor } from './Hoy.tsx';
import { SenalesPorGrupo } from './SenalesPorGrupo.tsx';
import { UsoIA } from './UsoIA.tsx';

/** Learning signals are compiled behind a build flag and off by default (4.9). */
const SENALES_COMPILADAS = import.meta.env.VITE_FLAG_SENALES === '1';

export function Ajustes({ senalesDisponibles = SENALES_COMPILADAS }: { senalesDisponibles?: boolean }) {
  const { p } = useProyeccion();
  const acciones = useAcciones();
  const contexto = useClase((s) => s.contexto);
  const esDemo = useClase((s) => s.esDemo);
  if (!p.clase) return <p className="dc-card">Primero crea una clase en «Hoy».</p>;
  const gestos = p.interruptores.gestos ?? false;
  const senales = p.interruptores.senales ?? false;
  return (
    <>
      <section className="dc-card" aria-labelledby="aj-int">
        <h2 id="aj-int">Interruptores de la clase</h2>
        <InterruptorTutor />
        <div className="dc-switch-row">
          <span>
            <strong>Gestos con la cámara</strong>
            <br />
            <span className="dc-muted">{gestos ? 'Encendido: la cámara solo ve la mano.' : 'Apagado: los controles son táctiles.'}</span>
          </span>
          <input type="checkbox" role="switch" className="dc-switch" aria-label="Gestos con la cámara" checked={gestos} onChange={(e) => acciones.setInterruptor('gestos', e.currentTarget.checked)} />
        </div>
        {senalesDisponibles ? (
          <div className="dc-switch-row">
            <span>
              <strong>Señales de aprendizaje</strong>
              <br />
              <span className="dc-muted">{senales ? 'Encendido: solo conteos por grupo.' : 'Apagado.'}</span>
            </span>
            <input type="checkbox" role="switch" className="dc-switch" aria-label="Señales de aprendizaje" checked={senales} onChange={(e) => acciones.setInterruptor('senales', e.currentTarget.checked)} />
          </div>
        ) : null}
      </section>

      {senalesDisponibles && senales ? <SenalesPorGrupo /> : null}

      <UsoIA />

      <section className="dc-card" aria-labelledby="aj-plan">
        <h2 id="aj-plan">Mi plan</h2>
        <p className="dc-muted" style={{ margin: 0 }}>
          Sube tu programación anual, unidad o malla (PDF o fotos) para relacionarla con el CNEB.
        </p>
        <Link className="dc-btn dc-btn--tonal" to="/docente/clase/plan">
          Abrir «Mi plan»
        </Link>
      </section>

      <section className="dc-card" aria-labelledby="aj-ctx">
        <h2 id="aj-ctx">Contexto del aula</h2>
        {contexto ? (
          <dl style={{ margin: 0, display: 'grid', gap: 4 }}>
            <dt>Región</dt>
            <dd style={{ margin: 0 }}>{contexto.region} · {contexto.zona}</dd>
            {contexto.festividades.length ? (<><dt>Festividades</dt><dd style={{ margin: 0 }}>{contexto.festividades.join(', ')}</dd></>) : null}
            {contexto.floraFauna.length ? (<><dt>Cultivos y fauna</dt><dd style={{ margin: 0 }}>{contexto.floraFauna.join(', ')}</dd></>) : null}
          </dl>
        ) : (
          <p className="dc-muted">Sin contexto. Se puede escribir al crear la clase.</p>
        )}
      </section>

      <section className="dc-card" aria-labelledby="aj-datos">
        <h2 id="aj-datos">Datos y privacidad</h2>
        <p className="dc-muted">Todo se guarda en este celular. Los nombres de tus estudiantes y los contactos de las familias no salen de aquí: ni por QR, ni por el hub, ni en los informes.</p>
        {esDemo ? <p className="dc-muted">Estás viendo datos de ejemplo.</p> : null}
        <button type="button" className="dc-btn dc-btn--danger" onClick={() => acciones.reiniciar()}>
          Borrar esta clase del celular
        </button>
      </section>
    </>
  );
}

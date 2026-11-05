/** Small app-level screens and adapters used by the route table (kept apart for fast refresh). */
import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Ajustes as AjustesDocente } from '../features/docente/vistas/Ajustes.tsx';
import { AjustesGenerales } from '../shell/pantallas/AjustesGenerales.tsx';
import { useSesion } from '../shell/sesion.ts';
import { cargarDemo } from './demo.ts';
import { identidadDeGrupo, type IdentidadDispositivo } from './identidad.ts';
import { mapearUrlVieja } from './urlVieja.ts';

/** `/display.html?sala=X` typed or bookmarked inside the hash router goes to its new home. */
export function RedirigirUrlVieja() {
  const { pathname, search } = useLocation();
  const destino = mapearUrlVieja(new URL(`https://rikuy.local${pathname}${search}`));
  return <Navigate to={destino ? destino.slice(1) : '/'} replace />;
}

/** Hands the pseudonymous ids of this group device to a feature screen. */
export function ConIdentidad({ hijo }: { hijo: (id: IdentidadDispositivo) => ReactNode }) {
  const codigo = useSesion((s) => s.codigoClase);
  const apodo = useSesion((s) => s.apodo);
  return <>{hijo(identidadDeGrupo(codigo, apodo))}</>;
}

/** Teacher Ajustes: the class switches of F6 and the device settings of the shell. */
export function AjustesCompletos() {
  return (
    <>
      <AjustesDocente />
      <CargarDemo />
      <EnlacesPresentador />
      <AjustesGenerales />
    </>
  );
}

/** Ajustes > "Presentador": the two desktop tabs of the pitch (object with Rikuy, audience grading board). */
export function EnlacesPresentador() {
  const abrir = (ruta: string) => `${location.pathname}#${ruta}`;
  return (
    <section className="dc-card" aria-labelledby="presentador-titulo">
      <h2 id="presentador-titulo">Presentador</h2>
      <p className="dc-muted">Pestañas para el proyector. El público entra con el QR a la Sala del público (#/unirse/demo).</p>
      <ul>
        <li>
          <a href={abrir('/presentador/objeto')} target="_blank" rel="noreferrer">
            Objeto escaneado con Rikuy
          </a>
        </li>
        <li>
          <a href={abrir('/presentador/tablero')} target="_blank" rel="noreferrer">
            Tablero de calificaciones en vivo
          </a>
        </li>
      </ul>
    </section>
  );
}


/** Ajustes > "Cargar demo": the golden demo class, replacing what this phone has (with a confirmation). */
export function CargarDemo() {
  const [estado, setEstado] = useState<'inicio' | 'confirmar' | 'listo'>('inicio');
  return (
    <section className="dc-card" aria-labelledby="demo-titulo">
      <h2 id="demo-titulo">Clase de demostración</h2>
      <p className="dc-muted">2.º B, 4 grupos, péndulo, con evidencias y mensajes de ejemplo. Reemplaza la clase de este celular.</p>
      {estado === 'confirmar' ? (
        <span className="dc-row">
          <button
            type="button"
            className="dc-btn dc-btn--primary"
            onClick={() => {
              cargarDemo();
              setEstado('listo');
            }}
          >
            Sí, cargar la demo
          </button>
          <button type="button" className="dc-btn" onClick={() => setEstado('inicio')}>
            Cancelar
          </button>
        </span>
      ) : (
        <button type="button" className="dc-btn" onClick={() => setEstado('confirmar')}>
          Cargar demo
        </button>
      )}
      {estado === 'listo' ? <p role="status">Demo cargada: 2.º B con 4 grupos. Datos de ejemplo.</p> : null}
    </section>
  );
}

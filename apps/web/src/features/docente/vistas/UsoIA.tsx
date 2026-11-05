/** Teacher's view of this month's AI usage (cost logged per call by the gateway, monthly cap per school). */
import { useEffect, useState } from 'react';
import { clienteTutorPorDefecto, type ClienteTutorNube, type UsoIA as Uso } from '../../tutor/nube.ts';

export function UsoIA({ nube }: { nube?: ClienteTutorNube | null }) {
  const [uso, setUso] = useState<Uso | null | 'cargando'>('cargando');
  useEffect(() => {
    const c = nube === undefined ? clienteTutorPorDefecto() : nube;
    if (!c) {
      setUso(null);
      return;
    }
    let vigente = true;
    void c.uso().then((u) => vigente && setUso(u));
    return () => {
      vigente = false;
    };
  }, [nube]);
  return (
    <section className="dc-card" aria-labelledby="aj-ia">
      <h2 id="aj-ia">Uso de IA este mes</h2>
      {uso === 'cargando' ? (
        <p className="dc-muted" style={{ margin: 0 }}>Consultando la nube…</p>
      ) : uso === null ? (
        <p className="dc-muted" style={{ margin: 0 }}>Sin conexión con la nube: Rikuy funciona con reglas en el dispositivo, sin costo.</p>
      ) : (
        <p style={{ margin: 0 }}>
          Gastado: US$ {uso.gastadoUsd.toFixed(3)}
          {uso.topeMensualUsd ? ` de ${uso.topeMensualUsd.toFixed(2)}` : ''} · Restante: US$ {uso.restanteUsd.toFixed(3)} · {uso.llamadas} llamadas registradas
          {uso.modo ? ` · modo ${uso.modo}` : ''}
          <br />
          <span className="dc-muted">Al llegar al tope, Rikuy sigue con reglas y sin dibujos ni voz en la nube.</span>
        </p>
      )}
    </section>
  );
}

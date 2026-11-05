/** Hologram hub: choose the role of this phone. Join by code here, or by scanning the projector QR with any camera app. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { gestureSwitch } from '../../platform/gestos/teacherSwitch.ts';
import { normalizeRoomCode } from './sala/room.ts';

export function PaginaHolo() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(false);
  const sw = gestureSwitch();
  const [gestos, setGestos] = useState(sw.enabled);

  function unirse(e: React.FormEvent) {
    e.preventDefault();
    const sala = normalizeRoomCode(codigo);
    if (!sala) return setError(true);
    navigate(`/holo/control/${sala}`);
  }

  const tarjeta = 'flex min-h-14 flex-col justify-center rounded-2xl border-2 border-[#D3D9CC] bg-white p-4';
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 bg-[#F5F6F1] p-4 text-[#0D2B33]">
      <h1 className="text-3xl font-extrabold">Holograma</h1>
      <Link to="/holo/proyector" className={tarjeta}>
        <b className="text-lg">Este celular es el proyector</b>
        <span className="text-sm text-[#33494F]">Va bajo la pirámide. Muestra un código y un QR.</span>
      </Link>
      <form onSubmit={unirse} className={`${tarjeta} gap-2`}>
        <label htmlFor="codigo" className="text-lg font-bold">Este celular es el control</label>
        <span className="text-sm text-[#33494F]">Escanea el QR del proyector con la cámara, o escribe el código.</span>
        <input
          id="codigo"
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value);
            setError(false);
          }}
          inputMode="text"
          autoCapitalize="characters"
          maxLength={6}
          className="h-14 rounded-xl border-2 border-[#6A7568] px-3 text-center text-3xl font-extrabold uppercase tracking-[0.3em]"
        />
        {error && <p role="alert" className="text-[#96102F]">El código tiene 4 letras o números. Revísalo en el proyector.</p>}
        <button className="h-14 rounded-xl bg-[#075E6C] text-lg font-bold text-white">Unirme</button>
      </form>
      <Link to="/holo/ver/pendulo" className={tarjeta}>
        <b className="text-lg">Un solo celular</b>
        <span className="text-sm text-[#33494F]">El holograma en la pantalla, con gestos o con el dedo.</span>
      </Link>
      <Link to="/holo/escanear" className={tarjeta}>
        <b className="text-lg">Escanear un objeto</b>
        <span className="text-sm text-[#33494F]">Filma un objeto real y míralo girar en el holograma.</span>
      </Link>
      <section aria-label="Para la profesora" className={`${tarjeta} gap-2`}>
        <b>Para la profesora: gestos con cámara</b>
        <button
          type="button"
          role="switch"
          aria-checked={gestos}
          onClick={() => {
            sw.set(!gestos);
            setGestos(!gestos);
          }}
          className="flex h-14 items-center justify-between rounded-xl border-2 border-[#6A7568] px-3"
        >
          <span>{gestos ? 'Activos' : 'Apagados'}</span>
          <span aria-hidden="true" className={`h-9 w-16 rounded-full ${gestos ? 'bg-[#075E6C]' : 'bg-[#E9ECE4]'}`} />
        </button>
        <p className="text-xs text-[#4D6368]">Al apagarlos, toda cámara de manos de este celular se detiene en el acto. No se guarda ninguna imagen.</p>
      </section>
    </main>
  );
}

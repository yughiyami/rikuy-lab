/** Wire and storage shapes of a scanned object (mirror of the cloud's /ia/objeto3d answer). */
export interface MascaraCelda {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  bits: string;
}

export interface ParteObjeto {
  nombre: string;
  funcion: string;
  x: number;
  y: number;
}

export interface IdentificacionObjeto {
  nombre: string;
  conceptoSam: string;
  descripcion: string;
  partes: ParteObjeto[];
  narracion: string;
  pregunta: string;
}

export interface RespuestaObjeto3d {
  identificacion: IdentificacionObjeto;
  mascaras: Array<MascaraCelda | null>;
  competencia: { id: string; nombre: string } | null;
  motor: { identificacion: 'gemini'; segmentacion: 'sam-3.1' | 'ninguna'; modelo3d: 'vista360' };
  aviso?: string;
}

/** What this device keeps (Dexie) so the exhibit opens offline afterwards. */
export interface ObjetoEscaneado {
  id: string;
  creado: string;
  identificacion: IdentificacionObjeto;
  competencia: { id: string; nombre: string } | null;
  motor: RespuestaObjeto3d['motor'];
  aviso?: string;
  /** Hero keyframe (JPEG) the hotspots point at. */
  heroe: Blob;
  atlas: Blob;
  /** Optional reconstructed mesh (GLB file name next to objeto.json, or a URL). */
  modelo?: string;
  modeloFuente?: string;
  columnas: number;
  filas: number;
  vistas: number;
}

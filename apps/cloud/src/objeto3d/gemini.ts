/**
 * Gemini identifies the filmed object from the hero keyframe: name, the short English noun phrase SAM
 * segments best, its visible parts with a point on the hero frame (hotspots), the tutor narration and one
 * Socratic question. Structured JSON output, validated with zod; nothing here is trusted blindly.
 */
import { z } from 'zod';

export const Parte = z.object({
  nombre: z.string().min(1).max(60),
  funcion: z.string().min(1).max(240),
  /** Point on the hero frame, normalized 0..1 (x to the right, y down). */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type Parte = z.infer<typeof Parte>;

export const Identificacion = z.object({
  nombre: z.string().min(1).max(80),
  conceptoSam: z.string().min(1).max(40),
  descripcion: z.string().min(1).max(400),
  partes: z.array(Parte).max(10),
  narracion: z.string().min(1).max(900),
  pregunta: z.string().min(1).max(300),
});
export type Identificacion = z.infer<typeof Identificacion>;

const ESQUEMA = {
  type: 'object',
  properties: {
    nombre: { type: 'string', description: 'Nombre del objeto en español, corto.' },
    conceptoSam: { type: 'string', description: 'Frase nominal en inglés, 1 a 3 palabras, que nombra el objeto completo para un segmentador (p. ej. "circuit board").' },
    descripcion: { type: 'string' },
    partes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { nombre: { type: 'string' }, funcion: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } },
        required: ['nombre', 'funcion', 'x', 'y'],
      },
    },
    narracion: { type: 'string' },
    pregunta: { type: 'string' },
  },
  required: ['nombre', 'conceptoSam', 'descripcion', 'partes', 'narracion', 'pregunta'],
};

const INSTRUCCION =
  'Eres Rikuy, tutor de ciencia y tecnología de un colegio peruano. Un estudiante filmó este objeto real. ' +
  'Identifícalo y nombra entre 4 y 8 partes VISIBLES en esta imagen, con la coordenada (x,y normalizada 0..1, ' +
  'x hacia la derecha, y hacia abajo) del centro de cada parte en ESTA imagen y su función en una frase sencilla. ' +
  'Escribe una narración breve (3 a 5 frases, español claro, tuteo, sin tecnicismos innecesarios) para presentarlo en ' +
  'el holograma, y UNA pregunta socrática que invite a pensar cómo se diseñó o cómo mejorarlo como solución tecnológica. ' +
  'No inventes partes que no se ven. Responde solo el JSON pedido.';

export interface OpcionesGemini {
  apiKey: string;
  modelo: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export async function identificarObjeto(o: OpcionesGemini, heroeDataUrl: string, pista?: string): Promise<Identificacion> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(heroeDataUrl);
  if (!m) throw new Error('imagen_invalida');
  const f = o.fetch ?? fetch;
  const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(o.modelo)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': o.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: INSTRUCCION + (pista ? ` Pista del estudiante: "${pista.slice(0, 80)}".` : '') }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: ESQUEMA, temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 45_000),
  });
  if (!r.ok) throw new Error(`gemini_http_${r.status}`);
  const j = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const texto = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const datos = Identificacion.safeParse(JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, '')));
  if (!datos.success) throw new Error('gemini_formato');
  return datos.data;
}

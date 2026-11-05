import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { crearApp } from '../app.ts';
import { crearDepsSimuladas } from '../deps.ts';
import { competenciaTecnologica, depsObjeto3dDesdeEntorno } from './rutas.ts';
import { asignarACeldas, decodificarMascara, empacarBits, leerRegistrosSam } from './sam.ts';

// A real record returned by sam-3.1 for the Raspberry Pi demo sheet (its box sits in cell 3).
const REGISTRO = readFileSync(join(import.meta.dirname, 'fixtures', 'registro-sam.txt'), 'utf8').trim();
const IMG = 'data:image/jpeg;base64,AAAA';
const CELDAS = Array.from({ length: 12 }, (_, i) => ({ x: 24 + (i % 6) * 224, y: 24 + Math.floor(i / 6) * 380, w: 200, h: 356 }));

function identificacion() {
  return {
    nombre: 'Raspberry Pi 4',
    conceptoSam: 'circuit board',
    descripcion: 'Una computadora pequeña en una sola placa.',
    partes: [{ nombre: 'Procesador', funcion: 'Hace los cálculos.', x: 0.5, y: 0.5 }],
    narracion: 'Mira esta placa.',
    pregunta: '¿Por qué crees que los puertos están en un solo borde?',
  };
}

function fetchFalso(samTexto: string, samStatus = 200) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('generativelanguage')) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(identificacion()) }] } }] }));
    }
    return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: samTexto }] }] }), { status: samStatus });
  }) as unknown as typeof fetch;
}

function app(f: typeof fetch, conSam = true) {
  return crearApp(crearDepsSimuladas({ objeto3d: { gemini: { apiKey: 'g', modelo: 'm', fetch: f }, ...(conSam ? { sam: { apiKey: 's', baseUrl: 'https://x/v1', fetch: f } } : {}) } }));
}

const cuerpo = (o: object = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json', 'x-rikuy-colegio': 'demo-01' }, body: JSON.stringify({ heroe: IMG, hoja: IMG, celdas: CELDAS, ...o }) });

describe('SAM output', () => {
  it('parses a real record and decodes its mask with the official codec', () => {
    const [r] = leerRegistrosSam(`<0f>${REGISTRO}`);
    expect(r).toMatchObject({ objeto: 11, x1: 696, y1: 151, x2: 810, y2: 280, alto: 130, ancho: 115 });
    const raster = decodificarMascara(r!);
    expect(raster.length).toBe(130 * 115);
    const encendidos = raster.reduce((a, b) => a + b, 0);
    expect(encendidos).toBeGreaterThan(5000);
    expect(encendidos).toBeLessThan(130 * 115);
  });

  it('packs bits MSB first', () => {
    expect(Buffer.from(empacarBits(Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 1, 1])), 'base64')).toEqual(Buffer.from([0x81, 0x80]));
  });

  it('assigns each record to the cell holding its center and keeps the largest', () => {
    const base = { objeto: 0, alto: 1, ancho: 1, payload: '' };
    const celdas = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 100, y: 0, w: 100, h: 100 }];
    const out = asignarACeldas([{ ...base, x1: 10, y1: 10, x2: 20, y2: 20 }, { ...base, x1: 5, y1: 5, x2: 90, y2: 90 }, { ...base, x1: 300, y1: 0, x2: 310, y2: 5 }], celdas);
    expect(out[0]?.x2).toBe(90);
    expect(out[1]).toBeNull();
  });

  it('zero matches is an empty list, not an error', () => {
    expect(leerRegistrosSam('')).toEqual([]);
  });
});

describe('POST /ia/objeto3d', () => {
  it('identifies with Gemini, segments with SAM and links the exact CNEB competence', async () => {
    const f = fetchFalso(`<0f>${REGISTRO}`);
    const r = await app(f).request('/ia/objeto3d', cuerpo({ grado: 'secundaria-2' }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.motor).toEqual({ identificacion: 'gemini', segmentacion: 'sam-3.1', modelo3d: 'vista360' });
    expect(j.mascaras).toHaveLength(12);
    expect(j.mascaras[3]).toMatchObject({ x: 696 - CELDAS[3]!.x, y: 151 - CELDAS[3]!.y, ancho: 115, alto: 130 });
    expect(j.mascaras.filter((m: unknown) => m !== null)).toHaveLength(1);
    expect(j.competencia).toEqual(competenciaTecnologica('secundaria-2'));
    expect(j.competencia.id).toBe('secundaria-2:cyt:c3');
    // SAM receives the concept phrase Gemini chose.
    const llamadaSam = (f as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls.find(([u]) => u.includes('/responses'))!;
    expect(JSON.parse(String(llamadaSam[1].body)).input[0].content[0].text).toBe('circuit board');
  });

  it('degrades to the simple cut-out when SAM fails, saying so', async () => {
    const r = await app(fetchFalso('', 500)).request('/ia/objeto3d', cuerpo());
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.motor.segmentacion).toBe('ninguna');
    expect(j.aviso).toMatch(/recorte simple/);
  });

  it('rejects bad input and answers 503 without Gemini', async () => {
    expect((await app(fetchFalso('')).request('/ia/objeto3d', cuerpo({ celdas: [] }))).status).toBe(400);
    const sinNube = crearApp(crearDepsSimuladas());
    expect((await sinNube.request('/ia/objeto3d', cuerpo())).status).toBe(503);
  });

  it('reads providers from the environment and none in mock mode', () => {
    expect(depsObjeto3dDesdeEntorno({ RIKUY_AI_MODE: 'mock', GEMINI_API_KEY: 'x' })).toEqual({});
    const d = depsObjeto3dDesdeEntorno({ GEMINI_API_KEY: 'x', META_API_KEY: 'y' });
    expect(d.gemini?.modelo).toBe('gemini-3.8-flash');
    expect(d.sam?.baseUrl).toBe('https://api.meta.ai/v1');
  });
});

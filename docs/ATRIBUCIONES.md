# Atribuciones

Todo el código de este repositorio se escribió durante Hack4Edu 2026 (3–5 de noviembre) y se publica bajo MIT.

## Dependencias

| Proyecto | Uso | Licencia |
|---|---|---|
| [three.js](https://threejs.org) | Render 3D, `MeshSurfaceSampler`, `GLTFLoader` | MIT |
| [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer) | Reconocimiento de gestos de mano en el dispositivo | Apache 2.0 |
| [Vite](https://vite.dev) y `@vitejs/plugin-basic-ssl` | Desarrollo y empaquetado; HTTPS local | MIT |
| [Express](https://expressjs.com) | Servidor HTTP | MIT |
| [ws](https://github.com/websockets/ws) | Relay WebSocket de salas | MIT |
| [tsx](https://tsx.is) | Ejecutar TypeScript en el servidor | MIT |

## Referencias consultadas (sin copiar código)

- Petroochio, *cracked-pepper*: composición de 4 vistas para pirámide en el navegador.
- Electric Archaeology, display holográfico de museo con Three.js.
- MDN, Web Speech API (`SpeechRecognition`, `speechSynthesis`).

## Modelos 3D

Las escenas incluidas son procedurales (generadas por código). Si se agregan `.glb` en
`apps/web/public/models/`, registrar aquí su autor y licencia.

### Holograma "digestivo" (sistema digestivo y lactasa)

La anatomía (tubo digestivo, pared intestinal, vellosidades) es procedural; no se usa ningún modelo
3D de terceros. El nivel molecular usa coordenadas reales, preprocesadas en tiempo de compilación por
`tools/holo-datos/estructuras.mjs` y guardadas en `packages/holo/src/scenes/digestivo/estructuras.ts`:

| Dato | Fuente | Licencia |
|---|---|---|
| Traza de carbonos alfa (cadena A) y sitio activo (galactosa unida) | [RCSB PDB 1JZ7](https://www.rcsb.org/structure/1JZ7): β-galactosidasa (LacZ) de *E. coli* con galactosa. Juers D.H. *et al.* (2001) *Biochemistry* 40:14781. **Es una enzima análoga** a la lactasa humana (misma reacción: rompe el enlace β(1→4) de la lactosa), no la lactasa humana. | CC0 1.0 (datos del PDB) |
| Lactosa (CID 6134), D-glucosa (CID 5793), D-galactosa (CID 6036), conformeros 3D, solo átomos pesados | [PubChem](https://pubchem.ncbi.nlm.nih.gov) (NCBI/NIH) | Dominio público |

## Tutor, juez y memoria (F4)

- Juez con nivel, cita literal y "NO" (`aggregateRuns`, `sanitizeQuote`): portado de `Educacion/web/src/lib/judge/rubric.ts`, proyecto propio del equipo.
- Agente de reglas, escalera de pistas y herramientas: refactor del `rulesAgent.ts` y `tools.ts` de Rikuy Lab (código del equipo).
- Contrato de honestidad ("anunciar en futuro, confirmar con el resultado"), patrón del director que propone JSON y el código valida, e idea de memoria por alumno: patrones de [paoloose/aulaquipu](https://github.com/paoloose/aulaquipu) (`apps/web-app/lib/director.ts`, `backend/agents/aulaquipu-tutor`). Solo patrones, sin copiar código.
- Búsqueda por palabras clave: [MiniSearch](https://github.com/lucaong/minisearch) (MIT).

## Capa de IA y Creador (F7)

- [Willay](https://github.com/yughiyami/willay) (yughiyami): el patrón "la IA propone, la regla decide, la docente confirma" (`backend/willay/domain/tiers.py`) y la lógica de reintentos y presupuesto del adaptador de Meta (`backend/willay/adapters/meta_model_api.py`, `meta_usage.py`), portada de Python a TypeScript en `packages/ai/src/adaptadores/meta.ts` y en el presupuesto de `@rikuy/ai`. También la idea de pictogramas generados y revisados por la docente. Ver `docs/ecosistema/CREDITOS.md`.

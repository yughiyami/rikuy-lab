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

## Tutor, juez y memoria (F4)

- Juez con nivel, cita literal y "NO" (`aggregateRuns`, `sanitizeQuote`): portado de `Educacion/web/src/lib/judge/rubric.ts`, proyecto propio del equipo.
- Agente de reglas, escalera de pistas y herramientas: refactor del `rulesAgent.ts` y `tools.ts` de Rikuy Lab (código del equipo).
- Contrato de honestidad ("anunciar en futuro, confirmar con el resultado"), patrón del director que propone JSON y el código valida, e idea de memoria por alumno: patrones de [paoloose/aulaquipu](https://github.com/paoloose/aulaquipu) (`apps/web-app/lib/director.ts`, `backend/agents/aulaquipu-tutor`). Solo patrones, sin copiar código.
- Búsqueda por palabras clave: [MiniSearch](https://github.com/lucaong/minisearch) (MIT).

## Capa de IA y Creador (F7)

- [Willay](https://github.com/yughiyami/willay) (yughiyami): el patrón "la IA propone, la regla decide, la docente confirma" (`backend/willay/domain/tiers.py`) y la lógica de reintentos y presupuesto del adaptador de Meta (`backend/willay/adapters/meta_model_api.py`, `meta_usage.py`), portada de Python a TypeScript en `packages/ai/src/adaptadores/meta.ts` y en el presupuesto de `@rikuy/ai`. También la idea de pictogramas generados y revisados por la docente. Ver `docs/ecosistema/CREDITOS.md`.

## Vista de escritorio del Museo (AulaQuipu)

[AulaQuipu](https://github.com/paoloose/aulaquipu), de paoloose (Paolo Flores) y su equipo, es un MVP de hackathon sin archivo LICENSE; su equipo acordó que su código se puede reutilizar y redistribuir, y se acredita aquí. Partes portadas a TypeScript y a la estructura hexagonal de Rikuy, con encabezado de atribución en cada archivo:

- Reglas del chat de proximidad (`apps/web-app/lib/campus/chat-rules.ts`): limpieza del mensaje, máscara de groserías, bloqueo de enlaces, correos y teléfonos, límite de ritmo y radio de cercanía. Portado a `packages/campus/src/charla.ts` ("Charla de cerca"), adaptado a una sala CNEB por escena.
- Guía que te lleva caminando con un camino en el piso (`apps/web-app/lib/campus/guides.ts`, Killa): portado a `apps/web/src/features/escritorio/guia.ts` con Rikuy como guía y destinos del museo (exhibición del día, curador, puerta del vestíbulo).
- HUD del campus (`apps/web-app/components/campus/campus-shell.tsx` y `world.tsx`): letrero del espacio actual, aviso "tecla cerca de un objeto" (aquí E o Intro), banner "Sigue las huellas" con Cancelar y el mundo grande con paneles laterales. Adaptado en `apps/web/src/features/escritorio/MuseoEscritorio.tsx`, `ObservarMuseo.tsx` y `ControladorMundo.interactuar()`.

No se copió: arte (los muebles y figuras de AulaQuipu son de Habbo/Sulake), Supabase, la economía con dinero de juego ni LiveKit. La voz en vivo queda como un gancho apagado (`vozEnVivo.ts`) porque necesita servidor y credenciales; **no se copió ninguna credencial, clave ni URL de LiveKit**.

## Arte del Museo (pixel art)

- [Kenney](https://www.kenney.nl), *Roguelike Indoor pack* (Kenney Vleugels), **CC0 1.0** (dominio público). Plantas, bancas, estantes, cuadros y tapices del museo. Hoja `apps/web/public/arte/kenney/roguelike-indoor/roguelikeIndoor_transparent.png`, con su `License.txt` junto al archivo. Descargado del espejo oficial en OpenGameArt (`opengameart.org/content/roguelike-indoor-pack`). Mapa de celdas en `packages/campus/src/canvas/sprites.ts` (`KENNEY`).
- Arte propio (escrito en código, Hack4Edu 2026, MIT): pisos de madera y piedra, muros con zócalo, alfombras de *awayu*, medallón de chakana, quipus de pared, vitrinas, péndulo, microscopio, matraces, cerámica, personajes de los grupos (4 direcciones, ciclo de caminata), la curadora con chullo y Rikuy (piedra de río con un ojo y cordón ámbar). Sin sprites de Habbo/Sulake ni de AulaQuipu.

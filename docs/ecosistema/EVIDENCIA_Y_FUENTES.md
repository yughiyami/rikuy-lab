# Evidencia y fuentes

Qué fuentes usa Rikuy para el currículo, los ítems de evaluación y el check-in del Guardián, con su licencia y qué está verificado. Regla del proyecto: no se inventan ítems ni citas. Todo lo que no viene de una fuente citable se marca como «Ítem de práctica elaborado por el equipo, no validado».

## 1. Currículo (RAG sin conexión)

| Fuente | URL | SHA-256 del archivo descargado (2026-11-05) | Uso | Estado |
| --- | --- | --- | --- | --- |
| Currículo Nacional de la Educación Básica (MINEDU, RM N.º 281-2016-MINEDU), 224 págs. | https://www.minedu.gob.pe/curriculo/pdf/curriculo-nacional-de-la-educacion-basica.pdf | `a745ca842113f53609c435df9a13eda67371164b22ccb8492b2b02167dc2299b` | Párrafos de los enfoques transversales (págs. 21-29 del PDF) y de las competencias 20, 21 y 22 con sus capacidades (págs. 122, 127, 130). Estándares de los ciclos VI y VII (págs. 125, 129, 133). | **Verificado**: texto tomado de la capa de texto del PDF (pdftotext), sin OCR. Ver `packages/curriculum-cneb/data/cneb-oficial.json`. |
| Programa Curricular de Educación Secundaria (MINEDU, 2016), 259 págs. | https://www.minedu.gob.pe/curriculo/pdf/programa-curricular-educacion-secundaria.pdf | `3f4443dd1273f287c1ae069eed1cb314cb0574f9f0794495716415be2ec8075b` | Desempeños por grado (1.º a 5.º de secundaria), vía `data/cneb-cyt.json` (extracción OCR de Hecze/supermentes). | **Por verificar**: el PDF oficial es un escaneo sin capa de texto y no había OCR disponible. Cada desempeño se muestra con «texto por verificar contra el PDF oficial» y sin número de página. |

Resultado de la comprobación literal de `data/cneb-cyt.json` contra el CNEB oficial (script `packages/curriculum-cneb/scripts/construir-cneb-oficial.mjs`):

- Estándares de secundaria (ciclos VI y VII, competencias 1-3): **6 de 6 coinciden literalmente**.
- Capacidades de secundaria: **10 de 11 coinciden**. No coincide «Implementa y valida la alternativa de solución tecnológica» (competencia 3); queda por revisar contra el PDF.
- Fuera del alcance (primaria), hay diferencias: por ejemplo, el estándar del ciclo III de la competencia 1 dice «posibles respuesta» en los datos OCR. No se corrigió en esta entrega.

Licencia: documento oficial del Estado peruano. El equipo lo trata como texto oficial reutilizable con cita de la fuente (art. 9 del D. Leg. 822 excluye de protección los textos oficiales de carácter administrativo). Es una interpretación del equipo, no asesoría legal.

Cómo funciona la recuperación: índice BM25 en el teléfono (`@rikuy/curriculum-cneb`, `construirIndice`), normalización española (minúsculas, sin tildes, palabras vacías, recorte de sufijos). Cada resultado lleva documento, sección, página del PDF y si está verificado. Hub o nube pueden añadir embeddings con el adaptador opcional `IndiceVectorial` de `@rikuy/memoria`; no se activó en esta entrega.

Dónde se usa:

- Tutor: cada respuesta muestra el fragmento recuperado y su fuente («Del currículo: … Fuente: …»).
- Verificador del Creador (`@rikuy/ai`, regla `cneb_sin_fundamento`): si se le pasan fragmentos recuperados, rechaza una cita del CNEB que no esté literalmente en alguno.
- Docente: «Buscar en el currículo» (`/docente/clase/curriculo`), sobre el CNEB y el plan aprobado.

## 2. Banco de ítems de evaluación

Archivo: `packages/curriculum-cneb/data/items-evaluacion.json`. Cada ítem trae enunciado, opciones o rúbrica, clave, competencia y capacidad CNEB, grado, URL de la fuente, licencia, si el texto es literal o paráfrasis, y `validacion`: `fuente-oficial` o `practica-del-equipo`. La prueba `items.test.ts` valida cada ítem: un ítem con `textoLiteral: true` exige una licencia que permita el texto completo.

Puntaje: porcentaje de aciertos total, por ítem y por capacidad (`puntuar`). Respuestas anónimas, sin ranking de estudiantes y sin afirmaciones psicométricas más allá de lo que publica la fuente.

Las fuentes de ítems y sus licencias se listan en la sección 4.

## 3. Check-in del Guardián

El informe de investigación del equipo («Detección ética de emociones en aula») recomienda una rejilla de agrado por energía como **andamio de vocabulario, no como instrumento validado**, inspirada en el Self-Assessment Manikin (SAM; Bradley y Lang, 1994, *Journal of Behavior Therapy and Experimental Psychiatry* 25(1):49-59), y en EmojiGrid (Toet et al., 2018), validado con adultos. Por eso el check-in se describe como «adaptado del SAM, no validado en esta población». Se mantienen las reglas existentes: voluntario, omisible, «no sé» y «prefiero no decir», sin diagnóstico. Los ítems de AEQ y PANAS-C-SF quedan solo como criterio de validación para un piloto, no como parte de la app.

Pendiente: cambiar el texto en pantalla del check-in para citar la fuente. No entró en esta entrega.

## 4. Ítems: fuentes consultadas

Ver la tabla generada con el banco (sección «Ítems» al final de este archivo). Si una fuente no permite reproducir el texto, se guarda solo la referencia, una paráfrasis breve y el enlace.

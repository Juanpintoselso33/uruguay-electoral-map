---
title: 'PRD — Uruguay Electoral Map (Rebuild)'
status: final
created: 2026-05-30
updated: 2026-05-30
---

# PRD — Uruguay Electoral Map (Rebuild)

## 1. Resumen del producto

Explorador-archivo **mobile-first** de resultados electorales de Uruguay a nivel de **departamento, zona/barrio y circuito**, con **profundidad histórica** (varias elecciones comparables) y **links compartibles con preview rico**. No compite por velocidad la noche electoral; es el lugar al que se vuelve para **entender** una elección: granular, permanente y comparable — algo que ni los medios (cobertura efímera) ni la Corte (datos crudos, viz pobre) priorizan. _[A6]_

- **Usuario #1:** ciudadano curioso en el celular ("¿cómo votó mi barrio?").
- **Usuario #2:** periodista / analista de datos electorales (profundidad, comparación, citar/exportar).
- **Producto:** archivo/análisis ahora; vista "noche electoral" en vivo como fase futura.
- **Diferenciador:** permanencia + granularidad (opción electoral × zona/circuito) + comparabilidad histórica.

## 2. Glosario de dominio

Términos del sistema electoral uruguayo usados en este PRD:

- **Opción electoral:** lo que se vota. Varía por tipo de elección: una **HOJA** (lista) en internas y nacionales legislativas; un **candidato/lema** en balotaje y en la elección presidencial. El modelo es agnóstico: la unidad de voto es _opción electoral_, no siempre HOJA.
- **HOJA:** número de lista. Pertenece a exactamente un partido. Sus números **cambian entre elecciones** (no son identidad estable).
- **Partido / lema:** la agrupación política. **Estable entre elecciones** (a diferencia de la HOJA).
- **PRECANDIDATO:** aplica en ODN (internas); en otros tipos puede no existir.
- **ODN / ODD:** Orden Departamental Nacional / Departamental Departamental.
- **ESCRUTINIO:** etapa de conteo. La **etapa canónica de este producto es el escrutinio definitivo/total** (el conteo final validado). Nunca se suman etapas distintas.
- **CIRCUITO ⊃ SERIE ⊃ ZONA:** jerarquía geográfica de agregación.
- **Voto canónico:** votos de la etapa definitiva, por (opción electoral × unidad geográfica). Las agregaciones se derivan por roll-up.
- **Votos válidos vs. en blanco / anulados / observados:** los totales oficiales incluyen blanco/anulado/observado, que **no tienen partido ni HOJA**. Se modelan como categorías aparte (ver M8/NFR4).

## 3. Usuario primario y secundario

- **Primario — Ciudadano curioso.** Poco politizado, llega por **link compartido** o búsqueda. Quiere una respuesta en 3 segundos, en mobile, sin jerga. El producto se ordena según su éxito.
- **Secundario — Periodista/analista.** Bajo volumen, alto valor, **altavoz** (cita y linkea). Necesita profundidad y dato citable. Se sirve por **progressive disclosure**: las herramientas avanzadas están a un clic, nunca en la cara del ciudadano.

## 4. User Journeys

### UJ-1 — Lucía, la ciudadana curiosa (recorrido primario)

**Protagonista:** Lucía, 29, Maldonado. Vota, le interesa, pero no es "de política". Domingo de elección, 22:10, en el sillón con el celular.

1. **Llega por un link compartido** por una amiga (o por Google/redes). _[A1]_
2. El link ya trae el contexto (depto + elección en la URL) → **aterriza directo en el mapa de su departamento, ya coloreado**, respondiendo "¿quién ganó acá?" sin tocar nada. _[A2]_
3. Toca **su zona/barrio** → sube un *bottom sheet* con números grandes y legibles: opción ganadora con **nombres humanos** (lema/partido, no "HOJA 609"), color de partido.
4. Curiosea: cambia de departamento o ve el detalle por opción, sin perderse.
5. **Comparte** la vista exacta → el link reproduce el estado y muestra **preview rico** (imagen del contorno del depto + título "Maldonado · Internas 2024").
6. _(Opcional, progressive disclosure)_ Un toque de "**vs. elección anterior**" le muestra el cambio a nivel **partido/lema** respecto al comicio previo. _[A3]_

**Dónde aterriza:** entiende cómo votó su zona en < 1 minuto y comparte un link que se ve bien.

### UJ-2 — Andrés, el periodista/analista (recorrido secundario)

**Protagonista:** Andrés, 41, redacción/freelance de datos. Lunes post-elección, en la notebook, armando una nota.

1. Entra buscando **profundidad**: quiere ver una opción específica a través de zonas/circuitos.
2. Usa **búsqueda** para saltar a una lista, candidato o departamento puntual. _[A4]_
3. **Compara** dos elecciones (a nivel partido/lema) lado a lado con datos a nivel circuito.
4. Necesita **dato citable/exportable** y un **deep-link** a la vista exacta para incrustar o citar. _[A5]_
5. Confía en el dato porque respeta el **voto canónico** (escrutinio definitivo; nunca suma etapas).

**Dónde aterriza:** obtiene un hallazgo granular, verificable y citable que ningún otro sitio le da.

## 5. Features y Requisitos Funcionales

FR numerados globalmente (IDs estables). Agrupados por capacidad. La columna de alcance se consolida en §6.

### F1 — Visualización de mapa (choropleth)
- **FR1** Renderizar el mapa del departamento con zonas/barrios coloreadas por opción/partido ganador.
- **FR2** Soportar niveles geográficos: departamento, zona/barrio y circuito. Si un nivel no tiene datos para esa elección, **degradar al nivel disponible más fino y rotularlo explícitamente** (no mostrar zonas vacías sin aviso).
- **FR3** En la vista de mapa individual, **una sola variable coloreada por vez** con leyenda que nombra qué representa cada color y su escala. La comparación multi-variable se hace en el **modo dual explícito** (FR16), no superponiendo variables en un mapa.
- **FR4** Interacción táctil mobile (tap en zona, pan, zoom) operable con el pulgar, sin requerir precisión de pinch para seleccionar una zona.

### F2 — Selección y contexto electoral
- **FR5** Seleccionar tipo de elección (`internas|nacionales|balotaje|departamentales`) y año.
- **FR6** Seleccionar departamento.
- **FR7** Seleccionar **opción electoral** según corresponda al tipo: HOJA (internas/legislativas) o candidato/lema (balotaje/presidencial). El selector se adapta al tipo de elección.
- **FR8** Alternar la pregunta/vista: "¿quién ganó?" vs "¿cómo le fue a ESTA opción?".

### F3 — Ficha de resultados (bottom sheet)
- **FR9** Al tocar una zona, mostrar ficha con sus resultados (opción/partido, votos, %). Incluir votos en **blanco/anulados/observados** como categorías cuando el dato los provea.
- **FR10** Traducir el dato crudo → nombre humano (lema, nº de lista, candidato, color de partido) vía capa de metadata.
- **FR11** Jerarquía de lectura en mobile: el dato dominante (quién ganó + %) legible **sin hacer scroll** dentro de la ficha en una pantalla de teléfono típica.

### F4 — Integridad y voto canónico
- **FR12** Contar el voto canónico de la etapa de **escrutinio definitivo/total**; nunca sumar etapas. El valor exacto de la columna `ESCRUTINIO` que representa "definitivo" se fija en el ETL. _[OQ3]_
- **FR13** Agregaciones (zona → serie → circuito → depto) por roll-up consistente de votos válidos.
- **FR14** Mostrar un **sello de origen y etapa del dato** en la UI (ej. "Corte Electoral — escrutinio definitivo"). La reconciliación de NFR4 es un gate de build, no un cálculo en runtime.

### F5 — Histórico y comparación
- **FR15** Navegar entre múltiples elecciones del mismo departamento.
- **FR16** **Modo comparación dual** (vista lado-a-lado o de cambio) entre dos elecciones, **por defecto a nivel partido/lema** (estable entre años), con granularidad zona/circuito.
- **FR17** Comparar dos opciones dentro de una misma elección.
- **FR18** _(Best-effort, Fase 2)_ Comparación a nivel **HOJA** entre elecciones, **solo donde exista una tabla de equivalencias** validada (FR32). Si no hay equivalencia, la comparación se mantiene a nivel partido/lema. _[Riesgo R1 — ver §9]_

### F6 — Búsqueda
- **FR19** Buscar y saltar a una lista, candidato o departamento conocido (índice estático). _[no semántico — A4]_

### F7 — Compartir / deep-link / preview social
- **FR20** Todo el estado relevante (elección, depto, zona/opción, vista, zoom) vive en la **URL**.
- **FR21** Botón "compartir" que copia el deep-link de la vista actual.
- **FR22** Preview social **rico por ruta**: meta-tags + OG-image pre-generada por elección×depto en build-time (a partir de geometría vectorial, no de un screenshot del mapa). _Detalle técnico en addendum._

### F8 — Exportar / dato citable (analista)
- **FR23** Exportar el dato de la vista actual (CSV).
- **FR24** Exportar imagen del mapa/ficha.

### F9 — Navegación y progressive disclosure
- **FR25** La entrada responde la pregunta del ciudadano **con la primera pantalla y sin configuración previa**; las capas avanzadas (comparación, búsqueda, export) están **a un clic detrás de una acción deliberada**, nunca abiertas por defecto.
- **FR26** Entrada en frío (sin contexto en URL) = overview nacional + selector de departamento. _[A2]_

### F10 — Pipeline de datos (ETL — habilitador)
- **FR27** Normalizar fuentes a UTF-8 en la ingesta.
- **FR28** Producir artefactos **shardeados por elección×departamento** + agregados precomputados (incluye agregados a nivel partido/lema para FR16).
- **FR29** Generar índice de búsqueda estático (alimenta FR19).
- **FR30** Generar OG-images por ruta canónica en build-time (alimenta FR22).
- **FR31** Validar cobertura de zonas (reporte de zonas sin match; gate de cobertura mínima).
- **FR32** _(Fase 2)_ Construir la tabla de normalización de `HOJA` entre elecciones (alimenta FR18).

## 6. Alcance — Slice de arranque vs fases

> Decisión: el reviewer marcó MVP-B como demasiado grande para dev solo. Se reduce el **MVP formal a un slice de-riesgado**; el resto pasa a fases.

### MVP (slice de arranque)
**1 departamento (sugerido: Montevideo, mayor volumen/dato) × 2 elecciones × nivel partido/lema × deep-link.** Incluye:
- F1, F2, F3, F4 (voto canónico definitivo), F7 (compartir + preview), F9, F10 (sin FR32).
- F5 acotado: navegación entre las 2 elecciones + comparación a **nivel partido/lema** (FR15, FR16, FR17).
- F6 (búsqueda) básica.
- **Objetivo de calidad del slice:** mobile impecable (NFR1) e integridad del dato (M8/NFR4) en ese alcance.

### Fase 2
- Resto de departamentos y más elecciones.
- **FR18 + FR32** (comparación a nivel HOJA con tabla de equivalencias, best-effort).
- **F8** (exportar CSV/imagen).

### Fase futura
- Vista **"noche electoral" en vivo**.
- **OG-image on-demand** para selecciones arbitrarias.
- **Circuitos de todo el país** vía vector tiles/PMTiles si el volumen lo exige.
- Comparación **multi-variable avanzada**.

## 7. Métricas de éxito y contra-métricas

Targets direccionales (proyecto cívico/portfolio). Los `[ASSUMPTION]` son hipótesis a calibrar post-lanzamiento.

### Métricas de éxito
| # | Métrica | Por qué importa | Target inicial |
|---|---------|-----------------|----------------|
| M1 | **Tasa de completar el JTBD**: % de sesiones que ven el resultado de una zona | Corazón del UJ-1 | > 60% `[ASSUMPTION]` |
| M2 | **LCP de la primera respuesta**: "quién ganó acá" visible (medido como Largest Contentful Paint, no como percepción de velocidad) | Velocidad real; el ciudadano abandona si tarda | < 2.5 s en mobile 4G |
| M3 | **Tasa de compartir**: % de sesiones que copian un deep-link | Motor de crecimiento | > 5% `[ASSUMPTION]` |
| M4 | **Tráfico entrante por links compartidos** (referral de deep-links) | Bucle viral del UJ-1 | Tendencia ↑ |
| M5 | **Salud mobile**: % de uso mobile y bounce | Usuario #1 es mobile | mobile ≥ 60%, bounce mobile menor que el de desktop |
| M6 | **Uso de profundidad** (analista): % sesiones con comparación o búsqueda | Valida UJ-2 | > 10% `[ASSUMPTION]` |
| M7 | **Preview social correcto**: % de rutas con OG-image + meta válidos | Habilita M3/M4 | 100% de rutas canónicas (gate) |
| M8 | **Integridad del dato**: los **votos válidos** reconcilian con el total de válidos oficiales por depto; blanco/anulado/observado se reportan como categorías separadas | Confianza = razón de ser | **0 discrepancias en válidos** (gate de build) |

_Instrumentación: M1/M3/M5/M6 requieren analítica liviana respetuosa de la privacidad; M2/M7 se miden en build/CI; M8 es un gate del ETL._

### Contra-métricas (lo que NO debe romperse al optimizar)
- **CM1** Subir engagement a costa de confusión → vigilar rage-taps / bounce tras el primer toque.
- **CM2** Agregar features a costa de performance mobile → CWV no deben degradar (NFR1).
- **CM3** Progressive disclosure que filtra complejidad al ciudadano → las herramientas del analista no deben aumentar la confusión del usuario #1.
- **CM4** **Nunca** inflar "completitud" sumando etapas de escrutinio → integridad sobre apariencia (FR12).
- **CM5** Subir tasa de compartir con previews rotos/pobres → M3 no vale sin M7.

## 8. Requisitos No Funcionales (NFR)

### NFR1 — Performance (mobile-first, prioridad #1)
- Core Web Vitals "Good" en mobile de gama media con red 4G: **LCP < 2.5 s, INP < 200 ms, CLS < 0.1**.
- Presupuesto de JS inicial acotado (la portada del ciudadano no arrastra el peso del mapa hasta que se necesita).
- Cambiar de departamento/elección **no re-inicializa** la instancia del mapa (anti-jank).
- Tamaño de shard por elección×depto acotado para carga fluida en mobile. _[OQ4: fijar presupuesto en KB tras medir volumen real.]_

### NFR2 — Accesibilidad
- Objetivo **WCAG 2.2 AA**.
- Paletas **color-blind safe**; el resultado nunca se comunica **solo** por color (texto/etiqueta acompañan).
- Navegación por teclado y anuncios para lector de pantalla en los datos clave.

### NFR3 — SEO / descubribilidad
- HTML real por ruta con meta-tags propios (título, descripción, OG/Twitter cards).
- Sitemap de rutas canónicas (elección×departamento); URLs limpias y estables.

### NFR4 — Integridad y trazabilidad de datos
- Voto canónico de la etapa definitiva (FR12); **reconciliación de votos válidos contra oficiales como gate de build** (M8).
- Gate de cobertura de zonas (FR31): el build falla si la cobertura cae bajo el umbral.
- Normalización a UTF-8 en ingesta (FR27).

### NFR5 — Hosting / operación
- Sin backend de aplicación ni base de datos: artefactos estáticos servidos por CDN.
- Costo de hosting ~cero; cacheable y reproducible desde el ETL.

### NFR6 — Compatibilidad
- Navegadores modernos mobile + desktop; foco explícito en **Android de gama baja/media**.

### NFR7 — Mantenibilidad
- Agregar una nueva elección o departamento debe ser un proceso documentado y de baja fricción vía el ETL (no trabajo manual por archivo).

### NFR8 — Idioma / privacidad
- Español (Uruguay) únicamente; sin i18n por ahora.
- Datos públicos; analítica respetuosa de la privacidad, sin tracking invasivo.

## 9. Riesgos y preguntas abiertas

### Riesgos
| # | Riesgo | Sev | Impacto | Mitigación |
|---|--------|-----|---------|------------|
| R1 | Normalización de `HOJA` entre elecciones (nº de lista cambian) | 🟡 Media | Limita la comparación a nivel lista | Default de comparación = **partido/lema** (estable); HOJA-level solo donde haya equivalencia (FR18/FR32, Fase 2). Severidad bajada de Alta→Media tras decisión de Juan |
| R2 | Disponibilidad de datos a nivel circuito para elecciones históricas | 🟡 Media | Limita qué elecciones entran al histórico | Verificar catálogo Corte (OQ5); acotar a elecciones con granularidad comparable; degradar con elegancia (FR2) |
| R3 | Hueco competitivo no verificado | 🟡 Media | Podría debilitar el diferenciador | 4 sondeos de Mary (Corte, medios, académicos/cívicos, agregadores) antes de invertir fuerte (A6) |
| R4 | Tipos de elección no-homogéneos (balotaje sin HOJA, blanco/anulado) | 🟡 Media | Modelo mal hecho rompe balotaje/válidos | Unidad = **opción electoral** (FR7), no HOJA; blanco/anulado como categorías (FR9, M8). _Mitigado en esta versión._ |
| R5 | La OG-image no puede ser un screenshot del mapa interactivo | 🟡 Media | Afecta FR22/M7 | Generar la preview en build-time desde geometría vectorial; detalle técnico en addendum |
| R6 | Ambición de alcance para dev solo | 🟡 Media | Riesgo de scope/tiempo | **Mitigado:** MVP reducido a slice (§6) tras review de factibilidad |
| R7 | Mantener vivo el estado/mapa al navegar entre rutas | 🟡 Media | Jank al navegar | Patrón técnico a validar en Arquitectura (ver addendum) |
| R8 | Usabilidad del choropleth en mobile (densidad semántica) | 🟢 Baja | UX confusa | Una variable por pantalla (FR3), bottom sheet (F3), progressive disclosure (FR25) |

### Preguntas abiertas (triage en Finalize)
- **OQ1** ~~F8 export~~ → resuelto: Fase 2.
- **OQ2** Confirmar/corregir A1–A6 (ver Índice de Assumptions).
- **OQ3** Valor exacto de la columna `ESCRUTINIO` que representa "definitivo" (lo confirma Juan con el dataset).
- **OQ4** Número de volumen real por shard (destraba NFR1 y estrategia de carga).
- **OQ5** Verificación competitiva (R3): ¿confirmamos el hueco antes de profundizar?

## 10. Índice de Assumptions

| ID | Supuesto | Estado |
|----|----------|--------|
| A1 | El ciudadano entra mayormente por link compartido/social, no tipeando la URL | Abierto |
| A2 | Entrada en frío = overview nacional + selector de depto; sin geolocalización | Abierto |
| A3 | "Comparar" para el ciudadano = vista ligera a nivel partido/lema; la profunda es del analista | Abierto |
| A4 | "Buscar" = saltar a entidades conocidas (lista/candidato/depto), no semántico | Abierto |
| A5 | Exportar es requisito del analista (Fase 2) | Abierto |
| A6 | Existe un hueco competitivo (nadie mantiene explorador permanente granular) | A verificar (OQ5) |

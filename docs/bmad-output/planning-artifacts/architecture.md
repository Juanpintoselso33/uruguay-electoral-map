---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-30'
inputDocuments:
  - docs/bmad-output/planning-artifacts/prds/prd-uruguay-electoral-map-2026-05-30/prd.md
  - docs/bmad-output/planning-artifacts/prds/prd-uruguay-electoral-map-2026-05-30/addendum.md
  - docs/bmad-output/project-context.md
  - docs/bmad-output/planning-artifacts/ux-designs/ux-uruguay-electoral-map-2026-05-30/DESIGN.md
  - docs/bmad-output/planning-artifacts/ux-designs/ux-uruguay-electoral-map-2026-05-30/EXPERIENCE.md
workflowType: 'architecture'
project_name: 'Uruguay Electoral Map'
user_name: 'Juan'
date: '2026-05-30'
---

# Architecture Decision Document — Uruguay Electoral Map (Rebuild)

_Este documento se construye colaborativamente paso a paso. Las secciones se agregan a medida que trabajamos cada decisión arquitectónica._

## Project Context Analysis

### Requirements Overview
**Funcionales:** 32 FRs / 10 grupos (PRD). Núcleo: mapa choropleth interactivo, capa de datos histórica, compartir con preview social, pipeline ETL.

**No funcionales (drivers de arquitectura):**
- **Dato inmutable → static site + ETL offline, sin backend (NFR5). [propiedad dominante]**
- Performance mobile (NFR1): LCP<2.5s / INP<200ms / CLS<0.1; mapa on-demand; **no re-inicializar la instancia del mapa entre rutas**.
- SEO + preview social (NFR3, FR22) → SSG/pre-render de rutas finitas `{elección}/{depto}`; OG-image build-time desde geometría vectorial.
- Integridad (NFR4): voto canónico (escrutinio definitivo) + reconciliación de **válidos** + cobertura como **gates de BUILD (en ETL, no en build de front)**.
- Accesibilidad (NFR2): tabla de datos equivalente al mapa, color+texto.

### Scale & Complexity
- Complejidad: media. Dominio: **frontend web estático + pipeline ETL**. Sin auth/DB/tiempo-real.
- La complejidad vive en (a) la capa de datos/geometría y (b) el mapa persistente entre rutas.

### Decisiones de diseño que informan la arquitectura (del party mode)
- **Decisión load-bearing = granularidad del sharding, NO el framework** (Winston): es lo único difícil de revertir y ES la estrategia de performance. "El sharding es el sustantivo, el framework el adjetivo."
- **FR2 = control explícito de nivel** (Zona/Serie/Circuito), default Zona, zoom solo visual (Sally). Zona/depto **eager**; serie/circuito **lazy-load + cache de sesión**; circuito = Fase 2.
- **Mapa persistente:** lo único que debe sobrevivir fuera de la URL es **el viewport WebGL de MapLibre**; el resto (selección, level, comparación) vive en la URL. El sheet se cierra al navegar.
- **Modelo de datos (Mary):** átomo `(elección, depto, circuito, serie, zona, escrutinio, opcion_id, votos)`; `escrutinio` retenido, DEFINITIVO indexado; `opcion_id` polimórfico (HOJA o candidato/lema). Agregados partido/lema × zona precomputados en ETL.
- **Equivalencia cross-año = juicio editorial, no dato.** Fase 1 compara a nivel **partido/lema** con marca de discontinuidad. Un único mecanismo (entidad canónica versionada con procedencia) cubre HOJA + drift de partido. HOJA-level = Fase 2.
- **OG-image (Amelia):** Satori NO renderiza `<path>` SVG → ruta = d3-geo (geoPath) → SVG → **resvg** → PNG, con **relleno SÓLIDO por ganador** (NO el patrón de bandera; son problemas separados).
- **Fill-pattern bandera en MapLibre se enturbia a zoom de depto en móvil** → fallback doble-capa (sólido↔patrón por zoom).
- **Reuso Vue en islas:** Pinia global NO es singleton cross-isla → usar **nanostores**; arrancar `vue-router`; la **tabla accesible = HTML estático, no isla**.

### Measurement Findings (medido sobre datos reales en `public/`, 4 deptos)
- **Los datos de votos son un no-problema:** el shard pre-agregado pesa **6–59 KB gzip** (Montevideo, el mayor, 59 KB). Budget de 500 KB cumplido con holgura.
- **LA GEOMETRÍA es el cuello de botella de payload:** `_series_map.json` pesa 188 KB (Mvd) a **1.045 KB (TyT, 1 MB gz / 5.2 MB crudo → viola la regla de 3 MB)**. El boundary del depto (`_map.json`) está OK (38–100 KB gz).
- **Implicación:** votos **eager**; geometría = **TopoJSON + simplificación (mapshaper) + lazy-load por nivel + PMTiles para el caso pesado**. El budget se cumple optimizando geometría, no shippeando los `_series_map.json` actuales.
- **Existe `nacionales-2019` además de `internas-2024`** → el slice MVP (1 depto × 2 elecciones) es real hoy: **Montevideo × {internas-2024, nacionales-2019}**.
- Esquema CSV confirmado canónico (9 columnas).

### Cross-Cutting Concerns
1. Integridad de datos (gates de build en ETL)
2. **Geometría: optimización + lazy-load** (el verdadero driver de NFR1, no los votos)
3. Accesibilidad (color+texto, tabla de datos del mapa)
4. SEO / preview social (HTML por ruta + OG build-time vectorial)
5. **Mapa+selector persistente entre rutas [R7 — único riesgo abierto, en validación por spike]**
6. FR2 navegación entre niveles → resuelto: control explícito + lazy-load

### Open items para la decisión de stack (step 04)
- **R7 / `transition:persist`** — en validación por spike técnico.
- **OG-image pipeline** (d3-geo+resvg) — en validación por spike técnico.
- V2 ampliado: inventariar qué otras elecciones históricas bajan a circuito (más allá de internas-2024 / nacionales-2019).

## Starter Template Evaluation

### Primary Technology Domain
Web estático + pipeline ETL. No es un boilerplate pesado: **Astro minimal + integración Vue**, para reutilizar componentes Vue existentes.

### Selected Starter: Astro (static output) + @astrojs/vue
**Rationale:** validado por 2 spikes (R7 `transition:persist` + OG-image). SSG de rutas finitas + islas con hidratación parcial = mejor encaje para dato inmutable + mobile-first + SEO/preview, reusando Vue.

### Versiones (verificadas vía `npm install` real en los spikes)
- astro 5.18.2 · @astrojs/vue 5.1.4 · vue 3.5.35 · maplibre-gl 5.24.0
- + tailwindcss, pagefind, topojson-client, d3-geo, @resvg/resvg-js

### Comando de init (primera historia de implementación)
```bash
npm create astro@latest uruguay-electoral-map -- --template minimal --typescript strict
npx astro add vue
# + tailwind, maplibre-gl, pagefind, topojson-client, d3-geo, @resvg/resvg-js
```

### Decisiones que fija el starter
TypeScript strict · Vite (interno) · `src/pages` = rutas SSG · `src/components` = islas Vue · ESM.
- **Reusar:** `partyColors.ts`, componentes de presentación Vue.
- **Reescribir:** estado (Pinia global → **nanostores**), routing (vue-router → rutas Astro + URL params).
- **Regla validada (spike R7):** islas del mapa con **`client:load`**, NO `client:only`.

**Note:** La inicialización con este comando debe ser la primera historia de implementación.

## Core Architectural Decisions

### Decision Priority Analysis
- **Críticas (bloquean implementación):** contrato/sharding de datos, framework (Astro+islas Vue), modelo de geometría, gates de build.
- **Importantes (forman la arquitectura):** estado URL+nanostores, mapa persistente, OG-image pipeline, hosting.
- **Diferidas (post-MVP / Fase 2):** HOJA-level comparison + tabla de equivalencias, OG-image on-demand, circuitos de todo el país (PMTiles), comparación multi-variable.

### Data Architecture
- **Átomo canónico:** `(elección, depto, circuito, serie, zona, escrutinio, opcion_id, cnt_votos)`; `escrutinio` retenido, **DEFINITIVO** indexado; `opcion_id` polimórfico (HOJA o candidato/lema).
- **Sharding:** votos **eager** (shard pre-agregado por elección×depto, ~6-59 KB gz). Geometría **desacoplada y lazy por nivel**: boundary del depto eager; serie/circuito lazy-load + cache de sesión.
- **Geometría:** TopoJSON (−40/−80%) + mapshaper `simplify keep-shapes`; **PMTiles** para el caso pesado (TyT series ~1 MB). Ningún artefacto de geometría eager supera el budget de 500 KB.
- **Agregados precomputados en ETL:** ganador por zona, % partido/lema, roll-ups, denominadores. Cliente solo recalcula sobre la selección.
- **Equivalencia cross-año:** mecanismo único `(elección, opcion) → entidad_canónica` versionado con procedencia. Vacío/identidad en Fase 1; comparación default **partido/lema** con marca de discontinuidad.
- **Gates de BUILD (en ETL):** reconciliación de válidos + cobertura de zonas (mapping table explícita por depto). Falla → no emite shard.

### Frontend Architecture
- **Astro SSG** (rutas `{elección}/{depto}`) + **islas Vue `client:load`** (validado spike R7).
- **Estado:** la **URL es la fuente de verdad**. Cross-island = **nanostores** (no Pinia global). Solo el **viewport WebGL de MapLibre** persiste fuera de la URL (`transition:persist`; fallback `<div transition:persist>` + init guardado).
- **Mapa:** MapLibre; FA = doble-capa (sólido↔patrón bandera Otorgués por zoom); sigla como texto siempre. **Tabla de datos accesible = componente Astro estático** (no isla).
- **Búsqueda:** índice estático (Pagefind o MiniSearch — confirmar por volumen del corpus).
- MapLibre debe tolerar SSR: acceso a `window` solo en `onMounted`/dynamic import.

### Infrastructure & Deployment
- **Hosting: Vercel** (decisión de Juan). Deploy de Astro vía adapter `@astrojs/vercel` (static); config con **`vercel.ts`** (reemplaza `vercel.json`). Deja abierta la puerta a functions para OG on-demand (Fase 2). **Limpiar `netlify.toml` + `vercel.json` residual** en implementación.
- **Pipeline ETL (Node, offline):** extract→normalize(UTF-8)→aggregate→[gates]→emit artefactos versionados por shard → genera índice de búsqueda + **OG-images build-time** (d3-geo+resvg, **font bundleada para build Linux**) → `astro build`.
- **CI:** corre gates del ETL + build. Sin secretos (dato público).

### Auth/Security & API
- **N/A:** sin auth, sin API de aplicación, sin DB. Dato público. Analítica respetuosa de privacidad. Seguridad = headers del CDN + sin secretos.

### Decision Impact Analysis — Secuencia de implementación
1. Init Astro+Vue+Tailwind+Vercel adapter → 2. ETL: contrato de datos + gates + shards → 3. Optimización de geometría (TopoJSON/simplify) → 4. Mapa persistente (isla `client:load`) → 5. Ficha/bottom-sheet + tabla accesible → 6. Selección/URL-state (nanostores) → 7. Búsqueda → 8. Compartir + OG-images → 9. Comparación dual → 10. Dark mode.

**Cross-component dependencies:** el contrato de datos (2) bloquea casi todo; la geometría (3) bloquea el mapa (4); URL-state (6) atraviesa mapa, ficha, comparación y compartir.

## Implementation Patterns & Consistency Rules

### Naming
- **Rutas Astro** (`src/pages/`): kebab-case; `[election]/[department].astro`; slugs lowercase sin tildes (`internas-2024`, `treinta-y-tres`).
- **Componentes Vue:** PascalCase (`ElectoralMap.vue`). **Componentes Astro:** PascalCase (`DataTable.astro`).
- **TS:** `camelCase` (vars/funciones), `PascalCase` (tipos), `SCREAMING_SNAKE` (consts); archivos `.ts` kebab-case.
- **Artefactos de datos:** `public/data/{election}/{department}/votes.json` · `geo.topo.json` · `series.topo.json`. Claves JSON camelCase.
- **nanostores:** prefijo `$` (`$selection`, `$level`, `$comparison`).

### Estado — contrato de URL (fuente de verdad)
```
/{election}/{department}?zona=&opcion=&level=zona|serie|circuito&vs={election}
```
- El estado deriva de la URL; los nanostores **espejan** la URL. Escritura = actualizar URL (push/replaceState) → store reacciona. Sin estado de sesión paralelo.

### Islas (validado por spike R7)
- Mapa: **`client:load` + `transition:persist`** (NUNCA `client:only`); `window`/MapLibre solo en `onMounted`.
- Selector/búsqueda: `client:idle`/`client:visible`. **Tabla accesible: Astro estático sin JS.**
- Cross-isla: **solo nanostores** (Pinia global prohibido).

### Formatos / proceso
- Estados: `idle|loading|ready|empty|error`. Loading del mapa = skeleton.
- Error de dato: degradar con rótulo visible (FR2), nunca zona en blanco silenciosa.
- Voto: etapa DEFINITIVA; blanco/anulado/observado separados, nunca sumados al ganador.
- **A11y (no-negociable):** sigla de partido como texto en cada zona; nunca solo color.
- Fechas/números: formato es-UY.

### ETL
- Pasos puros y testeables; gates con `exit≠0`; artefactos versionados con hash en `manifest.json`; mapping table explícita por depto (sin fuzzy-match en runtime).

### Enforcement — todos los agentes DEBEN
Leer estado de la URL (sin stores paralelos) · `client:load` para el mapa · sigla-como-texto siempre · voto = etapa definitiva · nunca `vue-router` ni Pinia global.

## Project Structure & Boundaries

```
uruguay-electoral-map/
├── astro.config.mjs            # vue() + adapter @astrojs/vercel + ClientRouter
├── vercel.ts                   # config de deploy (reemplaza vercel.json)
├── tailwind.config.ts          # tokens del DESIGN.md (editorial, dark mode)
├── tsconfig.json               # strict
├── package.json
├── src/
│   ├── pages/
│   │   ├── index.astro                      # overview nacional + selector (FR26)
│   │   └── [election]/[department].astro    # vista héroe SSG (FR1, FR22 meta+OG)
│   ├── layouts/Base.astro                   # <ClientRouter/>, masthead, <div#map transition:persist>
│   ├── components/
│   │   ├── map/ElectoralMap.vue             # isla client:load (MapLibre, FR1-4)
│   │   ├── map/MapLegend.vue
│   │   ├── sheet/ZoneSheet.vue              # bottom sheet (FR9-11)
│   │   ├── selectors/{Election,Department,Option,Level}Selector.vue  # FR5-8, FR2
│   │   ├── compare/CompareDual.vue          # FR16-17
│   │   ├── search/SearchBox.vue             # FR19
│   │   ├── share/ShareButton.vue            # FR20-21
│   │   ├── a11y/DataTable.astro             # tabla accesible ESTÁTICA (no isla, NFR2)
│   │   └── ui/                              # chips, swatches (reuso de presentación)
│   ├── stores/                              # nanostores: $selection, $level, $comparison
│   ├── lib/
│   │   ├── url-state.ts                     # parse/serialize del contrato de URL
│   │   ├── party-colors.ts                  # reuso de partyColors.ts
│   │   ├── map-style.ts                     # capas MapLibre + doble-capa bandera FA
│   │   └── data-loader.ts                   # fetch shards (eager) + geometría (lazy)
│   └── styles/global.css
├── public/
│   ├── data/{election}/{department}/        # votes.json · geo.topo.json · series.topo.json · manifest.json
│   └── og/{election}/{department}.png       # generadas en build
├── etl/
│   ├── index.ts                             # CLI: extract/transform/load/gates
│   ├── extract/  transform/  load/
│   ├── gates/ (reconcile-valid-votes.ts, zone-coverage.ts)
│   ├── geometry/ (topojson + mapshaper simplify)
│   ├── og/ (generate-og.ts — d3-geo+resvg, font bundleada)
│   ├── search-index/ (pagefind o minisearch)
│   └── mappings/{department}.json           # mapping zona↔geojson explícito
├── scripts/                                 # utilidades one-off
└── tests/
    ├── etl/ (gates, transform — unit)
    └── e2e/ (playwright: navegación, mapa persistente, a11y)
```

### Boundaries
- **Datos:** el ETL produce artefactos en `public/data/` (contrato versionado por `manifest.json`); el front **solo lee**, nunca calcula sobre crudos.
- **Estado:** URL (`lib/url-state.ts`) ⇆ nanostores ⇆ islas. Las islas se comunican por store, no directo.
- **Mapa:** `<div#map transition:persist>` en `Base.astro` = singleton; `ElectoralMap.vue` lo opera.
- **Sin backend / API:** cliente hace fetch estático de shards.

### Requirements → ubicación
- F1-4 mapa → `components/map/` + `lib/map-style.ts`
- F5-8 selección → `components/selectors/` + `lib/url-state.ts`
- F3 ficha → `components/sheet/` · F16-17 comparación → `components/compare/` · F19 búsqueda → `components/search/`
- F7 compartir → `components/share/` + OG en `etl/og/`
- F10 ETL → `etl/` · NFR2 tabla accesible → `components/a11y/DataTable.astro`

## Architecture Validation Results

### Coherence Validation ✅
Astro static + islas Vue (`client:load`) + nanostores + URL-state + MapLibre persistente + ETL gates + Vercel encajan sin contradicciones. **Validado empíricamente por 2 spikes** (R7 + OG-image). Versiones compatibles (instaladas juntas en los spikes).

### Requirements Coverage Validation ✅
- **FRs:** F1-4→`map/`, F5-8→`selectors/`+`url-state`, F9-11→`sheet/`, F16-17→`compare/`, F19→`search/`, F20-22→`share/`+`etl/og`, F10→`etl/`, NFR2→`a11y/DataTable.astro`.
- **NFRs:** NFR1 (geometría lazy+TopoJSON, mapa sin re-init) · NFR3 (SSG+meta+OG) · NFR4 (gates ETL) · NFR5 (sin backend) · NFR2 (tabla+sigla) — todos cubiertos.

### Gap Analysis
- **Menores (no bloquean):** Pagefind vs MiniSearch (decidir por volumen del corpus en la 1ª historia de búsqueda); valor exacto de `ESCRUTINIO`=definitivo (OQ3, confirmar con el dataset).
- **Deuda de datos:** `treinta_y_tres_series_map.json` (5.2 MB) viola la regla de 3 MB → la resuelve la historia de optimización de geometría.
- **Diferido (Fase 2, no gaps):** HOJA-level comparison, circuitos PMTiles, OG on-demand.

### Architecture Completeness Checklist
**Requirements Analysis** [x] contexto · [x] escala · [x] constraints · [x] cross-cutting
**Architectural Decisions** [x] críticas+versiones · [x] stack · [x] integración · [x] performance
**Implementation Patterns** [x] naming · [x] structure · [x] communication · [x] process
**Project Structure** [x] directorios · [x] boundaries · [x] integración · [x] mapping FR
→ **16/16**

### Architecture Readiness Assessment
**Overall Status: READY FOR IMPLEMENTATION** · **Confidence: ALTA** (respaldada por spikes + medición de datos reales).
**Fortalezas:** stack validado empíricamente, geometría de-riesgada con números, R7 resuelto, dominio bien modelado.
**Mejoras futuras:** confirmar lib de búsqueda, inventario de elecciones históricas a nivel circuito.

### Implementation Handoff
- Los agentes siguen las decisiones de este documento como fuente de verdad técnica.
- **Primera prioridad de implementación:** init Astro + Vue + Tailwind + adapter Vercel (historia #1 de la secuencia de §Core Architectural Decisions).

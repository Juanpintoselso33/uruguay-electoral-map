---
baseline_commit: 459a6683db03d98aca8551c8926d68b98643413a
---

# Story 1.1: Inicializar el proyecto Astro + Vue + Vercel

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a desarrollador,
I want un proyecto Astro estático con Vue, Tailwind, TypeScript strict y deploy en Vercel,
so that haya una base limpia y desplegable desde el día uno sobre la que construir el resto del rebuild.

## Acceptance Criteria

1. **Given** un repo limpio **When** corro el init (Astro minimal + `@astrojs/vue` + Tailwind + `@astrojs/vercel`) **Then** `npm run build` produce salida estática sin errores.
2. **Given** el proyecto inicializado **When** reviso la config de deploy **Then** existe `vercel.ts` (no `vercel.json`) y se eliminaron `netlify.toml` y el `vercel.json` residual del repo.
3. **Given** el proyecto **When** corro un deploy de prueba en Vercel **Then** sirve una página de "hola mundo" / placeholder en una URL de preview.
4. **Given** TypeScript **When** corro el typecheck **Then** está en modo `strict` y pasa sin errores.
5. **Given** una isla Vue de prueba **When** se hidrata en una página **Then** monta correctamente con `@astrojs/vue` (valida que el reuso de Vue funciona).

## Tasks / Subtasks

- [x] **Task 1: Scaffolding Astro + integraciones (AC: 1, 4, 5)**
  - [x] Crear proyecto Astro minimal con TS strict (scaffold manual — `npm create astro` no corre en dir no-vacío; tsconfig extiende `astro/tsconfigs/strict`).
  - [x] Agregar integración Vue (`@astrojs/vue` en astro.config).
  - [x] Agregar Tailwind 4 vía `@tailwindcss/vite` + `@import "tailwindcss"` en global.css.
  - [x] Instalar deps del stack: `maplibre-gl`, `nanostores` + `@nanostores/vue`, `topojson-client`, `d3-geo`. _(DESVIACIÓN justificada: `@resvg/resvg-js` y `pagefind` diferidos a sus historias — Epic 3 — para no cargar binarios nativos en la historia fundacional; ya validados en `spikes/`.)_
  - [x] Crear isla Vue trivial (`HelloIsland.vue`) con `client:load` en `index.astro` (AC5).
- [~] **Task 2: Config de deploy Vercel (AC: 2, 3)**
  - [x] Configurar `@astrojs/vercel` (output static) en `astro.config.mjs`.
  - [x] Crear `vercel.ts` (config tipada). NO `vercel.json`.
  - [x] **Eliminar `netlify.toml` y `vercel.json`** del root (movidos a `legacy/`, AR2).
  - [ ] Deploy de prueba a Vercel (preview). **BLOQUEADO (acción de Juan):** requiere `vercel login` (auth interactiva) + Vercel CLI. El output ya está listo: el build generó `.vercel/output/static`. Ejecutar `vercel deploy` manualmente.
- [x] **Task 3: Estructura base de carpetas (AC: 1)**
  - [x] Estructura `src/` (pages, layouts, components/{map,sheet,selectors,compare,search,share,a11y,ui}, stores, lib, styles).
  - [x] `etl/` con subcarpetas placeholder (extract/transform/load/gates/geometry/og/search-index/mappings).
  - [x] Portar `partyColors.ts` → `src/lib/party-colors.ts` (reuso, AR11).
- [x] **Task 4: Higiene del proyecto (AC: 1, 4)**
  - [x] postcss: Tailwind 4 vía plugin Vite (sin postcss.config heredado roto — gotcha del spike evitado).
  - [x] `npm run build` verde + `astro check` strict (0 errores).
  - [ ] Commit inicial. **Pendiente (acción de Juan):** no commiteo sin tu OK explícito.

## Dev Notes

### Stack y versiones (VERIFICADAS por los spikes — usar estas)
- **astro 5.18.2** · **@astrojs/vue 5.1.4** · **vue 3.5.35** · **maplibre-gl 5.24.0** (instaladas y validadas en `spikes/persist-map/`).
- Tailwind: el proyecto viejo usaba **Tailwind 3.4**; confirmar si se adopta Tailwind 4 (`@tailwindcss/vite`) o se mantiene 3.x. Los tokens del DESIGN.md se cargan acá (decisión menor, no bloqueante).
- `nanostores` + `@nanostores/vue` para estado cross-isla (NO Pinia global — ver "Qué NO hacer").
- `topojson-client`, `d3-geo`, `@resvg/resvg-js`, `pagefind`: se instalan ahora; su uso real es en Epics 1.5/3.

### Comando de init (architecture.md §Starter)
```bash
npm create astro@latest uruguay-electoral-map -- --template minimal --typescript strict
npx astro add vue
npx astro add vercel
# luego instalar el resto de deps del stack
```
> El proyecto se inicializa SOBRE el repo actual (rebuild in-place). El dev decide si scaffoldear en un subdir temporal y mover, o init en root cuidando no pisar `docs/`, `spikes/`, `public/data/`.

### Config Vercel (knowledge update 2026)
- **`vercel.ts` reemplaza `vercel.json`** (recomendado). Usar `@vercel/config` o el adapter `@astrojs/vercel` con `output: 'static'` en `astro.config.mjs`.
- **AR2 (limpieza):** borrar `netlify.toml` y `vercel.json` del root. El deploy ahora es Vercel.

### Estructura objetivo (architecture.md §Project Structure & Boundaries)
`src/pages` (rutas SSG) · `src/layouts/Base.astro` (tendrá `<ClientRouter/>` + `<div#map transition:persist>` en Epic 1.8, acá solo el shell) · `src/components/{map,sheet,selectors,compare,search,share,a11y,ui}` · `src/stores` (nanostores) · `src/lib` (url-state, party-colors, map-style, data-loader) · `etl/...` · `public/data/{election}/{department}/`.

### 🚧 GOTCHAS REALES (del spike `spikes/persist-map/` — NO repetir estos errores)
1. **postcss heredado:** Vite camina hacia arriba y puede cargar un `postcss.config.js` de un parent. El spike falló el build por esto y se arregló con un `postcss.config.cjs` propio. Asegurar que el postcss del proyecto esté bien definido en el root del nuevo proyecto.
2. **`client:load`, NO `client:only`:** la regla validada (spike R7) es que las islas con mapa persistente usan `client:load`. La isla de prueba de esta historia debe usar `client:load` para fijar el patrón correcto desde el inicio.
3. **MapLibre y SSR:** todo acceso a `window`/`document` va dentro de `onMounted` o import dinámico (si no, el build SSG rompe). No aplica aún a la isla trivial, pero dejar el patrón claro.

### Qué NO hacer (anti-patrones — project-context.md + architecture.md)
- ❌ NO usar Pinia como store global cross-isla → usar **nanostores**.
- ❌ NO usar `vue-router` → el routing es de Astro + URL params (estado en URL llega en Story 1.7).
- ❌ NO replicar la deuda del proyecto viejo (doble app shell, archivos `.backup`, `tsonfig.json` mal nombrado).
- ❌ NO traer el código viejo en bloque — solo reusar `partyColors.ts` (presentación) en esta historia.

### Testing
- Verificación de esta historia = `npm run build` verde + typecheck strict + deploy preview sirviendo + isla Vue hidratando. No hay tests unitarios todavía (la suite e2e Playwright se arma en historias posteriores). El gate de perf/a11y en CI llega en Story 1.10.

### Project Structure Notes
- Es greenfield in-place: el proyecto nuevo convive con `docs/bmad-output/` (planning, NO tocar) y `spikes/` (referencia, NO tocar). El `public/` viejo tiene datos que el ETL (Epic 1.4+) consumirá; no borrarlo, pero el nuevo `public/data/` se irá poblando.

### References
- [Source: docs/bmad-output/planning-artifacts/epics.md#Story 1.1] — historia y ACs.
- [Source: docs/bmad-output/planning-artifacts/architecture.md#Starter Template Evaluation] — comando init, versiones, decisiones del starter.
- [Source: docs/bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] — árbol de carpetas.
- [Source: docs/bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — Vercel, vercel.ts, nanostores, AR2.
- [Source: docs/bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — naming, islas client:load, enforcement.
- [Source: spikes/persist-map/] — versiones reales + gotcha postcss + client:load.
- [Source: docs/bmad-output/project-context.md] — anti-patrones, deuda a no replicar.

## Dev Agent Record

### Agent Model Used

Amelia (dev) — claude-opus-4-8[1m]

### Debug Log References

- `npm install`: 516 paquetes OK (1m). 5 vulnerabilidades de auditoría (no bloqueantes; revisar en hardening).
- `astro check`: 220 errores iniciales venían del `tests/` viejo (Playwright sin instalar) → archivado a `legacy/`. Tras excluir `legacy/`, `data/`, `claude-code-universal-guide/`: **0 errores, 0 warnings**.
- `astro build`: verde, 1 página, adapter `@astrojs/vercel` copió a `.vercel/output/static`. Isla `HelloIsland` emitida (`dist/_astro/HelloIsland.*.js`) y referenciada en `index.html`.

### Completion Notes List

- ✅ AC1 (build verde) · AC2 (`vercel.ts` presente; `netlify.toml`+`vercel.json` fuera del root) · AC4 (typecheck strict 0 errores) · AC5 (isla Vue `client:load` hidrata — bundle emitido y referenciado).
- ⚠️ **AC3 (deploy preview): NO ejecutado por mí** — requiere `vercel login` (auth interactiva) + Vercel CLI no instalado. Output deploy-ready en `.vercel/output/static`. Acción pendiente de Juan: `npm i -g vercel && vercel deploy`.
- **Decisión de mecánica:** código viejo Vue/Vite archivado en `legacy/` (no destruido; recuperable). `public/` y `data/` conservados como fuentes para el ETL.
- **Desviación:** `@resvg/resvg-js` y `pagefind` NO instalados aún (son de Epic 3); se agregan en sus historias. Resto del stack instalado para fijar versiones.
- Patrón validado fijado desde el inicio: isla con `client:load` (NO `client:only`), gotcha de postcss evitado (Tailwind 4 vía plugin Vite).
- **Commit pendiente:** no commiteo sin OK de Juan.

### Change Log

- 2026-05-30: Story 1.1 implementada. Rebuild Astro in-place; app viejo → `legacy/`. Stack: Astro 5.18.2 + @astrojs/vue 5.1.4 + Vue 3.5.35 + Tailwind 4 + @astrojs/vercel + nanostores + maplibre-gl + d3-geo + topojson-client. Build + typecheck strict verdes.

### File List

**Nuevos:**
- `package.json` (reescrito para el rebuild Astro)
- `astro.config.mjs`
- `tsconfig.json`
- `vercel.ts`
- `.gitignore`
- `src/styles/global.css`
- `src/layouts/Base.astro`
- `src/pages/index.astro`
- `src/components/ui/HelloIsland.vue`
- `src/lib/party-colors.ts` (portado de `legacy/src/utils/partyColors.ts`)
- `etl/{extract,transform,load,gates,geometry,og,search-index,mappings}/README.md` (placeholders)
- carpetas vacías: `src/components/{map,sheet,selectors,compare,search,share,a11y}`, `src/stores`, `public/data`

**Movidos a `legacy/`:** todo el app Vue/Vite viejo (`src/`, `vite.config.js`, configs, `index.html`, docs `.md` deprecados, `netlify.toml`, `vercel.json`, `etl/`, `scripts/`, `tests/`, logs).

**Generados (gitignored):** `dist/`, `.vercel/`, `node_modules/`, `.astro/`.

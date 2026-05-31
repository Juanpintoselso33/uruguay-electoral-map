---
baseline_commit: c35f404386d10e5306aca3eab5a99cc5bf7c38fd
---

# Story 10.7: Variante nacionales — HOJA legislativa

Status: done

## Story

As a usuario,
I want ver el voto por lista en las elecciones nacionales,
so that explore las listas al parlamento por zona.

## Acceptance Criteria

1. **Given** los datos de nacionales (2019 disponible; 2024 cuando Epic 7.4 lo ingiera) **When** corro el ETL de granularidad con la escalera de nacionales **Then** emite catálogo lema → (sublema cuando exista dato) → lista + shards de hojas por lema.
2. **Given** que el dato de sublema y el split nacional(Senado)/departamental(Diputados) NO existe aún (Story 10.8) **When** construyo la escalera **Then** degrada a **lema → lista** y lo **rotula** explícitamente (no inventa el nivel sublema ni la marca nacional/deptal).
3. **Given** el acordeón y los modos de mapa **When** abro nacionales **Then** funcionan con las hojas legislativas.
4. **Given** los gates **When** corro **Then** reconciliación contra el agregado por lema de nacionales existente pasa.

## Tasks / Subtasks

- [x] **T1** — Aggregator de hoja para nacionales (AC: 1, 4)
  - [x] T1.1 — `aggregate-hoja-nacionales.ts` lee `nacionales-2019/montevideo_odd.csv` (TipoRegistro HOJA_EN/VOTO_LEMA, Descripcion1=hoja)
  - [x] T1.2 — Agrega por `(lema, hoja, barrio)`; VOTO_LEMA → pseudo-hoja `vl` → UI "Voto al lema" (no se pierde)
  - [x] T1.3 — Reusa el join CRV→barrio (`montevideo-circuito-barrio.json`) y el strip de prefijo "Partido " (igual que `aggregateNacionalesMvd`)
- [x] **T2** — Escalera con degradación (AC: 2)
  - [x] T2.1 — El catálogo de la contienda emite `niveles: ['lema','hoja']` + `degradado: true` (la escalera declarada `['lema','sublema','hoja']` se degrada por falta de dato de sublema)
  - [x] T2.2 — La UI rotula "Sin desglose por sublema — dato no disponible; se muestra lema → lista" (verificado en browser)
- [x] **T3** — Gates + UI (AC: 3, 4)
  - [x] T3.1 — Reconciliación EXACTA vs `votes.json`: 668 pares (barrio×lema), total 853.439 = lema
  - [x] T3.2 — Acordeón verificado: contienda única (0 tabs), lema→hoja directo (sin precandidato), "Voto al lema" al final; seleccionar FA colorea el mapa (61 zonas)

## Dev Notes

- **Dato disponible**: nacionales-2019 MO tiene hoja en `Descripcion1`. Construible YA a nivel lema→hoja.
- **Dato faltante**: sublema y split Senado/Diputados → Story 10.8. Esta story NO los espera: degrada y rotula (AC2). El advisor fue explícito: no escribir ETL ejecutable sobre datos que no existen — acá la parte ejecutable es lema→hoja, el resto es degradación declarada.
- VOTO_LEMA (voto al lema sin marcar lista) es un nodo legítimo: modelar como "voto al lema directo" dentro del lema, no perderlo.
- Nacionales 2024: depende de Epic 7.4 (ingesta). Cuando exista, esta story se corre igual.

### Referencias
- `etl/transform/aggregate-nacionales-mvd.ts`, `etl/run-nacionales-2019-montevideo.ts`
- Story 10.1 (escalera + degradación), Story 10.8 (sourcing sublema)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story)

### Completion Notes List

- **`aggregate-hoja-nacionales.ts` (nuevo):** geoId = barrio (CRV→barrio, mismo mapping que internas/nacionales lema). HOJA_EN → hoja (Descripcion1); VOTO_LEMA → pseudo-hoja `vl` ("Voto al lema"). Strip de prefijo "Partido " antes del slug (igual que `aggregateNacionalesMvd`). Contienda única, escalera **degradada** `['lema','hoja']` + `degradado: true` (sin sublema, Story 10.8).
- **`run-nacionales-hoja-mvd.ts` (nuevo):** catálogo + shards por lema + reconciliación EXACTA contra `votes.json`. Resultado: 94 hojas / 11 lemas / 9 "voto al lema" · **668 pares (barrio×lema) exactos, total 853.439 = lema** · 11 shards.
- **UI:** acordeón habilitado para `nacionales-2019/montevideo`; el helper `etiquetaLista` muestra "Voto al lema" para la pseudo-hoja `vl`; rótulo de degradación cuando `contienda.degradado` ("Sin desglose por sublema…").
- **Verificado en browser:** contienda única (0 tabs), FA → 39 hojas + "Voto al lema", seleccionar FA commitea todas (incl. `...frente-amplio-vl`) y el mapa colorea (61 zonas con %), rótulo de degradación visible.
- `tsc --noEmit` exit 0; `astro check` 0/0/0.
- **Alcance:** nacionales-2019 **Montevideo** (instancia reconciliable). Interior nacionales y nacionales-2024 requieren su ingesta lema previa (Epic 7.4 / Story 4.1-interior); el aggregator ya es reusable cuando exista.

### File List

- `etl/transform/aggregate-hoja-nacionales.ts` (new)
- `etl/run-nacionales-hoja-mvd.ts` (new)
- `package.json` (modified) — script `etl:nacionales-hoja-mvd`
- `src/pages/[eleccion]/[departamento].astro` (modified) — acordeón para nacionales-2019/montevideo
- `src/components/selectors/OpcionAccordion.vue` (modified) — `etiquetaLista` ("Voto al lema") + rótulo de degradación
- `src/components/map/ChoroplethMap.vue` (modified) — label "Voto al lema" en el desglose
- `public/data/nacionales-2019/montevideo/catalogo.json` + `hoja/unica/{lema}.json` (new, generados)

### Change Log

- 2026-05-31 — Nacionales-2019 MO a nivel HOJA: contienda única, escalera degradada (sin sublema) + rótulo, "Voto al lema", reconciliación exacta. Verificado en browser. Status → done.

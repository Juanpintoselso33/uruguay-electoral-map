# Diseño — Epic: Ficha de detalle por circuito/local

Fecha: 2026-06-02 · Estado: aprobado en brainstorming

## Problema
Al seleccionar una ZONA (barrio/serie) se abre la ficha (`ZoneSheet`) con su desglose. Para CIRCUITO no: el clic en un punto del overlay hace `commit({zona: número})` y `selectByName` lo busca en el FC de zonas/series (no en el dato del circuito/local) → no abre ficha. El overlay (Epic 17) muestra **LOCALES** (lugar de votación; agrupa varios circuitos), con fallback a circuito crudo donde no hay `votes-local.json`.

## Objetivo (aprobado)
Clic en un punto-local → ficha con: **metadata del local** (nombre, dirección, habilitados, N° circuitos) + **total** (ganador/%/votos, válidos, blanco/anulados/observados — igual que zona) + **desglose de la selección** (igual que zona) + **sección nueva "Circuitos que votan acá"** (cada circuito: número + ganador + votos).

## Datos (disponibles, sin sourcing nuevo)
- `votes-local.json` (Epic 17): por local geoId, validos, porOpcion, ganador, noPartidarios.
- `votes-circuito.json`: por circuito (geoId número), validos, porOpcion, ganador.
- catálogo `data/processed/locales/{dept}.json`: por local `nombre, direccion, habilitados, localidad, circuitos:[n…], series, ranges, lat/lon`.

## Diseño

### A. ETL — enriquecer `votes-local.json` (`build-votes-local.py`)
Por cada local, agregar al objeto: `nombre`, `direccion`, `habilitados` (del catálogo) y `circuitos: [{n, ganadorOpcionId, validos}]` — el mini-resultado de cada circuito constituyente. `build-votes-local` YA agrega circuito→local (tiene `circ_votes` + `circ2local`), así que emite el desglose sin trabajo extra de datos. Self-contained: la ficha sale de `votes-local` + `opciones.json` (nombres/colores), sin joins en runtime.

### B. Interacción — `ChoroplethMap`
El overlay de local/circuito (`loadCircuitoOverlay`) ya carga `votes-local`/`votes-circuito` en `circuitoFCForCanvas`. Al clic en `circuitos-circle`: en vez de `commit({zona})` + `selectByName` sobre el FC base, construir un `SelInfo` desde el feature del overlay (que trae el dato del local) y abrir la ficha. La `zona` en URL sigue para deep-link; `selectByName` se ajusta para resolver, cuando el overlay está activo, contra `circuitoFCForCanvas` (local/circuito) en vez del FC base.

### C. Ficha — `ZoneSheet` extendido (secciones opcionales)
Mismo bottom-sheet, con campos opcionales en `SelInfo`:
- `local?: { nombre, direccion, habilitados, nCircuitos }` → header del local.
- `circuitos?: [{ n, sigla, nombre, color, votos }]` → sección "Circuitos que votan acá".
El total + desglose de selección reusan el render actual. Si no hay `local`/`circuitos` (zona normal, o circuito crudo sin desglose) → la ficha se ve igual que hoy.

## Componentes y límites
- `build-votes-local.py` — emite el enriquecimiento (metadata + circuitos por local). Entra: circ_votes, circ2local, catálogo. Sale: votes-local.json enriquecido.
- `ChoroplethMap::loadCircuitoOverlay` + el click handler + `selectByName` — resuelven la selección contra el overlay activo.
- `ZoneSheet` + `SelInfo` (contrato) — secciones opcionales de local y circuitos.

## Casos borde
- Elección sin `votes-local.json` (overlay cae a circuito crudo): el clic abre la ficha del circuito (total, sin metadata de local ni sub-desglose).
- Local con 1 circuito: la sección "Circuitos" puede omitirse (redundante con el total) o mostrarse igual (decisión menor de UI: omitir si nCircuitos≤1).
- MVD vs interior: el local funciona igual (geoId localId); el catálogo cubre los deptos con georef.
- `?zona=<localId>` deep-link con overlay activo → re-abre la ficha del local en `astro:after-swap`.

## Testing
- ETL: votes-local enriquecido tiene `nombre`/`circuitos` con suma de circuitos == total del local (gate de reconciliación).
- Browser: clic en un local (MVD internas-2024) → ficha con nombre del lugar + total + lista de circuitos con su ganador; selección activa → desglose; circuito crudo (elección sin local) → ficha del circuito.

## Fuera de alcance
- Cambiar el modelo de overlay (sigue local-preferido, fallback circuito — Epic 17).
- Geometría/polígonos de circuito (siguen siendo puntos).

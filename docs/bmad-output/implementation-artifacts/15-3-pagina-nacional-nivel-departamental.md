---
baseline_commit: 0c534da
---

# Story 15.3: Página nacional + nivel departamental

Status: done

## Story

As a usuario, I want abrir el mapa nacional y ver el ganador por departamento, so that tenga la foto país. **AC:** dado 15.2, al abrir la ruta nacional el mapa muestra los 19 deptos coloreados por ganador (con banderas), la leyenda y la ficha por depto; el coloreo (ganador/share/heatmap) y el selector de opción funcionan a nivel departamental.

## Implementación

- **Ruta:** `src/pages/[eleccion]/index.astro` → `/{eleccion}` (sin colisión con `[eleccion]/[departamento].astro`). `getStaticPaths` enumera las elecciones únicas con shard `_nacional` (14). Renderiza `ChoroplethMap` con `departamento="_nacional"` y `availableLevels={['departamento']}`.
- **Contrato:** `'departamento'` agregado a `NivelGeografico` (nivel más grueso, nacional). `resolveNivel` cae a `props.availableLevels` cuando el depto no está en `departments.json` (caso `_nacional`) → resuelve a `'departamento'`.
- **Reúso sin tocar la lógica del mapa:** el shard `_nacional` se comporta como una elección PLANA → `OpcionAccordion` degrada (catalogo.json 404 → `catalogoPlanoFallback` desde `_nacional/opciones.json`) a lista de partidos. El join geo↔votos es por `feature.properties.name == zona.geoId` (ambos = label del depto). Banderas, leyenda, ficha (`ZoneSheet`), coloreo (ganador/share/heatmap) y selección (ganador-entre-seleccionado) son el mismo código que per-depto.
- **Chrome nacional:** `EleccionSelector` con prop `nacional` (links a `/{id}` en vez de `/{id}/{depto}`); dept-nav con "Nacional" + entrada a cada depto; `DataTable` (caption "Uruguay" para `_nacional`); `Sello`.

## Fix descubierto (resize/fitBounds)

En la página nacional el contenedor del mapa podía tener **ancho 0 al construir el `Map`** (menos contenido sobre el mapa que la página per-depto) → el `fitBounds` inicial dejaba la geometría como un sliver en el borde. Fix en `ChoroplethMap` (al final del handler `load`): doble `requestAnimationFrame` → `m.resize()` + `m.fitBounds(bounds, {animate:false})`. Idempotente en las páginas que ya encajaban. Verificado: la nacional renderiza correcta en la **primera** carga, sin resize manual.

## Verificación (browser, build servido)

- Build: **281 páginas** (+14 nacionales), `gate:data` 280 shards OK, `astro check` 0 errores.
- `/balotaje-2024`: los 19 deptos pintados por ganador con patrón de bandera (FA / CR), leyenda CR·FA, auto-fit correcto. ✅
- Ficha (`?zona=Montevideo`): "FA Frente Amplio 58,4% · 493.761 votos", válidos 845.825, blanco/anulados/observados, depto resaltado. Coincide con el oficial (Orsi ~58% en MVD). ✅
- Selección (`?sel=frente-amplio`): "1 lista seleccionada", repinta los 19 deptos por la selección; toggle Ganador/Heatmap/Share visible. ✅

## Notas / pendientes
- Solo nivel departamental; el toggle de granularidad departamental↔zona es Story 15.4.
- 2 errores de consola benignos: `favicon.ico` (no servido por el static server local; Vercel sí) y `catalogo.json` 404 (fallback plano diseñado).

## Change Log
- 2026-06-01 — Página nacional `/{eleccion}` + nivel departamental. Fix resize/fitBounds. Verificado en browser (mapa, banderas, leyenda, ficha, selección). Status → done.

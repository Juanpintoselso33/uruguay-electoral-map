---
baseline_commit: c4b4c5a
---

# Stories 15.4 + 15.5: Toggle granularidad departamental↔zona + performance zona nacional

Status: done

## Story

15.4 — As a usuario, I want alternar entre ver el país por departamento o por zona, so that pase de la foto país al detalle fino. 15.5 — …que la vista nacional por zona cargue rápido (NFR1). (Resueltos juntos: la simplificación que cumple el budget es la misma que habilita el nivel.)

## Geometría de zona nacional (`scripts/build-nacional-zona-geo.py`)

- Combina el nivel-base de los 19 deptos (MVD=zona/barrios, interior=serie; nivel-base = `votes.json.nivel`, consistente por depto) en **un** topojson.
- **Namespacing:** los nombres de zona NO son únicos entre deptos (las series `jaa`,`iaa`… se repiten) → cada feature `name = "{nombreOriginal} · {DeptoLabel}"`. Verificado **0 nombres duplicados** en 658 zonas → join geometría↔votos (norm(name==geoId)) seguro. El mismo namespacing se aplica al geoId del votes-zona.
- **Pipeline:** por depto, mapshaper decodifica el topojson + `-each` namespacea; luego combina todo + `-simplify 18% keep-shapes` + un solo topojson. **8,72 MB crudo → 0,50 MB** (simplify + arcos compartidos del merge). Salida: `public/data/geo/_nacional/zona.topo.json`.

## Votos de zona nacional (`scripts/build-nacional-votes.py`)

- Por elección, combina los `zonas` de los 19 `votes.json` con geoId namespaceado → `{eleccion}/_nacional/votes-zona.json` (nivel `zona`). Reusa el `_nacional/opciones.json` ya existente.
- Placement: ~657/673 zonas matchean geometría; ~16 series sin polígono (gap upstream, igual que per-depto → quedan "sin datos"). Inocuo.

## Frontend

- **ChoroplethMap:** `votesFile` con caso `_nacional`+`zona` → `votes-zona.json` (la geometría `geo/_nacional/zona.topo.json` ya resuelve por el patrón de ruta). Prop nuevo `defaultNivel`: si la URL no trae `?level` explícito, usa ese nivel (vista nacional → `departamento`) en vez del genérico `zona`; se materializa al store/URL para que toggle+mapa+URL coincidan.
- **GranularitySelector.vue** (nuevo): toggle 2-vías Departamentos|Zonas, departamento default, estado en URL (`?level=`). En la página nacional entre el acordeón y el mapa.
- Página nacional: `availableLevels={['departamento','zona']}`, `defaultNivel="departamento"`.

## Performance (15.5 / NFR1)

- Zona nacional combinada = **0,50 MB** << budget NFR1 (3 MB). **No hizo falta PMTiles ni lazy-por-viewport.**
- **Lazy:** el default nacional es `departamento` (solo carga `departamento.topo.json`, 146 KB). La geometría de zona (0,50 MB) se fetch **solo** al togglear a Zonas (`reloadData` → `geo/_nacional/zona.topo.json`). Opt-in real.

## Verificación (browser, build servido)

- Build 281 páginas, `astro check` 0 errores, `gate:data` OK.
- `/nacionales-2024` (URL pelada): abre en **Departamentos** (toggle activo, mapa departamental, URL→`?level=departamento`). ✅
- Click "Zonas": mapa cambia a las 658 zonas/series del país coloreadas por ganador (FA/Colorado/Nacional), banderas. ✅
- `?level=zona` directo: idem. Toggle por click y por URL ambos andan; estado en URL.

## npm
`etl:nacional-zona-geo` (geometría zona); `etl:nacional-votes` ahora emite también `votes-zona.json`; `etl:nacional` corre todo.

## Change Log
- 2026-06-01 — 15.4 toggle dept↔zona (geometría+votos namespaceados, GranularitySelector, defaultNivel) + 15.5 perf (0,50MB lazy, NFR1 cumplido por simplificación). Browser ✅. Epic 15 COMPLETO. Status → done.

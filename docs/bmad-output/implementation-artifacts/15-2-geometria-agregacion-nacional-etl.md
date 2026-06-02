---
baseline_commit: 07d2578
---

# Story 15.2: Geometría + agregación nacional (ETL)

Status: done

## Story

As a usuario, I want el mapa del país por departamento, so that vea el resultado nacional de un vistazo. **AC:** dado el spike 15.1, construyo la geometría departamental nacional + el shard de votos agregado por departamento (por elección) → existe `votes.json` nivel `departamento` por elección y los gates pasan.

## Geometría departamental

- **Fuente:** IDE Uruguay "Límites Departamentales" (CKAN `ide-limites-departamentales`, recurso GeoJSON `departamentos.geojson`). El stub previo en `data/raw/geographic/uruguayDepartamentos.geojson` estaba **vacío (0 bytes)** → se bajó el oficial (14,3 MB, WGS84, 19 features).
- **Problema:** el dato oficial es **polyline** (bordes), no polígonos rellenables. Se poligoniza por-feature con shapely (`scripts/build-nacional-geo.py`): `linemerge` + **forzar cierre del anillo** (los bordes traen gaps minúsculos de ~1-20 m en los extremos; 4 deptos costeros/limítrofes — Rocha, Montevideo, Durazno, Cerro Largo — no cerraban con `polygonize` directo) + `buffer(0)` para reparar.
- **Validación:** 19/19 deptos poligonizados, 0 geometrías inválidas, área total 16,81 deg² (Uruguay ≈ 17). Cada feature lleva `{id, name}` (name = label del depto → join con `geoId` del votes nacional vía `norm()`).
- **Budget:** mapshaper `-simplify 3% keep-shapes -clean` → **`public/data/geo/_nacional/departamento.topo.json` = 146 KB** (objeto `departamento`, 19 geometries). Bajo el budget de 150 KB del spike, holgado vs NFR1.

## Agregación de votos (`scripts/build-nacional-votes.py`)

- Por elección (14, todas con **cobertura 19/19**), por depto: suma `porOpcion` de TODAS sus zonas por `opcionId` → `porOpcion` depto → `ganadorOpcionId = argmax`. Suma `validos` y `noPartidarios`.
- **Clave = `opcionId`** (verificado consistente entre deptos; los 10 "conflictos id→nombre" de internas-2024 son solo casing — `"FRENTE AMPLIO"` vs `"Frente Amplio"` — mismo id). `opciones.json` nacional = unión de ids, nombre canónico = la variante no-mayúsculas.
- **Salida** (rutas que consume `/{eleccion}` con `departamento='_nacional'`, `nivel='departamento'`):
  `public/data/{eleccion}/_nacional/votes.json` (19 'zonas' = deptos, `geoId` = label) + `opciones.json`. 14 elecciones × 2 + topojson ≈ 170 KB.

## Gates

1. **Estructural:** exactamente 19 deptos reales por elección (itera solo los ids de `departments.json`, NO el dir → evita que `_nacional` se auto-sume al re-correr). Este fue el bug que produjo "20 deptos / válidos doblados" en la primera corrida; el filtro lo elimina de raíz.
2. **Reconciliación (AC):** Σ(zonas.porOpcion) == depto.porOpcion, delta exacto 0 → la agregación no pierde ni duplica.
3. **Ancla independiente (tripwire):** Σ nacional por opción vs total oficial publicado. Declarada para Vivir sin Miedo (Sí=1.139.433). Tolerancia: subcuenta ≤3% (placement<100% upstream, esperado y documentado), sobreconteo >0,1% PROHIBIDO (detecta doble-suma). Resultado: **Sí agregado=1.110.341 (-2,55%)** — la subcuenta por placement, dentro de tolerancia. El resto loguea su total nacional para auditoría (sin cap silencioso).

## Verificación contra resultados oficiales

Spot-check balotaje-2024 ganador-por-depto vs prensa oficial (El Observador/Subrayado/CNN): **FA gana exactamente 5 deptos** (Montevideo, Canelones, Salto, Paysandú, San José) y PN/Coalición los otros 14 (Artigas, Rivera, Tacuarembó, Cerro Largo, Durazno, Río Negro, Soriano, Flores, Colonia, Florida, Treinta y Tres, Lavalleja, Rocha, Maldonado) — **coincide al 100%** con el resultado oficial. San José FA por 0,91% (677 votos) es real y correcto. nacionales-2024: FA gana 12/19 (plurality en primera vuelta). referéndum-LUC: No>Sí (no se derogó) ✓.

## Caveat documentado (del spike, confirmado)
Los shards subcuentan por placement<100% (Vivir sin Miedo -2,55%). Inocuo para el ganador-por-depto (la pérdida es ~proporcional entre opciones, preserva el share). Deptos con margen mínimo (San José 0,91%) son sensibles a la cobertura upstream, no a la agregación (que es lossless).

## npm
`etl:nacional-geo` (poligoniza + simplifica), `etl:nacional-votes` (agrega), `etl:nacional` (ambos). Reproducible end-to-end en Windows (`python`).

## Change Log
- 2026-06-01 — Geometría (IDE + poligonización shapely) + agregación 14 elecciones + 3 gates. Verificado contra resultado oficial balotaje-2024. Status → done.

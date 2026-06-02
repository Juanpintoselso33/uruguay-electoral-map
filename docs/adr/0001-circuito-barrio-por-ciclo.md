# ADR 0001 — Mapeo CRV → barrio de Montevideo por ciclo electoral

- **Estado:** Aceptado (2026-06)
- **Contexto disparador:** reporte público (X/@29howww) de un dato imposible — "FA 66,5% en Carrasco 2014" en un barrio históricamente anti-FA.
- **Relacionados:** [`docs/AUDIT-carrasco-2014-circuito-barrio.md`](../AUDIT-carrasco-2014-circuito-barrio.md), [`public/data/README.md`](../../public/data/README.md), [`etl/geometry/README.md`](../../etl/geometry/README.md).

## Contexto

En Montevideo los votos se unen a la geometría por **circuito (CRV) → barrio**: cada circuito se ubica
por la dirección de su local de votación → coordenada → *point-in-polygon* contra los 62 barrios de
`v_sig_barrios.json`. (El interior usa otro join: serie → barrio/localidad, curado por capital.)

El pipeline original generaba **un único** `montevideo-circuito-barrio.json` (clavado a la numeración
de circuitos de 2024) y lo aplicaba a **todas** las elecciones por número de CRV.

**Problema:** los números de CRV **se reasignan entre elecciones**. Aplicar el mapeo de un año a otro
mis-joinea los votos a nivel barrio. Medición del drift vs el mapeo servido: 2014 85%, internas-2019
83%, 2019 85%, departamentales-2020 84%, referéndum-2022 70%, departamentales-2025 59%, **2024 0%**.
Caso testigo: "Carrasco 2014 FA 66,5%" eran en realidad votos de Malvín Norte / Punta Gorda / Unión.

## Decisión

1. **Un mapeo CRV → barrio por ciclo electoral**, generado por
   [`scripts/build-circuito-barrio-cycles.py`](../../scripts/build-circuito-barrio-cycles.py) desde el
   `plan-circuital.csv` de cada ciclo. Cada runner MVD lee `montevideo-circuito-barrio.{ciclo}.json`.
   Ciclos: `2014`, `internas-2019`, `2019` (nac/bal/VSM), `departamentales-2020`, `referendum-2022`,
   `departamentales-2025`, `2024` (internas/nac/bal/plebiscitos).

2. **Asignación por tiers** (de más a menos preciso): **dir** (street-key exacta → coords del georef
   oficial → PIP) → **geo** (coordenada geocodificada del cache → PIP) → **coarse** (calle sin número,
   barrio único) → **tok** (voto por token de nombre de calle) → **serie** (barrio dominante, fallback).

3. **Geocoding propio** ([`scripts/geocode-missing-barrios.py`](../../scripts/geocode-missing-barrios.py),
   Nominatim/OSM) para las direcciones ausentes del georef-2024 (solo existe georef oficial de 2024).
   Cache `data/mappings/montevideo-geocode-cache.json` **commiteado** → build reproducible sin red.
   Guard: el PIP descarta resultados fuera de Montevideo (calles homónimas en otros deptos).

4. **El mismo método address-based + geocoding para TODOS los ciclos, incluido 2024** — *no* georef-direct
   para 2024. Aunque para 2024 existen coordenadas oficiales por circuito (más precisas en absoluto),
   usarlas solo en 2024 rompía la **coherencia de comparación entre años** (Carrasco "saltaba" por método).
   La coherencia cross-año pesa más que la precisión absoluta de un solo año.

## Alternativas consideradas y descartadas

- **Reusar un mapeo único** (statu quo): produce el bug de Carrasco. Descartado.
- **Match por rango de credencial (serie + Desde–Hasta):** los rangos se reparten entre elecciones; bajó
  la correlación. Descartado.
- **Enriquecer el índice con el plan 2024:** volvía ambiguas las claves coarse. Descartado.
- **georef-direct para 2024** (CRV→coords oficiales→PIP): más preciso para 2024 aislado, pero rompe la
  coherencia entre años (ver decisión 4). Descartado a favor de método uniforme.

## Consecuencias

- **Positivas:** el fallback impreciso por serie cayó de **25–50% → ~0,4–3,6%** en todos los ciclos
  (~98% de circuitos por coordenada real). Geometría completa (62/62 barrios). %FA y ganador correctos
  en todas las elecciones. Validación: Spearman FA% intra-ciclo nac↔bal ≈ 0,99; 2014↔2019 padrón 100%
  consistente (±15%). Interior no afectado (serie estable).
- **Límite asumido (no es bug):** sin georef oficial de años viejos, el padrón por barrio pre-2024 es
  ~99% por coordenada pero con imprecisión de borde residual. Además, parte de la diferencia entre eras
  es **redistritado real de circuitos** de la Corte (2019↔2024 padrón 26% — mismo método ⇒ cambio real,
  no artefacto). El conteo absoluto por barrio entre eras no es perfectamente comparable; el resultado
  político sí.
- **Operativa:** tras regenerar mapeos y re-correr runners MVD hay que correr
  `sweep-party-consistency.py --apply` (el ETL revierte nombres canónicos de partido) y
  `build-nacional-votes.py`. Documentado en [`etl/README.md`](../../etl/README.md).
- **Deuda:** `etl/geometry/build-circuito-barrio.ts` y `data/mappings/montevideo-circuito-barrio.json`
  quedan como legacy sin consumidores; se pueden eliminar en una limpieza futura.

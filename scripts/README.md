# scripts/ — Builders y quality gates

Scripts auxiliares que complementan el pipeline [`etl/`](../etl/README.md). Dos familias:

- **`.mjs`** — gates de build y generadores integrados al `npm run build` de Astro.
- **`.py`** — builders de geometría/datos para la vista nacional y casos especiales que requieren librerías de Python (geometría, extracción de PDF, auditorías).

## Quality gates

Corren en el build (`package.json → build`) y/o a demanda:

| Script | Comando | Qué valida |
|--------|---------|------------|
| `gate-data.mjs` | `npm run gate:data` | Integridad de los shards de datos. |
| `gate-escaleras.ts` | `npm run gate:escaleras` | Consistencia de las escaleras de color. |
| `gate-grises.py` | `npm run gate:grises` | Zonas sin geometría asociada (huecos grises en el mapa). |
| `perf-budget.mjs` | `npm run gate:perf` | Presupuesto de performance. |
| `a11y-check.mjs` | `npm run gate:a11y` | Chequeos de accesibilidad. |
| `measure-cwv.mjs` | `npm run gate:cwv` | Core Web Vitals. |

`npm run gate:all` ejecuta perf + a11y + cwv.

## Generadores de build

| Script | Comando | Salida |
|--------|---------|--------|
| `generate-og.mjs` | `npm run generate:og` | Imágenes Open Graph en `public/og/`. |
| `generate-search-index.mjs` | `npm run generate:search` | Índice de búsqueda. |

## Builders de la vista nacional (Python)

| Script | Comando | Función |
|--------|---------|---------|
| `build-nacional-geo.py` | `npm run etl:nacional-geo` | Geometría nacional (departamentos). |
| `build-nacional-zona-geo.py` | `npm run etl:nacional-zona-geo` | Geometría nacional por zona. |
| `build-nacional-votes.py` | `npm run etl:nacional-votes` | Votos consolidados a nivel nacional. |
| `build-intendentes-nacional.py` | `npm run etl:intendentes-nacional` | Candidatos a intendente por depto (electo + votos por candidato) para la ficha de la vista nacional `departamentales-2025`. Depende de `_nacional/votes.json` y de los shards `{depto}/hoja/intendente/{lema}.json`: re-correr tras `etl:nacional-votes` o tras regenerar los datos por depto. |
| `build-annex-series.py` | `npm run etl:annex` | Anexa series sin geometría propia. |

## Mapeo CRV → barrio de Montevideo (por ciclo)

| Script | Función |
|--------|---------|
| `build-circuito-barrio-cycles.py` | Genera un `data/mappings/montevideo-circuito-barrio.{ciclo}.json` por ciclo electoral (CRV→barrio). Tiers: dir → geo (cache) → coarse → tok → serie. Los CRV se reasignan entre elecciones → **un mapeo por ciclo, no compartido**. |
| `geocode-missing-barrios.py` | Geocodifica (Nominatim/OSM) las direcciones ausentes del georef-2024 y mantiene `data/mappings/montevideo-geocode-cache.json` (resumible, **commiteado** → build reproducible). Guard: PIP descarta calles homónimas fuera de MVD. |

> Contexto y decisión: [`docs/adr/0001-circuito-barrio-por-ciclo.md`](../docs/adr/0001-circuito-barrio-por-ciclo.md) · diagnóstico: [`docs/AUDIT-carrasco-2014-circuito-barrio.md`](../docs/AUDIT-carrasco-2014-circuito-barrio.md). Tras regenerar mapeos y re-correr runners MVD, correr `sweep-party-consistency.py --apply` y `build-nacional-votes.py`.

## Votos no-partidarios (blanco / anulados / observados + participación)

| Script | Comando | Función |
|--------|---------|---------|
| `fetch-totales-ckan.py` | `npm run etl:totales-fetch` | Baja de CKAN (Corte) los `totales-generales` por circuito faltantes (internas-2024, dep-2025). |
| `build-no-partidarios.py` | `npm run etl:no-partidarios` | Post-pass: puebla `noPartidarios` + `habilitados`/`emitidos` por barrio (MVD vía `crvToBarrio.{ciclo}`), serie (interior) y departamento (`_nacional`), desde el totales por circuito. |
| `gate-no-partidarios.py` | `npm run gate:no-partidarios` | Sanidad (no-negativos) + reconciliación nacional informativa. |

> **Dominio:** `emitidos`/`habilitados` salen del *totales* (donde se emitió el voto); `validos`/`porOpcion`
> del *desglose* (donde se contó). El voto **observado** se emite en un circuito y se cuenta en el de
> origen del votante → `emitidos = válidos + blanco + anulados + observados` **no cierra por zona** (ni
> exacto a nivel país: ~2% nacionales, ~10% internas). Son dos productos oficiales distintos; no se fuerzan
> a reconciliar. Spec: [`docs/superpowers/specs/2026-06-02-votos-no-partidarios-design.md`](../docs/superpowers/specs/2026-06-02-votos-no-partidarios-design.md).

## Dimensión personas (candidatos × hoja × credencial)

Construye una dimensión de personas indexada por credencial cívica, que une al mismo individuo a través de distintas elecciones. La métrica de cada persona es el **voto a su lista (hoja)**, no un voto personal — así funciona el voto legislativo en Uruguay.

**Fuente:** recurso "Integración de hojas de votación" de la Corte Electoral, disponible en el [Catálogo de Datos Abiertos](https://catalogodatos.gub.uy/) por dataset de elección.

**Cobertura por elección:**

| Elección | Credencial disponible | Notas |
|---|---|---|
| `nacionales-2024` | Sí (`CredencialSerie` + `CredencialNumero`) | CSV utf-8 |
| `departamentales-2025` | Sí | XLSX (19 deptos); el CSV de CKAN está truncado a Artigas — el fetch usa XLSX automáticamente (`PREFER_XLSX`) |
| `internas-2024` | Sí | XLSX; columna `TipoHoja` en lugar de `Candidatura` |
| `nacionales-2019` | **No** | El recurso de integración existe pero no incluye la columna de credencial (esquema anterior a 2024) |
| `nacionales-2014` | **No** | El dataset de nacionales-2014 no publica recurso de integración de hojas |

Para agregar más elecciones (internas/departamentales pasadas): verificar que el recurso incluya `CredencialSerie`/`CredencialNumero`, agregar el slug y dataset-id a `TARGETS` en `fetch-nominas-ckan.py`. El cargo resultante será EDIL/INTENDENTE/ODN/ODD — **no SENADOR/REPRESENTANTE** — y el chequeo de cargos del gate aplica solo a slugs `nacionales-*`.

**Scripts:**

| Script | Comando | Función |
|--------|---------|---------|
| `fetch-nominas-ckan.py` | `npm run etl:nominas-fetch` | Baja el recurso "Integración de hojas" de CKAN para cada elección declarada en `TARGETS`. Idempotente. |
| `build-personas-hoja.py` | `npm run etl:personas-hoja <eleccion>` | Parsea la integración → `personas-hoja.{eleccion}.json`: un registro por persona × hoja × cargo. `personaId = CredencialSerie-CredencialNumero` (estable entre elecciones). |
| `build-personas-historico.py` | `npm run etl:personas-historico` | Puente hacia 2019/2020 (sin credencial en origen): linkea candidatos por **nombre unívoco** contra la era credencial → `personas-historico.{eleccion}.json` (mismo schema + flag `match: "nombre"`). El nombre es casi-único (0.15% homónimos; los ambiguos se descartan). NO genera credenciales nativas, así que `gate:personas` no lo escanea. Correr ANTES de `etl:personas`. |
| `build-personas-canonical.py` | `npm run etl:personas` | Consolida `personas-hoja.*` (nativos, `match: "credencial"`) + `personas-historico.*` (`match: "nombre"`) → `personas.json`: una persona por credencial con apariciones cross-elección. Reporta M = personas en >1 elección. |
| `gate-personas.py` | `npm run gate:personas` | Valida: campos obligatorios presentes, cargos SENADOR/REPRESENTANTE en nacionales, tasa de hojas huérfanas <10%. |
| `query-persona.py` | — | Verificación standalone: dado un nombre o credencial, imprime hojas, votos de cada lista y ranking departamental. Los votos se leen de **`hoja-local.json`** (no `votes.json`, que es solo a nivel lema/partido). |

**Salidas:** `public/data/personas/personas-hoja.*.json` y `personas.json` (~340 MB total, 3 elecciones). Están **gitignoreadas** (intermedios de build pesado).

**Flujo:**
```bash
npm run etl:nominas-fetch
npm run etl:personas-hoja -- nacionales-2024
npm run etl:personas-hoja -- internas-2024
npm run etl:personas-hoja -- departamentales-2025
npm run etl:personas
npm run gate:personas
```

## Utilidades y auditoría

- `extract-vivir-sin-miedo.py` — extrae el Sí/No del plebiscito 2019 desde el PDF oficial, circuito por circuito.
- `sweep-party-consistency.py` — normaliza ids y nombres canónicos de partidos en todas las elecciones.
- `audit-grises.py` / `audit-ganador.py` — auditorías de cobertura geográfica y de "ganador" por zona.
- `enrich-votes-local.py`, `build-votes-local-*.py`, `votes_local_lib.py` — construcción del nivel "local de votación".
- `build-hoja-local.py` — desglose por **HOJA** agregado al nivel local → `hoja-local.json` (un archivo por elección×depto). Mismo motor circuito→local que `build-votes-local.py` (`--mode direct|match [--plan PATH]`) pero a granularidad de hoja, resolviendo el `opcionId` contra `catalogo.json`. Da el detalle por lista/sublema en la ficha del circuito (paridad con barrio/localidad) y coloreo hoja-exacto. Mapea `TIPO_REGISTRO → contienda` (nacionales `HOJA_EN/VOTO_LEMA`→`unica`; internas `HOJA_ODN/ODD`→`odn/odd`; dep-2025 `HOJA_ED`→`junta`, `HOJA_EM`→`municipio`) y resuelve el nº de hoja probando `Descripción_1` y `_2`. Filas agregadas (`PREC_*`, `SUBLEMA_*`, `VOTOS_PREC`) se ignoran. Cobertura: las 6 elecciones con desglose (nacionales 2014/2024 = 19 deptos, 2019 = MVD; internas 2019/2024 y departamentales-2025 = 19). Balotaje/plebiscito/referéndum no tienen hojas.
- `build-internas-sublemas.py` — **post-step: inyecta el nivel `sublema` en las contiendas ODN y ODD** del `catalogo.json` de internas (los 19 deptos). El desglose-de-votos NO trae la columna SUBLEMA; sí la **"Integración hojas de votación"** de la Corte (`hoja → sublema` por `TipoHoja=ODN/ODD`; 2024 = XLSX hoja `Datos`, 2019 = CSV). Jerarquías: **ODD** = `lema → sublema → hoja` (sublema cuelga del lema, id `{lemaId}-sl-{slug}`); **ODN** = `lema → precandidato → sublema → hoja` (sublema cuelga del precandidato, id `{precandId}-sl-{slug}`, preserva `precandidatoId`). Agrega nodos `sublema` + `grupoId`/`sublemaId`, sube `niveles` (degradado a la escalera sin `sublema` + `degradado:true` si el depto no tiene sublemas con dato). Parchea en sitio (preserva lemaId/precandidatoId, no toca shards de votos) e idempotente. Uso: `python scripts/build-internas-sublemas.py internas-2024` · `… internas-2019`. **Requiere** que `ESCALERAS` declare `(internas, odn) = ['lema','precandidato','sublema','hoja']` y `(internas, odd) = ['lema','sublema','hoja']`, y debe **re-correrse si se regenera el catálogo de internas** (el aggregator TS no lee la integración). El acordeón arma el árbol recursivamente por `parentId` (0, 1 o 2 niveles intermedios).

> Requisitos Python: ver imports de cada script. Los `.py` se invocan vía los scripts `npm run etl:*` correspondientes.

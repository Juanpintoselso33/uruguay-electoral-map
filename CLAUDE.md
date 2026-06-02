# CLAUDE.md — Mapa Electoral de Uruguay (v2)

Instrucciones para agentes de IA que trabajan en este repo. Comunicación y documentos: **español**.

> Este proyecto es el **rebuild (v2)** de un mapa electoral brownfield. Lo durable es el **dominio electoral uruguayo**, no una implementación puntual. No replicar la deuda de la v1.

## Qué es

Visualización interactiva de resultados electorales de Uruguay: **19 departamentos + vista nacional**, **14 instancias electorales (2014–2025)**, drill-down hasta circuito/local y desglose **por hoja (lista)**.

App en vivo: https://uruguay-electoral-map.vercel.app

## Documentación (leer antes de tocar cada área)

| Área | Doc |
|------|-----|
| Visión general, quick start, arquitectura | [`README.md`](README.md) |
| **Contrato de datos + invariantes de dominio** | [`public/data/README.md`](public/data/README.md) |
| Pipeline de datos | [`etl/README.md`](etl/README.md) |
| Builders Python + quality gates | [`scripts/README.md`](scripts/README.md) |
| Frontend (Astro + Vue) | [`src/README.md`](src/README.md) |

## Stack (real, confirmado en `package.json`)

- **Astro 5** (islas) + **Vue 3.5** (Composition API)
- **MapLibre GL 5** · TopoJSON · d3-geo · polygon-clipping
- Estado: **nanostores** (`@nanostores/vue`, `src/stores/map-state.ts`) — **no Pinia**
- Estilos: **Tailwind CSS 4**
- ETL: **TypeScript** (esbuild / tsx) + **Python** (geometría, vista nacional, casos especiales)
- Deploy: **Vercel** (`@astrojs/vercel`, `vercel.ts`) — **no Netlify**

## Quick start

```bash
npm install
npm run dev        # desarrollo
npm run build      # producción (corre gates + genera OG e índice de búsqueda)
npm run check      # type-check
```

## Invariantes NO negociables (dominio)

El detalle completo está en [`public/data/README.md`](public/data/README.md). En resumen:

- **Esquema CSV de origen:** `PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA`.
- **Encoding UTF-8** obligatorio (el origen de la Corte suele venir en Latin-1; normalizar en la ingesta).
- **Voto canónico** de una sola etapa de escrutinio (la definitiva); nunca sumar a través de etapas.
- **Unidad base = opción electoral × unidad geográfica** (hoja en internas/legislativas; candidato/lema en balotaje/presidencial). Modelo **agnóstico al tipo de elección**.
- **Blancos / anulados / observados** son categorías aparte (sin partido ni hoja); reconciliar contra **votos válidos**.
- **Join geográfico varía:** Montevideo une **CIRCUITO (CRV) → barrio** por geolocalización (dirección → coords → point-in-polygon contra los 62 barrios); interior por mapeo curado **serie → barrio/localidad**. Nunca por la columna `ZONA` directa ni por join espacial de series.
- **El mapeo CRV → barrio de Montevideo es POR CICLO ELECTORAL, no compartido:** los números de CRV se reasignan entre elecciones, así que un único mapeo aplicado a todas produce joins falsos (el bug "Carrasco FA 66,5% en 2014"). Se generan con `scripts/build-circuito-barrio-cycles.py` (un `data/mappings/montevideo-circuito-barrio.{ciclo}.json` por ciclo) + cache de geocoding `montevideo-geocode-cache.json`. Ver [`docs/adr/0001-circuito-barrio-por-ciclo.md`](docs/adr/0001-circuito-barrio-por-ciclo.md).
- **Granularidad por hoja NO se downscopea** a nivel-lema: siempre ingerir las contiendas completas con hoja, aunque el join sea laborioso.
- GeoJSON/TopoJSON ≤ 3 MB por archivo (simplificar si excede).

## Fuente de verdad de cobertura

[`src/config/departments.json`](src/config/departments.json) declara qué departamentos, niveles y elecciones existen. Agregar una elección/departamento empieza por acá. (Los antiguos `regions.json` / `elections-meta.json` son legacy.)

## Pipeline ETL

Cada instancia electoral tiene su runner (`etl/run-*.ts`), expuesto como script `npm run etl:*`. Ejemplos:

```bash
npm run etl:montevideo               # Montevideo por barrio
npm run etl:nacionales-2024-interior # nacionales 2024, interior
npm run etl:nacional                 # consolida la vista nacional (geo + votos)
npm run etl:vivir-sin-miedo          # plebiscito 2019 (extraído de PDF oficial)
```

Catálogo completo (~50 runners) en `package.json`. Detalle en [`etl/README.md`](etl/README.md).

## Quality gates

```bash
npm run gate:data        # integridad de shards
npm run gate:escaleras   # escaleras de color
npm run gate:grises      # zonas sin geometría (Python)
npm run gate:all         # perf + a11y + Core Web Vitals
```

## Fuentes de datos

- **Electoral:** [Corte Electoral Uruguay](https://www.corteelectoral.gub.uy/) — [Catálogo de Datos Abiertos](https://catalogodatos.gub.uy/).
- **Geográfico:** [IDE Uruguay](https://www.gub.uy/infraestructura-datos-espaciales/) — límites departamentales.

## Notas para agentes

- `legacy/`, `spikes/`, `_bmad/` y `docs/bmad-output/` están **gitignoreados** (presentes en disco, fuera del repo). No referenciarlos en código ni docs públicos.
- No commitear sin que el usuario lo pida.
- Workflow de contribución: rama desde `master` → cambios → validar con gates → `/commit` → PR.

## Licencia

MIT.

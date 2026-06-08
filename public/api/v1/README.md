# API pública v1 — Mapa Electoral de Uruguay

API **read-only** de datos electorales de Uruguay (resultados, geometría y candidatos), con
CORS abierto. Datos abiertos de la **Corte Electoral**. Entry point: [`index.json`](index.json).

- Docs (humano): `/api/v1/docs` · OpenAPI: [`openapi.json`](openapi.json) · Schemas: [`schema/`](schema/)

## Recursos

| Ruta | Qué es |
|------|--------|
| `index.json` | Índice de la API (versión, fuente, departamentos, elecciones). |
| `elections.json` · `elections/{eleccion}.json` | Catálogo de elecciones y su metadata. |
| `results/{eleccion}/{departamento}/votes.json` | Resultados por zona (vía `/data`). |
| `geo/{departamento}/{nivel}.topo.json` | Geometría (TopoJSON). |
| `dumps/{eleccion}.ndjson` | Dump bulk en NDJSON: una fila por `(nivel, departamento, geoId, opción)` con votos. Incluye **todos los niveles geográficos** (serie/barrio/localidad/circuito/local/municipio) **+ el agregado `_nacional`** (departamento y zona); cada fila trae el campo `nivel`. El desglose por **hoja** (lista) no va acá (otra forma, con `hojaId`) — está en `results/hoja-*`. Cubre las 24 elecciones. |
| `candidatos/` | Dimensión persona ↔ candidatura ↔ votos de lista. **Ver [`candidatos/README.md`](candidatos/README.md).** |

## Candidatos: identidad y deuda pendiente

El recurso `candidatos/` identifica personas por **credencial cívica** (id duro, 2024+) y
**puentea 2019/2020 por nombre** (campo `match: "credencial" | "nombre"`; los votos publicados
salen solo de candidaturas por credencial). El detalle del matcheo, la confianza y la cobertura
están documentados en **[`candidatos/README.md`](candidatos/README.md)**.

> **Deuda técnica:** **2014 no tiene roster de candidatos** — la Corte no publicó la Integración
> de hojas de 2014 en datos abiertos (solo resultados/plan circuital/desglose). Falta conseguir la
> fuente (acceso a información pública o proclamaciones oficiales). Detalle en
> [`candidatos/README.md`](candidatos/README.md#deuda-técnica-pendiente).

## Fuente

Corte Electoral del Uruguay — [catalogodatos.gub.uy](https://catalogodatos.gub.uy/organization/corte-electoral).
Datos abiertos con atribución a la Corte Electoral.

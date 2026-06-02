# etl/transform

Agregaciones del voto canónico por nivel geográfico y por opción electoral. Toda la lógica es **agnóstica al tipo de elección**: agrega votos válidos por (opción × unidad geográfica) y deriva los roll-ups.

## Por nivel geográfico

| Archivo | Agrega a nivel |
|---------|----------------|
| `aggregate-by-serie.ts` | serie (interior) |
| `aggregate-by-localidad.ts` | localidad (interior) |
| `aggregate-by-circuito.ts` | circuito |
| `aggregate-by-barrio-interior.ts` | barrio (capitales del interior) |

## Por hoja (lista)

| Archivo | Caso |
|---------|------|
| `aggregate-hoja-internas.ts` | internas, desglose por hoja |
| `aggregate-hoja-nacionales.ts` | nacionales (Montevideo), por hoja |
| `aggregate-hoja-nacionales-interior.ts` | nacionales (interior), por hoja |
| `aggregate-hoja-serie.ts` | hoja consolidada por serie |

## Por tipo de contienda

| Archivo | Caso |
|---------|------|
| `aggregate-nacionales-mvd.ts` · `aggregate-nacionales-serie.ts` | elecciones nacionales |
| `aggregate-balotaje-mvd.ts` · `aggregate-balotaje-by-serie.ts` | balotajes (opción = candidato/lema, sin hoja) |
| `aggregate-binaria-by-serie.ts` | plebiscitos / referéndum (binarias Sí/No) |

> Recordatorio de dominio: blancos / anulados / observados se contabilizan como categorías aparte (sin partido ni hoja); la reconciliación es sobre **votos válidos**. Ver [`public/data/README.md`](../../public/data/README.md).

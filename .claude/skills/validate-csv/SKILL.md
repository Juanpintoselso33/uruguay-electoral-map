---
name: validate-csv
description: |
  Valida un CSV electoral crudo de la Corte contra el esquema del proyecto y chequea calidad
  de datos (votos, hojas, duplicados, etapas de escrutinio). Usar antes de meter un
  departamento o una elección nueva al ETL, o para diagnosticar filas raras en el origen.
---

# Validate CSV

Valida los CSV electorales **crudos** (los de `data/raw/electoral/`, tal como salen de la
Corte Electoral) contra el esquema del proyecto.

No confundir con `npm run gate:data`, que valida los **shards ya publicados** en
`public/data/`. Esta skill mira el origen, aguas arriba del ETL.

## Esquema requerido

```
PARTIDO       Partido político (string, no vacío)
DEPTO         Departamento (string, no vacío)
CIRCUITO      Circuito electoral / CRV (string)
SERIES        Serie (string)
ESCRUTINIO    Etapa de escrutinio (string)
PRECANDIDATO  Precandidato (string; vacío en contiendas sin precandidato)
HOJA          Número de hoja/lista (string numérico)
CNT_VOTOS     Cantidad de votos (string parseable a entero ≥ 0)
ZONA          Zona declarada en el origen (string)
```

Encoding **UTF-8**, delimitador coma. El origen suele venir en **Latin-1**: si aparecen
`Ã±`/`Ã³`, el archivo no está en UTF-8 y hay que normalizarlo en la ingesta, no parchear
después.

## Chequeos

### Estructura
- Están las 9 columnas, sin encabezados vacíos.
- El archivo parsea entero (no se corta a mitad por comillas mal cerradas).

### Calidad de filas
- `CNT_VOTOS` entero ≥ 0.
- `HOJA` numérica.
- `PARTIDO` y `DEPTO` no vacíos.
- Sin filas duplicadas para la misma combinación de claves.

### Invariantes de dominio (los que importan)
- **Una sola etapa de `ESCRUTINIO` por contienda**, la definitiva. Si el archivo trae varias,
  es un problema de extracción: reportarlo, nunca sumarlas.
- **Misma `HOJA` ⇒ mismo `PARTIDO` y mismo `PRECANDIDATO`.** Si una hoja aparece con dos
  partidos, o el origen está mezclando contiendas o hay hojas homónimas entre elecciones.
- **Blancos / anulados / observados** vienen sin partido ni hoja. Son categorías aparte: se
  reconcilian contra votos válidos, no se cuentan como listas.

> **`ZONA` no se valida contra el GeoJSON.** No es la clave geográfica. El join real es
> CIRCUITO (CRV) → barrio por geolocalización en Montevideo —**y por ciclo electoral**, ver
> `docs/adr/0001-circuito-barrio-por-ciclo.md`— y serie → localidad curada en el interior.
> Validar `ZONA` contra la geometría es justamente el error que produjo el bug
> "Carrasco FA 66,5% en 2014".

## Cómo correrlo

No hay una API de validación en el repo. Leer el archivo y contarlo con las herramientas
disponibles: `Read` para inspeccionar, Bash para lo agregado, o un `npx tsx` puntual si hace
falta cruzar mucho. Para archivos grandes, evitar cargarlos enteros en contexto.

```bash
head -1 data/raw/electoral/<archivo>.csv          # encabezados
wc -l data/raw/electoral/<archivo>.csv            # filas
file -I data/raw/electoral/<archivo>.csv          # encoding declarado
```

## Salida

Un reporte con: archivo, filas, hojas únicas, unidades geográficas únicas, total de votos, y
la lista de problemas con código, severidad y número de fila. Veredicto único:
`OK` / `WARNING` / `ERROR`.

## Códigos

| Código | Severidad | Descripción |
|--------|-----------|-------------|
| E001 | Error | Falta una columna requerida |
| E002 | Error | Encoding inválido |
| E004 | Error | Archivo no encontrado |
| E005 | Error | `CNT_VOTOS` no parseable |
| E006 | Error | Campo requerido vacío |
| E007 | Error | Más de una etapa de `ESCRUTINIO` en la misma contienda |
| W001 | Warning | Voto negativo |
| W002 | Warning | Fila duplicada |
| W005 | Warning | `HOJA` no numérica |
| W006 | Warning | Misma `HOJA` con distinto `PARTIDO`/`PRECANDIDATO` |

## Relacionadas
- `add-department` · `optimize-geojson`
- Contrato de datos completo: `public/data/README.md`

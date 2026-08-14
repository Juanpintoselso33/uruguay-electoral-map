---
description: Valida datos electorales (CSV crudo y/o shards publicados) sin modificar nada.
argument-hint: <departamento> | --all
---

# /validate-data

Valida datos electorales sin modificar el sistema.

## Uso
```
/validate-data <departamento>
/validate-data --all
```

## Qué se valida

### a) Shards ya publicados — con los gates del repo
Es el camino por defecto: los gates son código, no criterio.

```bash
npm run gate:data        # integridad de shards en public/data/
npm run gate:escaleras   # escaleras de color
npm run gate:grises      # zonas sin geometría (Python)
```

Con `--all`, correr los tres y reportar el consolidado.

### b) CSV crudo — a mano, para un departamento puntual
Sobre `data/raw/electoral/`:

**Esquema:** `PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA`.
Encoding UTF-8, delimitador coma.

**Calidad:**
- `CNT_VOTOS` entero ≥ 0.
- `HOJA` numérica; una misma `HOJA` siempre con el mismo `PARTIDO` y `PRECANDIDATO`.
- Sin filas duplicadas para la misma combinación.
- Una sola etapa de `ESCRUTINIO` (la definitiva). Si aparece más de una, es un error de
  extracción, no algo para sumar.
- Blancos / anulados / observados sin partido ni hoja; reconciliar contra votos válidos.

> **No validar `ZONA` contra el GeoJSON.** `ZONA` no es la clave geográfica: el join real es
> CRV → barrio por ciclo (Montevideo) o serie → localidad curada (interior). Ver
> `public/data/README.md` y `docs/adr/0001-circuito-barrio-por-ciclo.md`.

### c) Geometría
- GeoJSON/TopoJSON válido, sin geometrías nulas.
- Coordenadas dentro de Uruguay: lat −35,0 a −30,0 · lon −58,5 a −53,0.
- ≤ 3 MB por archivo.

## Salida

Un reporte por departamento: qué se chequeó, qué pasó, qué falló con archivo y fila. Y un
veredicto único (`OK` / `WARNING` / `ERROR`). Sin sugerir arreglos que no se pidieron: este
comando no modifica nada.

## Códigos

| Código | Descripción | Severidad |
|--------|-------------|-----------|
| E001 | Falta una columna requerida | Error |
| E002 | Encoding inválido | Error |
| E003 | GeoJSON no parsea | Error |
| E004 | Archivo no encontrado | Error |
| E005 | `CNT_VOTOS` no numérico | Error |
| E006 | Campo requerido vacío | Error |
| E007 | Más de una etapa de `ESCRUTINIO` en la misma contienda | Error |
| W001 | Voto negativo | Warning |
| W002 | Fila duplicada | Warning |
| W005 | `HOJA` no numérica | Warning |
| W006 | Misma `HOJA` con distinto `PARTIDO`/`PRECANDIDATO` | Warning |

## Comandos relacionados
- `/add-department` — alta de departamento o elección.

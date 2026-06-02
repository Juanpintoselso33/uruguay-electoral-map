# etl/extract

Extracción y parseo de los datos crudos de la Corte Electoral.

| Archivo | Función |
|---------|---------|
| `parse-csv.ts` | Parser CSV con soporte de campos entre comillas. Necesario porque `PRECANDIDATO` trae comas dentro de comillas. |

La normalización de nombres y encoding (UTF-8, sin acentos, mayúsculas, espacios colapsados) vive en [`etl/lib/normalize.ts`](../lib/).

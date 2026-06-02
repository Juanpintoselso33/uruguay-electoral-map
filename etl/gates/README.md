# etl/gates

Validaciones que corren durante el build. Cualquiera que falle lanza (exit ≠ 0) y **corta el build**: datos malos no se publican. Los umbrales se fijan *antes* de ver los números (no se bajan para forzar verde).

| Archivo | Gate | Qué garantiza |
|---------|------|---------------|
| `coverage.ts` | Cobertura zonas↔geometría | Dos métricas: *placement* ponderado por votos (¿se pinta donde se votó?) y *barrio-fill* (¿quedan barrios reales sin datos?). Bajo umbral ⇒ falla con reporte de faltantes. |
| `reconcile.ts` | Losslessness | La suma de votos canónicos del CSV (sum-in) debe igualar lo que el ETL contabilizó (sum-out). Delta ≠ 0 ⇒ el ETL perdió o duplicó votos ⇒ falla. |
| `geometry-size.ts` | Tamaño de geometría | Falla si un artefacto eager supera el budget. Mide crudo y gzip (lo que viaja por el CDN). |
| `gates.selftest.ts` | Self-test | Verifica que los propios gates detectan los casos que deben detectar. |

> No existe un "total oficial" externo en la fuente (el CSV solo trae `ESCRUTINIO='Departamental'`), por eso la reconciliación es una prueba de **losslessness del pipeline**, no un cotejo contra un número externo.

# Story 6.5 — Comparación a nivel HOJA cross-elección (normalizada por sigla)

**Status:** Done
**Épica:** 6 — Fase 2 — Exportar, Circuito, HOJA
**FR:** FR18

---

## User Story

Como analista, quiero que la comparación dual entre dos elecciones normalice los partidos por sigla canónica, para que "Partido Colorado" en internas-2024 y "Colorado" en nacionales-2019 se reconozcan como el mismo partido y el mapa muestre el delta correctamente.

## Acceptance Criteria

- [x] La función `applyComparisonOverlay` carga la tabla de equivalencias de Story 6.4 si existe
- [x] Con tabla disponible: compara ganadores por sigla canónica (no por nombre literal)
- [x] Sin tabla (fetch 404): degrada al comportamiento de Story 4.3 (comparación por nombre literal)
- [x] Las zonas donde el ganador cambió entre elecciones muestran borde de cambio (`vsChanged=true`)
- [x] Modo degradado sin tabla es transparente al usuario — no hay error visible

## Implementación

### ChoroplethMap.vue — `applyComparisonOverlay`

La función ya existía para Story 4.3 (comparación dual partido/lema). Story 6.5 extiende su lógica:

```ts
// Intentar cargar tabla de equivalencias (Story 6.5 — FR18/FR32).
// Si no existe, la comparación cae a nombre literal (comportamiento Story 4.3).
let equivDoc: EquivDoc | null = null;
try {
  const equivRes = await fetch(`${base}/data/hoja-equivalencias/${departamento}/${baseEleccion}-${vs}.json`);
  if (equivRes.ok) equivDoc = (await equivRes.json()) as EquivDoc;
} catch { /* tabla no disponible — modo degradado */ }
```

Con `equivDoc` disponible, construye un mapa `aId → sigla` y `sigla → bId` para resolver equivalencias antes de comparar ganadores. Sin él, compara `ganadorOpcionId` literalmente (mismo comportamiento pre-6.5).

**Degradación graceful:** el `try/catch` absorbe fetch 404 silenciosamente. El usuario no ve diferencia excepto que la normalización cross-nombre no aplica.

## Relación con otras stories

- **Depende de Story 6.4** (tablas en `public/data/hoja-equivalencias/`)
- **Extiende Story 4.3** (comparación dual partido/lema) — no la reemplaza
- La comparación a nivel **HOJA individual** (número de lista) sigue siendo Fase 3 — este story normaliza a nivel **partido/lema**

## Archivos modificados

- `src/components/map/ChoroplethMap.vue` — `applyComparisonOverlay` extendida con carga de tabla de equivalencias

# Diseño — Story 16.4: Anexión de series nuevas a su "madre" histórica

Fecha: 2026-06-02 · Epic 16 (polígonos grises) · Estado: aprobado en brainstorming, pendiente review

## Problema

La geometría de series (`geo/{depto}/serie.topo.json`) está fijada al padrón **~2024**. En elecciones viejas, muchas de esas series **no existían / no votaron** → sus polígonos quedan **grises** (hasta 4% en referéndum-LUC-2022). El usuario no distingue "esa serie no votó" de "falta el dato (bug)".

**Confirmado contra el raw oficial** (`scripts/audit-grises.py` extendido): en las 3 peores elecciones (balotaje-2019, referéndum-2022, balotaje-2014), **0 grises corresponden a series que votaron** — todas son benignas (no están en el raw). No hay bug oculto; el gris es 100% "serie que no votó esa elección".

## Lógica oficial (investigación Tavily)

Las credenciales = 3 letras (serie) + número. La serie pertenece a una **Oficina Inscriptora / localidad**; las credenciales van en orden numérico dentro de la serie. **Cuando una serie se llena, la Corte crea una serie NUEVA para la misma localidad** (doc oficial "Letras y series por Municipio" agrupa varias series por localidad: "Soca CLA-CLD-CLE"). → La "madre" de una serie nueva son sus **hermanas de la misma localidad**.

## Solución: anexar cada serie gris a su madre, fusionando el polígono (solo para ese año)

### A. Mapa de anexión (ETL, build-time) — `scripts/build-annex-series.py`
Por elección×depto (nivel serie), para cada serie GRIS (en geometría, sin voto en esa elección):
1. **Candidatas = vecinos espaciales que votaron** (polígonos que comparten borde, vía shapely sobre la geometría decodificada).
2. **Preferir HERMANAS** (misma localidad, `serie-localidad.json`) entre las candidatas; desempate = mayor borde compartido.
3. Si no hay vecino-hermana → **vecino espacial de cualquier localidad** con mayor borde compartido (caso "localidad nueva", ej. Castellanos: su territorio era del vecino antes de crearse).
4. Si no hay ningún vecino que votó (aislada, raro) → queda gris.

Output: `public/data/{eleccion}/{depto}/annex-series.json` = `{ "cpb": "cpa", ... }` (greySerie→madreSerie, normalizado). Solo se emite si hay anexiones.

Validación incluida: toda serie gris está confirmada ausente del raw (si alguna está en el raw → ERROR, es bug; ver gate C).

### B. Fusión geométrica real (ETL) + display
La fusión es **geométrica de verdad** (un polígono, sin borde interno), calculada en el ETL para no hacer ops de geometría en runtime ni regenerar 14 geometrías completas:
- El mismo `build-annex-series.py` **disuelve (shapely `unary_union`)** cada madre M con todas sus series grises anexadas → un polígono fusionado M′ por elección×depto.
- Emite un **override chico** `public/data/{eleccion}/{depto}/serie-annexed.topo.json` que contiene **solo** los polígonos fusionados (M′) afectados (pocos: 2-25 por depto), namespaceados con la madre. El geoId de M′ = la madre (su voto ya está).
- `ChoroplethMap::loadData`: si existe el override para eleccion×depto×nivel-serie, **reemplaza** en el FC los polígonos constituyentes (las grises G y la M original) por el fusionado M′. M′ joinea al voto de la madre por su geoId → colorea con el resultado de la madre, sin borde interno (es un solo polígono).
- La ficha de M′ muestra la localidad de la madre.
- 2024 y elecciones sin anexiones: no hay override → comportamiento idéntico al actual.

### C. Gate (build-time) — extiende `scripts/audit-grises.py` o gate nuevo
Cruza, por elección con raw disponible, cada serie gris contra el `Serie` del CSV crudo oficial. **Falla el build si alguna serie gris aparece en el raw** (= votó y la perdimos = bug real, NO benigno). Garantiza que el "gris = benigno" esté verificado, no asumido, y que un hueco de datos futuro no se esconda tras la anexión.

## Decisiones (aprobadas en brainstorming)
- Madre por **localidad oficial (hermanas)**, con **vecino espacial** como desempate y como fallback para localidades nuevas. (Juan: "anexar al vecino espacial").
- Mapa de anexión calculado en **ETL build-time** (no en cliente). (Juan).
- Display = **fusión en un solo polígono**, solo para ese año. (Juan).
- **Gate sí** (garantiza benigno). (Juan).

## Componentes y límites
- `scripts/build-annex-series.py` — calcula el mapa (shapely + serie-localidad + votos + raw). Entra: geometría, votes.json, serie-localidad.json, raw CSV. Sale: annex-series.json + reporte.
- `ChoroplethMap.vue::loadData` — lee annex-series.json, aplica adopción + supresión de borde. Reusa síntesis de merge (16.3).
- Gate en el pipeline de build (junto a gate-data).

## Edge cases
- Serie gris sin ningún vecino que votó → queda gris (raro; se loguea).
- MVD (nivel zona, no serie) → no aplica (sin drift de series; el mapeo es barrio).
- Elección sin raw disponible para el gate → el gate se saltea con WARNING (no oculta, avisa).
- Una madre puede recibir varias grises (varias series nuevas de la misma localidad) → todas adoptan su resultado.

## Testing
- `build-annex-series.py` corre en las 14 elecciones; reporte de anexiones por elección.
- Gate: 0 series grises en el raw (debe pasar; si falla, hay bug de datos).
- Browser: una elección vieja (balotaje-2014) sin grises visibles (salvo aislados logueados); fusión sin borde interno; ficha correcta.
- Regresión: 2024 (casi sin grises) sin cambios; el merge de 16.3 (sia-sib-sic) sigue andando.

## Fuera de alcance
- Reconstruir el padrón histórico exacto por CRV (los CRV rotan; descartado en brainstorming).
- Cambiar la geometría base por-elección (la fusión es visual, no regenera 14 geometrías).

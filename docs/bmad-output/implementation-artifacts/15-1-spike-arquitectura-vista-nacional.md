---
baseline_commit: e42434a
---

# Story 15.1: Spike — arquitectura de la vista nacional

Status: done

## Story

As a desarrollador, I want definir geometría, agregación y ruta de la vista nacional, so that la implementación (15.2–15.5) sea sólida y no descubra sorpresas a mitad de camino.

## Contexto medido (estado real del repo)

- `data/raw/geographic/uruguayDepartamentos.geojson` **existe pero pesa 0 bytes** (stub vacío). **No hay geometría de bordes departamentales utilizable hoy.**
- Los `public/{depto}_map.json` legacy NO son bordes departamentales: son los polígonos de **zona/barrio** sin simplificar (p. ej. `montevideo_map.json` = 63 features = barrios), legacy pesado (~206 MB el conjunto). No sirven como outline de los 19 deptos.
- La geometría de **nivel-base zona** por-depto (`public/data/geo/{depto}/{zona|serie|barrio}.topo.json`) suma **8,72 MB** combinando los 19 deptos. `circuito` total = 0,71 MB (pero es OTRO nivel, no el de zona — ver decisión b).
- El shard de votos por-depto (`votes.json`) ya trae por zona: `{ geoId, ganadorOpcionId, validos, porOpcion:[{opcionId,votos}], noPartidarios }`. → **sumable** para agregar a nivel depto.

## Decisiones del spike

### (a) Geometría departamental — fuente + budget
- **El stub está vacío → hay que sourcear.** Fuente primaria: **IDE Uruguay "Límites Departamentales"** (19 polígonos limpios, ya en CLAUDE.md como fuente oficial; CKAN `ide-limites-departamentales`).
- **Fallback** si el sourcing falla: **disolver** (mapshaper `-dissolve`) los `{zona|serie}.topo.json` por-depto en 19 polígonos depto. Más caro y con bordes "ruidosos"; solo si IDE no se puede bajar.
- **Clave que abarata todo:** el toggle de granularidad **SWAPEA capas** (se ve depto O zona, nunca ambas a la vez, igual que el control de nivel actual). → **No hace falta alineación geométrica** entre la capa depto y la capa zona; cualquier desfase de bordes es invisible. Por eso IDE-oficial (independiente de las zonas) es perfecto y no requiere disolver para "encajar".
- **Budget:** 19 polígonos depto simplificados a ~`-simplify 8-12%` → objetivo **<150 KB** topojson. Holgado vs NFR1. Salida: `public/data/geo/_nacional/departamento.topo.json`.

### (b) Combinación de zonas en FC nacional + peso
- Peso real combinado del nivel-base zona de los 19 deptos = **8,72 MB** → **excede el budget NFR1 (~3 MB)**. Es el único riesgo duro del epic.
- **Estrategia v1 (este epic, 15.4):** **departamental es el DEFAULT** → los 8,72 MB quedan **opt-in**. Al togglear a `zona` nacional, **lazy-load**: el cliente ya sirve `{nivel}.topo.json` por-depto, así que v1 puede **fetch-and-combine los 19 a demanda** (o servir un único topojson combinado mapshaper-simplificado apuntando a <3 MB).
- **NO** usar `circuito` (0,71 MB) como sustituto del nivel zona: es otra granularidad (el AC pide "todos los polígonos de zona/serie"). Se documenta para que nadie "optimice" cambiándolo.
- **El problema duro (cumplir NFR1 en zona nacional) se resuelve en 15.5** (lazy-load por viewport / simplificación / PMTiles, ver Story 5.2). El spike solo decide el enfoque; no lo implementa.

### (c) Agregación de votos por depto
- Por elección: leer los 19 `votes.json` por-depto, **sumar `porOpcion` de todas sus zonas** → `porOpcion` a nivel depto → `ganadorOpcionId = argmax`. Salida: `votes.json` nivel `departamento` (1 archivo/elección, 19 "zonas" = deptos).
- **Caveat de cobertura (documentar, no asumir):** sumar zonas del shard = suma de zonas **colocadas**. Los gates de placement corren a ≥95% (varios deptos 98–99,9%), así que el agregado depto **subcuenta levemente** el total real del depto. Inocuo para el *ganador* del choropleth, pero queda anotado.
- **Gate NO tautológico (refinamiento clave):** "la suma reconcilia contra los shards" se compara contra sí misma → siempre pasa. El gate real usa un **ancla independiente**: `Σ(19 agregados depto) por opción ≈ total nacional publicado`. Anclas ya disponibles: Vivir sin Miedo Sí=1.139.433; FA/PN nacionales conocidos por elección. **15.2 debe declarar el ancla por elección** y tolerancia (la subcuenta de placement explica un delta pequeño y acotado).

### (d) Ruta + default
- **Ruta:** `/{eleccion}` (sin depto) = vista nacional. Verificado **sin colisión**: hoy solo existe `src/pages/[eleccion]/[departamento].astro` + `src/pages/index.astro` top-level; falta crear `src/pages/[eleccion]/index.astro` (su `getStaticPaths` enumera las elecciones únicas de `departments.json`). La ruta per-depto `/{eleccion}/{departamento}` se mantiene intacta.
- **Default de granularidad:** **departamental** (mantiene los 8,72 MB de zona opt-in).
- **Estado en URL:** la granularidad vive en la URL como el nivel actual (reusar `?level=` o un `?gran=departamento|zona`), coherente con Story 1.7 / 2.5.

## Conclusión / go-no-go para 15.2
- 15.2 es donde está el costo y el único riesgo duro (los 8,72 MB de zona). La geometría departamental hay que **sourcearla de IDE** (el stub está vacío) antes de construir nada.
- **Checkpoint para Juan antes de implementar 15.2+:** confirmar (1) sourcing IDE de límites departamentales vs disolver zonas, (2) que departamental-default + zona-lazy es el enfoque aceptado, (3) las anclas nacionales por elección para el gate.

## Change Log
- 2026-06-01 — Spike completado (medición de repo + decisiones a/b/c/d, refinado con revisión adversaria del gate y la geometría). Status → done.

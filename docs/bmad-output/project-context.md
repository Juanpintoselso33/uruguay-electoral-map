---
project_name: 'Uruguay Electoral Map'
user_name: 'Juan'
date: '2026-05-30'
sections_completed: ['estado', 'sistema_actual', 'invariantes_dominio', 'almacenamiento', 'proceso', 'usage']
status: 'complete'
rule_count: 12
optimized_for_llm: true
---

# Project Context for AI Agents

_Este archivo contiene reglas y patrones críticos que los agentes de IA DEBEN seguir al implementar código en este proyecto. Se enfoca en detalles no obvios que un agente podría pasar por alto._

---

## Estado del proyecto

Este es un **REBUILD** de un proyecto brownfield. El **stack técnico objetivo se decide en la fase de Arquitectura** (post-PRD). NO asumir tecnología todavía. Lo durable es el **dominio electoral**, no la implementación actual.

## Sistema actual (referencia — se está reemplazando)

- Vue 3.4 + Vite 5 + TS strict; MapLibre GL 4 (activo) / Leaflet (muerto).
- Pinia store único (`src/stores/electoral.ts`), composables en `src/composables/`.
- ETL en Node ESM (`etl/`: extract → transform → load).
- Deploy Netlify. Datos servidos desde `public/`.
- **Deuda conocida a NO replicar:** doble app shell (`AppModern`/`AppLegacy`), archivos `.backup`, doble esquema de datos (CSV plano legacy + JSON procesado), docs de planning contradictorios en root, `tsconfig.json` mal nombrado (`tsonfig.json`).

---

## Invariantes de DOMINIO (durables — verdad del sistema electoral uruguayo)

### Entidades y cardinalidad
- 19 departamentos. Jerarquía geográfica: **CIRCUITO ⊃ SERIE ⊃ ZONA**.
- `HOJA` (lista) pertenece a exactamente 1 `PARTIDO`.
- En ODN, una `HOJA` mapea a 1 `PRECANDIDATO`. En ODD no hay precandidato.
- **ODN** = Orden Departamental Nacional · **ODD** = Orden Departamental Departamental.
- Tipos de elección: `internas | nacionales | balotaje | departamentales`. El modelo debe ser **AGNÓSTICO al tipo** (`PRECANDIDATO` opcional).

### Voto canónico (CRÍTICO — evita duplicar votos y soporta los 4 tipos de elección)
- `ESCRUTINIO` = etapa de escrutinio. El voto canónico se cuenta de la etapa **definitiva/total** (la final validada). NUNCA sumar a través de etapas distintas.
- Unidad base de voto: **(opción electoral × unidad geográfica)**, NO siempre `HOJA`. La _opción electoral_ es `HOJA` en internas/legislativas, o **candidato/lema** en balotaje/presidencial (donde NO hay HOJA). Diseñar agnóstico al tipo.
- Las agregaciones (serie, circuito, depto) se derivan por roll-up de **votos válidos**.
- **Votos en blanco / anulados / observados** existen en los totales oficiales pero NO tienen partido ni HOJA → modelarlos como categorías aparte. La reconciliación contra oficiales es sobre **votos válidos** (no contra el total bruto).
- Sin duplicados (opción × geografía) dentro de una misma etapa. Votos ≥ 0.

### Clave de unión geográfica (VARÍA según tipo de mapa)
- Mapa por barrio/zona: join `CSV.ZONA ↔ GeoJSON (BARRIO | texto | zona)`.
- Mapa por serie: join vía mapeo `SERIE → barrio` (no por `ZONA` directa).
- La cadena `BARRIO → texto → zona` es un **FALLBACK** por GeoJSON inconsistente, no un patrón a imitar. Tratar como **riesgo de calidad de dato**.

### Reglas de integridad en ingesta
- **Normalizar a UTF-8 en la ingesta** (el origen de la Corte Electoral suele venir en Latin-1).
- **Validar cobertura de zonas:** emitir reporte de zonas CSV sin match en GeoJSON; fallar el build si la cobertura < umbral definido.
- **Test de reconciliación:** los totales agregados deben coincidir con los resultados oficiales por departamento.

### Esquema CSV (columnas obligatorias)
```
PARTIDO, DEPTO, CIRCUITO, SERIES, ESCRUTINIO, PRECANDIDATO, HOJA, CNT_VOTOS, ZONA
```

### Fuentes oficiales
- **Electoral:** Corte Electoral Uruguay (catálogo de datos abiertos).
- **Geográfico:** IDE Uruguay (límites departamentales).

---

## Convenciones de ALMACENAMIENTO (actuales — el rebuild puede cambiarlas)

- Heterogeneidad esperada entre departamentos (Rivera / Montevideo tienen casos especiales de mapeo serie↔barrio).
- GeoJSON ≤ 3 MB por archivo (simplificar si excede).
- **NO son invariantes de dominio:** nombres de archivo, carpeta `public/`, formato JSON vs CSV. Up for grabs en Arquitectura.

---

## Reglas de proceso (BMAD)

- Comunicación y documentos en **español**.
- Artefactos de planning en `docs/bmad-output/`.
- El stack y los patrones de implementación se definen en **Arquitectura**, no acá.

---

## Usage Guidelines

**Para agentes de IA:**
- Leer este archivo ANTES de implementar cualquier código o tomar decisiones de dominio.
- Respetar los invariantes de DOMINIO al pie de la letra; ante la duda, optar por lo más restrictivo (ej. voto canónico de una sola etapa).
- Las convenciones de ALMACENAMIENTO NO son fijas: pueden cambiar en Arquitectura.
- NO replicar la deuda conocida del sistema actual.

**Para humanos:**
- Mantener el archivo lean y enfocado en lo no obvio.
- Actualizar cuando se decida el stack en Arquitectura (mover de "TBD" a concreto).
- Revisar tras cada elección nueva incorporada (validar que el modelo agnóstico aguanta).

Last Updated: 2026-05-30

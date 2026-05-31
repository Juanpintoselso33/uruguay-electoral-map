---
baseline_commit: 48b6206
---

# Story 4.2: Navegación multi-elección

Status: ready-for-dev

## Story

As a usuario,
I want cambiar entre las elecciones disponibles para el departamento que estoy viendo,
so that pueda explorar el mapa de cada comicio sin perder el contexto del departamento.

## Acceptance Criteria

1. **Given** que estoy en `/internas-2024/montevideo` **When** el selector de elección muestra las elecciones disponibles **Then** veo opciones para `internas-2024` y `nacionales-2019` (Montevideo tiene ambas); la elección activa se destaca visualmente.
2. **Given** que hago click en `nacionales-2019` **When** la navegación ocurre **Then** la URL cambia a `/nacionales-2019/montevideo`, el mapa no se re-inicializa (persiste el island), y el `OpcionSelector` recarga las opciones de la nueva elección.
3. **Given** que estoy en `/internas-2024/rivera` **When** veo el selector de elección **Then** `nacionales-2019` aparece deshabilitada o ausente (Rivera solo tiene internas-2024 disponible), sin links rotos.
4. **Given** que hay un departamento activo **When** navego entre elecciones **Then** el departamento se preserva en la URL (path segment).

## Dev Notes

### Arquitectura de navegación (NO cambiar)

- Las rutas son SSG path-based: `/{eleccion}/{departamento}`. No cambiar a query-params para SSG.
- El AC del epic menciona `?eleccion=` — esto es un artefacto del diseño inicial. La URL final
  seguirá siendo `/nacionales-2019/montevideo`, no `?eleccion=nacionales-2019`. El `parseUrl()`
  ya soporta el override por query param por forward-compat, pero la navegación real usa paths.
- `transition:persist` en `#map-persist` maneja NFR1 (no re-init). Solo funciona si se navega
  con `<a>` links y Astro ClientRouter está activo. NO usar `router.push()` ni `window.location`.

### Estado actual de las rutas

`getStaticPaths()` en `src/pages/[eleccion]/[departamento].astro`:
```ts
return [
  { params: { eleccion: 'internas-2024',   departamento: 'montevideo' } },
  { params: { eleccion: 'internas-2024',   departamento: 'rivera'     } },
  { params: { eleccion: 'nacionales-2019', departamento: 'montevideo' } },
];
```
Montevideo tiene 2 elecciones; Rivera solo 1. El selector debe reflejar esto.

### Fuente de verdad: elecciones disponibles por departamento

Definir en el Astro page (igual que `DEPT_AVAIL` para niveles):

```ts
const DEPT_ELECTIONS: Record<string, string[]> = {
  montevideo: ['internas-2024', 'nacionales-2019'],
  rivera:     ['internas-2024'],
};
```

Pasar las elecciones disponibles al componente como prop (server-side, sin fetch).

### Componente `EleccionSelector`

Crear `src/components/selectors/EleccionSelector.vue` (isla `client:idle`, como los otros
selectores). Recibe:
- `elecciones: string[]` — lista de elecciones disponibles para este depto
- `eleccionActual: string` — la elección en la URL actual
- `departamento: string` — para construir el href

Renderiza links `<a>` a `/{eleccion}/{departamento}` para cada elección disponible.
La elección activa recibe clase distinta. Las no-disponibles... simplemente no aparecen
(el array solo contiene las disponibles, AC 3 se cumple por omisión).

### Etiquetas de elección para UI

```ts
const ELECCION_LABELS: Record<string, string> = {
  'internas-2024':   'Internas 2024',
  'nacionales-2019': 'Nacionales 2019',
};
```
Ya existe `ELECCION_LABELS` en el Astro page para `<title>`. Exponerlo o duplicarlo en el
componente para el texto del botón.

### Nav actual (MODIFICAR)

`src/pages/[eleccion]/[departamento].astro`, líneas ~55-58:
```html
<nav class="px-4 py-2 flex gap-3 text-sm border-b border-gray-200">
  <a href="/internas-2024/montevideo" ...>Montevideo</a>
  <a href="/internas-2024/rivera" ...>Rivera</a>
</nav>
```

El problema: los links de departamento apuntan hardcodeados a `internas-2024`. Al estar en
`/nacionales-2019/montevideo` y clickar "Rivera", iría a `/internas-2024/rivera` (correcto
por ahora, Rivera solo tiene internas-2024), pero el patrón es frágil.

**Fix mínimo:** cambiar los href de departamento para mantener la elección actual si está
disponible, o ir a internas-2024 como fallback. Dado que Rivera solo tiene internas-2024,
el comportamiento actual es aceptable para esta story — solo documentarlo en dev notes.

### Cuándo NO re-montar el OpcionSelector

`OpcionSelector` está fuera de `transition:persist`, así que se re-monta en cada
navegación y recarga `opciones.json` del nuevo `{eleccion}/{departamento}`. Esto es
comportamiento correcto y no necesita cambio para Story 4.2.

### OG image y search-index: sin cambios

Las rutas ya existen desde Story 4.1. El `EleccionSelector` no genera rutas nuevas.

### TypeScript: no usar `any`

El componente debe tipar correctamente. Props interface:
```ts
interface Props {
  elecciones: string[];
  eleccionActual: string;
  departamento: string;
}
```

## Tasks / Subtasks

- [ ] **Task 1: Componente `EleccionSelector.vue` (AC: 1, 2, 3)**
  - [ ] Crear `src/components/selectors/EleccionSelector.vue`
  - [ ] Renderizar `<a>` links para cada elección disponible con href `/{eleccion}/{departamento}`
  - [ ] Destacar la elección activa (bold o underline, mismo patrón que dept-selector)
  - [ ] No montar como isla Vue; pasar props desde Astro server-side

- [ ] **Task 2: Integrar selector en `[departamento].astro` (AC: 1, 2, 3, 4)**
  - [ ] Definir `DEPT_ELECTIONS` record en el page
  - [ ] Extraer elecciones disponibles para el departamento actual
  - [ ] Añadir `<EleccionSelector>` debajo o junto al selector de departamento
  - [ ] Verificar que la nav de departamentos no rompe navegación desde `nacionales-2019`

- [ ] **Task 3: Verificación manual (AC: 1, 2, 3, 4)**
  - [ ] `npm run dev` → `/internas-2024/montevideo`: selector muestra Internas 2024 (activo) + Nacionales 2019
  - [ ] Click "Nacionales 2019" → URL cambia a `/nacionales-2019/montevideo`, mapa persiste, opciones recargan
  - [ ] `/internas-2024/rivera`: selector muestra solo Internas 2024 (sin Nacionales 2019)
  - [ ] `astro check` → 0 errores TS

## Story Completion Checklist

- [ ] Todos los ACs verificados manualmente en browser
- [ ] `astro check` sin errores
- [ ] NFR1 verificado: inspector DevTools confirma que el `<canvas>` MapLibre NO se destruye al cambiar elección en Montevideo
- [ ] Commit con mensaje `feat(nav): selector multi-elección por departamento (Story 4.2)`
- [ ] `sprint-status.yaml`: `4-2-navegacion-multi-eleccion: done`

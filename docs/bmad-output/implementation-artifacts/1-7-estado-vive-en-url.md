---
baseline_commit: 412f0ddcfc1749cb8dc1b563b6946edf6912aa94
---

# Story 1.7: Estado vive-en-URL (nanostores + url-schema)

Status: done

## Story

As a usuario,
I want que la vista que estoy mirando viva en la URL,
so that pueda recargar sin perder el contexto y se habiliten deep-links.

## Acceptance Criteria

1. **Given** el contrato de URL `/{election}/{department}?zona=&opcion=&level=&vs=` **When** cambia el estado del mapa **Then** la URL se actualiza y los nanostores la espejan.
2. **Given** una URL de deep-link **When** recargo **Then** se reconstruye la misma vista (parse∘serialize es identidad sobre el estado).
3. **Given** el schema **When** lo reviso **Then** ya contempla `?eleccion=` y la comparación `?a=&b=` (y `?vs=`) aunque por ahora haya un solo valor.
4. **Given** SSR / build estático **When** el módulo se importa sin `window` **Then** no rompe (las funciones puras no tocan el DOM; el bridge al `location`/`history` está guardado).

## Dev Notes

### Contrato de URL (architecture.md §Estado)
```
/{election}/{department}?zona=&opcion=&level=zona|serie|circuito&vs={election}
```
- **La URL es la fuente de verdad.** Los nanostores **espejan** la URL. Escritura = actualizar URL (push/replaceState) → el store reacciona. **Sin estado de sesión paralelo.**
- Cross-isla: **solo nanostores** (`$selection`, `$level`, `$comparison`), prefijo `$`. Pinia global y vue-router prohibidos.
- `level` default = `zona`. Valores: `zona|serie|circuito`.
- Forward-compat: el parser/serializer ya entiende `?eleccion=` (alternativa al path) y `?a=&b=` (comparación dual, Epic). Hoy se serializan solo si tienen valor.

### Diseño
- `src/lib/url-state.ts`: **puro, sin `window`**. `parseUrl(pathname, search): MapView` + `toUrl(view): { pathname, search }` / `toHref(view)`. Normaliza defaults, ignora params desconocidos, no emite params vacíos.
- `src/stores/map-state.ts`: nanostores `$context` (eleccion+departamento del path), `$selection` ({zona,opcion}), `$level`, `$comparison` ({vs,a,b}). Bridge browser `bindToLocation()` (guardado por `typeof window`): inicializa stores desde `location` y escucha `popstate`; `commit()` serializa stores→URL con `history.pushState` y re-sincroniza. SSR-safe.

### Testing
- Self-test (patrón del proyecto, ejecutable esbuild+node + typecheck `astro check`): round-trip parse∘serialize identidad sobre casos (mínimo, con selección, con level, con vs, con a/b, con eleccion query); defaults (level=zona); params vacíos no se serializan; params desconocidos se ignoran.

### Aprendizajes 1.1-1.6
- TS strict + `import type` + `verbatimModuleSyntax`. Self-test ejecutable vía esbuild+node hasta runner (1.10).
- Sin tocar el ETL ni la geometría. Esta story es solo estado cliente (lógica + stores), sin UI (mapa = 1.8).

### References
- [epics.md#Story 1.7] · [architecture.md#Estado — contrato de URL] · [1-2 contract] (`NivelGeografico`=zona|serie|circuito).

## Tasks / Subtasks

- [x] **Task 1: `url-state.ts` puro (AC: 1, 2, 3, 4)**
  - [x] Tipos `MapView` (eleccion, departamento, zona|null, opcion|null, level, vs|null, a|null, b|null).
  - [x] `parseUrl(pathname, search)`: extrae election/department del path (o `?eleccion=`), query params, defaults, ignora desconocidos.
  - [x] `toUrl(view)`/`toHref(view)`: serializa; no emite params vacíos; level=zona omitible.
- [x] **Task 2: stores nanostores + bridge (AC: 1, 4)**
  - [x] `src/stores/map-state.ts`: `$context`, `$selection`, `$level`, `$comparison`.
  - [x] `bindToLocation()` y `commit(partial)` guardados por `typeof window !== 'undefined'`; init desde `location`, listener `popstate`, escritura `history.pushState`.
- [x] **Task 3: Self-test + verificación (AC: 1-4)**
  - [x] `src/lib/url-state.selftest.ts`: round-trip identidad + defaults + vacíos + desconocidos + forward-compat.
  - [x] `astro check` 0 · self-test OK (esbuild+node) · import sin window no rompe · `npm run build` verde.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

---

## Dev Agent Record (resultado)
**Agent:** Amelia — claude-opus-4-8[1m]

### Completion Notes
- `src/lib/url-state.ts` PURO (sin window): `parseUrl`/`toUrl`/`toHref`, tipo `MapView`. Defaults (level=zona omitido), no emite params vacíos, ignora desconocidos, `?eleccion=` override del path, forward-compat `?a=&b=` + `?vs=`.
- `src/stores/map-state.ts`: nanostores `$context`/`$selection`/`$level`/`$comparison`. URL = fuente de verdad: `commit(patch)` actualiza stores + `pushState`; `bindToLocation()` hidrata desde `location` y escucha `popstate`. Bridge guardado por `typeof window` → SSR-safe (verificado: import + commit en node sin window no rompe).
- Self-test (`url-state.selftest.ts`): round-trip identidad (5 casos), defaults, vacíos, desconocidos, forward-compat. Todo OK vía esbuild+node.
- Verificación: `astro check` 0/0/0 · self-test OK · import SSR-safe OK · `npm run build` verde. Sin UI (mapa = 1.8), sin tocar ETL.

### Senior Developer Review (AI)
**2026-05-30 · inline · APPROVED.** AC1 (URL↔stores) ✅, AC2 (recarga reconstruye = round-trip identidad) ✅, AC3 (schema contempla `?eleccion=`/`?a=&b=`/`?vs=`) ✅, AC4 (SSR-safe) ✅. Lógica pura separada del bridge DOM (testeable, sin Pinia/vue-router). Sin findings bloqueantes.

### File List
**Nuevos:** `src/lib/url-state.ts` · `src/stores/map-state.ts` · `src/lib/url-state.selftest.ts`

### Change Log
- Capa de estado vive-en-URL: contrato `/{election}/{department}?zona=&opcion=&level=&vs=`, nanostores espejo, bridge location/history SSR-safe.

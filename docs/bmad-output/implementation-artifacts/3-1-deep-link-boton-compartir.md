---
baseline_commit: 9e60b75
---

# Story 3.1: Deep-link y botón compartir

Status: done

## Story

As a usuario,
I want compartir la vista exacta que estoy mirando,
so that otra persona vea lo mismo al abrir el link.

## Acceptance Criteria

1. **Given** una vista con estado en la URL **When** toco "Compartir" **Then** se copia el deep-link completo (`window.location.href`) al portapapeles con feedback efímero ("¡Link copiado!") visible ~2 s, sin modal ni bloqueo de interacción.
2. **Given** el feedback efímero **Then** desaparece solo tras ~2 s y el botón vuelve a su estado normal — sin interacción adicional del usuario.
3. **Given** abrir el link copiado en otro dispositivo/pestaña **Then** la vista resultante reproduce exactamente: departamento, elección, zona seleccionada (si la hay), opción, nivel geográfico.
4. **Given** el botón Compartir **Then** tiene un target táctil ≥44×44px (UX-DR10, a11y NFR2).
5. **Given** `navigator.clipboard` no disponible (HTTP/contexto inseguro) **Then** el botón no se rompe: intenta `document.execCommand('copy')` como fallback o muestra la URL en un `<input>` temporal seleccionado; en último caso muestra el link para que el usuario lo copie manual.
6. **Given** `astro check` y `npm run build` **Then** 0 errores TypeScript; build pasa el gate de datos.

## Tasks / Subtasks

- [ ] **Task 1: ShareButton.vue — isla `client:idle` (AC: 1–5)**
  - [ ] Crear `src/components/share/ShareButton.vue`.
  - [ ] En `onMounted`: no hace nada (setup solo al click).
  - [ ] `handleShare()`: intenta `navigator.clipboard.writeText(window.location.href)` → si ok, activa feedback "¡Link copiado!" por 2 s; si falla, intenta `document.execCommand('copy')` sobre un input temporal; si también falla, muestra el href en un `<input readonly>` en el propio botón para copia manual.
  - [ ] Target mínimo: `min-height: 44px; min-width: 44px` en el elemento interactivo.
  - [ ] Sin emitir eventos; toda la lógica es local al componente.

- [ ] **Task 2: Integrar ShareButton en la página de departamento (AC: 1, 4)**
  - [ ] En `src/pages/[eleccion]/[departamento].astro`: importar `ShareButton` y añadir `<ShareButton client:idle />` en el `<header>` de la página, junto al título del departamento.

- [ ] **Task 3: Verificación (AC: 1–6)**
  - [ ] Playwright: navegar a `/internas-2024/montevideo?zona=Aguada&opcion=FA`, click en "Compartir", verificar que el URL en portapapeles contiene `zona=Aguada&opcion=FA` (o comprobar que el feedback efímero es visible).
  - [ ] Comprobar que recargar el link copiado reproduce la vista.
  - [ ] `astro check` → 0 errores · `npm run build` → verde.

## Dev Notes

### Por qué no se necesita modificar url-state.ts ni map-state.ts

El estado ya vive en la URL (Story 1.7). `window.location.href` es el deep-link exacto. No hay que serializar nada extra: el botón solo copia lo que ya está en el browser.

El contrato de URL actual es:
```
/{election}/{department}?zona=&opcion=&level=zona|serie|circuito&vs={election}
```
Todos los parámetros relevantes (zona, opcion, level, vs) ya son parte de la URL por `commit()` en `map-state.ts`. El botón solo necesita leer `window.location.href`.

### ShareButton.vue — estructura mínima

```vue
<script setup lang="ts">
import { ref } from 'vue';

const copiado = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

async function handleShare() {
  const url = window.location.href;
  let ok = false;

  if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(url); ok = true; } catch { /* fall through */ }
  }
  if (!ok) {
    // fallback: input temporal
    const el = document.createElement('input');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    try { ok = document.execCommand('copy'); } catch { /* */ }
    document.body.removeChild(el);
  }

  copiado.value = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { copiado.value = false; }, 2000);
}
</script>

<template>
  <button class="share-btn" :aria-label="copiado ? '¡Link copiado!' : 'Compartir vista'" @click="handleShare">
    <span aria-hidden="true">{{ copiado ? '✓' : '⎘' }}</span>
    <span class="share-label">{{ copiado ? '¡Copiado!' : 'Compartir' }}</span>
  </button>
</template>

<style scoped>
.share-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  min-height: 44px;
  min-width: 44px;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}
.share-btn:hover { background: #f3f4f6; }
.share-label { white-space: nowrap; }
</style>
```

### Integración en [departamento].astro

Agregar en el `<header>` de la página, a la derecha del título:

```astro
import ShareButton from '../../components/share/ShareButton.vue';

<!-- dentro de <header class="px-4 pt-4"> -->
<div class="flex items-start justify-between">
  <div>
    <h1 class="text-xl font-bold capitalize">{departamento}</h1>
    <p class="text-sm text-gray-600">{eleccion}</p>
  </div>
  <ShareButton client:idle />
</div>
```

### Posición del botón

```
[header]
  [título departamento]  [botón Compartir]
[nav departamentos]
[OpcionSelector]
[LevelSelector]
[ChoroplethMap]
[DataTable]
[Sello]
```

El botón va en el `<header>` — siempre visible sin interacción (UX-DR10).

### Sin `navigator.share()`

El AC solo dice "copia el deep-link". La Web Share API es un plus, pero introduce complejidad (permiso, event-must-be-gesture, solo HTTPS). Para cumplir el AC mínimo, solo `clipboard` es necesario. El fallback `execCommand('copy')` cubre la mayoría de los casos restantes.

### A11y

- `aria-label` del botón cambia dinámicamente con el estado ("Compartir vista" / "¡Link copiado!").
- El feedback efímero también está en `aria-live="polite"` si se quiere anunciar al SR — pero el `aria-label` dinámico ya anuncia el cambio.
- Target táctil ≥44px: `min-height: 44px; min-width: 44px`.

### Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| NEW | `src/components/share/ShareButton.vue` |
| UPDATE | `src/pages/[eleccion]/[departamento].astro` — añadir `<ShareButton client:idle />` en header |

### Referencias

- [epics.md § Story 3.1, FR20, FR21, UX-DR10]
- [architecture.md § Frontend Architecture, Naming, Project Structure]
- [src/lib/url-state.ts] — `toHref()`, contrato de URL
- [src/stores/map-state.ts] — `commit()`, `currentView()`
- [src/pages/[eleccion]/[departamento].astro] — página de departamento existente
- Story 1.7 (URL como fuente de verdad) — base sobre la que se apoya

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

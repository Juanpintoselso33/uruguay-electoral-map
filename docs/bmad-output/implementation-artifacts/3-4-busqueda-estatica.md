---
baseline_commit: 37c5976
---

# Story 3.4: Búsqueda estática

Status: done

## Story

As a usuario,
I want buscar y saltar a una lista, candidato o departamento,
so that llegue rápido a lo que busco.

## Acceptance Criteria

1. **Given** un índice de búsqueda estático generado en build **When** busco una entidad conocida **Then** salto a la vista correspondiente.
2. **Given** búsqueda sin resultados **Then** muestra estado vacío con sugerencias (no semántico).
3. **Given** el índice **Then** incluye departamentos disponibles y opciones/partidos por departamento.
4. **Given** `astro check` y `npm run build` **Then** 0 errores; `public/search-index.json` generado.

## Tasks / Subtasks

- [ ] **Task 1: Generar índice en build (AC: 3, 4)**
  - [ ] Crear `scripts/generate-search-index.mjs`
  - [ ] Actualizar `build` en `package.json` para incluir `generate-search-index.mjs`

- [ ] **Task 2: SearchBox.vue — isla `client:idle` (AC: 1, 2)**
  - [ ] Crear `src/components/search/SearchBox.vue`
  - [ ] Carga el índice vía fetch en mount; filtra por texto (contains, case-insensitive)
  - [ ] Resultado visible con label + sublabel; click navega
  - [ ] Estado vacío con sugerencias cuando query no da resultados

- [ ] **Task 3: Integrar en index.astro (AC: 1)**
  - [ ] Añadir `<SearchBox client:idle />` antes de la grilla de departamentos

## Dev Notes

### Índice de búsqueda

```json
[
  { "label": "Montevideo", "sublabel": "internas-2024", "type": "depto", "href": "/internas-2024/montevideo" },
  { "label": "Frente Amplio", "sublabel": "Montevideo · internas-2024", "type": "partido", "href": "/internas-2024/montevideo?opcion=frente-amplio" },
  ...
]
```

### SearchBox.vue mínimo

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';

interface Entry { label: string; sublabel: string; type: string; href: string }

const query = ref('');
const entries = ref<Entry[]>([]);
const loaded = ref(false);

async function loadIndex() {
  if (loaded.value) return;
  const r = await fetch('/search-index.json');
  entries.value = await r.json();
  loaded.value = true;
}

const results = computed(() => {
  if (!query.value.trim()) return [];
  const q = query.value.toLowerCase();
  return entries.value.filter(e =>
    e.label.toLowerCase().includes(q) || e.sublabel.toLowerCase().includes(q)
  ).slice(0, 8);
});

function navigate(href: string) {
  window.location.href = href;
}
</script>
```

### Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| NEW | `scripts/generate-search-index.mjs` |
| NEW | `src/components/search/SearchBox.vue` |
| UPDATE | `package.json` — añadir `generate:search`, actualizar `build` |
| UPDATE | `src/pages/index.astro` — añadir `<SearchBox client:idle />` |

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

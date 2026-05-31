<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface Entry {
  label: string;
  sublabel: string;
  type: string;
  href: string;
}

const SUGGESTIONS = ['Frente Amplio', 'Partido Nacional', 'Montevideo', 'Rivera'];

const query = ref('');
const entries = ref<Entry[]>([]);
const open = ref(false);
const activeIdx = ref(-1);

onMounted(async () => {
  try {
    const r = await fetch('/search-index.json');
    entries.value = await r.json();
  } catch {
    /* falla silenciosa — búsqueda queda deshabilitada */
  }
});

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return entries.value
    .filter((e) => e.label.toLowerCase().includes(q) || e.sublabel.toLowerCase().includes(q))
    .slice(0, 8);
});

function onInput() {
  open.value = true;
  activeIdx.value = -1;
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIdx.value = Math.min(activeIdx.value + 1, results.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIdx.value = Math.max(activeIdx.value - 1, -1);
  } else if (e.key === 'Enter' && activeIdx.value >= 0) {
    e.preventDefault();
    navigate(results.value[activeIdx.value].href);
  } else if (e.key === 'Escape') {
    open.value = false;
  }
}

function navigate(href: string) {
  window.location.href = href;
}
</script>

<template>
  <div class="search-wrap" role="search">
    <label class="search-label" for="search-input">Buscar departamento, partido o plebiscito</label>
    <div class="search-combobox">
      <input
        id="search-input"
        v-model="query"
        class="search-input"
        type="search"
        placeholder="Ej: Montevideo, Frente Amplio…"
        autocomplete="off"
        aria-autocomplete="list"
        :aria-expanded="open && query.trim().length > 0"
        aria-haspopup="listbox"
        aria-controls="search-listbox"
        @input="onInput"
        @keydown="onKeydown"
        @focus="open = true"
        @blur="setTimeout(() => (open = false), 150)"
      />
      <ul
        v-if="open && query.trim().length > 0"
        id="search-listbox"
        class="search-results"
        role="listbox"
      >
        <template v-if="results.length > 0">
          <li
            v-for="(entry, i) in results"
            :key="entry.href"
            class="search-item"
            :class="{ 'search-item--active': i === activeIdx }"
            role="option"
            :aria-selected="i === activeIdx"
            @mousedown.prevent="navigate(entry.href)"
          >
            <span class="search-item__label">{{ entry.label }}</span>
            <span class="search-item__sublabel">{{ entry.sublabel }}</span>
          </li>
        </template>
        <li v-else class="search-empty" role="option" aria-disabled="true">
          <span class="search-empty__msg">Sin resultados. Intentá:</span>
          <span class="search-empty__suggestions">
            <button
              v-for="s in SUGGESTIONS"
              :key="s"
              class="search-suggestion"
              type="button"
              @mousedown.prevent="query = s; onInput()"
            >{{ s }}</button>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.search-wrap {
  margin-bottom: 1.5rem;
}

.search-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.375rem;
}

.search-combobox {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 1rem;
  border: 1.5px solid #d1d5db;
  border-radius: 0.5rem;
  background: #ffffff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.12s;
}

.search-input:focus {
  border-color: #6b7280;
}

.search-results {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  background: #ffffff;
  border: 1.5px solid #d1d5db;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  list-style: none;
  padding: 0.25rem 0;
  margin: 0;
  z-index: 100;
  max-height: 320px;
  overflow-y: auto;
}

.search-item {
  padding: 0.5rem 0.875rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.search-item:hover,
.search-item--active {
  background: #f3f4f6;
}

.search-item__label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.search-item__sublabel {
  font-size: 0.75rem;
  color: #9ca3af;
}

.search-empty {
  padding: 0.75rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.search-empty__msg {
  font-size: 0.875rem;
  color: #6b7280;
}

.search-empty__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.search-suggestion {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  background: #f9fafb;
  color: #374151;
  cursor: pointer;
  transition: background 0.1s;
}

.search-suggestion:hover {
  background: #e5e7eb;
}
</style>

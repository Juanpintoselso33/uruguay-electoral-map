<template>
  <div v-if="hasActiveFilters" class="active-filters">
    <div class="active-filters-header">
      <span class="active-filters-label">Filtros activos:</span>
      <button
        @click="$emit('clear-all')"
        class="clear-all-btn"
        aria-label="Limpiar todos los filtros"
      >
        <X :size="14" />
        <span>Limpiar todo</span>
      </button>
    </div>

    <div class="filter-chips">
      <!-- Party filter chip -->
      <div v-if="selectedParty" class="filter-chip">
        <span class="chip-label">{{ selectedParty }}</span>
        <button
          @click="$emit('remove-party')"
          class="chip-remove"
          :aria-label="`Remover filtro: ${selectedParty}`"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- Search filter chip -->
      <div v-if="searchQuery" class="filter-chip">
        <span class="chip-label">Búsqueda: "{{ searchQuery }}"</span>
        <button
          @click="$emit('remove-search')"
          class="chip-remove"
          aria-label="Remover búsqueda"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- Selected lists count chip -->
      <div v-if="selectedCount > 0" class="filter-chip info-chip">
        <span class="chip-label">
          {{ selectedCount }} {{ selectedType }} seleccionada{{ selectedCount !== 1 ? 's' : '' }}
        </span>
        <button
          @click="$emit('remove-selections')"
          class="chip-remove"
          aria-label="Deseleccionar todo"
        >
          <X :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { X } from 'lucide-vue-next';

interface Props {
  selectedParty?: string;
  searchQuery?: string;
  selectedLists?: string[];
  selectedCandidates?: string[];
  isODN?: boolean;
}

interface Emits {
  (e: 'clear-all'): void;
  (e: 'remove-party'): void;
  (e: 'remove-search'): void;
  (e: 'remove-selections'): void;
}

const props = withDefaults(defineProps<Props>(), {
  selectedParty: '',
  searchQuery: '',
  selectedLists: () => [],
  selectedCandidates: () => [],
  isODN: false,
});

const emit = defineEmits<Emits>();

const hasActiveFilters = computed(() => {
  return !!(
    props.selectedParty ||
    props.searchQuery ||
    props.selectedLists.length > 0 ||
    props.selectedCandidates.length > 0
  );
});

const selectedCount = computed(() => {
  return props.isODN && props.selectedCandidates.length > 0
    ? props.selectedCandidates.length
    : props.selectedLists.length;
});

const selectedType = computed(() => {
  return props.isODN && props.selectedCandidates.length > 0 ? 'candidato' : 'lista';
});
</script>

<style scoped>
.active-filters {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.active-filters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.active-filters-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.clear-all-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-all-btn:hover {
  background: var(--color-border);
  border-color: var(--color-text-secondary);
  color: var(--color-text);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  background: var(--color-accent);
  color: white;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.filter-chip.info-chip {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.chip-label {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  color: currentColor;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.chip-remove:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.info-chip .chip-remove {
  background: var(--color-border);
  color: var(--color-text-secondary);
}

.info-chip .chip-remove:hover {
  background: var(--color-text-secondary);
  color: white;
}

@media (max-width: 768px) {
  .active-filters {
    padding: 0.5rem;
  }

  .filter-chips {
    gap: 0.375rem;
  }

  .chip-label {
    max-width: 120px;
  }
}
</style>

<template>
  <div class="list-selector" data-testid="list-selector">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <LoadingSpinner size="medium" text="Cargando listas..." />
    </div>

    <div v-else class="selector-content">
      <!-- Data source toggle (ODD/ODN) - Only for Internas elections -->
      <DataSourceToggle
        v-if="props.isInternasElection"
        v-model="localIsODN"
        @update:modelValue="onDataSourceToggle"
      />

      <!-- Selector toggle (Lists/Candidates) - ODN only in Internas -->
      <div v-if="localIsODN && props.isInternasElection" class="selector-toggle-section">
        <h3 class="section-label">Seleccionar por</h3>
        <div class="toggle-group" role="radiogroup" aria-label="Seleccionar por listas o candidatos">
          <label
            v-for="option in selectorOptions"
            :key="option.label"
            class="toggle-option"
          >
            <input
              type="radio"
              :value="option.value"
              :checked="showLists === option.value"
              @change="handleSelectorToggle(option.value)"
              class="toggle-input sr-only"
              :aria-label="option.label"
            />
            <span
              class="toggle-label"
              :class="{ 'toggle-label-active': showLists === option.value }"
            >
              {{ option.label }}
            </span>
          </label>
        </div>
      </div>

      <!-- Party filter -->
      <PartyFilter v-model="selectedParty" :parties="uniqueParties" @update:modelValue="onPartySelect" />

      <!-- Active filters chips -->
      <ActiveFilters
        :selected-party="selectedParty"
        :search-query="searchQuery"
        :selected-lists="selectedLists"
        :selected-candidates="selectedCandidates"
        :is-o-d-n="localIsODN"
        @clear-all="handleClearAll"
        @remove-party="handleRemoveParty"
        @remove-search="handleRemoveSearch"
        @remove-selections="clearSelection"
      />

      <!-- Results count -->
      <div class="results-count" role="status" aria-live="polite">
        <span v-if="showLists">
          Mostrando {{ filteredLists.length }} de {{ lists.length }} listas
        </span>
        <span v-else>
          Mostrando {{ filteredCandidates.length }} candidatos
        </span>
      </div>

      <!-- Lists or Candidates grid -->
      <ListGrid
        v-if="showLists"
        :lists="lists"
        :selected-lists="selectedLists"
        :filtered-lists="filteredLists"
        :disable-selection="selectedCandidates.length > 0"
        @update:selected-lists="onListsUpdate"
        @update:search-query="onSearchQueryUpdate"
      />

      <CandidateGrid
        v-else
        :filtered-candidates="filteredCandidates"
        :selected-candidates="selectedCandidates"
        :disable-selection="selectedLists.length > 0"
        @update:selected-candidates="onCandidatesUpdate"
      />

      <!-- Clear selection button -->
      <div class="clear-section">
        <button
          @click="clearSelection"
          :disabled="selectedLists.length === 0 && selectedCandidates.length === 0"
          class="clear-button"
          aria-label="Limpiar seleccion"
        >
          Limpiar seleccion
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useElectoralFilters } from '@/composables/useElectoralFilters';
import DataSourceToggle from './DataSourceToggle.vue';
import PartyFilter from './PartyFilter.vue';
import ListGrid from './ListGrid.vue';
import CandidateGrid from './CandidateGrid.vue';
import ActiveFilters from './ActiveFilters.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

interface Props {
  lists: string[];
  isODN: boolean;
  isInternasElection: boolean;  // True if election has ODN/precandidatos
  partiesAbbrev: Record<string, string>;
  selectedParty: string;
  partiesByList: Record<string, string>;
  precandidatosByList: Record<string, string>;
  candidates: string[];
  candidatesByParty: Record<string, string>;
  selectedLists: string[];
  selectedCandidates: string[];
}

interface Emits {
  (e: 'update:selectedLists', value: string[]): void;
  (e: 'update:selectedCandidates', value: string[]): void;
  (e: 'updateIsODN', value: boolean): void;
  (e: 'updateSelectedParty', value: string): void;
  (e: 'listsSelected', value: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local state
const localIsODN = ref(props.isODN);
const showLists = ref(true);
const isLoading = ref(false);

const selectorOptions = [
  { value: true, label: 'Listas' },
  { value: false, label: 'Candidatos' },
];

// Use electoral filters composable with computed props for reactivity
const {
  searchQuery,
  selectedParty,
  filteredLists,
  uniqueParties,
  filteredCandidates,
  filterLists,
} = useElectoralFilters({
  lists: computed(() => props.lists),
  candidates: computed(() => props.candidates),
  partiesAbbrev: computed(() => props.partiesAbbrev),
  partiesByList: computed(() => props.partiesByList),
  candidatesByParty: computed(() => props.candidatesByParty),
});

// Initialize selected party from props
selectedParty.value = props.selectedParty;

// Keep local selectedParty in sync with props
watch(
  () => props.selectedParty,
  (newValue) => {
    selectedParty.value = newValue;
  }
);

// Event handlers
const onDataSourceToggle = () => {
  emit('updateIsODN', localIsODN.value);
};

const handleSelectorToggle = (value: boolean) => {
  showLists.value = value;
  if (showLists.value) {
    emit('update:selectedCandidates', []);
  } else {
    emit('update:selectedLists', []);
  }
};

const onPartySelect = () => {
  emit('updateSelectedParty', selectedParty.value);
  // Clear selected lists/candidates when party changes to avoid confusion
  emit('update:selectedLists', []);
  emit('update:selectedCandidates', []);
  filterLists();
};

const onListsUpdate = (lists: string[]) => {
  emit('update:selectedLists', lists);
};

const onCandidatesUpdate = (candidates: string[]) => {
  emit('update:selectedCandidates', candidates);
};

const onSearchQueryUpdate = (query: string) => {
  searchQuery.value = query;
};

const clearSelection = () => {
  emit('update:selectedLists', []);
  emit('update:selectedCandidates', []);
};

// ActiveFilters handlers
const handleClearAll = () => {
  selectedParty.value = '';
  searchQuery.value = '';
  emit('updateSelectedParty', '');
  emit('update:selectedLists', []);
  emit('update:selectedCandidates', []);
};

const handleRemoveParty = () => {
  selectedParty.value = '';
  emit('updateSelectedParty', '');
  emit('update:selectedLists', []);
  emit('update:selectedCandidates', []);
};

const handleRemoveSearch = () => {
  searchQuery.value = '';
};

// Watchers
watch(
  () => props.lists,
  async (newLists, oldLists) => {
    // Show loading when lists change
    if (oldLists && oldLists.length > 0 && newLists.length === 0) {
      isLoading.value = true;
    }

    if (newLists.length > 0) {
      isLoading.value = false;
    }

    if (newLists.length !== props.lists.length) {
      emit('update:selectedLists', []);
    }
    filterLists();
    emit('listsSelected', props.selectedLists);
  },
  { immediate: true }
);

watch(
  () => props.isODN,
  (newValue) => {
    localIsODN.value = newValue;
  }
);

watch(filteredLists, () => {
  emit('listsSelected', props.selectedLists);
});

onMounted(() => {
  isLoading.value = props.lists.length === 0;
  filterLists();
});
</script>

<style scoped>
.list-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
}

.selector-content {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

/* Section styling */
.selector-toggle-section {
  background: var(--color-bg, #f5f5f5);
  border-radius: var(--radius-md, 10px);
  padding: 0.875rem;
}

.section-label {
  margin: 0 0 0.5rem;
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: 600;
  color: var(--color-text, #1a1a1a);
}

/* Toggle group */
.toggle-group {
  display: flex;
  gap: 0.375rem;
  background: var(--color-border, #e5e5e5);
  padding: 4px;
  border-radius: var(--radius-full, 9999px);
}

.toggle-option {
  flex: 1;
  text-align: center;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-target-min, 44px);
  padding: 0.5rem 1rem;
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
  background: transparent;
  border-radius: var(--radius-full, 9999px);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.toggle-label:active {
  transform: scale(0.98);
}

.toggle-label-active {
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #1a1a1a);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Focus state for keyboard navigation */
.toggle-input:focus-visible + .toggle-label {
  outline: 3px solid var(--color-accent, #0066cc);
  outline-offset: 2px;
}

/* Results count */
.results-count {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-secondary, #666);
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--color-border, #e5e5e5);
}

/* Clear button section */
.clear-section {
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border, #e5e5e5);
}

.clear-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-target-min, 44px);
  padding: 0.75rem 1.5rem;
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: 500;
  color: var(--color-surface, #fff);
  background: var(--color-text, #1a1a1a);
  border: none;
  border-radius: var(--radius-md, 10px);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.clear-button:hover:not(:disabled) {
  background: var(--color-text-secondary, #666);
}

.clear-button:active:not(:disabled) {
  transform: scale(0.98);
}

.clear-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.clear-button:focus-visible {
  outline: 3px solid var(--color-accent, #0066cc);
  outline-offset: 2px;
}

/* Dark mode */
:root.dark .selector-toggle-section,
.dark .selector-toggle-section {
  background: var(--color-border, #2a2a2a);
}

:root.dark .toggle-group,
.dark .toggle-group {
  background: rgba(0, 0, 0, 0.3);
}

:root.dark .toggle-label-active,
.dark .toggle-label-active {
  background: var(--color-surface, #1a1a1a);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

:root.dark .clear-button,
.dark .clear-button {
  background: var(--color-surface, #1a1a1a);
  border: 1px solid var(--color-border, #2a2a2a);
}

:root.dark .clear-button:hover:not(:disabled),
.dark .clear-button:hover:not(:disabled) {
  background: var(--color-border, #2a2a2a);
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

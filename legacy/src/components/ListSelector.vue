<template>
  <div class="list-selector-wrapper">
    <div
      class="list-selector"
      :class="{ 'mobile-hidden': isMobileHidden }"
      role="region"
      aria-label="List and candidate selector"
    >
      <div class="list-selector-content">
        <!-- Data source toggle -->
        <div class="data-source-toggle">
          <h3>Orden</h3>
          <div class="toggle-container">
            <label
              v-for="option in [
                { value: false, label: 'ODD' },
                { value: true, label: 'ODN' },
              ]"
              :key="option.label"
              class="toggle-option"
            >
              <input
                type="radio"
                v-model="localIsODN"
                :value="option.value"
                @change="onDataSourceToggle"
              />
              <span class="toggle-label">{{ option.label }}</span>
            </label>
          </div>
        </div>

        <!-- Selector toggle -->
        <div v-if="localIsODN" class="selector-toggle">
          <h3>Seleccionar por</h3>
          <div class="toggle-container">
            <label
              v-for="option in [
                { value: true, label: 'Listas' },
                { value: false, label: 'Candidatos' },
              ]"
              :key="option.label"
              class="toggle-option"
            >
              <input
                type="radio"
                v-model="showLists"
                :value="option.value"
                @change="onSelectorToggle"
              />
              <span class="toggle-label">{{ option.label }}</span>
            </label>
          </div>
        </div>

        <!-- Party selector -->
        <div class="party-selector">
          <h3>Partido</h3>
          <select v-model="selectedParty" @change="onPartySelect">
            <option value="">Todos los partidos</option>
            <option v-for="party in uniqueParties" :key="party" :value="party">
              {{ party }}
            </option>
          </select>
        </div>

        <!-- Lists section -->
        <template v-if="showLists">
          <h2>Listas</h2>
          <div v-if="filteredLists.length === 0" class="no-results">
            No se encontraron listas que coincidan con la búsqueda.
          </div>
          <div class="search-bar">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar por numero de lista"
            />
          </div>
          <div class="list-options">
            <label class="list-option select-all">
              <input
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleAllLists"
              />
              <span class="list-number">Seleccionar todas las listas</span>
            </label>
            <label
              v-for="list in filteredLists"
              :key="list"
              class="list-option"
              v-memo="[list, props.selectedLists.includes(list)]"
            >
              <input
                type="checkbox"
                :value="list"
                :checked="props.selectedLists.includes(list)"
                @change="(e) => onListSelect(list, (e.target as HTMLInputElement).checked)"
              />
              <span class="list-number">Lista {{ parseInt(list) }}</span>
            </label>
          </div>
        </template>

        <!-- Candidates section -->
        <template v-else>
          <h2>Candidatos</h2>
          <div v-if="filteredCandidates.length === 0" class="no-results">
            No se encontraron candidatos para el partido seleccionado.
          </div>
          <div class="list-options">
            <label
              v-for="candidate in filteredCandidates"
              :key="candidate"
              class="list-option"
              v-memo="[candidate, props.selectedCandidates.includes(candidate)]"
            >
              <input
                type="checkbox"
                :value="candidate"
                :checked="props.selectedCandidates.includes(candidate)"
                @change="(e) => onCandidateSelect(candidate, (e.target as HTMLInputElement).checked)"
              />
              <span class="list-number">{{ candidate }}</span>
            </label>
          </div>
        </template>

        <!-- Clear selection button -->
        <div class="clear-selection">
          <button
            @click="clearSelection"
            :disabled="
              props.selectedLists.length === 0 &&
              props.selectedCandidates.length === 0
            "
          >
            Limpiar selección
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile toggle -->
    <div
      class="mobile-toggle"
      @click="toggleMobileVisibility"
      @keydown.enter="toggleMobileVisibility"
      role="button"
      tabindex="0"
      aria-label="Toggle list selector visibility"
    >
      <a class="mobile-toggle-text">Ver listas, partidos y ordenes</a>
      <span
        class="arrow"
        :class="{ 'arrow-up': !isMobileHidden, 'arrow-down': isMobileHidden }"
      ></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { useDebounce } from "@vueuse/core";

// Step 1: Define interfaces for props and emits
interface Props {
  lists: string[];
  isODN: boolean;
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
  (e: "update:selectedLists", value: string[]): void;
  (e: "update:selectedCandidates", value: string[]): void;
  (e: "updateIsODN", value: boolean): void;
  (e: "updateSelectedParty", value: string): void;
  (e: "listsSelected", value: string[]): void;
}

// Step 2: Use composition API with better type inference
const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Refs
const searchQuery = ref("");
const filteredLists = ref<string[]>([]);
const isMobileHidden = ref(true);
const localIsODN = ref(props.isODN);
const showLists = ref(true);
const selectedParty = ref(props.selectedParty);

// Step 3: Organize computed properties
const uniqueParties = computed(() => {
  return Object.keys(props.partiesAbbrev)
    .map((party) => (party.startsWith("Partido ") ? party : `Partido ${party}`))
    .sort();
});

const filteredListsByParty = computed(() => {
  if (!selectedParty.value) return props.lists;

  const selectedPartyName = selectedParty.value.replace("Partido ", "");

  return props.lists.filter(
    (list) => props.partiesByList[list] === selectedPartyName
  );
});

const filteredCandidates = computed(() => {
  if (!selectedParty.value) return props.candidates;

  const selectedPartyName = selectedParty.value.replace("Partido ", "");

  return props.candidates.filter(
    (candidate) => props.candidatesByParty[candidate] === selectedPartyName
  );
});

const isAllSelected = computed(() => {
  return (
    filteredLists.value.length > 0 &&
    props.selectedLists.length === filteredLists.value.length
  );
});

// Methods
const filterLists = () => {
  const validLists = filteredListsByParty.value.filter(
    (list) => list !== undefined && list !== null
  );

  filteredLists.value = searchQuery.value
    ? validLists.filter((list) => list.includes(searchQuery.value.trim()))
    : validLists;
};

const toggleAllLists = () => {
  const currentSelectedLists = new Set(props.selectedLists);
  const filteredListsSet = new Set(filteredLists.value);

  const newSelectedLists = isAllSelected.value
    ? props.selectedLists.filter((list) => !filteredListsSet.has(list))
    : Array.from(new Set([...currentSelectedLists, ...filteredLists.value]));

  emit("update:selectedLists", newSelectedLists);
};

// Step 4: Use proper typing for event handlers
const onListSelect = (list: string, isSelected: boolean) => {
  if (props.selectedCandidates.length > 0) return;

  const newSelectedLists = isSelected
    ? [...props.selectedLists, list]
    : props.selectedLists.filter((item) => item !== list);
  emit("update:selectedLists", newSelectedLists);
};

const onDataSourceToggle = () => {
  emit("updateIsODN", localIsODN.value);
};

const onSelectorToggle = () => {
  if (showLists.value) {
    emit("update:selectedCandidates", []);
  } else {
    emit("update:selectedLists", []);
  }
};

const toggleMobileVisibility = () => {
  isMobileHidden.value = !isMobileHidden.value;
};

const onPartySelect = () => {
  emit("updateSelectedParty", selectedParty.value);
  filterLists();
};

const onCandidateSelect = (candidate: string, isSelected: boolean) => {
  if (props.selectedLists.length > 0) return;

  const newSelectedCandidates = isSelected
    ? [...props.selectedCandidates, candidate]
    : props.selectedCandidates.filter((item) => item !== candidate);
  emit("update:selectedCandidates", newSelectedCandidates);
};

const clearSelection = () => {
  emit("update:selectedLists", []);
  emit("update:selectedCandidates", []);
};

// Step 5: Improve watch functions
const debouncedSearchQuery = useDebounce(searchQuery, 300);

watch(debouncedSearchQuery, filterLists);

watch(
  () => filteredListsByParty.value,
  (newFilteredLists) => {
    filteredLists.value = newFilteredLists;
    emit("listsSelected", props.selectedLists);
  }
);

watch(
  () => props.lists,
  (newLists) => {
    if (newLists.length !== props.lists.length) {
      emit("update:selectedLists", []);
    }
    filterLists();
    emit("listsSelected", props.selectedLists);
  },
  { immediate: true }
);

watch(
  () => props.isODN,
  (newValue) => {
    localIsODN.value = newValue;
  }
);

watch([() => searchQuery.value, () => selectedParty.value], filterLists);

onMounted(() => {
  filterLists();
  toggleMobileVisibility();
});
</script>

<style scoped>
.list-selector-wrapper {
  position: relative;
}

.list-selector {
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px 8px 0 0;
  padding: 20px;
  width: 100%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: auto;
  overflow-y: auto;
  transition: transform 0.3s ease-in-out;
  z-index: var(--z-dropdown);
}

@media (max-width: 767px) {
  .list-selector {
    position: fixed;
    top: 140px; /* Adjusted to account for the header */
    left: 0;
    right: 0;
    height: calc(70vh - 40px);
    transform: translateY(-100%);
  }

  .list-selector.mobile-hidden {
    transform: translateY(0);
  }

  .mobile-toggle {
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    position: fixed;
    left: 0;
    right: 0;
    background-color: white;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
    z-index: var(--z-modal);
  }

  .mobile-toggle-text {
    font-size: 1.2rem;
    font-weight: bold;
    color: #333;
    margin-right: 10px;
  }

  .arrow {
    width: 0;
    height: 0;
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    transition: transform 0.3s ease-in-out;
  }

  .arrow-up {
    border-bottom: 12px solid #333;
  }

  .arrow-down {
    border-top: 12px solid #333;
  }

  .list-selector-content {
    overflow-y: auto;
    height: calc(100% - 40px);
  }
}

@media (min-width: 768px) {
  .list-selector {
    height: 100%;
  }

  .mobile-toggle {
    display: none;
  }
}

h2 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.4rem;
  color: #333;
}

.search-bar {
  margin-bottom: 20px;
}

.search-bar input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.list-options {
  flex-grow: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.list-option {
  display: flex;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  transition: background-color 0.2s;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.list-option:hover {
  background-color: #f5f5f5;
}

.list-option input[type="checkbox"] {
  margin-right: 10px;
}

.list-number {
  font-size: 1rem;
  color: #555;
}

.data-source-toggle {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f0f0f0;
  border-radius: 8px;
}

.data-source-toggle h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1.2rem;
  color: #333;
}

.toggle-container {
  display: flex;
  justify-content: space-around;
  background-color: #e0e0e0;
  border-radius: 20px;
  padding: 4px;
}

.toggle-option {
  flex: 1;
  text-align: center;
}

.toggle-option input[type="radio"] {
  display: none;
}

.toggle-label {
  display: block;
  padding: 8px 16px;
  border-radius: 16px;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
}

.toggle-option input[type="radio"]:checked + .toggle-label {
  background-color: #333;
  color: white;
}

@media (max-width: 767px) {
  .data-source-toggle {
    background-color: rgba(255, 255, 255, 0.9);
    padding: 10px;
    border-radius: 8px 8px 0 0;
  }
}

.party-selector {
  margin-bottom: 20px;
}

.party-selector h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1.2rem;
  color: #333;
}

.party-selector select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  background-color: white;
}

.select-all {
  grid-column: 1 / -1;
  background-color: #f0f0f0;
  font-weight: bold;
}

.selector-toggle {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f0f0f0;
  border-radius: 8px;
}

.selector-toggle h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1.2rem;
  color: #333;
}

.no-results {
  text-align: center;
  color: #777;
  margin-bottom: 20px;
}

.clear-selection {
  margin-top: 20px;
  text-align: center;
}

.clear-selection button {
  padding: 10px 20px;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.clear-selection button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style>

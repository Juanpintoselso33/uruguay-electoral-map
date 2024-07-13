<template>
  <div class="list-selector-wrapper">
    <div class="list-selector" :class="{ 'mobile-hidden': isMobileHidden }">
      <div class="list-selector-content">
        <div class="data-source-toggle">
          <h3>Orden</h3>
          <div class="toggle-container">
            <label class="toggle-option">
              <input
                type="radio"
                v-model="localIsODN"
                :value="false"
                @change="onDataSourceToggle"
              />
              <span class="toggle-label">ODD</span>
            </label>
            <label class="toggle-option">
              <input
                type="radio"
                v-model="localIsODN"
                :value="true"
                @change="onDataSourceToggle"
              />
              <span class="toggle-label">ODN</span>
            </label>
          </div>
        </div>
        <div v-if="localIsODN" class="selector-toggle">
          <h3>Seleccionar por</h3>
          <div class="toggle-container">
            <label class="toggle-option">
              <input
                type="radio"
                v-model="showLists"
                :value="true"
                @change="onSelectorToggle"
              />
              <span class="toggle-label">Listas</span>
            </label>
            <label class="toggle-option">
              <input
                type="radio"
                v-model="showLists"
                :value="false"
                @change="onSelectorToggle"
              />
              <span class="toggle-label">Candidatos</span>
            </label>
          </div>
        </div>
        <div class="party-selector">
          <h3>Partido</h3>
          <select v-model="selectedParty" @change="onPartySelect">
            <option value="">Todos los partidos</option>
            <option v-for="party in uniqueParties" :key="party" :value="party">
              {{ party }}
            </option>
          </select>
        </div>
        <template v-if="showLists">
          <h2>Listas</h2>
          <div class="search-bar">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar por numero de lista"
              @input="filterLists"
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
            >
              <input
                type="checkbox"
                :value="list"
                :checked="selectedLists.includes(list)"
                @change="(e) => onListSelect(list, e.target.checked)"
              />
              <span class="list-number">Lista {{ parseInt(list) }}</span>
            </label>
          </div>
        </template>
        <template v-else>
          <h2>Candidatos</h2>
          <div class="list-options">
            <label
              v-for="candidate in filteredCandidates"
              :key="candidate"
              class="list-option"
            >
              <input
                type="checkbox"
                :value="candidate"
                :checked="selectedCandidates.includes(candidate)"
                @change="(e) => onCandidateSelect(candidate, e.target.checked)"
              />
              <span class="list-number">{{ candidate }}</span>
            </label>
          </div>
        </template>
      </div>
    </div>
    <div class="mobile-toggle" @click="toggleMobileVisibility">
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

const props = defineProps<{
  lists: Array<string>;
  isODN: boolean;
  partiesAbbrev: Record<string, string>;
  selectedParty: string;
  partiesByList: Record<string, string>;
  precandidatosByList: Record<string, string>;
  candidates: Array<string>;
  candidatesByParty: Record<string, string>;
}>();

const emit = defineEmits([
  "listsSelected",
  "updateIsODN",
  "updateSelectedParty",
  "candidatesSelected",
]);

const selectedLists = ref<string[]>([]);
const searchQuery = ref("");
const filteredLists = ref<string[]>([]);
const isMobileHidden = ref(true);
const localIsODN = ref(props.isODN);
const showLists = ref(true);

const selectedCandidates = ref<string[]>([]);

const selectedParty = ref(props.selectedParty);
const uniqueParties = computed(() => {
  return Object.keys(props.partiesAbbrev)
    .map((party) => (party.startsWith("Partido ") ? party : `Partido ${party}`))
    .sort();
});

const filteredListsByParty = computed(() => {
  if (!selectedParty.value) return props.lists;

  const selectedPartyName = selectedParty.value.replace("Partido ", "");

  return props.lists.filter((list) => {
    if (!list || typeof list !== "string") {
      return false;
    }

    const listParty = props.partiesByList[list];

    return listParty === selectedPartyName;
  });
});

const filteredCandidates = computed(() => {
  if (!selectedParty.value) return props.candidates;

  const selectedPartyName = selectedParty.value.replace("Partido ", "");

  return props.candidates.filter((candidate) => {
    return props.candidatesByParty[candidate] === selectedPartyName;
  });
});

const filterLists = () => {
  try {
    if (
      !filteredListsByParty.value ||
      filteredListsByParty.value.length === 0
    ) {
      filteredLists.value = [];
      return;
    }

    const validLists = filteredListsByParty.value.filter(
      (list) => list !== undefined && list !== null
    );

    if (!searchQuery.value) {
      filteredLists.value = validLists;
    } else {
      filteredLists.value = validLists.filter((list) =>
        list.includes(searchQuery.value.trim())
      );
    }
  } catch (error) {
    console.error("Error in filterLists:", error);
    console.error("Error stack:", error.stack);
  }
};

const isAllSelected = computed(() => {
  return (
    filteredLists.value.length > 0 &&
    selectedLists.value.length === filteredLists.value.length
  );
});

const toggleAllLists = () => {
  if (isAllSelected.value) {
    selectedLists.value = [];
  } else {
    selectedLists.value = [...filteredLists.value];
  }
  emit("listsSelected", selectedLists.value);
};

const debouncedFilterLists = useDebounce(filterLists, 300);

const onListSelect = (list: string, isSelected: boolean) => {
  if (isSelected) {
    selectedLists.value.push(list);
  } else {
    selectedLists.value = selectedLists.value.filter((item) => item !== list);
  }
  emit("listsSelected", selectedLists.value);
};

const onDataSourceToggle = () => {
  emit("updateIsODN", localIsODN.value);
};

const onSelectorToggle = () => {
  if (showLists.value) {
    selectedCandidates.value = [];
  } else {
    selectedLists.value = [];
  }
  emit("listsSelected", selectedLists.value);
  emit("candidatesSelected", selectedCandidates.value);
};

const toggleMobileVisibility = () => {
  isMobileHidden.value = !isMobileHidden.value;
};

const onPartySelect = () => {
  try {
    emit("updateSelectedParty", selectedParty.value);
    filterLists();
    // Reset selected candidates when changing party
    selectedCandidates.value = [];
    emit("candidatesSelected", selectedCandidates.value);
  } catch (error) {
    console.error("Error in onPartySelect:", error);
  }
};

const onCandidateSelect = (candidate: string, isSelected: boolean) => {
  if (isSelected) {
    selectedCandidates.value.push(candidate);
  } else {
    selectedCandidates.value = selectedCandidates.value.filter(
      (item) => item !== candidate
    );
  }
  emit("candidatesSelected", selectedCandidates.value);
};

watch(
  () => filteredListsByParty.value,
  (newFilteredLists) => {
    filteredLists.value = newFilteredLists;
  }
);

watch(
  () => props.lists,
  (newLists) => {
    if (newLists.length !== props.lists.length) {
      selectedLists.value = [];
    }
    filterLists();
    emit("listsSelected", selectedLists.value);
  },
  { immediate: true }
);

watch(
  () => props.isODN,
  (newValue) => {
    localIsODN.value = newValue;
  }
);

watch(
  () => searchQuery.value,
  () => {
    debouncedFilterLists();
  }
);

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
  z-index: 999;
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
    z-index: 1001;
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
</style>

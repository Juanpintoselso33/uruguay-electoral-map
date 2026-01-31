<template>
  <div class="relative">
    <!-- Main selector panel -->
    <div
      class="bg-white border border-gray-200 rounded-t-lg p-5 w-full shadow-md flex flex-col h-auto overflow-y-auto transition-transform duration-300 ease-in-out z-[999]"
      :class="{ 'mobile-hidden': isMobileHidden }"
      role="region"
      aria-label="List and candidate selector"
    >
      <div class="list-selector-content">
        <!-- Data source toggle (ODD/ODN) -->
        <DataSourceToggle v-model="localIsODN" @update:modelValue="onDataSourceToggle" />

        <!-- Selector toggle (Lists/Candidates) - ODN only -->
        <div v-if="localIsODN" class="bg-gray-100 rounded-lg p-4 mb-5">
          <h3 class="mt-0 mb-2.5 text-lg text-gray-800">Seleccionar por</h3>
          <div class="flex justify-around bg-gray-300 rounded-full p-1">
            <label
              v-for="option in selectorOptions"
              :key="option.label"
              class="flex-1 text-center"
            >
              <input
                type="radio"
                :value="option.value"
                :checked="showLists === option.value"
                @change="handleSelectorToggle(option.value)"
                class="hidden"
              />
              <span
                class="block py-2 px-4 rounded-2xl cursor-pointer transition-all duration-300"
                :class="
                  showLists === option.value
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-800'
                "
              >
                {{ option.label }}
              </span>
            </label>
          </div>
        </div>

        <!-- Party filter -->
        <PartyFilter v-model="selectedParty" :parties="uniqueParties" @update:modelValue="onPartySelect" />

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
        <div class="mt-5 text-center">
          <button
            @click="clearSelection"
            :disabled="selectedLists.length === 0 && selectedCandidates.length === 0"
            class="py-2.5 px-5 bg-gray-800 text-white border-none rounded cursor-pointer transition-all disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700"
          >
            Limpiar selección
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile toggle button -->
    <div
      class="mobile-toggle h-10 flex justify-center items-center cursor-pointer fixed left-0 right-0 bg-white rounded-b-lg shadow-md z-[1001]"
      @click="toggleMobileVisibility"
      @keydown.enter="toggleMobileVisibility"
      role="button"
      tabindex="0"
      aria-label="Toggle list selector visibility"
    >
      <a class="text-lg font-bold text-gray-800 mr-2.5">Ver listas, partidos y ordenes</a>
      <span
        class="arrow w-0 h-0 transition-transform duration-300 ease-in-out"
        :class="{
          'border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[12px] border-b-gray-800': !isMobileHidden,
          'border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-gray-800': isMobileHidden,
        }"
      ></span>
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
  (e: 'update:selectedLists', value: string[]): void;
  (e: 'update:selectedCandidates', value: string[]): void;
  (e: 'updateIsODN', value: boolean): void;
  (e: 'updateSelectedParty', value: string): void;
  (e: 'listsSelected', value: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local state
const isMobileHidden = ref(true);
const localIsODN = ref(props.isODN);
const showLists = ref(true);

const selectorOptions = [
  { value: true, label: 'Listas' },
  { value: false, label: 'Candidatos' },
];

// Use electoral filters composable
const {
  searchQuery,
  selectedParty,
  filteredLists,
  uniqueParties,
  filteredCandidates,
  filterLists,
} = useElectoralFilters({
  lists: props.lists,
  candidates: props.candidates,
  partiesAbbrev: props.partiesAbbrev,
  partiesByList: props.partiesByList,
  candidatesByParty: props.candidatesByParty,
});

// Initialize selected party from props
selectedParty.value = props.selectedParty;

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

const toggleMobileVisibility = () => {
  isMobileHidden.value = !isMobileHidden.value;
};

const onPartySelect = () => {
  emit('updateSelectedParty', selectedParty.value);
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

// Watchers
watch(
  () => props.lists,
  (newLists) => {
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
  filterLists();
  toggleMobileVisibility();
});
</script>

<style scoped>
@media (max-width: 767px) {
  .bg-white {
    position: fixed;
    top: 140px;
    left: 0;
    right: 0;
    height: calc(70vh - 40px);
    transform: translateY(-100%);
  }

  .bg-white.mobile-hidden {
    transform: translateY(0);
  }

  .mobile-toggle {
    display: flex;
  }

  .list-selector-content {
    overflow-y: auto;
    height: calc(100% - 40px);
  }
}

@media (min-width: 768px) {
  .bg-white {
    height: 100%;
  }

  .mobile-toggle {
    display: none;
  }
}
</style>

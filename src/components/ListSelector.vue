<template>
  <div class="list-selector" :class="{ 'mobile-hidden': isMobileHidden }">
    <div class="mobile-toggle" @click="toggleMobileVisibility">
      <span
        class="arrow"
        :class="{ 'arrow-up': !isMobileHidden, 'arrow-down': isMobileHidden }"
      ></span>
    </div>
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
      <div class="party-selector">
        <h3>Partido</h3>
        <select v-model="selectedParty" @change="onPartySelect">
          <option value="">Todos los partidos</option>
          <option v-for="party in uniqueParties" :key="party" :value="party">
            {{ party }}
          </option>
        </select>
      </div>
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
        <label v-for="list in filteredLists" :key="list" class="list-option">
          <input
            type="checkbox"
            :value="list"
            :checked="selectedLists.includes(list)"
            @change="(e) => onListSelect(list, e.target.checked)"
          />
          <span class="list-number">Lista {{ parseInt(list) }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";

const props = defineProps<{
  lists: Array<string>;
  isODN: boolean;
  partiesAbbrev: Record<string, string>;
  selectedParty: string;
  partiesByList: Record<string, string>;
}>();

const emit = defineEmits([
  "listsSelected",
  "updateIsODN",
  "updateSelectedParty",
]);

const selectedLists = ref<string[]>([]);
const searchQuery = ref("");
const filteredLists = ref<string[]>([]);
const isMobileHidden = ref(true);
const localIsODN = ref(props.isODN);

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

const toggleMobileVisibility = () => {
  isMobileHidden.value = !isMobileHidden.value;
};

const onPartySelect = () => {
  try {
    emit("updateSelectedParty", selectedParty.value);
    filterLists();
  } catch (error) {
    console.error("Error in onPartySelect:", error);
  }
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
    // Only clear selectedLists if the data source (ODN/ODD) has changed
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
    filterLists();
  }
);

onMounted(() => {
  filterLists();
});
</script>

<style scoped>
.list-selector {
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  width: 100%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: 30vh;
  overflow-y: auto;
  transition: transform 0.3s ease-in-out;
}

@media (max-width: 767px) {
  .list-selector {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    border-radius: 8px 8px 0 0;
    height: 70vh;
  }

  .mobile-hidden {
    transform: translateY(calc(100% - 40px));
  }

  .mobile-toggle {
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }

  .arrow {
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    transition: transform 0.3s ease-in-out;
  }

  .arrow-up {
    border-bottom: 8px solid #333;
    transform: rotate(180deg);
  }

  .arrow-down {
    border-top: 8px solid #333;
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
</style>

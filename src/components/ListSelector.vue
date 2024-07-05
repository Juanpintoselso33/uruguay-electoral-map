<template>
  <div class="list-selector">
    <h2>Select Lists</h2>
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by list number"
        @input="filterLists"
      />
    </div>
    <div class="list-options">
      <label v-for="list in filteredLists" :key="list" class="list-option">
        <input
          type="checkbox"
          :value="list"
          v-model="selectedLists"
          @change="onListSelect"
        />
        <span class="list-number">Lista {{ parseInt(list) }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";

const props = defineProps<{
  lists: Array<string>;
}>();

const emit = defineEmits(["listsSelected"]);

const selectedLists = ref<string[]>([]);
const searchQuery = ref("");
const filteredLists = ref<string[]>([]);

const filterLists = () => {
  if (!props.lists) {
    filteredLists.value = [];
    return;
  }
  const validLists = props.lists.filter((list) => list !== undefined);
  if (!searchQuery.value) {
    filteredLists.value = validLists;
  } else {
    filteredLists.value = validLists.filter((list) =>
      list.includes(searchQuery.value.trim())
    );
  }
};

const onListSelect = () => {
  emit("listsSelected", selectedLists.value);
};

watch(
  () => props.lists,
  (newLists) => {
    selectedLists.value = [];
    filterLists();
  },
  { immediate: true }
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
}

@media (min-width: 768px) {
  .list-selector {
    height: 100%;
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
</style>

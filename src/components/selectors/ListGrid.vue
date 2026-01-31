<template>
  <div>
    <h2 class="mt-0 mb-5 text-xl text-gray-800">Listas</h2>

    <div v-if="filteredLists.length === 0" class="text-center text-gray-500 mb-5">
      No se encontraron listas que coincidan con la búsqueda.
    </div>

    <div class="mb-5">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar por numero de lista"
        class="w-full p-2.5 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all"
      />
    </div>

    <div class="flex-grow overflow-y-auto grid grid-cols-2 gap-2.5">
      <!-- Select all checkbox -->
      <label
        class="flex items-center p-2.5 cursor-pointer transition-colors border border-gray-200 rounded hover:bg-gray-100 col-span-2 bg-gray-100 font-bold"
      >
        <input
          type="checkbox"
          :checked="isAllSelected"
          @change="handleToggleAll"
          class="mr-2.5"
        />
        <span class="text-base text-gray-600">Seleccionar todas las listas</span>
      </label>

      <!-- Individual list checkboxes -->
      <label
        v-for="list in filteredLists"
        :key="list"
        class="flex items-center p-2.5 cursor-pointer transition-colors border border-gray-200 rounded hover:bg-gray-100"
        v-memo="[list, selectedLists.includes(list)]"
      >
        <input
          type="checkbox"
          :value="list"
          :checked="selectedLists.includes(list)"
          @change="(e) => handleListSelect(list, (e.target as HTMLInputElement).checked)"
          class="mr-2.5"
        />
        <span class="text-base text-gray-600">Lista {{ parseInt(list) }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  lists: string[];
  selectedLists: string[];
  filteredLists: string[];
  disableSelection?: boolean;
}

interface Emits {
  (e: 'update:selectedLists', value: string[]): void;
  (e: 'update:searchQuery', value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  disableSelection: false,
});

const emit = defineEmits<Emits>();

const searchQuery = ref('');

const isAllSelected = computed(() => {
  return (
    props.filteredLists.length > 0 &&
    props.selectedLists.length === props.filteredLists.length
  );
});

const handleListSelect = (list: string, isSelected: boolean) => {
  if (props.disableSelection) return;

  const newSelectedLists = isSelected
    ? [...props.selectedLists, list]
    : props.selectedLists.filter((item) => item !== list);

  emit('update:selectedLists', newSelectedLists);
};

const handleToggleAll = () => {
  const currentSelectedLists = new Set(props.selectedLists);
  const filteredListsSet = new Set(props.filteredLists);

  const newSelectedLists = isAllSelected.value
    ? props.selectedLists.filter((list) => !filteredListsSet.has(list))
    : Array.from(new Set([...currentSelectedLists, ...props.filteredLists]));

  emit('update:selectedLists', newSelectedLists);
};

watch(searchQuery, (newValue) => {
  emit('update:searchQuery', newValue);
});
</script>

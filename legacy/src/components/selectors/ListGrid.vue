<template>
  <div>
    <h2 class="mt-0 mb-2 text-lg text-gray-800">Listas</h2>

    <div v-if="filteredLists.length === 0" class="text-center text-gray-500 text-sm mb-3">
      No se encontraron listas que coincidan con la búsqueda.
    </div>

    <div class="mb-3">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar por numero de lista"
        class="w-full p-3 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all"
        style="min-height: var(--touch-target-min);"
        aria-label="Buscar listas por número"
      />
    </div>

    <div
      ref="gridContainer"
      class="flex-grow overflow-y-auto grid grid-cols-2 gap-1.5 max-h-96"
      role="group"
      aria-label="Lista de listas electorales"
    >
      <!-- Select all checkbox -->
      <label
        class="flex items-center p-3 text-sm cursor-pointer transition-colors border border-gray-200 rounded hover:bg-gray-100 col-span-2 bg-gray-100 font-bold focus-within:ring-2 focus-within:ring-gray-400 active:scale-98"
        style="min-height: var(--touch-target-min); user-select: none; -webkit-tap-highlight-color: transparent;"
      >
        <input
          type="checkbox"
          :checked="isAllSelected"
          @change="handleToggleAll"
          @keydown.enter.prevent="handleToggleAll"
          class="mr-2 w-5 h-5"
          style="min-width: 20px; min-height: 20px;"
          aria-label="Seleccionar todas las listas"
        />
        <span class="text-sm text-gray-600">Seleccionar todas</span>
      </label>

      <!-- Individual list checkboxes -->
      <label
        v-for="list in filteredLists"
        :key="list"
        class="flex items-center p-3 text-sm cursor-pointer transition-colors border border-gray-200 rounded hover:bg-gray-100 focus-within:ring-2 focus-within:ring-gray-400 active:scale-98"
        style="min-height: var(--touch-target-min); user-select: none; -webkit-tap-highlight-color: transparent;"
        v-memo="[list, selectedLists.includes(list)]"
      >
        <input
          type="checkbox"
          :value="list"
          :checked="selectedLists.includes(list)"
          @change="(e) => handleListSelect(list, (e.target as HTMLInputElement).checked)"
          @keydown.enter.prevent="(e) => {
            const target = e.target as HTMLInputElement;
            target.checked = !target.checked;
            handleListSelect(list, target.checked);
          }"
          class="mr-2 w-5 h-5"
          style="min-width: 20px; min-height: 20px;"
          :aria-label="`Lista ${list}`"
        />
        <span class="text-sm text-gray-600">Lista {{ list }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';
import { useScreenReaderAnnouncements } from '@/composables/useScreenReaderAnnouncements';

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
const gridContainer = ref<HTMLElement>();

// Screen reader announcements
const { announceListSelection, announceMultipleListsSelection } = useScreenReaderAnnouncements()

// Keyboard navigation for grid (2 columns)
useKeyboardNavigation({
  gridNavigation: {
    container: gridContainer,
    columns: 2
  }
});

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

  // Announce to screen readers
  announceListSelection(list, isSelected)

  emit('update:selectedLists', newSelectedLists);
};

const handleToggleAll = () => {
  const currentSelectedLists = new Set(props.selectedLists);
  const filteredListsSet = new Set(props.filteredLists);

  const newSelectedLists = isAllSelected.value
    ? props.selectedLists.filter((list) => !filteredListsSet.has(list))
    : Array.from(new Set([...currentSelectedLists, ...props.filteredLists]));

  // Announce to screen readers
  const action = isAllSelected.value ? 'deselected' : 'selected'
  announceMultipleListsSelection(props.filteredLists.length, action)

  emit('update:selectedLists', newSelectedLists);
};

watch(searchQuery, (newValue) => {
  emit('update:searchQuery', newValue);
});
</script>

<style scoped>
/* Touch feedback for checkboxes */
label:active {
  transform: scale(0.98);
}

label {
  transition: all 0.2s ease;
}

/* Larger checkboxes for better touch targets */
input[type="checkbox"] {
  cursor: pointer;
  accent-color: #1f2937; /* gray-800 */
}
</style>

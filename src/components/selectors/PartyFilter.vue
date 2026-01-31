<template>
  <div class="mb-3">
    <h3 class="mt-0 mb-1.5 text-base text-gray-800">Partido</h3>
    <select
      ref="selectElement"
      :value="modelValue"
      @change="handleChange"
      @keydown.escape="clearSelection"
      class="w-full p-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all"
      aria-label="Filtrar por partido político"
    >
      <option value="">Todos los partidos</option>
      <option v-for="party in parties" :key="party" :value="party">
        {{ party }}
      </option>
    </select>
    <div v-if="modelValue" class="text-xs text-gray-500 mt-1">
      Presiona Escape para limpiar el filtro
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useScreenReaderAnnouncements } from '@/composables/useScreenReaderAnnouncements';

interface Props {
  modelValue: string;
  parties: string[];
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const selectElement = ref<HTMLSelectElement>();

// Screen reader announcements
const { announceFilterApplied } = useScreenReaderAnnouncements()

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const newValue = target.value;

  // Announce to screen readers
  announceFilterApplied('partido', newValue || 'Todos los partidos')

  emit('update:modelValue', newValue);
};

const clearSelection = () => {
  if (props.modelValue) {
    announceFilterApplied('partido', '')
    emit('update:modelValue', '');
  }
};
</script>

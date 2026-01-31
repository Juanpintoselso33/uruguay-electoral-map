<template>
  <div class="mb-5">
    <h3 class="mt-0 mb-2.5 text-lg text-gray-800">Partido</h3>
    <select
      :value="modelValue"
      @change="handleChange"
      class="w-full p-2.5 border border-gray-300 rounded bg-white text-base focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all"
    >
      <option value="">Todos los partidos</option>
      <option v-for="party in parties" :key="party" :value="party">
        {{ party }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string;
  parties: string[];
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
};
</script>

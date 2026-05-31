<script setup lang="ts">
interface Props {
  elecciones: string[];
  eleccionActual: string;
  departamento: string;
}
const props = defineProps<Props>();

const LABELS: Record<string, string> = {
  'internas-2024':   'Internas 2024',
  'nacionales-2019': 'Nacionales 2019',
};

function label(e: string): string {
  return LABELS[e] ?? e;
}
</script>

<template>
  <nav class="px-4 py-1 flex gap-3 text-sm border-b border-gray-100 bg-gray-50">
    <span class="text-gray-400 text-xs self-center">Elección:</span>
    <a
      v-for="e in elecciones"
      :key="e"
      :href="`/${e}/${departamento}`"
      :class="[
        'underline',
        e === eleccionActual ? 'font-bold text-gray-900' : 'text-gray-500',
      ]"
    >{{ label(e) }}</a>
  </nav>
</template>

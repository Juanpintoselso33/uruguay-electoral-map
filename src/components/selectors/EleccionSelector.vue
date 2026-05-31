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
  <nav class="px-4 py-1 flex gap-3 text-sm border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
    <span class="text-gray-400 dark:text-slate-400 text-xs self-center">Elección:</span>
    <a
      v-for="e in elecciones"
      :key="e"
      :href="`/${e}/${departamento}`"
      :class="[
        'underline',
        e === eleccionActual
          ? 'font-bold text-gray-900 dark:text-slate-100'
          : 'text-gray-500 dark:text-slate-400',
      ]"
    >{{ label(e) }}</a>
  </nav>
</template>

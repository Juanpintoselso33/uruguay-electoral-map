<script setup lang="ts">
/**
 * Controles de comparación dual entre elecciones (Story 4.3).
 *
 * `client:idle`. Muestra botón entrar/salir del modo comparación.
 * Estado: $comparison.vs (URL ?vs=). Entrar → commit({ vs: otherEleccion }).
 * Solo renderiza el botón si el depto tiene ≥2 elecciones disponibles.
 */
import { onMounted, ref } from 'vue';
import { $comparison, commit } from '../../stores/map-state';

const props = defineProps<{
  availableElecciones: string[];
  eleccionActual: string;
}>();

const LABELS: Record<string, string> = {
  'internas-2024':   'Internas 2024',
  'nacionales-2019': 'Nacionales 2019',
};
function label(e: string): string { return LABELS[e] ?? e; }

const comparisonVs = ref<string | null>(null);

onMounted(() => {
  $comparison.subscribe((cmp) => {
    comparisonVs.value = cmp.vs;
  });
});

function otherEleccion(): string | null {
  return props.availableElecciones.find((e) => e !== props.eleccionActual) ?? null;
}

function enterCompare(): void {
  const other = otherEleccion();
  if (other) commit({ vs: other });
}

function exitCompare(): void {
  commit({ vs: null });
}
</script>

<template>
  <div
    v-if="availableElecciones.length > 1"
    class="px-4 py-1 flex gap-2 items-center text-sm border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
  >
    <template v-if="comparisonVs">
      <span class="text-gray-500 dark:text-slate-400 text-xs">Comparando con: <strong class="text-gray-700 dark:text-slate-300">{{ label(comparisonVs) }}</strong></span>
      <button
        class="text-xs text-blue-600 dark:text-blue-400 underline ml-2"
        type="button"
        @click="exitCompare"
      >Salir</button>
    </template>
    <template v-else-if="otherEleccion()">
      <button
        class="text-xs text-blue-600 dark:text-blue-400 underline"
        type="button"
        @click="enterCompare"
      >Comparar con {{ label(otherEleccion()!) }}</button>
    </template>
  </div>
</template>

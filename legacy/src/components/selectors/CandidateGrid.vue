<template>
  <div>
    <h2 class="mt-0 mb-5 text-xl text-gray-800">Candidatos</h2>

    <div v-if="filteredCandidates.length === 0" class="text-center text-gray-500 mb-5">
      No se encontraron candidatos para el partido seleccionado.
    </div>

    <div class="flex-grow overflow-y-auto grid grid-cols-2 gap-2.5">
      <label
        v-for="candidate in filteredCandidates"
        :key="candidate"
        class="flex items-center p-3 cursor-pointer transition-colors border border-gray-200 rounded hover:bg-gray-100 focus-within:ring-2 focus-within:ring-gray-400 active:scale-98"
        style="min-height: var(--touch-target-min); user-select: none; -webkit-tap-highlight-color: transparent;"
        v-memo="[candidate, selectedCandidates.includes(candidate)]"
      >
        <input
          type="checkbox"
          :value="candidate"
          :checked="selectedCandidates.includes(candidate)"
          @change="(e) => handleCandidateSelect(candidate, (e.target as HTMLInputElement).checked)"
          class="mr-2 w-5 h-5"
          style="min-width: 20px; min-height: 20px;"
          :aria-label="`Candidato ${candidate}`"
        />
        <span class="text-base text-gray-600">{{ candidate }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  filteredCandidates: string[];
  selectedCandidates: string[];
  disableSelection?: boolean;
}

interface Emits {
  (e: 'update:selectedCandidates', value: string[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  disableSelection: false,
});

const emit = defineEmits<Emits>();

const handleCandidateSelect = (candidate: string, isSelected: boolean) => {
  if (props.disableSelection) return;

  const newSelectedCandidates = isSelected
    ? [...props.selectedCandidates, candidate]
    : props.selectedCandidates.filter((item) => item !== candidate);

  emit('update:selectedCandidates', newSelectedCandidates);
};
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

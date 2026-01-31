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
        class="flex items-center p-2.5 cursor-pointer transition-colors border border-gray-200 rounded hover:bg-gray-100"
        v-memo="[candidate, selectedCandidates.includes(candidate)]"
      >
        <input
          type="checkbox"
          :value="candidate"
          :checked="selectedCandidates.includes(candidate)"
          @change="(e) => handleCandidateSelect(candidate, (e.target as HTMLInputElement).checked)"
          class="mr-2.5"
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

<template>
  <div class="bg-gray-100 rounded-lg p-2 mb-3" data-testid="data-source-toggle">
    <h3 id="data-source-label" class="mt-0 mb-1.5 text-base text-gray-800">Orden</h3>
    <div
      class="flex justify-around bg-gray-300 rounded-full p-0.5"
      role="radiogroup"
      aria-labelledby="data-source-label"
    >
      <label
        v-for="option in options"
        :key="option.label"
        class="flex-1 text-center"
      >
        <input
          type="radio"
          name="data-source"
          :value="option.value"
          :checked="modelValue === option.value"
          @change="handleChange(option.value)"
          :aria-label="`${option.label} - ${option.value ? 'Orden Departamental Nacional' : 'Orden Departamental Departamental'}`"
          :aria-checked="modelValue === option.value"
          class="hidden radio-input"
        />
        <span
          class="block py-2.5 px-4 text-sm rounded-2xl cursor-pointer transition-all duration-300"
          :class="
            modelValue === option.value
              ? 'bg-gray-800 text-white'
              : 'text-gray-800 hover:bg-gray-400'
          "
          style="min-height: var(--touch-target-min); display: flex; align-items: center; justify-content: center; user-select: none; -webkit-tap-highlight-color: transparent;"
        >
          {{ option.label }}
        </span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ToggleOption {
  value: boolean;
  label: string;
}

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const options: ToggleOption[] = [
  { value: false, label: 'ODD' },
  { value: true, label: 'ODN' },
];

const handleChange = (value: boolean) => {
  emit('update:modelValue', value);
};
</script>

<style scoped>
/* Active state for touch feedback */
label:active span {
  transform: scale(0.98);
}

label span {
  transition: all 0.2s ease;
}

/* Focus indicator for keyboard navigation - WCAG AA compliant */
.radio-input:focus-visible + span {
  outline: 3px solid var(--color-accent, #0066cc);
  outline-offset: 2px;
}

/* Improved contrast for WCAG AA compliance */
.text-gray-800 {
  /* WCAG AA: #1f2937 on #d1d5db = 7.4:1 */
  color: #1f2937 !important;
}

.bg-gray-800 {
  /* WCAG AAA: white on #1f2937 = 12.6:1 */
  background-color: #1f2937 !important;
}

.hover\:bg-gray-400:hover {
  /* WCAG AA: #1f2937 on #9ca3af = 4.6:1 */
  background-color: #9ca3af !important;
}

@media (max-width: 767px) {
  .bg-gray-100 {
    background-color: rgba(255, 255, 255, 0.9);
    padding: 10px;
    border-radius: 8px 8px 0 0;
  }
}
</style>

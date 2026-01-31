<template>
  <div class="bg-gray-100 rounded-lg p-2 mb-3" data-testid="data-source-toggle">
    <h3 class="mt-0 mb-1.5 text-base text-gray-800">Orden</h3>
    <div class="flex justify-around bg-gray-300 rounded-full p-0.5">
      <label
        v-for="option in options"
        :key="option.label"
        class="flex-1 text-center"
      >
        <input
          type="radio"
          :value="option.value"
          :checked="modelValue === option.value"
          @change="handleChange(option.value)"
          class="hidden"
        />
        <span
          class="block py-1.5 px-3 text-sm rounded-2xl cursor-pointer transition-all duration-300"
          :class="
            modelValue === option.value
              ? 'bg-gray-800 text-white'
              : 'text-gray-800'
          "
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
@media (max-width: 767px) {
  .bg-gray-100 {
    background-color: rgba(255, 255, 255, 0.9);
    padding: 10px;
    border-radius: 8px 8px 0 0;
  }
}
</style>

<template>
  <div class="bg-gray-100 rounded-lg p-4 mb-5">
    <h3 class="mt-0 mb-2.5 text-lg text-gray-800">Orden</h3>
    <div class="flex justify-around bg-gray-300 rounded-full p-1">
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
          class="block py-2 px-4 rounded-2xl cursor-pointer transition-all duration-300"
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

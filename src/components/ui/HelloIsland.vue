<script setup lang="ts">
import { ref } from 'vue';

// Isla Vue trivial para validar la hidratación (@astrojs/vue + client:load).
// Patrón validado por el spike R7: las islas usan client:load, NO client:only.
const count = ref(0);
</script>

<template>
  <button
    type="button"
    class="rounded border px-3 py-2"
    @click="count++"
  >
    Isla Vue viva — clicks: {{ count }}
  </button>
</template>

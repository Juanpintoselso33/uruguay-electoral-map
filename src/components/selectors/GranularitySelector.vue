<script setup lang="ts">
/**
 * Toggle de granularidad de la vista nacional (Epic 15.4): Departamentos ↔ Zonas.
 * Departamentos (default) = 19 deptos agregados. Zonas = todas las zonas/series del país
 * combinadas (geo/_nacional/zona.topo.json + votes-zona.json). El estado vive en la URL (?level=).
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { $level, commit } from '../../stores/map-state';

// isZona inicial: solo si la URL trae explícitamente ?level=zona (el default nacional es departamento).
const isZona = ref<boolean>(false);
let unsub: (() => void) | undefined;
onMounted(() => {
  isZona.value = new URLSearchParams(window.location.search).get('level') === 'zona';
  unsub = $level.subscribe((v) => { isZona.value = v === 'zona'; });
});
onUnmounted(() => unsub?.());

function selectDepto() {
  if (!isZona.value) return;
  commit({ level: 'departamento', zona: null });
}
function selectZona() {
  if (isZona.value) return;
  commit({ level: 'zona', zona: null });
}
</script>

<template>
  <div class="gran-sel">
    <div class="seg" role="group" aria-label="Granularidad del mapa nacional">
      <button
        :class="{ on: !isZona }"
        type="button"
        :aria-pressed="!isZona"
        @click="selectDepto"
      >Departamentos</button>
      <button
        :class="{ on: isZona }"
        type="button"
        :aria-pressed="isZona"
        @click="selectZona"
      >Zonas</button>
    </div>
  </div>
</template>

<style scoped>
.gran-sel {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0 0.75rem;
}
</style>

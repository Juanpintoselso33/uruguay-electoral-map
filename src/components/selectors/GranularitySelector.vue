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
  <div class="gran-sel" role="group" aria-label="Granularidad del mapa nacional">
    <button
      class="gran-sel__btn"
      :class="{ 'gran-sel__btn--activo': !isZona }"
      type="button"
      :aria-pressed="!isZona"
      @click="selectDepto"
    >Departamentos</button>
    <button
      class="gran-sel__btn"
      :class="{ 'gran-sel__btn--activo': isZona }"
      type="button"
      :aria-pressed="isZona"
      @click="selectZona"
    >Zonas</button>
  </div>
</template>

<style scoped>
.gran-sel {
  display: flex;
  justify-content: center;
  gap: 0;
  padding: 0.5rem 0 0.75rem;
}
.gran-sel__btn {
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.4rem 1.1rem;
  border: 1px solid var(--color-border-strong);
  background: var(--color-paper);
  color: var(--color-ink-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.gran-sel__btn:first-child { border-radius: 6px 0 0 6px; border-right: none; }
.gran-sel__btn:last-child  { border-radius: 0 6px 6px 0; }
.gran-sel__btn--activo {
  background: var(--color-ink);
  color: var(--color-paper);
  border-color: var(--color-ink);
}
.gran-sel__btn:not(.gran-sel__btn--activo):hover { color: var(--color-ink); }
</style>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import type { NivelGeografico } from '../../lib/contracts';
import { $level, commit } from '../../stores/map-state';

const props = defineProps<{ availableLevels: NivelGeografico[] }>();

// Nivel activo: si el nivel en URL no está disponible para este depto, usar el primero disponible.
// Esto evita el flash incorrecto antes de que ChoroplethMap corrija la URL.
function resolveActive(level: NivelGeografico): NivelGeografico {
  return props.availableLevels.includes(level) ? level : (props.availableLevels[0] ?? level);
}
const activeLevel = ref<NivelGeografico>(resolveActive($level.get()));
let unsub: (() => void) | undefined;
onMounted(() => { unsub = $level.subscribe((v) => { activeLevel.value = resolveActive(v); }); });
onUnmounted(() => { unsub?.(); });

function select(nivel: NivelGeografico): void {
  if (!props.availableLevels.includes(nivel)) return;
  commit({ level: nivel, zona: null });
}

const NIVELES: { key: NivelGeografico; label: string }[] = [
  { key: 'zona',     label: 'Zona' },
  { key: 'serie',    label: 'Serie' },
  { key: 'circuito', label: 'Circuito' },
];
</script>

<template>
  <div class="level-sel" role="group" aria-label="Nivel geográfico">
    <span class="level-sel__titulo">Nivel</span>
    <template v-for="n in NIVELES" :key="n.key">
      <button
        v-if="n.key !== 'circuito'"
        class="level-sel__btn"
        :class="{
          'level-sel__btn--activo':     activeLevel === n.key,
          'level-sel__btn--disponible': availableLevels.includes(n.key),
        }"
        type="button"
        :aria-pressed="activeLevel === n.key"
        :aria-disabled="!availableLevels.includes(n.key)"
        @click="select(n.key)"
      >{{ n.label }}</button>
      <!-- Circuito: siempre nativo disabled -->
      <button
        v-else
        class="level-sel__btn level-sel__btn--prox"
        type="button"
        disabled
        title="Próximamente"
        aria-disabled="true"
      >{{ n.label }}</button>
    </template>
  </div>
</template>

<style scoped>
.level-sel {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}
.level-sel__titulo {
  color: #6b7280;
  font-size: 0.75rem;
  margin-right: 0.25rem;
}
.level-sel__btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: #ffffff;
  font-size: 0.8125rem;
  cursor: pointer;
  color: #374151;
  min-height: 44px;
  min-width: 44px;
  transition: background 0.1s, border-color 0.1s;
}
.level-sel__btn--activo {
  background: #111827;
  color: #ffffff;
  border-color: #111827;
  font-weight: 700;
}
.level-sel__btn--disponible:not(.level-sel__btn--activo):hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}
.level-sel__btn[aria-disabled="true"]:not(.level-sel__btn--prox) {
  color: #d1d5db;
  cursor: not-allowed;
  border-color: #e5e7eb;
  background: #f9fafb;
}
.level-sel__btn--prox {
  color: #d1d5db;
  cursor: not-allowed;
  border-color: #e5e7eb;
  background: #f9fafb;
}
</style>

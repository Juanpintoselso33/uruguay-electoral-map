<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { NivelGeografico } from '../../lib/contracts';
import { $circuito, commit } from '../../stores/map-state';

const props = defineProps<{ availableLevels: NivelGeografico[] }>();

const BASE_PRIORITY: NivelGeografico[] = ['zona', 'serie', 'barrio', 'localidad'];

const defaultBase = computed<NivelGeografico>(() =>
  BASE_PRIORITY.find(l => props.availableLevels.includes(l)) ?? props.availableLevels.find(l => l !== 'circuito' && l !== 'local') ?? 'zona'
);

// Epic 17: el overlay de puntos prefiere LOCAL; el botón se habilita si hay local o circuito.
const hasCircuito = computed(() => props.availableLevels.includes('local') || props.availableLevels.includes('circuito'));

// Arranca en false para coincidir con el SSR (el store no existe en server) y evitar el hydration
// mismatch en deep-links con ?circ=1; el subscribe de nanostores dispara al montar y sincroniza.
const isCircuito = ref<boolean>(false);
let unsubCircuito: (() => void) | undefined;
onMounted(() => { unsubCircuito = $circuito.subscribe((v) => { isCircuito.value = v; }); });
onUnmounted(() => { unsubCircuito?.(); });

const BASE_LABELS: Partial<Record<NivelGeografico, string>> = {
  departamento: 'Departamentos',
  zona:      'Zonas',
  barrio:    'Barrios',
  localidad: 'Localidades',
  serie:     'Series',
};
const baseLabel = computed(() => BASE_LABELS[defaultBase.value] ?? 'Zonas');

function selectBase() {
  commit({ level: defaultBase.value, zona: null });
}

function toggleCircuito() {
  if (!hasCircuito.value) return;
  commit({ circ: !isCircuito.value, level: defaultBase.value });
}

</script>

<template>
  <div class="level-sel" role="group" aria-label="Nivel geográfico">
    <button
      class="level-sel__btn level-sel__btn--activo"
      type="button"
      aria-pressed="true"
      @click="selectBase"
    >{{ baseLabel }}</button>

    <button
      class="level-sel__btn level-sel__btn--circuito"
      :class="{ 'level-sel__btn--activo': isCircuito, 'level-sel__btn--disabled': !hasCircuito }"
      type="button"
      :aria-pressed="isCircuito"
      :aria-disabled="!hasCircuito"
      @click="toggleCircuito"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style="flex-shrink:0">
        <rect x="0.5" y="0.5" width="5" height="5" rx="0.5" stroke="currentColor"/>
        <rect x="7.5" y="0.5" width="5" height="5" rx="0.5" stroke="currentColor"/>
        <rect x="0.5" y="7.5" width="5" height="5" rx="0.5" stroke="currentColor"/>
        <rect x="7.5" y="7.5" width="5" height="5" rx="0.5" stroke="currentColor"/>
      </svg>
      Local
    </button>
  </div>
</template>

<style scoped>
.level-sel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
}

.level-sel__btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3125rem 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.375rem;
  background: var(--color-card);
  font-size: 0.8125rem;
  cursor: pointer;
  color: var(--color-ink-soft);
  min-height: 32px;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  white-space: nowrap;
}
.level-sel__btn:hover {
  background: var(--color-surface-2);
  border-color: var(--color-ink-faint);
}
.level-sel__btn--activo {
  background: var(--color-btn-active-bg);
  color: var(--color-btn-active-fg);
  border-color: var(--color-btn-active-bg);
  font-weight: 700;
}
.level-sel__btn--activo:hover {
  background: var(--color-btn-active-bg);
}

/* Circuito — visualmente separado, tipo toggle */
.level-sel__btn--circuito {
  margin-left: 0.5rem;
  border-style: dashed;
  color: var(--color-ink-muted);
}
.level-sel__btn--circuito.level-sel__btn--activo {
  border-style: solid;
  background: var(--color-btn-active-bg);
  color: var(--color-btn-active-fg);
}
.level-sel__btn--disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}
</style>

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
  municipio: 'Municipios',
};
const baseLabel = computed(() => BASE_LABELS[defaultBase.value] ?? 'Zonas');

function selectBase() {
  // Volver a la vista base apaga el overlay de circuito (toggle de 2 vías).
  commit({ level: defaultBase.value, zona: null, circ: false });
}

function toggleCircuito() {
  if (!hasCircuito.value) return;
  commit({ circ: !isCircuito.value, level: defaultBase.value });
}

</script>

<template>
  <div class="level-sel">
    <div class="seg" role="group" aria-label="Nivel geográfico">
      <button
        :class="{ on: !isCircuito }"
        type="button"
        :aria-pressed="!isCircuito"
        @click="selectBase"
      >{{ baseLabel }}</button>

      <button
        :class="{ on: isCircuito }"
        type="button"
        :aria-pressed="isCircuito"
        :aria-disabled="!hasCircuito"
        :disabled="!hasCircuito"
        @click="toggleCircuito"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="5" height="5" rx="0.5" stroke="currentColor"/>
          <rect x="7.5" y="0.5" width="5" height="5" rx="0.5" stroke="currentColor"/>
          <rect x="0.5" y="7.5" width="5" height="5" rx="0.5" stroke="currentColor"/>
          <rect x="7.5" y="7.5" width="5" height="5" rx="0.5" stroke="currentColor"/>
        </svg>
        Circuito
      </button>
    </div>
  </div>
</template>

<style scoped>
.level-sel {
  display: flex;
  justify-content: center;
  padding: 0.5rem 1rem;
}
</style>

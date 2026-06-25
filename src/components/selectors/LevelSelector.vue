<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { NivelGeografico } from '../../lib/contracts';
import { $circuito, $level, commit } from '../../stores/map-state';

const props = defineProps<{ availableLevels: NivelGeografico[] }>();

// Orden de presentación de los niveles BASE (de menos a más fino). El overlay Circuito va aparte.
const BASE_PRIORITY: NivelGeografico[] = ['zona', 'serie', 'localidad', 'barrio', 'municipio'];

/** Niveles base seleccionables (todo lo que no sea el overlay de puntos circuito/local). */
const bases = computed<NivelGeografico[]>(() => {
  const present = props.availableLevels.filter((l) => l !== 'circuito' && l !== 'local');
  return [...present].sort((a, b) => {
    const ia = BASE_PRIORITY.indexOf(a); const ib = BASE_PRIORITY.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
});
const defaultBase = computed<NivelGeografico>(() => bases.value[0] ?? 'zona');

// Epic 17: el overlay de puntos prefiere LOCAL; el botón se habilita si hay local o circuito.
const hasCircuito = computed(() => props.availableLevels.includes('local') || props.availableLevels.includes('circuito'));

// Arrancan en false/'' para coincidir con el SSR; el subscribe de nanostores sincroniza al montar.
const isCircuito = ref<boolean>(false);
const nivelActual = ref<NivelGeografico>('zona');
let unsubCircuito: (() => void) | undefined;
let unsubLevel: (() => void) | undefined;
onMounted(() => {
  unsubCircuito = $circuito.subscribe((v) => { isCircuito.value = v; });
  unsubLevel = $level.subscribe((v) => { nivelActual.value = v; });
});
onUnmounted(() => { unsubCircuito?.(); unsubLevel?.(); });

const BASE_LABELS: Partial<Record<NivelGeografico, string>> = {
  departamento: 'Departamentos',
  zona:      'Zonas',
  barrio:    'Barrios',
  localidad: 'Localidades',
  serie:     'Series',
  municipio: 'Municipios',
};
const labelOf = (l: NivelGeografico): string => BASE_LABELS[l] ?? l;

/** Base activo: el nivel actual si es un base; si no (p.ej. estamos en circuito), el default. */
const baseActivo = computed<NivelGeografico>(() =>
  bases.value.includes(nivelActual.value) ? nivelActual.value : defaultBase.value);

function selectBase(l: NivelGeografico): void {
  // Elegir un nivel base apaga el overlay de circuito.
  commit({ level: l, zona: null, circ: false });
}

function toggleCircuito(): void {
  if (!hasCircuito.value) return;
  commit({ circ: !isCircuito.value, level: baseActivo.value });
}
</script>

<template>
  <div class="level-sel">
    <div class="seg" role="group" aria-label="Nivel geográfico">
      <button
        v-for="b in bases"
        :key="b"
        :class="{ on: !isCircuito && baseActivo === b }"
        type="button"
        :aria-pressed="!isCircuito && baseActivo === b"
        @click="selectBase(b)"
      >{{ labelOf(b) }}</button>

      <button
        v-if="hasCircuito"
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

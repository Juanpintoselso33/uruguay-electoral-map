<script setup lang="ts">
/**
 * Controles de comparación dual entre elecciones (Story 4.3).
 *
 * `client:idle`. Muestra botón entrar/salir del modo comparación.
 * Estado: $comparison.vs (URL ?vs=). Entrar → commit({ vs: otherEleccion }).
 * Solo renderiza el botón si el depto tiene ≥2 elecciones disponibles.
 */
import { onMounted, ref } from 'vue';
import { $comparison, commit } from '../../stores/map-state';

const props = defineProps<{
  availableElecciones: string[];
  eleccionActual: string;
}>();

const LABELS: Record<string, string> = {
  'nacionales-2014':                  'Nacionales 2014',
  'balotaje-2014':                    'Balotaje 2014',
  'internas-2019':                    'Internas 2019',
  'nacionales-2019':                  'Nacionales 2019',
  'balotaje-2019':                    'Balotaje 2019',
  'departamentales-2020':             'Dptales. 2020',
  'referendum-luc-2022':              'Referéndum LUC 2022',
  'internas-2024':                    'Internas 2024',
  'nacionales-2024':                  'Nacionales 2024',
  'plebiscito-allanamientos-2024':    'Plebiscito Allanamientos 2024',
  'plebiscito-seguridad-social-2024': 'Plebiscito Seg. Social 2024',
  'balotaje-2024':                    'Balotaje 2024',
  'departamentales-2025':             'Dptales. 2025',
};
function label(e: string): string { return LABELS[e] ?? e; }

const comparisonVs = ref<string | null>(null);

onMounted(() => {
  $comparison.subscribe((cmp) => {
    comparisonVs.value = cmp.vs;
  });
});

function otherEleccion(): string | null {
  return props.availableElecciones.find((e) => e !== props.eleccionActual) ?? null;
}

function enterCompare(): void {
  const other = otherEleccion();
  if (other) commit({ vs: other });
}

function exitCompare(): void {
  commit({ vs: null });
}
</script>

<template>
  <div v-if="availableElecciones.length > 1" class="cmp">
    <template v-if="comparisonVs">
      <span class="cmp__text">Comparando con: <strong class="cmp__strong">{{ label(comparisonVs) }}</strong></span>
      <button class="cmp__btn" type="button" @click="exitCompare">Salir</button>
    </template>
    <template v-else-if="otherEleccion()">
      <button class="cmp__btn" type="button" @click="enterCompare">
        Comparar con {{ label(otherEleccion()!) }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.cmp {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-1);
  font-size: 0.75rem;
}
.cmp__text { color: var(--color-ink-soft); }
.cmp__strong { color: var(--color-ink); font-weight: 600; }
.cmp__btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--color-accent);
  font-size: 0.75rem;
  text-decoration: underline;
}
.cmp__btn:hover { color: var(--color-ink); }
</style>

<script setup lang="ts">
/**
 * Controles de comparación entre elecciones (Story 4.3 · prototipo Fase 1).
 *
 * `client:idle`. UX de-saturada: cuando NO se está comparando, es solo un chip chico
 * ("⇄ Comparar con otra elección") — sin banda permanente arriba del mapa. Al tocarlo se
 * despliega un dropdown filtrado a elecciones del MISMO tipo (nacionales↔nacionales, …);
 * al elegir una se entra en comparación (commit({ vs })). La explicación del borde naranja
 * vive en la leyenda (debajo del mapa), no acá arriba.
 *
 * Solo elecciones del mismo tipo son comparables: balotaje vs plebiscito tienen universos de
 * opciones disjuntos → comparar ahí daría basura. El "tipo" se deriva quitando el año del id.
 */
import { onMounted, ref, computed } from 'vue';
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

/** Tipo de elección = id sin el año (y lo que le siga). Solo se compara dentro del mismo tipo. */
function tipoDe(e: string): string { return e.replace(/-?\d{4}.*$/, ''); }

const comparisonVs = ref<string | null>(null);
const expanded = ref(false);
onMounted(() => {
  $comparison.subscribe((cmp) => { comparisonVs.value = cmp.vs; });
});

/** Elecciones comparables: mismo tipo, distinta del actual, ordenadas por año desc. */
const comparables = computed<string[]>(() => {
  const tipo = tipoDe(props.eleccionActual);
  return props.availableElecciones
    .filter((e) => e !== props.eleccionActual && tipoDe(e) === tipo)
    .sort((a, b) => (b.match(/\d{4}/)?.[0] ?? '').localeCompare(a.match(/\d{4}/)?.[0] ?? ''));
});

/** Mostrar el dropdown si ya estamos comparando o si el usuario tocó el chip. */
const mostrarSelect = computed<boolean>(() => !!comparisonVs.value || expanded.value);

function onSelect(e: Event): void {
  const val = (e.target as HTMLSelectElement).value;
  commit({ vs: val || null });
  if (!val) expanded.value = false;
}
function exitCompare(): void { commit({ vs: null }); expanded.value = false; }
</script>

<template>
  <div v-if="comparables.length > 0" class="cmp">
    <!-- Inactivo: solo un chip chico (no banda permanente) -->
    <button v-if="!mostrarSelect" class="cmp__chip" type="button" @click="expanded = true">
      ⇄ Comparar con otra elección
    </button>
    <!-- Activo o desplegado: dropdown + salir -->
    <template v-else>
      <span class="cmp__lbl">Comparar con:</span>
      <select class="cmp__sel" :value="comparisonVs ?? ''" @change="onSelect" aria-label="Elegí una elección para comparar">
        <option value="">— elegí una elección —</option>
        <option v-for="e in comparables" :key="e" :value="e">{{ label(e) }}</option>
      </select>
      <button class="cmp__btn" type="button" @click="exitCompare">{{ comparisonVs ? 'Salir' : 'Cancelar' }}</button>
    </template>
  </div>
</template>

<style scoped>
.cmp {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
}
/* Chip compacto (estado inactivo): mínimo peso visual, no ocupa una banda completa. */
.cmp__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 9999px;
  background: var(--color-surface-1);
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 0.7rem;
}
.cmp__chip:hover { color: var(--color-ink); border-color: var(--color-ink); }
.cmp__chip:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.cmp__lbl { color: var(--color-ink-soft); font-weight: 600; }
.cmp__sel {
  font-size: 0.75rem;
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.25rem;
  background: var(--color-paper);
  color: var(--color-ink);
  cursor: pointer;
}
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

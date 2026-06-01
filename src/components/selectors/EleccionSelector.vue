<script setup lang="ts">
interface Props {
  elecciones: string[];
  eleccionActual: string;
  departamento: string;
}
const props = defineProps<Props>();

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

function label(e: string): string {
  return LABELS[e] ?? e;
}
</script>

<template>
  <nav class="esel" aria-label="Seleccionar elección">
    <span class="esel__label">Elección</span>
    <div class="esel__pills">
      <a
        v-for="e in elecciones"
        :key="e"
        :href="`/${e}/${departamento}`"
        class="esel__pill"
        :class="{ 'esel__pill--activa': e === eleccionActual }"
        :aria-current="e === eleccionActual ? 'page' : undefined"
      >{{ label(e) }}</a>
    </div>
  </nav>
</template>

<style scoped>
.esel {
  padding: 0.5rem 1rem 0.625rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-paper);
}
.esel__label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  margin-bottom: 0.375rem;
}
.esel__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
.esel__pill {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-card);
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.esel__pill:hover {
  background: var(--color-surface-2);
  border-color: var(--color-ink-faint);
  color: var(--color-ink);
}
.esel__pill--activa {
  background: var(--color-btn-active-bg);
  border-color: var(--color-btn-active-bg);
  color: var(--color-btn-active-fg);
  font-weight: 600;
}
.esel__pill--activa:hover {
  background: var(--color-btn-active-bg);
  border-color: var(--color-btn-active-bg);
  color: var(--color-btn-active-fg);
}
</style>

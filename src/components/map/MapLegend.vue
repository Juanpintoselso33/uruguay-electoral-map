<script setup lang="ts">
/**
 * Leyenda del choropleth (Story 1.8). Nombra cada color, su sigla y qué representa.
 * Requisito a11y/diseño: NUNCA solo color — sigla + nombre como texto.
 */
interface Entrada {
  readonly sigla: string;
  readonly nombre: string;
  readonly color: string;
  readonly votos: number;
}
defineProps<{ entradas: Entrada[]; sinDatos: number }>();
</script>

<template>
  <div class="legend" role="list" aria-label="Leyenda: partidos por color">
    <div
      v-for="e in entradas"
      :key="e.sigla + e.nombre"
      class="legend__item"
      role="listitem"
    >
      <span class="legend__swatch" :style="{ background: e.color }" aria-hidden="true"></span>
      <span class="legend__sigla">{{ e.sigla }}</span>
      <span class="legend__nombre">{{ e.nombre }}</span>
    </div>
    <div v-if="sinDatos > 0" class="legend__item legend__item--muted" role="listitem">
      <span class="legend__swatch legend__swatch--empty" aria-hidden="true"></span>
      <span class="legend__sigla">—</span>
      <span class="legend__nombre">{{ sinDatos }} barrio(s) sin datos</span>
    </div>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  padding: 0.75rem;
  font-size: 0.8125rem;
}
.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}
.legend__item--muted {
  opacity: 0.7;
}
.legend__swatch {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 0.1875rem;
  flex: none;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}
.legend__swatch--empty {
  background: var(--color-sin-datos);
}
.legend__sigla {
  font-weight: 700;
}
.legend__nombre {
  color: var(--color-ink-muted);
}
</style>

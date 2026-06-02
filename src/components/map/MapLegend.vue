<script setup lang="ts">
/**
 * Leyenda del choropleth (Story 1.8). Nombra cada color, su sigla y qué representa.
 * Requisito a11y/diseño: NUNCA solo color — sigla + nombre como texto.
 * Si la entrada tiene flagUrl, muestra la bandera del partido en lugar del swatch.
 */
interface Entrada {
  readonly sigla: string;
  readonly nombre: string;
  readonly color: string;
  readonly votos: number;
  readonly flagUrl?: string | null;
}
const props = defineProps<{
  entradas: Entrada[];
  sinDatos: number;
  /** Epic 16: votos cuyo geoId no tiene polígono (series especiales/observados sin ubicación). */
  votosSinUbicacion?: number;
  zonasSinUbicacion?: number;
}>();
const fmt = (n: number): string => n.toLocaleString('es-UY');
</script>

<template>
  <div class="legend" role="list" aria-label="Leyenda: partidos por color">
    <div
      v-for="e in entradas"
      :key="e.sigla + e.nombre"
      class="legend__item"
      role="listitem"
    >
      <!-- Bandera si existe, swatch de color si no -->
      <img
        v-if="e.flagUrl"
        :src="e.flagUrl"
        :alt="e.sigla"
        class="legend__flag"
        aria-hidden="true"
      />
      <span
        v-else
        class="legend__swatch"
        :style="{ background: e.color }"
        aria-hidden="true"
      ></span>
      <span class="legend__sigla">{{ e.sigla }}</span>
      <span v-if="e.nombre !== e.sigla" class="legend__nombre">{{ e.nombre }}</span>
    </div>
    <div v-if="sinDatos > 0" class="legend__item legend__item--muted" role="listitem">
      <span class="legend__swatch legend__swatch--empty" aria-hidden="true"></span>
      <span class="legend__sigla">—</span>
      <span class="legend__nombre">{{ sinDatos }} zona(s) sin datos</span>
    </div>
  </div>
  <!-- Epic 16: limitación documentada — votos sin ubicación geográfica (series especiales/observados) -->
  <p v-if="(props.votosSinUbicacion ?? 0) > 0" class="legend__nota">
    ⚠ {{ fmt(props.votosSinUbicacion!) }} votos en {{ props.zonasSinUbicacion }} serie(s) sin ubicación geográfica
    (series especiales / voto observado, o sin geometría) — contabilizados en los totales pero no representables en el mapa.
  </p>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
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
.legend__flag {
  width: 1.5rem;
  height: 1rem;
  border-radius: 0.1875rem;
  flex: none;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  object-fit: cover;
}
.legend__sigla {
  font-weight: 700;
}
.legend__nombre {
  color: var(--color-ink-muted);
}
.legend__nota {
  margin: 0 0 0.5rem;
  padding: 0 1rem;
  text-align: center;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--color-ink-faint);
}
</style>

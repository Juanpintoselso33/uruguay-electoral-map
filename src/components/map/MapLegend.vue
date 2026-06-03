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
  /** Coloreo-por-nivel: sub-ganadores (sublema/lista) bajo este lema + cap "+masN". */
  readonly subEntradas?: { nombre: string; color: string; votos: number }[];
  readonly masN?: number;
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
    <template v-for="e in entradas" :key="e.sigla + e.nombre">
      <!-- Coloreo-por-nivel (sub-nivel): bloque agrupado por lema con sub-ganadores -->
      <div v-if="e.subEntradas && e.subEntradas.length" class="legend__grupo" role="listitem">
        <div class="legend__grupo-head">
          <img v-if="e.flagUrl" :src="e.flagUrl" :alt="e.sigla" class="legend__flag" aria-hidden="true" />
          <span v-else class="legend__swatch" :style="{ background: e.color }" aria-hidden="true"></span>
          <span class="legend__sigla">{{ e.sigla }}</span>
          <span class="legend__grupo-n">{{ e.votos }}</span>
        </div>
        <div class="legend__subs">
          <span v-for="s in e.subEntradas" :key="s.nombre" class="legend__sub">
            <span class="legend__swatch" :style="{ background: s.color }" aria-hidden="true"></span>
            {{ s.nombre }} <span class="legend__subn">{{ s.votos }}</span>
          </span>
          <span v-if="e.masN" class="legend__mas">+{{ e.masN }} más</span>
        </div>
      </div>
      <!-- Nivel lema: chip inline (comportamiento base) -->
      <div v-else class="legend__item" role="listitem">
        <img v-if="e.flagUrl" :src="e.flagUrl" :alt="e.sigla" class="legend__flag" aria-hidden="true" />
        <span v-else class="legend__swatch" :style="{ background: e.color }" aria-hidden="true"></span>
        <span class="legend__sigla">{{ e.sigla }}</span>
        <span v-if="e.nombre !== e.sigla" class="legend__nombre">{{ e.nombre }}</span>
      </div>
    </template>
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
/* Coloreo-por-nivel: bloque agrupado por lema (ocupa toda la fila) */
.legend__grupo { flex-basis: 100%; display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start; }
.legend__grupo-head { display: inline-flex; align-items: center; gap: 0.375rem; font-weight: 700; }
.legend__grupo-n { font-weight: 400; color: var(--color-ink-muted); }
.legend__subs { display: flex; flex-wrap: wrap; gap: 0.25rem 0.625rem; padding-left: 1.5rem; }
.legend__sub { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--color-ink-soft); }
.legend__subn { color: var(--color-ink-muted); }
.legend__mas { color: var(--color-ink-faint); font-style: italic; }
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

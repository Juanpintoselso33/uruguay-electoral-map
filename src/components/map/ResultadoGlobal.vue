<script setup lang="ts">
/**
 * Tarjeta de resultado agregado de la geografía mostrada (% de voto real).
 * En la vista nacional es el total país; en una página de departamento es el total del depto.
 * Genérica: renderiza las opciones agregadas ordenadas desc — para plebiscito/referéndum
 * salen Sí/No, para elecciones partidarias salen los partidos. Independiente de la selección.
 * El % usa el mismo denominador que la ficha (votos válidos), así reconcilian entre sí.
 */
import { computed } from 'vue';

interface Entrada {
  readonly opcionId: string;
  readonly sigla: string;
  readonly nombre: string;
  readonly color: string;
  readonly flagUrl?: string | null;
  readonly votos: number;
  readonly pct: number;
}

const props = defineProps<{
  entradas: Entrada[];
  validos: number;
  /** 'Resultado nacional' en la vista país; 'Resultado' en una página de departamento. */
  titulo: string;
  /** Cuántas filas mostrar antes de colapsar el resto en "otros". */
  maxFilas?: number;
}>();

const fmt = (n: number): string => n.toLocaleString('es-UY');

const MAX = computed(() => props.maxFilas ?? 6);

const visibles = computed(() => props.entradas.slice(0, MAX.value));

const otros = computed(() => {
  const resto = props.entradas.slice(MAX.value);
  if (resto.length === 0) return null;
  const votos = resto.reduce((s, e) => s + e.votos, 0);
  const pct = resto.reduce((s, e) => s + e.pct, 0);
  return { n: resto.length, votos, pct };
});
</script>

<template>
  <div v-if="entradas.length > 0" class="resultado" aria-label="Resultado agregado">
    <h2 class="resultado__titulo">{{ titulo }}</h2>
    <ul class="resultado__lista">
      <li v-for="e in visibles" :key="e.opcionId" class="resultado__fila">
        <img
          v-if="e.flagUrl"
          :src="e.flagUrl"
          :alt="e.sigla"
          class="resultado__flag"
          aria-hidden="true"
        />
        <span
          v-else
          class="resultado__swatch"
          :style="{ background: e.color }"
          aria-hidden="true"
        ></span>
        <span class="resultado__sigla">{{ e.sigla }}</span>
        <span class="resultado__nombre">{{ e.nombre }}</span>
        <span class="resultado__bar" aria-hidden="true">
          <span class="resultado__bar-fill" :style="{ width: e.pct + '%', background: e.color }"></span>
        </span>
        <span class="resultado__pct">{{ e.pct.toFixed(1) }}%</span>
      </li>
      <li v-if="otros" class="resultado__fila resultado__fila--otros">
        <span class="resultado__swatch resultado__swatch--otros" aria-hidden="true"></span>
        <span class="resultado__sigla">+{{ otros.n }}</span>
        <span class="resultado__nombre">otras opciones</span>
        <span class="resultado__bar" aria-hidden="true"></span>
        <span class="resultado__pct">{{ otros.pct.toFixed(1) }}%</span>
      </li>
    </ul>
    <p class="resultado__pie">{{ fmt(validos) }} votos válidos</p>
  </div>
</template>

<style scoped>
.resultado {
  background: var(--color-card);
  border-top: 1px solid var(--color-border);
  padding: 0.75rem 1rem;
}
.resultado__titulo {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-ink-muted);
  margin: 0 0 0.5rem;
}
.resultado__lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.resultado__fila {
  display: grid;
  grid-template-columns: 1.5rem auto 1fr minmax(4rem, 6rem) 3rem;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}
.resultado__flag {
  width: 1.5rem;
  height: 1rem;
  border-radius: 0.1875rem;
  flex: none;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  object-fit: cover;
}
.resultado__swatch {
  width: 1rem;
  height: 1rem;
  border-radius: 0.1875rem;
  justify-self: center;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}
.resultado__swatch--otros {
  background: var(--color-sin-datos);
}
.resultado__sigla {
  font-weight: 700;
  color: var(--color-ink);
  white-space: nowrap;
}
.resultado__nombre {
  color: var(--color-ink-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resultado__bar {
  height: 0.5rem;
  border-radius: 9999px;
  background: var(--color-surface-2);
  overflow: hidden;
}
.resultado__bar-fill {
  display: block;
  height: 100%;
  border-radius: 9999px;
  min-width: 2px;
}
.resultado__pct {
  font-weight: 700;
  color: var(--color-ink);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.resultado__fila--otros .resultado__sigla,
.resultado__fila--otros .resultado__nombre,
.resultado__fila--otros .resultado__pct {
  color: var(--color-ink-faint);
  font-weight: 400;
}
.resultado__pie {
  margin: 0.5rem 0 0;
  font-size: 0.6875rem;
  color: var(--color-ink-faint);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Mobile: el nombre largo molesta en grilla angosta → se oculta, queda sigla + barra + % */
@media (max-width: 419px) {
  .resultado__fila {
    grid-template-columns: 1.5rem auto 1fr 3rem;
  }
  .resultado__nombre {
    display: none;
  }
}
</style>

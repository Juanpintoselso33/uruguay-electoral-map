<script setup lang="ts">
/**
 * Árbol recursivo del desglose de la ficha (lema → precandidato/sublema → lista).
 * Default: TODO EXPANDIDO. Cada nodo con hijos es colapsable. Resalta los nodos seleccionados.
 * La jerarquía la arma `buildOpcionTree` (src/lib/opcion-tree.ts) — esto solo la pinta.
 */
import { ref } from 'vue';
import type { TreeNode } from '../../lib/opcion-tree';

const props = defineProps<{
  nodes: TreeNode[];
  validos: number;
  seleccionIds?: string[];
  depth?: number;
}>();

const colapsados = ref<Set<string>>(new Set()); // vacío = todo expandido (default)
function toggle(id: string): void {
  const s = new Set(colapsados.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  colapsados.value = s;
}
function fmt(n: number): string { return n.toLocaleString('es-UY'); }
function pct(n: number): string { return props.validos > 0 ? `${((100 * n) / props.validos).toFixed(1)}%` : '—'; }
function sel(id: string): boolean { return props.seleccionIds?.includes(id) ?? false; }
</script>

<template>
  <ul class="dtree">
    <li
      v-for="n in nodes"
      :key="n.id"
      class="dtree__node"
      :class="{ 'dtree__node--sel': sel(n.id), 'dtree__node--lema': n.nivel === 'lema' }"
    >
      <div class="dtree__row" :style="{ paddingLeft: `${(depth ?? 0) * 14}px` }">
        <button
          v-if="n.hijos.length"
          type="button"
          class="dtree__chev"
          :class="{ 'dtree__chev--open': !colapsados.has(n.id) }"
          :aria-expanded="!colapsados.has(n.id)"
          :aria-label="colapsados.has(n.id) ? 'Desplegar' : 'Plegar'"
          @click="toggle(n.id)"
        >▸</button>
        <span v-else class="dtree__chev dtree__chev--leaf" aria-hidden="true"></span>

        <img v-if="n.flagUrl && n.nivel === 'lema'" :src="n.flagUrl" :alt="n.sigla ?? ''" class="dtree__flag" aria-hidden="true" />
        <span v-else-if="n.color" class="dtree__swatch" :style="{ background: n.color }" aria-hidden="true"></span>

        <span class="dtree__label">
          <strong v-if="n.sigla && n.nivel === 'lema' && n.sigla !== n.label" class="dtree__sigla">{{ n.sigla }}</strong>
          {{ n.label }}
        </span>
        <span class="dtree__pct">{{ pct(n.votos) }}</span>
        <span class="dtree__votos">{{ fmt(n.votos) }}</span>
      </div>
      <DesgloseTree
        v-if="n.hijos.length && !colapsados.has(n.id)"
        :nodes="n.hijos"
        :validos="validos"
        :seleccion-ids="seleccionIds"
        :depth="(depth ?? 0) + 1"
      />
    </li>
  </ul>
</template>

<style scoped>
.dtree { list-style: none; margin: 0; padding: 0; }
.dtree__node--sel > .dtree__row { background: color-mix(in srgb, var(--accent, #2563eb) 12%, transparent); border-radius: 4px; }
.dtree__row {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.18rem 0.25rem; font-size: 0.82rem; line-height: 1.3;
}
.dtree__node--lema > .dtree__row { font-weight: 600; margin-top: 0.15rem; }
.dtree__chev {
  flex: 0 0 auto; width: 1rem; height: 1rem; padding: 0; border: 0; background: none;
  cursor: pointer; color: var(--muted, #64748b); transition: transform .12s; font-size: 0.7rem;
}
.dtree__chev--open { transform: rotate(90deg); }
.dtree__chev--leaf { cursor: default; visibility: hidden; }
.dtree__flag { width: 0.95rem; height: 0.7rem; object-fit: contain; border-radius: 1px; }
.dtree__swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; flex: 0 0 auto; }
.dtree__sigla { margin-right: 0.25rem; }
.dtree__label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtree__pct { flex: 0 0 auto; font-variant-numeric: tabular-nums; color: var(--muted, #64748b); margin-left: auto; }
.dtree__votos { flex: 0 0 auto; font-variant-numeric: tabular-nums; min-width: 3.2rem; text-align: right; }
</style>

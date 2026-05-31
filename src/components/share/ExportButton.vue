<script setup lang="ts">
/**
 * Isla de exportación CSV (Story 6.1 — FR23).
 *
 * client:idle. Descarga los votos de la vista actual como CSV UTF-8 con BOM
 * (compatible Excel). Formato largo (tidy): una fila por zona × opción.
 * Si hay una opción activa, exporta solo esa opción; si no, todas las opciones.
 * El nombre del archivo incluye dept + elección + nivel real de los datos.
 */
import { onMounted, onUnmounted, ref } from 'vue';
import type { VotosShard } from '../../lib/contracts';
import { $selection } from '../../stores/map-state';
import { resolveParty } from '../../lib/party-meta';

const props = defineProps<{ eleccion: string; departamento: string }>();

const isExporting = ref(false);
const opcionActiva = ref<string | null>(null);
let unsubs: (() => void)[] = [];

onMounted(() => {
  unsubs.push($selection.subscribe((s) => { opcionActiva.value = s.opcion; }));
});
onUnmounted(() => unsubs.forEach((u) => u()));

async function exportCsv(): Promise<void> {
  if (isExporting.value) return;
  isExporting.value = true;
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const [votesRes, opcionesRes] = await Promise.all([
      fetch(`${base}/data/${props.eleccion}/${props.departamento}/votes.json`),
      fetch(`${base}/data/${props.eleccion}/${props.departamento}/opciones.json`),
    ]);
    if (!votesRes.ok || !opcionesRes.ok) return;

    const votes = (await votesRes.json()) as VotosShard;
    const opcionesDoc = (await opcionesRes.json()) as { opciones: { opcionId: string; nombre: string }[] };
    const nombrePorOpcion = new Map(opcionesDoc.opciones.map((o) => [o.opcionId, o.nombre]));

    const HEADER = 'zona,opcion_id,nombre,sigla,votos,pct_validos,validos,en_blanco,anulados,observados,es_ganador';
    const rows: string[] = [HEADER];

    const filterOpcion = opcionActiva.value;
    for (const z of votes.zonas) {
      const { geoId, ganadorOpcionId, validos, porOpcion, noPartidarios } = z;
      for (const { opcionId, votos } of porOpcion) {
        if (filterOpcion && filterOpcion !== opcionId) continue;
        const nombre = nombrePorOpcion.get(opcionId) ?? opcionId;
        const sigla = resolveParty(nombre).sigla;
        const pct = validos > 0 ? ((votos / validos) * 100).toFixed(2) : '0.00';
        rows.push(
          [
            `"${geoId}"`,
            opcionId,
            `"${nombre}"`,
            sigla,
            votos,
            pct,
            validos,
            noPartidarios.enBlanco,
            noPartidarios.anulados,
            noPartidarios.observados,
            ganadorOpcionId === opcionId ? 'true' : 'false',
          ].join(','),
        );
      }
    }

    const csv = '﻿' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.departamento}_${props.eleccion}_${votes.nivel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <button class="export-btn" type="button" :disabled="isExporting" @click="exportCsv">
    <svg class="export-btn__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    {{ isExporting ? 'Descargando…' : 'Descargar CSV' }}
  </button>
</template>

<style scoped>
.export-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.375rem;
  background: var(--color-card);
  font-size: 0.75rem;
  color: var(--color-ink-muted);
  cursor: pointer;
  min-height: 32px;
  transition: background 0.1s, border-color 0.1s;
}
.export-btn:hover:not(:disabled) {
  background: var(--color-surface-2);
  border-color: var(--color-ink-faint);
  color: var(--color-ink-soft);
}
.export-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
.export-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
.export-btn__icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}
</style>

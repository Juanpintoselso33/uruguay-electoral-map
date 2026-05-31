<script setup lang="ts">
/**
 * Isla selector de opción electoral (Story 2.2).
 *
 * `client:idle`. Lee opciones.json del dept/eleccion actual y permite elegir
 * una opción. Clic → commit({ opcion }) → URL + mapa recolorea.
 * Etiqueta adaptativa: "Partido / Lema" para internas/legislativas;
 * "Candidato / Lema" para balotaje/presidencial.
 */
import { onMounted, ref, computed } from 'vue';
import { resolveParty } from '../../lib/party-meta';
import { $selection, $comparison, commit } from '../../stores/map-state';

const props = defineProps<{
  eleccion: string;
  departamento: string;
}>();

interface OpcionUI {
  opcionId: string;
  nombre: string;
  sigla: string;
  color: string;
}

const opciones = ref<OpcionUI[]>([]);
const opcionActiva = ref<string | null>(null);
// Dual opcion comparison (Story 4.4): a y b de $comparison
const cmpA = ref<string | null>(null);
const cmpB = ref<string | null>(null);

const labelSelector = computed(() => {
  if (props.eleccion.startsWith('internas') || props.eleccion.startsWith('legislativas')) {
    return 'Partido / Lema';
  }
  if (props.eleccion.includes('balotaje') || props.eleccion.startsWith('presidencial')) {
    return 'Candidato / Lema';
  }
  return 'Opción';
});

const nombreActivo = computed(() => {
  if (!opcionActiva.value) return null;
  return opciones.value.find((o) => o.opcionId === opcionActiva.value)?.nombre ?? opcionActiva.value;
});

onMounted(async () => {
  $selection.subscribe((s) => {
    opcionActiva.value = s.opcion;
  });
  $comparison.subscribe((cmp) => {
    cmpA.value = cmp.a;
    cmpB.value = cmp.b;
  });

  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/data/${props.eleccion}/${props.departamento}/opciones.json`);
    if (!res.ok) return;
    const doc = (await res.json()) as { opciones: { opcionId: string; nombre: string }[] };
    opciones.value = doc.opciones.map((o) => {
      const meta = resolveParty(o.nombre);
      return { opcionId: o.opcionId, nombre: o.nombre, sigla: meta.sigla, color: meta.color };
    });
  } catch {
    // Fallo silencioso — el mapa ya tiene el modo ganador por defecto
  }
});

function seleccionar(opcionId: string): void {
  commit({ opcion: opcionActiva.value === opcionId ? null : opcionId });
}

function limpiar(): void {
  commit({ opcion: null });
}

function compararVs(targetId: string): void {
  if (opcionActiva.value) {
    commit({ a: opcionActiva.value, b: targetId, opcion: null, vs: null });
  }
}

function salirDual(): void {
  commit({ a: null, b: null });
}

function opcionPorId(id: string | null): OpcionUI | undefined {
  return id ? opciones.value.find((o) => o.opcionId === id) : undefined;
}
</script>

<template>
  <section class="opcion-selector" aria-label="Selector de opción electoral">

    <!-- Modo dual activo (Story 4.4): encabezado A vs B con Salir -->
    <template v-if="cmpA && cmpB">
      <div class="opcion-selector__dual-header" aria-live="polite">
        <span class="opcion-selector__dual-label">
          <span class="opcion-selector__swatch" :style="{ background: opcionPorId(cmpA)?.color ?? '#ccc' }" aria-hidden="true"></span>
          <strong>{{ opcionPorId(cmpA)?.sigla ?? cmpA }}</strong>
          <span class="opcion-selector__dual-vs">vs</span>
          <span class="opcion-selector__swatch" :style="{ background: opcionPorId(cmpB)?.color ?? '#ccc' }" aria-hidden="true"></span>
          <strong>{{ opcionPorId(cmpB)?.sigla ?? cmpB }}</strong>
        </span>
        <button class="opcion-selector__clear" type="button" @click="salirDual">
          ✕ Salir
        </button>
      </div>
    </template>

    <!-- Modo normal -->
    <template v-else>
      <div class="opcion-selector__header">
        <span class="opcion-selector__label">{{ labelSelector }}</span>
        <button
          v-if="opcionActiva"
          class="opcion-selector__clear"
          type="button"
          aria-label="Ver todos los partidos"
          @click="limpiar"
        >
          ✕ Ver todos
        </button>
      </div>

      <div v-if="opcionActiva" class="opcion-selector__activa" aria-live="polite" aria-atomic="true">
        Viendo: <strong>{{ nombreActivo }}</strong>
      </div>

      <!-- Chips "Comparar vs:" cuando hay una opción activa (Story 4.4) -->
      <div v-if="opcionActiva && opciones.length > 1" class="opcion-selector__vs-chips">
        <span class="opcion-selector__vs-label">Comparar vs:</span>
        <button
          v-for="op in opciones.filter((o) => o.opcionId !== opcionActiva)"
          :key="op.opcionId"
          class="opcion-selector__vs-chip"
          type="button"
          @click="compararVs(op.opcionId)"
        >
          <span class="opcion-selector__swatch opcion-selector__swatch--chip" :style="{ background: op.color }" aria-hidden="true"></span>
          {{ op.sigla }}
        </button>
      </div>

      <ul v-if="opciones.length > 0" class="opcion-selector__lista" role="listbox" :aria-label="labelSelector">
        <li
          v-for="op in opciones"
          :key="op.opcionId"
          role="option"
          :aria-selected="opcionActiva === op.opcionId"
          class="opcion-selector__item"
          :class="{ 'opcion-selector__item--activa': opcionActiva === op.opcionId }"
          @click="seleccionar(op.opcionId)"
        >
          <span class="opcion-selector__swatch" :style="{ background: op.color }" aria-hidden="true"></span>
          <span class="opcion-selector__sigla">{{ op.sigla }}</span>
          <span class="opcion-selector__nombre">{{ op.nombre }}</span>
        </li>
      </ul>
      <p v-else class="opcion-selector__cargando">Cargando opciones…</p>
    </template>

  </section>
</template>

<style scoped>
.opcion-selector {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
}

.opcion-selector__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.opcion-selector__label {
  font-weight: 600;
  color: #374151;
}

.opcion-selector__clear {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.75rem;
  color: #6b7280;
  min-height: 44px;
}
.opcion-selector__clear:hover {
  background: #f3f4f6;
}

.opcion-selector__activa {
  margin-bottom: 0.25rem;
  color: #374151;
  font-size: 0.8125rem;
}

.opcion-selector__lista {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 12rem;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
}

.opcion-selector__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  min-height: 44px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
}
.opcion-selector__item:last-child {
  border-bottom: none;
}
.opcion-selector__item:hover {
  background: #f9fafb;
}
.opcion-selector__item--activa {
  background: #eff6ff;
  font-weight: 600;
}

.opcion-selector__swatch {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 0.125rem;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.opcion-selector__sigla {
  font-weight: 700;
  min-width: 2.5rem;
  color: #111827;
}

.opcion-selector__nombre {
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opcion-selector__cargando {
  color: #9ca3af;
  font-size: 0.8125rem;
  margin: 0;
  padding: 0.5rem 0;
}

/* Dual mode header (Story 4.4) */
.opcion-selector__dual-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0;
  margin-bottom: 0.25rem;
  font-size: 0.8125rem;
}
.opcion-selector__dual-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
.opcion-selector__dual-vs {
  color: #6b7280;
  font-size: 0.75rem;
  padding: 0 0.125rem;
}

/* Chips "Comparar vs:" (Story 4.4) */
.opcion-selector__vs-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
}
.opcion-selector__vs-label {
  color: #6b7280;
  white-space: nowrap;
}
.opcion-selector__vs-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 9999px;
  background: #f9fafb;
  font-size: 0.75rem;
  font-weight: 700;
  color: #374151;
  cursor: pointer;
  min-height: 28px;
}
.opcion-selector__vs-chip:hover {
  background: #eff6ff;
  border-color: #93c5fd;
}
.opcion-selector__swatch--chip {
  width: 0.625rem;
  height: 0.625rem;
}
</style>

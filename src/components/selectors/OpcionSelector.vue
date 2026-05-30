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
import { $selection, commit } from '../../stores/map-state';

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
</script>

<template>
  <section class="opcion-selector" aria-label="Selector de opción electoral">
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
</style>

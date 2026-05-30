<script setup lang="ts">
/**
 * Ficha de zona (Story 2.4). Bottom sheet en mobile, panel lateral en desktop.
 * Muestra ganador, votos, %, blanco/anulados/observados para la zona seleccionada.
 */

interface SelInfo {
  geoId: string;
  sigla: string;
  nombre: string;
  color: string;
  votoGanador: number;
  validos: number;
  pct: number;
  enBlanco: number;
  anulados: number;
  observados: number;
  pctOpcionActiva: number | null;
}

const props = defineProps<{
  sel: SelInfo | null;
  opcionSigla: string | null;
}>();

const emit = defineEmits<{ close: [] }>();

let touchStartY = 0;
function onTouchStart(e: TouchEvent): void { touchStartY = e.touches[0].clientY; }
function onTouchEnd(e: TouchEvent): void {
  if (e.changedTouches[0].clientY - touchStartY > 80) emit('close');
}

function fmt(n: number): string {
  return n.toLocaleString('es-UY');
}
</script>

<template>
  <div
    class="zone-sheet"
    :class="{ 'zone-sheet--open': !!sel }"
    aria-live="polite"
    aria-atomic="true"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <template v-if="sel">
      <!-- Handle de swipe (mobile) -->
      <div class="zone-sheet__handle" aria-hidden="true"></div>

      <header class="zone-sheet__header">
        <h2 class="zone-sheet__titulo">{{ sel.geoId }}</h2>
        <button
          class="zone-sheet__cerrar"
          type="button"
          aria-label="Cerrar ficha"
          @click="emit('close')"
        >✕</button>
      </header>

      <div class="zone-sheet__body">
        <!-- Ganador destacado -->
        <div class="zone-sheet__ganador">
          <span
            class="zone-sheet__swatch"
            :style="{ background: sel.color }"
            aria-hidden="true"
          ></span>
          <div class="zone-sheet__ganador-info">
            <span class="zone-sheet__ganador-sigla">{{ sel.sigla }}</span>
            <span class="zone-sheet__ganador-nombre">{{ sel.nombre }}</span>
          </div>
          <div class="zone-sheet__ganador-votos">
            <span class="zone-sheet__num-grande">{{ sel.pct.toFixed(1) }}%</span>
            <span class="zone-sheet__num-chico">{{ fmt(sel.votoGanador) }} votos</span>
          </div>
        </div>

        <!-- Opción activa seleccionada (modo opcion) -->
        <div v-if="sel.pctOpcionActiva !== null && opcionSigla" class="zone-sheet__opcion-activa">
          <span class="zone-sheet__opcion-label">{{ opcionSigla }} en esta zona:</span>
          <strong>{{ sel.pctOpcionActiva.toFixed(1) }}%</strong>
        </div>

        <!-- Totales -->
        <dl class="zone-sheet__dl">
          <div class="zone-sheet__dl-row">
            <dt>Votos válidos</dt>
            <dd>{{ fmt(sel.validos) }}</dd>
          </div>
          <div class="zone-sheet__dl-row zone-sheet__dl-row--muted">
            <dt>En blanco</dt>
            <dd>{{ fmt(sel.enBlanco) }}</dd>
          </div>
          <div class="zone-sheet__dl-row zone-sheet__dl-row--muted">
            <dt>Anulados</dt>
            <dd>{{ fmt(sel.anulados) }}</dd>
          </div>
          <div class="zone-sheet__dl-row zone-sheet__dl-row--muted">
            <dt>Observados</dt>
            <dd>{{ fmt(sel.observados) }}</dd>
          </div>
        </dl>

        <p class="zone-sheet__fuente">Corte Electoral — escrutinio definitivo</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.zone-sheet {
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.25s ease;
}
.zone-sheet--open {
  max-height: 420px;
  overflow-y: auto;
}

/* Mobile: bottom sheet fijo */
@media (max-width: 639px) {
  .zone-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 1rem 1rem 0 0;
    border-top: none;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
    z-index: 50;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.25s ease;
  }
  .zone-sheet--open {
    max-height: 65vh;
    overflow-y: auto;
  }
}

.zone-sheet__handle {
  width: 2.5rem;
  height: 0.25rem;
  background: #d1d5db;
  border-radius: 9999px;
  margin: 0.625rem auto 0;
}

.zone-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem 0.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.zone-sheet__titulo {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.zone-sheet__cerrar {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem 0.5rem;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
}
.zone-sheet__cerrar:hover {
  background: #f3f4f6;
}

.zone-sheet__body {
  padding: 0.75rem 1rem 1rem;
}

.zone-sheet__ganador {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
}

.zone-sheet__swatch {
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.zone-sheet__ganador-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.zone-sheet__ganador-sigla {
  font-size: 1.125rem;
  font-weight: 800;
  color: #111827;
  line-height: 1.2;
}

.zone-sheet__ganador-nombre {
  font-size: 0.75rem;
  color: #6b7280;
}

.zone-sheet__ganador-votos {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.zone-sheet__num-grande {
  font-size: 1.375rem;
  font-weight: 800;
  color: #111827;
  line-height: 1;
}

.zone-sheet__num-chico {
  font-size: 0.75rem;
  color: #6b7280;
}

.zone-sheet__opcion-activa {
  font-size: 0.8125rem;
  padding: 0.375rem 0.5rem;
  background: #eff6ff;
  border-radius: 0.25rem;
  margin-bottom: 0.75rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.zone-sheet__opcion-label {
  color: #3b82f6;
}

.zone-sheet__dl {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  margin: 0 0 0.75rem;
}

.zone-sheet__dl-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.zone-sheet__dl-row dt {
  color: #374151;
}

.zone-sheet__dl-row dd {
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.zone-sheet__dl-row--muted dt,
.zone-sheet__dl-row--muted dd {
  color: #9ca3af;
  font-weight: 400;
}

.zone-sheet__fuente {
  font-size: 0.6875rem;
  color: #9ca3af;
  margin: 0;
}
</style>

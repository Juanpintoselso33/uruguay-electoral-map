<script setup lang="ts">
/**
 * Ficha de zona (Story 2.4). Bottom sheet en mobile, panel lateral en desktop.
 * Muestra ganador, votos, %, blanco/anulados/observados para la zona seleccionada.
 */

interface DesgloseGrupo {
  lemaNombre: string;
  sigla: string;
  color: string;
  flagUrl?: string | null;
  total: number;
  hojas: { id: string; label: string; votos: number }[];
  masN: number;
}
interface SelInfo {
  geoId: string;
  label?: string;
  sigla: string;
  nombre: string;
  color: string;
  flagUrl?: string | null;
  votoGanador: number;
  validos: number;
  pct: number;
  enBlanco: number;
  anulados: number;
  observados: number;
  pctOpcionActiva: number | null;
  // Epic 10 (Story 10.5): desglose por hoja de la selección en esta zona.
  seleccionTotal?: number;
  seleccionPct?: number;
  desglose?: DesgloseGrupo[];
  esCiudadGrande?: boolean;
  // Ficha por circuito/local: metadata del local + desglose de sus circuitos.
  local?: { nombre: string; direccion: string; habilitados: number };
  circuitos?: { circuito: string; sigla: string; nombre: string; color: string; flagUrl?: string | null; validos: number }[];
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

/** % de los votos válidos de la zona (mismo denominador que el ganador y la selección). */
function pctValidos(n: number): string {
  const v = props.sel?.validos ?? 0;
  return v > 0 ? `${((100 * n) / v).toFixed(1)}%` : '—';
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
        <h2 class="zone-sheet__titulo">{{ sel.label ?? sel.geoId }}</h2>
        <button
          class="zone-sheet__cerrar"
          type="button"
          aria-label="Cerrar ficha"
          @click="emit('close')"
        >✕</button>
      </header>

      <!-- Ficha por circuito/local: dirección + habilitados del lugar de votación -->
      <p v-if="sel.local" class="zone-sheet__local-meta">
        <span v-if="sel.local.direccion">{{ sel.local.direccion }}</span>
        <span v-if="sel.local.habilitados" class="zone-sheet__local-hab">· {{ fmt(sel.local.habilitados) }} habilitados</span>
        <span v-if="sel.circuitos && sel.circuitos.length" class="zone-sheet__local-hab">· {{ sel.circuitos.length }} circuito(s)</span>
      </p>

      <p v-if="sel.esCiudadGrande" class="zone-sheet__degradacion">
        Vista por barrio no disponible aún — mostrando resultado agregado de la ciudad
      </p>

      <div class="zone-sheet__body">
        <!-- Desglose por hoja de la selección (Epic 10, Story 10.5) -->
        <template v-if="sel.desglose && sel.desglose.length > 0">
          <div class="zone-sheet__sel-resumen">
            <span class="zone-sheet__sel-label">Tu selección en esta zona</span>
            <span class="zone-sheet__sel-num">
              <strong>{{ fmt(sel.seleccionTotal ?? 0) }}</strong> votos
              <template v-if="sel.seleccionPct !== undefined">· {{ sel.seleccionPct.toFixed(1) }}%</template>
            </span>
          </div>
          <div class="zone-sheet__desglose">
            <div v-for="g in sel.desglose" :key="g.lemaNombre" class="zone-sheet__grupo">
              <div class="zone-sheet__grupo-head">
                <img v-if="g.flagUrl" :src="g.flagUrl" :alt="g.sigla" class="zone-sheet__swatch--sm zone-sheet__flag--sm" aria-hidden="true" />
                <span v-else class="zone-sheet__swatch zone-sheet__swatch--sm" :style="{ background: g.color }" aria-hidden="true"></span>
                <span class="zone-sheet__grupo-sigla">{{ g.sigla }}</span>
                <span class="zone-sheet__grupo-nombre">{{ g.lemaNombre }}</span>
                <span class="zone-sheet__grupo-pct">{{ pctValidos(g.total) }}</span>
                <span class="zone-sheet__grupo-total">{{ fmt(g.total) }}</span>
              </div>
              <ul class="zone-sheet__hojas">
                <li v-for="h in g.hojas" :key="h.id" class="zone-sheet__hoja">
                  <span class="zone-sheet__hoja-label">{{ h.label }}</span>
                  <span class="zone-sheet__hoja-pct">{{ pctValidos(h.votos) }}</span>
                  <span class="zone-sheet__hoja-votos">{{ fmt(h.votos) }}</span>
                </li>
                <li v-if="g.masN > 0" class="zone-sheet__hoja zone-sheet__hoja--mas">y {{ g.masN }} más…</li>
              </ul>
            </div>
          </div>
          <!-- Ganador de la zona en compacto: cuando hay selección, NO se muestra el bloque
               grande (confunde "lo que seleccioné" con "quién ganó la zona"). -->
          <div class="zone-sheet__gano-zona">
            <span class="zone-sheet__gano-zona-label">Ganó la zona</span>
            <img v-if="sel.flagUrl" :src="sel.flagUrl" :alt="sel.sigla" class="zone-sheet__flag--sm" aria-hidden="true" />
            <span v-else class="zone-sheet__swatch--sm" :style="{ background: sel.color }" aria-hidden="true"></span>
            <span class="zone-sheet__gano-zona-sigla">{{ sel.sigla }}</span>
            <span class="zone-sheet__gano-zona-pct">{{ sel.pct.toFixed(1) }}% · {{ fmt(sel.votoGanador) }} votos</span>
          </div>
        </template>

        <!-- Ganador destacado (solo sin selección: con selección va el compacto de arriba) -->
        <div v-if="!(sel.desglose && sel.desglose.length > 0)" class="zone-sheet__ganador">
          <img
            v-if="sel.flagUrl"
            :src="sel.flagUrl"
            :alt="sel.sigla"
            class="zone-sheet__flag"
            aria-hidden="true"
          />
          <span
            v-else
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

        <!-- Ficha por circuito/local: desglose de los circuitos que votan en este local -->
        <div v-if="sel.circuitos && sel.circuitos.length > 1" class="zone-sheet__circuitos">
          <span class="zone-sheet__circuitos-titulo">Circuitos que votan acá</span>
          <ul class="zone-sheet__circuitos-lista">
            <li v-for="c in sel.circuitos" :key="c.circuito" class="zone-sheet__circuito">
              <span class="zone-sheet__circuito-n">Circuito {{ c.circuito }}</span>
              <img v-if="c.flagUrl" :src="c.flagUrl" :alt="c.sigla" class="zone-sheet__circuito-flag" aria-hidden="true" />
              <span v-else class="zone-sheet__circuito-swatch" :style="{ background: c.color }" aria-hidden="true"></span>
              <span class="zone-sheet__circuito-sigla">{{ c.sigla }}</span>
              <span class="zone-sheet__circuito-votos">{{ fmt(c.validos) }}</span>
            </li>
          </ul>
        </div>

        <p class="zone-sheet__fuente">Corte Electoral — escrutinio definitivo</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.zone-sheet {
  background: var(--color-card);
  border-top: 1px solid var(--color-border);
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
  background: var(--color-border-strong);
  border-radius: 9999px;
  margin: 0.625rem auto 0;
}

.zone-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem 0.5rem;
  border-bottom: 1px solid var(--color-surface-2);
}

.zone-sheet__titulo {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
}

.zone-sheet__cerrar {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: var(--color-ink-muted);
  padding: 0.25rem 0.5rem;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
}
.zone-sheet__cerrar:hover {
  background: var(--color-surface-2);
}

.zone-sheet__body {
  padding: 0.75rem 1rem 1rem;
}

.zone-sheet__ganador {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--color-surface-1);
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
.zone-sheet__flag {
  width: 3rem;
  height: 2rem;
  border-radius: 0.375rem;
  flex-shrink: 0;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
}
.zone-sheet__flag--sm {
  width: 1.125rem;
  height: 0.75rem;
  border-radius: 0.125rem;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(0,0,0,.1);
  flex-shrink: 0;
}

.zone-sheet__ganador-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.zone-sheet__ganador-sigla {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-ink);
  line-height: 1.2;
}

.zone-sheet__ganador-nombre {
  font-size: 0.75rem;
  color: var(--color-ink-muted);
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
  color: var(--color-ink);
  line-height: 1;
}

.zone-sheet__num-chico {
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}

.zone-sheet__opcion-activa {
  font-size: 0.8125rem;
  padding: 0.375rem 0.5rem;
  background: var(--color-highlight);
  border-radius: 0.25rem;
  margin-bottom: 0.75rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.zone-sheet__opcion-label {
  color: #3b82f6;
}

/* Desglose por hoja de la selección (Story 10.5) */
.zone-sheet__sel-resumen {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.5rem 0.625rem;
  background: var(--color-highlight);
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
}
.zone-sheet__sel-label { font-size: 0.75rem; color: var(--color-ink-soft); }
.zone-sheet__sel-num { font-size: 0.8125rem; color: var(--color-ink); }
.zone-sheet__sel-num strong { font-size: 1rem; }
.zone-sheet__desglose { margin-bottom: 0.75rem; }
.zone-sheet__grupo { border-top: 1px solid var(--color-surface-2); padding: 0.375rem 0; }
.zone-sheet__grupo-head {
  display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; font-weight: 600; color: var(--color-ink);
}
.zone-sheet__grupo-nombre { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-ink-soft); font-weight: 400; }
.zone-sheet__grupo-pct { font-variant-numeric: tabular-nums; color: var(--color-ink-soft); font-weight: 600; min-width: 3rem; text-align: right; }
.zone-sheet__grupo-total { font-weight: 700; font-variant-numeric: tabular-nums; min-width: 3rem; text-align: right; }
.zone-sheet__swatch--sm { width: 0.75rem; height: 0.75rem; border-radius: 0.125rem; box-shadow: inset 0 0 0 1px rgba(0,0,0,.1); flex-shrink: 0; }
.zone-sheet__hojas { list-style: none; margin: 0.125rem 0 0; padding: 0 0 0 1.125rem; }
.zone-sheet__hoja { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.75rem; color: var(--color-ink-soft); padding: 0.0625rem 0; }
.zone-sheet__hoja-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zone-sheet__hoja-pct { color: var(--color-ink-faint); font-variant-numeric: tabular-nums; min-width: 2.75rem; text-align: right; }
.zone-sheet__hoja-votos { font-variant-numeric: tabular-nums; min-width: 3rem; text-align: right; }
.zone-sheet__hoja--mas { color: var(--color-ink-faint); font-style: italic; }

/* Ganador de la zona en compacto (cuando hay selección) */
.zone-sheet__gano-zona {
  display: flex; align-items: center; gap: 0.375rem;
  font-size: 0.75rem; padding: 0.375rem 0.625rem; margin-bottom: 0.75rem;
  background: var(--color-surface-1); border-radius: 0.375rem;
}
.zone-sheet__gano-zona-label { color: var(--color-ink-muted); }
.zone-sheet__gano-zona-sigla { font-weight: 700; color: var(--color-ink); }
.zone-sheet__gano-zona-pct { margin-left: auto; color: var(--color-ink-soft); }

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
  border-bottom: 1px solid var(--color-surface-2);
}

.zone-sheet__dl-row dt {
  color: var(--color-ink-soft);
}

.zone-sheet__dl-row dd {
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
}

.zone-sheet__dl-row--muted dt,
.zone-sheet__dl-row--muted dd {
  color: var(--color-ink-faint);
  font-weight: 400;
}

.zone-sheet__fuente {
  font-size: 0.6875rem;
  color: var(--color-ink-faint);
  margin: 0;
}

.zone-sheet__degradacion {
  font-size: 0.6875rem;
  color: var(--color-ink-soft);
  font-style: italic;
  padding: 0.375rem 1rem 0;
  margin: 0;
}

/* Ficha por circuito/local */
.zone-sheet__local-meta {
  font-size: 0.75rem;
  color: var(--color-ink-muted);
  padding: 0 1rem;
  margin: -0.25rem 0 0;
  line-height: 1.4;
}
.zone-sheet__local-hab { white-space: nowrap; }
.zone-sheet__circuitos {
  margin-top: 0.75rem;
  border-top: 1px solid var(--color-border);
  padding-top: 0.5rem;
}
.zone-sheet__circuitos-titulo {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-ink-muted);
}
.zone-sheet__circuitos-lista { list-style: none; margin: 0.375rem 0 0; padding: 0; }
.zone-sheet__circuito {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.8125rem;
  border-bottom: 1px solid var(--color-border);
}
.zone-sheet__circuito-n { flex: 1; color: var(--color-ink-muted); }
.zone-sheet__circuito-flag { width: 1.25rem; height: 0.83rem; border-radius: 2px; flex: none; box-shadow: 0 0 0 1px rgba(0,0,0,.15); object-fit: cover; }
.zone-sheet__circuito-swatch { width: 0.8rem; height: 0.8rem; border-radius: 2px; flex: none; box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); }
.zone-sheet__circuito-sigla { font-weight: 700; min-width: 2.5rem; }
.zone-sheet__circuito-votos { font-variant-numeric: tabular-nums; color: var(--color-ink-muted); }
</style>

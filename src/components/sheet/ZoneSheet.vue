<script setup lang="ts">
/**
 * Ficha de zona (Story 2.4). Bottom sheet en mobile, panel lateral en desktop.
 * Muestra ganador, votos, %, blanco/anulados/observados para la zona seleccionada.
 */
import { ref, watch } from 'vue';
import DesgloseTree from './DesgloseTree.vue';
import type { TreeNode } from '../../lib/opcion-tree';

interface DesgloseGrupo {
  lemaNombre: string;
  sigla: string;
  color: string;
  flagUrl?: string | null;
  total: number;
  hojas: { id: string; label: string; votos: number }[];
  masN: number;
}
interface CandidatoLinea { candidato: string; votos: number; esVotoAlLema: boolean }
interface ResultadoLinea {
  opcionId: string;
  sigla: string;
  nombre: string;
  color: string;
  flagUrl?: string | null;
  votos: number;
  pct: number;
  esGanador: boolean;
  candidatos?: CandidatoLinea[];
}
interface SelInfo {
  geoId: string;
  label?: string;
  nivelLabel?: string;
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
  habilitados?: number;
  emitidos?: number;
  pctOpcionActiva: number | null;
  // Epic 10 (Story 10.5): desglose por hoja de la selección en esta zona.
  seleccionTotal?: number;
  seleccionPct?: number;
  desglose?: DesgloseGrupo[];
  /** Árbol COMPLETO del desglose de la contienda (lema → precand/sublema → lista). Sin truncar. */
  arbol?: TreeNode[];
  arbolTotal?: number;
  /** Ids de opciones seleccionadas en el acordeón — para resaltar nodos. */
  seleccionIds?: string[];
  resultadoZona?: ResultadoLinea[];
  intendenteElecto?: string | null;
  alcaldeElecto?: string | null;
  // Concejo Municipal completo (alcalde + 4 concejales) — municipales (Epic 22.7).
  concejo?: { cargo: 'alcalde' | 'concejal'; nombre: string; lema: string; hoja: string }[] | null;
  esCiudadGrande?: boolean;
  // Ficha por circuito/local: metadata del local + desglose de sus circuitos.
  local?: { nombre: string; direccion: string; habilitados: number };
  circuitos?: { circuito: string; sigla: string; nombre: string; color: string; flagUrl?: string | null; validos: number; arbol?: TreeNode[] }[];
}

const props = defineProps<{
  sel: SelInfo | null;
  opcionSigla: string | null;
}>();

// Plegable (Epic UX): el detalle de la zona seleccionada se puede esconder. Se reabre al
// seleccionar otra zona (es información on-demand). No persiste (efímero por selección).
const bodyOpen = ref(true);
// Circuitos expandidos (per-circuito): se resetea al cambiar de zona/local.
const circAbierto = ref<Set<string>>(new Set());
function toggleCirc(id: string): void {
  const s = new Set(circAbierto.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  circAbierto.value = s;
}
watch(() => props.sel?.geoId, () => { bodyOpen.value = true; circAbierto.value = new Set(); });

const emit = defineEmits<{ close: [] }>();

let touchStartY = 0;
function onTouchStart(e: TouchEvent): void { touchStartY = e.touches[0].clientY; }
function onTouchEnd(e: TouchEvent): void {
  if (e.changedTouches[0].clientY - touchStartY > 80) emit('close');
}

function fmt(n: number): string {
  return n.toLocaleString('es-UY');
}

// Los nombres de candidatos vienen en MAYÚSCULAS desde la Corte; los mostramos en Capitalización
// para que se lean mejor, dejando partículas (de, la, da…) en minúscula salvo al inicio.
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'di']);
function titleCase(s: string): string {
  return s
    .toLocaleLowerCase('es-UY')
    .split(/\s+/)
    .map((w, i) => (i > 0 && PARTICULAS.has(w) ? w : w.charAt(0).toLocaleUpperCase('es-UY') + w.slice(1)))
    .join(' ');
}

// Sigla legible del lema para el Concejo Municipal. Los miembros traen el lema como slug BARE
// (post sweep-party-consistency): 'nacional', 'frente-amplio', etc. (sin prefijo 'partido-').
const LEMA_SIGLA: Record<string, string> = {
  'frente-amplio': 'FA', 'nacional': 'PN', 'colorado': 'PC',
  'coalicion-republicana': 'CR', 'cabildo-abierto': 'CA', 'independiente': 'PI',
  'asamblea-popular': 'AP', 'ecologista-radical-intransigente': 'PERI',
  'avanzar-republicano': 'AR', 'constitucional-ambientalista': 'PCA',
  'por-los-cambios-necesarios-pcn': 'PCN', 'identidad-soberana': 'IS',
  'de-los-trabajadores': 'PT', 'trabajadores': 'PT',
};
// Nombre completo del partido por sigla (para el título accesible del Concejo).
const SIGLA_NOMBRE: Record<string, string> = {
  FA: 'Frente Amplio', PN: 'Partido Nacional', PC: 'Partido Colorado',
  CR: 'Coalición Republicana', CA: 'Cabildo Abierto', PI: 'Partido Independiente',
  AP: 'Asamblea Popular', PERI: 'Partido Ecologista Radical Intransigente',
  AR: 'Avanzar Republicano', PCA: 'Partido Constitucional Ambientalista',
  PCN: 'Por los Cambios Necesarios', IS: 'Identidad Soberana', PT: 'Partido de los Trabajadores',
};
// Siglas con archivo de bandera en public/flags/.
const FLAG_SIGLAS = new Set(['AP', 'AR', 'CA', 'CR', 'FA', 'IS', 'PC', 'PCA', 'PCN', 'PERI', 'PI', 'PN', 'PT']);
function lemaSigla(slug: string): string {
  return LEMA_SIGLA[slug] ?? titleCase(slug.replace(/-/g, ' '));
}
function lemaNombre(slug: string): string {
  const s = LEMA_SIGLA[slug];
  return (s && SIGLA_NOMBRE[s]) ?? lemaSigla(slug);
}
function lemaFlag(slug: string): string | null {
  const s = LEMA_SIGLA[slug];
  return s && FLAG_SIGLAS.has(s) ? `/flags/${s.toLowerCase()}.svg` : null;
}

/** % de los votos válidos de la zona (mismo denominador que el ganador y la selección). */
function pctValidos(n: number): string {
  const v = props.sel?.validos ?? 0;
  return v > 0 ? `${((100 * n) / v).toFixed(1)}%` : '—';
}
/** % genérico n/d (1 decimal). */
function pctDe(n: number, d: number): string {
  return d > 0 ? `${((100 * n) / d).toFixed(1)}%` : '—';
}
/** % sobre votos emitidos de la zona (denominador natural de blanco/anulados/observados). */
function pctEmit(n: number): string {
  const e = props.sel?.emitidos ?? 0;
  return e > 0 ? `${((100 * n) / e).toFixed(1)}%` : '';
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
        <button
          class="zone-sheet__toggle"
          type="button"
          :aria-expanded="bodyOpen"
          :aria-label="bodyOpen ? 'Plegar detalle de la zona' : 'Desplegar detalle de la zona'"
          @click="bodyOpen = !bodyOpen"
        >
          <span class="zone-sheet__chevron" :class="{ 'zone-sheet__chevron--open': bodyOpen }" aria-hidden="true">▸</span>
          <span class="zone-sheet__titles">
            <span class="zone-sheet__kicker">{{ sel.nivelLabel ?? 'Zona' }}</span>
            <span class="zone-sheet__titulo">{{ sel.label ?? sel.geoId }}</span>
          </span>
        </button>
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

      <div v-show="bodyOpen" class="zone-sheet__body">
        <!-- Resumen de la selección del acordeón (si hay opciones marcadas) -->
        <div v-if="sel.seleccionIds && sel.seleccionIds.length && sel.seleccionTotal !== undefined" class="zone-sheet__sel-resumen">
          <span class="zone-sheet__sel-label">Tu selección en esta zona</span>
          <span class="zone-sheet__sel-num">
            <strong>{{ fmt(sel.seleccionTotal) }}</strong> votos
            <template v-if="sel.seleccionPct !== undefined">· {{ sel.seleccionPct.toFixed(1) }}%</template>
          </span>
        </div>

        <!-- Desglose COMPLETO por lista (árbol, sin truncar; agrupado según el tipo de elección) -->
        <template v-if="sel.arbol && sel.arbol.length > 0">
          <div class="zone-sheet__gano-zona">
            <span class="zone-sheet__gano-zona-label">Ganó acá</span>
            <img v-if="sel.flagUrl" :src="sel.flagUrl" :alt="sel.sigla" class="zone-sheet__flag--sm" aria-hidden="true" />
            <span v-else class="zone-sheet__swatch--sm" :style="{ background: sel.color }" aria-hidden="true"></span>
            <span class="zone-sheet__gano-zona-sigla">{{ sel.sigla }}</span>
            <span class="zone-sheet__gano-zona-pct">{{ sel.pct.toFixed(1) }}% · {{ fmt(sel.votoGanador) }} votos</span>
          </div>
          <p v-if="sel.intendenteElecto" class="zone-sheet__electo">
            Intendente electo: <strong>{{ titleCase(sel.intendenteElecto) }}</strong>
          </p>
          <p v-if="sel.alcaldeElecto" class="zone-sheet__electo">
            Alcalde electo: <strong>{{ titleCase(sel.alcaldeElecto) }}</strong>
          </p>
          <div class="zone-sheet__arbol">
            <span class="zone-sheet__arbol-titulo">Resultado por lista</span>
            <DesgloseTree :nodes="sel.arbol" :validos="sel.validos" :seleccion-ids="sel.seleccionIds" />
          </div>
        </template>

        <!-- Fallback: ranking de TODAS las opciones (cuando no se pudo armar el árbol). En
             departamentales nacional cada partido lista sus candidatos a intendente. -->
        <div v-if="!(sel.arbol && sel.arbol.length > 0) && sel.resultadoZona && sel.resultadoZona.length > 0" class="zone-sheet__ranking">
          <div
            v-for="r in sel.resultadoZona"
            :key="r.opcionId"
            class="zone-sheet__rfila"
            :class="{ 'zone-sheet__rfila--ganador': r.esGanador }"
          >
            <div class="zone-sheet__rhead">
              <span v-if="r.esGanador" class="zone-sheet__rbadge">Ganador</span>
              <img v-if="r.flagUrl" :src="r.flagUrl" :alt="r.sigla" class="zone-sheet__flag--sm" aria-hidden="true" />
              <span v-else class="zone-sheet__swatch--sm" :style="{ background: r.color }" aria-hidden="true"></span>
              <span class="zone-sheet__rsigla">{{ r.sigla }}</span>
              <span v-if="r.nombre !== r.sigla" class="zone-sheet__rnombre">{{ r.nombre }}</span>
              <span class="zone-sheet__rpct">{{ r.pct.toFixed(1) }}%</span>
              <span class="zone-sheet__rvotos">{{ fmt(r.votos) }}</span>
            </div>
            <span class="zone-sheet__rbar" aria-hidden="true">
              <span class="zone-sheet__rbar-fill" :style="{ width: r.pct + '%', background: r.color }"></span>
            </span>
            <p v-if="r.esGanador && sel.intendenteElecto" class="zone-sheet__electo">
              Intendente electo: <strong>{{ titleCase(sel.intendenteElecto) }}</strong>
            </p>
            <p v-if="r.esGanador && sel.alcaldeElecto" class="zone-sheet__electo">
              Alcalde electo: <strong>{{ titleCase(sel.alcaldeElecto) }}</strong>
            </p>
            <ul v-if="r.candidatos && r.candidatos.length" class="zone-sheet__cands">
              <li
                v-for="c in r.candidatos"
                :key="c.candidato"
                class="zone-sheet__cand"
                :class="{ 'zone-sheet__cand--vl': c.esVotoAlLema }"
              >
                <span class="zone-sheet__cand-nombre">{{ c.esVotoAlLema ? 'Voto al lema' : titleCase(c.candidato) }}</span>
                <span class="zone-sheet__cand-votos">{{ fmt(c.votos) }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Concejo Municipal (Epic 22.7): los 5 cargos (alcalde + 4 concejales) adjudicados por
             D'Hondt sobre el escrutinio definitivo; nombres de la Integración de hojas. -->
        <div v-if="sel.concejo && sel.concejo.length" class="zone-sheet__concejo">
          <h3 class="zone-sheet__concejo-titulo">Concejo Municipal</h3>
          <ul class="zone-sheet__concejo-lista">
            <li
              v-for="(m, i) in sel.concejo"
              :key="i"
              class="zone-sheet__concejo-item"
              :class="{ 'zone-sheet__concejo-item--alcalde': m.cargo === 'alcalde' }"
            >
              <span class="zone-sheet__concejo-cargo">{{ m.cargo === 'alcalde' ? 'Alcalde' : 'Concejal' }}</span>
              <span class="zone-sheet__concejo-nombre">{{ titleCase(m.nombre) }}</span>
              <span class="zone-sheet__concejo-lema" :title="`${lemaNombre(m.lema)} · hoja ${m.hoja}`">
                <img
                  v-if="lemaFlag(m.lema)"
                  :src="lemaFlag(m.lema)!"
                  :alt="lemaNombre(m.lema)"
                  class="zone-sheet__concejo-flag"
                  aria-hidden="true"
                />
                <span class="zone-sheet__concejo-sigla">{{ lemaSigla(m.lema) }}</span>
                <span class="zone-sheet__concejo-hoja">{{ m.hoja }}</span>
              </span>
            </li>
          </ul>
        </div>

        <!-- Ganador destacado (fallback: sin árbol, sin selección y sin ranking de zona disponible) -->
        <div v-if="!(sel.arbol && sel.arbol.length > 0) && !(sel.desglose && sel.desglose.length > 0) && !(sel.resultadoZona && sel.resultadoZona.length > 0)" class="zone-sheet__ganador">
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
            <span v-if="sel.nombre !== sel.sigla" class="zone-sheet__ganador-nombre">{{ sel.nombre }}</span>
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

        <!-- Participación / abstención (Epic no-partidarios) -->
        <div v-if="sel.emitidos && sel.habilitados" class="zone-sheet__part">
          <div class="zone-sheet__part-item">
            <span class="zone-sheet__part-label">Participación</span>
            <strong>{{ pctDe(sel.emitidos, sel.habilitados) }}</strong>
            <span class="zone-sheet__part-sub">{{ fmt(sel.emitidos) }} / {{ fmt(sel.habilitados) }}</span>
          </div>
          <div class="zone-sheet__part-item">
            <span class="zone-sheet__part-label">Abstención</span>
            <strong>{{ pctDe(sel.habilitados - sel.emitidos, sel.habilitados) }}</strong>
          </div>
        </div>

        <!-- Totales (con % sobre emitidos para no-partidarios) -->
        <dl class="zone-sheet__dl">
          <div class="zone-sheet__dl-row">
            <dt>Votos válidos</dt>
            <dd>{{ fmt(sel.validos) }}<span v-if="sel.emitidos" class="zone-sheet__dl-pct">{{ pctEmit(sel.validos) }}</span></dd>
          </div>
          <div class="zone-sheet__dl-row zone-sheet__dl-row--muted">
            <dt>En blanco</dt>
            <dd>{{ fmt(sel.enBlanco) }}<span v-if="sel.emitidos" class="zone-sheet__dl-pct">{{ pctEmit(sel.enBlanco) }}</span></dd>
          </div>
          <div class="zone-sheet__dl-row zone-sheet__dl-row--muted">
            <dt>Anulados</dt>
            <dd>{{ fmt(sel.anulados) }}<span v-if="sel.emitidos" class="zone-sheet__dl-pct">{{ pctEmit(sel.anulados) }}</span></dd>
          </div>
          <div class="zone-sheet__dl-row zone-sheet__dl-row--muted">
            <dt>Observados</dt>
            <dd>{{ fmt(sel.observados) }}<span v-if="sel.emitidos" class="zone-sheet__dl-pct">{{ pctEmit(sel.observados) }}</span></dd>
          </div>
        </dl>

        <!-- Ficha por circuito/local: cómo salió cada circuito que vota en este local. Si hay
             desglose por opción del circuito (votes-circuito), cada fila se expande a su árbol. -->
        <div v-if="sel.circuitos && sel.circuitos.length > 1" class="zone-sheet__circuitos">
          <span class="zone-sheet__circuitos-titulo">Circuitos que votan acá</span>
          <ul class="zone-sheet__circuitos-lista">
            <li v-for="c in sel.circuitos" :key="c.circuito" class="zone-sheet__circuito-wrap">
              <component
                :is="c.arbol && c.arbol.length ? 'button' : 'div'"
                class="zone-sheet__circuito"
                :class="{ 'zone-sheet__circuito--btn': c.arbol && c.arbol.length }"
                :type="c.arbol && c.arbol.length ? 'button' : undefined"
                :aria-expanded="c.arbol && c.arbol.length ? circAbierto.has(c.circuito) : undefined"
                @click="c.arbol && c.arbol.length ? toggleCirc(c.circuito) : null"
              >
                <span
                  v-if="c.arbol && c.arbol.length"
                  class="zone-sheet__circuito-chev"
                  :class="{ 'zone-sheet__circuito-chev--open': circAbierto.has(c.circuito) }"
                  aria-hidden="true"
                >▸</span>
                <span class="zone-sheet__circuito-n">Circuito {{ c.circuito }}</span>
                <img v-if="c.flagUrl" :src="c.flagUrl" :alt="c.sigla" class="zone-sheet__circuito-flag" aria-hidden="true" />
                <span v-else class="zone-sheet__circuito-swatch" :style="{ background: c.color }" aria-hidden="true"></span>
                <span class="zone-sheet__circuito-sigla">{{ c.sigla }}</span>
                <span class="zone-sheet__circuito-votos">{{ fmt(c.validos) }}</span>
              </component>
              <DesgloseTree
                v-if="c.arbol && c.arbol.length && circAbierto.has(c.circuito)"
                :nodes="c.arbol"
                :validos="c.validos"
              />
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
/* Sin scroll: se ve todo el contenido (max-height alto solo para animar el colapso). */
.zone-sheet--open {
  max-height: 2000px;
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

/* Toda la fila título es el toggle (plegable como ResultadoGlobal/OpcionAccordion). */
.zone-sheet__toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: left;
  color: inherit;
}
.zone-sheet__chevron {
  display: inline-block;
  font-size: 0.8125rem;
  color: var(--color-ink-faint);
  transition: transform 0.15s ease;
  flex: none;
}
.zone-sheet__chevron--open { transform: rotate(90deg); }
.zone-sheet__titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.zone-sheet__kicker {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ink-muted);
  line-height: 1.2;
}
.zone-sheet__titulo {
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

/* Ranking de partidos de la zona (sin selección) + candidatos a intendente. */
.zone-sheet__ranking { margin-bottom: 0.75rem; }
.zone-sheet__rfila {
  padding: 0.5rem 0;
  border-top: 1px solid var(--color-surface-2);
}
.zone-sheet__rfila:first-child { border-top: none; }
.zone-sheet__rfila--ganador {
  background: var(--color-surface-1);
  border-radius: 0.5rem;
  border-top: none;
  padding: 0.625rem;
  margin-bottom: 0.25rem;
}
.zone-sheet__rhead {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}
.zone-sheet__rbadge {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-card);
  background: var(--color-ink);
  border-radius: 9999px;
  padding: 0.0625rem 0.375rem;
  flex-shrink: 0;
}
.zone-sheet__rsigla { font-weight: 800; color: var(--color-ink); flex-shrink: 0; }
.zone-sheet__rnombre {
  color: var(--color-ink-muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.zone-sheet__rpct { font-weight: 800; color: var(--color-ink); font-variant-numeric: tabular-nums; margin-left: auto; }
.zone-sheet__rvotos { color: var(--color-ink-muted); font-variant-numeric: tabular-nums; min-width: 3.5rem; text-align: right; }
.zone-sheet__rbar {
  display: block;
  height: 0.375rem;
  border-radius: 9999px;
  background: var(--color-surface-2);
  overflow: hidden;
  margin: 0.375rem 0 0;
}
.zone-sheet__rbar-fill { display: block; height: 100%; border-radius: 9999px; min-width: 2px; }
.zone-sheet__electo {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-ink);
}
.zone-sheet__electo strong { font-weight: 700; }
.zone-sheet__cands {
  list-style: none;
  margin: 0.375rem 0 0;
  padding: 0 0 0 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
}
.zone-sheet__cand {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-ink-soft);
}
.zone-sheet__cand-nombre { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zone-sheet__cand-votos { color: var(--color-ink-muted); font-variant-numeric: tabular-nums; }
.zone-sheet__cand--vl { color: var(--color-ink-faint); font-style: italic; }

/* Concejo Municipal (Epic 22.7) */
.zone-sheet__concejo {
  margin: 0.875rem 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}
.zone-sheet__concejo-titulo {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-ink);
}
.zone-sheet__concejo-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.zone-sheet__concejo-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-ink-soft);
}
.zone-sheet__concejo-item--alcalde { color: var(--color-ink); font-weight: 600; }
.zone-sheet__concejo-cargo {
  flex: 0 0 4.5rem;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-ink-muted);
}
.zone-sheet__concejo-item--alcalde .zone-sheet__concejo-cargo { color: var(--color-ink-soft); }
.zone-sheet__concejo-nombre { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zone-sheet__concejo-lema {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--color-ink-muted);
  white-space: nowrap;
  flex: none;
}
.zone-sheet__concejo-flag {
  width: 1.125rem;
  height: 0.75rem;
  border-radius: 0.125rem;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
  flex: none;
}
.zone-sheet__concejo-sigla { font-weight: 700; color: var(--color-ink-soft); }
.zone-sheet__concejo-hoja { color: var(--color-ink-faint); font-variant-numeric: tabular-nums; }

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
.zone-sheet__dl-row dd { display: flex; align-items: baseline; gap: 0.5rem; }
.zone-sheet__dl-pct { color: var(--color-ink-faint); font-variant-numeric: tabular-nums; font-weight: 400; min-width: 3rem; text-align: right; }

/* Participación / abstención */
.zone-sheet__part { display: flex; gap: 0.5rem; margin: 0 0 0.75rem; }
.zone-sheet__part-item {
  flex: 1; background: var(--color-surface-1); border-radius: 0.375rem;
  padding: 0.5rem 0.625rem; display: flex; flex-direction: column; gap: 0.0625rem;
}
.zone-sheet__part-label { font-size: 0.6875rem; color: var(--color-ink-muted); }
.zone-sheet__part-item strong { font-size: 1.125rem; color: var(--color-ink); line-height: 1.1; }
.zone-sheet__part-sub { font-size: 0.6875rem; color: var(--color-ink-faint); font-variant-numeric: tabular-nums; }

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

/* Árbol completo del desglose por lista (DesgloseTree). */
.zone-sheet__arbol { margin-top: 0.5rem; }
.zone-sheet__arbol-titulo {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  margin-bottom: 0.25rem;
}
/* Circuitos expandibles. */
.zone-sheet__circuito-wrap { border-bottom: 1px solid var(--color-border); }
.zone-sheet__circuito-wrap > .zone-sheet__circuito { border-bottom: 0; }
.zone-sheet__circuito--btn {
  width: 100%;
  background: none;
  border: 0;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.zone-sheet__circuito-chev {
  flex: none;
  width: 0.8rem;
  color: var(--color-ink-muted);
  transition: transform 0.12s;
  font-size: 0.7rem;
}
.zone-sheet__circuito-chev--open { transform: rotate(90deg); }
</style>

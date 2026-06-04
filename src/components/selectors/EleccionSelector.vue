<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

interface Props {
  eleccionesDisponibles: string[];
  eleccionActual: string;
  departamento: string;
  /** Vista nacional (Epic 15): los links van a `/${id}` (ruta nacional) en vez de `/${id}/${depto}`. */
  nacional?: boolean;
}
const props = defineProps<Props>();

/** Destino de un dot de elección: nacional → `/${id}`, por-depto → `/${id}/${depto}`. */
function hrefDe(id: string): string {
  return props.nacional ? `/${id}` : `/${id}/${props.departamento}`;
}

type TipoEleccion = 'internas' | 'nacionales' | 'balotaje' | 'dptales' | 'plebiscito';
const META: Record<string, { short: string; type: TipoEleccion; año: number }> = {
  'nacionales-2014':                  { short: 'Nacionales',       type: 'nacionales',  año: 2014 },
  'balotaje-2014':                    { short: 'Balotaje',         type: 'balotaje',    año: 2014 },
  'internas-2019':                    { short: 'Internas',         type: 'internas',    año: 2019 },
  'nacionales-2019':                  { short: 'Nacionales',       type: 'nacionales',  año: 2019 },
  'plebiscito-vivir-sin-miedo-2019':  { short: 'Vivir sin Miedo',  type: 'plebiscito',  año: 2019 },
  'balotaje-2019':                    { short: 'Balotaje',         type: 'balotaje',    año: 2019 },
  'departamentales-2020':             { short: 'Departamentales',  type: 'dptales',     año: 2020 },
  'referendum-luc-2022':              { short: 'Referéndum LUC',   type: 'plebiscito',  año: 2022 },
  'internas-2024':                    { short: 'Internas',         type: 'internas',    año: 2024 },
  'nacionales-2024':                  { short: 'Nacionales',       type: 'nacionales',  año: 2024 },
  'plebiscito-allanamientos-2024':    { short: 'Allanamientos',    type: 'plebiscito',  año: 2024 },
  'plebiscito-seguridad-social-2024': { short: 'Seguridad Social', type: 'plebiscito',  año: 2024 },
  'balotaje-2024':                    { short: 'Balotaje',         type: 'balotaje',    año: 2024 },
  'departamentales-2025':             { short: 'Departamentales',  type: 'dptales',     año: 2025 },
  'municipales-2025':                 { short: 'Municipales',      type: 'dptales',     año: 2025 },
  'municipales-2020':                 { short: 'Municipales',      type: 'dptales',     año: 2020 },
};

const ALL_IDS = Object.keys(META);

interface Item {
  id: string;
  short: string;
  type: TipoEleccion;
  año: number;
  disponible: boolean;
}
interface Grupo {
  año: number;
  items: Item[];
}

// Agrupar por AÑO (consecutivos): un encabezado de año por grupo, no por dot (consistente).
const grupos: Grupo[] = [];
for (const e of ALL_IDS) {
  const m = META[e];
  const item: Item = {
    id: e,
    short: m.short,
    type: m.type,
    año: m.año,
    disponible: props.eleccionesDisponibles.includes(e),
  };
  const last = grupos[grupos.length - 1];
  if (last && last.año === m.año) last.items.push(item);
  else grupos.push({ año: m.año, items: [item] });
}

const scrollRef = ref<HTMLElement | null>(null);
// Indicadores de scroll: hay más contenido a izquierda/derecha (fades + flechas).
const canLeft = ref(false);
const canRight = ref(false);
function updateScrollState() {
  const el = scrollRef.value;
  if (!el) return;
  canLeft.value = el.scrollLeft > 4;
  canRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
}
function nudge(dir: number) {
  scrollRef.value?.scrollBy({ left: dir * 240, behavior: 'smooth' });
}

let dragStartX = 0, dragStartScroll = 0, isDragging = false, hasMoved = false;

function onDragStart(e: MouseEvent) {
  isDragging = true;
  hasMoved = false;
  dragStartX = e.pageX;
  dragStartScroll = scrollRef.value?.scrollLeft ?? 0;
  scrollRef.value!.style.cursor = 'grabbing';
}
function onDragMove(e: MouseEvent) {
  if (!isDragging || !scrollRef.value) return;
  const dx = e.pageX - dragStartX;
  if (Math.abs(dx) > 4) hasMoved = true;
  scrollRef.value.scrollLeft = dragStartScroll - dx;
}
function onDragEnd() {
  isDragging = false;
  if (scrollRef.value) scrollRef.value.style.cursor = '';
}
function onClickCapture(e: MouseEvent) {
  if (hasMoved) { e.preventDefault(); e.stopPropagation(); hasMoved = false; }
}

onMounted(() => {
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);

  const el = scrollRef.value;
  if (!el) return;
  const active = el.querySelector<HTMLElement>('.esel__dot--activa');
  if (!active) return;
  const itemEl = active.closest<HTMLElement>('.esel__item');
  if (!itemEl) return;
  const elRect = el.getBoundingClientRect();
  const itemRect = itemEl.getBoundingClientRect();
  const relativeLeft = (itemRect.left - elRect.left) + el.scrollLeft;
  const offset = relativeLeft - el.clientWidth / 2 + itemEl.offsetWidth / 2;
  el.scrollLeft = Math.max(0, offset);
  updateScrollState();
  window.addEventListener('resize', updateScrollState);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  window.removeEventListener('resize', updateScrollState);
});
</script>

<template>
  <nav class="esel" aria-label="Seleccionar elección">
    <div class="esel__viewport">
    <span class="esel__fade esel__fade--left" :class="{ 'is-on': canLeft }" aria-hidden="true" />
    <span class="esel__fade esel__fade--right" :class="{ 'is-on': canRight }" aria-hidden="true" />
    <button v-show="canLeft" type="button" class="esel__nav esel__nav--left" aria-label="Ver elecciones anteriores" @click="nudge(-1)">‹</button>
    <button v-show="canRight" type="button" class="esel__nav esel__nav--right" aria-label="Ver elecciones siguientes" @click="nudge(1)">›</button>
    <div ref="scrollRef" class="esel__scroll" @mousedown="onDragStart" @click.capture="onClickCapture" @scroll="updateScrollState">
      <div class="esel__track">
        <div v-for="g in grupos" :key="g.año" class="esel__grupo">
          <span class="esel__year">{{ g.año }}</span>
          <div class="esel__grupo-body">
            <div class="esel__rail" aria-hidden="true" />
            <div class="esel__grupo-items">
              <template v-for="item in g.items" :key="item.id">
              <a
                v-if="item.disponible"
                :href="hrefDe(item.id)"
                class="esel__item esel__item--link"
                :class="[`esel__item--${item.type}`, { 'esel__item--activa': item.id === eleccionActual }]"
                :aria-current="item.id === eleccionActual ? 'page' : undefined"
                :aria-label="`${item.short} ${item.año}`"
                :title="`${item.short} ${item.año}`"
              >
                <span class="esel__dot" :class="{ 'esel__dot--activa': item.id === eleccionActual }" aria-hidden="true" />
                <span class="esel__label" :class="{ 'esel__label--activa': item.id === eleccionActual }">{{ item.short }}</span>
              </a>
              <div
                v-else
                class="esel__item esel__item--bloqueado"
                :class="`esel__item--${item.type}`"
                :title="`${item.short} ${item.año} — sin datos para este departamento`"
                aria-disabled="true"
              >
                <span class="esel__dot esel__dot--bloqueado" aria-hidden="true" />
                <span class="esel__label">{{ item.short }}</span>
              </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    <!-- Leyenda de formas por tipo de elección -->
    <ul class="esel__leyenda" aria-label="Referencia de formas">
      <li><span class="esel__shape esel__shape--circle" aria-hidden="true" /> Internas · Nacionales · Departamentales</li>
      <li><span class="esel__shape esel__shape--rombo" aria-hidden="true" /> Balotaje</li>
      <li><span class="esel__shape esel__shape--cuadrado" aria-hidden="true" /> Plebiscito · Referéndum</li>
    </ul>
  </nav>
</template>

<style scoped>
.esel {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-paper);
}

.esel__viewport { position: relative; }

.esel__scroll {
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0.625rem 1.25rem 0.75rem;
  cursor: grab;
}
.esel__scroll::-webkit-scrollbar { display: none; }

/* Fades de borde: señalan que hay más para scrollear */
.esel__fade {
  position: absolute; top: 0; bottom: 0; width: 2.5rem; z-index: 2;
  pointer-events: none; opacity: 0; transition: opacity 0.15s;
}
.esel__fade.is-on { opacity: 1; }
.esel__fade--left  { left: 0;  background: linear-gradient(to right, var(--color-paper), transparent); }
.esel__fade--right { right: 0; background: linear-gradient(to left,  var(--color-paper), transparent); }

/* Flechas de scroll (aparecen solo cuando hay overflow) */
.esel__nav {
  position: absolute; top: 1.1rem; z-index: 3;
  width: 28px; height: 28px; border-radius: 9999px;
  border: 1px solid var(--color-border-strong); background: var(--color-paper); color: var(--color-ink);
  display: grid; place-items: center; cursor: pointer; font-size: 1.1rem; line-height: 1;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}
.esel__nav:hover { background: var(--color-surface-2); }
.esel__nav:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.esel__nav--left  { left: 0.375rem; }
.esel__nav--right { right: 0.375rem; }

.esel__track {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;                /* separación entre grupos de año */
  min-width: max-content;
}

/* Grupo de año */
.esel__grupo {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.esel__grupo:not(:first-child)::before {  /* separador vertical entre años */
  content: '';
  position: absolute;
  left: -0.75rem;
  top: 6px;
  bottom: 18px;
  width: 1px;
  background: var(--color-border);
}

.esel__year {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-ink-muted);
  line-height: 1;
  margin-bottom: 6px;
  user-select: none;
}

.esel__grupo-body {
  position: relative;
}

/* Riel horizontal por grupo (detrás de los dots) */
.esel__rail {
  position: absolute;
  top: 11px;                  /* alineado al centro del dot con el nuevo padding del item */
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--color-border-strong);
  pointer-events: none;
  z-index: 0;
}

.esel__grupo-items {
  display: flex;
  align-items: flex-start;
}

.esel__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 64px;
  padding: 5px 6px 7px;        /* target táctil cómodo (~46px alto) */
  min-height: 46px;
  border-radius: 0.5rem;
  text-align: center;
  cursor: pointer;
  box-sizing: border-box;
}
.esel__item--link { text-decoration: none; color: inherit; }
.esel__item--link:hover { background: var(--color-surface-2); }
.esel__item--link:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
.esel__item--link:hover .esel__dot:not(.esel__dot--activa) { transform: scale(1.3); border-color: var(--color-ink-muted); }
.esel__item--balotaje.esel__item--link:hover .esel__dot:not(.esel__dot--activa) { transform: rotate(45deg) scale(1.25); }
/* Elección activa: pill de fondo + dot/label destacados (más claro que solo el dot relleno) */
.esel__item--activa { background: var(--color-card); box-shadow: inset 0 0 0 1px var(--color-border-strong); }
.esel__item--bloqueado {
  cursor: not-allowed;
  opacity: 0.38;
}

/* Dot — disponible */
.esel__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--color-border-strong);
  background: var(--color-paper);
  display: block;
  position: relative;
  z-index: 1;
  transition: transform 0.15s, border-color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.esel__dot:not(.esel__dot--bloqueado):hover,
.esel__dot:not(.esel__dot--bloqueado):focus-visible {
  transform: scale(1.3);
  border-color: var(--color-ink-muted);
  outline: none;
}

/* Dot — bloqueado (no disponible) */
.esel__dot--bloqueado {
  border-style: dashed;
  border-color: var(--color-border);
  background: transparent;
  cursor: not-allowed;
  pointer-events: none;
}

/* Dot — activa */
.esel__dot--activa {
  width: 14px;
  height: 14px;
  border-color: var(--color-ink);
  background: var(--color-ink);
  box-shadow: 0 0 0 3px var(--color-paper), 0 0 0 5px var(--color-ink);
}
.esel__dot--activa:hover { transform: none; }

/* Type variants — balotaje = rombo */
.esel__item--balotaje .esel__dot {
  border-radius: 3px;
  transform: rotate(45deg);
}
.esel__item--balotaje .esel__dot:not(.esel__dot--bloqueado):hover { transform: rotate(45deg) scale(1.25); }
.esel__item--balotaje .esel__dot--activa {
  transform: rotate(45deg);
  box-shadow: 0 0 0 3px var(--color-paper), 0 0 0 5px var(--color-ink);
}
.esel__item--balotaje .esel__dot--activa:hover { transform: rotate(45deg); }

/* Type variants — plebiscito = cuadrado pequeño */
.esel__item--plebiscito .esel__dot {
  border-radius: 2px;
  width: 10px;
  height: 10px;
}
.esel__item--plebiscito .esel__dot--activa {
  width: 12px;
  height: 12px;
}

/* Label */
.esel__label {
  margin-top: 6px;
  font-size: 0.625rem;
  color: var(--color-ink-faint);
  white-space: nowrap;
  line-height: 1.3;
  user-select: none;
}
.esel__label--activa {
  color: var(--color-ink);
  font-weight: 600;
}

/* Leyenda */
.esel__leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0;
  padding: 0 1.25rem 0.625rem;
  list-style: none;
  font-size: 0.625rem;
  color: var(--color-ink-faint);
}
.esel__leyenda li {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}
.esel__shape {
  display: inline-block;
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--color-ink-muted);
  background: var(--color-paper);
  flex-shrink: 0;
}
.esel__shape--circle { border-radius: 50%; }
.esel__shape--rombo { border-radius: 2px; transform: rotate(45deg); }
.esel__shape--cuadrado { border-radius: 1px; width: 8px; height: 8px; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

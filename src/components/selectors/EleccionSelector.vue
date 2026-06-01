<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

interface Props {
  eleccionesDisponibles: string[];
  eleccionActual: string;
  departamento: string;
}
const props = defineProps<Props>();

const META: Record<string, { short: string; type: 'internas' | 'nacionales' | 'balotaje' | 'dptales' | 'plebiscito'; año: number }> = {
  'nacionales-2014':                  { short: 'Nacionales', type: 'nacionales',  año: 2014 },
  'balotaje-2014':                    { short: 'Balotaje',   type: 'balotaje',    año: 2014 },
  'internas-2019':                    { short: 'Internas',   type: 'internas',    año: 2019 },
  'nacionales-2019':                  { short: 'Nacionales', type: 'nacionales',  año: 2019 },
  'balotaje-2019':                    { short: 'Balotaje',   type: 'balotaje',    año: 2019 },
  'departamentales-2020':             { short: 'Dptales.',   type: 'dptales',     año: 2020 },
  'referendum-luc-2022':              { short: 'Ref. LUC',   type: 'plebiscito',  año: 2022 },
  'internas-2024':                    { short: 'Internas',   type: 'internas',    año: 2024 },
  'nacionales-2024':                  { short: 'Nacionales', type: 'nacionales',  año: 2024 },
  'plebiscito-allanamientos-2024':    { short: 'Pleb. All.', type: 'plebiscito',  año: 2024 },
  'plebiscito-seguridad-social-2024': { short: 'Pleb. SS',   type: 'plebiscito',  año: 2024 },
  'balotaje-2024':                    { short: 'Balotaje',   type: 'balotaje',    año: 2024 },
  'departamentales-2025':             { short: 'Dptales.',   type: 'dptales',     año: 2025 },
};

const ALL_IDS = Object.keys(META);

interface Item {
  id: string;
  short: string;
  type: string;
  año: number;
  showYear: boolean;
  disponible: boolean;
}

const items: Item[] = ALL_IDS.map((e, i) => {
  const m = META[e];
  const prev = i > 0 ? META[ALL_IDS[i - 1]] : null;
  return {
    id: e,
    short: m.short,
    type: m.type,
    año: m.año,
    showYear: !prev || prev.año !== m.año,
    disponible: props.eleccionesDisponibles.includes(e),
  };
});

const scrollRef = ref<HTMLElement | null>(null);

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
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
});
</script>

<template>
  <nav class="esel" aria-label="Seleccionar elección">
    <div ref="scrollRef" class="esel__scroll" @mousedown="onDragStart" @click.capture="onClickCapture">
      <div class="esel__track">
        <div class="esel__rail" aria-hidden="true" />
        <div
          v-for="item in items"
          :key="item.id"
          class="esel__item"
          :class="[`esel__item--${item.type}`, { 'esel__item--bloqueado': !item.disponible }]"
        >
          <span class="esel__year" :class="{ 'esel__year--hidden': !item.showYear }">
            {{ item.año }}
          </span>
          <a
            v-if="item.disponible"
            :href="`/${item.id}/${departamento}`"
            class="esel__dot"
            :class="{ 'esel__dot--activa': item.id === eleccionActual }"
            :aria-current="item.id === eleccionActual ? 'page' : undefined"
            :title="item.short + ' ' + item.año"
          >
            <span class="sr-only">{{ item.short }} {{ item.año }}</span>
          </a>
          <span
            v-else
            class="esel__dot esel__dot--bloqueado"
            :title="`${item.short} ${item.año} — sin datos para este departamento`"
            aria-disabled="true"
          />
          <span class="esel__label" :class="{ 'esel__label--activa': item.id === eleccionActual }">
            {{ item.short }}
          </span>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.esel {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-paper);
}

.esel__scroll {
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0.625rem 1.25rem 0.875rem;
  cursor: grab;
}
.esel__scroll::-webkit-scrollbar { display: none; }

.esel__track {
  position: relative;
  display: flex;
  align-items: flex-start;
  min-width: max-content;
}

.esel__rail {
  position: absolute;
  top: 26px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-border-strong);
  pointer-events: none;
}

.esel__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
  padding: 0 6px;
  text-align: center;
  cursor: pointer;
}
.esel__item--bloqueado {
  cursor: not-allowed;
  opacity: 0.38;
}

/* Year marker */
.esel__year {
  height: 16px;
  margin-bottom: 4px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-ink-muted);
  line-height: 16px;
  white-space: nowrap;
  user-select: none;
}
.esel__year--hidden { visibility: hidden; }

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
  margin-top: 5px;
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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

<script setup lang="ts">
/**
 * Botón de captura del mapa como PNG (Story 6.2 — FR24).
 *
 * client:idle. Captura el canvas de MapLibre y agrega un encabezado con
 * departamento + elección. Requiere preserveDrawingBuffer: true en el Map init.
 * Descarga: {departamento}_{eleccion}_mapa.png
 */
import { ref } from 'vue';

const props = defineProps<{
  eleccion: string;
  departamento: string;
  deptLabel: string;
  eleccionLabel: string;
}>();

const isCapturing = ref(false);

const ELECCION_LABELS: Record<string, string> = {
  'internas-2024': 'Elecciones Internas 2024',
  'nacionales-2019': 'Elecciones Nacionales 2019',
};

async function capturar(): Promise<void> {
  if (isCapturing.value) return;
  isCapturing.value = true;
  try {
    // Esperar un frame para que MapLibre termine de renderizar
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const mapCanvas = document.querySelector<HTMLCanvasElement>('#map-persist canvas');
    if (!mapCanvas) return;

    const W = mapCanvas.width;
    const H = mapCanvas.height;
    const HEADER = Math.round(W * 0.07); // ~7% del alto del canvas para el título

    const out = document.createElement('canvas');
    out.width = W;
    out.height = H + HEADER;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    // Fondo blanco para el header
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, HEADER);

    // Título: departamento + elección
    const dept = props.deptLabel;
    const elecLabel = ELECCION_LABELS[props.eleccion] ?? props.eleccionLabel ?? props.eleccion;
    const fontSize = Math.max(12, Math.round(HEADER * 0.38));
    ctx.fillStyle = '#1a1916';
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(dept, Math.round(W * 0.03), Math.round(HEADER * 0.38));
    ctx.font = `400 ${Math.round(fontSize * 0.75)}px system-ui, sans-serif`;
    ctx.fillStyle = '#6b7280';
    ctx.fillText(elecLabel, Math.round(W * 0.03), Math.round(HEADER * 0.73));

    // Borde inferior del header
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, HEADER - 1, W, 1);

    // Mapa
    ctx.drawImage(mapCanvas, 0, HEADER);

    // Watermark discreto
    ctx.font = `400 ${Math.max(9, Math.round(fontSize * 0.6))}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(107,114,128,0.7)';
    ctx.textAlign = 'right';
    ctx.fillText('uruguay-electoral-map', W - Math.round(W * 0.02), H + HEADER - Math.round(HEADER * 0.25));

    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.departamento}_${props.eleccion}_mapa.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    isCapturing.value = false;
  }
}
</script>

<template>
  <button class="screenshot-btn" type="button" :disabled="isCapturing" @click="capturar">
    <svg class="screenshot-btn__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5.5 3V2.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    {{ isCapturing ? 'Guardando…' : 'Guardar mapa' }}
  </button>
</template>

<style scoped>
.screenshot-btn {
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
.screenshot-btn:hover:not(:disabled) {
  background: var(--color-surface-2);
  border-color: var(--color-ink-faint);
  color: var(--color-ink-soft);
}
.screenshot-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
.screenshot-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
.screenshot-btn__icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}
</style>

<script setup lang="ts">
/**
 * Epic 23 · Story 23.5 — Toggle de tema (claro / oscuro / auto).
 * Persiste el modo en localStorage ('ui:theme') y delega la aplicación del data-theme
 * al script anti-flash de Base.astro (window.__applyTheme), para una sola fuente de verdad.
 */
import { onMounted, ref } from 'vue';

type Mode = 'auto' | 'light' | 'dark';
const KEY = 'ui:theme';
const ORDER: Mode[] = ['auto', 'light', 'dark'];
const LABEL: Record<Mode, string> = { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: oscuro' };

// SSR-safe: arranca en 'auto' y sincroniza al montar (evita hydration mismatch).
const mode = ref<Mode>('auto');

onMounted(() => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') mode.value = v;
  } catch { /* ignore */ }
});

function cycle() {
  const next = ORDER[(ORDER.indexOf(mode.value) + 1) % ORDER.length];
  mode.value = next;
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  (window as unknown as { __applyTheme?: () => void }).__applyTheme?.();
}
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :title="LABEL[mode]"
    :aria-label="LABEL[mode]"
    @click="cycle"
  >
    <!-- auto: medio sol/luna -->
    <svg v-if="mode === 'auto'" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" />
      <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
    </svg>
    <!-- claro: sol -->
    <svg v-else-if="mode === 'light'" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8" />
      <g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
      </g>
    </svg>
    <!-- oscuro: luna -->
    <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-ink-soft);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.theme-toggle:hover {
  background: var(--color-surface-2);
  border-color: var(--color-border);
  color: var(--color-ink);
}
.theme-toggle:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
.theme-toggle svg { width: 19px; height: 19px; }
</style>

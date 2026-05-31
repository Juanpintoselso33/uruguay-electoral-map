<script setup lang="ts">
import { ref } from 'vue';

const copiado = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

async function handleShare(): Promise<void> {
  const url = window.location.href;
  let ok = false;

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      /* fall through to execCommand */
    }
  }

  if (!ok) {
    const el = document.createElement('input');
    el.value = url;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      /* execCommand también falló */
    }
    document.body.removeChild(el);
  }

  copiado.value = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    copiado.value = false;
  }, 2000);
}
</script>

<template>
  <button
    class="share-btn"
    :aria-label="copiado ? '¡Link copiado!' : 'Compartir esta vista'"
    type="button"
    @click="handleShare"
  >
    <span class="share-icon" aria-hidden="true">{{ copiado ? '✓' : '⎘' }}</span>
    <span class="share-label">{{ copiado ? '¡Copiado!' : 'Compartir' }}</span>
  </button>
</template>

<style scoped>
.share-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.65rem;
  min-height: 44px;
  min-width: 44px;
  font-size: 0.8rem;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: transparent;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.share-btn:hover {
  background: #f3f4f6;
}
.share-btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}
.share-icon {
  font-size: 1rem;
  line-height: 1;
}
</style>

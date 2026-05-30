<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const mapContainer = ref(null);
let map = null;

// Two distinct centers so we can SEE flyTo working per-route.
const CENTERS = {
  '/a': { center: [-56.0, -34.9], zoom: 6, label: 'A: Uruguay' },
  '/b': { center: [2.35, 48.85], zoom: 6, label: 'B: Paris' },
};

function centerForPath(pathname) {
  // normalize trailing slash
  const p = pathname.replace(/\/$/, '') || '/a';
  return CENTERS[p] || CENTERS['/a'];
}

// Named handler so we can remove it on unmount (avoids duplicate listeners).
function onAfterSwap() {
  window.__swapHandlerCount = (window.__swapHandlerCount || 0) + 1;
  console.log('[MapIsland] astro:after-swap fired, swapHandlerCount=' + window.__swapHandlerCount + ' path=' + location.pathname);
  if (!map) {
    console.log('[MapIsland] after-swap but map is null!');
    return;
  }
  const target = centerForPath(location.pathname);
  map.flyTo({ center: target.center, zoom: target.zoom, duration: 800 });
  map.resize();
  window.__lastCenter = target.label;
}

onMounted(() => {
  window.__mountCount = (window.__mountCount || 0) + 1;
  console.log('[MapIsland] onMounted, mountCount=' + window.__mountCount);

  try {
    const target = centerForPath(location.pathname);
    map = new maplibregl.Map({
      container: mapContainer.value,
      style: 'https://demotiles.maplibre.org/style.json',
      center: target.center,
      zoom: target.zoom,
    });

    // Detect EACH real instance creation.
    window.__mapCreateCount = (window.__mapCreateCount || 0) + 1;
    window.__lastCenter = target.label;
    console.log('[MapIsland] MapLibre instance created. mapCreateCount=' + window.__mapCreateCount);

    map.on('error', (e) => {
      console.log('[MapIsland] map error event: ' + (e && e.error ? e.error.message : JSON.stringify(e)));
    });
    map.on('load', () => {
      window.__mapLoaded = true;
      console.log('[MapIsland] map load event fired');
    });
  } catch (e) {
    window.__mapError = String(e);
    console.log('[MapIsland] MAP CREATION THREW: ' + String(e));
  }

  document.addEventListener('astro:after-swap', onAfterSwap);
});

onUnmounted(() => {
  window.__unmountCount = (window.__unmountCount || 0) + 1;
  console.log('[MapIsland] onUnmounted, unmountCount=' + window.__unmountCount);
  document.removeEventListener('astro:after-swap', onAfterSwap);
  // NOTE: deliberately NOT calling map.remove() here — if the island truly
  // persists, onUnmounted should never fire during client-side nav.
});
</script>

<template>
  <div style="position: relative; width: 100%; height: 400px; border: 2px solid #333;">
    <div ref="mapContainer" style="position:absolute; inset:0;"></div>
    <div style="position:absolute; top:6px; left:6px; z-index:10; background:rgba(255,255,255,0.9); padding:4px 8px; font:12px monospace;">
      persistent map island
    </div>
  </div>
</template>

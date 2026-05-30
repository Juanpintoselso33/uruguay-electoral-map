<template>
  <div class="map-skeleton" role="status" aria-label="Loading map">
    <div class="skeleton-content">
      <LoadingSpinner size="large" text="Cargando mapa electoral..." />
    </div>

    <!-- Skeleton controls -->
    <div class="skeleton-controls">
      <div class="skeleton-box skeleton-control"></div>
      <div class="skeleton-box skeleton-control"></div>
      <div class="skeleton-box skeleton-control"></div>
    </div>

    <!-- Skeleton legend -->
    <div class="skeleton-legend">
      <div class="skeleton-box skeleton-legend-bar"></div>
      <div class="skeleton-box skeleton-legend-text"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue'
</script>

<style scoped>
.map-skeleton {
  width: 100%;
  height: 100%;
  background: var(--color-bg);
  position: relative;
  overflow: hidden;
}

.skeleton-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

.skeleton-box {
  background: var(--color-surface);
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.skeleton-controls {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 10;
}

.skeleton-control {
  width: 36px;
  height: 36px;
}

.skeleton-legend {
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  padding: 1rem;
  background: var(--color-surface);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.skeleton-legend-bar {
  width: 180px;
  height: 12px;
  margin-bottom: 0.75rem;
}

.skeleton-legend-text {
  width: 140px;
  height: 10px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 768px) {
  .skeleton-controls {
    top: 0.5rem;
    right: 0.5rem;
  }

  .skeleton-legend {
    bottom: 1rem;
    left: 1rem;
    right: 1rem;
  }

  .skeleton-legend-bar {
    width: 100%;
  }
}
</style>

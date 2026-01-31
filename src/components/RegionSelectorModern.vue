<template>
  <div class="region-selector">
    <div class="region-grid">
      <button
        v-for="region in regions"
        :key="region.slug"
        :class="['region-button', { active: isActive(region) }]"
        @click="selectRegion(region)"
      >
        <MapPin :size="14" class="region-icon" />
        <span class="region-name">{{ region.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MapPin } from 'lucide-vue-next'

const props = defineProps<{
  regions: any[]
  currentRegion: any
}>()

const emit = defineEmits(['regionSelected'])

const isActive = (region: any) => {
  return props.currentRegion?.slug === region.slug
}

const selectRegion = (region: any) => {
  emit('regionSelected', region)
}
</script>

<style scoped>
.region-selector {
  width: 100%;
}

.region-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}

.region-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.region-button:hover {
  background: var(--color-bg);
  transform: translateX(2px);
}

.region-button.active {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.region-button.active .region-icon {
  color: white;
}

.region-icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

.region-name {
  flex: 1;
}

@media (max-width: 768px) {
  .region-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .region-button {
    font-size: 0.8rem;
    padding: 0.6rem 0.75rem;
  }
}
</style>

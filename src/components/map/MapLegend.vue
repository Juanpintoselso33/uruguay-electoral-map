<template>
  <div v-if="show" class="map-legend">
    <h4>Votos</h4>
    <div
      v-for="(grade, index) in legendGrades"
      :key="index"
      class="legend-item"
    >
      <span
        class="legend-color"
        :style="{ backgroundColor: getColor(grade * maxVotes) }"
      ></span>
      <span class="legend-label">{{ Math.round(grade * maxVotes) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  show: boolean;
  maxVotes: number;
  getColor: (votes: number) => string;
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
});

const legendGrades = [0, 0.2, 0.4, 0.6, 0.8, 1];
</script>

<style scoped>
.map-legend {
  position: absolute;
  background: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
  z-index: var(--z-dropdown);
  font-size: 12px;
  max-width: 200px;
}

@media (min-width: 768px) {
  .map-legend {
    bottom: 20px;
    right: 20px;
  }
}

@media (max-width: 767px) {
  .map-legend {
    top: 60px;
    right: 10px;
    max-width: 150px;
  }
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.legend-color {
  width: 20px;
  height: 20px;
  margin-right: 5px;
}

.legend-label {
  font-size: 12px;
}

.map-legend h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: bold;
}
</style>

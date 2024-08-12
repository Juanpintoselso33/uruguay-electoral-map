<template>
  <div class="map-legend">
    <div
      v-for="(grade, index) in legendGrades"
      :key="index"
      class="legend-item"
    >
      <div
        class="legend-color"
        :style="{ backgroundColor: getColor(grade) }"
      ></div>
      <span class="legend-label">{{ formatLegendLabel(grade, index) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  legendGrades: number[];
  getColor: (value: number) => string;
  maxVotes: number;
}>();

const formatLegendLabel = (grade: number, index: number) => {
  const value = Math.round(grade * props.maxVotes);
  const nextValue =
    index < props.legendGrades.length - 1
      ? Math.round(props.legendGrades[index + 1] * props.maxVotes)
      : null;

  return nextValue ? `${value} - ${nextValue}` : `${value}+`;
};
</script>

<style scoped>
.map-legend {
  position: absolute;
  background: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  font-size: 12px;
  max-width: 200px;
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

.legend {
  line-height: 18px;
  color: #555;
  background: white;
  padding: 6px 8px;
  border-radius: 5px;
}

.legend i {
  width: 18px;
  height: 18px;
  float: left;
  margin-right: 8px;
  opacity: 0.7;
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
</style>

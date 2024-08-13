<template>
  <div class="map-legend">
    <div class="gradient-bar"></div>
    <div class="legend-labels">
      <span
        v-for="(grade, index) in legendGrades"
        :key="index"
        class="legend-label"
      >
        {{ formatLegendLabel(grade, index) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  legendGrades: number[];
  getColor: (value: number, maxVotes: number) => string;
  maxVotes: number | (() => number);
}>();

const legendGrades = computed(() => {
  const maxVotes =
    typeof props.maxVotes === "function" ? props.maxVotes() : props.maxVotes;
  return props.legendGrades.map((grade) => Math.round(grade * maxVotes));
});

const formatLegendLabel = (grade: number, index: number) => {
  return index === legendGrades.value.length - 1
    ? `${grade}+`
    : grade.toString();
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
  width: 200px;
}

.gradient-bar {
  height: 20px;
  background: linear-gradient(
    to right,
    #ffffcc,
    #ffeda0,
    #fed976,
    #feb24c,
    #fd8d3c,
    #fc4e2a,
    #e31a1c,
    #b10026
  );
  margin-bottom: 5px;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
}

.legend-label {
  font-size: 10px;
  color: #555;
}

@media (max-width: 767px) {
  .map-legend {
    top: 60px;
    right: 10px;
    width: 150px;
  }
}
</style>

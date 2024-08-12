<template>
  <Transition name="fade">
    <div v-if="selectedNeighborhood" class="neighborhood-info">
      <h3 class="neighborhood-name">{{ selectedNeighborhood }}</h3>
      <p class="vote-count">
        {{ getVotosForNeighborhood(selectedNeighborhood) }}
        <span class="vote-label">votos</span>
      </p>
      <div class="spinner" v-if="isLoading"></div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  selectedNeighborhood: string | null;
  getVotosForNeighborhood: (neighborhood: string) => number;
}>();

const isLoading = ref(false);

// Export the isLoading ref to be used in the parent component
defineExpose({ isLoading });
</script>

<style scoped>
.neighborhood-info {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background-color: rgba(255, 255, 255, 0.95);
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-family: Arial, sans-serif;
  min-width: 200px;
  max-width: 300px;
  width: auto;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
}

.neighborhood-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vote-count {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: #0066cc;
}

.vote-label {
  font-size: 14px;
  font-weight: 400;
  color: #666;
}

/* Transition styles */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Responsive styles */
@media (max-width: 768px) {
  .neighborhood-info {
    bottom: 10px;
    left: 10px;
    padding: 10px 14px;
    min-width: 150px;
  }

  .neighborhood-name {
    font-size: 14px;
  }

  .vote-count {
    font-size: 18px;
  }

  .vote-label {
    font-size: 12px;
  }
}

/* Add this new style for the spinner */
.spinner {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>

<template>
  <div class="mobile-toggle" @click="$emit('toggle')">
    <span class="mobile-toggle-text"
      >{{ isMobileHidden ? "Mostrar" : "Ocultar" }} listas seleccionadas</span
    >
    <span
      class="arrow"
      :class="{ 'arrow-up': !isMobileHidden, 'arrow-down': isMobileHidden }"
    ></span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isMobileHidden: boolean;
}>();

defineEmits<{
  (e: "toggle"): void;
}>();
</script>

<style scoped>
.mobile-toggle {
  display: none;
  cursor: pointer;
  padding: 10px;
  text-align: center;
}

@media (max-width: 767px) {
  .mobile-toggle {
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: white;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
    z-index: 1001;
  }
}

.mobile-toggle-text {
  font-size: 1.2rem;
  color: #333;
  font-weight: bold;
  margin-right: 10px;
}

.arrow {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
}

.arrow-up {
  border-bottom: 5px solid black;
}

.arrow-down {
  border-top: 5px solid black;
}
</style>

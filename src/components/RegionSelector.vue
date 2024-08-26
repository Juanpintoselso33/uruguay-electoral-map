<template>
  <div class="region-selector">
    <div class="selector-header">
      <button
        class="hamburger-button"
        @click="$emit('toggleMenu')"
        aria-label="Open region menu"
      >
        <span class="hamburger-icon"></span>
      </button>
      <h2 @click="$emit('toggleMenu')">Departamento</h2>
    </div>
    <div class="menu" :class="{ 'menu-open': isMenuOpen }">
      <ul>
        <li v-for="region in regions" :key="region.name">
          <button
            @click="selectRegion(region)"
            :class="{ active: region.name === currentRegion.name }"
          >
            {{ region.name }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";

const props = defineProps<{
  regions: Array<{ name: string }>;
  currentRegion: { name: string };
  isLoading: boolean;
  isMenuOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "regionSelected", region: { name: string }): void;
  (e: "toggleMenu"): void;
}>();

const selectRegion = (region: { name: string }) => {
  console.log("RegionSelector: Starting region selection");
  emit("regionSelected", region);
  emit("toggleMenu");
  console.log("RegionSelector: Region selection completed");
};

watch(
  () => props.currentRegion,
  (newRegion) => {
    // Update the selected region if it changes externally
  }
);
</script>

<style lang="scss" scoped>
@import "@/styles/variables";

.region-selector {
  position: relative;
  font-family: Arial, sans-serif;

  .selector-header {
    display: flex;
    align-items: center;
    gap: 15px;
    transition: background-color 0.3s ease;
    padding: 5px 10px;
    border-radius: 5px;

    &:hover {
      background-color: rgba($background-color, 0.1);
    }
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: $background-color;
    white-space: nowrap;
    cursor: pointer; // Añadir cursor pointer para indicar que es clickeable
  }
}

.hamburger-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 12px;

  .hamburger-icon {
    display: block;
    width: 30px;
    height: 4px;
    background-color: $background-color;
    position: relative;
    transition: background-color 0.3s;

    &::before,
    &::after {
      content: "";
      position: absolute;
      width: 100%;
      height: 4px;
      background-color: $background-color;
      left: 0;
      transition: transform 0.3s;
    }

    &::before {
      top: -10px;
    }

    &::after {
      bottom: -10px;
    }
  }

  &:hover .hamburger-icon {
    &::before,
    &::after {
      background-color: darken($background-color, 10%);
    }
  }
}

.menu {
  position: absolute;
  top: 160%;
  left: 0;
  background-color: $background-color;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 15px;
  display: none;
  z-index: 1000;
  max-height: 0;
  font-size: 0.9rem;
  overflow: hidden;
  transition: max-height 0.5s ease-in-out, padding 0.5s ease-in-out;

  &-open {
    display: block;
    max-height: 400px;
    padding: 15px;
  }

  ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }

  li {
    margin-bottom: 10px;
  }

  button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 12px 16px;
    width: 100%;
    text-align: left;
    color: $text-color;
    transition: background-color 0.3s, color 0.3s;
    border-radius: 6px;
    font-size: 0.9rem;

    &:hover {
      background-color: darken($background-color, 5%);
    }

    &.active {
      background-color: $primary-color;
      color: $background-color;
      font-weight: bold;
    }
  }
}

@media (min-width: $mobile-breakpoint) {
  .region-selector {
    min-width: 250px;
  }

  .menu {
    min-width: 250px;

    button {
      padding: 14px 18px;
      font-size: 0.9rem;
    }
  }
}

@media (max-width: $mobile-breakpoint - 1) {
  .selector-header {
    gap: 10px; // Reducir el espacio entre elementos en vista móvil
  }

  .hamburger-button {
    padding: 8px; // Reducir el padding del botón de hamburguesa en vista móvil

    .hamburger-icon {
      width: 24px; // Reducir el tamaño del icono de hamburguesa en vista móvil
      height: 3px;

      &::before {
        top: -8px; // Ajustar la posición de las líneas del icono de hamburguesa
      }

      &::after {
        bottom: -8px; // Ajustar la posición de las líneas del icono de hamburguesa
      }
    }
  }

  .region-selector h2 {
    font-size: 0.9rem; // Reducir el tamaño del texto en vista móvil
  }
}
</style>

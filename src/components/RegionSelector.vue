<template>
  <div class="region-selector" data-testid="region-selector">
    <div class="selector-header">
      <button
        class="hamburger-button"
        @click="toggleMenu"
        @keydown.enter="toggleMenu"
        @keydown.space.prevent="toggleMenu"
        aria-label="Abrir menú de departamentos"
        :aria-expanded="isMenuOpen"
      >
        <span class="hamburger-icon"></span>
      </button>
      <h2>Elegir departamento</h2>
    </div>
    <div
      ref="menuContainer"
      class="menu"
      :class="{ 'menu-open': isMenuOpen }"
      role="menu"
      :aria-hidden="!isMenuOpen"
    >
      <ul>
        <li v-for="(region, index) in regions" :key="region.name" role="none">
          <button
            @click="selectRegion(region)"
            @keydown.enter="selectRegion(region)"
            @keydown.space.prevent="selectRegion(region)"
            :class="{ active: region.name === currentRegion.name }"
            role="menuitem"
            :tabindex="isMenuOpen ? 0 : -1"
            :aria-current="region.name === currentRegion.name ? 'true' : undefined"
          >
            {{ region.name }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useKeyboardNavigation } from "@/composables/useKeyboardNavigation";
import { useScreenReaderAnnouncements } from "@/composables/useScreenReaderAnnouncements";

const props = defineProps<{
  regions: Array<{ name: string }>;
  currentRegion: { name: string };
}>();

const emit = defineEmits<{
  (e: "regionSelected", region: { name: string }): void;
}>();

const isMenuOpen = ref(false);
const menuContainer = ref<HTMLElement>();

// Screen reader announcements
const { announceDepartmentChange } = useScreenReaderAnnouncements()

// Keyboard navigation: Escape to close, arrow keys to navigate
useKeyboardNavigation({
  onEscape: () => {
    if (isMenuOpen.value) {
      isMenuOpen.value = false;
    }
  },
  trapFocus: {
    container: menuContainer,
    active: isMenuOpen
  }
});

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;

  // Focus first menu item when opening
  if (isMenuOpen.value) {
    nextTick(() => {
      const firstButton = menuContainer.value?.querySelector('button');
      firstButton?.focus();
    });
  }
};

const selectRegion = (region: { name: string }) => {
  // Announce to screen readers
  announceDepartmentChange(region.name)

  emit("regionSelected", region);
  isMenuOpen.value = false;
};

watch(
  () => props.currentRegion,
  (newRegion) => {
    // Update the selected region if it changes externally
  }
);
</script>

<style scoped>
.region-selector {
  position: relative;
  font-family: Arial, sans-serif;
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 15px;
  transition: background-color 0.3s ease;
  padding: 5px 10px;
  border-radius: 5px;
}

.selector-header:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.hamburger-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 12px;
}

.hamburger-icon {
  display: block;
  width: 30px;
  height: 4px;
  background-color: white;
  position: relative;
  transition: background-color 0.3s;
}

.hamburger-icon::before,
.hamburger-icon::after {
  content: "";
  position: absolute;
  width: 100%;
  height: 4px;
  background-color: white;
  left: 0;
  transition: transform 0.3s;
}

.hamburger-icon::before {
  top: -10px;
}

.hamburger-icon::after {
  bottom: -10px;
}

.hamburger-button:hover .hamburger-icon,
.hamburger-button:hover .hamburger-icon::before,
.hamburger-button:hover .hamburger-icon::after {
  background-color: #ddd;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
  color: white;
  white-space: nowrap;
}

.menu {
  position: absolute;
  top: 160%;
  left: 0;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 15px;
  display: none;
  z-index: var(--z-dropdown);
  max-height: 0;
  font-size: 0.9rem;
  overflow: hidden;
  transition: max-height 0.5s ease-in-out, padding 0.5s ease-in-out;
}

.menu-open {
  display: block;
  max-height: 400px;
  padding: 15px;
}

.menu ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.menu li {
  margin-bottom: 10px;
}

.menu button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 12px 16px;
  width: 100%;
  text-align: left;
  color: #333;
  transition: background-color 0.3s, color 0.3s;
  border-radius: 6px;
  font-size: 0.9rem;
}

.menu button:hover {
  background-color: #f0f0f0;
}

.menu button.active {
  background-color: #0b0e11;
  color: white;
  font-weight: bold;
}

@media (min-width: 769px) {
  .region-selector {
    min-width: 250px;
  }

  .menu {
    min-width: 250px;
  }

  .menu button {
    padding: 14px 18px;
    font-size: 0.9rem;
  }
}

@media (max-width: 768px) {
  .menu {
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 0;
    padding: 20px;
    overflow-y: auto;
  }

  .menu-open {
    max-width: 50%;
    z-index: var(--z-max);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    top: 20%;
  }

  .region-selector h2 {
    font-size: 0.9rem;
  }

  .menu button {
    font-size: 0.8rem;
  }
}
</style>

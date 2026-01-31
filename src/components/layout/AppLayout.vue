<template>
  <div class="app-layout" :class="{ 'dark': isDark }">
    <!-- Header Editorial -->
    <header class="app-header">
      <div class="header-content">
        <div class="logo-section">
          <h1 class="site-title">Mapa Electoral</h1>
          <span class="site-subtitle">Uruguay 2024</span>
        </div>

        <div class="header-actions">
          <SearchBar @select="handleDepartmentSelect" />
          <button @click="toggleDark" class="theme-toggle" aria-label="Toggle theme">
            <Moon v-if="!isDark" :size="20" />
            <Sun v-else :size="20" />
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="app-main">
      <!-- Sidebar -->
      <aside class="sidebar" :class="{ 'collapsed': sidebarCollapsed }">
        <button class="sidebar-toggle" @click="toggleSidebar">
          <ChevronLeft v-if="!sidebarCollapsed" :size="20" />
          <ChevronRight v-else :size="20" />
        </button>

        <div v-if="!sidebarCollapsed" class="sidebar-content">
          <slot name="sidebar" />
        </div>
      </aside>

      <!-- Map Area -->
      <main class="map-area">
        <slot name="map" />
      </main>

      <!-- Stats Panel (Desktop) -->
      <aside v-if="showStatsPanel" class="stats-panel">
        <slot name="stats" />
      </aside>
    </div>

    <!-- Mobile Bottom Sheet -->
    <Teleport to="body">
      <div v-if="isMobile && mobileSheetOpen" class="mobile-sheet" @click.self="closeMobileSheet">
        <div class="mobile-sheet-content" :style="{ transform: `translateY(${sheetDragY}px)` }">
          <div class="mobile-sheet-handle" @touchstart="handleDragStart" @touchmove="handleDragMove" @touchend="handleDragEnd"></div>
          <slot name="mobile-content" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWindowSize, useLocalStorage } from '@vueuse/core'
import { Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import SearchBar from '../search/SearchBar.vue'

const emit = defineEmits(['department-select'])

// Theme
const isDark = useLocalStorage('electoral-theme-dark', false)
const toggleDark = () => isDark.value = !isDark.value

// Sidebar
const sidebarCollapsed = useLocalStorage('electoral-sidebar-collapsed', false)
const toggleSidebar = () => sidebarCollapsed.value = !sidebarCollapsed.value

// Responsive
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)

// Stats Panel (solo desktop)
const showStatsPanel = computed(() => !isMobile.value)

// Mobile Sheet
const mobileSheetOpen = ref(false)
const sheetDragY = ref(0)
const dragStartY = ref(0)

const handleDepartmentSelect = (dept: any) => {
  emit('department-select', dept)
  if (isMobile.value) {
    mobileSheetOpen.value = true
  }
}

const closeMobileSheet = () => {
  mobileSheetOpen.value = false
  sheetDragY.value = 0
}

const handleDragStart = (e: TouchEvent) => {
  dragStartY.value = e.touches[0].clientY - sheetDragY.value
}

const handleDragMove = (e: TouchEvent) => {
  const currentY = e.touches[0].clientY - dragStartY.value
  if (currentY > 0) {
    sheetDragY.value = currentY
  }
}

const handleDragEnd = () => {
  if (sheetDragY.value > 150) {
    closeMobileSheet()
  } else {
    sheetDragY.value = 0
  }
}
</script>

<style scoped>
.app-layout {
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-text: #1a1a1a;
  --color-text-secondary: #666666;
  --color-border: #e5e5e5;
  --color-accent: #0066cc;
  --header-height: 72px;
  --sidebar-width: 320px;
  --sidebar-collapsed-width: 60px;
  --stats-width: 360px;

  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app-layout.dark {
  --color-bg: #0a0a0a;
  --color-surface: #1a1a1a;
  --color-text: #fafafa;
  --color-text-secondary: #a3a3a3;
  --color-border: #2a2a2a;
  --color-accent: #3b82f6;
}

/* Header Editorial */
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  background: var(--color-surface);
  border-bottom: 2px solid var(--color-border);
  z-index: 100;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9);
}

.dark .app-header {
  background: rgba(26, 26, 26, 0.9);
}

.header-content {
  max-width: 100%;
  height: 100%;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-section {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.site-title {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 1.75rem;
  font-weight: 400;
  margin: 0;
  letter-spacing: -0.02em;
}

.site-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-toggle:hover {
  background: var(--color-border);
  transform: scale(1.05);
}

/* Main Layout */
.app-main {
  margin-top: var(--header-height);
  display: flex;
  height: calc(100vh - var(--header-height));
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  position: relative;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-toggle {
  position: absolute;
  top: 1rem;
  right: -12px;
  width: 24px;
  height: 24px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
}

.sidebar-toggle:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.sidebar-content {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
}

/* Map Area */
.map-area {
  flex: 1;
  position: relative;
  background: var(--color-bg);
}

/* Stats Panel */
.stats-panel {
  width: var(--stats-width);
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  overflow-y: auto;
  padding: 1.5rem;
}

/* Mobile Sheet */
.mobile-sheet {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.mobile-sheet-content {
  background: var(--color-surface);
  width: 100%;
  max-height: 80vh;
  border-radius: 20px 20px 0 0;
  padding: 1.5rem;
  overflow-y: auto;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-sheet-handle {
  width: 40px;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  margin: 0 auto 1rem;
  cursor: grab;
}

.mobile-sheet-handle:active {
  cursor: grabbing;
}

/* Responsive */
@media (max-width: 768px) {
  .app-header {
    height: 60px;
  }

  .header-content {
    padding: 0 1rem;
  }

  .site-title {
    font-size: 1.25rem;
  }

  .site-subtitle {
    display: none;
  }

  .sidebar {
    position: fixed;
    left: -100%;
    top: var(--header-height);
    height: calc(100vh - var(--header-height));
    z-index: 50;
    transition: left 0.3s ease;
  }

  .sidebar.open {
    left: 0;
  }
}
</style>

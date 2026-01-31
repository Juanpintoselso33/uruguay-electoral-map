<template>
  <div class="app-layout" :class="{ 'dark': isDark }">
    <!-- Mobile: Transparent Floating Header -->
    <header class="app-header" :class="{ 'mobile-header': isMobile }">
      <div class="header-content">
        <div class="logo-section">
          <h1 class="site-title">Mapa Electoral</h1>
          <span v-if="!isMobile" class="site-subtitle">Uruguay 2024</span>
        </div>

        <div class="header-actions">
          <button
            v-if="!isMobile"
            @click="emit('toggle-comparison')"
            class="comparison-toggle"
            :class="{ active: showComparison }"
            aria-label="Toggle comparison mode"
          >
            <GitCompare :size="20" />
            <span class="comparison-label">Comparar</span>
          </button>
          <SearchBar v-if="!isMobile" @select="handleDepartmentSelect" />
          <button @click="toggleDark" class="theme-toggle" aria-label="Toggle theme">
            <Moon v-if="!isDark" :size="20" />
            <Sun v-else :size="20" />
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="app-main" :class="{ 'mobile-main': isMobile }">
      <!-- Sidebar (Desktop Only) -->
      <aside v-if="!isMobile" class="sidebar" :class="{ 'collapsed': sidebarCollapsed }">
        <button class="sidebar-toggle" @click="toggleSidebar" aria-label="Toggle sidebar">
          <ChevronLeft v-if="!sidebarCollapsed" :size="20" />
          <ChevronRight v-else :size="20" />
        </button>

        <div v-if="!sidebarCollapsed" class="sidebar-content">
          <slot name="sidebar" />
        </div>
      </aside>

      <!-- Map Area - Full Screen on Mobile -->
      <main class="map-area" :class="{ 'mobile-map': isMobile }">
        <slot name="map" />

        <!-- Mobile Floating Action Buttons -->
        <div v-if="isMobile" class="mobile-fab-container">
          <button
            class="fab fab-secondary"
            @click="emit('toggle-comparison')"
            :class="{ 'fab-active': showComparison }"
            aria-label="Toggle comparison mode"
          >
            <GitCompare :size="20" />
          </button>
        </div>
      </main>

      <!-- Stats Panel (Desktop Only) -->
      <aside v-if="showStatsPanel" class="stats-panel">
        <slot name="stats" />
      </aside>
    </div>

    <!-- Mobile Bottom Sheet -->
    <BottomSheet
      v-if="isMobile"
      ref="bottomSheetRef"
      :initial-snap="'collapsed'"
      :snap-points="mobileSnapPoints"
      @snap-change="handleSnapChange"
    >
      <!-- Peek Content - Always Visible -->
      <div class="sheet-peek-content">
        <BottomNavTabs
          :active-tab="activeTab"
          :filter-count="filterCount"
          @tab-change="handleTabChange"
        />
      </div>

      <!-- Tab Content Areas -->
      <div class="sheet-scroll-content">
        <!-- Filters Tab -->
        <div
          v-show="activeTab === 'filters'"
          id="tab-panel-filters"
          role="tabpanel"
          aria-labelledby="tab-filters"
          class="tab-panel"
        >
          <slot name="sidebar" />
        </div>

        <!-- Stats Tab -->
        <div
          v-show="activeTab === 'stats'"
          id="tab-panel-stats"
          role="tabpanel"
          aria-labelledby="tab-stats"
          class="tab-panel"
        >
          <slot name="stats" />
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWindowSize, useLocalStorage } from '@vueuse/core'
import { Moon, Sun, ChevronLeft, ChevronRight, GitCompare } from 'lucide-vue-next'
import SearchBar from '../search/SearchBar.vue'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import BottomNavTabs from '@/components/mobile/BottomNavTabs.vue'
import type { SnapState } from '@/composables/useSwipeableSheet'
import type { TabId } from '@/components/mobile/BottomNavTabs.vue'

const emit = defineEmits(['department-select', 'toggle-comparison'])

const props = defineProps<{
  showComparison?: boolean
}>()

// Theme
const isDark = useLocalStorage('electoral-theme-dark', false)
const toggleDark = () => isDark.value = !isDark.value

// Sidebar (Desktop)
const sidebarCollapsed = useLocalStorage('electoral-sidebar-collapsed', false)
const toggleSidebar = () => sidebarCollapsed.value = !sidebarCollapsed.value

// Responsive
const { width, height } = useWindowSize()
const isMobile = computed(() => width.value < 768)
const isLandscape = computed(() => width.value > height.value && height.value < 500)

// Stats Panel (desktop only)
const showStatsPanel = computed(() => !isMobile.value)

// Mobile Bottom Sheet
const activeTab = ref<TabId>('filters')
const bottomSheetRef = ref<InstanceType<typeof BottomSheet>>()

// Dynamic snap points based on orientation
const mobileSnapPoints = computed(() => {
  if (isLandscape.value) {
    return { collapsed: 85, partial: 50, expanded: 10 }
  }
  return { collapsed: 88, partial: 45, expanded: 8 }
})

// Placeholder for filter count - will be calculated from actual filters
const filterCount = computed(() => 0)

const handleTabChange = (tabId: TabId) => {
  activeTab.value = tabId
  // Expand sheet when tab is changed (if collapsed)
  bottomSheetRef.value?.snapTo('partial')
}

const handleSnapChange = (snap: SnapState) => {
  // Could add haptic feedback here in the future
}

const handleDepartmentSelect = (dept: any) => {
  emit('department-select', dept)
}
</script>

<style scoped>
.app-layout {
  /* Color Variables */
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-text: #1a1a1a;
  --color-text-secondary: #666666;
  --color-border: #e5e5e5;
  --color-accent: #0066cc;
  --color-accent-rgb: 0, 102, 204;

  /* Layout Variables */
  --header-height: 64px;
  --header-height-mobile: 52px;
  --sidebar-width: 320px;
  --sidebar-collapsed-width: 60px;
  --stats-width: 360px;

  /* Z-Index Scale */
  --z-base: 0;
  --z-map-controls: 10;
  --z-fab: 20;
  --z-sidebar-toggle: 10;
  --z-tooltip: 20;
  --z-dropdown: 30;
  --z-sidebar: 50;
  --z-header: 100;
  --z-sheet: 150;
  --z-modal: 200;
  --z-max: 9999;

  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport height for mobile */
  background: var(--color-bg);
  color: var(--color-text);
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
  overflow: hidden;
}

.app-layout.dark {
  --color-bg: #0a0a0a;
  --color-surface: #1a1a1a;
  --color-text: #fafafa;
  --color-text-secondary: #a3a3a3;
  --color-border: #2a2a2a;
  --color-accent: #3b82f6;
  --color-accent-rgb: 59, 130, 246;
}

/* ========================================
   Header Styles
   ======================================== */
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  z-index: var(--z-header);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.92);
}

.dark .app-header {
  background: rgba(26, 26, 26, 0.92);
}

/* Mobile Header - Transparent Floating */
.app-header.mobile-header {
  height: var(--header-height-mobile);
  background: transparent;
  border-bottom: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  padding-top: env(safe-area-inset-top, 0px);
  pointer-events: none;
}

.app-header.mobile-header .header-content {
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin: 8px;
  margin-top: max(8px, env(safe-area-inset-top, 0px));
  border-radius: 16px;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05);
  padding: 0 12px;
  height: 44px;
}

.dark .app-header.mobile-header .header-content {
  background: rgba(26, 26, 26, 0.95);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.header-content {
  max-width: 100%;
  height: 100%;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-section {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.site-title {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 400;
  margin: 0;
  letter-spacing: -0.02em;
}

.site-subtitle {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.comparison-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  color: var(--color-text);
  min-height: 40px;
}

.comparison-toggle:hover {
  background: var(--color-bg);
  border-color: var(--color-accent);
}

.comparison-toggle.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.comparison-label {
  font-size: 0.875rem;
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color-text);
  -webkit-tap-highlight-color: transparent;
}

.theme-toggle:hover {
  background: var(--color-border);
}

.theme-toggle:active {
  transform: scale(0.95);
}

/* ========================================
   Main Layout
   ======================================== */
.app-main {
  margin-top: var(--header-height);
  display: flex;
  height: calc(100vh - var(--header-height));
  height: calc(100dvh - var(--header-height));
}

.app-main.mobile-main {
  margin-top: 0;
  height: 100vh;
  height: 100dvh;
}

/* ========================================
   Sidebar (Desktop)
   ======================================== */
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  position: relative;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  flex-shrink: 0;
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
  z-index: var(--z-sidebar-toggle);
  transition: all 0.2s ease;
  color: var(--color-text);
}

.sidebar-toggle:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.sidebar-content {
  padding: 1.25rem;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ========================================
   Map Area
   ======================================== */
.map-area {
  flex: 1;
  position: relative;
  background: var(--color-bg);
  min-width: 0;
}

.map-area.mobile-map {
  position: absolute;
  inset: 0;
}

/* ========================================
   Mobile Floating Action Buttons
   ======================================== */
.mobile-fab-container {
  position: absolute;
  right: 16px;
  right: max(16px, env(safe-area-inset-right, 0px));
  bottom: calc(14% + 16px); /* Above the collapsed sheet */
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: var(--z-fab);
}

.fab {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.fab-secondary {
  background: var(--color-surface);
  color: var(--color-text);
}

.fab-secondary:active {
  transform: scale(0.95);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
}

.fab-active {
  background: var(--color-accent);
  color: white;
}

.dark .fab-secondary {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

/* ========================================
   Stats Panel (Desktop)
   ======================================== */
.stats-panel {
  width: var(--stats-width);
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  overflow-y: auto;
  padding: 1.25rem;
  flex-shrink: 0;
  overscroll-behavior: contain;
}

/* ========================================
   Bottom Sheet Content Styles
   ======================================== */
.sheet-peek-content {
  flex-shrink: 0;
}

.sheet-scroll-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.tab-panel {
  padding: 0 16px 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
  animation: tabFadeIn 0.2s ease;
}

@keyframes tabFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========================================
   Responsive - Mobile
   ======================================== */
@media (max-width: 767px) {
  .app-header.mobile-header .site-title {
    font-size: 1.125rem;
  }
}

/* ========================================
   Responsive - Landscape Mobile
   ======================================== */
@media (orientation: landscape) and (max-height: 500px) {
  .mobile-fab-container {
    bottom: calc(18% + 12px);
    right: max(12px, env(safe-area-inset-right, 0px));
  }

  .fab {
    width: 44px;
    height: 44px;
    border-radius: 12px;
  }

  .app-header.mobile-header .header-content {
    margin: 6px;
    margin-left: max(6px, env(safe-area-inset-left, 0px));
    margin-right: max(6px, env(safe-area-inset-right, 0px));
    height: 40px;
    border-radius: 12px;
  }
}

/* ========================================
   Reduced Motion
   ======================================== */
@media (prefers-reduced-motion: reduce) {
  .app-layout,
  .sidebar,
  .theme-toggle,
  .comparison-toggle,
  .fab {
    transition: none;
  }

  .tab-panel {
    animation: none;
  }
}
</style>

<template>
  <!-- Screen Reader Live Region for Announcements -->
  <ScreenReaderLive />

  <!-- Mobile Gesture Hint -->
  <MapGestureHint />

  <!-- Global Loading Overlay -->
  <Transition name="fade">
    <div v-if="store.isLoading" class="global-loading-overlay" role="status" aria-live="polite">
      <LoadingSpinner size="large" text="Cargando datos electorales..." />
    </div>
  </Transition>

  <!-- Error Overlay -->
  <Transition name="fade">
    <div v-if="store.error && !store.isLoading" class="error-overlay" role="alert" aria-live="assertive">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h2 class="error-title">Error al cargar datos</h2>
        <p class="error-message">{{ store.error }}</p>
        <button @click="handleRetry" class="retry-button">
          Reintentar
        </button>
      </div>
    </div>
  </Transition>

  <AppLayout
    :showComparison="isComparisonMode"
    @department-select="handleDepartmentSelect"
    @toggle-comparison="toggleComparisonMode"
  >
    <!-- Sidebar Content -->
    <template #sidebar v-if="!isComparisonMode">
      <!-- Election Selector -->
      <div class="sidebar-section" v-if="store.electionsFromCatalog.length > 0">
        <ElectionSelector />
      </div>

      <div class="sidebar-section">
        <h3 class="section-title">Departamentos</h3>
        <RegionSelector
          :regions="store.availableRegions"
          :currentRegion="store.currentRegion"
          @regionSelected="store.setCurrentRegion"
        />
      </div>

      <div class="sidebar-section">
        <ListSelectorContainer
          :lists="store.availableLists"
          :isODN="store.isODN"
          :isInternasElection="store.isInternasElection"
          :partiesAbbrev="partiesAbbrev"
          :selectedParty="store.selectedParty"
          :partiesByList="store.currentPartiesByList"
          :candidates="store.uniqueSortedCandidates"
          :precandidatosByList="store.precandidatosByList"
          :candidatesByParty="store.candidatesByParty"
          v-model:selectedLists="store.selectedLists"
          v-model:selectedCandidates="store.selectedCandidates"
          @updateIsODN="store.toggleDataSource"
          @updateSelectedParty="store.setSelectedParty"
        />
      </div>
    </template>

    <!-- Map (Normal Mode) -->
    <template #map v-if="!isComparisonMode">
      <MapLibreView
        v-if="store.currentRegion"
        :regionName="store.currentRegion.name"
        :selectedLists="store.selectedLists"
        :votosPorListas="store.currentRegion.votosPorListas || {}"
        :maxVotosPorListas="store.currentRegion.maxVotosPorListas || {}"
        :partiesByList="store.currentRegion.partiesByList || {}"
        :precandidatosByList="store.currentRegion.precandidatosByList || {}"
        :geojsonData="store.currentRegion.geojsonData"
        :selectedNeighborhood="store.selectedNeighborhood"
        :isODN="store.isODN"
        :partiesAbbrev="partiesAbbrev"
        :selectedCandidates="store.selectedCandidates"
        :mapCenter="store.currentRegion.mapCenter"
        :mapZoom="store.currentRegion.mapZoom"
        :getVotosForNeighborhood="store.getVotosForNeighborhood"
        :seriesLocalityMapping="store.currentRegion.seriesLocalityMapping || {}"
        :seriesBarrioMapping="store.currentRegion.seriesBarrioMapping || {}"
        @updateSelectedNeighborhood="store.setSelectedNeighborhood"
        @mapInitialized="handleMapInitialized"
      />
    </template>

    <!-- Comparison Mode -->
    <template #map v-else>
      <ComparisonView
        v-if="store.currentRegion"
        :departmentSlug="store.currentRegion.slug || 'montevideo'"
        @close="toggleComparisonMode"
      />
    </template>

    <!-- Stats Panel (Desktop) - Only in normal mode -->
    <template #stats v-if="!isComparisonMode">
      <StatsPanel
        :currentRegion="store.currentRegion"
        :availableLists="store.availableLists"
        :selectedLists="store.selectedLists"
        :isODN="store.isODN"
        :partiesByList="store.currentPartiesByList"
        :votosPorListas="store.currentRegion?.votosPorListas || {}"
        @toggle-source="store.toggleDataSource"
        @remove-list="handleRemoveList"
        @export="handleExport"
      />
    </template>

    <!-- Mobile Content -->
    <template #mobile-content>
      <div class="mobile-content">
        <h3 class="mobile-title">{{ store.currentRegion?.name }}</h3>
        <StatsPanel
          :currentRegion="store.currentRegion"
          :availableLists="store.availableLists"
          :selectedLists="store.selectedLists"
          :isODN="store.isODN"
          :partiesByList="store.currentPartiesByList"
          :votosPorListas="store.currentRegion?.votosPorListas || {}"
          @toggle-source="store.toggleDataSource"
          @remove-list="handleRemoveList"
          @export="handleExport"
        />
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useElectoralStore } from './stores/electoral'
import AppLayout from './components/layout/AppLayout.vue'
import ScreenReaderLive from './components/accessibility/ScreenReaderLive.vue'
import MapGestureHint from './components/mobile/MapGestureHint.vue'
import ElectionSelector from './components/elections/ElectionSelector.vue'
import RegionSelector from './components/RegionSelectorModern.vue'
import ListSelectorContainer from './components/selectors/ListSelectorContainer.vue'
import MapLibreView from './components/map/MapLibreView.vue'
import StatsPanel from './components/charts/StatsPanel.vue'
import ComparisonView from './components/comparison/ComparisonView.vue'
import LoadingSpinner from './components/ui/LoadingSpinner.vue'
import partiesAbbrev from '../public/partidos_abrev.json'

const store = useElectoralStore()
const isComparisonMode = ref(false)

const toggleComparisonMode = () => {
  isComparisonMode.value = !isComparisonMode.value
}

const handleDepartmentSelect = (dept: any) => {
  store.setCurrentRegion(dept)
}

const handleMapInitialized = () => {
  console.log('Map initialized')
}

const handleRemoveList = (list: string) => {
  store.selectedLists = store.selectedLists.filter(l => l !== list)
}

const handleExport = () => {
  console.log('Export triggered from stats panel')
}

const handleRetry = async () => {
  store.error = null
  try {
    await store.loadRegionsConfig()
    if (store.currentRegion) {
      await store.fetchRegionData(store.currentRegion)
    }
  } catch (error) {
    console.error('[AppModern] Error during retry:', error)
    store.isLoading = false
    store.error = error instanceof Error ? error.message : 'Error loading application data'
  }
}

onMounted(async () => {
  try {
    await store.loadRegionsConfig()
    if (store.currentRegion) {
      await store.fetchRegionData(store.currentRegion)
    } else {
      console.error('[AppModern] No current region set after loading config')
      store.isLoading = false
    }
  } catch (error) {
    console.error('[AppModern] Error during initialization:', error)
    store.isLoading = false
    store.error = error instanceof Error ? error.message : 'Error loading application data'
  }
})
</script>

<style>
/* Import Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

/* Global Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar Sections */
.sidebar-section {
  margin-bottom: 2rem;
}

.section-title {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 1.125rem;
  margin-bottom: 1rem;
  color: var(--color-text);
}

/* Mobile Content */
.mobile-content {
  padding: 1rem 0;
}

.mobile-title {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}

/* Dark mode scrollbar */
.dark ::-webkit-scrollbar-track {
  background: var(--color-surface);
}

.dark ::-webkit-scrollbar-thumb {
  background: var(--color-border);
}

/* Global Loading Overlay */
.global-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.dark .global-loading-overlay {
  background: rgba(0, 0, 0, 0.85);
}

/* Error Overlay */
.error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.98);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 2rem;
}

.dark .error-overlay {
  background: rgba(0, 0, 0, 0.95);
}

.error-content {
  max-width: 500px;
  text-align: center;
  background: white;
  padding: 3rem 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.dark .error-content {
  background: #1a1a1a;
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
}

.error-title {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 1.75rem;
  margin-bottom: 1rem;
  color: #dc2626;
}

.dark .error-title {
  color: #ef4444;
}

.error-message {
  color: #666;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.dark .error-message {
  color: #9ca3af;
}

.retry-button {
  background: #2563eb;
  color: white;
  border: none;
  padding: 0.875rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.retry-button:active {
  transform: translateY(0);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

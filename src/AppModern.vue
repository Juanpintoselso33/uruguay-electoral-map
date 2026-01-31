<template>
  <AppLayout @department-select="handleDepartmentSelect">
    <!-- Sidebar Content -->
    <template #sidebar>
      <div class="sidebar-section">
        <h3 class="section-title">Departamentos</h3>
        <RegionSelector
          :regions="store.regions"
          :currentRegion="store.currentRegion"
          @regionSelected="store.setCurrentRegion"
        />
      </div>

      <div class="sidebar-section">
        <ListSelectorContainer
          :lists="store.availableLists"
          :isODN="store.isODN"
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

    <!-- Map -->
    <template #map>
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
        @updateSelectedNeighborhood="store.setSelectedNeighborhood"
        @mapInitialized="handleMapInitialized"
      />
    </template>

    <!-- Stats Panel (Desktop) -->
    <template #stats>
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
import { onMounted } from 'vue'
import { useElectoralStore } from './stores/electoral'
import AppLayout from './components/layout/AppLayout.vue'
import RegionSelector from './components/RegionSelectorModern.vue'
import ListSelectorContainer from './components/selectors/ListSelectorContainer.vue'
import MapLibreView from './components/map/MapLibreView.vue'
import StatsPanel from './components/charts/StatsPanel.vue'
import partiesAbbrev from '../public/partidos_abrev.json'

const store = useElectoralStore()

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

onMounted(async () => {
  await store.loadRegionsConfig()
  if (store.regions.length > 0) {
    await store.fetchRegionData(store.regions[0])
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
</style>

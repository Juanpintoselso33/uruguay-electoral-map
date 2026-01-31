<!--
  LEGACY VERSION - NOT IN USE

  This file contains the original Leaflet-based implementation of the electoral map.
  It has been replaced by AppModern.vue which uses MapLibre GL JS for better performance
  and modern features.

  This file is kept for:
  - Historical reference
  - Comparison with the new implementation
  - Potential fallback if needed

  DO NOT USE THIS FILE - Use AppModern.vue instead
  See main.js for the active implementation
-->
<template>
  <div id="app">
    <header class="header">
      <div class="header-content">
        <div class="header-top">
          <RegionSelector
            :regions="store.regions"
            :currentRegion="store.currentRegion"
            @regionSelected="store.setCurrentRegion"
          />
          <a
            href="https://github.com/juanpintoselso33"
            target="_blank"
            rel="noopener noreferrer"
            class="github-link"
          >
            <svg
              class="github-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12z"
              />
            </svg>
            <span>Juan Pintos Elso</span>
          </a>
        </div>
        <h1>Votos por listas por zona de {{ store.currentRegion?.name || 'Uruguay' }}</h1>
      </div>
    </header>
    <main class="content">
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
      <div class="map-container">
        <ElectoralMap
          :regionName="store.currentRegion?.name || ''"
          :selectedLists="store.selectedLists"
          :votosPorListas="store.currentRegion?.votosPorListas || {}"
          :maxVotosPorListas="store.currentRegion?.maxVotosPorListas || {}"
          :partiesByList="store.currentRegion?.partiesByList || {}"
          :precandidatosByList="store.currentRegion?.precandidatosByList || {}"
          :geojsonData="store.currentRegion?.geojsonData"
          :selectedNeighborhood="store.selectedNeighborhood"
          :isODN="store.isODN"
          :partiesAbbrev="partiesAbbrev"
          :selectedCandidates="store.selectedCandidates"
          :mapCenter="store.currentRegion?.mapCenter || [-34.8211, -56.225]"
          :mapZoom="store.currentRegion?.mapZoom || 11.5"
          :seriesLocalityMapping="store.currentRegion?.seriesLocalityMapping || {}"
          :seriesBarrioMapping="store.currentRegion?.seriesBarrioMapping"
          :getVotosForNeighborhood="store.getVotosForNeighborhood"
          @updateSelectedNeighborhood="store.setSelectedNeighborhood"
          @mapInitialized="handleMapInitialized"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useElectoralStore } from "./stores/electoral";
import ListSelectorContainer from "./components/selectors/ListSelectorContainer.vue";
import ElectoralMap from "./components/map/ElectoralMap.vue";
import RegionSelector from "./components/RegionSelector.vue";
import partiesAbbrev from "../public/partidos_abrev.json";

// Use Pinia store for all state management
const store = useElectoralStore();

const handleMapInitialized = () => {
  if (store.currentRegion?.geojsonData) {
    // Trigger map update if needed
    store.currentRegion = { ...store.currentRegion };
  }
};

onMounted(async () => {
  // Load regions configuration and fetch data for first region
  const regionsConfig = await store.loadRegionsConfig();
  if (regionsConfig.length > 0) {
    await store.fetchRegionData(regionsConfig[0]);
  }
});
</script>

<style>
#app {
  font-family: Arial, sans-serif;
}

.header {
  background-color: #333;
  color: white;
  padding: 10px 20px;
  width: 100%;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.header-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header h1 {
  margin: 10px 0 0;
  font-size: 2rem;
  text-align: center;
}

.github-link {
  display: flex;
  align-items: center;
  background-color: transparent;
  color: white;
  font-size: 0.9rem;
  text-decoration: none;
  transition: background-color 0.3s ease;
}

.github-link:hover {
  background-color: #444;
}

.github-icon {
  fill: white;
  transition: fill 0.3s ease;
  width: 24px;
  height: 24px;
  margin-right: 8px;
}

.github-link:hover .github-icon {
  fill: #0366d6;
}

@media (min-width: 768px) {
  .header-content {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .header-top {
    width: auto;
    order: -1;
  }

  .header h1 {
    margin: 0;
    font-size: 2rem;
    flex: 1;
    text-align: center;
  }

  .github-link {
    order: 1;
    margin-left: 10px;
  }
}

@media (max-width: 767px) {
  .header-top {
    width: 100%;
  }

  .header h1 {
    font-size: 1rem;
    margin-top: 10px;
  }

  .github-link {
    font-size: 0.7rem;
  }

  .github-icon {
    width: 16px;
    height: 16px;
    margin-right: 4px;
  }
}

.content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 50px);
}

.map-container {
  flex-grow: 1;
  position: relative;
  height: 100%;
}

.controls {
  background-color: white;
  padding: 20px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 500;
}

@media (min-width: 768px) {
  .content {
    flex-direction: row;
  }

  .map-container {
    width: 70%;
  }

  .controls {
    width: 30%;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  }
}

@media (max-width: 767px) {
  .content {
    flex-direction: column;
  }

  .map-container {
    width: 100%;
    height: calc(
      100vh - 50px - 70vh
    ); /* Adjust based on the height of the ListSelector */
  }
}

.leaflet-interactive:focus {
  outline: none;
}
</style>

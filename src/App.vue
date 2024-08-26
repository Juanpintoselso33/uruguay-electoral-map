<template>
  <div id="app">
    <Header
      :regions="regions"
      :currentRegion="currentRegion"
      @regionSelected="handleRegionSelected"
      :isLoading="regionStore.isLoading"
    />
    <main class="content">
      <ListSelector
        :lists="availableLists"
        :isODN="isODN"
        :partiesAbbrev="partiesAbbrev"
        :selectedParty="selectedParty"
        :partiesByList="currentPartiesByList"
        :candidates="uniqueSortedCandidates"
        :precandidatosByList="currentRegion.precandidatosByList ?? {}"
        :currentRegion="currentRegion.name"
        v-model:selectedLists="selectedLists"
        v-model:selectedCandidates="selectedCandidates"
        @updateIsODN="regionStore.updateIsODN"
        @updateSelectedParty="regionStore.updateSelectedParty"
      />
      <div class="map-container">
        <RegionMap
          :regionName="currentRegion.name"
          :selectedLists="selectedLists"
          :votosPorListas="currentRegion.votosPorListas ?? {}"
          :maxVotosPorListas="currentRegion.maxVotosPorListas ?? {}"
          :partiesByList="currentRegion.partiesByList ?? {}"
          :precandidatosByList="currentRegion.precandidatosByList ?? {}"
          :geojsonData="currentRegion.geojsonData"
          :selectedNeighborhood="selectedNeighborhood"
          :isODN="isODN"
          :partiesAbbrev="partiesAbbrev"
          :selectedCandidates="selectedCandidates"
          :currentRegion="currentRegion.name"
          :voteOperations="voteOperations"
          @updateSelectedNeighborhood="regionStore.updateSelectedNeighborhood"
          @mapInitialized="handleMapInitialized"
          @initializeMap="handleInitializeMap"
          :isLoading="regionStore.isLoading"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import Header from "./components/Header.vue";
import ListSelector from "./components/ListSelector.vue";
import RegionMap from "./components/RegionMap.vue";
import partiesAbbrev from "../public/partidos_abrev.json";
import { useRegionStore } from "./stores/regionStore";
import { storeToRefs } from "pinia";
import { useMapStore } from "./stores/mapStore";
import { Region } from "../src/types/Region"; // Add this import
import { useVoteOperations } from "./composables/useVoteOperations";

const regionStore = useRegionStore();
const {
  regions,
  currentRegion,
  availableLists,
  selectedLists,
  selectedNeighborhood,
  isODN,
  selectedParty,
  selectedCandidates,
  uniqueSortedCandidates,
  currentPartiesByList,
} = storeToRefs(regionStore);

const voteOperations = computed(() => {
  return useVoteOperations({
    votosPorListas: currentRegion.value.votosPorListas || {},
    precandidatosByList: currentRegion.value.precandidatosByList || {},
    selectedLists: selectedLists.value,
    selectedCandidates: selectedCandidates.value,
    partiesByList: currentRegion.value.partiesByList || {},
  });
});

const handleMapInitialized = () => {
  if (currentRegion.value.geojsonData) {
    regionStore.updateCurrentRegion({ ...currentRegion.value });
  }
};

const handleInitializeMap = async () => {
  if (currentRegion.value.geojsonData) {
    regionStore.updateCurrentRegion({ ...currentRegion.value });
    const mapComponent = document.querySelector(".montevideo-map");
    if (mapComponent instanceof HTMLElement) {
      const mapStore = useMapStore();
      try {
        await mapStore.initializeMap(
          mapComponent,
          currentRegion.value.geojsonData
        );
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    } else {
      console.error("Map container not found or is not an HTMLElement");
    }
  } else {
    console.error("No geojsonData available for initialization");
  }
};

const handleRegionSelected = async (region: Region) => {
  await regionStore.setCurrentRegion(region);
  console.log("New region selected:", region.name);
};

onMounted(() => {
  regionStore.fetchRegionData().then(() => {
    if (currentRegion.value.geojsonData) {
      regionStore.updateCurrentRegion({ ...currentRegion.value });
    }
  });
});
</script>

<style lang="scss">
@import "@/styles/variables";

#app {
  font-family: Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: $text-color;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: $primary-color;
  color: $background-color;
  padding: 10px 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000; // Asegurar que el header esté siempre encima
}

.content {
  display: flex;
  flex-direction: column;
  height: calc(
    100vh - 60px
  ); // Ajustar este valor basado en la altura del header
  margin-top: 60px; // Añadir margen superior para evitar superposición
}

.map-container {
  flex-grow: 1;
  position: relative;
  height: 100%;
}

.controls {
  background-color: $background-color;
  padding: 20px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 500;
}

.leaflet-interactive:focus {
  outline: none;
}

@media (min-width: $mobile-breakpoint) {
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

@media (max-width: $mobile-breakpoint - 1) {
  .header {
    &-content {
      padding: 10px;
    }

    &-top {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }

    &-left,
    &-right {
      flex: 0 0 auto;
    }

    &-title {
      font-size: 1.2rem;
      margin-top: 10px;
      text-align: center;
      width: 100%;
    }
  }

  .content {
    height: calc(
      100vh - 60px
    ); // Ajustar este valor basado en la altura del header
  }

  .map-container {
    height: calc(
      100% - 40px
    ); // Ajustar este valor basado en la altura del ListSelector
  }

  .github-link {
    font-size: 0.8rem;
    padding: 4px 8px;

    .github-icon {
      width: 20px;
      height: 20px;
      margin-right: 6px;
    }

    span {
      display: none;
    }
  }
}
</style>

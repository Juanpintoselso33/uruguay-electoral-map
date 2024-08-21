<template>
  <div id="app">
    <header class="header">
      <div class="header-content">
        <div class="header-top">
          <RegionSelector
            :regions="regions"
            :currentRegion="currentRegion"
            @regionSelected="handleRegionSelected"
            :isLoading="regionStore.isLoading"
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
              fill="currentColor"
            >
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
              />
            </svg>
            <span>Juan Pintos Elso</span>
          </a>
        </div>
        <h1>Votos por listas por zona de {{ currentRegion.name }}</h1>
      </div>
    </header>
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
import ListSelector from "./components/ListSelector.vue";
import RegionMap from "./components/RegionMap.vue";
import RegionSelector from "./components/RegionSelector.vue";
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
};

onMounted(() => {
  regionStore.fetchRegionData().then(() => {
    if (currentRegion.value.geojsonData) {
      regionStore.updateCurrentRegion({ ...currentRegion.value });
    }
  });
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
  transition: color 0.3s ease;
  padding: 5px 10px;
  border-radius: 4px;
}

.github-link:hover {
  color: #0366d6;
}

.github-icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  transition: fill 0.3s ease;
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
    font-size: 0.8rem;
    padding: 4px 8px;
  }

  .github-icon {
    width: 20px;
    height: 20px;
    margin-right: 6px;
  }

  .github-link span {
    max-width: 100px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

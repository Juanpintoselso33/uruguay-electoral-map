<template>
  <div id="app">
    <header class="header">
      <div class="header-content">
        <div class="header-top">
          <RegionSelector
            :regions="regions"
            :currentRegion="currentRegion"
            @regionSelected="setCurrentRegion"
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
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
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
        :precandidatosByList="precandidatosByList"
        :candidatesByParty="candidatesByParty"
        :currentRegion="currentRegion.name"
        v-model:selectedLists="selectedLists"
        v-model:selectedCandidates="selectedCandidates"
        @updateIsODN="updateIsODN"
        @updateSelectedParty="updateSelectedParty"
      />
      <div class="map-container">
        <RegionMap
          :regionName="currentRegion.name"
          :selectedLists="selectedLists"
          :votosPorListas="currentRegion.votosPorListas || {}"
          :maxVotosPorListas="currentRegion.maxVotosPorListas || {}"
          :partiesByList="currentRegion.partiesByList || {}"
          :precandidatosByList="currentRegion.precandidatosByList || {}"
          :geojsonData="currentRegion.geojsonData"
          :selectedNeighborhood="selectedNeighborhood"
          :isODN="isODN"
          :partiesAbbrev="partiesAbbrev"
          :selectedCandidates="selectedCandidates"
          :mapCenter="currentRegion.mapCenter"
          :mapZoom="currentRegion.mapZoom"
          :getVotosForNeighborhood="getVotosForNeighborhood"
          @updateSelectedNeighborhood="updateSelectedNeighborhood"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, watchEffect } from "vue";
import Papa from "papaparse";
import ListSelector from "./components/ListSelector.vue";
import RegionMap from "./components/RegionMap.vue";
import RegionSelector from "./components/RegionSelector.vue";
import partiesAbbrev from "../public/partidos_abrev.json";

interface Region {
  name: string;
  odnCsvPath: string;
  oddCsvPath: string;
  geojsonPath: string;
  mapCenter: [number, number];
  mapZoom: number;
  votosPorListas?: Record<string, Record<string, number>>;
  maxVotosPorListas?: Record<string, number>;
  partiesByList?: Record<string, string>;
  precandidatosByList?: Record<string, string>;
  geojsonData?: any;
}

const availableLists = ref<string[]>([]);
const selectedLists = ref<string[]>([]);
const selectedNeighborhood = ref<string | null>(null);
const isODN = ref(false);
const partiesByList = ref<Record<string, string>>({});
const selectedParty = ref<string>("");
const precandidatosByList = ref<Record<string, string>>({});
const selectedCandidates = ref<string[]>([]);

const regions = ref<Region[]>([
  {
    name: "Montevideo",
    odnCsvPath: "/montevideo_odn_dataset_con_zona.csv",
    oddCsvPath: "/montevideo_odd_dataset_con_zona.csv",
    geojsonPath: "/montevideo_map.json",
    mapCenter: [-34.8211, -56.225],
    mapZoom: 11.5,
  },
  {
    name: "Maldonado",
    odnCsvPath: "/maldonado_odn_dataset_con_zona.csv",
    oddCsvPath: "/maldonado_odd_dataset_con_zona.csv",
    geojsonPath: "/maldonado_map.json",
    mapCenter: [-34.5211, -55.0],
    mapZoom: 9.5,
  },
  {
    name: "Treinta y Tres",
    odnCsvPath: "/treinta_y_tres_odn_dataset_con_zona.csv",
    oddCsvPath: "/treinta_y_tres_odd_dataset_con_zona.csv",
    geojsonPath: "/treinta_y_tres_map.json",
    mapCenter: [-33.2211, -54.325],
    mapZoom: 10.5,
  },
  // Add other regions here
]);

const currentRegion = ref<Region>(regions.value[0]);

const onListsSelected = (lists: string[]) => {
  selectedLists.value = lists;
  selectedCandidates.value = []; // Clear selected candidates when lists are selected
};

const onCandidatesSelected = (candidates: string[]) => {
  selectedCandidates.value = candidates;
  selectedLists.value = []; // Clear selected lists when candidates are selected
};

const updateIsODN = (value: boolean) => {
  isODN.value = value;
  fetchRegionData(currentRegion.value);
};

const processCSV = (csvText: string) => {
  const result = Papa.parse(csvText, { header: true });
  const data: Array<{
    ZONA: string;
    CNT_VOTOS: string;
    HOJA: string;
    PARTIDO: string;
    PRECANDIDATO: string;
  }> = result.data;

  const votosPorListas: Record<string, Record<string, number>> = {};
  const maxVotosPorListas: Record<string, number> = {};
  const lists = new Set<string>();
  const partiesByList: Record<string, string> = {};
  const precandidatosByList: Record<string, string> = {};

  data.forEach((row) => {
    if (!votosPorListas[row.HOJA]) {
      votosPorListas[row.HOJA] = {};
      maxVotosPorListas[row.HOJA] = 0;
      partiesByList[row.HOJA] = row.PARTIDO;
      precandidatosByList[row.HOJA] = row.PRECANDIDATO;
    }
    votosPorListas[row.HOJA][row.ZONA] =
      (votosPorListas[row.HOJA][row.ZONA] || 0) + parseInt(row.CNT_VOTOS, 10);
    maxVotosPorListas[row.HOJA] = Math.max(
      maxVotosPorListas[row.HOJA],
      votosPorListas[row.HOJA][row.ZONA]
    );
    lists.add(row.HOJA);
  });

  return {
    votosPorListas,
    maxVotosPorListas,
    lists: Array.from(lists).sort((a, b) => parseInt(a) - parseInt(b)),
    partiesByList,
    precandidatosByList,
  };
};

const fetchRegionData = async (region: Region) => {
  try {
    const csvPath = isODN.value ? region.odnCsvPath : region.oddCsvPath;
    const response = await fetch(csvPath);
    const csvText = await response.text();
    console.log(`Fetched CSV data for ${region.name}:`, csvText.slice(0, 200)); // Log the first 200 characters of the CSV

    const {
      votosPorListas: newVotosPorListas,
      maxVotosPorListas: newMaxVotosPorListas,
      lists,
      partiesByList: newPartiesByList,
      precandidatosByList: newPrecandidatosByList,
    } = processCSV(csvText);

    console.log(`Processed data for ${region.name}:`, {
      votosPorListasCount: Object.keys(newVotosPorListas).length,
      maxVotosPorListasCount: Object.keys(newMaxVotosPorListas).length,
      listsCount: lists.length,
      partiesByListCount: Object.keys(newPartiesByList).length,
      precandidatosByListCount: Object.keys(newPrecandidatosByList).length,
    });

    const geojsonResponse = await fetch(region.geojsonPath);
    if (!geojsonResponse.ok) throw new Error("Failed to fetch GeoJSON data");
    const geojsonData = await geojsonResponse.json();

    availableLists.value = lists;
    currentRegion.value = {
      ...region,
      votosPorListas: newVotosPorListas || {},
      maxVotosPorListas: newMaxVotosPorListas || {},
      partiesByList: newPartiesByList || {},
      precandidatosByList: newPrecandidatosByList || {},
      geojsonData: geojsonData || null,
    };
  } catch (error) {
    console.error("Error fetching region data:", error);
    // You might want to add some user-facing error handling here
  }
};

const getVotosForNeighborhood = (neighborhood: string): number => {
  if (selectedCandidates.value.length > 0) {
    return selectedCandidates.value.reduce((acc, candidate) => {
      return (
        acc +
        Object.entries(currentRegion.value.votosPorListas).reduce(
          (sum, [list, votes]) => {
            if (currentRegion.value.precandidatosByList[list] === candidate) {
              return sum + (votes[neighborhood] || 0);
            }
            return sum;
          },
          0
        )
      );
    }, 0);
  } else {
    return selectedLists.value.reduce((acc, sheetNumber) => {
      return (
        acc +
        (currentRegion.value.votosPorListas[sheetNumber]?.[neighborhood] || 0)
      );
    }, 0);
  }
};

const updateSelectedNeighborhood = (neighborhood: string | null) => {
  selectedNeighborhood.value = neighborhood;
};

const updateSelectedParty = (party: string) => {
  selectedParty.value = party;
};

const uniqueSortedCandidates = computed(() => {
  if (!currentRegion.value || !currentRegion.value.precandidatosByList) {
    return [];
  }
  return Array.from(
    new Set(Object.values(currentRegion.value.precandidatosByList))
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
});

const candidatesByParty = computed(() => {
  const result: Record<string, string> = {};
  if (
    currentRegion.value &&
    currentRegion.value.precandidatosByList &&
    currentRegion.value.partiesByList
  ) {
    Object.entries(currentRegion.value.precandidatosByList).forEach(
      ([list, candidate]) => {
        const party = currentRegion.value.partiesByList[list];
        if (party && candidate) {
          result[candidate] = party;
        }
      }
    );
  }
  return result;
});

const setCurrentRegion = (region: Region) => {
  if (currentRegion.value.name !== region.name) {
    currentRegion.value = region;
    selectedLists.value = []; // Reset selected lists
    selectedCandidates.value = []; // Reset selected candidates
    fetchRegionData(region);
  }
};

const currentPartiesByList = computed(
  () => currentRegion.value.partiesByList || {}
);

onMounted(() => {
  fetchRegionData(currentRegion.value);
});

watch([isODN], () => {
  selectedLists.value = []; // Reset selected lists
  selectedCandidates.value = []; // Reset selected candidates
  fetchRegionData(currentRegion.value);
});

watch(
  () => currentRegion.value.name,
  (newRegion, oldRegion) => {
    if (newRegion !== oldRegion) {
      selectedLists.value = [];
      selectedCandidates.value = [];
    }
  }
);

watchEffect(() => {
  console.log("ListSelector props:", {
    availableListsCount: availableLists.value.length,
    isODN: isODN.value,
    partiesAbbrevCount: Object.keys(partiesAbbrev).length,
    selectedParty: selectedParty.value,
    partiesByListCount: Object.keys(currentPartiesByList.value).length,
    candidatesCount: uniqueSortedCandidates.value.length,
    precandidatosByListCount: Object.keys(precandidatosByList.value).length,
    candidatesByPartyCount: Object.keys(candidatesByParty.value).length,
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

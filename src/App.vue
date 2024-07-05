<template>
  <div id="app">
    <header class="header">
      <h1>Montevideo Neighborhood Map</h1>
    </header>
    <main class="content">
      <div class="map-container">
        <MontevideoMap
          :selectedLists="selectedLists"
          :votosPorListas="votosPorListas"
          :maxVotosPorListas="maxVotosPorListas"
          :getVotosForNeighborhood="getVotosForNeighborhood"
          :geojsonData="geojsonData"
          :selectedNeighborhood="selectedNeighborhood"
          @updateSelectedNeighborhood="updateSelectedNeighborhood"
        />
      </div>
      <ListSelector :lists="availableLists" @listsSelected="onListsSelected" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import Papa from "papaparse";
import ListSelector from "./components/ListSelector.vue";
import MontevideoMap from "./components/MontevideoMap.vue";

const availableLists = ref<string[]>([]);
const selectedLists = ref<string[]>([]);
const votosPorListas = ref<Record<string, Record<string, number>>>({});
const maxVotosPorListas = ref<Record<string, number>>({});
const geojsonData = ref<any>(null);
const selectedNeighborhood = ref<string | null>(null);

const onListsSelected = (lists: string[]) => {
  selectedLists.value = lists;
};

const processCSV = (csvText: string) => {
  const result = Papa.parse(csvText, { header: true });
  const data: Array<{
    ZONA: string;
    CNT_VOTOS: string;
    HOJA: string;
  }> = result.data;

  const votosPorListas: Record<string, Record<string, number>> = {};
  const maxVotosPorListas: Record<string, number> = {};
  const lists = new Set<string>();

  data.forEach((row) => {
    if (!votosPorListas[row.HOJA]) {
      votosPorListas[row.HOJA] = {};
      maxVotosPorListas[row.HOJA] = 0;
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
  };
};

const fetchAvailableLists = async () => {
  try {
    const response = await fetch(
      "/Barrios_Mapeados_Finales_Revisados_Correctos.csv"
    );
    const csvText = await response.text();
    const {
      votosPorListas: votos,
      maxVotosPorListas: maxVotos,
      lists,
    } = processCSV(csvText);
    availableLists.value = lists;
    votosPorListas.value = votos;
    maxVotosPorListas.value = maxVotos;
  } catch (error) {
    console.error("Error fetching CSV data:", error);
  }
};

const fetchGeoJSONData = async () => {
  try {
    const response = await fetch("/v_sig_barrios.json");
    geojsonData.value = await response.json();
  } catch (error) {
    console.error("Error fetching GeoJSON data:", error);
  }
};

const getVotosForNeighborhood = (neighborhood: string): number => {
  return selectedLists.value.reduce((acc, sheetNumber) => {
    return acc + (votosPorListas.value[sheetNumber]?.[neighborhood] || 0);
  }, 0);
};

const updateSelectedNeighborhood = (neighborhood: string | null) => {
  selectedNeighborhood.value = neighborhood;
};

onMounted(() => {
  fetchAvailableLists();
  fetchGeoJSONData();
});
</script>

<style>
#app {
  font-family: Arial, sans-serif;
}

.header {
  text-align: center;
  background-color: #333;
  color: white;
  padding: 10px 0;
  width: 100%;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 50px); /* Adjust based on your header height */
}

.map-container {
  width: 100%;
  height: 70vh;
}

@media (min-width: 768px) {
  .content {
    flex-direction: row;
  }

  .map-container {
    flex: 2;
    height: calc(100vh - 50px); /* Adjust based on your header height */
  }

  .list-selector {
    flex: 1;
    max-width: 400px;
    height: calc(100vh - 50px); /* Adjust based on your header height */
    overflow-y: auto;
  }
}
</style>

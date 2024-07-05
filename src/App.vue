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
          :isODN="isODN"
          @updateSelectedNeighborhood="updateSelectedNeighborhood"
        />
      </div>
      <div class="controls">
        <ListSelector
          :lists="availableLists"
          :isODN="isODN"
          @listsSelected="onListsSelected"
          @updateIsODN="updateIsODN"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import Papa from "papaparse";
import ListSelector from "./components/ListSelector.vue";
import MontevideoMap from "./components/MontevideoMap.vue";

const availableLists = ref<string[]>([]);
const selectedLists = ref<string[]>([]);
const votosPorListas = ref<Record<string, Record<string, number>>>({});
const maxVotosPorListas = ref<Record<string, number>>({});
const geojsonData = ref<any>(null);
const selectedNeighborhood = ref<string | null>(null);
const isODN = ref(false);

const onListsSelected = (lists: string[]) => {
  selectedLists.value = lists;
};

const updateIsODN = (value: boolean) => {
  isODN.value = value;
  fetchAvailableLists();
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
    const filePath = isODN.value
      ? "/Barrios_Mapeados_Finales_Revisados_Correctos.csv"
      : "/votos_por_barrio_pn_mapeado.csv";
    const response = await fetch(filePath);
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
    console.error("Error fetching data:", error);
  }
};

const fetchGeoJSONData = async () => {
  try {
    const response = await fetch("/v_sig_barrios.json");
    console.log("Llegaron los datos de geojson: ", response);
    geojsonData.value = await response.json();
    console.log("GeoJSON data content:", geojsonData.value);
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

watch(isODN, () => {
  fetchAvailableLists();
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
    height: calc(100vh - 50px);
  }

  .controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
  }
}
</style>

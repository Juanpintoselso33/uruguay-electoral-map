<template>
  <div id="app">
    <header class="header">
      <h1>Votos por listas en barrios de Montevideo</h1>
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
          :partiesAbbrev="partiesAbbrev"
          :partiesByList="partiesByList"
          @updateSelectedNeighborhood="updateSelectedNeighborhood"
        />
      </div>
      <div class="controls">
        <ListSelector
          :lists="availableLists"
          :isODN="isODN"
          :partiesAbbrev="partiesAbbrev"
          :selectedParty="selectedParty"
          @listsSelected="onListsSelected"
          @updateIsODN="updateIsODN"
          @updateSelectedParty="updateSelectedParty"
          :partiesByList="partiesByList"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import Papa from "papaparse";
import ListSelector from "./components/ListSelector.vue";
import MontevideoMap from "./components/MontevideoMap.vue";
import partiesAbbrev from "../public/partidos_abrev.json";

const availableLists = ref<string[]>([]);
const selectedLists = ref<string[]>([]);
const votosPorListas = ref<Record<string, Record<string, number>>>({});
const maxVotosPorListas = ref<Record<string, number>>({});
const geojsonData = ref<any>(null);
const selectedNeighborhood = ref<string | null>(null);
const isODN = ref(false);
const partiesByList = ref<Record<string, string>>({});
const selectedParty = ref<string>("");

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
    PARTIDO: string;
  }> = result.data;

  const votosPorListas: Record<string, Record<string, number>> = {};
  const maxVotosPorListas: Record<string, number> = {};
  const lists = new Set<string>();
  const partiesByList: Record<string, string> = {};

  data.forEach((row) => {
    if (!votosPorListas[row.HOJA]) {
      votosPorListas[row.HOJA] = {};
      maxVotosPorListas[row.HOJA] = 0;
      partiesByList[row.HOJA] = row.PARTIDO;
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
  };
};

const fetchAvailableLists = async () => {
  try {
    const filePath = isODN.value
      ? "/montevideo_odn_dataset_con_zona.csv"
      : "/montevideo_odd_dataset_con_zona.csv";
    const response = await fetch(filePath);
    const csvText = await response.text();
    const {
      votosPorListas: votos,
      maxVotosPorListas: maxVotos,
      lists,
      partiesByList: parties,
    } = processCSV(csvText);
    availableLists.value = lists;
    votosPorListas.value = votos;
    maxVotosPorListas.value = maxVotos;
    partiesByList.value = parties;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

const fetchGeoJSONData = async () => {
  try {
    const response = await fetch("/montevideo_map.json");
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

const updateSelectedParty = (party: string) => {
  selectedParty.value = party;
};

const getTotalVotes = () => {
  return selectedLists.value.reduce((total, list) => {
    return (
      total +
      Object.values(votosPorListas.value[list] || {}).reduce((a, b) => a + b, 0)
    );
  }, 0);
};

const groupedSelectedLists = computed(() => {
  const grouped = {};
  selectedLists.value.forEach((list) => {
    const party = partiesByList.value[list];
    if (!grouped[party]) {
      grouped[party] = { totalVotes: 0, lists: [] };
    }
    const votes = Object.values(votosPorListas.value[list] || {}).reduce(
      (a, b) => a + b,
      0
    );
    grouped[party].totalVotes += votes;
    grouped[party].lists.push({ number: list, votes });
  });
  return grouped;
});

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

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
    <footer class="footer">
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
        <span>Ver en GitHub</span>
      </a>
    </footer>
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

@media (max-width: 767px) {
  .header {
    padding: 10px 0;
  }

  .header h1 {
    font-size: 1.5rem;
    margin: 0;
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

.github-link {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: white;
  border-radius: 8px;
  transition: background-color 0.3s ease;
}

.github-link:hover {
  background-color: #e0e0e0;
}

.github-icon {
  fill: #333;
  transition: fill 0.3s ease;
}

.github-link:hover .github-icon {
  fill: #0366d6;
}

@media (max-width: 767px) {
  .github-link {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    background-color: transparent;
  }
}

.footer {
  background-color: white;
  text-align: center;
  padding: 10px 0;
}

.github-link {
  display: flex;
  justify-content: center;
  align-items: center;
  color: black;
}
</style>

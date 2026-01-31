import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import Papa from 'papaparse';

export interface Region {
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
  geojsonData?: GeoJSON.FeatureCollection | null;
}

interface CSVRow {
  ZONA: string;
  CNT_VOTOS: string;
  HOJA: string;
  PARTIDO: string;
  PRECANDIDATO: string;
}

export const useElectoralStore = defineStore('electoral', () => {
  // State
  const regions = ref<Region[]>([]);
  const currentRegion = ref<Region | null>(null);
  const isODN = ref(false);
  const selectedLists = ref<string[]>([]);
  const selectedCandidates = ref<string[]>([]);
  const selectedParty = ref<string>('');
  const selectedNeighborhood = ref<string | null>(null);
  const availableLists = ref<string[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const currentPartiesByList = computed(() => {
    return currentRegion.value?.partiesByList || {};
  });

  const precandidatosByList = computed(() => {
    return currentRegion.value?.precandidatosByList || {};
  });

  const uniqueSortedCandidates = computed(() => {
    if (!currentRegion.value?.precandidatosByList) {
      return [];
    }
    return Array.from(
      new Set(Object.values(currentRegion.value.precandidatosByList))
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));
  });

  const candidatesByParty = computed(() => {
    const result: Record<string, string> = {};
    if (
      currentRegion.value?.precandidatosByList &&
      currentRegion.value?.partiesByList
    ) {
      Object.entries(currentRegion.value.precandidatosByList).forEach(
        ([list, candidate]) => {
          const party = currentRegion.value!.partiesByList?.[list];
          if (party && candidate) {
            result[candidate] = party;
          }
        }
      );
    }
    return result;
  });

  // Actions
  async function loadRegionsConfig() {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/regions.json');
      if (!response.ok) {
        throw new Error('Failed to load regions configuration');
      }
      const regionsConfig = await response.json();
      regions.value = regionsConfig;

      // Set first region as current if none selected
      if (regionsConfig.length > 0 && !currentRegion.value) {
        currentRegion.value = regionsConfig[0];
      }

      return regionsConfig;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error loading regions config:', err);

      // Fallback configuration
      regions.value = [
        {
          name: 'Montevideo',
          odnCsvPath: '/montevideo_odn.csv',
          oddCsvPath: '/montevideo_odd.csv',
          geojsonPath: '/montevideo_map.json',
          mapCenter: [-34.8211, -56.225] as [number, number],
          mapZoom: 11.5,
        },
      ];
      currentRegion.value = regions.value[0];
      return regions.value;
    } finally {
      isLoading.value = false;
    }
  }

  function processCSV(csvText: string) {
    const result = Papa.parse<CSVRow>(csvText, { header: true });
    const data = result.data;

    const votosPorListas: Record<string, Record<string, number>> = {};
    const maxVotosPorListas: Record<string, number> = {};
    const lists = new Set<string>();
    const partiesByList: Record<string, string> = {};
    const precandidatosByListMap: Record<string, string> = {};

    data.forEach((row) => {
      if (!row.HOJA) return;

      if (!votosPorListas[row.HOJA]) {
        votosPorListas[row.HOJA] = {};
        maxVotosPorListas[row.HOJA] = 0;
        partiesByList[row.HOJA] = row.PARTIDO;
        precandidatosByListMap[row.HOJA] = row.PRECANDIDATO;
      }

      const votes = parseInt(row.CNT_VOTOS, 10) || 0;
      votosPorListas[row.HOJA][row.ZONA] =
        (votosPorListas[row.HOJA][row.ZONA] || 0) + votes;
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
      precandidatosByList: precandidatosByListMap,
    };
  }

  async function fetchRegionData(region: Region) {
    isLoading.value = true;
    error.value = null;

    try {
      const csvPath = isODN.value ? region.odnCsvPath : region.oddCsvPath;
      const response = await fetch(csvPath);

      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${csvPath}`);
      }

      const csvText = await response.text();
      const {
        votosPorListas,
        maxVotosPorListas,
        lists,
        partiesByList,
        precandidatosByList: precandidatos,
      } = processCSV(csvText);

      const geojsonResponse = await fetch(region.geojsonPath);
      if (!geojsonResponse.ok) {
        throw new Error('Failed to fetch GeoJSON data');
      }
      const geojsonData = await geojsonResponse.json();

      availableLists.value = lists;
      currentRegion.value = {
        ...region,
        votosPorListas,
        maxVotosPorListas,
        partiesByList,
        precandidatosByList: precandidatos,
        geojsonData,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching region data:', err);
    } finally {
      isLoading.value = false;
    }
  }

  function setCurrentRegion(region: Region) {
    if (currentRegion.value?.name !== region.name) {
      currentRegion.value = region;
      selectedLists.value = [];
      selectedCandidates.value = [];
      fetchRegionData(region);
    }
  }

  function toggleDataSource(value: boolean) {
    isODN.value = value;
    selectedLists.value = [];
    selectedCandidates.value = [];
    if (currentRegion.value) {
      fetchRegionData(currentRegion.value);
    }
  }

  function selectLists(lists: string[]) {
    selectedLists.value = lists;
    selectedCandidates.value = [];
  }

  function selectCandidates(candidates: string[]) {
    selectedCandidates.value = candidates;
    selectedLists.value = [];
  }

  function setSelectedParty(party: string) {
    selectedParty.value = party;
  }

  function setSelectedNeighborhood(neighborhood: string | null) {
    selectedNeighborhood.value = neighborhood;
  }

  function clearSelection() {
    selectedLists.value = [];
    selectedCandidates.value = [];
  }

  function getVotosForNeighborhood(neighborhood: string): number {
    if (!currentRegion.value?.votosPorListas) return 0;

    if (selectedCandidates.value.length > 0) {
      return selectedCandidates.value.reduce((acc, candidate) => {
        return (
          acc +
          Object.entries(currentRegion.value!.votosPorListas || {}).reduce(
            (sum, [list, votes]) => {
              if (currentRegion.value!.precandidatosByList?.[list] === candidate) {
                return sum + (votes[neighborhood] ?? 0);
              }
              return sum;
            },
            0
          )
        );
      }, 0);
    }

    return selectedLists.value.reduce((acc, sheetNumber) => {
      return (
        acc +
        (currentRegion.value!.votosPorListas?.[sheetNumber]?.[neighborhood] ?? 0)
      );
    }, 0);
  }

  return {
    // State
    regions,
    currentRegion,
    isODN,
    selectedLists,
    selectedCandidates,
    selectedParty,
    selectedNeighborhood,
    availableLists,
    isLoading,
    error,

    // Getters
    currentPartiesByList,
    precandidatosByList,
    uniqueSortedCandidates,
    candidatesByParty,

    // Actions
    loadRegionsConfig,
    fetchRegionData,
    setCurrentRegion,
    toggleDataSource,
    selectLists,
    selectCandidates,
    setSelectedParty,
    setSelectedNeighborhood,
    clearSelection,
    getVotosForNeighborhood,
  };
});

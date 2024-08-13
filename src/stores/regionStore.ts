import { defineStore } from "pinia";
import { ref, computed } from "vue";
import Papa from "papaparse";
import { Region } from "../types/Region";

export const useRegionStore = defineStore("region", () => {
  const regions = ref<Region[]>([
    {
      name: "Montevideo",
      odnCsvPath: "/montevideo_odn.csv",
      oddCsvPath: "/montevideo_odd.csv",
      geojsonPath: "/montevideo_map.json",
      mapCenter: [-34.8211, -56.225],
      mapZoom: 11.5,
    },
    {
      name: "Treinta y Tres",
      odnCsvPath: "/treinta_y_tres_odn.csv",
      oddCsvPath: "/treinta_y_tres_odd.csv",
      geojsonPath: "/treinta_y_tres_map.json",
      mapCenter: [-33.3333, -54.3333],
      mapZoom: 10,
    },
    {
      name: "Maldonado",
      odnCsvPath: "/maldonado_odn.csv",
      oddCsvPath: "/maldonado_odd.csv",
      geojsonPath: "/maldonado_map.json",
      mapCenter: [-34.8211, -56.225],
      mapZoom: 11.5,
    },
    {
      name: "Colonia",
      odnCsvPath: "/colonia_odn.csv",
      oddCsvPath: "/colonia_odd.csv",
      geojsonPath: "/colonia_map.json",
      mapCenter: [-34.8211, -56.225],
      mapZoom: 11.5,
    },
    // Add other regions here
  ]);

  const currentRegion = ref<Region>(regions.value[0]);
  const availableLists = ref<string[]>([]);
  const selectedLists = ref<string[]>([]);
  const selectedNeighborhood = ref<string | null>(null);
  const isODN = ref(false);
  const selectedParty = ref<string>("");
  const selectedCandidates = ref<string[]>([]);

  const setCurrentRegion = async (region: Region) => {
    selectedLists.value = [];
    selectedCandidates.value = [];
    isODN.value = false;
    selectedParty.value = "";
    currentRegion.value = region;
    console.log("Current region set to:", currentRegion.value);
    await fetchRegionData();
  };

  const fetchRegionData = async () => {
    try {
      const csvPath = isODN.value
        ? currentRegion.value.odnCsvPath
        : currentRegion.value.oddCsvPath;
      const response = await fetch(csvPath);
      const csvText = await response.text();

      const {
        votosPorListas,
        maxVotosPorListas,
        lists,
        partiesByList,
        precandidatosByList,
      } = processCSV(csvText);

      const geojsonResponse = await fetch(currentRegion.value.geojsonPath);
      if (!geojsonResponse.ok) throw new Error("Failed to fetch GeoJSON data");
      const geojsonData = await geojsonResponse.json();

      availableLists.value = lists;
      currentRegion.value = {
        ...currentRegion.value,
        votosPorListas: votosPorListas || {},
        maxVotosPorListas: maxVotosPorListas || {},
        partiesByList: partiesByList || {},
        precandidatosByList: precandidatosByList || {},
        geojsonData: geojsonData || null,
      };

      console.log("Fetched region data:", currentRegion.value);
    } catch (error) {
      console.error("Error fetching region data:", error);
    }
  };

  const processCSV = (csvText: string) => {
    const result = Papa.parse(csvText, { header: true });
    const data = result.data as Array<{
      ZONA: string;
      CNT_VOTOS: string;
      HOJA: string;
      PARTIDO: string;
      PRECANDIDATO: string;
    }>;

    const votosPorListas: Record<string, Record<string, number>> = {};
    const maxVotosPorListas: Record<string, number> = {};
    const partiesByList: Record<string, string> = {};
    const precandidatosByList: Record<string, string> = {};
    const lists: string[] = [];

    data.forEach((row) => {
      if (!votosPorListas[row.HOJA]) {
        votosPorListas[row.HOJA] = {};
        lists.push(row.HOJA);
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
    });

    console.log("Processed CSV data:", {
      votosPorListas,
      maxVotosPorListas,
      lists,
      partiesByList,
      precandidatosByList,
    });

    return {
      votosPorListas,
      maxVotosPorListas,
      lists,
      partiesByList,
      precandidatosByList,
    };
  };

  const getVotosForNeighborhood = (neighborhood: string): number => {
    if (selectedCandidates.value.length > 0) {
      return selectedCandidates.value.reduce((acc, candidate) => {
        return (
          acc +
          (currentRegion.value.votosPorListas
            ? Object.entries(currentRegion.value.votosPorListas).reduce(
                (sum, [list, votes]) => {
                  if (
                    currentRegion.value.precandidatosByList?.[list] ===
                    candidate
                  ) {
                    return sum + (votes[neighborhood] ?? 0);
                  }
                  return sum;
                },
                0
              )
            : 0)
        );
      }, 0);
    } else {
      return selectedLists.value.reduce((acc, sheetNumber) => {
        return (
          acc +
          (currentRegion.value.votosPorListas?.[sheetNumber]?.[neighborhood] ??
            0)
        );
      }, 0);
    }
  };

  const getCandidateVotesForNeighborhood = (neighborhood: string): number => {
    return selectedCandidates.value.reduce((acc, candidate) => {
      return (
        acc +
        (currentRegion.value.votosPorListas
          ? Object.entries(currentRegion.value.votosPorListas).reduce(
              (sum, [list, votes]) => {
                if (
                  currentRegion.value.precandidatosByList?.[list] === candidate
                ) {
                  return sum + (votes[neighborhood] ?? 0);
                }
                return sum;
              },
              0
            )
          : 0)
      );
    }, 0);
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
          const party = currentRegion.value.partiesByList?.[list];
          if (party && candidate) {
            result[candidate] = party;
          }
        }
      );
    }
    return result;
  });

  const currentPartiesByList = computed(
    () => currentRegion.value.partiesByList || {}
  );

  const updateCurrentRegion = (region: Region) => {
    currentRegion.value = region;
  };

  const updateIsODN = (value: boolean) => {
    isODN.value = value;
    fetchRegionData();
  };

  const updateSelectedNeighborhood = (neighborhood: string | null) => {
    selectedNeighborhood.value = neighborhood;
  };

  const updateSelectedParty = (party: string) => {
    selectedParty.value = party;
  };

  return {
    regions,
    currentRegion,
    availableLists,
    selectedLists,
    selectedNeighborhood,
    isODN,
    selectedParty,
    selectedCandidates,
    setCurrentRegion,
    fetchRegionData,
    getVotosForNeighborhood,
    getCandidateVotesForNeighborhood,
    uniqueSortedCandidates,
    candidatesByParty,
    currentPartiesByList,
    updateCurrentRegion,
    updateIsODN,
    updateSelectedNeighborhood,
    updateSelectedParty,
  };
});

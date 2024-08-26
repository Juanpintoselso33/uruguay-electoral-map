import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import Papa from "papaparse";
import { Region } from "../types/Region";
import { CandidateVote } from "../types/VoteTypes";
import { useVoteOperations } from "../composables/useVoteOperations";
import { getNormalizedNeighborhood } from "../utils/mapUtils";
import partiesAbbrev from "../../public/partidos_abrev.json";
import { useMapStore } from "../stores/mapStore";

export const useRegionStore = defineStore("region", () => {
  const regions = ref<Region[]>([
    {
      name: "Montevideo",
      odnCsvPath: "/montevideo_odn.csv",
      oddCsvPath: "/montevideo_odd.csv",
      geojsonPath: "/montevideo_map.json",
    },
    {
      name: "Canelones",
      odnCsvPath: "/canelones_odn.csv",
      oddCsvPath: "/canelones_odd.csv",
      geojsonPath: "/canelones_map.json",
    },
    {
      name: "Rivera",
      odnCsvPath: "/rivera_odn.csv",
      oddCsvPath: "/rivera_odd.csv",
      geojsonPath: "/rivera_map.json",
    },
    {
      name: "Treinta y Tres",
      odnCsvPath: "/treinta_y_tres_odn.csv",
      oddCsvPath: "/treinta_y_tres_odd.csv",
      geojsonPath: "/treinta_y_tres_map.json",
    },
    {
      name: "Maldonado",
      odnCsvPath: "/maldonado_odn.csv",
      oddCsvPath: "/maldonado_odd.csv",
      geojsonPath: "/maldonado_map.json",
    },
    {
      name: "Colonia",
      odnCsvPath: "/colonia_odn.csv",
      oddCsvPath: "/colonia_odd.csv",
      geojsonPath: "/colonia_map.json",
    },
    {
      name: "Salto",
      odnCsvPath: "/salto_odn.csv",
      oddCsvPath: "/salto_odd.csv",
      geojsonPath: "/salto_map.json",
    },
    // Add other regions here
  ]);

  const mapStore = useMapStore();

  const currentRegion = ref<Region>({
    ...regions.value[0],
    partiesAbbrev: partiesAbbrev,
  });
  const availableLists = ref<string[]>([]);
  const selectedLists = ref<string[]>([]);
  const selectedNeighborhood = ref<string | null>(null);
  const isODN = ref(false);
  const selectedParty = ref<string>("");
  const selectedCandidates = ref<string[]>([]);
  const isLoading = ref(false);
  const groupedSelectedItems = ref({});

  const setCurrentRegion = async (region: Region) => {
    currentRegion.value = { ...region };
    console.log("Region store updated:", currentRegion.value.name);
    // Add any additional logic needed when changing regions
    isLoading.value = true;
    try {
      selectedLists.value = [];
      selectedCandidates.value = [];
      isODN.value = false;
      selectedParty.value = "";
      await fetchRegionData();
      updateGroupedItems();
      console.log("Calling mapStore.updateMapData");
      mapStore.updateMapData();
    } finally {
      isLoading.value = false;
    }
  };

  const fetchRegionData = async () => {
    try {
      isLoading.value = true;
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
        precandidatosByParty,
        partiesAbbrev,
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
        precandidatosByParty: precandidatosByParty || {},
        geojsonData: geojsonData || null,
        partiesAbbrev: partiesAbbrev || {},
      };
    } catch (error) {
      console.error("Error fetching region data:", error);
    } finally {
      isLoading.value = false;
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
    const precandidatosByParty: Record<string, string[]> = {};
    const lists: string[] = [];

    data.forEach((row) => {
      if (!votosPorListas[row.HOJA]) {
        votosPorListas[row.HOJA] = {};
        lists.push(row.HOJA);
        maxVotosPorListas[row.HOJA] = 0;
        partiesByList[row.HOJA] = row.PARTIDO;
        precandidatosByList[row.HOJA] = row.PRECANDIDATO;

        if (!precandidatosByParty[row.PARTIDO]) {
          precandidatosByParty[row.PARTIDO] = [];
        }
        if (!precandidatosByParty[row.PARTIDO].includes(row.PRECANDIDATO)) {
          precandidatosByParty[row.PARTIDO].push(row.PRECANDIDATO);
        }
      }
      votosPorListas[row.HOJA][row.ZONA] =
        (votosPorListas[row.HOJA][row.ZONA] || 0) + parseInt(row.CNT_VOTOS, 10);
      maxVotosPorListas[row.HOJA] = Math.max(
        maxVotosPorListas[row.HOJA],
        votosPorListas[row.HOJA][row.ZONA]
      );
    });

    return {
      votosPorListas,
      maxVotosPorListas,
      lists,
      partiesByList,
      precandidatosByList,
      precandidatosByParty,
      partiesAbbrev, // Add this line
    };
  };

  const voteOperations = computed(() => {
    return useVoteOperations({
      votosPorListas: currentRegion.value.votosPorListas || {},
      precandidatosByList: currentRegion.value.precandidatosByList || {},
      selectedLists: selectedLists.value,
      selectedCandidates: selectedCandidates.value,
      partiesByList: currentRegion.value.partiesByList || {},
    });
  });

  const setGroupedSelectedItems = (items) => {
    groupedSelectedItems.value = items;
  };

  const updateGroupedItems = () => {
    const items = voteOperations.value.groupedSelectedItems;
    setGroupedSelectedItems(items.value);
    console.log("Grouped items:", items.value);
  };

  watch([selectedCandidates, selectedLists], updateGroupedItems);

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

  const getCandidateVotesForNeighborhood = (
    neighborhood: string
  ): CandidateVote[] => {
    const votes: Record<string, number> = {};

    selectedCandidates.value.forEach((candidate) => {
      votes[candidate] =
        voteOperations.value.getVotesForNeighborhood(neighborhood);
    });

    console.log("Candidate votes for neighborhood:", votes);

    return Object.entries(votes).map(([candidate, voteCount]) => {
      const party = Object.entries(
        currentRegion.value.partiesByList || {}
      ).find(([list, precandidato]) => precandidato === candidate)?.[0];

      return {
        candidate,
        votes: voteCount,
        party: party || "Unknown",
      };
    });
  };

  const getMaxVotes = (
    geojsonData: any,
    selectedCandidates: string[],
    getVotesForNeighborhood: Function,
    getCandidateTotalVotes: Function
  ) => {
    if (!geojsonData || !geojsonData.features) {
      console.log("No geojsonData or features");
      return 0; // Return 0 when there is no data
    }

    const maxVotes =
      selectedCandidates.length > 0
        ? Math.max(
            ...geojsonData.features.map((feature: any) => {
              const neighborhood = getNormalizedNeighborhood(feature);
              const votes = getCandidateTotalVotes(neighborhood);
              return votes;
            })
          )
        : Math.max(
            ...geojsonData.features.map((feature: any) => {
              const neighborhood = getNormalizedNeighborhood(feature);
              const votes = getVotesForNeighborhood(neighborhood);
              return votes;
            })
          );
    return maxVotes || 0; // Return 0 if maxVotes is 0
  };

  const getVotesForNeighborhood = (neighborhood: string) => {
    return voteOperations.value.getVotesForNeighborhood(neighborhood);
  };

  function updateSelectedLists(lists: string[]) {
    selectedLists.value = lists;
  }

  return {
    regions,
    currentRegion,
    availableLists,
    selectedLists,
    selectedNeighborhood,
    isODN,
    precandidatosByParty: computed(
      () => currentRegion.value.precandidatosByParty
    ),
    selectedParty,
    selectedCandidates,
    setCurrentRegion,
    fetchRegionData,
    uniqueSortedCandidates,
    currentPartiesByList,
    updateCurrentRegion,
    updateIsODN,
    updateSelectedNeighborhood,
    updateSelectedParty,
    getVotesForNeighborhood,
    getCandidateVotesForNeighborhood,
    groupCandidatesByParty: voteOperations.value.groupCandidatesByParty,
    groupListsByParty: voteOperations.value.groupListsByParty,
    getMaxVotes,
    isLoading,
    updateSelectedLists,
    groupedSelectedItems,
    setGroupedSelectedItems,
  };
});

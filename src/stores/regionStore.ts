import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import Papa from "papaparse";
import { Region } from "../types/Region";
import { CandidateVote } from "../types/VoteTypes";
import { useVoteCalculations } from "../composables/useVoteCalculations";
import { useVoteGrouping } from "../composables/useVoteGrouping";
import { getNormalizedNeighborhood } from "../utils/mapUtils";

export const useRegionStore = defineStore("region", () => {
  const regions = ref<Region[]>([
    {
      name: "Montevideo",
      odnCsvPath: "/montevideo_odn.csv",
      oddCsvPath: "/montevideo_odd.csv",
      geojsonPath: "/montevideo_map.json",
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
    // Add other regions here
  ]);

  const currentRegion = ref<Region>(regions.value[0]);
  const availableLists = ref<string[]>([]);
  const selectedLists = ref<string[]>([]);
  const selectedNeighborhood = ref<string | null>(null);
  const isODN = ref(false);
  const selectedParty = ref<string>("");
  const selectedCandidates = ref<string[]>([]);
  const isLoading = ref(false);

  watch(selectedLists, (newValue) => {
    console.log("Selected lists updated:", newValue);
  });

  watch(
    () => currentRegion.value.votosPorListas,
    (newValue) => {
      console.log("votosPorListas updated:", newValue);
    },
    { deep: true }
  );

  const setCurrentRegion = async (region: Region) => {
    isLoading.value = true;
    try {
      selectedLists.value = [];
      selectedCandidates.value = [];
      isODN.value = false;
      selectedParty.value = "";
      currentRegion.value = region;
      console.log("Current region set to:", currentRegion.value);
      await fetchRegionData();
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
    } finally {
      isLoading.value = false;
    }
  };

  const processCSV = (csvText: string) => {
    console.log("Processing CSV data...");
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

  const voteCalculations = computed(() => {
    const calculations = useVoteCalculations(
      {
        selectedCandidates: selectedCandidates.value,
        selectedLists: selectedLists.value,
        votosPorListas: currentRegion.value.votosPorListas || {},
        precandidatosByList: currentRegion.value.precandidatosByList || {},
      },
      currentRegion.value
    );

    return {
      ...calculations,
      getTotalVotesForList: (list: string) =>
        calculations.getTotalVotesForList(
          currentRegion.value.votosPorListas || {},
          list
        ),
      getCandidateTotalVotesForAllNeighborhoods: (candidate: string) =>
        calculations.getCandidateTotalVotesForAllNeighborhoods(candidate),
    };
  });

  const voteGrouping = useVoteGrouping(
    {
      selectedCandidates,
      selectedLists,
      votosPorListas: computed(() => currentRegion.value.votosPorListas || {}),
      partiesByList: computed(() => currentRegion.value.partiesByList || {}),
      precandidatosByList: computed(
        () => currentRegion.value.precandidatosByList || {}
      ),
    },
    {
      getTotalVotesForList: (list: string) =>
        voteCalculations.value.getTotalVotesForList(list),
      getCandidateTotalVotesForAllNeighborhoods: (candidate: string) =>
        voteCalculations.value.getCandidateTotalVotesForAllNeighborhoods(
          candidate
        ),
    }
  );

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

  const getCandidateVotesForNeighborhood = (
    neighborhood: string
  ): CandidateVote[] => {
    const votes: Record<string, number> = {};

    selectedCandidates.value.forEach((candidate) => {
      votes[candidate] =
        voteCalculations.value.getVotesForNeighborhood(neighborhood);
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
    console.log("getMaxVotes called with:", {
      geojsonData,
      selectedCandidates,
      getVotesForNeighborhood,
      getCandidateTotalVotes,
    });
    console.log("getMaxVotes called");
    console.log("geojsonData:", geojsonData);
    console.log("selectedCandidates:", selectedCandidates);

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

    console.log(`Max votes: ${maxVotes}`);
    return maxVotes || 0; // Return 0 if maxVotes is 0
  };

  const getVotesForNeighborhood = (neighborhood: string) => {
    return voteCalculations.value.getVotesForNeighborhood(neighborhood);
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
    selectedParty,
    selectedCandidates,
    setCurrentRegion,
    fetchRegionData,
    uniqueSortedCandidates,
    candidatesByParty,
    currentPartiesByList,
    updateCurrentRegion,
    updateIsODN,
    updateSelectedNeighborhood,
    updateSelectedParty,
    getVotesForNeighborhood,
    getCandidateVotesForNeighborhood,
    groupCandidatesByParty: voteGrouping.groupCandidatesByParty,
    groupListsByParty: voteGrouping.groupListsByParty,
    getMaxVotes,
    isLoading,
    updateSelectedLists,
  };
});

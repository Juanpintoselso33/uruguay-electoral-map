import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import Papa from 'papaparse';

export interface Election {
  id: string;
  year: number;
  type: 'internas' | 'nacionales' | 'balotaje' | 'departamentales';
  name: string;
  date: string;
}

export interface ElectionsMeta {
  availableElections: string[];
  departmentsByElection: Record<string, string[]>;
  generatedAt: string;
}

export interface Region {
  name: string;
  slug?: string;
  odnCsvPath: string;
  oddCsvPath: string;
  geojsonPath: string;
  odnJsonPath?: string;
  oddJsonPath?: string;
  mapJsonPath?: string;
  availableElections?: string[];
  defaultElection?: string;
  mapCenter: [number, number];
  mapZoom: number;
  votosPorListas?: Record<string, Record<string, number>>;
  maxVotosPorListas?: Record<string, number>;
  partiesByList?: Record<string, string>;
  precandidatosByList?: Record<string, string>;
  geojsonData?: GeoJSON.FeatureCollection | null;
  seriesLocalityMapping?: Record<string, string>;
  seriesBarrioMapping?: Record<string, string[]>;
}

interface CSVRow {
  ZONA: string;
  CNT_VOTOS: string;
  HOJA: string;
  PARTIDO: string;
  PRECANDIDATO: string;
}

interface ProcessedElectoralData {
  metadata: {
    type: string;
    schemaType?: string;
    processedAt: string;
    department: string;
    election?: string;
    stats: {
      totalRows: number;
      uniqueLists: number;
      uniqueZones: number;
      uniqueParties: number;
      totalVotes: number;
    };
  };
  data: {
    votosPorListas: Record<string, Record<string, number>>;
    maxVotosPorListas: Record<string, number>;
    partiesByList: Record<string, string>;
    precandidatosByList: Record<string, string>;
    zoneList: string[];
    partyList: string[];
  };
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

  // Multi-election state
  const availableElections = ref<string[]>([]);
  const currentElection = ref<string>('internas-2024');  // Default to internas-2024 (most recent)
  const electionsMeta = ref<ElectionsMeta | null>(null);
  const electionsFromCatalog = ref<Election[]>([]);

  // Getters
  const availableRegions = computed(() => {
    // Filter regions that have data for the current election
    return regions.value.filter(region => {
      const hasElection = region.availableElections?.includes(currentElection.value);
      return hasElection;
    });
  });

  const isInternasElection = computed(() => {
    // Check if current election is "internas" type (has precandidatos/ODN)
    return currentElection.value.includes('internas');
  });

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
  async function loadElectionsMeta() {
    try {
      const response = await fetch('/data/elections-meta.json');
      if (response.ok) {
        const meta = await response.json();
        electionsMeta.value = meta;
        availableElections.value = meta.availableElections || [];

        // Set current election to first available if not set
        if (availableElections.value.length > 0 && !currentElection.value) {
          currentElection.value = availableElections.value[0];
        }
      }
    } catch (err) {
      console.warn('Elections metadata not available:', err);
    }
  }

  async function loadElectionsCatalog() {
    try {
      const response = await fetch('/elections-catalog.json');
      if (response.ok) {
        const catalog = await response.json();
        electionsFromCatalog.value = catalog.elections || [];
      }
    } catch (err) {
      console.warn('Elections catalog not available:', err);
    }
  }

  async function loadRegionsConfig() {
    isLoading.value = true;
    error.value = null;

    try {
      // Load elections metadata first
      await loadElectionsMeta();
      await loadElectionsCatalog();

      const response = await fetch('/regions.json');
      if (!response.ok) {
        throw new Error('Failed to load regions configuration');
      }
      const regionsConfig = await response.json();
      regions.value = regionsConfig;

      // Set first region that has data for current election
      if (regionsConfig.length > 0 && !currentRegion.value) {
        const firstAvailable = regionsConfig.find((r: Region) =>
          r.availableElections?.includes(currentElection.value)
        );

        if (firstAvailable) {
          currentRegion.value = firstAvailable;
          console.log('[Electoral Store] Initial region set to:', firstAvailable.name);
        } else {
          // Fallback to first region
          currentRegion.value = regionsConfig[0];
          console.warn('[Electoral Store] No region found for current election, using first region');
        }
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
          availableElections: ['internas-2024'],
          defaultElection: 'internas-2024',
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

  async function fetchRegionData(region: Region, election?: string) {
    isLoading.value = true;
    error.value = null;

    const electionToUse = election || currentElection.value || region.defaultElection || 'internas-2024';

    console.log('[Electoral Store] fetchRegionData called')
    console.log('[Electoral Store] Region:', region.name)
    console.log('[Electoral Store] Region slug:', region.slug)
    console.log('[Electoral Store] Election:', electionToUse)
    console.log('[Electoral Store] isODN:', isODN.value)

    try {
      // Try to use JSON format first (multi-election support)
      const jsonPath = isODN.value
        ? `/data/electoral/${electionToUse}/${region.slug}/odn.json`
        : `/data/electoral/${electionToUse}/${region.slug}/odd.json`;

      console.log('[Electoral Store] Attempting to fetch:', jsonPath)

      let votosPorListas: Record<string, Record<string, number>>;
      let maxVotosPorListas: Record<string, number>;
      let lists: string[];
      let partiesByList: Record<string, string>;
      let precandidatos: Record<string, string>;

      // Try to fetch JSON data first
      const jsonResponse = await fetch(jsonPath);
      console.log('[Electoral Store] JSON fetch response status:', jsonResponse.status)

      if (jsonResponse.ok) {
        // Use new JSON format with election-specific paths

        const jsonData: ProcessedElectoralData = await jsonResponse.json();

        votosPorListas = jsonData.data.votosPorListas;
        maxVotosPorListas = jsonData.data.maxVotosPorListas;
        partiesByList = jsonData.data.partiesByList;
        precandidatos = jsonData.data.precandidatosByList;
        lists = Object.keys(votosPorListas).sort((a, b) => parseInt(a) - parseInt(b));
      } else {
        // Fallback to legacy CSV format
        console.log(`JSON not found at ${jsonPath}, trying CSV fallback`);
        const csvPath = isODN.value ? region.odnCsvPath : region.oddCsvPath;

        if (!csvPath) {
          throw new Error(`No data available for ${region.name} - ${electionToUse}`);
        }

        const csvResponse = await fetch(csvPath);

        if (!csvResponse.ok) {
          throw new Error(`Failed to fetch data: ${csvPath}`);
        }

        const csvText = await csvResponse.text();
        const processed = processCSV(csvText);

        votosPorListas = processed.votosPorListas;
        maxVotosPorListas = processed.maxVotosPorListas;
        lists = processed.lists;
        partiesByList = processed.partiesByList;
        precandidatos = processed.precandidatosByList;
      }

      // Load GeoJSON - use series map for internas elections, regular map for nacionales
      let geojsonPath = region.mapJsonPath || region.geojsonPath;

      // For internas elections, use series_map.json which has electoral series boundaries
      if (electionToUse.includes('internas') && region.slug) {
        const seriesMapPath = `/data/geographic/${region.slug}_series_map.json`;
        geojsonPath = seriesMapPath;
        console.log('[Electoral Store] Using series map for internas election:', seriesMapPath);
      } else {
        console.log('[Electoral Store] Using regular map for election:', geojsonPath);
      }

      console.log('[Electoral Store] Attempting to fetch GeoJSON:', geojsonPath)
      const geojsonResponse = await fetch(geojsonPath);
      console.log('[Electoral Store] GeoJSON fetch response status:', geojsonResponse.status)
      if (!geojsonResponse.ok) {
        throw new Error('Failed to fetch GeoJSON data');
      }
      const geojsonData = await geojsonResponse.json();
      console.log('[Electoral Store] GeoJSON loaded, features count:', geojsonData.features?.length)

      // Load series-to-locality mapping if available
      let seriesLocalityMapping: Record<string, string> = {};
      if (region.slug) {
        try {
          const mappingPath = `/data/mappings/${region.slug}-series-locality.json`;
          const mappingResponse = await fetch(mappingPath);
          if (mappingResponse.ok) {
            seriesLocalityMapping = await mappingResponse.json();
          }
        } catch (err) {
          console.warn(`Series locality mapping not available for ${region.slug}:`, err);
        }
      }

      // Load series-to-barrio mapping if available (for Rivera)
      let seriesBarrioMapping: Record<string, string[]> = {};
      if (region.slug === 'rivera') {
        try {
          const barrioMappingPath = `/data/mappings/${region.slug}-series-barrio.json`;
          const barrioMappingResponse = await fetch(barrioMappingPath);
          if (barrioMappingResponse.ok) {
            seriesBarrioMapping = await barrioMappingResponse.json();
          }
        } catch (err) {
          console.warn(`Series barrio mapping not available for ${region.slug}:`, err);
        }
      }

      availableLists.value = lists;
      currentRegion.value = {
        ...region,
        votosPorListas,
        maxVotosPorListas,
        partiesByList,
        precandidatosByList: precandidatos,
        geojsonData,
        seriesLocalityMapping,
        seriesBarrioMapping,
      };
      console.log('[Electoral Store] currentRegion updated successfully')
      console.log('[Electoral Store] Available lists count:', lists.length)
      console.log('[Electoral Store] GeoJSON features in currentRegion:', currentRegion.value.geojsonData?.features?.length)

      // Debug: Show sample of electoral data structure
      const sampleLists = Object.keys(votosPorListas).slice(0, 3);
      console.log('[Electoral Store] Sample electoral data (first 3 lists):');
      sampleLists.forEach(list => {
        const zones = Object.keys(votosPorListas[list]).slice(0, 5);
        console.log(`  List ${list}:`, zones.map(z => `${z}=${votosPorListas[list][z]}`).join(', '));
      });

      // Debug: Show sample of GeoJSON zone identifiers
      const sampleFeatures = currentRegion.value.geojsonData?.features?.slice(0, 3) || [];
      console.log('[Electoral Store] Sample GeoJSON zone identifiers:');
      sampleFeatures.forEach((f: any, i: number) => {
        console.log(`  Feature ${i}: serie=${f.properties?.serie}, BARRIO=${f.properties?.BARRIO}, zona=${f.properties?.zona}`);
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Electoral Store] Error fetching region data:', err);
      console.error('[Electoral Store] Error details:', err);
    } finally {
      isLoading.value = false;
      console.log('[Electoral Store] fetchRegionData completed, isLoading:', isLoading.value)
    }
  }

  async function switchElection(electionId: string) {
    console.log('[Electoral Store] switchElection called:', electionId);

    currentElection.value = electionId;
    selectedLists.value = [];
    selectedCandidates.value = [];
    selectedParty.value = '';

    // Check if current region has this election
    const hasElection = currentRegion.value?.availableElections?.includes(electionId);

    if (!hasElection) {
      console.warn(`[Electoral Store] Current region "${currentRegion.value?.name}" doesn't have data for ${electionId}`);

      // Find first region that has this election
      const firstAvailableRegion = regions.value.find(r =>
        r.availableElections?.includes(electionId)
      );

      if (firstAvailableRegion) {
        console.log(`[Electoral Store] Switching to first available region: ${firstAvailableRegion.name}`);
        currentRegion.value = firstAvailableRegion;
        await fetchRegionData(firstAvailableRegion, electionId);
      } else {
        console.error(`[Electoral Store] No regions available for election: ${electionId}`);
        error.value = `No hay departamentos con datos para ${electionId}`;
      }
    } else {
      // Current region has this election, just reload data
      console.log(`[Electoral Store] Current region has ${electionId}, reloading data`);
      await fetchRegionData(currentRegion.value!, electionId);
    }
  }

  function setCurrentRegion(region: Region, forceReload = false) {
    console.log('[Electoral Store] setCurrentRegion called with:', region.name)
    console.log('[Electoral Store] Current region:', currentRegion.value?.name)
    console.log('[Electoral Store] Force reload:', forceReload)

    // Always allow switching if the slug is different, even if names appear similar
    const isDifferentRegion = !currentRegion.value ||
                               currentRegion.value.slug !== region.slug ||
                               currentRegion.value.name !== region.name;

    if (isDifferentRegion || forceReload) {
      console.log('[Electoral Store] ✅ Changing region from', currentRegion.value?.name, 'to', region.name)
      console.log('[Electoral Store] New mapCenter:', region.mapCenter)
      console.log('[Electoral Store] New mapZoom:', region.mapZoom)

      // Clear previous state
      selectedLists.value = [];
      selectedCandidates.value = [];
      selectedParty.value = '';
      selectedNeighborhood.value = null;

      // Directly update to new region (don't set to null, that dismounts the map!)
      currentRegion.value = region;

      // Fetch new data
      fetchRegionData(region);

      console.log('[Electoral Store] Region changed, data loading...')
    } else {
      console.log('[Electoral Store] ⚠️ Region already selected, skipping')
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

  /**
   * Get votes for a specific zone from a votes object, supporting combined series
   * @param votes Object mapping zone names to vote counts
   * @param zoneName Zone name (may be combined like "sia-sib-sic")
   * @returns Total votes for the zone
   */
  function getVotesForZone(votes: Record<string, number>, zoneName: string): number {
    // Handle undefined or null zoneName
    if (!zoneName || typeof zoneName !== 'string') {
      return 0;
    }

    // Try direct match first
    if (votes[zoneName] !== undefined) {
      return votes[zoneName];
    }

    // Try combined series (e.g., "sia-sib-sic" → sum of "sia", "sib", "sic")
    // Split by hyphens, spaces, or underscores
    const parts = zoneName.split(/[-\s_]+/).filter(p => p && p.length > 0);

    if (parts.length > 1) {
      // This is a combined series, sum all parts
      return parts.reduce((sum, part) => {
        return sum + (votes[part] ?? 0);
      }, 0);
    }

    // No match found
    return 0;
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
                return sum + getVotesForZone(votes, neighborhood);
              }
              return sum;
            },
            0
          )
        );
      }, 0);
    }

    // If no lists selected, sum ALL lists for this neighborhood
    if (selectedLists.value.length === 0) {
      return Object.values(currentRegion.value.votosPorListas).reduce((acc, votes) => {
        return acc + getVotesForZone(votes, neighborhood);
      }, 0);
    }

    // Sum only selected lists
    return selectedLists.value.reduce((acc, sheetNumber) => {
      const votes = currentRegion.value!.votosPorListas?.[sheetNumber];
      return acc + (votes ? getVotesForZone(votes, neighborhood) : 0);
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

    // Multi-election state
    availableElections,
    currentElection,
    electionsMeta,
    electionsFromCatalog,

    // Getters
    availableRegions,
    isInternasElection,
    currentPartiesByList,
    precandidatosByList,
    uniqueSortedCandidates,
    candidatesByParty,

    // Actions
    loadRegionsConfig,
    loadElectionsMeta,
    loadElectionsCatalog,
    fetchRegionData,
    switchElection,
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

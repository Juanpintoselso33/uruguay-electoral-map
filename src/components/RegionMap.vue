<template>
  <div class="montevideo-map-wrapper">
    <div class="montevideo-map" ref="mapContainer"></div>
    <Spinner :isLoading="isLoading" />
    <MapLegend
      v-if="showLegend"
      :legendGrades="calculateLegendGrades()"
      :getColor="(grade) => getColor(grade * getMaxVotes(), getMaxVotes())"
      :maxVotes="getMaxVotes()"
    />
    <NeighborhoodInfo
      :selectedNeighborhood="selectedNeighborhood"
      :getVotosForNeighborhood="getVotosForNeighborhood"
    />
  </div>
  <MobileToggle
    @toggle="toggleMobileVisibility"
    :isMobileHidden="isMobileHidden"
  />
  <SelectedListsInfo
    :isMobileHidden="isMobileHidden"
    :selectedCandidates="props.selectedCandidates"
    :groupedSelectedItems="groupedSelectedItems"
    :getTotalVotes="getTotalVotes"
    :sortBy="'votes'"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapLegend from "./mapComponents/MapLegend.vue";
import NeighborhoodInfo from "./mapComponents/NeighborhoodInfo.vue";
import MobileToggle from "./mapComponents/MobileToggle.vue";
import SelectedListsInfo from "./mapComponents/SelectedListsInfo.vue";
import Spinner from "./mapComponents/Spinner.vue";
import { useMapStore } from "../stores/mapStore";
import { storeToRefs } from "pinia";
import { getNormalizedNeighborhood } from "../utils/mapUtils";
import { useTooltip } from "../composables/useToolTip";
import { useVoteCalculations } from "../composables/useVoteCalculations";
import { useVoteGrouping } from "../composables/useVoteGrouping";
import { useColorScale } from "../composables/useColorScale";
import { useMapInitialization } from "../composables/useMapInitialization";
import { useMapUpdates } from "../composables/useMapUpdates";

interface Props {
  regionName: string;
  selectedLists: string[];
  votosPorListas: Record<string, Record<string, number>>;
  maxVotosPorListas: Record<string, number>;
  getVotosForNeighborhood: (neighborhood: string) => number;
  geojsonData: any;
  selectedNeighborhood: string | null;
  isODN: boolean;
  partiesAbbrev: Record<string, string>;
  partiesByList: Record<string, string>;
  precandidatosByList: Record<string, string>;
  selectedCandidates: string[];
  currentRegion: string;
  getCandidateVotesForNeighborhood: (
    neighborhood: string
  ) => { candidate: string; votes: number; party: string }[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "updateSelectedNeighborhood", neighborhood: string | null): void;
  (e: "mapInitialized"): void;
}>();

const mapStore = useMapStore();
const { map, showLegend, isMobileHidden, selectedNeighborhood } =
  storeToRefs(mapStore);

const mapContainer = ref<HTMLElement | null>(null);
const { handleFeatureMouseover, handleFeatureMouseout } = useTooltip();
const {
  getVotesForNeighborhood,
  getCandidateVotesForNeighborhood,
  getCandidateTotalVotes,
  getTotalVotes,
  getCandidateTotalVotesForAllNeighborhoods,
  getTotalVotesForList,
  getVotesForCandidateInNeighborhood,
} = useVoteCalculations(props, props.currentRegion);

const { groupCandidatesByParty, groupListsByParty, groupedSelectedItems } =
  useVoteGrouping(props, {
    getTotalVotesForList,
    getCandidateTotalVotesForAllNeighborhoods,
  });

const { getColor } = useColorScale();
const { initializeMap, fitMapToBounds } = useMapInitialization();

const getMaxVotes = () => {
  if (!props.geojsonData || !props.geojsonData.features) {
    return 0;
  }
  return props.selectedCandidates.length > 0
    ? Math.max(
        ...props.geojsonData.features.map((feature: any) =>
          getCandidateTotalVotes(getNormalizedNeighborhood(feature))
        )
      )
    : Math.max(
        ...props.geojsonData.features.map((feature: any) =>
          getVotesForNeighborhood(getNormalizedNeighborhood(feature))
        )
      );
};

const calculateLegendGrades = () => {
  const maxVotes = getMaxVotes();
  return [0, 0.2, 0.4, 0.6, 0.8, 1].map((grade) =>
    Math.round(grade * maxVotes)
  );
};

const { updateMap } = useMapUpdates(
  props,
  map.value,
  getMaxVotes,
  {
    getVotesForNeighborhood,
    getCandidateVotesForNeighborhood,
    getCandidateTotalVotes,
    getTotalVotes,
    getCandidateTotalVotesForAllNeighborhoods,
    getTotalVotesForList,
    getVotesForCandidateInNeighborhood,
  },
  { groupCandidatesByParty, groupListsByParty, groupedSelectedItems }
);

const isLoading = ref(true);

const initializeLocalMap = () => {
  if (mapContainer.value && !map.value) {
    isLoading.value = true;
    map.value = initializeMap(mapContainer.value, props.geojsonData);
    updateLocalMap();

    setTimeout(() => {
      map.value?.invalidateSize();
      isLoading.value = false;
      emit("mapInitialized");
    }, 500);
  }
};

const updateLocalMap = () => {
  if (map.value) {
    updateMap(map.value);
    map.value.invalidateSize();
  }
};

const toggleMobileVisibility = () => {
  mapStore.toggleMobileVisibility();
};

watch(
  [() => props.regionName, () => props.geojsonData],
  ([newRegionName, newGeojsonData]) => {
    if (newRegionName && mapContainer.value && newGeojsonData) {
      isLoading.value = true;
      if (map.value) {
        map.value.remove();
        map.value = null;
      }
      initializeLocalMap();
      setTimeout(() => {
        isLoading.value = false;
      }, 500);
    }
  },
  { deep: true }
);

watch(
  [() => props.selectedLists, () => props.selectedCandidates],
  () => {
    console.log(
      "DEBUG: Selected Lists or Candidates changed:",
      props.selectedLists,
      props.selectedCandidates
    );
    updateLocalMap();
  },
  { deep: true }
);

onMounted(() => {
  initializeLocalMap();
  window.addEventListener("resize", () => {
    if (map.value) {
      map.value.invalidateSize();
    }
  });
});

onUnmounted(() => {
  map.value?.remove();
});
</script>

<style scoped>
.montevideo-map-wrapper {
  width: 100%;
  height: 100vh;
  position: relative;
}

.montevideo-map {
  width: 100%;
  height: 100%;
}

.selected-lists-info {
  position: absolute;
  top: 40px;
  right: 20px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  max-width: 300px;
  max-height: 1200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.selected-lists-content {
  max-height: calc(70vh - 30px);
  overflow-y: auto;
}

.selected-lists-title {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2em;
  color: #333;
}

.party-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.party-item {
  margin-bottom: 10px;
}

.party-name {
  display: block;
  margin-bottom: 5px;
  color: #444;
  font-weight: bold;
}

.list-items,
.candidate-items {
  padding-left: 15px;
  margin: 0;
}

.list-item,
.candidate-item {
  margin-bottom: 3px;
  font-size: 0.9em;
  color: #666;
}

.total-votes {
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
  font-size: 1.1em;
  color: #333;
}

@media (max-width: 767px) {
  .selected-lists-info {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: 100%;
    border-radius: 8px 8px 0 0;
    transform: translateY(50%);
    transition: transform 0.3s ease-in-out;
    max-height: 70vh;
  }

  .selected-lists-content {
    max-height: calc(70vh - 40px);
    overflow-y: auto;
    padding-bottom: 20px;
    -webkit-overflow-scrolling: touch;
  }

  .selected-lists-info.mobile-hidden {
    transform: translateY(300%);
  }

  .mobile-toggle {
    display: block;
    height: 40px;
    display: flex;
    font-size: 1.2rem;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: white;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
    z-index: 1001;
  }

  .mobile-toggle-text {
    font-size: 1.2rem;
    color: #333;
  }
}

.leaflet-interactive {
  outline: none !important;
  cursor: pointer;
}

.leaflet-pane path {
  outline: none !important;
  outline-offset: 0 !important;
}

.leaflet-container {
  outline: none !important;
}

.leaflet-interactive:focus {
  outline: none !important;
}

.leaflet-interactive:active {
  outline: none !important;
}

.map-legend {
  position: absolute;
  background: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  font-size: 12px;
  max-width: 200px;
}

@media (min-width: 768px) {
  .map-legend {
    bottom: 20px;
    right: 20px;
  }
}

@media (max-width: 767px) {
  .map-legend {
    top: 60px;
    right: 10px;
    max-width: 150px;
  }
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.legend-color {
  width: 20px;
  height: 20px;
  margin-right: 5px;
}

.legend-label {
  font-size: 12px;
}

.legend {
  line-height: 18px;
  color: #555;
  background: white;
  padding: 6px 8px;
  border-radius: 5px;
}

.legend i {
  width: 18px;
  height: 18px;
  float: left;
  margin-right: 8px;
  opacity: 0.7;
}

.fixed-tooltip {
  pointer-events: none;
}

.no-pointer-events {
  pointer-events: none;
}

.leaflet-interactive:hover {
  stroke-width: 1px !important;
}

.leaflet-pane path.leaflet-interactive:hover {
  stroke-width: 1px !important;
  stroke: inherit !important;
}

.spinner {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  z-index: 1000;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

:global(.custom-tooltip) {
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 5px;
  font-size: 12px;
  pointer-events: none;
}
</style>

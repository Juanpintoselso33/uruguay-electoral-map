<template>
  <div class="montevideo-map-wrapper">
    <div class="montevideo-map" ref="mapContainer"></div>
    <MapLegend
      v-if="showLegend"
      :legendGrades="legendGrades"
      :getColor="getColor"
      :maxVotes="getMaxVotes"
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
  />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import chroma from "chroma-js";
import { GeoJSON } from "geojson";
import MapLegend from "./mapComponents/MapLegend.vue";
import NeighborhoodInfo from "./mapComponents/NeighborhoodInfo.vue";
import MobileToggle from "./mapComponents/MobileToggle.vue";
import SelectedListsInfo from "./mapComponents/SelectedListsInfo.vue";
import { useMapStore } from "../stores/mapStore";
import { storeToRefs } from "pinia";
import {
  styleFeature,
  getNormalizedNeighborhood,
  createOnEachFeature,
  getTotalVotesForList,
  getCandidateTotalVotesAllNeighborhoods,
} from "../utils/mapUtils";
import { createTooltipContent } from "../utils/tooltipUtils";
import { useTooltip } from "../composables/useToolTip";
import { useVoteCalculations } from "../composables/useVoteCalculations";
import { useVoteGrouping } from "../composables/useVoteGrouping"; // Import the composable

// Define props using an interface
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
  mapCenter: [number, number];
  mapZoom: number;
  currentRegion: string;
  getCandidateVotesForNeighborhood: (neighborhood: string) => number; // Add this line
}

const props = defineProps<Props>();

// Define emits
const emit = defineEmits<{
  (e: "updateSelectedNeighborhood", neighborhood: string | null): void;
  (e: "mapInitialized"): void;
}>();

const mapStore = useMapStore();
const { initializeMap, updateMap, fitMapToBounds } = mapStore;
const { map, showLegend, isMobileHidden, selectedNeighborhood } =
  storeToRefs(mapStore);

const mapContainer = ref<HTMLElement | null>(null);
const { handleFeatureMouseover, handleFeatureMouseout } = useTooltip();
const {
  getCandidateVotesForNeighborhood,
  getCandidateTotalVotes,
  getTotalVotes,
} = useVoteCalculations(props, props.currentRegion);

const { groupCandidatesByParty, groupListsByParty } = useVoteGrouping(props); // Call useVoteGrouping and get the necessary functions

const groupedSelectedItems = computed(() => {
  console.log("Selected Candidates:", props.selectedCandidates);
  if (props.selectedCandidates.length > 0) {
    const grouped = props.selectedCandidates.reduce((acc, candidate) => {
      const party = props.partiesByList[candidate];
      if (!acc[party]) acc[party] = { candidates: [], lists: [] };
      acc[party].candidates.push({
        name: candidate,
        votes: getCandidateVotesForNeighborhood(candidate),
      });
      return acc;
    }, {} as Record<string, { candidates: any[]; lists: any[] }>);

    // Debugging grouped items
    console.log("Grouped Selected Items:", grouped);
    console.log("Selected Candidates:", props.selectedCandidates);
    console.log("Grouped Selected Items:", grouped);
    return grouped;
  } else {
    const grouped = props.selectedLists.reduce((acc, list) => {
      const party = props.partiesByList[list];
      if (!acc[party]) acc[party] = { candidates: [], lists: [] };
      acc[party].lists.push({
        name: list,
        votes: getTotalVotesForList(props.votosPorListas, list),
      });
      return acc;
    }, {} as Record<string, { candidates: any[]; lists: any[] }>);
    return grouped;
  }
});

const legendGrades = [0, 0.2, 0.4, 0.6, 0.8, 1];

const getMaxVotes = computed(() => {
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
          props.getVotosForNeighborhood(getNormalizedNeighborhood(feature))
        )
      );
});

const getColor = (votes: number): string => {
  if (votes === 0 || getMaxVotes.value === 0) {
    return "#FFFFFF";
  }
  const ratio = votes / getMaxVotes.value;
  const colorScale = (chroma as any)
    .scale(["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"])
    .mode("lab")
    .domain([0, 1]);
  return colorScale(ratio).hex();
};

const initializeLocalMap = () => {
  console.log("Initializing map...");
  if (mapContainer.value && !map.value) {
    console.log("mapContainer and map check passed");
    initializeMap(mapContainer.value, props.mapCenter, props.mapZoom);
    updateLocalMap();
    fitMapToBounds(props.geojsonData);

    setTimeout(() => {
      map.value?.invalidateSize();
      emit("mapInitialized");
    }, 100);
  }
};

const updateLocalMap = () => {
  if (!props.geojsonData) {
    console.warn("GeoJSON data is undefined");
    return;
  }

  mapStore.updateMap(
    props.geojsonData,
    (feature) => styleFeature(feature, props.getVotosForNeighborhood, getColor),
    createOnEachFeature(
      (e, feature, layer) => {
        if (!feature || !e.latlng) {
          console.warn("Invalid feature or latlng:", feature, e.latlng);
          return;
        }
        handleFeatureMouseover(e, feature, layer, map.value!, (feature) => {
          const neighborhood = getNormalizedNeighborhood(feature);
          const votes = props.getVotosForNeighborhood(neighborhood);
          return createTooltipContent(
            neighborhood,
            votes,
            props.selectedCandidates,
            props.partiesAbbrev,
            getCandidateVotesForNeighborhood,
            groupCandidatesByParty, // Pass the function here
            groupListsByParty // Pass the function here
          );
        });
      },
      (e, feature, layer) => {
        if (!feature) {
          console.warn("Invalid feature object");
          return;
        }
        handleFeatureMouseout();
      },
      (feature) => {
        if (!feature) {
          console.warn("Invalid feature object");
          return;
        }
        mapStore.setSelectedNeighborhood(getNormalizedNeighborhood(feature));
      },
      props.getVotosForNeighborhood,
      getColor,
      map.value!
    )
  );
};

const toggleMobileVisibility = () => {
  mapStore.toggleMobileVisibility();
};

// Watchers
// Watch for changes in region name and geojsonData
watch(
  [() => props.regionName, () => props.geojsonData],
  ([newRegionName, newGeojsonData]) => {
    if (newRegionName && mapContainer.value && newGeojsonData) {
      updateLocalMap();
    }
  },
  { deep: true }
);

// Watch for changes in selected lists and candidates
watch(
  [() => props.selectedLists, () => props.selectedCandidates],
  () => {
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

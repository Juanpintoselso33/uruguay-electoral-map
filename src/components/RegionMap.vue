<template>
  <v-card class="montevideo-map-wrapper">
    <div class="montevideo-map" ref="mapContainer"></div>
    <Spinner :isLoading="props.isLoading" />
    <MapLegend
      v-if="showLegend"
      :legendGrades="[0, 0.2, 0.4, 0.6, 0.8, 1]"
      :getColor="mapStore.getColor"
      :maxVotes="mapStore.getMaxVotes"
    />
  </v-card>
  <MobileToggle
    :isMobileHidden="isMobileHidden"
    @toggle="toggleMobileVisibility"
  />
  <SelectedListsInfo
    :groupedSelectedItems="voteOperations.groupedSelectedItems"
    v-model:isMobileHidden="isMobileHidden"
    :selectedCandidates="selectedCandidates"
    :selectedLists="selectedLists"
    :getTotalVotes="voteOperations.getTotalVotes"
    :sortBy="'votes'"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import MapLegend from "./mapComponents/MapLegend.vue";
import MobileToggle from "./mapComponents/MobileToggle.vue";
import SelectedListsInfo from "./mapComponents/SelectedListsInfo.vue";
import Spinner from "./mapComponents/Spinner.vue";
import { useMapStore } from "../stores/mapStore";
import { storeToRefs } from "pinia";
import { useColorScale } from "../composables/useColorScale";
import { useMapWatchers } from "../composables/useMapWatchers";
import "leaflet/dist/leaflet.css";
import { VCard, VProgressCircular, VBtn } from "vuetify/components";

interface Props {
  regionName: string;
  selectedLists: string[];
  votosPorListas: Record<string, Record<string, number>>;
  maxVotosPorListas: Record<string, number>;
  geojsonData: any;
  selectedNeighborhood: string | null;
  isODN: boolean;
  partiesAbbrev: Record<string, string>;
  partiesByList: Record<string, string>;
  precandidatosByList: Record<string, string>;
  selectedCandidates: string[];
  currentRegion: string;
  isLoading: boolean;
  voteOperations: ReturnType<
    typeof import("../composables/useVoteOperations").useVoteOperations
  >;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "updateSelectedNeighborhood", neighborhood: string | null): void;
  (e: "mapInitialized"): void;
  (e: "initializeMap"): void;
}>();

const mapStore = useMapStore();
const { showLegend, selectedNeighborhood, isLoading } = storeToRefs(mapStore);

const mapContainer = ref<HTMLElement | null>(null);

const isMobileHidden = ref(true);

const toggleMobileVisibility = () => {
  isMobileHidden.value = !isMobileHidden.value;
};

onMounted(() => {
  console.log("HOVER_DEBUG: RegionMap component mounted");
  if (props.geojsonData && mapContainer.value) {
    mapStore.initializeMap(mapContainer.value, props.geojsonData);
    emit("mapInitialized");
  }
  window.addEventListener("resize", () => mapStore.updateMap());
});

onUnmounted(() => {
  if (mapStore.map) {
    mapStore.map.remove();
  }
  window.removeEventListener("resize", () => mapStore.updateMap());
});

useMapWatchers(props, mapContainer);

watch(
  () => props.geojsonData,
  (newData) => {
    if (newData && mapContainer.value) {
      mapStore.initializeMap(mapContainer.value, newData);
    }
  }
);
</script>

<style lang="scss" scoped>
@import "@/styles/variables";

.montevideo-map-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.montevideo-map {
  width: 100%;
  height: 100%;
}

.leaflet-interactive {
  outline: none !important;
  cursor: pointer;

  &:focus,
  &:active {
    outline: none !important;
  }

  &:hover {
    stroke-width: 1px !important;
  }
}

.leaflet-pane path {
  outline: none !important;
  outline-offset: 0 !important;

  &.leaflet-interactive:hover {
    stroke-width: 1px !important;
    stroke: inherit !important;
  }
}

.leaflet-container {
  outline: none !important;
  .leaflet-control-attribution {
    display: none !important; // Ocultar el control de atribución
  }
}

.map-legend {
  position: absolute;
  background: $background-color;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  font-size: 12px;
  max-width: 200px;

  @media (min-width: $mobile-breakpoint) {
    bottom: 20px;
    right: 20px;
  }

  @media (max-width: ($mobile-breakpoint - 1)) {
    bottom: 60px; // Mover la leyenda a la parte inferior
    left: 20px; // Mover la leyenda a la izquierda
    right: auto; // Asegurarse de que no esté alineada a la derecha
    top: auto; // Asegurarse de que no esté alineada en la parte superior
    max-width: 150px;
    max-height: 100px; // Limitar la altura máxima
    overflow-y: auto; // Permitir el desplazamiento vertical si es necesario
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
  color: $text-color;
  background: $background-color;
  padding: 6px 8px;
  border-radius: 5px;

  i {
    width: 18px;
    height: 18px;
    float: left;
    margin-right: 8px;
    opacity: 0.7;
  }
}

.fixed-tooltip,
.no-pointer-events {
  pointer-events: none;
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
  background-color: rgba($background-color, 0.9);
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 5px;
  font-size: 12px;
  pointer-events: none;
}

@media (min-width: $mobile-breakpoint) {
  .mobile-toggle {
    display: none;
  }
}

.leaflet-control-attribution .leaflet-control {
  display: none !important;
}
</style>

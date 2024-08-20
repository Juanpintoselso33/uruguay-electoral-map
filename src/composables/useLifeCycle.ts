import { onMounted, onUnmounted } from "vue";
import { useMapStore } from "../stores/mapStore";

export function useMapLifecycle(mapContainer, geojsonData, emit) {
  const mapStore = useMapStore();

  onMounted(() => {
    mapStore.initializeMap(mapContainer.value, geojsonData, emit); // Added emit as the third argument
    window.addEventListener("resize", () =>
      mapStore.updateMap(geojsonData, {
        selectedCandidates: [],
        getCandidateTotalVotes: () => 0,
      })
    );
    emit("mapInitialized");
  });

  onUnmounted(() => {
    mapStore.map?.remove(); // Call without arguments
    window.removeEventListener("resize", () =>
      mapStore.updateMap(geojsonData, {
        selectedCandidates: [],
        getCandidateTotalVotes: () => 0,
      })
    );
  });
}

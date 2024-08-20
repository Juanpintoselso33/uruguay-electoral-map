import { watch, onMounted } from "vue";
import { useMapStore } from "../stores/mapStore";

export function useMapWatchers(props, mapContainer) {
  const mapStore = useMapStore();

  onMounted(() => {
    if (mapContainer.value && props.geojsonData) {
      mapStore.initializeMap(mapContainer.value, props.geojsonData); // Removed props
    }
  });

  watch(
    [
      () => props.selectedLists,
      () => props.selectedCandidates,
      () => props.geojsonData,
    ],
    () => {
      if (mapStore.map) {
        // console.log("Updating map with new data"); // Optional: Uncomment if needed
        mapStore.updateMap(); // Adjusted to call without arguments
      }
    }
  );
}

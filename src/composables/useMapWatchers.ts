import { watch, onMounted } from "vue";
import { useMapStore } from "../stores/mapStore";

export function useMapWatchers(props, mapContainer) {
  const mapStore = useMapStore();

  onMounted(() => {
    if (mapContainer.value && props.geojsonData) {
      mapStore.initializeMap(mapContainer.value, props.geojsonData, props);
    }
  });

  watch(
    [
      () => props.selectedLists,
      () => props.selectedCandidates,
      () => props.geojsonData,
    ],
    ([newSelectedLists, newSelectedCandidates, newGeojsonData]) => {
      if (mapStore.map) {
        console.log("Updating map with new data");
        mapStore.updateMap(newGeojsonData, {
          selectedLists: newSelectedLists,
          selectedCandidates: newSelectedCandidates,
          ...props,
        });
      }
    }
  );
}

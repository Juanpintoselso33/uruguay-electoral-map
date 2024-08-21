import { watch } from "vue";
import { useMapStore } from "../stores/mapStore";

export function useMapWatchers(props, mapContainer) {
  const mapStore = useMapStore();

  watch(
    () => props.selectedLists,
    () => {
      mapStore.updateMapData();
    },
    { deep: true }
  );

  watch(
    () => props.selectedCandidates,
    () => {
      mapStore.updateMapData();
    },
    { deep: true }
  );

  watch(
    () => props.geojsonData,
    (newData) => {
      if (newData && mapContainer.value) {
        mapStore.initializeMap(mapContainer.value, newData);
      }
    }
  );
}

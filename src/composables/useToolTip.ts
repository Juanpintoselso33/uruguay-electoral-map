import { ref } from "vue";
import L from "leaflet";

export function useTooltip() {
  const tooltip = ref<L.Tooltip | null>(null);

  const createTooltip = (map: L.Map, latlng: L.LatLng, content: string) => {
    if (!latlng) {
      console.error("LatLng is undefined when creating tooltip");
      return;
    }
    tooltip.value = L.tooltip() // Store the tooltip in the ref
      .setLatLng(latlng)
      .setContent(content)
      .addTo(map);
  };

  const handleFeatureMouseover = (
    e: L.LeafletMouseEvent,
    feature: GeoJSON.Feature,
    layer: L.Layer,
    map: L.Map,
    getTooltipContent: (feature: GeoJSON.Feature) => string
  ) => {
    createTooltip(map, e.latlng, getTooltipContent(feature));
  };

  const handleFeatureMouseout = () => {
    if (tooltip.value) {
      tooltip.value.remove();
      tooltip.value = null; // Clear the tooltip reference
    }
  };

  return {
    handleFeatureMouseover,
    handleFeatureMouseout,
  };
}

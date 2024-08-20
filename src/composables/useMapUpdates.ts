import L from "leaflet";
import { getNormalizedNeighborhood, styleFeature } from "../utils/mapUtils";
import { createTooltipContent } from "../utils/tooltipUtils";
import { useRegionStore } from "../stores/regionStore";

export function useMapUpdates(props, voteCalculations, voteGrouping, getColor) {
  const { groupedSelectedItems } = voteGrouping;

  const updateMap = (currentMap: L.Map) => {
    const regionStore = useRegionStore();
    if (!props.geojsonData) {
      console.warn("GeoJSON data is undefined");
      return;
    }

    const maxVotes = regionStore.getMaxVotes(
      props.geojsonData,
      props.selectedCandidates,
      voteCalculations.getVotesForNeighborhood,
      voteCalculations.getCandidateTotalVotes
    );

    console.log("Max votes for map update:", maxVotes);
    console.log("Selected lists:", props.selectedLists);
    console.log("Selected candidates:", props.selectedCandidates);
    console.log(
      "votosPorListas:",
      JSON.stringify(props.votosPorListas, null, 2)
    );

    // Remove existing layers
    currentMap.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) {
        currentMap.removeLayer(layer);
      }
    });

    // Store current view state
    const currentCenter = currentMap.getCenter();
    const currentZoom = currentMap.getZoom();

    let activeTooltip: L.Tooltip | null = null;

    const safeCloseTooltip = () => {
      if (activeTooltip && currentMap) {
        try {
          currentMap.closeTooltip(activeTooltip);
        } catch (error) {
          console.error("Error closing tooltip:", error);
        }
        activeTooltip = null;
      }
    };

    // Add new GeoJSON layer
    const geoJsonLayer = L.geoJSON(props.geojsonData, {
      style: (feature) => {
        if (!feature) return {}; // Return a default style if feature is undefined
        const neighborhood = getNormalizedNeighborhood(feature);
        console.log(`Styling feature for neighborhood: ${neighborhood}`);
        const votes = voteCalculations.getVotesForNeighborhood(neighborhood);
        console.log(`Votes for ${neighborhood} in map update:`, votes);
        console.log(
          "Vote calculation function:",
          voteCalculations.getVotesForNeighborhood.toString()
        );
        const color = getColor(votes, maxVotes);
        console.log(`Color for ${neighborhood}: ${color}`);
        return styleFeature(
          feature,
          voteCalculations.getVotesForNeighborhood,
          (votes) => getColor(votes, maxVotes)
        );
      },
      onEachFeature: (feature, layer) => {
        const neighborhood = getNormalizedNeighborhood(feature);
        const votes = voteCalculations.getVotesForNeighborhood(neighborhood);
        console.log(`Tooltip votes for ${neighborhood}:`, votes);
        const tooltipContent = createTooltipContent(
          neighborhood,
          votes,
          props.selectedCandidates,
          props.partiesAbbrev,
          groupedSelectedItems.value,
          voteCalculations,
          props.sortBy
        );

        const showTooltip = (e: L.LeafletEvent) => {
          const event = e as L.LeafletMouseEvent; // Cast to L.LeafletMouseEvent
          if (event.target && "setStyle" in event.target) {
            event.target.setStyle({ fillOpacity: 0.9 });
          }
          safeCloseTooltip();
          if (currentMap) {
            activeTooltip = L.tooltip({
              sticky: true,
              direction: "top",
              offset: L.point(0, -20),
              className: "custom-tooltip",
            })
              .setContent(tooltipContent)
              .setLatLng(event.latlng); // Use the casted event
            activeTooltip.addTo(currentMap);
          }
        };

        const hideTooltip = (e: L.LeafletEvent) => {
          if (e.target && "setStyle" in e.target) {
            e.target.setStyle({ fillOpacity: 0.7 });
          }
          safeCloseTooltip();
        };

        layer.on({
          mouseover: showTooltip,
          mouseout: hideTooltip,
          click: showTooltip, // This will make tap behave like hover on mobile
        });
      },
    }).addTo(currentMap);

    // Only fit bounds if it's the initial load
    if (!currentMap.getBounds().isValid()) {
      currentMap.fitBounds(geoJsonLayer.getBounds());
    } else {
      // Restore previous view state
      currentMap.setView(currentCenter, currentZoom, { animate: false });
    }

    currentMap.invalidateSize();

    // Clean up tooltips on zoom start
    currentMap.on("zoomstart", safeCloseTooltip);
    currentMap.on("movestart", safeCloseTooltip);
  };

  return {
    updateMap,
  };
}

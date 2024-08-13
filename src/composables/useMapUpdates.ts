import L from "leaflet";
import { useColorScale } from "./useColorScale";
import {
  getNormalizedNeighborhood,
  styleFeature,
  createOnEachFeature,
} from "../utils/mapUtils";
import { createTooltipContent } from "../utils/tooltipUtils";
import { useVoteGrouping } from "./useVoteGrouping";
import { GroupedCandidates, GroupedLists } from "../types/VoteTypes";
import { parseFullPartyName } from "../utils/stringUtils";

export function useMapUpdates(
  props,
  map: L.Map | null,
  getMaxVotes: () => number,
  voteCalculations,
  voteGrouping
) {
  const { getColor } = useColorScale();
  const { groupedSelectedItems } = voteGrouping;

  const updateMap = (currentMap: L.Map) => {
    if (!props.geojsonData) {
      console.warn("GeoJSON data is undefined");
      return;
    }

    const maxVotes = getMaxVotes();

    // Remove existing layers
    currentMap.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) {
        currentMap.removeLayer(layer);
      }
    });

    // Check if the map is initialized
    if (!currentMap) {
      console.warn("Map is not initialized.");
      return;
    }

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
        const votes = voteCalculations.getVotesForNeighborhood(neighborhood);
        return styleFeature(
          feature,
          voteCalculations.getVotesForNeighborhood,
          (votes) => getColor(votes, maxVotes)
        );
      },
      onEachFeature: (feature, layer) => {
        const neighborhood = getNormalizedNeighborhood(feature);
        const votes = voteCalculations.getVotesForNeighborhood(neighborhood);
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
          if (e.target && "setStyle" in e.target) {
            e.target.setStyle({ fillOpacity: 0.9 });
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
              .setLatLng(e.latlng);
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

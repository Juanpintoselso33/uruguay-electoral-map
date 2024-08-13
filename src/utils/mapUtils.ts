import L from "leaflet";
import chroma from "chroma-js";
import { GeoJSON, GeoJsonProperties } from "geojson";
import { normalizeString } from "./stringUtils";
import { useVoteCalculations } from "../composables/useVoteCalculations";

export const styleFeature = (
  feature: GeoJSON.Feature<GeoJSON.Geometry, GeoJsonProperties> | undefined,
  getVotesForNeighborhood: (neighborhood: string) => number,
  getColor: (votes: number) => string
): L.PathOptions => {
  if (!feature || !feature.properties) {
    console.log("Feature or properties are  undefined:", feature);
    return {};
  }

  const neighborhood = getNormalizedNeighborhood(feature);
  console.log("Normalized Neighborhood:", neighborhood);

  const votes = getVotesForNeighborhood(neighborhood);
  console.log("Votes for Neighborhood:", votes);

  const fillColor = getColor(votes);
  console.log("Fill Color based on Votes:", fillColor);

  return {
    color: "#000000",
    weight: 1,
    fillColor,
    fillOpacity: 0.7,
    opacity: 1,
  };
};

export const getNormalizedNeighborhood = (feature: GeoJSON.Feature): string => {
  if (!feature || !feature.properties) {
    return "";
  }
  return normalizeString(
    feature.properties.BARRIO ||
      feature.properties.texto ||
      feature.properties.zona ||
      ""
  );
};

export const getTooltipContent = (
  feature: GeoJSON.Feature,
  getVotesForNeighborhood: (neighborhood: string) => number
): string => {
  const neighborhood = getNormalizedNeighborhood(feature);
  const votes = getVotesForNeighborhood(neighborhood);
  return `<strong>${neighborhood}</strong><br>Votes: ${votes}`;
};

export const createOnEachFeature = (
  handleFeatureMouseover: (
    e: L.LeafletMouseEvent,
    feature: GeoJSON.Feature,
    layer: L.Layer,
    map: L.Map,
    getTooltipContent: (feature: GeoJSON.Feature) => string
  ) => void,
  handleFeatureMouseout: (
    e: L.LeafletMouseEvent,
    feature: GeoJSON.Feature,
    layer: L.Layer
  ) => void,
  handleFeatureClick: (feature: GeoJSON.Feature) => void,
  getVotesForNeighborhood: (neighborhood: string) => number,
  getColor: (votes: number) => string,
  map: L.Map
) => {
  return (feature: GeoJSON.Feature, layer: L.Layer) => {
    const neighborhood = getNormalizedNeighborhood(feature);
    const votes = getVotesForNeighborhood(neighborhood);
    const originalColor = getColor(votes);
    const hoverColor = chroma(originalColor).darken(0.3).hex();

    layer.on({
      mouseover: (e) => {
        if (e.latlng) {
          handleFeatureMouseover(e, feature, layer, map, (f) =>
            getTooltipContent(f, getVotesForNeighborhood)
          );
        }
      },
      mouseout: (e) => {
        handleFeatureMouseout(e, feature, layer);
      },
      click: (e) => handleFeatureClick(feature),
    });
  };
};

export const getCandidateTotalVotesAllNeighborhoods = (
  votosPorListas: Record<string, Record<string, number>>,
  selectedCandidates: Record<number, string>,
  precandidatosByList: Record<string, string>
): number => {
  const { getCandidateTotalVotesForAllNeighborhoods } = useVoteCalculations(
    { votosPorListas, precandidatosByList },
    null
  );
  return Object.values(selectedCandidates).reduce((total, candidate) => {
    return total + getCandidateTotalVotesForAllNeighborhoods(candidate);
  }, 0);
};

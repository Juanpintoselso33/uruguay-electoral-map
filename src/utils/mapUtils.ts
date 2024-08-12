import L from "leaflet";
import chroma from "chroma-js";
import { GeoJSON, GeoJsonProperties } from "geojson";
import { normalizeString } from "./stringUtils";

export const styleFeature = (
  feature: GeoJSON.Feature<GeoJSON.Geometry, GeoJsonProperties> | undefined,
  getVotesForNeighborhood: (neighborhood: string) => number,
  getColor: (votes: number) => string
): L.PathOptions => {
  if (!feature || !feature.properties) return {};
  const neighborhood = getNormalizedNeighborhood(feature);
  const votes = getVotesForNeighborhood(neighborhood);
  const fillColor = getColor(votes);
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
  getVotesForNeighborhood2: (neighborhood: string) => number,
  getColor: (votes: number) => string,
  map: L.Map // Add map parameter here
) => {
  return (feature: GeoJSON.Feature, layer: L.Layer) => {
    const neighborhood = getNormalizedNeighborhood(feature);
    const votes = getVotesForNeighborhood2(neighborhood);
    const originalColor = getColor(votes);
    const hoverColor = chroma(originalColor).darken(0.3).hex();

    layer.on({
      mouseover: (e) => {
        if (e.latlng) {
          handleFeatureMouseover(e, feature, layer, map, (feature) => {
            const neighborhood = getNormalizedNeighborhood(feature);
            const votes = getVotesForNeighborhood2(neighborhood);
            return `<strong>${neighborhood}</strong><br>Votes: ${votes}`;
          });
        }
      },
      mouseout: (e) => {
        handleFeatureMouseout(e, feature, layer);
      },
      click: (e) => handleFeatureClick(feature),
    });
  };
};

export const getTotalVotesForList = (
  votosPorListas: Record<string, Record<string, number>>,
  list: string
) => {
  return Object.values(votosPorListas[list] || {}).reduce((a, b) => a + b, 0);
};

export const getCandidateTotalVotesAllNeighborhoods = (
  geojsonData: any,
  getCandidateVotesForNeighborhood: (
    neighborhood: string
  ) => { candidate: string; votes: number }[],
  candidate: string
): number => {
  return Object.values(geojsonData.features).reduce(
    (total: number, feature: any) => {
      const neighborhood = getNormalizedNeighborhood(feature);
      const candidateVotes = getCandidateVotesForNeighborhood(neighborhood);
      const candidateVote = candidateVotes.find(
        (c) => c.candidate === candidate
      );
      return total + (candidateVote?.votes || 0);
    },
    0
  );
};

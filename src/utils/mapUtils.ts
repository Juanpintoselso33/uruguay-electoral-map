import L from "leaflet";
import chroma from "chroma-js";
import { GeoJSON, GeoJsonProperties } from "geojson";
import { normalizeString } from "./stringUtils";
import { useVoteOperations } from "../composables/useVoteOperations";
import { createTooltipContent } from "./tooltipUtils";

export const styleFeature = (
  feature: GeoJSON.Feature<GeoJSON.Geometry, GeoJsonProperties> | undefined,
  getVotesForNeighborhood: (neighborhood: string) => number,
  getColor: (votes: number) => string
): L.PathOptions => {
  if (!feature || !feature.properties) {
    return {};
  }

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

export const getTooltipContent = (
  feature: GeoJSON.Feature,
  getVotesForNeighborhood: (neighborhood: string) => number,
  selectedLists: string[],
  selectedCandidates: string[],
  partiesAbbrev: Record<string, string>,
  groupedSelectedItems: any,
  voteOperations: any
): string => {
  console.log("HOVER_DEBUG: getTooltipContent called");
  const neighborhood = getNormalizedNeighborhood(feature);
  const votes = getVotesForNeighborhood(neighborhood);
  console.log(`HOVER_DEBUG: Neighborhood: ${neighborhood}, Votes: ${votes}`);
  return createTooltipContent(
    neighborhood,
    votes,
    selectedCandidates,
    selectedLists,
    partiesAbbrev,
    groupedSelectedItems,
    voteOperations,
    "votes"
  );
};

export const createOnEachFeature = (
  handleFeatureMouseover: (
    e: L.LeafletMouseEvent,
    feature: GeoJSON.Feature,
    layer: L.Layer,
    map: L.Map,
    getTooltipContent: (
      feature: GeoJSON.Feature,
      getVotesForNeighborhood: (neighborhood: string) => number,
      selectedLists: string[],
      selectedCandidates: string[],
      partiesAbbrev: Record<string, string>,
      groupedSelectedItems: any,
      voteOperations: any
    ) => string,
    getVotesForNeighborhood: (neighborhood: string) => number,
    selectedLists: string[],
    selectedCandidates: string[],
    partiesAbbrev: Record<string, string>,
    groupedSelectedItems: any,
    voteOperations: any
  ) => void,
  handleFeatureMouseout: (
    e: L.LeafletMouseEvent,
    feature: GeoJSON.Feature,
    layer: L.Layer
  ) => void,
  handleFeatureClick: (feature: GeoJSON.Feature) => void,
  getVotesForNeighborhood: (neighborhood: string) => number,
  getColor: (votes: number) => string,
  map: L.Map,
  selectedLists: string[],
  selectedCandidates: string[],
  partiesAbbrev: Record<string, string>,
  groupedSelectedItems: any,
  voteOperations: any
) => {
  console.log("HOVER_DEBUG: createOnEachFeature called", {
    handleFeatureMouseoverPresent: !!handleFeatureMouseover,
    handleFeatureMouseoutPresent: !!handleFeatureMouseout,
    handleFeatureClickPresent: !!handleFeatureClick,
    getVotesForNeighborhoodPresent: !!getVotesForNeighborhood,
    getColorPresent: !!getColor,
    mapPresent: !!map,
    selectedListsPresent: !!selectedLists,
    selectedCandidatesPresent: !!selectedCandidates,
    partiesAbbrevPresent: !!partiesAbbrev,
    groupedSelectedItemsPresent: !!groupedSelectedItems,
  });
  return (feature: GeoJSON.Feature, layer: L.Layer) => {
    const neighborhood = getNormalizedNeighborhood(feature);
    const votes = getVotesForNeighborhood(neighborhood);
    const originalColor = getColor(votes);
    const hoverColor = chroma(originalColor).darken(0.3).hex();

    layer.on({
      mouseover: (e) => {
        if (e.latlng) {
          handleFeatureMouseover(
            e,
            feature,
            layer,
            map,
            getTooltipContent,
            getVotesForNeighborhood,
            selectedLists,
            selectedCandidates,
            partiesAbbrev,
            groupedSelectedItems,
            voteOperations
          );
          console.log("HOVER_DEBUG: mouseover event", e);
        }
        console.log("HOVER_DEBUG: mouseover event", e);
      },
      mouseout: (e) => {
        handleFeatureMouseout(e, feature, layer);
        console.log("HOVER_DEBUG: mouseout event", e);
      },
      click: (e) => {
        handleFeatureClick(feature);
        console.log("HOVER_DEBUG: click event", e);
      },
    });
  };
};

export const getCandidateTotalVotesAllNeighborhoods = (
  votosPorListas: Record<string, Record<string, number>>,
  selectedCandidates: Record<number, string>,
  precandidatosByList: Record<string, string>
): number => {
  const voteOperations = useVoteOperations({
    votosPorListas,
    precandidatosByList,
  });
  return Object.values(selectedCandidates).reduce((total, candidate) => {
    return total + voteOperations.getCandidateTotalVotes(candidate);
  }, 0);
};

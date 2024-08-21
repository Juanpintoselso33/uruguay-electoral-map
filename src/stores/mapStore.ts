import { defineStore } from "pinia";
import L from "leaflet";
import chroma from "chroma-js";
import { styleFeature, getNormalizedNeighborhood } from "../utils/mapUtils";
import { useVoteOperations } from "../composables/useVoteOperations";
import { useRegionStore } from "../stores/regionStore";
import { createTooltipContent } from "../utils/tooltipUtils";
import { useColorScale } from "../composables/useColorScale";

export const useMapStore = defineStore("map", {
  state: () => ({
    map: null as L.Map | null,
    currentTooltip: null as L.Tooltip | null,
    selectedNeighborhood: null as string | null,
    showLegend: true,
    isMobileHidden: false,
    isLoading: false,
    selectedCandidates: [] as string[],
    selectedLists: [] as string[],
    votosPorListas: {} as Record<string, Record<string, number>>,
    precandidatosByList: {} as Record<string, string>,
    partiesByList: {} as Record<string, string>,
    geojsonData: null as any,
    sortBy: "votes" as "votes" | "alphabetical",
    voteOperations: null as ReturnType<typeof useVoteOperations> | null,
  }),

  getters: {
    computedVoteOperations: (state) => {
      const currentRegion = useRegionStore().currentRegion;
      return useVoteOperations({
        votosPorListas: currentRegion.votosPorListas || {},
        precandidatosByList: currentRegion.precandidatosByList || {},
        selectedLists: state.selectedLists,
        selectedCandidates: state.selectedCandidates,
        partiesByList: state.partiesByList,
      });
    },

    groupedSelectedItems: (state) => {
      return state.voteOperations?.groupedSelectedItems || {};
    },

    getMaxVotes() {
      if (!this.geojsonData || !this.geojsonData.features) return 0;
      return Math.max(
        ...this.geojsonData.features.map((feature) => {
          const neighborhood = getNormalizedNeighborhood(feature);
          if (this.selectedCandidates.length > 0) {
            return this.selectedCandidates.reduce((total, candidate) => {
              return (
                total +
                this.computedVoteOperations.getVotesForCandidateInNeighborhood(
                  candidate,
                  neighborhood
                )
              );
            }, 0);
          } else {
            return this.selectedLists.reduce((total, list) => {
              return (
                total +
                this.computedVoteOperations.getVotesForNeighborhood(
                  neighborhood,
                  list
                )
              );
            }, 0);
          }
        })
      );
    },
  },

  actions: {
    async initializeMap(container: HTMLElement, geojsonData: any) {
      this.isLoading = true;
      if (this.map) {
        this.map.remove();
      }
      this.map = L.map(container).setView([0, 0], 2);
      this.geojsonData = geojsonData;
      await this.updateMap();
      this.isLoading = false;
      return this.map;
    },

    async updateMap() {
      this.isLoading = true;
      if (!this.map || !this.geojsonData) {
        console.log("No map or geojsonData");
        this.isLoading = false;
        return;
      }

      this.map.eachLayer((layer) => {
        if (layer instanceof L.GeoJSON) {
          this.map.removeLayer(layer);
        }
      });

      const maxVotes = this.getMaxVotes;
      return new Promise<void>((resolve) => {
        L.geoJSON(this.geojsonData, {
          style: (feature) => {
            if (!feature) return {};
            const neighborhood = getNormalizedNeighborhood(feature);
            let votes;
            if (this.selectedCandidates.length > 0) {
              votes = this.selectedCandidates.reduce((total, candidate) => {
                return (
                  total +
                  this.computedVoteOperations.getVotesForCandidateInNeighborhood(
                    candidate,
                    neighborhood
                  )
                );
              }, 0);
            } else {
              votes = this.selectedLists.reduce((total, list) => {
                return (
                  total +
                  this.computedVoteOperations.getVotesForNeighborhood(
                    neighborhood,
                    list
                  )
                );
              }, 0);
            }
            const color = this.getColor(votes, maxVotes);
            return {
              fillColor: color,
              weight: 2,
              opacity: 1,
              color: "black",
              fillOpacity: 0.7,
            };
          },
          onEachFeature: (feature, layer) => {
            layer.on({
              mouseover: (e) => {
                const neighborhood = getNormalizedNeighborhood(feature);
                const votes =
                  this.computedVoteOperations.getVotesForNeighborhood(
                    neighborhood
                  );
                this.handleFeatureMouseover(e, votes);
              },
              mouseout: this.handleFeatureMouseout,
              click: (e) => this.handleFeatureClick(e),
            });
          },
        }).addTo(this.map);

        this.fitMapToBounds();
        this.isLoading = false;
        resolve();
      });
    },

    fitMapToBounds() {
      if (this.map && this.geojsonData) {
        const geojsonLayer = L.geoJSON(this.geojsonData);
        const bounds = geojsonLayer.getBounds();
        this.map.fitBounds(bounds);
      }
    },

    handleFeatureMouseover(e: L.LeafletMouseEvent, votes: number) {
      const layer = e.target;
      const neighborhood = getNormalizedNeighborhood(layer.feature);
      const regionStore = useRegionStore();

      const tooltipContent = createTooltipContent(
        neighborhood,
        votes,
        regionStore.selectedCandidates,
        regionStore.selectedLists,
        regionStore.currentRegion.partiesAbbrev || {},
        regionStore.groupedSelectedItems,
        this.computedVoteOperations,
        this.sortBy
      );

      if (this.map) {
        this.currentTooltip = L.tooltip({
          permanent: false,
          direction: "top",
          className: "custom-tooltip",
        })
          .setLatLng(e.latlng)
          .setContent(tooltipContent)
          .openOn(this.map);
      }
    },

    handleFeatureMouseout() {
      if (this.map && this.currentTooltip) {
        this.map.closeTooltip(this.currentTooltip);
        this.currentTooltip = null;
      }
    },

    handleFeatureClick(e: L.LeafletMouseEvent) {
      const layer = e.target;
      const neighborhood = getNormalizedNeighborhood(layer.feature);
      this.setSelectedNeighborhood(neighborhood);
    },

    getColor(votes: number, maxVotes: number): string {
      const { getColor: colorScaleGetColor } = useColorScale();
      const percentage = maxVotes > 0 ? votes / maxVotes : 0;
      return colorScaleGetColor(percentage, 1);
    },

    setSelectedNeighborhood(neighborhood: string | null) {
      this.selectedNeighborhood = neighborhood;
    },

    toggleMobileVisibility() {
      this.isMobileHidden = !this.isMobileHidden;
    },

    updateMapData() {
      const regionStore = useRegionStore();
      this.selectedCandidates = regionStore.selectedCandidates;
      this.selectedLists = regionStore.selectedLists;
      this.votosPorListas = regionStore.currentRegion.votosPorListas || {};
      this.precandidatosByList =
        regionStore.currentRegion.precandidatosByList || {};
      this.partiesAbbrev = regionStore.currentRegion.partiesAbbrev || {};
      this.partiesByList = regionStore.currentRegion.partiesByList || {};

      // Force a recomputation of computedVoteOperations
      this.voteOperations = useVoteOperations({
        votosPorListas: this.votosPorListas,
        precandidatosByList: this.precandidatosByList,
        selectedLists: this.selectedLists,
        selectedCandidates: this.selectedCandidates,
        partiesByList: this.partiesByList,
      });

      // Update the map
      this.updateMap();
    },
  },
});

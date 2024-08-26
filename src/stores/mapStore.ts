import { defineStore } from "pinia";
import L from "leaflet";
import chroma from "chroma-js";
import * as turf from "@turf/turf";
import { styleFeature, getNormalizedNeighborhood } from "../utils/mapUtils";
import { useVoteOperations } from "../composables/useVoteOperations";
import { useRegionStore } from "../stores/regionStore";
import { createTooltipContent } from "../utils/tooltipUtils";
import { useColorScale } from "../composables/useColorScale";
import { shallowRef } from "vue";

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
    geojsonData: shallowRef(null) as any,
    sortBy: "votes" as "votes" | "alphabetical",
    voteOperations: null as ReturnType<typeof useVoteOperations> | null,
    activeTooltip: null as L.Tooltip | null,
    cachedMaxVotes: 0,
    cachedStyles: new Map<string, L.PathOptions>(),
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
      if (this.cachedMaxVotes > 0) return this.cachedMaxVotes;
      if (!this.geojsonData || !this.geojsonData.features) return 0;

      this.cachedMaxVotes = Math.max(
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

      return this.cachedMaxVotes;
    },
  },

  actions: {
    async initializeMap(container: HTMLElement, geojsonData: any) {
      this.isLoading = true;
      if (this.map) {
        this.map.remove();
      }
      this.map = L.map(container, {
        zoomControl: false,
        attributionControl: false, // Desactivar el control de atribución
      }).setView([0, 0], 2);
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
      const simplifiedGeojsonData = turf.simplify(this.geojsonData, {
        tolerance: 0.0004,
        highQuality: true,
      });

      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          L.geoJSON(simplifiedGeojsonData, {
            style: (feature) => {
              if (!feature) return {};
              const neighborhood = getNormalizedNeighborhood(feature);
              const cacheKey = `${neighborhood}-${this.selectedCandidates.join(
                ","
              )}-${this.selectedLists.join(",")}`;

              if (this.cachedStyles.has(cacheKey)) {
                return this.cachedStyles.get(cacheKey)!;
              }

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
              const style = {
                fillColor: color,
                weight: 2,
                opacity: 1,
                color: "black",
                fillOpacity: 0.7,
              };
              this.cachedStyles.set(cacheKey, style);
              return style;
            },
            onEachFeature: (feature, layer) => {
              const neighborhood = getNormalizedNeighborhood(feature);
              const votes =
                this.computedVoteOperations.getVotesForNeighborhood(
                  neighborhood
                );
              const tooltipContent = createTooltipContent(
                neighborhood,
                votes,
                this.selectedCandidates,
                this.selectedLists,
                this.partiesByList,
                this.groupedSelectedItems,
                this.computedVoteOperations,
                this.sortBy
              );

              const showTooltip = (e: L.LeafletEvent) => {
                const event = e as L.LeafletMouseEvent;
                if (event.target && "setStyle" in event.target) {
                  event.target.setStyle({ fillOpacity: 0.9 });
                }
                this.safeCloseTooltip();
                if (this.map) {
                  this.activeTooltip = L.tooltip({
                    sticky: true,
                    direction: "top",
                    offset: L.point(0, -20),
                    className: "custom-tooltip",
                  })
                    .setContent(tooltipContent)
                    .setLatLng(event.latlng);
                  this.activeTooltip.addTo(this.map);
                }
              };

              const hideTooltip = (e: L.LeafletEvent) => {
                if (e.target && "setStyle" in e.target) {
                  e.target.setStyle({ fillOpacity: 0.7 });
                }
                this.safeCloseTooltip();
              };

              const isTouchDevice = () => {
                return "ontouchstart" in window || navigator.maxTouchPoints > 0;
              };

              if (isTouchDevice()) {
                layer.on({
                  click: (e: L.LeafletMouseEvent) => {
                    showTooltip(e);
                    this.handleFeatureClick(e);
                  },
                });
              } else {
                layer.on({
                  mouseover: showTooltip,
                  mouseout: hideTooltip,
                  click: (e: L.LeafletMouseEvent) => {
                    this.handleFeatureClick(e);
                  },
                });
              }
            },
          }).addTo(this.map!);

          this.fitMapToBounds();
          this.isLoading = false;
          resolve();
        });
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

      // Clear the cache before updating the map
      this.clearCache();

      // Update the map
      this.updateMap();
    },

    safeCloseTooltip() {
      if (this.activeTooltip && this.map) {
        this.map.closeTooltip(this.activeTooltip);
        this.activeTooltip = null;
      }
    },

    clearCache() {
      this.cachedMaxVotes = 0;
      this.cachedStyles.clear();
    },
  },
});

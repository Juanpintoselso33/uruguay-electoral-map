import L from "leaflet";

export function useMapInitialization() {
  const initializeMap = (
    container: HTMLElement & { _leaflet?: any; _leaflet_id?: any },
    geojsonData: any
  ) => {
    if (container._leaflet_id) {
      console.warn(
        "Map container is already initialized. Removing existing map."
      );
      container._leaflet = null;
      container.innerHTML = "";
    }

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: true,
      fadeAnimation: true,
    });

    if (
      geojsonData &&
      geojsonData.features &&
      geojsonData.features.length > 0
    ) {
      const geoJsonLayer = L.geoJSON(geojsonData);
      const bounds = geoJsonLayer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 13,
          animate: true,
          duration: 1,
        });

        // Add the GeoJSON layer to the map
        geoJsonLayer.addTo(map);
      } else {
        console.warn("Invalid bounds for the GeoJSON data.");
        map.setView([0, 0], 2, { animate: true, duration: 1 });
      }
    } else {
      console.warn("No valid GeoJSON data provided.");
      map.setView([0, 0], 2, { animate: true, duration: 1 });
    }

    return map;
  };

  const fitMapToBounds = (map: L.Map, geojsonData: any) => {
    if (
      map &&
      geojsonData &&
      geojsonData.features &&
      geojsonData.features.length > 0
    ) {
      const bounds = L.geoJSON(geojsonData).getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [50, 50], // Add some padding
          maxZoom: 13, // Limit max zoom
          animate: true,
          duration: 1,
        });

        // Optionally, you can set a minimum zoom level
        if (map.getZoom() > 13) {
          map.setZoom(13);
        }
      } else {
        console.warn("Invalid bounds for the GeoJSON data in fitMapToBounds.");
      }
    }
  };

  return {
    initializeMap,
    fitMapToBounds,
  };
}

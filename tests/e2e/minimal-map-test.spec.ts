import { test } from '@playwright/test';

test('minimal MapLibre test', async ({ page }) => {
  // Simple HTML with MapLibre
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <link href="https://unpkg.com/maplibre-gl@4.0.0/dist/maplibre-gl.css" rel="stylesheet" />
      <script src="https://unpkg.com/maplibre-gl@4.0.0/dist/maplibre-gl.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 800px; height: 600px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = new maplibregl.Map({
          container: 'map',
          style: {
            version: 8,
            sources: {
              'test-source': {
                type: 'geojson',
                data: {
                  type: 'FeatureCollection',
                  features: [{
                    type: 'Feature',
                    geometry: {
                      type: 'Polygon',
                      coordinates: [[
                        [-56.3, -34.8],
                        [-56.2, -34.8],
                        [-56.2, -34.9],
                        [-56.3, -34.9],
                        [-56.3, -34.8]
                      ]]
                    },
                    properties: {
                      color: '#ff0000',
                      name: 'Test'
                    }
                  }]
                }
              }
            },
            layers: [
              {
                id: 'test-fill',
                type: 'fill',
                source: 'test-source',
                paint: {
                  'fill-color': ['get', 'color'],
                  'fill-opacity': 0.7
                }
              }
            ]
          },
          center: [-56.25, -34.85],
          zoom: 10
        });

        map.on('load', () => {
          console.log('Map loaded');
          const features = map.querySourceFeatures('test-source');
          console.log('Features count:', features.length);
          console.log('Sample feature:', features[0]);
        });
      </script>
    </body>
    </html>
  `);

  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.waitForTimeout(3000);

  const state = await page.evaluate(() => {
    const map = (window as any).map || document.querySelector('#map')?._map;
    if (!map) return { error: 'No map' };

    const features = map.querySourceFeatures('test-source');
    return {
      loaded: map.loaded(),
      featuresCount: features.length,
      feature: features[0]
    };
  });

  console.log('State:', JSON.stringify(state, null, 2));

  await page.screenshot({ path: 'minimal-map-test.png' });
  console.log('Screenshot saved');
});

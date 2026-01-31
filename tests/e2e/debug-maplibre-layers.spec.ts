import { test } from '@playwright/test';

test('debug MapLibre layers rendering', async ({ page }) => {
  // Capture console
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}]`, msg.text());
    }
  });

  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);

  // Click Montevideo
  await page.locator('text=Montevideo').first().click();
  await page.waitForTimeout(8000);

  // Inspect MapLibre internal state
  const mapState = await page.evaluate(() => {
    const mapContainer = document.querySelector('.maplibre-container');
    if (!mapContainer) return { error: 'No maplibre-container found' };

    // Try to access the map instance
    const canvas = document.querySelector('canvas.maplibregl-canvas');
    if (!canvas) return { error: 'No MapLibre canvas found' };

    // Access map through the canvas's parent
    const mapElement = canvas.closest('.maplibregl-map');
    if (!mapElement) return { error: 'No map element found' };

    // Try to get map instance from global or data attribute
    const mapInstance = (window as any).debugMap || (mapElement as any)._map;

    if (!mapInstance) {
      return {
        error: 'Cannot access map instance',
        hasCanvas: true,
        canvasSize: { width: canvas.width, height: canvas.height }
      };
    }

    // Get map style and layers
    const style = mapInstance.getStyle();
    const layers = style?.layers || [];
    const sources = Object.keys(style?.sources || {});

    // Get specific info about electoral layers
    const electoralSource = mapInstance.getSource('electoral-data');
    const electoralLayer = mapInstance.getLayer('electoral-fill');

    // Try to get features from the source
    const sourceCache = (mapInstance as any).style?.sourceCaches?.['electoral-data'];
    const tileCache = sourceCache?._tiles;
    const tiles = tileCache ? Object.keys(tileCache) : [];

    // Try querySourceFeatures
    let features: any[] = [];
    try {
      features = mapInstance.querySourceFeatures('electoral-data');
    } catch (e) {
      // Ignore
    }

    return {
      isLoaded: mapInstance.loaded(),
      center: mapInstance.getCenter(),
      zoom: mapInstance.getZoom(),
      sourcesCount: sources.length,
      sources: sources,
      layersCount: layers.length,
      layers: layers.map((l: any) => ({ id: l.id, type: l.type, source: l.source })),
      hasElectoralSource: !!electoralSource,
      hasElectoralLayer: !!electoralLayer,
      electoralLayerVisible: (electoralLayer as any)?.visibility !== 'none',
      electoralLayerLayout: (electoralLayer as any)?.layout,
      tilesCount: tiles.length,
      queriedFeaturesCount: features.length,
      sampleFeature: features[0] ? {
        properties: features[0].properties,
        geometry: features[0].geometry?.type
      } : null,
      bounds: mapInstance.getBounds().toArray(),
      paintSpec: style?.layers?.find((l: any) => l.id === 'electoral-fill')?.paint
    };
  });

  console.log('\n=== MapLibre State ===');
  console.log(JSON.stringify(mapState, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'debug-maplibre-state.png', fullPage: true });
  console.log('\nScreenshot saved to debug-maplibre-state.png');
});

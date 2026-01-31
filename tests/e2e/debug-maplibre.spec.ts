import { test } from '@playwright/test';

test('debug - check MapLibre initialization', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
    } else if (msg.type() === 'warning') {
      warnings.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}\n${error.stack}`);
  });

  // Navigate to the app
  await page.goto('http://localhost:5173');

  // Wait for the app to load
  await page.waitForTimeout(5000);

  // Check if MapLibre canvas exists
  const canvas = await page.locator('canvas.maplibregl-canvas').first();
  const canvasCount = await page.locator('canvas').count();
  const maplibreCanvasCount = await page.locator('canvas.maplibregl-canvas').count();

  console.log('\n=== CANVAS INFO ===');
  console.log(`Total canvas elements: ${canvasCount}`);
  console.log(`MapLibre canvas elements: ${maplibreCanvasCount}`);

  if (maplibreCanvasCount > 0) {
    const bbox = await canvas.boundingBox();
    console.log(`Canvas bounding box:`, bbox);

    const isVisible = await canvas.isVisible();
    console.log(`Canvas visible: ${isVisible}`);
  }

  // Check for maplibre-gl container
  const mapContainer = await page.locator('.maplibregl-map').first();
  const mapContainerExists = await mapContainer.count() > 0;
  console.log(`MapLibre container exists: ${mapContainerExists}`);

  if (mapContainerExists) {
    const mapClass = await mapContainer.getAttribute('class');
    console.log(`Map container classes: ${mapClass}`);
  }

  // Check store state
  const storeData = await page.evaluate(() => {
    return {
      hasGeoJSON: !!(window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__,
    };
  });

  console.log('\n=== STORE DATA ===');
  console.log(storeData);

  // Print errors
  console.log('\n=== ERRORS ===');
  if (errors.length === 0) {
    console.log('No errors');
  } else {
    errors.forEach(err => console.log(err));
  }

  console.log('\n=== WARNINGS ===');
  if (warnings.length === 0) {
    console.log('No warnings');
  } else {
    warnings.forEach(warn => console.log(warn));
  }

  // Take screenshot
  await page.screenshot({
    path: 'debug-maplibre-state.png',
    fullPage: true
  });
});

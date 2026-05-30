import { test } from '@playwright/test';

test('debug - Montevideo with electoral series', async ({ page }) => {
  // Capture console logs with type
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error') {
      console.log('CONSOLE ERROR:', msg.text(), msg.args());
    } else {
      console.log('BROWSER:', msg.text());
    }
  });

  // Capture errors
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message, err.stack));
  page.on('crash', () => console.log('PAGE CRASHED'));

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);

  // Click on Montevideo in department selector
  const montevideoButton = page.locator('text=Montevideo').first();
  await montevideoButton.click();

  // Wait for map to load and render colors
  await page.waitForTimeout(8000);

  // Check for MapLibre canvas
  const canvas = await page.locator('canvas.maplibregl-canvas').first();
  const canvasExists = await canvas.count() > 0;

  console.log('Canvas exists:', canvasExists);

  if (canvasExists) {
    const bbox = await canvas.boundingBox();
    console.log('Canvas bbox:', bbox);
  }

  // Check if votes are being calculated
  const votesInfo = await page.evaluate(() => {
    const store = (window as any).__pinia;
    if (!store) return { error: 'No Pinia store found' };

    // Try to access electoral store
    const storeEntries = Object.entries(store.state.value || {});
    const electoralStore = storeEntries.find(([key]) => key.includes('electoral'));

    if (!electoralStore) return { error: 'No electoral store found' };

    const state = electoralStore[1] as any;
    return {
      hasVotosPorListas: !!state.currentRegion?.votosPorListas,
      listsCount: Object.keys(state.currentRegion?.votosPorListas || {}).length,
      sampleZones: state.currentRegion?.zoneList?.slice(0, 5),
      selectedListsCount: state.selectedLists?.length || 0
    };
  });

  console.log('Votes info:', votesInfo);

  // Take screenshot
  await page.screenshot({
    path: 'debug-montevideo-series.png',
    fullPage: true
  });

  console.log('Screenshot saved to debug-montevideo-series.png');
});

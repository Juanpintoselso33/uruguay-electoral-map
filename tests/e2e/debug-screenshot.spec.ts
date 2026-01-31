import { test, expect } from '@playwright/test';

test('debug - take screenshot of current app state', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5173');

  // Wait for the app to load
  await page.waitForTimeout(3000);

  // Take a full page screenshot
  await page.screenshot({
    path: 'debug-app-state.png',
    fullPage: true
  });

  // Check console for errors
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });

  // Wait a bit more to catch any async errors
  await page.waitForTimeout(2000);

  // Take another screenshot after waiting
  await page.screenshot({
    path: 'debug-app-state-after-wait.png',
    fullPage: true
  });

  // Check if map container exists
  const mapContainer = await page.locator('.maplibregl-map, .map-area, [class*="map"]').first();
  const isVisible = await mapContainer.isVisible().catch(() => false);

  console.log('Map container visible:', isVisible);

  // Check for canvas element
  const canvas = await page.locator('canvas').first();
  const canvasExists = await canvas.count() > 0;

  console.log('Canvas exists:', canvasExists);

  if (canvasExists) {
    const canvasVisible = await canvas.isVisible().catch(() => false);
    console.log('Canvas visible:', canvasVisible);
  }

  // Print all console messages
  console.log('\n=== Console Messages ===');
  consoleMessages.forEach(msg => console.log(msg));
});

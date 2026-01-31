import { test, expect } from '@playwright/test';

test('Inspect map visually with pause', async ({ page }) => {
  // Go to app
  await page.goto('http://localhost:5173');

  console.log('Waiting for initial load...');
  await page.waitForTimeout(3000);

  // Click Montevideo
  console.log('Clicking Montevideo...');
  await page.locator('text=Montevideo').first().click();

  console.log('Waiting for Montevideo to load...');
  await page.waitForTimeout(5000);

  // Check canvas
  const canvas = await page.locator('canvas.maplibregl-canvas').first();
  const canvasExists = await canvas.count() > 0;
  console.log('Canvas exists:', canvasExists);

  if (canvasExists) {
    // Take screenshot
    await page.screenshot({ path: 'inspect-visual.png', fullPage: true });
    console.log('Screenshot saved');

    // Get canvas data URL to see what's actually rendered
    const canvasDataUrl = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement;
      if (!canvas) return null;
      try {
        return canvas.toDataURL('image/png');
      } catch (e) {
        return 'ERROR: ' + e.message;
      }
    });

    if (canvasDataUrl && canvasDataUrl.startsWith('data:')) {
      console.log('Canvas has image data (length:', canvasDataUrl.length, ')');

      // Save canvas as separate image
      const base64Data = canvasDataUrl.split(',')[1];
      const fs = require('fs');
      fs.writeFileSync('canvas-content.png', Buffer.from(base64Data, 'base64'));
      console.log('Canvas content saved to canvas-content.png');
    } else {
      console.log('Canvas data URL:', canvasDataUrl);
    }

    // Pause for manual inspection
    console.log('\n=== PAUSED FOR MANUAL INSPECTION ===');
    console.log('The browser window should be visible.');
    console.log('Press ENTER in terminal to continue...\n');

    await page.pause();  // This will pause and keep browser open
  }

  expect(canvasExists).toBe(true);
});

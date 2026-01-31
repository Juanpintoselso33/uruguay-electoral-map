import { test, expect } from '@playwright/test';

test('Tooltip shows on Leaflet map hover', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/'); // Use base URL from playwright config

  console.log('Step 1: Wait for app and map container to load');
  await page.waitForSelector('[data-testid="map-container"], .electoral-map-wrapper, .electoral-map', { timeout: 15000 });
  await page.waitForTimeout(2000);

  console.log('Step 2: Wait for Leaflet map to initialize');
  const leafletContainer = page.locator('.leaflet-container');
  await leafletContainer.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(2000);

  console.log('Step 3: Select a list to show data');
  const firstCheckbox = page.locator('input[type="checkbox"][value]').first();
  if (await firstCheckbox.isVisible().catch(() => false)) {
    await firstCheckbox.click();
    await page.waitForTimeout(1500);
  }

  console.log('Step 4: Wait for Leaflet map features (SVG paths)');
  const mapFeatures = page.locator('.leaflet-container svg path, .leaflet-overlay-pane path');
  await mapFeatures.first().waitFor({ state: 'attached', timeout: 10000 });

  console.log('Step 5: Hover over a map feature');
  const count = await mapFeatures.count();
  console.log(`Found ${count} map features`);

  if (count > 0) {
    const targetFeature = mapFeatures.nth(Math.min(5, count - 1));
    await targetFeature.hover({ force: true });
    await page.waitForTimeout(1500);
  } else {
    console.warn('No map features found! Map may not have loaded correctly.');
  }

  // Take screenshot with tooltip
  await page.screenshot({ path: 'tooltip-visible.png', fullPage: false });
  console.log('✓ Screenshot saved: tooltip-visible.png');

  // Check if tooltip exists
  const tooltip = page.locator('.leaflet-tooltip, .neighborhood-label');
  const tooltipVisible = await tooltip.isVisible().catch(() => false);
  console.log('✓ Tooltip visible:', tooltipVisible);

  if (tooltipVisible) {
    const tooltipText = await tooltip.textContent();
    console.log('✓ Tooltip content:', tooltipText?.substring(0, 300));

    // Check if it contains "Lista" or "Serie" keyword (for different map types)
    const hasRelevantKeyword = tooltipText?.includes('Lista') || tooltipText?.includes('Serie') || false;
    console.log('✓ Contains "Lista" or "Serie" keyword:', hasRelevantKeyword);

    // Check if first letter is capitalized (title case check)
    const firstWord = tooltipText?.trim().split(/\s+/)[0] || '';
    const isCapitalized = firstWord.length > 0 && firstWord[0] === firstWord[0].toUpperCase();
    console.log('✓ First word capitalized:', isCapitalized, '(', firstWord, ')');

    // Verify it's not just a raw 3-letter code
    const isJustCode = /^[a-z]{3}$/.test(tooltipText?.trim() || '');
    console.log('✓ Not just a 3-letter code:', !isJustCode);

    expect(isJustCode).toBe(false);
    expect(isCapitalized || tooltipText?.includes('Serie')).toBe(true);
  }

  expect(tooltipVisible).toBe(true);
});

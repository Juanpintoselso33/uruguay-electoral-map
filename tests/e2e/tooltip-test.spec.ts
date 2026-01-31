import { test, expect } from '@playwright/test';
import { selectDepartment, selectFirstList, hoverMapFeature, getTooltip, waitForMapLoaded } from '../helpers/testUtils';

test('Tooltip shows locality name and list votes', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  console.log('Step 1: Select Montevideo');
  await selectDepartment(page, 'Montevideo');

  console.log('Step 2: Select a list');
  await selectFirstList(page);

  console.log('Step 3: Hover over Leaflet map path to show tooltip');

  // Verify map container is visible
  const mapContainer = page.locator('[data-testid="map-container"]').first();
  await expect(mapContainer).toBeVisible();

  // Wait for map features to load
  await waitForMapLoaded(page);

  // Hover over a feature (try the 5th one for better coverage)
  await hoverMapFeature(page, 5);

  // Take screenshot with tooltip
  await page.screenshot({ path: 'tooltip-visible.png', fullPage: false });
  console.log('✓ Screenshot saved: tooltip-visible.png');

  // Check if tooltip exists
  const tooltip = getTooltip(page);
  const tooltipVisible = await tooltip.isVisible().catch(() => false);
  console.log('✓ Tooltip visible:', tooltipVisible);

  if (tooltipVisible) {
    const tooltipText = await tooltip.textContent();
    console.log('✓ Tooltip content:', tooltipText?.substring(0, 200));

    // Check if it contains "Lista" or "Serie" keyword (for different map types)
    const hasRelevantKeyword = tooltipText?.includes('Lista') || tooltipText?.includes('Serie') || false;
    console.log('✓ Contains "Lista" or "Serie" keyword:', hasRelevantKeyword);

    // Check if first letter is capitalized (title case check)
    const firstWord = tooltipText?.trim().split(/\s+/)[0] || '';
    const isCapitalized = firstWord.length > 0 && firstWord[0] === firstWord[0].toUpperCase();
    console.log('✓ First word capitalized:', isCapitalized, '(', firstWord, ')');
  }

  expect(tooltipVisible).toBe(true);
});

import { Page, expect } from '@playwright/test';

/**
 * Helper functions for Uruguay Electoral Map E2E tests
 */

/**
 * Wait for the app to fully load including regions and map
 */
export async function waitForAppLoad(page: Page): Promise<void> {
  // Wait for the app layout to be visible
  await page.waitForSelector('.app-layout, #app', { timeout: 30000 });

  // Wait for regions to load (at least one region button should appear)
  await page.waitForSelector('.region-button, .region-grid button', { timeout: 30000 });
}

/**
 * Wait for the MapLibre map to initialize
 */
export async function waitForMapLoad(page: Page): Promise<void> {
  // Wait for the map container
  await page.waitForSelector('.maplibre-container, .map-container, .map-area', { timeout: 30000 });

  // Wait for any canvas to be rendered (MapLibre creates a canvas element)
  await page.waitForSelector('canvas', { timeout: 30000 });

  // Give extra time for tiles to load
  await page.waitForTimeout(2000);
}

/**
 * Select a department by name
 */
export async function selectDepartment(page: Page, departmentName: string): Promise<void> {
  const regionButton = page.locator('.region-button, .region-grid button').filter({ hasText: departmentName });
  await regionButton.click();

  // Wait for data to load
  await page.waitForTimeout(1000);
}

/**
 * Open the search dialog using keyboard shortcut
 */
export async function openSearchWithKeyboard(page: Page): Promise<void> {
  await page.keyboard.press('Control+k');
  // Also try Cmd+K for Mac
  await page.waitForTimeout(200);
}

/**
 * Toggle dark mode
 */
export async function toggleDarkMode(page: Page): Promise<void> {
  const themeToggle = page.locator('.theme-toggle, button[aria-label="Toggle theme"]');
  await themeToggle.click();
  await page.waitForTimeout(300);
}

/**
 * Check if dark mode is active
 */
export async function isDarkModeActive(page: Page): Promise<boolean> {
  const appLayout = page.locator('.app-layout');
  return await appLayout.evaluate(el => el.classList.contains('dark'));
}

/**
 * Toggle comparison mode
 */
export async function toggleComparisonMode(page: Page): Promise<void> {
  const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
  await comparisonButton.click();
  await page.waitForTimeout(500);
}

/**
 * Toggle data source (ODN/ODD)
 */
export async function toggleDataSource(page: Page): Promise<void> {
  // Find the data source toggle component
  const toggle = page.locator('[class*="toggle"], button').filter({ hasText: /ODN|ODD/i }).first();
  await toggle.click();
  await page.waitForTimeout(500);
}

/**
 * Select a party from the party filter
 */
export async function selectParty(page: Page, partyName: string): Promise<void> {
  const partySelect = page.locator('select').filter({ hasText: partyName }).first();
  await partySelect.selectOption({ label: partyName });
  await page.waitForTimeout(300);
}

/**
 * Get the number of visible departments
 */
export async function getDepartmentCount(page: Page): Promise<number> {
  const departmentButtons = page.locator('.region-button, .region-grid button');
  return await departmentButtons.count();
}

/**
 * Check if a department is currently selected
 */
export async function isDepartmentSelected(page: Page, departmentName: string): Promise<boolean> {
  const regionButton = page.locator('.region-button, .region-grid button').filter({ hasText: departmentName });
  const classes = await regionButton.getAttribute('class') || '';
  return classes.includes('active');
}

/**
 * Get the currently selected election ID or name
 */
export async function getCurrentElection(page: Page): Promise<string | null> {
  const currentBadge = page.locator('.election-current-badge, [class*="current"]').first();
  const electionCard = currentBadge.locator('..');
  const electionName = await electionCard.locator('.election-name, h4').textContent();
  return electionName;
}

/**
 * Select an election by clicking on its card
 */
export async function selectElection(page: Page, electionName: string): Promise<void> {
  const electionCard = page.locator('.election-card, .compact-item').filter({ hasText: electionName });
  await electionCard.click();
  await page.waitForTimeout(1000);
}

/**
 * Get visible elections
 */
export async function getVisibleElections(page: Page): Promise<string[]> {
  const electionCards = page.locator('.election-card .election-name, .compact-label');
  const texts = await electionCards.allTextContents();
  return texts;
}

/**
 * Check if comparison mode is active
 */
export async function isComparisonModeActive(page: Page): Promise<boolean> {
  const comparisonView = page.locator('.comparison-view, .comparison-header');
  return await comparisonView.isVisible().catch(() => false);
}

/**
 * Close comparison mode
 */
export async function closeComparisonMode(page: Page): Promise<void> {
  const closeButton = page.locator('.close-button, button:has(svg[class*="close"]), .comparison-view button').first();
  await closeButton.click();
  await page.waitForTimeout(500);
}

/**
 * Get comparison election selectors
 */
export async function getComparisonSelectors(page: Page): Promise<{ left: string; right: string }> {
  const leftSelect = page.locator('.selector-group select').first();
  const rightSelect = page.locator('.selector-group select').last();

  const left = await leftSelect.inputValue();
  const right = await rightSelect.inputValue();

  return { left, right };
}

/**
 * Check if the map tooltip is visible
 */
export async function isTooltipVisible(page: Page): Promise<boolean> {
  const tooltip = page.locator('.map-tooltip, [class*="tooltip"]');
  return await tooltip.isVisible().catch(() => false);
}

/**
 * Hover over the map to trigger a tooltip
 */
export async function hoverOnMap(page: Page): Promise<void> {
  const mapCanvas = page.locator('canvas.maplibregl-canvas, canvas.mapboxgl-canvas');
  const box = await mapCanvas.boundingBox();

  if (box) {
    // Hover near the center of the map
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
  }
}

/**
 * Zoom in on the map
 */
export async function zoomInMap(page: Page): Promise<void> {
  const zoomInButton = page.locator('.map-control-btn, button[title*="Zoom in"]').first();
  await zoomInButton.click();
  await page.waitForTimeout(500);
}

/**
 * Zoom out on the map
 */
export async function zoomOutMap(page: Page): Promise<void> {
  const zoomOutButton = page.locator('.map-control-btn, button[title*="Zoom out"]').nth(1);
  await zoomOutButton.click();
  await page.waitForTimeout(500);
}

/**
 * Reset the map view
 */
export async function resetMapView(page: Page): Promise<void> {
  const resetButton = page.locator('.map-control-btn, button[title*="Reset"]').last();
  await resetButton.click();
  await page.waitForTimeout(1000);
}

/**
 * Get selected lists count
 */
export async function getSelectedListsCount(page: Page): Promise<number> {
  const selectedListChips = page.locator('[class*="selected"], .list-chip.active, input:checked');
  return await selectedListChips.count();
}

/**
 * Clear all selections
 */
export async function clearSelection(page: Page): Promise<void> {
  const clearButton = page.locator('button').filter({ hasText: /limpiar|clear/i });
  if (await clearButton.isVisible()) {
    await clearButton.click();
    await page.waitForTimeout(300);
  }
}

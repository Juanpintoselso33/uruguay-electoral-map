import { Page } from '@playwright/test';

/**
 * Helper functions for Playwright tests
 */

/**
 * Selects a department from the region selector
 */
export async function selectDepartment(page: Page, departmentName: string) {
  // Try with data-testid first, fallback to class selector
  let regionSelector = page.locator('[data-testid="region-selector"]');
  const hasTestId = await regionSelector.count() > 0;

  if (!hasTestId) {
    // Fallback to class-based selector if data-testid not available
    regionSelector = page.locator('.region-selector');
  }

  await regionSelector.waitFor({ state: 'visible', timeout: 10000 });

  // Click hamburger button to open menu
  const hamburgerButton = regionSelector.locator('.hamburger-button, button[aria-label="Open region menu"]').first();
  await hamburgerButton.waitFor({ state: 'visible', timeout: 5000 });
  await hamburgerButton.click();
  await page.waitForTimeout(500);

  // Click department in the menu
  const menuButton = regionSelector.locator(`.menu button:has-text("${departmentName}")`);
  await menuButton.waitFor({ state: 'visible', timeout: 5000 });
  await menuButton.click();
  await page.waitForTimeout(2000);
}

/**
 * Switches data source between ODD and ODN
 */
export async function switchDataSource(page: Page, toODN: boolean) {
  // Try with data-testid first, fallback to visible toggle
  let toggleContainer = page.locator('[data-testid="data-source-toggle"]');
  const hasTestId = await toggleContainer.count() > 0;

  if (!hasTestId) {
    // Fallback: find the toggle by looking for radio buttons with ODN/ODD labels
    toggleContainer = page.locator('.bg-gray-100').filter({ hasText: /ODD|ODN/ }).first();
  }

  const radioButton = toggleContainer.locator(`input[type="radio"][value="${toODN}"]`);
  await radioButton.click();
  await page.waitForTimeout(1000);
}

/**
 * Selects the first available list checkbox
 */
export async function selectFirstList(page: Page) {
  // Try with data-testid first, fallback to any checkbox
  let firstCheckbox = page.locator('[data-testid="list-selector"] input[type="checkbox"][value]').first();
  const hasTestId = await firstCheckbox.count() > 0;

  if (!hasTestId) {
    // Fallback: find any list checkbox
    firstCheckbox = page.locator('input[type="checkbox"][value]').first();
  }

  await firstCheckbox.waitFor({ state: 'visible', timeout: 5000 });
  await firstCheckbox.click();
  await page.waitForTimeout(1000);
}

/**
 * Hovers over a map feature and waits for tooltip
 */
export async function hoverMapFeature(page: Page, featureIndex: number = 3) {
  const mapFeatures = page.locator('.leaflet-container path');
  const targetFeature = mapFeatures.nth(featureIndex);
  await targetFeature.hover();
  await page.waitForTimeout(1000);
}

/**
 * Gets the tooltip element
 */
export function getTooltip(page: Page) {
  return page.locator('.leaflet-tooltip, .neighborhood-label');
}

/**
 * Waits for map to be fully loaded
 */
export async function waitForMapLoaded(page: Page) {
  const mapFeatures = page.locator('.leaflet-container path');
  await mapFeatures.first().waitFor({ state: 'visible', timeout: 10000 });
}

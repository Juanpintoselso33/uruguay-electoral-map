import { test, expect } from '@playwright/test';

test.describe('Filters and List Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Wait for map to load
    await page.waitForSelector('.maplibre-container', { timeout: 15000 });
  });

  test('should filter lists by party', async ({ page }) => {
    // Open list selector (mobile)
    const toggleButton = page.locator('text=Ver listas, partidos y ordenes');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
    }

    // Wait for party filter to be visible
    await page.waitForSelector('[data-testid="party-filter"]', { timeout: 5000 });

    // Select a party
    const partyDropdown = page.locator('[data-testid="party-filter"] select');
    await partyDropdown.selectOption({ index: 1 }); // Select first party

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify results counter shows filtered lists
    const resultsCount = page.locator('.results-count');
    await expect(resultsCount).toBeVisible();
    await expect(resultsCount).toContainText('Mostrando');
  });

  test('should show active filter chips', async ({ page }) => {
    // Open list selector
    const toggleButton = page.locator('text=Ver listas, partidos y ordenes');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
    }

    // Select a party
    const partyDropdown = page.locator('[data-testid="party-filter"] select');
    await partyDropdown.waitFor({ state: 'visible', timeout: 5000 });
    await partyDropdown.selectOption({ index: 1 });

    // Wait for active filters component
    await page.waitForTimeout(500);

    // Verify filter chip appears
    const activeFilters = page.locator('.active-filters');
    await expect(activeFilters).toBeVisible();
  });

  test('should clear all filters with "Limpiar todo" button', async ({ page }) => {
    // Open list selector
    const toggleButton = page.locator('text=Ver listas, partidos y ordenes');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
    }

    // Select a party
    const partyDropdown = page.locator('[data-testid="party-filter"] select');
    await partyDropdown.waitFor({ state: 'visible', timeout: 5000 });
    await partyDropdown.selectOption({ index: 1 });

    await page.waitForTimeout(500);

    // Click "Limpiar todo"
    const clearAllButton = page.locator('text=Limpiar todo');
    if (await clearAllButton.isVisible()) {
      await clearAllButton.click();

      // Verify filters are cleared
      await expect(page.locator('.active-filters')).toBeHidden();
    }
  });
});

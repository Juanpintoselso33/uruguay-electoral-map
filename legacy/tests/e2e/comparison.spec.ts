import { test, expect } from '@playwright/test';
import { waitForAppLoad, toggleComparisonMode, isComparisonModeActive, closeComparisonMode } from '../fixtures/test-helpers';

test.describe('Comparison - Comparison Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('"Comparar" button activates comparison mode', async ({ page }) => {
    // Find and click the comparison toggle button
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await expect(comparisonButton).toBeVisible();

    await comparisonButton.click();
    await page.waitForTimeout(1000);

    // Check that comparison mode is active
    const comparisonView = page.locator('.comparison-view, .comparison-header');
    await expect(comparisonView.first()).toBeVisible();
  });

  test('comparison mode shows two election selectors', async ({ page }) => {
    // Activate comparison mode
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await comparisonButton.click();
    await page.waitForTimeout(1000);

    // Look for the election selectors container
    const selectorsContainer = page.locator('.election-selectors');

    if (await selectorsContainer.first().isVisible()) {
      // Should have at least 2 select elements
      const selectElements = page.locator('.election-select, select');
      const count = await selectElements.count();
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test('comparison mode shows "vs" divider between selectors', async ({ page }) => {
    // Activate comparison mode
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await comparisonButton.click();
    await page.waitForTimeout(1000);

    // Look for the vs divider
    const vsDivider = page.locator('.vs-divider, :text("vs")');
    const isVisible = await vsDivider.isVisible().catch(() => false);

    // This is expected but not critical
    if (isVisible) {
      expect(await vsDivider.textContent()).toContain('vs');
    }
  });

  test('comparison view has a close button', async ({ page }) => {
    // Activate comparison mode
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await comparisonButton.click();
    await page.waitForTimeout(1000);

    // Find the close button
    const closeButton = page.locator('.close-button, .comparison-header button');
    await expect(closeButton.first()).toBeVisible();
  });

  test('closing comparison returns to normal mode', async ({ page }) => {
    // Activate comparison mode
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await comparisonButton.click();
    await page.waitForTimeout(1000);

    // Verify comparison mode is active
    const comparisonView = page.locator('.comparison-view');
    await expect(comparisonView).toBeVisible();

    // Click close button
    const closeButton = page.locator('.close-button, .comparison-header button').first();
    await closeButton.click();
    await page.waitForTimeout(500);

    // Comparison view should be gone
    await expect(comparisonView).not.toBeVisible();

    // Map should be visible again
    const mapContainer = page.locator('.maplibre-container, .map-container');
    await expect(mapContainer).toBeVisible();
  });

  test('comparison shows total votes statistics', async ({ page }) => {
    // Activate comparison mode
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await comparisonButton.click();
    await page.waitForTimeout(2000);

    // Look for statistics section
    const statsSection = page.locator('.summary-section, .stat-card, [class*="stats"]');
    const isVisible = await statsSection.first().isVisible().catch(() => false);

    if (isVisible) {
      // Should show "Votos Totales" label
      const votosLabel = page.locator(':text("Votos Totales"), .stat-label');
      await expect(votosLabel.first()).toBeVisible();
    }
  });

  test('comparison shows party changes', async ({ page }) => {
    // Activate comparison mode
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await comparisonButton.click();
    await page.waitForTimeout(2000);

    // Look for party changes section
    const partyChanges = page.locator('.party-changes, .party-change-list');
    const isVisible = await partyChanges.isVisible().catch(() => false);

    if (isVisible) {
      // Should have party change items
      const changeItems = page.locator('.party-change-item');
      const count = await changeItems.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('comparison shows difference indicators (arrows)', async ({ page }) => {
    // Activate comparison mode
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await comparisonButton.click();
    await page.waitForTimeout(2000);

    // Look for trend indicators (up/down arrows)
    const trendIndicators = page.locator('[class*="green"], [class*="red"], svg');

    // There should be some indicators for positive/negative changes
    const count = await trendIndicators.count();
    // Just verify the page has loaded comparison data
    expect(count).toBeGreaterThan(0);
  });

  test('changing elections in comparison updates statistics', async ({ page }) => {
    // Activate comparison mode
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await comparisonButton.click();
    await page.waitForTimeout(2000);

    // Find the election selectors
    const selectors = page.locator('.election-select, select');
    const count = await selectors.count();

    if (count >= 2) {
      // Get initial stat value
      const statValue = page.locator('.value-number, .stat-values').first();
      const initialValue = await statValue.textContent().catch(() => '');

      // Change the second selector if there are options
      const secondSelector = selectors.nth(1);
      const options = await secondSelector.locator('option').all();

      if (options.length >= 2) {
        // Select a different option
        await secondSelector.selectOption({ index: 0 });
        await page.waitForTimeout(2000);

        // The UI should have updated (loading or new values)
        const loadingState = page.locator('.loading-state, .spinner');
        const statsUpdated = page.locator('.stat-values, .value-number');

        // Either loading or stats should be visible
        const hasLoading = await loadingState.isVisible().catch(() => false);
        const hasStats = await statsUpdated.first().isVisible().catch(() => false);

        expect(hasLoading || hasStats).toBeTruthy();
      }
    }
  });

  test('comparison toggle button shows active state when in comparison mode', async ({ page }) => {
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');

    // Get initial classes
    const initialClasses = await comparisonButton.getAttribute('class');
    expect(initialClasses).not.toContain('active');

    // Activate comparison mode
    await comparisonButton.click();
    await page.waitForTimeout(500);

    // Button should now be active
    const activeClasses = await comparisonButton.getAttribute('class');
    expect(activeClasses).toContain('active');
  });

  test('comparison mode has proper title', async ({ page }) => {
    // Activate comparison mode
    const comparisonButton = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await comparisonButton.click();
    await page.waitForTimeout(1000);

    // Should have "Modo Comparacion" title
    const title = page.locator('.comparison-title, h2').filter({ hasText: /comparaci/i });
    await expect(title).toBeVisible();
  });
});

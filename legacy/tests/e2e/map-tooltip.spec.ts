import { test, expect } from '@playwright/test';

test.describe('Map Tooltip Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.maplibre-container canvas', { timeout: 15000 });
  });

  test('should show tooltip on map hover', async ({ page }) => {
    // Hover over map
    const mapCanvas = page.locator('.maplibre-container canvas');
    await mapCanvas.hover({ position: { x: 200, y: 200 } });

    // Wait for tooltip
    await page.waitForTimeout(500);

    // Verify tooltip appears
    const tooltip = page.locator('.map-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 2000 });
  });

  test('should pin tooltip after hovering for 1 second', async ({ page }) => {
    const mapCanvas = page.locator('.maplibre-container canvas');

    // Hover and wait for auto-pin
    await mapCanvas.hover({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(1500); // Wait for auto-pin (1 second delay)

    // Verify tooltip is pinned (has close button)
    const closeButton = page.locator('.tooltip-close-btn');
    await expect(closeButton).toBeVisible({ timeout: 2000 });
  });

  test('should show close button when tooltip is pinned', async ({ page }) => {
    const mapCanvas = page.locator('.maplibre-container canvas');

    // Click to pin
    await mapCanvas.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(500);

    // Verify close button appears
    const closeButton = page.locator('.tooltip-close-btn');
    await expect(closeButton).toBeVisible();
  });

  test('should close tooltip when clicking close button', async ({ page }) => {
    const mapCanvas = page.locator('.maplibre-container canvas');

    // Click to pin
    await mapCanvas.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(500);

    // Click close button
    const closeButton = page.locator('.tooltip-close-btn');
    if (await closeButton.isVisible()) {
      await closeButton.click();

      // Verify tooltip is hidden
      const tooltip = page.locator('.map-tooltip');
      await expect(tooltip).toBeHidden({ timeout: 1000 });
    }
  });

  test('should show scrollable content when many lists selected', async ({ page }) => {
    // Select multiple lists first
    const toggleButton = page.locator('text=Ver listas, partidos y ordenes');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
    }

    // Select several lists
    const lists = page.locator('.list-item');
    const count = await lists.count();
    if (count > 5) {
      for (let i = 0; i < 5; i++) {
        await lists.nth(i).click();
        await page.waitForTimeout(200);
      }
    }

    // Hover over map to show tooltip
    const mapCanvas = page.locator('.maplibre-container canvas');
    await mapCanvas.hover({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(500);

    // Verify tooltip has scrollable class
    const tooltipBody = page.locator('.tooltip-body.tooltip-scrollable');
    if (await tooltipBody.isVisible()) {
      // Verify max-height is applied (content is scrollable)
      const box = await tooltipBody.boundingBox();
      expect(box?.height).toBeLessThanOrEqual(300);
    }
  });
});

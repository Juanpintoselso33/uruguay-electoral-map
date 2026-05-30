import { test, expect } from '@playwright/test';

test.describe('App Loading and Initial State', () => {
  test('should load the app without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to app
    await page.goto('/');

    // Wait for app to be fully loaded
    await page.waitForSelector('[data-testid="app-layout"]', { timeout: 30000 });

    // Verify no console errors
    expect(consoleErrors).toEqual([]);
  });

  test('should not show loading spinner indefinitely', async ({ page }) => {
    await page.goto('/');

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Check if any loading spinner is visible
    const spinner = page.locator('[data-testid="loading-spinner"]');

    // If spinner exists, it should disappear within 10 seconds
    if (await spinner.count() > 0) {
      await expect(spinner).toBeHidden({ timeout: 10000 });
    }
  });

  test('should load map without errors', async ({ page }) => {
    await page.goto('/');

    // Wait for map container
    const mapContainer = page.locator('.maplibre-container');
    await expect(mapContainer).toBeVisible({ timeout: 15000 });

    // Verify map canvas is rendered
    const mapCanvas = page.locator('.maplibre-container canvas');
    await expect(mapCanvas).toBeVisible();
  });

  test('should show election selector with available elections', async ({ page }) => {
    await page.goto('/');

    // Wait for election selector
    await page.waitForSelector('.election-selector', { timeout: 10000 });

    // Verify Internas 2024 is available
    const internas2024 = page.locator('text=Internas').first();
    await expect(internas2024).toBeVisible();

    // Verify Nacionales 2019 is available
    const nacionales2019 = page.locator('text=Nacionales').first();
    await expect(nacionales2019).toBeVisible();
  });

  test('should show department selector', async ({ page }) => {
    await page.goto('/');

    // Wait for region selector
    const regionSelector = page.locator('[data-testid="region-selector"]');
    await expect(regionSelector).toBeVisible();

    // Verify dropdown can be opened
    const hamburgerButton = page.locator('.hamburger-button');
    await expect(hamburgerButton).toBeVisible();
  });
});

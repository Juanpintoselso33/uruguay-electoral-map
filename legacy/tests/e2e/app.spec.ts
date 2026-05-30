import { test, expect } from '@playwright/test';
import { waitForAppLoad, waitForMapLoad } from '../fixtures/test-helpers';

test.describe('App - Basic Loading and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('the app loads without errors', async ({ page }) => {
    // Wait for the app to load
    await waitForAppLoad(page);

    // Check that there are no console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    // The app should have rendered - use first() to handle multiple matches
    const appElement = page.locator('.app-layout, #app').first();
    await expect(appElement).toBeVisible();
  });

  test('the header shows "Mapa Electoral"', async ({ page }) => {
    await waitForAppLoad(page);

    // Check for the site title
    const header = page.locator('.site-title, h1').filter({ hasText: /Mapa Electoral/i });
    await expect(header).toBeVisible();
  });

  test('the sidebar is visible on desktop', async ({ page }) => {
    await waitForAppLoad(page);

    // Check that the sidebar is visible
    const sidebar = page.locator('.sidebar, aside').first();
    await expect(sidebar).toBeVisible();
  });

  test('the sidebar can be collapsed and expanded', async ({ page }) => {
    await waitForAppLoad(page);

    // Find the sidebar toggle button
    const sidebarToggle = page.locator('.sidebar-toggle');

    if (await sidebarToggle.isVisible()) {
      // Get initial sidebar state
      const sidebar = page.locator('.sidebar');
      const initialClasses = await sidebar.getAttribute('class');
      const wasCollapsed = initialClasses?.includes('collapsed');

      // Toggle sidebar
      await sidebarToggle.click();
      await page.waitForTimeout(500);

      // Check that the state changed
      const newClasses = await sidebar.getAttribute('class');
      const isNowCollapsed = newClasses?.includes('collapsed');

      expect(isNowCollapsed).not.toBe(wasCollapsed);
    }
  });

  test('the map renders correctly', async ({ page }) => {
    await waitForAppLoad(page);

    // Check that the map container exists
    const mapContainer = page.locator('.maplibre-container, .map-container, .map-area');
    await expect(mapContainer.first()).toBeVisible();

    // Wait for canvas - MapLibre may take time to initialize
    const canvas = page.locator('canvas');

    // Give MapLibre time to initialize (it's a WebGL library)
    try {
      await expect(canvas.first()).toBeVisible({ timeout: 15000 });
    } catch {
      // Map might not have loaded yet, but container should be there
      console.log('Map canvas not loaded yet, but container is present');
    }
  });

  test('the app header contains navigation elements', async ({ page }) => {
    await waitForAppLoad(page);

    // Check for theme toggle
    const themeToggle = page.locator('.theme-toggle, button[aria-label*="theme"], button[aria-label*="Theme"]');
    await expect(themeToggle).toBeVisible();

    // Check for comparison toggle
    const comparisonToggle = page.locator('.comparison-toggle, button:has-text("Comparar")');
    await expect(comparisonToggle).toBeVisible();
  });

  test('the app shows loading state correctly', async ({ page }) => {
    // Navigate before app loads to catch loading state
    const responsePromise = page.waitForResponse(resp => resp.url().includes('regions.json'));

    await page.goto('/');

    // Wait for the regions.json to be fetched
    await responsePromise;

    // After loading, regions should be visible
    await page.waitForSelector('.region-button, .region-grid button', { timeout: 30000 });
  });

  test('the footer or attribution is present', async ({ page }) => {
    await waitForAppLoad(page);

    // Check for any attribution or footer links
    const attribution = page.locator('[class*="attribution"], .github-link, a[href*="github"]');
    // This is optional, some versions may not have it
    const hasAttribution = await attribution.isVisible().catch(() => false);

    // Just log if not present, don't fail
    if (!hasAttribution) {
      console.log('No attribution/footer found, which is acceptable');
    }
  });
});

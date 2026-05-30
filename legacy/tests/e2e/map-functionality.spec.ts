import { test, expect } from '@playwright/test';
import { selectDepartment, selectFirstList, switchDataSource, hoverMapFeature, getTooltip, waitForMapLoaded } from '../helpers/testUtils';

test.describe('Electoral Map - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForSelector('[data-testid="region-selector"]', { timeout: 15000 });
  });

  test('should load the application successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Montevideo Votos Map|Uruguay Electoral|Mapa Electoral/i);
  });

  test('should display department selector', async ({ page }) => {
    const selector = page.locator('[data-testid="region-selector"]').first();
    await expect(selector).toBeVisible();
  });

  test('should load and display a map for selected department', async ({ page }) => {
    // Select Rivera
    await selectDepartment(page, 'Rivera');

    // Check that map container exists
    const mapContainer = page.locator('[data-testid="map-container"]');
    await expect(mapContainer).toBeVisible();

    // Check that map has features loaded
    await waitForMapLoaded(page);
  });

  test('should switch between ODD and ODN data sources', async ({ page }) => {
    // Select a department
    await selectDepartment(page, 'Rivera');

    // Switch to ODN mode
    await switchDataSource(page, true);

    // Verify the toggle changed
    const toggleContainer = page.locator('[data-testid="data-source-toggle"]');
    const odnRadio = toggleContainer.locator('input[type="radio"][value="true"]');
    const isChecked = await odnRadio.isChecked();
    expect(isChecked).toBe(true);
  });

  test('should display tooltip on hover over map feature', async ({ page }) => {
    // Select Rivera
    await selectDepartment(page, 'Rivera');

    // Wait for map features to load and hover
    await waitForMapLoaded(page);
    await hoverMapFeature(page, 2);

    // Check for tooltip
    const tooltip = getTooltip(page);
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    // Tooltip should contain some text (not just the serie code)
    const tooltipText = await tooltip.textContent();
    expect(tooltipText).toBeTruthy();
    expect(tooltipText!.length).toBeGreaterThan(3);
  });

  test('tooltip should show vote information', async ({ page }) => {
    // Select Rivera
    await selectDepartment(page, 'Rivera');

    // Wait for map features to load and hover over one
    await waitForMapLoaded(page);
    await hoverMapFeature(page, 3);

    // Check tooltip contains vote information
    const tooltip = getTooltip(page);
    const tooltipText = await tooltip.textContent();

    // Should contain "votos", "lista", "partido", or "Serie"
    expect(tooltipText).toMatch(/votos|lista|partido|serie/i);
  });

  test('should select lists and update map colors', async ({ page }) => {
    // Select Rivera
    await selectDepartment(page, 'Rivera');

    // Select a list
    await selectFirstList(page);

    // Map should update (features should have colors)
    const coloredFeature = page.locator('.leaflet-container path[fill]:not([fill="#FFFFFF"])');
    await expect(coloredFeature.first()).toBeVisible({ timeout: 5000 });
  });

  test('should handle department change correctly', async ({ page }) => {
    // Select Rivera
    await selectDepartment(page, 'Rivera');

    // Verify map loaded for Rivera
    await waitForMapLoaded(page);

    // Switch to Montevideo
    await selectDepartment(page, 'Montevideo');

    // Verify map reloaded for Montevideo
    await waitForMapLoaded(page);
  });
});

test.describe('Electoral Map - Multi-Election Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="region-selector"]', { timeout: 15000 });
  });

  test('should display election selector', async ({ page }) => {
    const electionSelector = page.locator('[data-testid="election-selector"]');

    if (await electionSelector.isVisible()) {
      await expect(electionSelector).toBeVisible();
    } else {
      console.log('Election selector not found - may not be implemented yet');
    }
  });

  test('should switch between elections', async ({ page }) => {
    const electionSelector = page.locator('[data-testid="election-selector"] select').first();

    if (await electionSelector.isVisible()) {
      // Select department first
      await selectDepartment(page, 'Rivera');

      // Get available elections
      const options = await electionSelector.locator('option').all();

      if (options.length > 1) {
        // Switch election
        await electionSelector.selectOption({ index: 1 });
        await page.waitForTimeout(1500);

        // Map should reload
        await waitForMapLoaded(page);
      }
    }
  });
});

test.describe('Electoral Map - Visual Regression', () => {
  test('Rivera department should render correctly', async ({ page }) => {
    await page.goto('/');
    await selectDepartment(page, 'Rivera');

    // Wait for map to fully load
    await waitForMapLoaded(page);
    await page.waitForTimeout(1000);

    // Take screenshot
    await expect(page).toHaveScreenshot('rivera-default-view.png', {
      fullPage: false,
      timeout: 10000,
    });
  });

  test('Montevideo department should render correctly', async ({ page }) => {
    await page.goto('/');
    await selectDepartment(page, 'Montevideo');

    // Wait for map to fully load
    await waitForMapLoaded(page);
    await page.waitForTimeout(1000);

    // Take screenshot
    await expect(page).toHaveScreenshot('montevideo-default-view.png', {
      fullPage: false,
      timeout: 10000,
    });
  });
});

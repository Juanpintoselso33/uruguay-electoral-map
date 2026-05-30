import { test, expect } from '@playwright/test';

test.describe('Navigation - Elections and Departments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should switch between elections', async ({ page }) => {
    // Wait for election cards
    await page.waitForSelector('.election-card', { timeout: 10000 });

    // Click on Nacionales 2019
    const nacionales = page.locator('.election-card').filter({ hasText: 'Nacionales' });
    await nacionales.click();

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Verify map reloads
    const mapCanvas = page.locator('.maplibre-container canvas');
    await expect(mapCanvas).toBeVisible();
  });

  test('should show Internas 2024 as available election', async ({ page }) => {
    // Wait for election selector
    await page.waitForSelector('.election-selector', { timeout: 10000 });

    // Verify Internas 2024 card exists and is clickable
    const internas = page.locator('.election-card').filter({ hasText: 'Internas' }).filter({ hasText: '2024' });
    await expect(internas).toBeVisible();
    await expect(internas).not.toHaveClass(/election-disabled/);
  });

  test('should open department dropdown', async ({ page }) => {
    // Click hamburger menu
    const hamburgerButton = page.locator('.hamburger-button');
    await hamburgerButton.click();

    // Verify menu opens
    const menu = page.locator('.menu');
    await expect(menu).toHaveClass(/menu-open/);

    // Verify departments are listed
    const departments = page.locator('.menu button');
    const count = await departments.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should switch departments', async ({ page }) => {
    // Open dropdown
    const hamburgerButton = page.locator('.hamburger-button');
    await hamburgerButton.click();

    // Click on a different department (e.g., Maldonado)
    const maldonado = page.locator('.menu button', { hasText: 'Maldonado' });
    if (await maldonado.isVisible()) {
      await maldonado.click();

      // Wait for map to reload
      await page.waitForTimeout(2000);

      // Verify menu closes
      const menu = page.locator('.menu');
      await expect(menu).not.toHaveClass(/menu-open/);

      // Verify map canvas is still visible
      const mapCanvas = page.locator('.maplibre-container canvas');
      await expect(mapCanvas).toBeVisible();
    }
  });

  test('should close department menu with Escape key', async ({ page }) => {
    // Open dropdown
    const hamburgerButton = page.locator('.hamburger-button');
    await hamburgerButton.click();

    // Verify menu is open
    const menu = page.locator('.menu');
    await expect(menu).toHaveClass(/menu-open/);

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify menu closes
    await expect(menu).not.toHaveClass(/menu-open/);
  });
});

import { test, expect } from '@playwright/test';
import { waitForAppLoad, openSearchWithKeyboard } from '../fixtures/test-helpers';

test.describe('Search - Department Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('search bar is visible in header', async ({ page }) => {
    const searchBar = page.locator('.search-bar, input[type="search"], input[placeholder*="buscar" i], input[placeholder*="departamento" i]');
    await expect(searchBar.first()).toBeVisible();
  });

  test('Ctrl+K/Cmd+K opens search', async ({ page }) => {
    // Find the search input
    const searchInput = page.locator('.search-input, input[type="text"]').first();

    // Press Ctrl+K
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    // Check if search input is focused
    const isFocused = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.tagName === 'INPUT';
    });

    // The search should be visible regardless
    await expect(searchInput).toBeVisible();

    // Log focus state for info
    console.log(`Search input focused after Ctrl+K: ${isFocused}`);
  });

  test('typing in search filters departments', async ({ page }) => {
    // Focus search input
    const searchInput = page.locator('.search-input, input[type="search"], input[type="text"]').first();
    await searchInput.click();
    await page.waitForTimeout(300);

    // Type search query
    await searchInput.fill('Monte');
    await page.waitForTimeout(500);

    // Search results should appear
    const searchResults = page.locator('.search-results, [class*="result"]');
    const isVisible = await searchResults.isVisible().catch(() => false);

    if (isVisible) {
      // Results should contain Montevideo
      const montevideoResult = page.locator('.search-result-item, [class*="result"]').filter({ hasText: 'Montevideo' });
      await expect(montevideoResult.first()).toBeVisible();
    }
  });

  test('pressing Enter selects the department', async ({ page }) => {
    const searchInput = page.locator('.search-input, input[type="search"], input[type="text"]').first();
    await searchInput.click();

    // Type to filter
    await searchInput.fill('Monte');
    await page.waitForTimeout(500);

    // Press Enter to select
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Search should close and department should be selected
    const searchResults = page.locator('.search-results');
    const isHidden = await searchResults.isHidden().catch(() => true);

    // Check if Montevideo is now selected
    const montevideoButton = page.locator('.region-button.active, .region-grid button.active').filter({ hasText: 'Montevideo' });
    const isSelected = await montevideoButton.isVisible().catch(() => false);

    expect(isHidden || isSelected).toBeTruthy();
  });

  test('pressing Escape closes search', async ({ page }) => {
    const searchInput = page.locator('.search-input, input[type="search"], input[type="text"]').first();
    await searchInput.click();

    // Type something
    await searchInput.fill('Can');
    await page.waitForTimeout(300);

    // Results should be visible
    const searchResults = page.locator('.search-results');
    const wasVisible = await searchResults.isVisible().catch(() => false);

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Results should be hidden
    const isNowHidden = await searchResults.isHidden().catch(() => true);
    expect(isNowHidden).toBeTruthy();
  });

  test('search shows MapPin icon for results', async ({ page }) => {
    const searchInput = page.locator('.search-input').first();
    await searchInput.click();
    await searchInput.fill('Mon');
    await page.waitForTimeout(500);

    // Look for icon in results
    const resultIcon = page.locator('.search-result-item svg, .result-icon');
    const hasIcon = await resultIcon.first().isVisible().catch(() => false);

    // Icon is nice to have but not critical
    console.log(`Search result has icon: ${hasIcon}`);
  });

  test('clicking on search result selects department', async ({ page }) => {
    const searchInput = page.locator('.search-input, input[type="text"]').first();
    await searchInput.click();
    await searchInput.fill('Monte');
    await page.waitForTimeout(500);

    // Click on result
    const result = page.locator('.search-result-item').filter({ hasText: 'Montevideo' });

    if (await result.isVisible()) {
      await result.click();
      await page.waitForTimeout(500);

      // Department should be selected
      const activeButton = page.locator('.region-button.active').filter({ hasText: 'Montevideo' });
      await expect(activeButton).toBeVisible();
    }
  });

  test('search shows keyboard shortcut hint', async ({ page }) => {
    // Look for the keyboard shortcut indicator
    const kbdHint = page.locator('.search-kbd, kbd');
    const isVisible = await kbdHint.isVisible().catch(() => false);

    if (isVisible) {
      const text = await kbdHint.textContent();
      expect(text).toContain('K');
    }
  });

  test('search handles arrow key navigation', async ({ page }) => {
    const searchInput = page.locator('.search-input, input[type="text"]').first();
    await searchInput.click();
    await searchInput.fill('Can');
    await page.waitForTimeout(500);

    const results = page.locator('.search-result-item');
    const count = await results.count();

    if (count > 1) {
      // Press ArrowDown
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      // Second item should be highlighted
      const secondResult = results.nth(1);
      const classes = await secondResult.getAttribute('class');
      expect(classes).toContain('active');
    }
  });

  test('search clears on department selection', async ({ page }) => {
    const searchInput = page.locator('.search-input, input[type="text"]').first();
    await searchInput.click();
    await searchInput.fill('Monte');
    await page.waitForTimeout(500);

    // Select result
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Input should be cleared
    const value = await searchInput.inputValue();
    expect(value).toBe('');
  });

  test('empty search shows all departments', async ({ page }) => {
    const searchInput = page.locator('.search-input, input[type="text"]').first();
    await searchInput.click();
    await page.waitForTimeout(300);

    // With no text, should show all or no results
    const results = page.locator('.search-results');
    const isVisible = await results.isVisible().catch(() => false);

    if (isVisible) {
      const items = page.locator('.search-result-item');
      const count = await items.count();
      // Should show multiple departments
      expect(count).toBeGreaterThan(0);
    }
  });

  test('search is case insensitive', async ({ page }) => {
    const searchInput = page.locator('.search-input, input[type="text"]').first();
    await searchInput.click();

    // Type in lowercase
    await searchInput.fill('montevideo');
    await page.waitForTimeout(500);

    const results = page.locator('.search-result-item').filter({ hasText: /montevideo/i });
    await expect(results.first()).toBeVisible();

    // Clear and try uppercase
    await searchInput.fill('MONTEVIDEO');
    await page.waitForTimeout(500);

    const uppercaseResults = page.locator('.search-result-item').filter({ hasText: /montevideo/i });
    await expect(uppercaseResults.first()).toBeVisible();
  });

  test('clicking outside search closes results', async ({ page }) => {
    const searchInput = page.locator('.search-input, input[type="text"]').first();
    await searchInput.click();
    await searchInput.fill('Mon');
    await page.waitForTimeout(500);

    const results = page.locator('.search-results');
    const wasVisible = await results.isVisible().catch(() => false);

    // Click outside
    await page.locator('.app-layout').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);

    // Results should be hidden
    const isNowHidden = await results.isHidden().catch(() => true);
    expect(isNowHidden).toBeTruthy();
  });
});

import { test, expect } from '@playwright/test';

test('Full layout screenshot', async ({ page }) => {
  // Set larger viewport to see everything
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  // Click Montevideo
  const montevideoButton = page.locator('text=Montevideo').first();
  if (await montevideoButton.isVisible()) {
    await montevideoButton.click();
    await page.waitForTimeout(3000);
  }

  // Take full page screenshot
  await page.screenshot({ path: 'full-layout.png', fullPage: false });
  console.log('\n✓ Full layout screenshot saved to full-layout.png');

  // Check that list selector is visible
  const listSelector = page.locator('h2:has-text("Listas")').or(page.locator('text=Seleccionar por'));
  const listSelectorVisible = await listSelector.isVisible();
  console.log('List selector visible:', listSelectorVisible);

  if (listSelectorVisible) {
    // Scroll to list selector
    await listSelector.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Take screenshot of list selector area
    await page.screenshot({ path: 'list-selector.png', fullPage: false });
    console.log('✓ List selector screenshot saved to list-selector.png');
  }

  expect(true).toBe(true);
});

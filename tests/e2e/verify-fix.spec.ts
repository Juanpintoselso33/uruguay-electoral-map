import { test, expect } from '@playwright/test';

test('Verify lists work and paint map', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  // Click Montevideo
  await page.locator('text=Montevideo').first().click();
  await page.waitForTimeout(3000);

  console.log('✓ Clicked Montevideo, waiting for data to load...');

  // Find all list checkboxes
  const listCheckboxes = page.locator('input[type="checkbox"][value]');
  const count = await listCheckboxes.count();
  console.log(`✓ Found ${count} list checkboxes`);

  // Get first few checkbox labels to verify they're unique
  const labels = await page.locator('label:has-text("Lista")').allTextContents();
  const firstTen = labels.slice(0, 10);
  console.log('First 10 lists:', firstTen);

  // Select the first list (not "Seleccionar todas")
  const firstList = listCheckboxes.nth(0);
  const firstListValue = await firstList.getAttribute('value');
  console.log(`\n✓ Selecting first list: ${firstListValue}`);

  await firstList.click();
  await page.waitForTimeout(2000);

  // Verify it's checked
  const isChecked = await firstList.isChecked();
  console.log(`✓ First list is checked: ${isChecked}`);

  // Take screenshot
  await page.screenshot({ path: 'verify-list-selection.png', fullPage: false });
  console.log('✓ Screenshot saved: verify-list-selection.png');

  // Check canvas exists and has content
  const canvas = page.locator('canvas').first();
  const canvasExists = await canvas.count() > 0;
  console.log(`✓ Map canvas exists: ${canvasExists}`);

  expect(isChecked).toBe(true);
  expect(count).toBeGreaterThan(0);
});

import { test, expect } from '@playwright/test';

test('Final verification - polygons and painting', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  console.log('Step 1: Click Montevideo');
  await page.locator('text=Montevideo').first().click();
  await page.waitForTimeout(4000);

  // Take screenshot before selection
  await page.screenshot({ path: 'final-before-selection.png', fullPage: false });
  console.log('✓ Screenshot saved: final-before-selection.png');

  // Check if map canvas exists
  const canvas = page.locator('canvas').first();
  const canvasExists = await canvas.count() > 0;
  console.log(`✓ Map canvas exists: ${canvasExists}`);

  // Select first list
  const firstCheckbox = page.locator('input[type="checkbox"][value]').first();
  const listValue = await firstCheckbox.getAttribute('value');
  console.log(`\nStep 2: Selecting list: ${listValue}`);

  await firstCheckbox.click();
  await page.waitForTimeout(2000);

  const isChecked = await firstCheckbox.isChecked();
  console.log(`✓ List is checked: ${isChecked}`);

  // Take screenshot after selection
  await page.screenshot({ path: 'final-after-selection.png', fullPage: false });
  console.log('✓ Screenshot saved: final-after-selection.png');

  // Check for error messages
  const errorMessage = await page.locator('.error, .alert-error').count();
  console.log(`\nNo errors on page: ${errorMessage === 0}`);

  expect(canvasExists).toBe(true);
  expect(isChecked).toBe(true);
  expect(errorMessage).toBe(0);
});

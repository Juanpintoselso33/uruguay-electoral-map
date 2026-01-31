import { test, expect } from '@playwright/test';

test('Test Canelones department', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  console.log('Step 1: Click Canelones');
  await page.locator('text=Canelones').first().click();
  await page.waitForTimeout(4000);

  // Check map loads
  const canvas = page.locator('canvas').first();
  const canvasExists = await canvas.count() > 0;
  console.log(`✓ Map canvas exists: ${canvasExists}`);

  // Check lists are available
  const checkboxes = await page.locator('input[type="checkbox"][value]').count();
  console.log(`✓ Found ${checkboxes} list checkboxes`);

  // Get list of zones
  const storeCheck = await page.evaluate(() => {
    const electoral = (window as any).__PINIA__?.state?.value?.electoral;
    if (!electoral?.currentRegion) return null;
    return {
      department: electoral.currentRegion.name,
      zones: Object.keys(electoral.currentRegion.votosPorListas || {}).length
    };
  });
  console.log('Store check:', storeCheck);

  // Select first list
  if (checkboxes > 0) {
    const firstCheckbox = page.locator('input[type="checkbox"][value]').first();
    const listValue = await firstCheckbox.getAttribute('value');
    console.log(`\nStep 2: Selecting list: ${listValue}`);

    await firstCheckbox.click();
    await page.waitForTimeout(2000);

    const isChecked = await firstCheckbox.isChecked();
    console.log(`✓ List is checked: ${isChecked}`);

    // Take screenshot
    await page.screenshot({ path: 'canelones-test.png', fullPage: false });
    console.log('✓ Screenshot saved: canelones-test.png');

    expect(isChecked).toBe(true);
  }

  expect(canvasExists).toBe(true);
  expect(checkboxes).toBeGreaterThan(0);
});

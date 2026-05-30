import { test, expect } from '@playwright/test';

test('Test Nacionales 2019 - Canelones', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  console.log('Step 1: Click Canelones');
  await page.locator('text=Canelones').first().click();
  await page.waitForTimeout(3000);

  // Check if there's an election selector
  const electionSelector = page.locator('select, .election-selector').first();
  const selectorExists = await electionSelector.count() > 0;
  console.log('✓ Election selector exists:', selectorExists);

  if (selectorExists) {
    // Try to select 2019 election
    console.log('Step 2: Selecting Nacionales 2019');

    // Look for 2019 option
    const option2019 = page.locator('option:has-text("2019"), button:has-text("2019")').first();
    const has2019 = await option2019.count() > 0;
    console.log('✓ Has 2019 option:', has2019);

    if (has2019) {
      await option2019.click();
      await page.waitForTimeout(2000);
    }
  }

  // Check lists are available
  const checkboxes = await page.locator('input[type="checkbox"][value]').count();
  console.log(`✓ Found ${checkboxes} list checkboxes`);

  // Select first list
  if (checkboxes > 0) {
    const firstCheckbox = page.locator('input[type="checkbox"][value]').first();
    const listValue = await firstCheckbox.getAttribute('value');
    console.log(`\nStep 3: Selecting list: ${listValue}`);

    await firstCheckbox.click();
    await page.waitForTimeout(2000);

    const isChecked = await firstCheckbox.isChecked();
    console.log(`✓ List is checked: ${isChecked}`);

    // Take screenshot
    await page.screenshot({ path: 'test-2019-canelones.png', fullPage: false });
    console.log('✓ Screenshot saved: test-2019-canelones.png');

    expect(isChecked).toBe(true);
  }

  // Map should exist
  const canvas = page.locator('canvas').first();
  const canvasExists = await canvas.count() > 0;
  console.log(`✓ Map canvas exists: ${canvasExists}`);

  expect(canvasExists).toBe(true);
  expect(checkboxes).toBeGreaterThan(0);
});

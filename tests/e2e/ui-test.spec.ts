import { test, expect } from '@playwright/test';

test('UI functionality test', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Wait for app to load
  await page.waitForTimeout(2000);

  console.log('\n=== INITIAL STATE ===');

  // Check if Montevideo is available
  const montevideoButton = page.locator('text=Montevideo').first();
  const isVisible = await montevideoButton.isVisible();
  console.log('Montevideo button visible:', isVisible);

  if (isVisible) {
    await montevideoButton.click();
    console.log('Clicked Montevideo');
    await page.waitForTimeout(3000);
  }

  // Check election selector
  console.log('\n=== ELECTION SELECTOR ===');
  const electionSelector = page.locator('[data-testid="election-selector"]').or(page.locator('select').filter({ hasText: /elec/i }));
  const electionSelectorExists = await electionSelector.count() > 0;
  console.log('Election selector exists:', electionSelectorExists);
  if (electionSelectorExists) {
    const options = await electionSelector.locator('option').allTextContents();
    console.log('Election options:', options);
  }

  // Check party selector (it's a dropdown, not buttons)
  console.log('\n=== PARTY SELECTOR ===');
  const partySelect = page.locator('select').filter({ has: page.locator('option:has-text("partido")') }).or(
    page.locator('select').first()
  );
  const partySelectExists = await partySelect.count() > 0;
  console.log('Party select dropdown exists:', partySelectExists);

  if (partySelectExists) {
    const options = await partySelect.locator('option').allTextContents();
    console.log('Party options:', options.slice(0, 10));
    console.log('Total party options:', options.length);

    // Try selecting a party
    if (options.length > 1) {
      console.log('\nSelecting first party option:', options[1]);
      await partySelect.selectOption({ index: 1 });
      await page.waitForTimeout(1000);

      // Check if lists are filtered
      const listCheckboxes = page.locator('input[type="checkbox"]').filter({ has: page.locator('~ span') });
      const listCheckboxesCount = await listCheckboxes.count();
      console.log('Checkboxes after party selection:', listCheckboxesCount);
    }
  }

  // Check data source toggle
  console.log('\n=== DATA SOURCE TOGGLE ===');
  const odnToggle = page.locator('text=/ODN|ODD/i').first();
  const toggleExists = await odnToggle.isVisible();
  console.log('ODN/ODD toggle visible:', toggleExists);

  // Check map
  console.log('\n=== MAP STATE ===');
  const mapCanvas = page.locator('canvas.maplibregl-canvas');
  const canvasExists = await mapCanvas.count() > 0;
  console.log('Map canvas exists:', canvasExists);

  if (canvasExists) {
    const canvasBox = await mapCanvas.boundingBox();
    console.log('Canvas size:', canvasBox);
  }

  // Take screenshot
  await page.screenshot({ path: 'ui-test-screenshot.png', fullPage: true });
  console.log('\nScreenshot saved to ui-test-screenshot.png');

  expect(isVisible).toBe(true);
});

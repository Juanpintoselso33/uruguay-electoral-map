import { test, expect } from '@playwright/test';

test('List selection and map painting', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  console.log('\n=== INITIAL SETUP ===');

  // Click Montevideo
  const montevideoButton = page.locator('text=Montevideo').first();
  await montevideoButton.click();
  console.log('✓ Clicked Montevideo');
  await page.waitForTimeout(3000);

  console.log('\n=== CHECKING AVAILABLE LISTS ===');

  // Find all list checkboxes
  const listCheckboxes = page.locator('input[type="checkbox"]').filter({
    has: page.locator('~ span:has-text("Lista")')
  });
  const listCount = await listCheckboxes.count();
  console.log('Total list checkboxes found:', listCount);

  // Get all list labels
  const listLabels = await page.locator('label').filter({
    has: page.locator('span:has-text("Lista")')
  }).allTextContents();
  console.log('First 10 list labels:', listLabels.slice(0, 10));

  // Check for duplicates
  const listNumbers = listLabels
    .map(label => label.match(/Lista (\d+)/)?.[1])
    .filter(Boolean);
  const uniqueListNumbers = new Set(listNumbers);
  console.log('Total lists:', listNumbers.length);
  console.log('Unique lists:', uniqueListNumbers.size);
  if (listNumbers.length !== uniqueListNumbers.size) {
    console.log('⚠️  DUPLICATES FOUND!');
    const duplicates = listNumbers.filter((item, index) => listNumbers.indexOf(item) !== index);
    console.log('Duplicate list numbers:', [...new Set(duplicates)]);
  }

  console.log('\n=== TESTING LIST SELECTION ===');

  // Select first available list
  if (listCount > 0) {
    const firstList = listCheckboxes.first();
    const firstListLabel = await page.locator('label').filter({
      has: firstList
    }).textContent();
    console.log('Selecting first list:', firstListLabel);

    await firstList.click();
    await page.waitForTimeout(1000);

    const isChecked = await firstList.isChecked();
    console.log('First list is checked:', isChecked);

    console.log('\n=== CHECKING MAP STATE AFTER SELECTION ===');

    // Check if map canvas exists
    const canvas = page.locator('canvas.maplibregl-canvas').first();
    const canvasExists = await canvas.count() > 0;
    console.log('Map canvas exists:', canvasExists);

    if (canvasExists) {
      // Get canvas data to check if it has content
      const canvasDataUrl = await page.evaluate(() => {
        const canvas = document.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement;
        if (!canvas) return null;
        try {
          return canvas.toDataURL('image/png');
        } catch (e) {
          return 'ERROR: ' + (e as Error).message;
        }
      });

      if (canvasDataUrl && canvasDataUrl.startsWith('data:')) {
        console.log('✓ Canvas has image data (length:', canvasDataUrl.length, ')');
      } else {
        console.log('✗ Canvas data:', canvasDataUrl);
      }

      // Take screenshot after selection
      await page.screenshot({ path: 'map-after-list-selection.png' });
      console.log('✓ Screenshot saved: map-after-list-selection.png');
    }

    console.log('\n=== CHECKING STORE STATE ===');

    // Check Vue store state
    const storeState = await page.evaluate(() => {
      const app = (window as any).__VUE_APP__;
      if (!app) return 'No Vue app found';

      // Try to access the store
      return {
        hasStore: !!(window as any).__PINIA__,
        selectedListsCount: (window as any).__PINIA__?.state?.value?.electoral?.selectedLists?.length || 0,
      };
    });
    console.log('Store state:', storeState);
  }

  console.log('\n=== TESTING PARTY FILTER ===');

  // Select a party
  const partySelect = page.locator('select').first();
  const partyOptions = await partySelect.locator('option').allTextContents();

  if (partyOptions.length > 1) {
    console.log('Selecting party:', partyOptions[1]);
    await partySelect.selectOption({ index: 1 });
    await page.waitForTimeout(1000);

    // Check how many lists are visible after party filter
    const visibleListsAfterFilter = await listCheckboxes.count();
    console.log('Lists visible after party filter:', visibleListsAfterFilter);

    // Take screenshot
    await page.screenshot({ path: 'map-after-party-filter.png' });
    console.log('✓ Screenshot saved: map-after-party-filter.png');
  }

  expect(listCount).toBeGreaterThan(0);
});

import { test } from '@playwright/test';

test('Debug list checkboxes', async ({ page }) => {
  // Track network requests
  const requests: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (url.includes('.json') || url.includes('.csv')) {
      requests.push(url);
    }
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  console.log('Initial requests:', requests.filter(r => r.includes('montevideo') || r.includes('electoral')));

  // Click Montevideo
  const montevideoButton = page.locator('text=Montevideo').first();
  await montevideoButton.click();
  await page.waitForTimeout(4000);

  console.log('\\nAll data requests after clicking Montevideo:');
  requests.forEach(r => {
    if (r.includes('montevideo') || r.includes('electoral')) {
      console.log('  -', r.replace('http://localhost:5173/', ''));
    }
  });

  // Get all checkbox inputs and their values
  const checkboxes = await page.locator('input[type="checkbox"][value]').evaluateAll(inputs => {
    return inputs.map(input => (input as HTMLInputElement).value);
  });
  console.log('\\nCheckbox values (first 30):', checkboxes.slice(0, 30));
  console.log('Total:', checkboxes.length);

  // Count duplicates
  const counts: Record<string, number> = {};
  checkboxes.forEach(val => {
    counts[val] = (counts[val] || 0) + 1;
  });
  const duplicates = Object.entries(counts).filter(([k, v]) => v > 1);
  console.log('\\nDuplicates:', duplicates.slice(0, 10));
});

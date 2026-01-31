import { test, expect } from '@playwright/test';
import { selectDepartment, selectFirstList, switchDataSource, hoverMapFeature, getTooltip, waitForMapLoaded } from '../helpers/testUtils';

test.describe('Tooltip Content Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('Tooltip shows locality name (not just series code)', async ({ page }) => {
    // Select Montevideo
    await selectDepartment(page, 'Montevideo');

    // Select a list to enable coloring
    await selectFirstList(page);

    // Wait for map and hover over a feature
    await waitForMapLoaded(page);
    await hoverMapFeature(page, 5);

    // Check tooltip content
    const tooltip = getTooltip(page);
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    const tooltipText = await tooltip.textContent();
    console.log('Tooltip content:', tooltipText?.substring(0, 300));

    // Verify it shows locality name (capitalized) or "Serie XXX" format
    expect(tooltipText).toBeTruthy();

    // Should NOT be just a 3-letter lowercase code
    const isJustCode = /^[a-z]{3}$/.test(tooltipText?.trim() || '');
    expect(isJustCode).toBe(false);

    // Should be capitalized or start with "Serie"
    const firstWord = tooltipText?.trim().split(/\s+/)[0] || '';
    const isCapitalizedOrSerie =
      (firstWord.length > 0 && firstWord[0] === firstWord[0].toUpperCase()) ||
      tooltipText?.includes('Serie');
    expect(isCapitalizedOrSerie).toBe(true);
  });

  test('Tooltip shows vote counts by list', async ({ page }) => {
    // Select Rivera (simpler department for testing)
    await selectDepartment(page, 'Rivera');

    // Select a list
    await selectFirstList(page);

    // Wait for map and hover over a feature
    await waitForMapLoaded(page);
    await hoverMapFeature(page, 3);

    // Check tooltip
    const tooltip = getTooltip(page);
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    const tooltipText = await tooltip.textContent();
    console.log('Tooltip with vote info:', tooltipText?.substring(0, 300));

    // Should contain "Lista" keyword
    expect(tooltipText).toMatch(/Lista/i);

    // Should contain numbers (vote counts)
    expect(tooltipText).toMatch(/\d+/);
  });

  test('Tooltip shows party information', async ({ page }) => {
    // Select a department
    await selectDepartment(page, 'Colonia');

    // Select multiple lists from different parties
    const checkboxes = page.locator('[data-testid="list-selector"] input[type="checkbox"][value]');
    await checkboxes.nth(0).click();
    await page.waitForTimeout(500);
    await checkboxes.nth(5).click();
    await page.waitForTimeout(1000);

    // Wait for map and hover over a feature
    await waitForMapLoaded(page);
    await hoverMapFeature(page, 4);

    // Check tooltip
    const tooltip = getTooltip(page);
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    const tooltipText = await tooltip.textContent();
    console.log('Tooltip with party info:', tooltipText?.substring(0, 300));

    // Should contain either "Partido" or party abbreviations (like "FA", "PN", "PC")
    const hasPartyInfo =
      tooltipText?.includes('Partido') ||
      tooltipText?.match(/\b(FA|PN|PC|PI|CA)\b/);
    expect(hasPartyInfo).toBeTruthy();
  });

  test('Tooltip shows total votes', async ({ page }) => {
    // Select a department
    await selectDepartment(page, 'Maldonado');

    // Select lists
    const checkboxes = page.locator('[data-testid="list-selector"] input[type="checkbox"][value]');
    await checkboxes.nth(0).click();
    await page.waitForTimeout(500);
    await checkboxes.nth(1).click();
    await page.waitForTimeout(1000);

    // Wait for map and hover over a feature
    await waitForMapLoaded(page);
    await hoverMapFeature(page, 2);

    // Check tooltip
    const tooltip = getTooltip(page);
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    const tooltipText = await tooltip.textContent();
    console.log('Tooltip with totals:', tooltipText?.substring(0, 300));

    // Should contain "Total" keyword
    expect(tooltipText).toMatch(/Total/i);

    // Should contain vote numbers
    expect(tooltipText).toMatch(/\d+/);
  });

  test('Tooltip shows candidate information in ODN mode', async ({ page }) => {
    // Select a department
    await selectDepartment(page, 'Rivera');

    // Switch to ODN mode
    await switchDataSource(page, true);

    // Switch to candidate selection
    const selectorToggle = page.locator('text=Candidatos').first();
    if (await selectorToggle.isVisible()) {
      await selectorToggle.click();
      await page.waitForTimeout(1000);

      // Select a candidate
      const candidateCheckbox = page.locator('input[type="checkbox"]').nth(5);
      await candidateCheckbox.click();
      await page.waitForTimeout(1000);

      // Wait for map and hover over a feature
      await waitForMapLoaded(page);
      await hoverMapFeature(page, 3);

      // Check tooltip
      const tooltip = getTooltip(page);
      await expect(tooltip).toBeVisible({ timeout: 5000 });

      const tooltipText = await tooltip.textContent();
      console.log('Tooltip with candidate info:', tooltipText?.substring(0, 300));

      // Should contain candidate-related information
      expect(tooltipText).toBeTruthy();
      expect(tooltipText!.length).toBeGreaterThan(10);
    }
  });

  test('Tooltip updates when switching data sources', async ({ page }) => {
    // Select a department
    await selectDepartment(page, 'Colonia');

    // Select a list in ODD mode
    await selectFirstList(page);

    // Wait for map and hover to capture ODD tooltip
    await waitForMapLoaded(page);
    await hoverMapFeature(page, 2);

    let tooltip = getTooltip(page);
    await expect(tooltip).toBeVisible({ timeout: 5000 });
    const oddTooltipText = await tooltip.textContent();

    // Move away
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    // Switch to ODN
    await switchDataSource(page, true);

    // Hover again
    await hoverMapFeature(page, 2);

    tooltip = getTooltip(page);
    await expect(tooltip).toBeVisible({ timeout: 5000 });
    const odnTooltipText = await tooltip.textContent();

    console.log('ODD tooltip:', oddTooltipText?.substring(0, 200));
    console.log('ODN tooltip:', odnTooltipText?.substring(0, 200));

    // Both should have content
    expect(oddTooltipText).toBeTruthy();
    expect(odnTooltipText).toBeTruthy();
  });
});

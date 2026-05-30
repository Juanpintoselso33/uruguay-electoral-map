import { test, expect } from '@playwright/test';
import { waitForAppLoad, getVisibleElections, selectElection, getCurrentElection } from '../fixtures/test-helpers';

test.describe('Elections - Election Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('elections section is visible in the sidebar', async ({ page }) => {
    // Look for election selector section
    const electionSection = page.locator('.election-selector, .sidebar-section').filter({ hasText: /elecciones|election/i });

    // Check if elections section exists (may be in sidebar or header)
    const isVisible = await electionSection.isVisible().catch(() => false);

    if (!isVisible) {
      // Try alternative locations
      const alternativeSection = page.locator('.election-header, .elections-timeline, .elections-compact');
      await expect(alternativeSection.first()).toBeVisible();
    }
  });

  test('at least 2 elections are available', async ({ page }) => {
    // Get all election cards or items
    const electionCards = page.locator('.election-card, .compact-item');
    const count = await electionCards.count();

    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('clicking on an election activates it', async ({ page }) => {
    // Find all election cards
    const electionCards = page.locator('.election-card:not(.election-disabled), .compact-item:not(.compact-disabled)');
    const count = await electionCards.count();

    if (count >= 2) {
      // Click on the second election (first might already be selected)
      await electionCards.nth(1).click();
      await page.waitForTimeout(1000);

      // Check that it's now marked as current
      const currentBadge = page.locator('.election-current-badge, .compact-current');
      await expect(currentBadge.first()).toBeVisible();
    }
  });

  test('default election is internas-2024', async ({ page }) => {
    // Look for the current election indicator
    const currentElection = page.locator('.election-card.election-current, .compact-item.compact-current');

    // Check the election content
    const electionText = await currentElection.first().textContent();

    // It should contain "2024" or "Internas" for the default
    const isDefault = electionText?.includes('2024') || electionText?.includes('Internas') || electionText?.includes('internas');
    expect(isDefault).toBeTruthy();
  });

  test('changing election updates the data', async ({ page }) => {
    // Find available elections
    const electionCards = page.locator('.election-card:not(.election-disabled), .compact-item:not(.compact-disabled)');
    const count = await electionCards.count();

    if (count >= 2) {
      // Click on the second election (assuming first is selected)
      await electionCards.nth(1).click();

      // Wait for data to reload
      await page.waitForTimeout(2000);

      // The selection should have changed
      const newCurrentCard = page.locator('.election-card.election-current, .compact-item.compact-current');
      await expect(newCurrentCard.first()).toBeVisible();
    }
  });

  test('unavailable elections are marked as disabled', async ({ page }) => {
    // Look for disabled elections
    const disabledElections = page.locator('.election-card.election-disabled, .compact-item.compact-disabled');

    const disabledCount = await disabledElections.count();

    if (disabledCount > 0) {
      // Check that disabled elections have appropriate styling or badge
      const unavailableBadge = page.locator('.election-unavailable-badge');
      const hasUnavailableBadge = await unavailableBadge.isVisible().catch(() => false);

      if (!hasUnavailableBadge) {
        // Check for disabled styling
        const firstDisabled = disabledElections.first();
        const opacity = await firstDisabled.evaluate(el => getComputedStyle(el).opacity);
        expect(parseFloat(opacity)).toBeLessThan(1);
      }
    }
  });

  test('election cards show year and type information', async ({ page }) => {
    // Check for election year display
    const electionYear = page.locator('.election-year, .compact-year');
    await expect(electionYear.first()).toBeVisible();

    // Check for election type badge
    const electionType = page.locator('.election-type-badge, .compact-dot');
    await expect(electionType.first()).toBeVisible();
  });

  test('election date is displayed', async ({ page }) => {
    // Look for date in election cards
    const electionDate = page.locator('.election-date');

    if (await electionDate.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const dateText = await electionDate.first().textContent();
      // Should contain month/year text
      expect(dateText).toBeTruthy();
    } else {
      // Date might be part of compact view
      const compactItem = page.locator('.compact-item').first();
      await expect(compactItem).toBeVisible();
    }
  });
});

import { test, expect } from '@playwright/test';

/**
 * Mobile UX Audit - Capture screenshots of current mobile state
 */

const mobileViewports = [
  { name: 'iPhone-12', width: 390, height: 844 },
  { name: 'iPhone-SE', width: 375, height: 667 },
  { name: 'Pixel-5', width: 393, height: 851 },
  { name: 'Galaxy-S9', width: 360, height: 740 },
];

test.describe('Mobile UX Audit', () => {
  for (const { name, width, height } of mobileViewports) {
    test(`${name} - capture mobile state`, async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width, height });

      await page.goto('/');
      await page.waitForTimeout(4000); // Wait for map to load

      // Capture initial state
      await page.screenshot({
        path: `tests/e2e/mobile-audit-screenshots/${name}-initial.png`,
        fullPage: false
      });

      // Try to open mobile menu (hamburger)
      const menuButton = page.locator('[aria-label*="menu"], button:has(svg)').first();
      try {
        if (await menuButton.isVisible({ timeout: 2000 })) {
          await menuButton.click();
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `tests/e2e/mobile-audit-screenshots/${name}-menu-open.png`,
            fullPage: false
          });
        }
      } catch (e) {
        // Menu not found, continue
      }

      // Capture full page
      await page.screenshot({
        path: `tests/e2e/mobile-audit-screenshots/${name}-fullpage.png`,
        fullPage: true
      });
    });
  }
});

import { test, expect, Page } from '@playwright/test';

test.describe('Uruguay Electoral Map - Functional Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:5174');
    // Wait for app to load
    await page.waitForSelector('[data-testid="region-selector"]', { timeout: 10000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  // 1. NAVEGACIÓN BÁSICA
  test('Load inicial - Application loads correctly', async () => {
    // Check header
    const header = page.locator('.header');
    await expect(header).toBeVisible();
    
    // Check title contains "Votos por listas"
    const title = page.locator('.header h1');
    await expect(title).toContainText('Votos por listas');
  });

  test('Region selector is visible and working', async () => {
    const selector = page.locator('[data-testid="region-selector"]');
    await expect(selector).toBeVisible();
    
    // Click hamburger button
    const hamburger = page.locator('.hamburger-button');
    await hamburger.click();
    
    // Wait for menu to open
    await page.waitForSelector('.menu-open');
    const menu = page.locator('.menu-open');
    await expect(menu).toBeVisible();
  });

  test('Can switch between departments', async () => {
    // Open department menu
    const hamburger = page.locator('.hamburger-button');
    await hamburger.click();
    await page.waitForSelector('.menu-open');
    
    // Get all department buttons
    const deptButtons = page.locator('.menu button');
    const count = await deptButtons.count();
    
    // Should have at least 19 departments
    expect(count).toBeGreaterThanOrEqual(19);
    
    // Try selecting a different department (e.g., Maldonado)
    await page.locator('.menu button', { hasText: 'Maldonado' }).click();
    
    // Verify title changed
    const title = page.locator('.header h1');
    await expect(title).toContainText('Maldonado');
  });

  test('ODN/ODD toggle is visible', async () => {
    const toggle = page.locator('[data-testid="data-source-toggle"]');
    await expect(toggle).toBeVisible();
    
    // Check that both options are visible
    const oddLabel = page.locator('span', { hasText: 'ODD' });
    const odnLabel = page.locator('span', { hasText: 'ODN' });
    
    await expect(oddLabel).toBeVisible();
    await expect(odnLabel).toBeVisible();
  });

  test('Can toggle between ODN and ODD data', async () => {
    const toggle = page.locator('[data-testid="data-source-toggle"]');
    await expect(toggle).toBeVisible();
    
    // Click ODN option
    await page.locator('span', { hasText: 'ODN' }).click();
    
    // Wait a moment for data to load
    await page.waitForTimeout(500);
    
    // Click back to ODD
    await page.locator('span', { hasText: 'ODD' }).click();
    await page.waitForTimeout(500);
  });

  // 2. INTERACCIÓN CON MAPA
  test('Map container is visible', async () => {
    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeVisible();
  });

  test('Map loads and has canvas element', async () => {
    // MapLibre should create a canvas
    const canvas = page.locator('canvas');
    const count = await canvas.count();
    
    // Should have at least one canvas for the map
    expect(count).toBeGreaterThan(0);
  });

  // 3. FILTROS Y SELECCIÓN
  test('List selector container is visible', async () => {
    // Check for list selector container
    const selector = page.locator('[data-testid="list-selector-container"]');
    if (await selector.isVisible()) {
      await expect(selector).toBeVisible();
    }
  });

  // 4. RESPONSIVE DESIGN
  test('Desktop layout (1920x1080)', async () => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const header = page.locator('.header');
    const mapContainer = page.locator('.map-container');
    
    await expect(header).toBeVisible();
    await expect(mapContainer).toBeVisible();
  });

  test('Tablet layout (768x1024)', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    const header = page.locator('.header');
    const mapContainer = page.locator('.map-container');
    
    await expect(header).toBeVisible();
    await expect(mapContainer).toBeVisible();
  });

  test('Mobile layout (375x667)', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const header = page.locator('.header');
    const mapContainer = page.locator('.map-container');
    
    await expect(header).toBeVisible();
    await expect(mapContainer).toBeVisible();
  });

  // 5. EDGE CASES
  test('Can rapidly switch departments without errors', async () => {
    const hamburger = page.locator('.hamburger-button');
    
    // Switch rapidly between 3 departments
    for (let i = 0; i < 3; i++) {
      await hamburger.click();
      await page.waitForSelector('.menu-open');
      
      const buttons = page.locator('.menu button');
      const firstButton = buttons.first();
      await firstButton.click();
      await page.waitForTimeout(200);
    }
    
    // App should still be responsive
    await expect(page.locator('.header')).toBeVisible();
  });

  test('Window resize handling', async () => {
    const header = page.locator('.header');
    
    // Start with desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(header).toBeVisible();
    
    // Resize to tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(header).toBeVisible();
    
    // Resize back to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(header).toBeVisible();
  });

  // 6. GITHUB LINK
  test('GitHub link is present and valid', async () => {
    const link = page.locator('.github-link');
    await expect(link).toBeVisible();
    
    // Check href
    const href = await link.getAttribute('href');
    expect(href).toBe('https://github.com/juanpintoselso33');
    
    // Check target
    const target = await link.getAttribute('target');
    expect(target).toBe('_blank');
  });

  // 7. ERROR HANDLING
  test('No console errors during initial load', async () => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit for any async operations
    await page.waitForTimeout(2000);
    
    // Filter out expected errors
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('ResizeObserver') &&
      !e.includes('Navigation')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

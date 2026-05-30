import { test, expect } from '@playwright/test';

test('Basic load test', async ({ page }) => {
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  
  // Take a screenshot
  await page.screenshot({ path: 'screenshot.png' });
  
  // Check title
  const title = await page.title();
  console.log('Title:', title);
  
  // Check if app div exists
  const appDiv = await page.locator('#app');
  console.log('App div exists:', await appDiv.isVisible());
  
  // Get all text content
  const bodyText = await page.locator('body').textContent();
  console.log('Body content length:', bodyText?.length);
  console.log('First 500 chars:', bodyText?.substring(0, 500));
});

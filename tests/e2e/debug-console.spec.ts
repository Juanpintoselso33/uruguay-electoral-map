import { test } from '@playwright/test';

test('debug - capture console errors', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const logs: string[] = [];
  const networkErrors: string[] = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
    } else if (msg.type() === 'warning') {
      warnings.push(text);
    } else {
      logs.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });

  // Capture network failures
  page.on('requestfailed', request => {
    networkErrors.push(`Failed: ${request.url()} - ${request.failure()?.errorText}`);
  });

  // Navigate to the app
  await page.goto('http://localhost:5173');

  // Wait for initial load
  await page.waitForTimeout(5000);

  // Print all captured messages
  console.log('\n=== ERRORS ===');
  if (errors.length === 0) {
    console.log('No errors');
  } else {
    errors.forEach(err => console.log(err));
  }

  console.log('\n=== NETWORK ERRORS ===');
  if (networkErrors.length === 0) {
    console.log('No network errors');
  } else {
    networkErrors.forEach(err => console.log(err));
  }

  console.log('\n=== WARNINGS ===');
  if (warnings.length === 0) {
    console.log('No warnings');
  } else {
    warnings.forEach(warn => console.log(warn));
  }

  console.log('\n=== RECENT LOGS (last 20) ===');
  logs.slice(-20).forEach(log => console.log(log));
});

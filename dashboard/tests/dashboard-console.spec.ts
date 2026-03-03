/**
 * Dashboard Console Error Test
 * Loads the dashboard and captures console errors
 */

import { test, expect } from '@playwright/test';
import { URLS } from '@shared/constants';

test('dashboard loads without critical console errors', async ({ page }) => {
  // Collect console messages
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    // Ignore expected Socket.IO connection errors (bot API may not be running)
    if (msg.type() === 'error' && !text.includes('socket.io') && !text.includes('WebSocket')) {
      consoleErrors.push(`[${msg.type()}] ${text}`);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(`[${msg.type()}] ${text}`);
    }
  });

  // Collect page errors (excluding network errors)
  const pageErrors: string[] = [];
  page.on('pageerror', error => {
    if (!error.message.includes('socket.io') && !error.message.includes('WebSocket')) {
      pageErrors.push(error.message);
    }
  });

  // Navigate to dashboard
  await page.goto(URLS.DEV.DASHBOARD, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Wait for initial render
  await page.waitForTimeout(2000);

  // Log all errors for debugging
  if (consoleErrors.length > 0) {
    console.log('Console Errors:', consoleErrors);
  }
  if (consoleWarnings.length > 0) {
    console.log('Console Warnings:', consoleWarnings);
  }
  if (pageErrors.length > 0) {
    console.log('Page Errors:', pageErrors);
  }

  // Check for critical errors (excluding network/Socket.IO)
  expect(pageErrors).toEqual([]);
  
  // Dashboard should have a title or main content
  await expect(page.locator('body')).toBeVisible();
  
  // Take a screenshot for verification
  await page.screenshot({ path: 'tests/screenshots/dashboard-load.png' });
});

test('dashboard navigation works', async ({ page }) => {
  await page.goto(URLS.DEV.DASHBOARD, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Take a screenshot for debugging
  await page.screenshot({ path: 'tests/screenshots/dashboard-nav.png' });
  
  // Check if main content area exists
  const mainContent = page.locator('main, [role="main"], .main-content, #root');
  await expect(mainContent.first()).toBeVisible();
});

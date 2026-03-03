import { test, expect } from '../fixtures/test';

/**
 * Smoke tests - Basic sanity checks
 * Run these to quickly verify the setup is working
 */

test.describe('Smoke Tests', () => {
  test('should have Playwright working', async ({ page }) => {
    // This is a simple test to verify Playwright is configured correctly
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Verify the root element exists
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('should load page title', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Check that the page has a title (from document.title)
    const title = await page.title();
    expect(title).toBeDefined();
  });

  test('should not have console errors on load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Allow some time for any console errors to appear
    await page.waitForTimeout(1000);
    
    // Note: This assertion may fail if the dev server isn't running
    // or if there are legitimate console errors
    expect(errors.length).toBe(0);
  });
});

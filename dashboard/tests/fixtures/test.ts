import { test as base, expect } from '@playwright/test';

/**
 * Base test fixture with common configurations and utilities
 */

// Define your own typed fixture.
type Fixtures = {
  /**
   * Custom fixture for authenticated page
   */
  authenticatedPage: any;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Setup: Navigate to the dashboard
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // You can add authentication logic here if needed
    // For now, the dashboard doesn't require authentication
    
    await use(page);
  },
});

export { expect };

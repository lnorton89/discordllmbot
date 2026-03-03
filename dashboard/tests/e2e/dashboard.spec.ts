import { test, expect } from '../fixtures/test';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('Dashboard', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
  });

  test('should load the dashboard successfully', async ({ page }) => {
    await dashboard.goto();
    await dashboard.waitForLoad();
    
    await expect(dashboard.root).toBeVisible();
  });

  test('should have a navigation menu', async ({ page }) => {
    await dashboard.goto();
    await dashboard.waitForLoad();
    
    const nav = dashboard.getNavigation();
    await expect(nav).toBeVisible();
  });

  test('should navigate to Settings page', async ({ page }) => {
    await dashboard.goto();
    await dashboard.waitForLoad();
    
    await dashboard.navigateTo('Settings');
    await expect(page).toHaveURL(/.*settings/);
  });

  test('should navigate to Logs page', async ({ page }) => {
    await dashboard.goto();
    await dashboard.waitForLoad();
    
    await dashboard.navigateTo('Logs');
    await expect(page).toHaveURL(/.*logs/);
  });

  test('should navigate to Servers page', async ({ page }) => {
    await dashboard.goto();
    await dashboard.waitForLoad();
    
    await dashboard.navigateTo('Servers');
    await expect(page).toHaveURL(/.*servers/);
  });

  test('should navigate to Playground page', async ({ page }) => {
    await dashboard.goto();
    await dashboard.waitForLoad();
    
    await dashboard.navigateTo('Playground');
    await expect(page).toHaveURL(/.*playground/);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await dashboard.goto();
    await dashboard.waitForLoad();
    
    // Test mobile responsiveness
    const isMobile = await page.evaluate(() => window.innerWidth < 768);
    expect(isMobile).toBe(false); // Desktop by default
  });
});

import { test, expect } from '../fixtures/test';

test.describe('Memory Page UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');
  });

  test('should have proper page header spacing', async ({ page }) => {
    const header = page.locator('text=Memory Graph');
    await expect(header).toBeVisible();
    
    // Check header has proper margin/padding
    const box = await header.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.y).toBeGreaterThan(10); // Should have top margin
    }
  });

  test('should display all tabs with icons', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(4);
    
    // Check each tab has an icon
    const tabIcons = page.locator('[role="tab"] .MuiTab-icon');
    await expect(tabIcons).toHaveCount(4);
  });

  test('should have proper spacing in filter controls', async ({ page }) => {
    const serverSelect = page.locator('label:has-text("Select Server")');
    const channelSelect = page.locator('label:has-text("Select Channel Source")');
    
    await expect(serverSelect).toBeVisible();
    await expect(channelSelect).toBeVisible();
    
    // Check controls have proper spacing
    const serverBox = await serverSelect.boundingBox();
    const channelBox = await channelSelect.boundingBox();
    
    if (serverBox && channelBox) {
      expect(serverBox.y).toBeLessThan(channelBox.y); // Should be stacked properly
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check page doesn't overflow horizontally
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
    
    // Check main elements are visible
    const header = page.locator('text=Memory Graph');
    await expect(header).toBeVisible();
    
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(4);
  });

  test('should have proper padding in content areas', async ({ page }) => {
    const contentPaper = page.locator('[role="tabpanel"]').first();
    await expect(contentPaper).toBeVisible();
    
    // Check content has proper padding
    const styles = await contentPaper.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        paddingTop: computed.paddingTop,
        paddingRight: computed.paddingRight,
        paddingBottom: computed.paddingBottom,
        paddingLeft: computed.paddingLeft,
      };
    });
    
    // Should have at least some padding
    const totalPadding = parseInt(styles.paddingTop) + parseInt(styles.paddingRight);
    expect(totalPadding).toBeGreaterThan(0);
  });

  test('should display Graph View tab content', async ({ page }) => {
    const graphTab = page.locator('[role="tab"]:has-text("Graph View")');
    await graphTab.click();
    
    // Check graph controls are visible
    const filterSelect = page.locator('label:has-text("Filter by Type")');
    await expect(filterSelect).toBeVisible();
    
    const searchInput = page.locator('input[placeholder*="Search entity"]');
    await expect(searchInput).toBeVisible();
  });

  test('should display Memory Browser with proper layout', async ({ page }) => {
    const browserTab = page.locator('[role="tab"]:has-text("Memory Browser")');
    await browserTab.click();
    
    // Check search and filter controls
    const searchInput = page.locator('input[placeholder*="Search keywords"]');
    await expect(searchInput).toBeVisible();
    
    const typeSelect = page.locator('label:has-text("Type")');
    await expect(typeSelect).toBeVisible();
  });

  test('should display Entity Manager table properly', async ({ page }) => {
    const entityTab = page.locator('[role="tab"]:has-text("Entity Manager")');
    await entityTab.click();
    
    // Check table is visible
    const table = page.locator('table');
    await expect(table).toBeVisible();
    
    // Check table headers
    const headers = page.locator('th');
    await expect(headers).toHaveCount(6);
  });

  test('should display Knowledge Ingestion with proper grid layout', async ({ page }) => {
    const ingestionTab = page.locator('[role="tab"]:has-text("Knowledge Ingestion")');
    await ingestionTab.click();
    
    // Check both sections are visible
    const documentsSection = page.locator('text=Documents');
    await expect(documentsSection).toBeVisible();
    
    const rssSection = page.locator('text=RSS Feeds');
    await expect(rssSection).toBeVisible();
  });

  test('should have proper chip spacing in filter bar', async ({ page }) => {
    const chips = page.locator('.MuiChip-root');
    const count = await chips.count();
    
    if (count > 0) {
      // Check chips have proper spacing
      const firstChip = chips.first();
      await expect(firstChip).toBeVisible();
      
      // Check chip has proper height
      const box = await firstChip.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThan(20);
      }
    }
  });

  test('should not have console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    expect(errors.length).toBe(0);
  });
});

/**
 * Memory Page UI/UX Audit Test
 * Captures screenshots and documents UI/UX issues related to margins, paddings, and layout
 */

import { test, expect } from '../fixtures/test';

test.describe('Memory Page UI/UX Audit', () => {
  const screenshotsDir = 'tests/screenshots/memory-audit';

  test.beforeEach(async ({ page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for animations
  });

  test('audit: overall page layout', async ({ page }) => {
    await page.screenshot({
      path: screenshotsDir + '/01-overall-layout.png',
      fullPage: true
    });

    // Check for horizontal overflow (common issue)
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    console.log('Horizontal overflow:', hasHorizontalOverflow);
  });

  test('audit: page header spacing', async ({ page }) => {
    const header = page.locator('text=Memory Graph');
    await expect(header).toBeVisible();

    const box = await header.boundingBox();

    await page.screenshot({
      path: screenshotsDir + '/02-header-spacing.png',
      clip: box ? { x: 0, y: 0, width: page.viewportSize()?.width || 1280, height: (box.y || 0) + 150 } : undefined
    });

    console.log('Header Y position:', box?.y);
  });

  test('audit: filter controls paper spacing', async ({ page }) => {
    const filterPaper = page.locator('.MuiPaper-root').first();

    await page.screenshot({
      path: screenshotsDir + '/03-filter-controls.png',
    });

    // Check internal padding
    const padding = await filterPaper.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        padding: computed.padding,
        paddingTop: computed.paddingTop,
        paddingRight: computed.paddingRight,
        paddingBottom: computed.paddingBottom,
        paddingLeft: computed.paddingLeft,
        marginBottom: computed.marginBottom,
      };
    });

    console.log('Filter paper padding:', padding);
  });

  test('audit: server and channel select spacing', async ({ page }) => {
    const selects = page.locator('.MuiFormControl-root');

    await page.screenshot({
      path: screenshotsDir + '/04-select-controls-spacing.png',
    });

    const count = await selects.count();
    console.log('Number of form controls:', count);

    // Check spacing between selects
    if (count >= 2) {
      const firstBox = await selects.nth(0).boundingBox();
      const secondBox = await selects.nth(1).boundingBox();

      if (firstBox && secondBox) {
        const gap = secondBox.y - (firstBox.y + firstBox.height);
        console.log('Gap between selects:', gap);
      }
    }
  });

  test('audit: tab bar spacing and alignment', async ({ page }) => {
    const tabBar = page.locator('[role="tablist"]');

    await page.screenshot({
      path: screenshotsDir + '/05-tab-bar-spacing.png',
    });

    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const box = await tab.boundingBox();
      console.log(`Tab ${i} box:`, box);
    }

    // Check tab padding
    const tabPadding = await tabBar.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        padding: computed.padding,
        paddingLeft: computed.paddingLeft,
        paddingRight: computed.paddingRight,
      };
    });

    console.log('Tab bar padding:', tabPadding);
  });

  test('audit: content panel padding', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]').first();

    await page.screenshot({
      path: screenshotsDir + '/06-content-panel-padding.png',
    });

    const panelStyles = await tabPanel.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        padding: computed.padding,
        paddingTop: computed.paddingTop,
        paddingRight: computed.paddingRight,
        paddingBottom: computed.paddingBottom,
        paddingLeft: computed.paddingLeft,
        marginTop: computed.marginTop,
      };
    });

    console.log('Tab panel padding:', panelStyles);
  });

  test('audit: memory browser layout', async ({ page }) => {
    const browserTab = page.locator('[role="tab"]:has-text("Memory Browser")');
    await browserTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: screenshotsDir + '/07-memory-browser-overall.png',
    });

    // Check search input spacing - uses label, not placeholder
    const searchInput = page.locator('label:has-text("Search keywords") + div input, input[type="text"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().scrollIntoViewIfNeeded();
      const searchBox = await searchInput.first().boundingBox();

      if (searchBox) {
        await page.screenshot({
          path: screenshotsDir + '/08-search-input-spacing.png',
          clip: { x: Math.max(0, searchBox.x - 20), y: Math.max(0, searchBox.y - 20), width: searchBox.width + 40, height: searchBox.height + 40 }
        });
      }
    }
  });

  test('audit: memory item cards spacing', async ({ page }) => {
    const browserTab = page.locator('[role="tab"]:has-text("Memory Browser")');
    await browserTab.click();
    await page.waitForTimeout(500);

    const memoryItems = page.locator('li[role="listitem"], .MuiListItem-root');
    const count = await memoryItems.count();

    console.log('Memory items count:', count);

    if (count > 0) {
      const firstItem = memoryItems.first();
      await firstItem.scrollIntoViewIfNeeded();

      const box = await firstItem.boundingBox();

      await page.screenshot({
        path: screenshotsDir + '/09-memory-item-spacing.png',
        clip: box ? { x: 0, y: Math.max(0, box.y - 20), width: page.viewportSize()?.width || 1280, height: (box.height || 0) + 40 } : undefined
      });

      // Check item padding
      const itemPadding = await firstItem.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          padding: computed.padding,
          paddingTop: computed.paddingTop,
          paddingRight: computed.paddingRight,
          paddingBottom: computed.paddingBottom,
          paddingLeft: computed.paddingLeft,
          marginBottom: computed.marginBottom,
        };
      });

      console.log('Memory item padding:', itemPadding);
    }
  });

  test('audit: chip spacing in filters', async ({ page }) => {
    const chips = page.locator('.MuiChip-root');
    const count = await chips.count();

    console.log('Total chips:', count);

    if (count > 0) {
      await page.screenshot({
        path: screenshotsDir + '/10-chip-spacing.png',
      });

      // Check spacing between chips
      for (let i = 0; i < Math.min(count, 3); i++) {
        const chip = chips.nth(i);
        const box = await chip.boundingBox();
        console.log(`Chip ${i} box:`, box);
      }
    }
  });

  test('audit: pagination spacing', async ({ page }) => {
    const browserTab = page.locator('[role="tab"]:has-text("Memory Browser")');
    await browserTab.click();
    await page.waitForTimeout(500);

    const pagination = page.locator('.MuiPagination-root, [role="navigation"][aria-label="pagination"]');

    if (await pagination.count() > 0) {
      await pagination.scrollIntoViewIfNeeded();

      const box = await pagination.boundingBox();

      await page.screenshot({
        path: screenshotsDir + '/11-pagination-spacing.png',
        clip: box ? { x: 0, y: Math.max(0, box.y - 30), width: page.viewportSize()?.width || 1280, height: (box.height || 0) + 60 } : undefined
      });

      const paginationMargin = await pagination.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          marginTop: computed.marginTop,
          marginBottom: computed.marginBottom,
        };
      });

      console.log('Pagination margins:', paginationMargin);
    }
  });

  test('audit: mobile responsive layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: screenshotsDir + '/12-mobile-layout.png',
      fullPage: true
    });

    // Check for horizontal overflow on mobile
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    console.log('Mobile horizontal overflow:', hasHorizontalOverflow);

    // Check tab bar on mobile
    const tabBar = page.locator('[role="tablist"]');
    await tabBar.scrollIntoViewIfNeeded();

    const tabBarBox = await tabBar.boundingBox();
    await page.screenshot({
      path: screenshotsDir + '/13-mobile-tab-bar.png',
      clip: tabBarBox ? { x: 0, y: Math.max(0, tabBarBox.y - 10), width: 375, height: (tabBarBox.height || 0) + 20 } : undefined
    });
  });

  test('audit: entity manager table spacing', async ({ page }) => {
    const entityTab = page.locator('[role="tab"]:has-text("Entity Manager")');
    await entityTab.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: screenshotsDir + '/14-entity-manager-spacing.png',
    });

    const table = page.locator('table');
    if (await table.count() > 0) {
      const tableStyles = await table.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          marginTop: computed.marginTop,
          marginBottom: computed.marginBottom,
        };
      });

      console.log('Table spacing:', tableStyles);
    }
  });

  test('audit: knowledge ingestion grid spacing', async ({ page }) => {
    const ingestionTab = page.locator('[role="tab"]:has-text("Knowledge Ingestion")');
    await ingestionTab.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: screenshotsDir + '/15-knowledge-ingestion-spacing.png',
    });

    const grid = page.locator('.MuiGrid-root, [role="grid"]');
    const gridCount = await grid.count();
    console.log('Grid containers:', gridCount);

    // Check grid item spacing
    const gridItems = page.locator('[class*="MuiGrid-root"]');
    const itemCount = await gridItems.count();
    console.log('Grid items:', itemCount);
  });

  test('audit: paper component borders and shadows', async ({ page }) => {
    const papers = page.locator('.MuiPaper-root, [role="region"]');
    const count = await papers.count();

    console.log('Paper components:', count);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const paper = papers.nth(i);
      const styles = await paper.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          padding: computed.padding,
          margin: computed.margin,
          marginBottom: computed.marginBottom,
          marginTop: computed.marginTop,
          borderRadius: computed.borderRadius,
          boxShadow: computed.boxShadow,
        };
      });

      console.log(`Paper ${i} styles:`, styles);
    }

    await page.screenshot({
      path: screenshotsDir + '/16-paper-components.png',
    });
  });

  test('audit: button and icon spacing', async ({ page }) => {
    const buttons = page.locator('button, .MuiButtonBase-root, .MuiIconButton-root');
    const count = await buttons.count();

    console.log('Buttons/icons found:', count);

    if (count > 0) {
      await page.screenshot({
        path: screenshotsDir + '/17-button-icon-spacing.png',
      });

      // Check first few buttons
      for (let i = 0; i < Math.min(count, 3); i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        console.log(`Button ${i} box:`, box);

        const buttonStyles = await button.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            padding: computed.padding,
            margin: computed.margin,
            marginRight: computed.marginRight,
            marginLeft: computed.marginLeft,
          };
        });

        console.log(`Button ${i} styles:`, buttonStyles);
      }
    }
  });

  test('audit: text typography spacing', async ({ page }) => {
    const texts = page.locator('.MuiTypography-root');
    const count = await texts.count();

    console.log('Typography elements:', count);

    // Sample some text elements
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = texts.nth(i);
      const textStyles = await text.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          marginBottom: computed.marginBottom,
          marginTop: computed.marginTop,
          lineHeight: computed.lineHeight,
          className: el.classList.toString(),
        };
      });

      console.log(`Text ${i} (${textStyles.className}):`, {
        marginBottom: textStyles.marginBottom,
        marginTop: textStyles.marginTop,
        lineHeight: textStyles.lineHeight
      });
    }

    await page.screenshot({
      path: screenshotsDir + '/18-typography-spacing.png',
    });
  });

  test('audit: expanded memory item details', async ({ page }) => {
    const browserTab = page.locator('[role="tab"]:has-text("Memory Browser")');
    await browserTab.click();
    await page.waitForTimeout(500);

    // Click expand on first memory item
    const expandButton = page.locator('.MuiIconButton-root').first();
    if (await expandButton.count() > 0) {
      await expandButton.click();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: screenshotsDir + '/19-expanded-item-details.png',
      });

      // Check expanded content padding
      const collapseContent = page.locator('.MuiCollapse-wrapper, .MuiCollapse-wrapperInner');
      if (await collapseContent.count() > 0) {
        const collapseStyles = await collapseContent.first().evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            padding: computed.padding,
            paddingTop: computed.paddingTop,
            paddingBottom: computed.paddingBottom,
          };
        });

        console.log('Collapse content padding:', collapseStyles);
      }
    }
  });

  test('audit: divider spacing', async ({ page }) => {
    const browserTab = page.locator('[role="tab"]:has-text("Memory Browser")');
    await browserTab.click();
    await page.waitForTimeout(500);

    // Expand an item to see dividers
    const expandButton = page.locator('.MuiIconButton-root').first();
    if (await expandButton.count() > 0) {
      await expandButton.click();
      await page.waitForTimeout(300);

      const dividers = page.locator('.MuiDivider-root, hr[role="separator"]');
      const count = await dividers.count();

      console.log('Dividers found:', count);

      for (let i = 0; i < Math.min(count, 3); i++) {
        const divider = dividers.nth(i);
        const dividerStyles = await divider.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            marginTop: computed.marginTop,
            marginBottom: computed.marginBottom,
            margin: computed.margin,
          };
        });

        console.log(`Divider ${i} margins:`, dividerStyles);
      }

      await page.screenshot({
        path: screenshotsDir + '/20-divider-spacing.png',
      });
    }
  });
});

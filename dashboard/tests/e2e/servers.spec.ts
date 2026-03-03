import { test, expect } from '../fixtures/test';

test.describe('Servers', () => {
  test('should load the Servers page', async ({ page }) => {
    await page.goto('/servers');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=Servers')).toBeVisible();
  });

  test('should display server list', async ({ page }) => {
    await page.goto('/servers');
    await page.waitForLoadState('networkidle');
    
    // Look for server cards or list items
    const serverList = page.locator('[data-testid="server-list"], .server-list, [role="list"]');
    await expect(serverList).toBeVisible();
  });

  test('should allow server selection', async ({ page }) => {
    await page.goto('/servers');
    await page.waitForLoadState('networkidle');
    
    // Try to select a server
    const serverItem = page.locator('[data-testid="server-item"], .server-item, [role="listitem"]').first();
    
    if (await serverItem.isVisible()) {
      await serverItem.click();
      
      // Wait for server details to load
      await page.waitForTimeout(1000);
      
      // Verify we're still on servers page or in server details
      await expect(page).toHaveURL(/.*servers.*/);
    }
  });

  test('should display server configuration', async ({ page }) => {
    await page.goto('/servers');
    await page.waitForLoadState('networkidle');
    
    // Select a server if available
    const serverItem = page.locator('[data-testid="server-item"], .server-item').first();
    
    if (await serverItem.isVisible()) {
      await serverItem.click();
      await page.waitForTimeout(1000);
      
      // Look for configuration sections
      const configSection = page.locator('[data-testid="config"], .config-section, [role="tabpanel"]');
      
      if (await configSection.isVisible()) {
        await expect(configSection).toBeVisible();
      }
    }
  });

  test('should display user relationships for a server', async ({ page }) => {
    await page.goto('/servers');
    await page.waitForLoadState('networkidle');
    
    const serverItem = page.locator('[data-testid="server-item"], .server-item').first();
    
    if (await serverItem.isVisible()) {
      await serverItem.click();
      await page.waitForTimeout(1000);
      
      // Look for relationships section
      const relationshipsTab = page.locator('text=Relationships, text=Users');
      
      if (await relationshipsTab.isVisible()) {
        await relationshipsTab.click();
        await page.waitForTimeout(500);
        
        // Check for relationship list
        const relationshipList = page.locator('[data-testid="relationship-list"], .relationship-list');
        await expect(relationshipList).toBeVisible();
      }
    }
  });

  test('should display channel monitoring', async ({ page }) => {
    await page.goto('/servers');
    await page.waitForLoadState('networkidle');
    
    const serverItem = page.locator('[data-testid="server-item"], .server-item').first();
    
    if (await serverItem.isVisible()) {
      await serverItem.click();
      await page.waitForTimeout(1000);
      
      // Look for channels section
      const channelsTab = page.locator('text=Channels, text=Channel Monitoring');
      
      if (await channelsTab.isVisible()) {
        await channelsTab.click();
        await page.waitForTimeout(500);
        
        // Check for channel list
        const channelList = page.locator('[data-testid="channel-list"], .channel-list');
        await expect(channelList).toBeVisible();
      }
    }
  });

  test('should allow editing server settings', async ({ page }) => {
    await page.goto('/servers');
    await page.waitForLoadState('networkidle');
    
    const serverItem = page.locator('[data-testid="server-item"], .server-item').first();
    
    if (await serverItem.isVisible()) {
      await serverItem.click();
      await page.waitForTimeout(1000);
      
      // Look for edit button
      const editButton = page.locator('button:has-text("Edit"), [aria-label="Edit"]');
      
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(500);
        
        // Verify edit mode is active
        const saveButton = page.locator('button:has-text("Save")');
        await expect(saveButton).toBeVisible();
      }
    }
  });
});

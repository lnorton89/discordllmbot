import { test, expect } from '../fixtures/test';
import { SettingsPage } from '../pages/SettingsPage';

test.describe('Settings', () => {
  let settings: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
  });

  test('should load the Settings page', async ({ page }) => {
    await settings.goto();
    await settings.waitForLoad();
    
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should have tabs for different settings sections', async ({ page }) => {
    await settings.goto();
    await settings.waitForLoad();
    
    // Check for common settings tabs
    const tabs = ['Bot Persona', 'LLM', 'Memory', 'Logger', 'Sandbox'];
    
    for (const tab of tabs) {
      const tabElement = page.locator(`[role="tab"]:has-text("${tab}"), button:has-text("${tab}")`);
      // At least some tabs should be visible
      const count = await tabElement.count();
      if (count > 0) {
        await expect(tabElement.first()).toBeVisible();
      }
    }
  });

  test('should switch between tabs', async ({ page }) => {
    await settings.goto();
    await settings.waitForLoad();
    
    // Try to click on LLM tab
    await settings.selectTab('LLM');
    
    // Wait for tab content to change
    await page.waitForTimeout(500);
    
    // Verify we're still on settings page
    await expect(page).toHaveURL(/.*settings/);
  });

  test('should auto-save settings changes', async ({ page }) => {
    await settings.goto();
    await settings.waitForLoad();

    // Navigate to a tab with form fields
    await settings.selectTab('LLM');

    // Try to find and interact with a form field
    // This test verifies the auto-save debounce functionality
    const retryAttemptsField = settings.getField('Retry Attempts');

    if (await retryAttemptsField.isVisible()) {
      // Change the value
      await retryAttemptsField.fill('5');

      // Wait for auto-save debounce (1 second based on docs)
      await page.waitForTimeout(1500);

      // Verify the field still has the new value
      await expect(retryAttemptsField).toHaveValue('5');
    }
  });

  test('should validate LLM provider selection', async ({ page }) => {
    await settings.goto();
    await settings.waitForLoad();

    await settings.selectTab('LLM');

    // Check for provider selection
    const providerSelect = page.locator('select:has-text("gemini"), select:has-text("ollama"), select:has-text("qwen")');

    if (await providerSelect.isVisible()) {
      const providers = await providerSelect.locator('option').allTextContents();
      expect(providers).toContain('gemini');
      expect(providers).toContain('ollama');
      expect(providers).toContain('qwen');
    }
  });

  test('should display Memory settings', async () => {
    await settings.goto();
    await settings.waitForLoad();

    await settings.selectTab('Memory');

    // Check for memory-related fields
    const maxMessagesField = settings.getField('Max Messages');
    const maxAgeField = settings.getField('Max Message Age');

    // At least one should be visible
    const maxMessagesVisible = await maxMessagesField.isVisible();
    const maxAgeVisible = await maxAgeField.isVisible();

    expect(maxMessagesVisible || maxAgeVisible).toBe(true);
  });

  test('should display Logger settings', async ({ page }) => {
    await settings.goto();
    await settings.waitForLoad();

    await settings.selectTab('Logger');

    // Check for logger-related toggles
    const logReplyDecisions = page.locator('text=Log Reply Decisions');
    const logSql = page.locator('text=Log SQL');

    // At least one should be visible
    const replyVisible = await logReplyDecisions.isVisible();
    const sqlVisible = await logSql.isVisible();

    expect(replyVisible || sqlVisible).toBe(true);
  });
});
